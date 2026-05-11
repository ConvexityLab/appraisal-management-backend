/**
 * Auto-Assignment Orchestrator Service
 *
 * Event-driven state machine that fully automates:
 *   1. Vendor selection & bid dispatch when an engagement order is created
 *   2. Ranked-list retry when a vendor times out or declines
 *   3. Human-in-the-loop escalation when all vendors are exhausted
 *   4. QC/Staff reviewer assignment when a vendor submits an order
 *   5. Ranked-list retry when a reviewer times out
 *   6. Human-in-the-loop escalation when all reviewers are exhausted
 *
 * Event flow:
 *
 *   engagement.order.created
 *       → rank vendors → bid to vendor[0] → publish vendor.bid.sent
 *
 *   vendor.bid.timeout | vendor.bid.declined
 *       → try vendor[n+1] → publish vendor.bid.sent
 *       → if exhausted → publish vendor.assignment.exhausted (human step)
 *
 *   order.status.changed {newStatus: SUBMITTED}
 *       → add to QC queue → rank reviewers → assign reviewer[0]
 *       → publish review.assignment.requested + review.assigned
 *
 *   review.assignment.timeout
 *       → try reviewer[n+1] → publish review.assigned
 *       → if exhausted → publish review.assignment.exhausted (human step)
 *
 * State is persisted in the order document fields:
 *   order.autoVendorAssignment  — ranked vendor list + current attempt
 *   order.autoReviewAssignment  — ranked reviewer list + current attempt
 *
 * Both workflows are idempotent: re-processing the same event is safe.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import { VendorMatchingEngine } from './vendor-matching-engine.service.js';
import {
  AxiomService,
  type AxiomVendorBidAnalysisResult,
  type AxiomVendorBidCandidate,
  type AxiomVendorBidOrderDetails,
} from './axiom.service.js';
import { QCReviewQueueService } from './qc-review-queue.service.js';
import { TenantAutomationConfigService } from './tenant-automation-config.service.js';
import { SupervisoryReviewService } from './supervisory-review.service.js';
import {
  OrderContextLoader,
  getPropertyAddress,
  getLoanInformation,
  getDueDate,
  type OrderContext,
} from './order-context-loader.service.js';
import type { VendorMatchResult, MatchExplanation, DeniedVendorEntry } from '../types/vendor-marketplace.types.js';
import { AssignmentTraceRecorder } from './assignment-trace-recorder.service.js';
import type { AssignmentTraceDocument } from '../types/assignment-trace.types.js';
import type {
  AppEvent,
  BaseEvent,
  EventHandler,
  EngagementOrderCreatedEvent,
  EngagementLetterDeclinedEvent,
  VendorBidTimedOutEvent,
  VendorBidDeclinedEvent,
  VendorBidAcceptedEvent,
  VendorStaffAssignedEvent,
  OrderStatusChangedEvent,
  ReviewAssignmentTimedOutEvent,
  QCAIScoredEvent,
  AxiomEvaluationCompletedEvent,
  AxiomEvaluationTimedOutEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum vendors to contact before escalating to a human. */
const MAX_VENDOR_ATTEMPTS = 5;

/** Maximum reviewers to contact before escalating to a human. */
const MAX_REVIEWER_ATTEMPTS = 5;

/**
 * V-05: Hours before a vendor bid expires. Env-overridable so Ops can tune
 * without a deploy (e.g. shorter window for rush orders, longer for standard).
 */
const BID_EXPIRY_HOURS = Math.max(1, parseFloat(process.env.BID_EXPIRY_HOURS ?? '4'));

/** Hours before a reviewer assignment expires and the timeout job fires. */
const REVIEW_EXPIRY_HOURS = 8;

// ── Embedded state shapes (written into the order document) ──────────────────

export interface RankedVendorEntry {
  vendorId: string;
  vendorName: string;
  score: number;
  /**
   * Whether this entry is an internal staff member.
   * When 'internal', the orchestrator skips the bid loop and assigns directly.
   * Absent / 'external' = normal bid flow.
   */
  staffType?: 'internal' | 'external';
  /**
   * Role of the internal staff member — only set when staffType === 'internal'.
   */
  staffRole?: 'appraiser_internal' | 'inspector_internal' | 'reviewer' | 'supervisor';
  /**
   * T6/F9 audit: full deterministic match explanation for this vendor.
   * Optional for backwards compatibility with FSM states written before T6.
   */
  explanation?: MatchExplanation;
}

export interface AutoVendorAssignmentState {
  status: 'PENDING_BID' | 'ACCEPTED' | 'EXHAUSTED';
  rankedVendors: RankedVendorEntry[];
  currentAttempt: number; // 0-indexed; vendor in use is rankedVendors[currentAttempt]
  currentBidId: string | null;
  currentBidExpiresAt: string | null; // ISO date
  initiatedAt: string; // ISO date
  /**
   * V-02: ISO timestamp at which VendorTimeoutCheckerJob dispatched the
   * "bid expiring soon" reminder for the CURRENT bid. The job clears this
   * on every new bid (see orchestrator bid-send paths) so each attempt gets
   * at most one reminder.
   */
  expiringReminderSentAt?: string | null;
  // Broadcast-mode extension fields (undefined in sequential mode)
  broadcastMode?: boolean;
  broadcastBidIds?: string[];
  broadcastRound?: number;
  /**
   * T6/F9 audit: vendors filtered out by deny rules. Surfaced to operators
   * so they can answer "why didn't vendor X get considered?".
   */
  deniedVendors?: DeniedVendorEntry[];
}

export interface RankedReviewerEntry {
  reviewerId: string;
  reviewerName: string;
  workloadPct: number;
}

export interface AutoReviewAssignmentState {
  qcReviewId: string;
  status: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'EXHAUSTED';
  rankedReviewers: RankedReviewerEntry[];
  currentAttempt: number;
  currentAssignmentExpiresAt: string | null; // ISO date
  initiatedAt: string; // ISO date
}

export interface VendorBidAnalysisSnapshot {
  analysisType: 'appraisal_vendor_bid_analysis';
  analysisId?: string;
  recommendation?: string;
  recommendedVendorId?: string;
  recommendedVendorName?: string;
  confidence?: number;
  rationale?: string;
  rankedCandidates?: Array<Record<string, unknown>>;
  rankTrajectory?: VendorBidRankTrajectoryEntry[];
  overallRecommendation?: string;
  artifacts?: Record<string, unknown>;
  completedAt?: string;
  iterations?: number;
  source?: string;
  appliedRecommendation: boolean;
  appliedThreshold?: number;
  rulesBasedTopVendorId?: string;
  rulesBasedTopVendorName?: string;
  finalTopVendorId?: string;
  finalTopVendorName?: string;
  dispatchDecisionReason?: string;
  generatedAt: string;
  error?: string;
}

