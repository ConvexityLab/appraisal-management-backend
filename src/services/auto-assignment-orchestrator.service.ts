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
import { QCReviewQueueService } from './qc-review-queue.service.js';
import type {
  AppEvent,
  BaseEvent,
  EventHandler,
  EngagementOrderCreatedEvent,
  VendorBidTimedOutEvent,
  VendorBidDeclinedEvent,
  OrderStatusChangedEvent,
  ReviewAssignmentTimedOutEvent,
} from '../types/events.js';
import { EventCategory, EventPriority } from '../types/events.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum vendors to contact before escalating to a human. */
const MAX_VENDOR_ATTEMPTS = 5;

/** Maximum reviewers to contact before escalating to a human. */
const MAX_REVIEWER_ATTEMPTS = 5;

/** Hours before a vendor bid expires and the timeout checker fires. */
const BID_EXPIRY_HOURS = 4;

/** Hours before a reviewer assignment expires and the timeout job fires. */
const REVIEW_EXPIRY_HOURS = 8;

// ── Embedded state shapes (written into the order document) ──────────────────

export interface RankedVendorEntry {
  vendorId: string;
  vendorName: string;
  score: number;
}

export interface AutoVendorAssignmentState {
  status: 'PENDING_BID' | 'ACCEPTED' | 'EXHAUSTED';
  rankedVendors: RankedVendorEntry[];
  currentAttempt: number; // 0-indexed; vendor in use is rankedVendors[currentAttempt]
  currentBidId: string | null;
  currentBidExpiresAt: string | null; // ISO date
  initiatedAt: string; // ISO date
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

// ── Orchestrator ──────────────────────────────────────────────────────────────

export class AutoAssignmentOrchestratorService {
  private readonly logger = new Logger('AutoAssignmentOrchestrator');
  private readonly publisher: ServiceBusEventPublisher;
  private readonly subscriber: ServiceBusEventSubscriber;
  private readonly dbService: CosmosDbService;
  private readonly matchingEngine: VendorMatchingEngine;
  private readonly qcQueueService: QCReviewQueueService;
  private isStarted = false;

  constructor(dbService?: CosmosDbService) {
    this.dbService = dbService ?? new CosmosDbService();
    this.publisher = new ServiceBusEventPublisher();
    // Use a dedicated subscription so we don't compete with the notification service
    this.subscriber = new ServiceBusEventSubscriber(
      undefined,
      'appraisal-events',
      'auto-assignment-service',
    );
    this.matchingEngine = new VendorMatchingEngine();
    this.qcQueueService = new QCReviewQueueService();
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
    const { orderId, orderNumber, tenantId, propertyAddress, productType, dueDate, priority, clientId } =
      event.data;

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

    // --- Rank vendors ---
    let rankedVendors: RankedVendorEntry[] = [];
    try {
      const results = await this.matchingEngine.findMatchingVendors(
        {
          orderId,
          tenantId,
          propertyAddress,
          propertyType: productType,
          dueDate: new Date(dueDate),
          urgency: priority === EventPriority.CRITICAL ? 'SUPER_RUSH'
            : priority === EventPriority.HIGH ? 'RUSH'
            : 'STANDARD',
          clientPreferences: { excludedVendors: [] },
        },
        MAX_VENDOR_ATTEMPTS,
      );

      rankedVendors = results.map((r) => ({
        vendorId: r.vendorId,
        vendorName: r.vendor.name,
        score: r.matchScore,
      }));
    } catch (err) {
      this.logger.error('Vendor matching failed for order', { orderId, error: err });
    }

    if (rankedVendors.length === 0) {
      // No vendors at all — immediately escalate to human
      this.logger.warn('No matching vendors found — escalating immediately', { orderId });
      await this.escalateVendorAssignment(order, tenantId, []);
      return;
    }

    // --- Initialise state and send first bid ---
    const state: AutoVendorAssignmentState = {
      status: 'PENDING_BID',
      rankedVendors,
      currentAttempt: 0,
      currentBidId: null,
      currentBidExpiresAt: null,
      initiatedAt: new Date().toISOString(),
    };

    await this.sendBidToVendor(order, state, tenantId, priority);
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
   * Triggered when an order status changes.
   * React to SUBMITTED (vendor delivered) → kick off review assignment.
   */
  private async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.data.newStatus !== 'SUBMITTED') return;

    const { orderId, tenantId, priority } = event.data;
    const order = await this.loadOrder(orderId, tenantId);
    if (!order) {
      this.logger.warn('order.status.changed(SUBMITTED): order not found', { orderId });
      return;
    }

    this.logger.info('Order SUBMITTED — initiating review assignment', { orderId, tenantId });
    await this.initiateReviewAssignment(order, tenantId, event.data.priority);
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

    const expiresAt = new Date(Date.now() + BID_EXPIRY_HOURS * 60 * 60 * 1000);
    const bidId = `bid-${order.id}-${vendor.vendorId}-${Date.now()}`;

    // Create the bid invitation document
    const bidInvitation = {
      id: bidId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      tenantId,
      propertyAddress: order.propertyAddress ?? order.propertyDetails?.fullAddress,
      propertyType: order.productType ?? order.orderType,
      dueDate: order.dueDate,
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

    // Add to QC queue
    let qcReviewId: string;
    try {
      const queueItem = await this.qcQueueService.addToQueue({
        orderId: order.id,
        orderNumber: order.orderNumber,
        appraisalId: order.appraisalId ?? order.id,
        propertyAddress:
          order.propertyAddress?.fullAddress ??
          order.propertyAddress?.streetAddress ??
          order.propertyAddress ??
          '',
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