export interface VendorBidRankTrajectoryEntry {
  vendorId: string;
  vendorName: string;
  score: number;
  rulesBasedRank: number;
  finalRank: number;
  aiRank?: number;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class AutoAssignmentOrchestratorService {
  private readonly logger = new Logger('AutoAssignmentOrchestrator');
  private readonly publisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly matchingEngine: VendorMatchingEngine;
  private readonly axiomService: AxiomService;
  private readonly qcQueueService: QCReviewQueueService;
  private readonly tenantConfigService: TenantAutomationConfigService;
  private readonly supervisoryReviewService: SupervisoryReviewService;
  private readonly contextLoader: OrderContextLoader;
  private readonly traceRecorder: AssignmentTraceRecorder;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.contextLoader = new OrderContextLoader(this.dbService);
    this.traceRecorder = new AssignmentTraceRecorder(this.dbService);
    this.publisher = new ServiceBusEventPublisher();
    // Use a dedicated subscription so we don't compete with the notification service
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'auto-assignment-service',
    );
    this.matchingEngine = new VendorMatchingEngine();
    this.axiomService = new AxiomService(this.dbService);
    this.qcQueueService = new QCReviewQueueService();
    this.tenantConfigService = new TenantAutomationConfigService();
    this.supervisoryReviewService = new SupervisoryReviewService();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('AutoAssignmentOrchestrator already started');
      return;
    }

    this.logger.info('Starting AutoAssignmentOrchestrator — registering event handlers');

    await Promise.all([
      this.subscriber.subscribe<EngagementOrderCreatedEvent>(
        'engagement.order.created',
        this.makeHandler('engagement.order.created', this.onEngagementOrderCreated.bind(this)),
      ),
      this.subscriber.subscribe<VendorBidTimedOutEvent>(
        'vendor.bid.timeout',
        this.makeHandler('vendor.bid.timeout', this.onVendorBidTimedOut.bind(this)),
      ),
      this.subscriber.subscribe<VendorBidDeclinedEvent>(
        'vendor.bid.declined',
        this.makeHandler('vendor.bid.declined', this.onVendorBidDeclined.bind(this)),
      ),
      this.subscriber.subscribe<OrderStatusChangedEvent>(
        'order.status.changed',
        this.makeHandler('order.status.changed', this.onOrderStatusChanged.bind(this)),
      ),
      this.subscriber.subscribe<ReviewAssignmentTimedOutEvent>(
        'review.assignment.timeout',
        this.makeHandler('review.assignment.timeout', this.onReviewAssignmentTimedOut.bind(this)),
      ),
      // AI QC gate: routes needs_review / needs_supervision to human QC;
      // auto_pass is handled by AutoDeliveryService directly.
      this.subscriber.subscribe<QCAIScoredEvent>(
        'qc.ai.scored',
        this.makeHandler('qc.ai.scored', this.onQCAIScored.bind(this)),
      ),
      // Accept in broadcast mode: cancel all other pending bids.
      this.subscriber.subscribe<VendorBidAcceptedEvent>(
        'vendor.bid.accepted',
        this.makeHandler('vendor.bid.accepted', this.onVendorBidAccepted.bind(this)),
      ),
      // Axiom gate: route order to QC after Axiom evaluation completes.
      this.subscriber.subscribe<AxiomEvaluationCompletedEvent>(
        'axiom.evaluation.completed',
        this.makeHandler('axiom.evaluation.completed', this.onAxiomEvaluationCompleted.bind(this)),
      ),
      // Letter declined: vendor declined the engagement letter — retry next vendor in ranked list.
      this.subscriber.subscribe<EngagementLetterDeclinedEvent>(
        'engagement.letter.declined',
        this.makeHandler('engagement.letter.declined', this.onEngagementLetterDeclined.bind(this)),
      ),
      // Axiom webhook never arrived — route to human QC so the order is not stuck.
      this.subscriber.subscribe<AxiomEvaluationTimedOutEvent>(
        'axiom.evaluation.timeout',
        this.makeHandler('axiom.evaluation.timeout', this.onAxiomEvaluationTimedOut.bind(this)),
      ),
    ]);

    this.isStarted = true;
    this.logger.info('AutoAssignmentOrchestrator started — listening for assignment workflow events');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await Promise.all([
      this.subscriber.unsubscribe('engagement.order.created'),
      this.subscriber.unsubscribe('vendor.bid.timeout'),
      this.subscriber.unsubscribe('vendor.bid.declined'),
      this.subscriber.unsubscribe('order.status.changed'),
      this.subscriber.unsubscribe('review.assignment.timeout'),
      this.subscriber.unsubscribe('qc.ai.scored'),
      this.subscriber.unsubscribe('vendor.bid.accepted'),
      this.subscriber.unsubscribe('axiom.evaluation.completed'),
      this.subscriber.unsubscribe('engagement.letter.declined'),
      this.subscriber.unsubscribe('axiom.evaluation.timeout'),
    ]);
    this.isStarted = false;
    this.logger.info('AutoAssignmentOrchestrator stopped');
  }

  // ── Public trigger — allows controllers/tests to directly kick off a flow ──

  /**
   * Directly trigger auto vendor assignment for an order.
   * Called from the order controller after creating an order with an engagementId,
   * or can be triggered manually by an operator.
   */
  async triggerVendorAssignment(params: {
    orderId: string;
    orderNumber: string;
    tenantId: string;
    engagementId: string;
    productType: string;
    propertyAddress: string;
    propertyState: string;
    clientId: string;
    loanAmount: number;
    priority: 'STANDARD' | 'RUSH' | 'EMERGENCY';
    dueDate: Date;
    /** Product being ordered — enables matching engine eligibility gate */
    productId?: string;
    /** Vendor must support ALL of these capabilities to be eligible */
    requiredCapabilities?: string[];
  }): Promise<void> {
    const event: EngagementOrderCreatedEvent = {
      id: uuidv4(),
      type: 'engagement.order.created',
      timestamp: new Date(),
      source: 'auto-assignment-orchestrator',
      version: '1.0',
      category: EventCategory.ASSIGNMENT,
      data: {
        engagementId: params.engagementId,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        tenantId: params.tenantId,
        productType: params.productType,
        propertyAddress: params.propertyAddress,
        propertyState: params.propertyState,
        clientId: params.clientId,
        loanAmount: params.loanAmount,
        priority: this.mapPriority(params.priority),
        dueDate: params.dueDate,
        ...(params.productId ? { productId: params.productId } : {}),
        ...(params.requiredCapabilities?.length ? { requiredCapabilities: params.requiredCapabilities } : {}),
      },
    };
    await this.onEngagementOrderCreated(event);
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  /**
   * Triggered when an engagement order is created.
   * Ranks vendors and sends the first bid request.
   */
  private async onEngagementOrderCreated(event: EngagementOrderCreatedEvent): Promise<void> {
    const { orderId, orderNumber, tenantId, propertyAddress, productType, dueDate, priority, clientId,
      productId, requiredCapabilities } = event.data;

    // Phase 5 T37: capture wall-clock for the trace's rankingLatencyMs.
    const triggerStart = Date.now();
    const initiatedAt = new Date(triggerStart).toISOString();

    this.logger.info('Processing engagement.order.created', { orderId, orderNumber });

    // --- Guard: don't re-initiate if already in progress ---
    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.error('Order not found for engagement.order.created', { orderId });
      return;
    }
    if ((order.autoVendorAssignment as AutoVendorAssignmentState | undefined)?.status === 'PENDING_BID') {
      this.logger.info('Auto vendor assignment already in progress — skipping duplicate event', { orderId });
      return;
    }

    // --- Load client automation config ---
    const tenantConfig = await this.tenantConfigService.getConfig(order.clientId);

    // --- Respect autoAssignmentEnabled flag ---
    if (!tenantConfig.autoAssignmentEnabled) {
      this.logger.info('Auto-assignment disabled by tenant config — escalating to human', { orderId, tenantId });
      await this.escalateVendorAssignment(order, tenantId, []);
      return;
    }

    const maxAttempts = tenantConfig.maxVendorAttempts;

    // --- Rank vendors (T6: also collect denied vendors for FSM audit trail) ---
    let rankedVendors: RankedVendorEntry[] = [];
    let matchResults: VendorMatchResult[] = [];
    let deniedVendors: DeniedVendorEntry[] = [];
    // Phase D.faithful — frozen facts the rules engine evaluated; persisted
    // on the assignment-trace doc so Sandbox replay can re-evaluate against
    // the SAME facts that drove the original decision.
    let evaluationsSnapshot: Awaited<ReturnType<typeof this.matchingEngine.findMatchingVendorsAndDenied>>['evaluationsSnapshot'] = [];
    try {
      const result = await this.matchingEngine.findMatchingVendorsAndDenied(
        {
          orderId,
          tenantId,
          propertyAddress,
          propertyType: productType,
          dueDate: new Date(dueDate),
          urgency: priority === EventPriority.CRITICAL ? 'SUPER_RUSH'
            : priority === EventPriority.HIGH ? 'RUSH'
            : 'STANDARD',
          // Hard gates: only vendors eligible for this product + capabilities flow through
          ...(productId ? { productId } : {}),
          ...(requiredCapabilities?.length ? { requiredCapabilities } : {}),
          clientPreferences: {
            excludedVendors: [] as string[],
            ...(tenantConfig.preferredVendorIds?.length
              ? { preferredVendors: tenantConfig.preferredVendorIds }
              : {}),
          },
        },
        maxAttempts,
      );
      matchResults = result.matches;
      deniedVendors = result.denied;
      evaluationsSnapshot = result.evaluationsSnapshot;

      rankedVendors = matchResults.map((r) => ({
        vendorId: r.vendorId,
        vendorName: r.vendor.name,
        score: r.matchScore,
        explanation: r.explanation,
      }));
    } catch (err) {
      this.logger.error('Vendor matching failed for order', { orderId, error: err });
    }

    if (rankedVendors.length === 0) {
      // No vendors at all — immediately escalate to human
      this.logger.warn('No matching vendors found — escalating immediately', { orderId });
      await this.recordAssignmentTrace({
        tenantId, orderId, initiatedAt, triggerStart,
        propertyAddress, productType,
        ...(productId ? { productId } : {}),
        ...(requiredCapabilities?.length ? { requiredCapabilities } : {}),
        dueDate: dueDate as unknown as Date,
        priority,
        rankedVendors: [],
        deniedVendors,
        matchResults: [],
        evaluationsSnapshot,
        outcome: 'escalated',
        selectedVendorId: null,
      });
      await this.escalateVendorAssignment(order, tenantId, []);
      return;
    }

    // --- Enrich ranked vendors with staffType so the FSM can short-circuit
    //     for internal staff without extra DB lookups on each retry. ---
    rankedVendors = await this.enrichWithStaffType(rankedVendors, tenantId);

    const { rankedVendors: maybeAiRankedVendors, vendorBidAnalysis } =
      await this.maybeApplyAIVendorBidScoring(order, tenantId, rankedVendors, matchResults);
    rankedVendors = maybeAiRankedVendors;
    const orderForDispatch = vendorBidAnalysis
      ? { ...order, vendorBidAnalysis }
      : order;

    // --- Initialise state and send first bid (or direct staff assignment) ---
    const broadcastMode = tenantConfig.bidMode === 'broadcast';
    if (broadcastMode) {
      const state: AutoVendorAssignmentState = {
        status: 'PENDING_BID',
        rankedVendors,
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: new Date().toISOString(),
        broadcastMode: true,
        broadcastBidIds: [],
        broadcastRound: 1,
        ...(deniedVendors.length > 0 ? { deniedVendors } : {}),
      };
      await this.sendBroadcastBids(orderForDispatch, state, tenantId, priority, tenantConfig.broadcastCount);
    } else {
      const state: AutoVendorAssignmentState = {
        status: 'PENDING_BID',
        rankedVendors,
        currentAttempt: 0,
        currentBidId: null,
        currentBidExpiresAt: null,
        initiatedAt: new Date().toISOString(),
        ...(deniedVendors.length > 0 ? { deniedVendors } : {}),
      };
      await this.sendBidToVendor(orderForDispatch, state, tenantId, priority);
    }

    // Phase 5 T37: persist the per-assignment trace. Best-effort; recorder
    // logs + swallows on failure so an assignment never fails because we
    // couldn't write a trace.
    {
      const top = rankedVendors[0];
      const isInternal = top?.staffType === 'internal';
      const outcome: AssignmentTraceDocument['outcome'] = broadcastMode
        ? 'broadcast'
        : isInternal
          ? 'assigned_internal'
          : 'pending_bid';
      await this.recordAssignmentTrace({
        tenantId, orderId, initiatedAt, triggerStart,
        propertyAddress, productType,
        ...(productId ? { productId } : {}),
        ...(requiredCapabilities?.length ? { requiredCapabilities } : {}),
        dueDate: dueDate as unknown as Date,
        priority,
        rankedVendors,
        deniedVendors,
        matchResults,
        evaluationsSnapshot,
        outcome,
        selectedVendorId: top?.vendorId ?? null,
      });
    }

    // --- Post-assignment: trigger supervisory review if tenant policy requires it ---
    const loanAmount = typeof (order as any).loanAmount === 'number' ? (order as any).loanAmount : 0;
    const needsSupervision =
      tenantConfig.supervisoryReviewForAllOrders ||
      (tenantConfig.supervisoryReviewValueThreshold > 0 && loanAmount > tenantConfig.supervisoryReviewValueThreshold);

    if (needsSupervision && tenantConfig.defaultSupervisorId) {
      try {
        await this.supervisoryReviewService.requestSupervision({
          orderId,
          tenantId,
          supervisorId: tenantConfig.defaultSupervisorId,
          reason: tenantConfig.supervisoryReviewForAllOrders ? 'policy_requirement' : 'high_value',
          requestedBy: 'auto-assignment-orchestrator',
        });
        this.logger.info('Supervisory review requested by orchestrator', { orderId, tenantId });
      } catch (supervisionErr) {
        // Do not block the assignment workflow if supervision request fails.
        // Log and continue — the coordinator can request it manually.
        this.logger.error('Failed to auto-request supervisory review', { orderId, error: supervisionErr });
      }
    }
  }

  /**
   * Triggered by the VendorTimeoutCheckerJob when a vendor does not respond.
   */
  private async onVendorBidTimedOut(event: VendorBidTimedOutEvent): Promise<void> {
    const { orderId, tenantId, attemptNumber } = event.data;
    this.logger.info('Processing vendor.bid.timeout', { orderId, attemptNumber });
    await this.advanceVendorAssignment(orderId, tenantId, event.data.priority);
  }

  /**
   * Triggered when a vendor explicitly declines a bid (via the bid controller).
   */
  private async onVendorBidDeclined(event: VendorBidDeclinedEvent): Promise<void> {
    const { orderId, tenantId, attemptNumber, declineReason } = event.data;
    this.logger.info('Processing vendor.bid.declined', { orderId, attemptNumber, declineReason });
    await this.advanceVendorAssignment(orderId, tenantId, event.data.priority);
  }

  /**
   * Triggered when a vendor declines the engagement letter after accepting
   * the bid.  Treat this identically to a bid decline: advance to the next
   * vendor in the ranked list.  The declined vendor is not made ineligible
   * for future orders — letter-declination is not a performance signal.
   */
  private async onEngagementLetterDeclined(event: EngagementLetterDeclinedEvent): Promise<void> {
    const { orderId, tenantId, vendorId, reason } = event.data;
    this.logger.info('Processing engagement.letter.declined — advancing to next vendor', {
      orderId,
      vendorId,
      reason,
    });
    await this.advanceVendorAssignment(orderId, tenantId, event.data.priority);
  }

  /**
   * Triggered when a vendor accepts a bid.
   *
   * In broadcast mode: cancel all other pending bids for the same order so
   * that only the accepting vendor proceeds.  In sequential mode this is a
   * no-op (the bid loop already moved forward).
   */
  private async onVendorBidAccepted(event: VendorBidAcceptedEvent): Promise<void> {
    const { orderId, tenantId, vendorId, vendorName } = event.data;

    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.warn('onVendorBidAccepted: order not found', { orderId });
      return;
    }

    const state = order.autoVendorAssignment as AutoVendorAssignmentState | undefined;
    if (!state?.broadcastMode || !state.broadcastBidIds?.length) {
      // Sequential mode — acceptance is handled by the bid controller; nothing to do here.
      return;
    }

    if (state.status === 'ACCEPTED') {
      // Another vendor was already accepted (race) — decline this late acceptance.
      this.logger.info('Broadcast mode: ignoring late acceptance (already accepted)', {
        orderId, vendorId,
      });
      return;
    }

    // Cancel all other pending broadcast bids
    await this.cancelPendingBroadcastBids(
      order,
      tenantId,
      state.broadcastBidIds.filter((id) => id !== `bid-${orderId}-${vendorId}-${event.timestamp.getTime()}`),
      vendorId,
    );

    // Update state to ACCEPTED
    const acceptedState: AutoVendorAssignmentState = {
      ...state,
      status: 'ACCEPTED',
      currentBidId: null,
      currentBidExpiresAt: null,
    };

    await this.dbService.updateItem(
      'orders',
      orderId,
      {
        ...order,
        autoVendorAssignment: acceptedState,
        assignedVendorId: vendorId,
        assignedVendorName: vendorName,
        assignedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tenantId,
    );

    this.logger.info('Broadcast mode: vendor accepted — all other bids cancelled', {
      orderId, vendorId, vendorName,
    });
  }

  /**
   * Triggered when Axiom finishes evaluating a submitted order.
   *
   * When `axiomAutoTrigger` is true, the orchestrator deferred review
   * assignment from `onOrderStatusChanged`.  This handler now routes:
   *   ACCEPT / CONDITIONAL  → assign to QC reviewer (human or by AI gate if also enabled)
   *   REJECT / UNKNOWN      → log and also route to QC (human judgment required)
   *   status: 'failed'      → pipeline failed; also route to QC so order is not stuck
   */
  private async onAxiomEvaluationCompleted(event: AxiomEvaluationCompletedEvent): Promise<void> {
    const { orderId, tenantId, clientId, overallDecision, status, priority } = event.data;

    this.logger.info('axiom.evaluation.completed received', { orderId, overallDecision, status });

    // Check whether this client actually uses Axiom auto-trigger.
    const tenantConfig = await this.tenantConfigService.getConfig(clientId);
    if (!tenantConfig.axiomAutoTrigger) {
      // Another tenant path — not our concern.
      return;
    }

    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.warn('onAxiomEvaluationCompleted: order not found', { orderId });
      return;
    }

    if (status === 'failed') {
      this.logger.warn(
        'Axiom evaluation failed — routing to human QC regardless',
        { orderId, overallDecision },
      );
    } else {
      this.logger.info(
        `Axiom decision: ${overallDecision} — routing to QC reviewer`,
        { orderId, overallDecision },
      );
    }

    // If AI QC is also enabled, it runs on the same SUBMITTED event — let it handle routing.
    if (tenantConfig.aiQcEnabled) {
      this.logger.info(
        'aiQcEnabled also true — AI QC gate handles final routing; no action from Axiom path',
        { orderId },
      );
      return;
    }

    // Route to human QC (or AI gate if not separately enabled here).
    await this.initiateReviewAssignment(order, tenantId, priority);
  }

  /**
   * Triggered when AxiomTimeoutWatcherJob fires because Axiom never responded.
   * Routes the order to human QC so it is not stuck indefinitely.
   */
  private async onAxiomEvaluationTimedOut(event: AxiomEvaluationTimedOutEvent): Promise<void> {
    const { orderId, tenantId, clientId, timeoutMinutes } = event.data;

    this.logger.warn('axiom.evaluation.timeout received — routing to human QC', {
      orderId,
      timeoutMinutes,
    });

    const tenantConfig = await this.tenantConfigService.getConfig(clientId);
    if (!tenantConfig.axiomAutoTrigger) {
      return;
    }

    // Defer to AI QC gate if enabled — that gate already handles routing.
    if (tenantConfig.aiQcEnabled) {
      this.logger.info(
        'aiQcEnabled also true — AI QC gate handles final routing; no action from timeout path',
        { orderId },
      );
      return;
    }

    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.warn('onAxiomEvaluationTimedOut: order not found', { orderId });
      return;
    }

    await this.initiateReviewAssignment(order, tenantId, event.data.priority);
  }

  /**
   * Triggered when an order status changes.
   * React to SUBMITTED (vendor delivered) → kick off review assignment.
   *
   * When aiQcEnabled is true for the tenant, the AIQCGateService intercepts
   * this event on its own subscription and publishes qc.ai.scored. The
   * orchestrator then routes from there (see onQCAIScored below). Returning
   * early here avoids starting review assignment twice.
   */
  private async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.data.newStatus !== 'SUBMITTED') return;

    const { orderId, tenantId, clientId, priority } = event.data;

    // Defer to the AI QC gate when it is enabled — routing happens in onQCAIScored.
    const tenantConfig = await this.tenantConfigService.getConfig(clientId);
    if (tenantConfig.aiQcEnabled) {
      this.logger.info(
        'AI QC gate enabled — deferring review routing to qc.ai.scored event',
        { orderId, tenantId },
      );
      return;
    }

    // Defer to the Axiom gate when axiom auto-trigger is enabled.
    // onAxiomEvaluationCompleted will route to review after Axiom finishes.
    if (tenantConfig.axiomAutoTrigger) {
      this.logger.info(
        'Axiom auto-trigger enabled — deferring review routing to axiom.evaluation.completed',
        { orderId, tenantId },
      );
      return;
    }

    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.warn('order.status.changed(SUBMITTED): order not found', { orderId });
      return;
    }

    this.logger.info('Order SUBMITTED — initiating review assignment (no AI gate)', {
      orderId,
      tenantId,
    });
    await this.initiateReviewAssignment(order, tenantId, priority);
  }

  /**
   * Triggered after the AI QC gate scores a submitted order.
   *
   * auto_pass        → AutoDeliveryService handles delivery; nothing to do here.
   * needs_review     → route to human QC analyst.
   * needs_supervision → route to human QC analyst AND request supervisory co-sign.
   */
  private async onQCAIScored(event: QCAIScoredEvent): Promise<void> {
    const { orderId, tenantId, clientId, decision, priority, score } = event.data;

    this.logger.info('qc.ai.scored received', { orderId, score, decision });

    if (decision === 'auto_pass') {
      // AutoDeliveryService (separate subscription) handles this path.
      return;
    }

    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.warn('qc.ai.scored: order not found', { orderId });
      return;
    }

    // Route to human QC regardless of decision (both need_review + needs_supervision).
    await this.initiateReviewAssignment(order, tenantId, priority);

    // For needs_supervision, also request a supervisory co-sign.
    if (decision === 'needs_supervision') {
      const tenantConfig = await this.tenantConfigService.getConfig(clientId);
      if (tenantConfig.defaultSupervisorId) {
        try {
          await this.supervisoryReviewService.requestSupervision({
            orderId,
            tenantId,
            supervisorId: tenantConfig.defaultSupervisorId,
            reason: 'ai_flag',
            requestedBy: 'ai-qc-gate',
          });
          this.logger.info('Supervisory review requested (AI flag)', { orderId, score });
        } catch (err) {
          // Non-fatal: human QC is still assigned; supervisor can be added manually.
          this.logger.error('Failed to auto-request supervision after AI flag', {
            orderId,
            error: err,
          });
        }
      } else {
        this.logger.warn(
          'AI flagged supervision required but no defaultSupervisorId configured',
          { orderId, tenantId },
        );
      }
    }
  }

  /**
   * Triggered by the ReviewAssignmentTimeoutJob when a reviewer does not accept.
   */
  private async onReviewAssignmentTimedOut(event: ReviewAssignmentTimedOutEvent): Promise<void> {
    const { orderId, tenantId, qcReviewId, attemptNumber } = event.data;
    this.logger.info('Processing review.assignment.timeout', { orderId, qcReviewId, attemptNumber });
    await this.advanceReviewAssignment(orderId, tenantId, qcReviewId, event.data.priority);
  }

  // ── Vendor Assignment FSM ─────────────────────────────────────────────────

  /**
   * Send a bid invitation to the vendor at `state.currentAttempt`.
   * Updates the order document and publishes vendor.bid.sent.
   */
  private async sendBidToVendor(
    order: any,
    state: AutoVendorAssignmentState,
    tenantId: string,
    priority: EventPriority,
  ): Promise<void> {
    const vendor = state.rankedVendors[state.currentAttempt];
    if (!vendor) {
      this.logger.error('sendBidToVendor called beyond ranked list', {
        orderId: order.id,
        attempt: state.currentAttempt,
        listLength: state.rankedVendors.length,
      });
      return;
    }

    // Internal staff bypass the bid loop entirely.
    if (vendor.staffType === 'internal') {
      await this.assignStaffDirectly(order, state, vendor, tenantId, priority);
      return;
    }

    const expiresAt = new Date(Date.now() + BID_EXPIRY_HOURS * 60 * 60 * 1000);
    const bidId = `bid-${order.id}-${vendor.vendorId}-${Date.now()}`;

    // Phase 7: load joined OrderContext so the bid invitation carries
    // propertyAddress / dueDate / orderType from the parent ClientOrder
    // when present. Best-effort; falls back to the bare order shape on
    // load failure.
    let bidCtx;
    try {
      bidCtx = await this.contextLoader.loadByVendorOrder(order, { includeProperty: true });
    } catch (err) {
      this.logger.warn('sendBidToVendor: could not load OrderContext; using bare order', {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const bidPropertyAddress = this.resolveOrderAddressText(order, bidCtx);
    const bidDueDate = bidCtx ? getDueDate(bidCtx) : order.dueDate;
    const bidOrderType = bidCtx?.clientOrder?.orderType ?? order.orderType;

    // Create the bid invitation document
    const bidInvitation = {
      id: bidId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      tenantId,
      propertyType: order.productType ?? bidOrderType,
      dueDate: bidDueDate,
      urgency: order.priority,
      status: 'PENDING',
      invitedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      attemptNumber: state.currentAttempt + 1,
      entityType: 'vendor-bid-invitation',
      isAutoAssignment: true,
    };

    // Persist order state FIRST (with pre-generated bidId) so that if the bid
    // document creation fails, the order state is already updated and the bid
    // reference is not orphaned in the DB.
    const updatedState: AutoVendorAssignmentState = {
      ...state,
      currentBidId: bidId,
      currentBidExpiresAt: expiresAt.toISOString(),
      expiringReminderSentAt: null, // V-02: reset so this new bid is eligible for a reminder
    };

    await this.dbService.updateItem(
      'orders',
      order.id,
      { ...order, autoVendorAssignment: updatedState, updatedAt: new Date().toISOString() },
      tenantId,
    );

    // Create the bid invitation document after order state is committed
    await this.dbService.createItem('vendor-bids', bidInvitation);

    // Publish event
    await this.publisher.publish({
      id: uuidv4(),
      type: 'vendor.bid.sent',
      timestamp: new Date(),
      source: 'auto-assignment-orchestrator',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId,
        clientId: order.clientId,
        vendorId: vendor.vendorId,
        vendorName: vendor.vendorName,
        bidId,
        expiresAt,
        attemptNumber: state.currentAttempt + 1,
        priority,
      },
    });

    this.logger.info('Bid invitation sent', {
      orderId: order.id,
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      attempt: state.currentAttempt + 1,
      expiresAt: expiresAt.toISOString(),
    });
  }

  /**
   * Move to the next vendor in the ranked list.
   * Called after a timeout or decline event.
   */
  private async advanceVendorAssignment(
    orderId: string,
    tenantId: string,
    priority: EventPriority,
  ): Promise<void> {
    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.error('advanceVendorAssignment: order not found', { orderId });
      return;
    }

    const state = order.autoVendorAssignment as AutoVendorAssignmentState | undefined;
    if (!state) {
      this.logger.warn('advanceVendorAssignment: no autoVendorAssignment state on order', { orderId });
      return;
    }
    if (state.status !== 'PENDING_BID') {
      this.logger.info('advanceVendorAssignment: state is not PENDING_BID — ignoring', {
        orderId,
        status: state.status,
      });
      return;
    }

    const nextAttempt = state.currentAttempt + 1;
    const nextVendor = state.rankedVendors[nextAttempt];

    if (!nextVendor) {
      // All vendors exhausted
      const vendorsContacted = state.rankedVendors
        .slice(0, nextAttempt)
        .map((v) => v.vendorId);
      await this.escalateVendorAssignment(order, tenantId, vendorsContacted);
      return;
    }

    const nextState: AutoVendorAssignmentState = {
      ...state,
      currentAttempt: nextAttempt,
      currentBidId: null,
      currentBidExpiresAt: null,
    };

    await this.sendBidToVendor(order, nextState, tenantId, priority);
  }

  // ── Broadcast mode helpers ────────────────────────────────────────────────

  /**
   * Broadcast mode: contact the top N vendors simultaneously.
   * All bids share the same expiry and the same round number.
   * The first vendor to accept wins; onVendorBidAccepted cancels the rest.
   */
  private async sendBroadcastBids(
    order: any,
    state: AutoVendorAssignmentState,
    tenantId: string,
    priority: EventPriority,
    broadcastCount: number,
  ): Promise<void> {
    const round = state.broadcastRound ?? 1;
    const vendors = state.rankedVendors.slice(0, broadcastCount);

    if (vendors.length === 0) {
      this.logger.warn('sendBroadcastBids: no vendors to broadcast to', { orderId: order.id });
      await this.escalateVendorAssignment(order, tenantId, []);
      return;
    }

    const expiresAt = new Date(Date.now() + BID_EXPIRY_HOURS * 60 * 60 * 1000);
    const broadcastBidIds: string[] = [];

    // Phase 7: load joined OrderContext once for the whole broadcast batch
    // so all bid invitations carry propertyAddress / dueDate / orderType
    // from the parent ClientOrder.
    let broadcastCtx;
    try {
      broadcastCtx = await this.contextLoader.loadByVendorOrder(order, { includeProperty: true });
    } catch (err) {
      this.logger.warn('sendBroadcastBids: could not load OrderContext; using bare order', {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const broadcastPropertyAddress = this.resolveOrderAddressText(order, broadcastCtx);
    const broadcastDueDate = broadcastCtx ? getDueDate(broadcastCtx) : order.dueDate;
    const broadcastOrderType = broadcastCtx?.clientOrder?.orderType ?? order.orderType;

    // Persist order state and create bid documents for every vendor in the batch
    for (const vendor of vendors) {
      if (vendor.staffType === 'internal') {
        // Internal staff: bypass bid and assign directly — broadcast terminates early
        await this.assignStaffDirectly(order, state, vendor, tenantId, priority);
        return;
      }

      const bidId = `bid-${order.id}-${vendor.vendorId}-${Date.now()}`;
      broadcastBidIds.push(bidId);

      const bidInvitation = {
        id: bidId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        vendorId: vendor.vendorId,
        vendorName: vendor.vendorName,
        tenantId,
        propertyAddress: broadcastPropertyAddress,
        propertyType: order.productType ?? broadcastOrderType,
        dueDate: broadcastDueDate,
        urgency: order.priority,
        status: 'PENDING',
        invitedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        attemptNumber: round,
        entityType: 'vendor-bid-invitation',
        isAutoAssignment: true,
        broadcastRound: round,
      };

      await this.dbService.createItem('vendor-bids', bidInvitation);
    }

    // Update order state with the batch of bid IDs
    const updatedState: AutoVendorAssignmentState = {
      ...state,
      currentBidExpiresAt: expiresAt.toISOString(),
      expiringReminderSentAt: null, // V-02: reset so this new round is eligible for a reminder
      broadcastBidIds,
      broadcastRound: round,
    };

    await this.dbService.updateItem(
      'orders',
      order.id,
      { ...order, autoVendorAssignment: updatedState, updatedAt: new Date().toISOString() },
      tenantId,
    );

    // Publish round started event
    await this.publisher.publish({
      id: uuidv4(),
      type: 'vendor.bid.round.started',
      timestamp: new Date(),
      source: 'auto-assignment-orchestrator',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId,
        clientId: order.clientId,
        roundNumber: round,
        vendorIds: vendors.map((v) => v.vendorId),
        expiresAt,
        priority,
      },
    });

    // Publish individual vendor.bid.sent events for each vendor
    for (const [idx, vendor] of vendors.entries()) {
      await this.publisher.publish({
        id: uuidv4(),
        type: 'vendor.bid.sent',
        timestamp: new Date(),
        source: 'auto-assignment-orchestrator',
        version: '1.0',
        category: EventCategory.VENDOR,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          tenantId,
          clientId: order.clientId,
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName,
          bidId: broadcastBidIds[idx]!,
          expiresAt,
          attemptNumber: round,
          priority,
        },
      });
    }

    this.logger.info('Broadcast round started', {
      orderId: order.id,
      round,
      vendorCount: vendors.length,
      expiresAt: expiresAt.toISOString(),
    });
  }

  /**
   * Cancel all bid documents in a broadcast round, except the one for the
   * accepting vendor.  Published as status=CANCELLED on each bid document.
   */
  private async cancelPendingBroadcastBids(
    order: any,
    tenantId: string,
    bidIdsToCancel: string[],
    winningVendorId: string,
  ): Promise<void> {
    const container = this.dbService.getContainer('vendor-bids');

    await Promise.allSettled(
      bidIdsToCancel.map(async (bidId) => {
        try {
          const { resources } = await container.items
            .query<Record<string, unknown>>({
              query: `SELECT * FROM c WHERE c.id = @id AND c.orderId = @orderId`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              parameters: [{ name: '@id', value: bidId }, { name: '@orderId', value: order.id }] as any,
            })
            .fetchAll();

          if (resources.length > 0) {
            const bid = { ...resources[0], status: 'CANCELLED', cancelledAt: new Date().toISOString() };
            await container.items.upsert(bid);
          }
        } catch (err) {
          this.logger.warn('Failed to cancel broadcast bid', {
            bidId,
            error: (err as Error).message,
          });
        }
      }),
    );

    this.logger.info('Cancelled broadcast bids after acceptance', {
      orderId: order.id,
      winningVendorId,
      cancelledCount: bidIdsToCancel.length,
    });
  }

  /**
   * Phase 5 T37 — build + persist a per-assignment trace document.
   * Best-effort: AssignmentTraceRecorder logs + swallows on storage failure.
   *
   * Co-locates everything an operator (or replay/sandbox in Phase 6) needs to
   * answer "why this vendor / why not vendor X / how long did it take" from
   * the order detail page without joining against the order itself.
   */
  private async recordAssignmentTrace(args: {
    tenantId: string;
    orderId: string;
    initiatedAt: string;
    triggerStart: number;
    propertyAddress: string;
    productType: string;
    productId?: string;
    requiredCapabilities?: string[];
    dueDate: Date;
    priority: EventPriority | 'STANDARD' | 'RUSH' | 'EMERGENCY';
    rankedVendors: RankedVendorEntry[];
    deniedVendors: DeniedVendorEntry[];
    matchResults: VendorMatchResult[];
    /** Phase D.faithful — frozen facts the engine evaluated. */
    evaluationsSnapshot?: AssignmentTraceDocument['evaluationsSnapshot'];
    outcome: AssignmentTraceDocument['outcome'];
    selectedVendorId: string | null;
  }): Promise<void> {
    // Pull the rules provider name off the engine when available — gives the
    // trace UI a way to indicate whether the eval ran on MOP or homegrown.
    const providerName =
      (this.matchingEngine as any)?.rulesProvider?.name ?? 'unknown';

    // Build ranked entries with the explanation off matchResults (rankedVendors
    // also carries explanation but we double-source for resilience against
    // ordering shifts from the AI rerank).
    const explanationByVendorId = new Map<string, MatchExplanation | undefined>();
    for (const r of args.matchResults) explanationByVendorId.set(r.vendorId, r.explanation);

    const trace: AssignmentTraceDocument = {
      id: AssignmentTraceRecorder.composeId(args.tenantId, args.orderId, args.initiatedAt),
      type: 'assignment-trace',
      tenantId: args.tenantId,
      orderId: args.orderId,
      initiatedAt: args.initiatedAt,
      rulesProviderName: providerName,
      matchRequest: {
        propertyAddress: args.propertyAddress,
        propertyType: args.productType,
        ...(args.productId ? { productId: args.productId } : {}),
        ...(args.requiredCapabilities?.length ? { requiredCapabilities: args.requiredCapabilities } : {}),
        dueDate: args.dueDate.toISOString(),
        urgency:
          args.priority === EventPriority.CRITICAL ? 'SUPER_RUSH'
          : args.priority === EventPriority.HIGH ? 'RUSH'
          : 'STANDARD',
      },
      rankedVendors: args.rankedVendors.map(v => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        score: v.score,
        ...(v.staffType ? { staffType: v.staffType } : {}),
        ...(v.staffRole ? { staffRole: v.staffRole } : {}),
        ...((v.explanation ?? explanationByVendorId.get(v.vendorId))
          ? { explanation: v.explanation ?? explanationByVendorId.get(v.vendorId)! }
          : {}),
      })),
      deniedVendors: args.deniedVendors,
      outcome: args.outcome,
      selectedVendorId: args.selectedVendorId,
      rankingLatencyMs: Date.now() - args.triggerStart,
      ...(args.evaluationsSnapshot && args.evaluationsSnapshot.length > 0
        ? { evaluationsSnapshot: args.evaluationsSnapshot }
        : {}),
    };

    await this.traceRecorder.record(trace);
  }

  /**
   * All vendors exhausted — mark order and publish escalation event.
   */
  private async escalateVendorAssignment(
    order: any,
    tenantId: string,
    vendorsContacted: string[],
  ): Promise<void> {
    const exhausedState: Partial<AutoVendorAssignmentState> = {
      status: 'EXHAUSTED',
      currentBidId: null,
      currentBidExpiresAt: null,
    };

    await this.dbService.updateItem(
      'orders',
      order.id,
      {
        ...order,
        autoVendorAssignment: {
          ...(order.autoVendorAssignment ?? {}),
          ...exhausedState,
        },
        requiresHumanVendorAssignment: true,
        updatedAt: new Date().toISOString(),
      },
      tenantId,
    );

    await this.publisher.publish({
      id: uuidv4(),
      type: 'vendor.assignment.exhausted',
      timestamp: new Date(),
      source: 'auto-assignment-orchestrator',
      version: '1.0',
      category: EventCategory.ASSIGNMENT,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId,
        clientId: order.clientId,
        attemptsCount: vendorsContacted.length,
        vendorsContacted,
        priority: EventPriority.HIGH,
        requiresHumanIntervention: true,
      },
    });

    this.logger.warn('Vendor assignment exhausted — human intervention required', {
      orderId: order.id,
      ordernNumber: order.orderNumber,
      attemptsCount: vendorsContacted.length,
    });
  }

  // ── Review Assignment FSM ─────────────────────────────────────────────────

  /**
   * Directly assign an internal staff member to an order, bypassing the bid
   * loop.  The order is marked ACCEPTED immediately and a
   * `vendor.staff.assigned` event is published so that downstream consumers
   * (notifications, audit trail) can react without special-casing.
   *
   * Capacity enforcement: the vendor's activeOrderCount is incremented
   * immediately after the order is marked ACCEPTED so that subsequent scoring
   * cycles see the updated load without waiting for a background job.
   */
  private async assignStaffDirectly(
    order: any,
    state: AutoVendorAssignmentState,
    vendor: RankedVendorEntry,
    tenantId: string,
    priority: EventPriority,
  ): Promise<void> {
    const acceptedState: AutoVendorAssignmentState = {
      ...state,
      status: 'ACCEPTED',
      currentBidId: null,
      currentBidExpiresAt: null,
    };

    await this.dbService.updateItem(
      'orders',
      order.id,
      {
        ...order,
        autoVendorAssignment: acceptedState,
        assignedVendorId: vendor.vendorId,
        assignedVendorName: vendor.vendorName,
        assignedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tenantId,
    );

    // Increment the vendor's active order count so subsequent matching cycles
    // see the correct load. Non-fatal: a failure here is logged but does not
    // roll back the assignment — the order is already ACCEPTED.
    try {
      const vendorResult = await this.dbService.getItem('vendors', vendor.vendorId, tenantId);
      const vendorDoc: Record<string, unknown> | null =
        (vendorResult as any)?.data ?? vendorResult ?? null;
      if (vendorDoc) {
        const currentCount =
          (vendorDoc['activeOrderCount'] as number | undefined) ??
          (vendorDoc['currentActiveOrders'] as number | undefined) ??
          0;
        await this.dbService.updateItem(
          'vendors',
          vendor.vendorId,
          { ...vendorDoc, activeOrderCount: currentCount + 1, updatedAt: new Date().toISOString() },
          tenantId,
        );
      }
    } catch (capacityErr) {
      this.logger.warn('Failed to increment activeOrderCount on staff vendor', {
        vendorId: vendor.vendorId,
        error: capacityErr,
      });
    }

    const staffAssignedEvent: VendorStaffAssignedEvent = {
      id: uuidv4(),
      type: 'vendor.staff.assigned',
      timestamp: new Date(),
      source: 'auto-assignment-orchestrator',
      version: '1.0',
      category: EventCategory.VENDOR,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId,
        clientId: order.clientId,
        vendorId: vendor.vendorId,
        vendorName: vendor.vendorName,
        staffRole: vendor.staffRole ?? 'appraiser_internal',
        assignedAt: new Date(),
        priority,
      },
    };

    await this.publisher.publish(staffAssignedEvent);

    this.logger.info('Internal staff assigned directly (bid loop bypassed)', {
      orderId: order.id,
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      staffRole: vendor.staffRole,
    });
  }

  /**
   * Bootstrap the review assignment flow for a newly SUBMITTED order.
   */
  private async initiateReviewAssignment(
    order: any,
    tenantId: string,
    priority: EventPriority,
  ): Promise<void> {
    // Guard: don't re-initiate if already in progress
    if ((order.autoReviewAssignment as AutoReviewAssignmentState | undefined)?.status === 'PENDING_ACCEPTANCE') {
      this.logger.info('Review assignment already in progress — skipping', { orderId: order.id });
      return;
    }

    // Phase 7: load joined OrderContext so propertyAddress resolves from
    // the parent ClientOrder when present (engagement-flow rows don't
    // carry it on the VendorOrder). Best-effort — falls back to legacy
    // reads on the bare order shape.
    let qcCtx: OrderContext | null = null;
    try {
      qcCtx = await this.contextLoader.loadByVendorOrder(order, { includeProperty: true });
    } catch (err) {
      this.logger.warn('Could not load OrderContext for QC queue entry; using bare order', {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const qcAddrString = this.resolveOrderAddressText(order, qcCtx);

    // Add to QC queue
    let qcReviewId: string;
    try {
      const queueItem = await this.qcQueueService.addToQueue({
        orderId: order.id,
        orderNumber: order.orderNumber,
        appraisalId: order.appraisalId ?? order.id,
        propertyAddress: qcAddrString,
        appraisedValue: order.appraisedValue ?? order.estimatedValue ?? 0,
        orderPriority: order.priority ?? 'STANDARD',
        clientId: order.clientId ?? '',
        clientName: order.clientName ?? '',
        vendorId: order.assignedVendorId ?? '',
        vendorName: order.assignedVendorName ?? '',
        submittedAt: new Date(),
      });
      qcReviewId = queueItem.id;
    } catch (err) {
      this.logger.error('Failed to add order to QC queue', { orderId: order.id, error: err });
      return;
    }

    // Publish review.assignment.requested
    const dueDate = new Date(Date.now() + REVIEW_EXPIRY_HOURS * 60 * 60 * 1000);
    await this.publisher.publish({
      id: uuidv4(),
      type: 'review.assignment.requested',
      timestamp: new Date(),
      source: 'auto-assignment-orchestrator',
      version: '1.0',
      category: EventCategory.ASSIGNMENT,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId,
        clientId: order.clientId,
        qcReviewId,
        priority,
        dueDate,
      },
    });

    // Rank reviewers by workload (lowest first)
    let rankedReviewers: RankedReviewerEntry[] = [];
    try {
      const workloads = await this.qcQueueService.getAllAnalystWorkloads();
      rankedReviewers = workloads
        .filter((a) => a.isAvailable && a.totalActiveReviews < a.maxConcurrentReviews)
        .sort((a, b) => a.capacityUtilization - b.capacityUtilization)
        .slice(0, MAX_REVIEWER_ATTEMPTS)
        .map((a) => ({
          reviewerId: a.analystId,
          reviewerName: a.analystName,
          workloadPct: Math.round(a.capacityUtilization),
        }));
    } catch (err) {
      this.logger.error('Failed to get analyst workloads', { orderId: order.id, error: err });
    }

    if (rankedReviewers.length === 0) {
      this.logger.warn('No available reviewers — escalating immediately', { orderId: order.id });
      await this.escalateReviewAssignment(order, tenantId, qcReviewId, []);
      return;
    }

    const state: AutoReviewAssignmentState = {
      qcReviewId,
      status: 'PENDING_ACCEPTANCE',
      rankedReviewers,
      currentAttempt: 0,
      currentAssignmentExpiresAt: null,
      initiatedAt: new Date().toISOString(),
    };

    await this.assignReviewer(order, state, tenantId, priority);
  }

  /**
   * Assign the reviewer at `state.currentAttempt`.
   */
  private async assignReviewer(
    order: any,
    state: AutoReviewAssignmentState,
    tenantId: string,
    priority: EventPriority,
  ): Promise<void> {
    const reviewer = state.rankedReviewers[state.currentAttempt];
    if (!reviewer) {
      this.logger.error('assignReviewer called beyond ranked list', {
        orderId: order.id,
        attempt: state.currentAttempt,
      });
      return;
    }

    const expiresAt = new Date(Date.now() + REVIEW_EXPIRY_HOURS * 60 * 60 * 1000);

    // Persist assignment via QC queue service
    try {
      await this.qcQueueService.assignReview(state.qcReviewId, reviewer.reviewerId);
    } catch (err) {
      this.logger.error('Failed to call qcQueueService.assignReview', {
        orderId: order.id,
        qcReviewId: state.qcReviewId,
        reviewerId: reviewer.reviewerId,
        error: err,
      });
      // Don't throw — still persist state and publish event for observability
    }

    // Persist state on order
    const updatedState: AutoReviewAssignmentState = {
      ...state,
      currentAssignmentExpiresAt: expiresAt.toISOString(),
    };

    await this.dbService.updateItem(
      'orders',
      order.id,
      { ...order, autoReviewAssignment: updatedState, updatedAt: new Date().toISOString() },
      tenantId,
    );

    await this.publisher.publish({
      id: uuidv4(),
      type: 'review.assigned',
      timestamp: new Date(),
      source: 'auto-assignment-orchestrator',
      version: '1.0',
      category: EventCategory.QC,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId,
        clientId: order.clientId,
        qcReviewId: state.qcReviewId,
        reviewerId: reviewer.reviewerId,
        reviewerName: reviewer.reviewerName,
        attemptNumber: state.currentAttempt + 1,
        assignedAt: new Date(),
        expiresAt,
        priority,
      },
    });

    this.logger.info('Review assigned to staff member', {
      orderId: order.id,
      qcReviewId: state.qcReviewId,
      reviewerId: reviewer.reviewerId,
      reviewerName: reviewer.reviewerName,
      attempt: state.currentAttempt + 1,
      expiresAt: expiresAt.toISOString(),
    });
  }

  /**
   * Move to the next reviewer in the ranked list.
   */
  private async advanceReviewAssignment(
    orderId: string,
    tenantId: string,
    qcReviewId: string,
    priority: EventPriority,
  ): Promise<void> {
    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.error('advanceReviewAssignment: order not found', { orderId });
      return;
    }

    const state = order.autoReviewAssignment as AutoReviewAssignmentState | undefined;
    if (!state) {
      this.logger.warn('advanceReviewAssignment: no autoReviewAssignment state on order', { orderId });
      return;
    }
    if (state.status !== 'PENDING_ACCEPTANCE') {
      this.logger.info('advanceReviewAssignment: state is not PENDING_ACCEPTANCE — ignoring', {
        orderId,
        status: state.status,
      });
      return;
    }

    const nextAttempt = state.currentAttempt + 1;
    const nextReviewer = state.rankedReviewers[nextAttempt];

    if (!nextReviewer) {
      const reviewersContacted = state.rankedReviewers
        .slice(0, nextAttempt)
        .map((r) => r.reviewerId);
      await this.escalateReviewAssignment(order, tenantId, qcReviewId, reviewersContacted);
      return;
    }

    const nextState: AutoReviewAssignmentState = {
      ...state,
      currentAttempt: nextAttempt,
      currentAssignmentExpiresAt: null,
    };

    await this.assignReviewer(order, nextState, tenantId, priority);
  }

  /**
   * All reviewers exhausted — mark order and publish escalation event.
   */
  private async escalateReviewAssignment(
    order: any,
    tenantId: string,
    qcReviewId: string,
    reviewersContacted: string[],
  ): Promise<void> {
    await this.dbService.updateItem(
      'orders',
      order.id,
      {
        ...order,
        autoReviewAssignment: {
          ...(order.autoReviewAssignment ?? {}),
          status: 'EXHAUSTED',
          currentAssignmentExpiresAt: null,
        },
        requiresHumanReviewAssignment: true,
        updatedAt: new Date().toISOString(),
      },
      tenantId,
    );

    await this.publisher.publish({
      id: uuidv4(),
      type: 'review.assignment.exhausted',
      timestamp: new Date(),
      source: 'auto-assignment-orchestrator',
      version: '1.0',
      category: EventCategory.ASSIGNMENT,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId,
        clientId: order.clientId,
        qcReviewId,
        attemptsCount: reviewersContacted.length,
        reviewersContacted,
        priority: EventPriority.HIGH,
        requiresHumanIntervention: true,
      },
    });

    this.logger.warn('Review assignment exhausted — human intervention required', {
      orderId: order.id,
      qcReviewId,
      attemptsCount: reviewersContacted.length,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Enrich a ranked vendor list with staffType / staffRole by doing parallel
   * reads of the vendor documents.  Any lookup failure gracefully falls back
   * to 'external' so the bid loop proceeds normally.
   */
  private async enrichWithStaffType(
    vendors: RankedVendorEntry[],
    tenantId: string,
  ): Promise<RankedVendorEntry[]> {
    const enriched = await Promise.all(
      vendors.map(async (v): Promise<RankedVendorEntry> => {
        try {
          const result = await this.dbService.getItem('vendors', v.vendorId, tenantId);
          const doc = (result as any)?.data ?? result;
          if (!doc) return v;
          return {
            ...v,
            staffType: doc.staffType ?? 'external',
            staffRole: doc.staffRole,
          };
        } catch {
          // Non-critical: if we can't fetch the vendor, treat as external.
          return v;
        }
      }),
    );
    return enriched;
  }

  private async maybeApplyAIVendorBidScoring(
    order: any,
    tenantId: string,
    rankedVendors: RankedVendorEntry[],
    matchResults: VendorMatchResult[],
  ): Promise<{ rankedVendors: RankedVendorEntry[]; vendorBidAnalysis?: VendorBidAnalysisSnapshot }> {
    if (!this.isAIVendorBidScoringEnabled()) {
      return { rankedVendors };
    }

    const generatedAt = new Date().toISOString();
    let threshold: number;

    try {
      threshold = this.getAIVendorBidConfidenceThreshold();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('AI vendor bid scoring configuration is invalid — falling back to rules-based rank', {
        orderId: order.id,
        tenantId,
        error: message,
      });
      return {
        rankedVendors,
        vendorBidAnalysis: {
          analysisType: 'appraisal_vendor_bid_analysis',
          appliedRecommendation: false,
          generatedAt,
          source: 'config-error',
          dispatchDecisionReason: `Rules-based ranking was retained because AI vendor-bid scoring is misconfigured: ${message}`,
          error: message,
        },
      };
    }

    try {
      // Phase 7: load joined OrderContext so the order details we POST to
      // Axiom carry the right propertyAddress / dueDate / orderType
      // (lender-side fields live on the parent ClientOrder post Phase 4).
      // Best-effort: if the load fails we still send the bare order shape.
      let ctx: OrderContext | undefined;
      try {
        ctx = await this.contextLoader.loadByVendorOrder(order, { includeProperty: true });
      } catch (loadErr) {
        this.logger.warn('Could not load OrderContext for AI vendor-bid scoring; falling back to bare order', {
          orderId: order.id,
          error: loadErr instanceof Error ? loadErr.message : String(loadErr),
        });
      }
      const analysis = await this.axiomService.analyzeVendorBid({
        entityId: order.id,
        entityType: 'order',
        subClientId: tenantId,
        sentinelApiBase: this.getVendorBidSentinelApiBase(),
        vendorCandidates: this.buildVendorBidCandidates(matchResults),
        orderDetails: this.buildVendorBidOrderDetails(order, ctx),
        timeoutMs: 25_000,
      });

      const appliedRecommendation =
        typeof analysis.confidence === 'number' && analysis.confidence >= threshold;
      const reorderedRankedVendors = appliedRecommendation
        ? this.reorderRankedVendorsByAnalysis(rankedVendors, analysis)
        : rankedVendors;
      const recommendedVendor = this.resolveRecommendedVendor(analysis, reorderedRankedVendors);
      const rulesBasedTopVendor = rankedVendors[0];
      const finalTopVendor = reorderedRankedVendors[0];
      const rankTrajectory = this.buildVendorBidRankTrajectory(rankedVendors, reorderedRankedVendors, analysis);

      return {
        rankedVendors: reorderedRankedVendors,
        vendorBidAnalysis: {
          analysisType: 'appraisal_vendor_bid_analysis',
          appliedRecommendation,
          appliedThreshold: threshold,
          generatedAt,
          ...(analysis.analysisId ? { analysisId: analysis.analysisId } : {}),
          ...(analysis.recommendation ? { recommendation: analysis.recommendation } : {}),
          ...(typeof analysis.confidence === 'number' ? { confidence: analysis.confidence } : {}),
          ...(analysis.rationale ? { rationale: analysis.rationale } : {}),
          ...(analysis.rankedCandidates ? { rankedCandidates: analysis.rankedCandidates } : {}),
          ...(rankTrajectory.length > 0
            ? { rankTrajectory }
            : {}),
          ...(analysis.overallRecommendation ? { overallRecommendation: analysis.overallRecommendation } : {}),
          ...(analysis.artifacts ? { artifacts: analysis.artifacts } : {}),
          ...(analysis.completedAt ? { completedAt: analysis.completedAt } : {}),
          ...(typeof analysis.iterations === 'number' ? { iterations: analysis.iterations } : {}),
          ...(analysis.source ? { source: analysis.source } : {}),
          ...(recommendedVendor?.vendorId ? { recommendedVendorId: recommendedVendor.vendorId } : {}),
          ...(recommendedVendor?.vendorName ? { recommendedVendorName: recommendedVendor.vendorName } : {}),
          ...(rulesBasedTopVendor?.vendorId ? { rulesBasedTopVendorId: rulesBasedTopVendor.vendorId } : {}),
          ...(rulesBasedTopVendor?.vendorName ? { rulesBasedTopVendorName: rulesBasedTopVendor.vendorName } : {}),
          ...(finalTopVendor?.vendorId ? { finalTopVendorId: finalTopVendor.vendorId } : {}),
          ...(finalTopVendor?.vendorName ? { finalTopVendorName: finalTopVendor.vendorName } : {}),
          dispatchDecisionReason: this.buildVendorBidDecisionReason({
            appliedRecommendation,
            threshold,
            analysis,
            rulesBasedTopVendor,
            finalTopVendor,
          }),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('AI vendor bid scoring failed — falling back to rules-based rank', {
        orderId: order.id,
        tenantId,
        error: message,
      });
      return {
        rankedVendors,
        vendorBidAnalysis: {
          analysisType: 'appraisal_vendor_bid_analysis',
          appliedRecommendation: false,
          appliedThreshold: threshold,
          generatedAt,
          source: 'error',
          dispatchDecisionReason: `Rules-based ranking was retained because AI vendor-bid scoring failed: ${message}`,
          error: message,
        },
      };
    }
  }

  private isAIVendorBidScoringEnabled(): boolean {
    return String(process.env['BULK_INGESTION_AI_BID_SCORING'] ?? '').toLowerCase() === 'true';
  }

  private getAIVendorBidConfidenceThreshold(): number {
    const raw = process.env['BULK_INGESTION_AI_BID_SCORING_CONFIDENCE_THRESHOLD'];
    if (!raw) {
      throw new Error(
        'BULK_INGESTION_AI_BID_SCORING_CONFIDENCE_THRESHOLD is required when BULK_INGESTION_AI_BID_SCORING=true.',
      );
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      throw new Error(
        `BULK_INGESTION_AI_BID_SCORING_CONFIDENCE_THRESHOLD must be a number between 0 and 1. Received '${raw}'.`,
      );
    }

    return parsed;
  }

  private getVendorBidSentinelApiBase(): string {
    const apiBase = process.env['API_BASE_URL'];
    if (!apiBase) {
      throw new Error(
        'API_BASE_URL is required when BULK_INGESTION_AI_BID_SCORING=true so the vendor-bid analysis request can include sentinelApiBase.',
      );
    }
    return apiBase;
  }

  private buildVendorBidCandidates(matchResults: VendorMatchResult[]): AxiomVendorBidCandidate[] {
    return matchResults.map((result) => ({
      id: result.vendorId,
      name: result.vendor.name,
      score: result.matchScore,
      recentOrders: result.recentOrders ?? 0,
      avgTurnaround: result.estimatedTurnaround ?? 0,
      avgFee: result.estimatedFee ?? 0,
    }));
  }

  private buildVendorBidOrderDetails(order: any, ctx?: OrderContext): AxiomVendorBidOrderDetails {
    // Phase 7: when an OrderContext is available, prefer accessors (which
    // pull from the parent ClientOrder when present and fall back to the
    // deprecated VendorOrder copy). When no context is provided, fall back
    // to the legacy any-typed reads.
    const propertyAddress = this.resolveOrderAddressText(order, ctx);

    const dueDateValue = ctx ? getDueDate(ctx) : order.dueDate;
    const orderTypeValue = ctx?.clientOrder?.orderType ?? order.orderType;

    return {
      productType: order.productType ?? orderTypeValue ?? 'UNKNOWN',
      propertyAddress,
      priority: order.priority ?? 'STANDARD',
      dueDate: dueDateValue ?? new Date().toISOString(),
    };
  }

  private resolveOrderAddressText(order: any, ctx?: OrderContext | null): string {
    const canonicalAddress = ctx ? this.formatAddressValue(getPropertyAddress(ctx)) : '';
    if (canonicalAddress) {
      return canonicalAddress;
    }

    const workflowAddress = this.formatAddressValue(order.propertyAddress);
    if (workflowAddress) {
      return workflowAddress;
    }

    return typeof order.propertyDetails?.fullAddress === 'string'
      ? order.propertyDetails.fullAddress
      : '';
  }

  private formatAddressValue(address: unknown): string {
    if (typeof address === 'string') {
      return address;
    }

    if (!address || typeof address !== 'object') {
      return '';
    }

    const candidate = address as Record<string, unknown>;
    const street = typeof candidate['streetAddress'] === 'string'
      ? candidate['streetAddress']
      : typeof candidate['street'] === 'string'
        ? candidate['street']
        : typeof candidate['fullAddress'] === 'string'
          ? candidate['fullAddress']
          : '';
    const city = typeof candidate['city'] === 'string' ? candidate['city'] : '';
    const state = typeof candidate['state'] === 'string' ? candidate['state'] : '';
    const zip = typeof candidate['zipCode'] === 'string'
      ? candidate['zipCode']
      : typeof candidate['zip'] === 'string'
        ? candidate['zip']
        : '';

    const locality = [city, state].filter(Boolean).join(', ');
    const trailing = [locality, zip].filter(Boolean).join(' ');
    return [street, trailing].filter(Boolean).join(', ');
  }

  private reorderRankedVendorsByAnalysis(
    rankedVendors: RankedVendorEntry[],
    analysis: AxiomVendorBidAnalysisResult,
  ): RankedVendorEntry[] {
    const preferredIds = this.extractPreferredVendorIds(analysis);
    if (preferredIds.length === 0) {
      return rankedVendors;
    }

    const byId = new Map(rankedVendors.map((vendor) => [vendor.vendorId, vendor]));
    const reordered: RankedVendorEntry[] = [];

    for (const vendorId of preferredIds) {
      const vendor = byId.get(vendorId);
      if (!vendor) {
        continue;
      }
      reordered.push(vendor);
      byId.delete(vendorId);
    }

    return reordered.concat([...byId.values()]);
  }

  private buildVendorBidRankTrajectory(
    rulesBasedRankedVendors: RankedVendorEntry[],
    finalRankedVendors: RankedVendorEntry[],
    analysis: AxiomVendorBidAnalysisResult,
  ): VendorBidRankTrajectoryEntry[] {
    const finalRankById = new Map(finalRankedVendors.map((vendor, index) => [vendor.vendorId, index + 1]));
    const aiRankById = new Map<string, number>();

    if (Array.isArray(analysis.rankedCandidates)) {
      analysis.rankedCandidates.forEach((candidate, index) => {
        if (!candidate || typeof candidate !== 'object') {
          return;
        }

        const candidateRecord = candidate as Record<string, unknown>;
        const vendorId =
          typeof candidateRecord['vendorId'] === 'string'
            ? candidateRecord['vendorId']
            : typeof candidateRecord['id'] === 'string'
            ? candidateRecord['id']
            : undefined;

        if (!vendorId) {
          return;
        }

        const aiRank = typeof candidateRecord['rank'] === 'number' ? candidateRecord['rank'] : index + 1;
        aiRankById.set(vendorId, aiRank);
      });
    }

    return rulesBasedRankedVendors.map((vendor, index) => ({
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      score: vendor.score,
      rulesBasedRank: index + 1,
      finalRank: finalRankById.get(vendor.vendorId) ?? index + 1,
      ...(aiRankById.has(vendor.vendorId) ? { aiRank: aiRankById.get(vendor.vendorId) as number } : {}),
    }));
  }

  private resolveRecommendedVendor(
    analysis: AxiomVendorBidAnalysisResult,
    rankedVendors: RankedVendorEntry[],
  ): RankedVendorEntry | undefined {
    const preferredIds = this.extractPreferredVendorIds(analysis);
    if (preferredIds.length > 0) {
      const preferredVendorId = preferredIds[0];
      return rankedVendors.find((vendor) => vendor.vendorId === preferredVendorId);
    }

    if (typeof analysis.recommendation === 'string') {
      return rankedVendors.find(
        (vendor) => vendor.vendorId === analysis.recommendation || vendor.vendorName === analysis.recommendation,
      );
    }

    return undefined;
  }

  private buildVendorBidDecisionReason(params: {
    appliedRecommendation: boolean;
    threshold: number;
    analysis: AxiomVendorBidAnalysisResult;
    rulesBasedTopVendor: RankedVendorEntry | undefined;
    finalTopVendor: RankedVendorEntry | undefined;
  }): string {
    const { appliedRecommendation, threshold, analysis, rulesBasedTopVendor, finalTopVendor } = params;
    const confidence = typeof analysis.confidence === 'number' ? Math.round(analysis.confidence * 100) : undefined;
    const thresholdPct = Math.round(threshold * 100);
    const preferredIds = this.extractPreferredVendorIds(analysis);

    if (appliedRecommendation) {
      if (
        rulesBasedTopVendor?.vendorId &&
        finalTopVendor?.vendorId &&
        rulesBasedTopVendor.vendorId !== finalTopVendor.vendorId
      ) {
        return `AI recommendation was applied because confidence ${confidence ?? 'N/A'}% met the ${thresholdPct}% threshold, changing dispatch from ${rulesBasedTopVendor.vendorName} to ${finalTopVendor.vendorName}.`;
      }

      return `AI recommendation was applied because confidence ${confidence ?? 'N/A'}% met the ${thresholdPct}% threshold and confirmed ${finalTopVendor?.vendorName ?? rulesBasedTopVendor?.vendorName ?? 'the current vendor'} as the top dispatch choice.`;
    }

    if (preferredIds.length === 0) {
      return 'Rules-based ranking was retained because the AI analysis did not return a preferred vendor order.';
    }

    if (typeof analysis.confidence !== 'number') {
      return 'Rules-based ranking was retained because the AI analysis did not return a confidence score.';
    }

    return `Rules-based ranking was retained because confidence ${confidence}% was below the ${thresholdPct}% threshold.`;
  }

  private extractPreferredVendorIds(analysis: AxiomVendorBidAnalysisResult): string[] {
    const rankedFromAnalysis = Array.isArray(analysis.rankedCandidates)
      ? analysis.rankedCandidates
          .map((candidate) => {
            const record = candidate as Record<string, unknown>;
            const vendorId = typeof record.vendorId === 'string'
              ? record.vendorId
              : typeof record.id === 'string'
              ? record.id
              : null;
            const rank = typeof record.rank === 'number' ? record.rank : Number.MAX_SAFE_INTEGER;
            return vendorId ? { vendorId, rank } : null;
          })
          .filter((candidate): candidate is { vendorId: string; rank: number } => candidate !== null)
          .sort((left, right) => left.rank - right.rank)
          .map((candidate) => candidate.vendorId)
      : [];

    if (rankedFromAnalysis.length > 0) {
      return rankedFromAnalysis;
    }

    return typeof analysis.recommendation === 'string' ? [analysis.recommendation] : [];
  }

  private async loadOrder(orderId: string, tenantId: string): Promise<any | null> {
    try {
      const result = await this.dbService.getItem('orders', orderId, tenantId);
      return (result as any)?.data ?? result ?? null;
    } catch (err) {
      this.logger.error('Failed to load order', { orderId, tenantId, error: err });
      return null;
    }
  }

  /** Load an order without knowing the tenantId (cross-partition query). */
  private async loadOrderById(orderId: string): Promise<any | null> {
    try {
      const result = await this.dbService.findOrderById(orderId);
      return (result as any)?.data ?? result ?? null;
    } catch (err) {
      this.logger.error('Failed to load order by id', { orderId, error: err });
      return null;
    }
  }

  /** Wrap an async handler. Errors propagate to the subscriber, which handles
   * retry/dead-letter semantics via Service Bus delivery count. */
  private makeHandler<T extends BaseEvent>(
    eventType: string,
    fn: (event: T) => Promise<void>,
  ): EventHandler<T> {
    return {
      handle: async (event: T) => {
        this.logger.debug(`Handling ${eventType}`, { eventId: event.id });
        await fn(event);
      },
    };
  }

  /** Map order priority string to EventPriority enum. */
  private mapPriority(priority: string): EventPriority {
    switch (priority?.toUpperCase()) {
      case 'EMERGENCY':
      case 'SUPER_RUSH':
        return EventPriority.CRITICAL;
      case 'RUSH':
        return EventPriority.HIGH;
      case 'STANDARD':
      default:
        return EventPriority.NORMAL;
    }
  }
}
