/**
 * Construction Finance Module — Draw Request Service
 *
 * Manages DrawRequest documents in the `draws` Cosmos container.
 * Partition key: /constructionLoanId
 *
 * Responsibilities:
 *   - Submitting new draw requests with TenantConstructionConfig gate checks
 *   - Listing and fetching draws for a loan
 *   - Advancing draw status through valid lifecycle transitions
 *   - Recording reviewer line-item approvals and computing disbursement totals
 *
 * The TenantConstructionConfig is passed explicitly into submitDraw — callers
 * are responsible for pre-fetching it (via ConstructionConfigService).
 * This keeps the service testable with a single CosmosDbService mock.
 *
 * This service does NOT create Cosmos infrastructure — all containers must be
 * provisioned via Bicep before this service runs.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { ConstructionLoan } from '../types/construction-loan.types.js';
import type {
  DrawRequest,
  DrawRequestStatus,
  DrawLineItemRequest,
  DrawLineItemResult,
} from '../types/draw-request.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER = 'draws';

/**
 * In-flight statuses — a draw in any of these states counts toward the
 * concurrent-draw limit enforced on submission.
 */
const IN_FLIGHT_STATUSES: DrawRequestStatus[] = [
  'SUBMITTED',
  'INSPECTION_ORDERED',
  'INSPECTION_COMPLETE',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'ON_HOLD',
];

// ─── Valid Status Transitions ─────────────────────────────────────────────────

/**
 * Allowed draw status transitions map.
 * Key: current status — Value: set of statuses that may follow.
 * Terminal states: DISBURSED, REJECTED.
 */
const VALID_DRAW_TRANSITIONS: Record<DrawRequestStatus, Set<DrawRequestStatus>> = {
  DRAFT:               new Set(['SUBMITTED']),
  SUBMITTED:           new Set(['INSPECTION_ORDERED', 'UNDER_REVIEW', 'ON_HOLD']),
  INSPECTION_ORDERED:  new Set(['INSPECTION_COMPLETE', 'ON_HOLD']),
  INSPECTION_COMPLETE: new Set(['UNDER_REVIEW', 'ON_HOLD']),
  UNDER_REVIEW:        new Set(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'ON_HOLD']),
  APPROVED:            new Set(['DISBURSED']),
  PARTIALLY_APPROVED:  new Set(['DISBURSED', 'REJECTED']),
  ON_HOLD:             new Set(['SUBMITTED', 'REJECTED']),
  DISBURSED:           new Set(), // terminal
  REJECTED:            new Set(), // terminal
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface SubmitDrawInput {
  constructionLoanId: string;
  budgetId: string;
  tenantId: string;
  requestedBy: string;
  lineItemRequests: DrawLineItemRequest[];
  notes?: string;
}

// ─── DrawRequestService ───────────────────────────────────────────────────────

export class DrawRequestService {
  private readonly logger = new Logger('DrawRequestService');

  constructor(private readonly cosmosService: CosmosDbService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private generateId(): string {
    return `draw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Returns all in-flight (non-terminal, non-draft) draws for the given loan.
   */
  private async getInFlightDraws(constructionLoanId: string, tenantId: string): Promise<DrawRequest[]> {
    const statusList = IN_FLIGHT_STATUSES.map((_, i) => `@s${i}`).join(', ');
    const query = `SELECT * FROM c WHERE c.constructionLoanId = @constructionLoanId AND c.tenantId = @tenantId AND c.status IN (${statusList})`;

    const parameters: { name: string; value: string }[] = [
      { name: '@constructionLoanId', value: constructionLoanId },
      { name: '@tenantId', value: tenantId },
      ...IN_FLIGHT_STATUSES.map((s, i) => ({ name: `@s${i}`, value: s })),
    ];

    return this.cosmosService.queryDocuments<DrawRequest>(CONTAINER, query, parameters);
  }

  // ── submitDraw ───────────────────────────────────────────────────────────────

  /**
   * Creates a new DrawRequest in SUBMITTED status.
   *
   * Enforces TenantConstructionConfig rules before persisting:
   *   1. lineItemRequests must not be empty
   *   2. Concurrent draw limit (when allowConcurrentDraws = false, zero in-flight draws allowed)
   *   3. Lien waiver requirement from the prior disbursed draw
   *
   * @param input   - The submission payload
   * @param config  - The tenant's TenantConstructionConfig (pre-fetched by caller)
   */
  async submitDraw(input: SubmitDrawInput, config: TenantConstructionConfig): Promise<DrawRequest> {
    const { constructionLoanId, tenantId } = input;

    // 1. Line items must exist
    if (!input.lineItemRequests || input.lineItemRequests.length === 0) {
      throw new Error('DrawRequestService.submitDraw: at least one line item is required');
    }

    // 2. Concurrent draw enforcement
    const inFlight = await this.getInFlightDraws(constructionLoanId, tenantId);

    if (!config.allowConcurrentDraws && inFlight.length > 0) {
      throw new Error(
        `DrawRequestService.submitDraw: concurrent draw not allowed for loan "${constructionLoanId}" ` +
        `— there is already a draw in progress (status: ${inFlight[0]!.status}). ` +
        `Enable allowConcurrentDraws in TenantConstructionConfig to permit overlapping draws.`
      );
    }

    if (config.allowConcurrentDraws && inFlight.length >= config.maxConcurrentDraws) {
      throw new Error(
        `DrawRequestService.submitDraw: concurrent draw limit of ${config.maxConcurrentDraws} reached ` +
        `for loan "${constructionLoanId}". Cannot submit another draw at this time.`
      );
    }

    // 3. Lien waiver check: does the most recent DISBURSED draw have a non-received lien waiver
    //    outside the grace period?
    await this.checkLienWaiverGate(constructionLoanId, tenantId, config.lienWaiverGracePeriodDays);

    const now = new Date().toISOString();
    const requestedAmount = input.lineItemRequests.reduce(
      (sum, li) => sum + li.requestedAmount,
      0
    );

    // Compute the draw number as (existing draws for loan count) + 1.
    // We use total draws, not just in-flight, to get a monotonic number.
    const allDraws = await this.listDrawsForLoan(constructionLoanId, tenantId);
    const drawNumber = allDraws.length + 1;

    // Inherit propertyId and engagementId from the parent ConstructionLoan (Phase R2).
    const parentLoan = await this.cosmosService.getDocument<ConstructionLoan>(
      'construction-loans',
      constructionLoanId,
      tenantId,
    );

    const draw: DrawRequest = {
      id: this.generateId(),
      drawNumber,
      constructionLoanId,
      budgetId: input.budgetId,
      tenantId,
      status: 'SUBMITTED',
      requestedBy: input.requestedBy,
      requestedAt: now,
      requestedAmount,
      lineItemRequests: input.lineItemRequests,
      lienWaiverStatus: 'PENDING',
      titleUpdateRequired: false,
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(parentLoan?.propertyId !== undefined && { propertyId: parentLoan.propertyId }),
      ...(parentLoan?.engagementId !== undefined && { engagementId: parentLoan.engagementId }),
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.cosmosService.createDocument<DrawRequest>(CONTAINER, draw);

    this.logger.info('DrawRequest submitted', {
      drawId: created.id,
      drawNumber: created.drawNumber,
      constructionLoanId,
      tenantId,
      requestedBy: input.requestedBy,
      requestedAmount,
    });

    return created;
  }

  /**
   * Checks whether the most recent disbursed draw's lien waiver blocks a new submission.
   * A lien waiver of PENDING or NOT_REQUIRED (the latter overrides the need) is checked:
   * - NOT_REQUIRED means the lender waived it — no block.
   * - PENDING within the grace period — no block.
   * - PENDING outside the grace period — block.
   */
  private async checkLienWaiverGate(
    constructionLoanId: string,
    tenantId: string,
    gracePeriodDays: number
  ): Promise<void> {
    const query =
      'SELECT TOP 1 * FROM c WHERE c.constructionLoanId = @constructionLoanId ' +
      'AND c.tenantId = @tenantId AND c.status = @status ORDER BY c.disbursedAt DESC';
    const parameters = [
      { name: '@constructionLoanId', value: constructionLoanId },
      { name: '@tenantId', value: tenantId },
      { name: '@status', value: 'DISBURSED' },
    ];

    const [prevDraw] = await this.cosmosService.queryDocuments<DrawRequest>(CONTAINER, query, parameters);

    if (!prevDraw) return; // no prior disbursed draw — no gate

    if (prevDraw.lienWaiverStatus === 'NOT_REQUIRED') return; // lender waived it
    if (prevDraw.lienWaiverStatus === 'RECEIVED' || prevDraw.lienWaiverStatus === 'VERIFIED') return;

    // lienWaiverStatus is PENDING — check grace period
    if (gracePeriodDays === 0) {
      throw new Error(
        `DrawRequestService.submitDraw: lien waiver from draw #${prevDraw.drawNumber} ` +
        `(id: ${prevDraw.id}) is still PENDING. The lien waiver must be received before a new draw ` +
        `can be submitted. (lienWaiverGracePeriodDays = 0 in TenantConstructionConfig)`
      );
    }

    const disbursedAt = prevDraw.disbursedAt;
    if (!disbursedAt) return; // defensive — no disbursedAt means can't compute grace period

    const daysSinceDisbursement =
      (Date.now() - new Date(disbursedAt).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDisbursement > gracePeriodDays) {
      throw new Error(
        `DrawRequestService.submitDraw: lien waiver from draw #${prevDraw.drawNumber} has been ` +
        `outstanding for ${Math.floor(daysSinceDisbursement)} days, which exceeds the grace period ` +
        `of ${gracePeriodDays} days. Resolve the lien waiver before submitting a new draw.`
      );
    }
  }

  // ── getDrawById ──────────────────────────────────────────────────────────────

  /**
   * Retrieves a draw request by ID.
   * The partition key for the draws container is /constructionLoanId.
   *
   * @throws if drawId or constructionLoanId is empty
   * @throws if the draw is not found
   */
  async getDrawById(drawId: string, constructionLoanId: string): Promise<DrawRequest> {
    if (!drawId) {
      throw new Error('DrawRequestService.getDrawById: drawId is required');
    }
    if (!constructionLoanId) {
      throw new Error('DrawRequestService.getDrawById: constructionLoanId is required');
    }

    const draw = await this.cosmosService.getDocument<DrawRequest>(CONTAINER, drawId, constructionLoanId);

    if (!draw) {
      throw new Error(
        `DrawRequestService.getDrawById: draw "${drawId}" not found for loan "${constructionLoanId}"`
      );
    }

    return draw;
  }

  // ── listDrawsForLoan ─────────────────────────────────────────────────────────

  /**
   * Returns all draws for a construction loan, ordered by drawNumber ascending.
   */
  async listDrawsForLoan(constructionLoanId: string, tenantId: string): Promise<DrawRequest[]> {
    const query =
      'SELECT * FROM c WHERE c.constructionLoanId = @constructionLoanId AND c.tenantId = @tenantId ' +
      'ORDER BY c.drawNumber ASC';
    const parameters = [
      { name: '@constructionLoanId', value: constructionLoanId },
      { name: '@tenantId', value: tenantId },
    ];

    return this.cosmosService.queryDocuments<DrawRequest>(CONTAINER, query, parameters);
  }

  // ── advanceDrawStatus ─────────────────────────────────────────────────────────

  /**
   * Advances a draw's status along a valid lifecycle transition.
   *
   * @throws if the transition from current → new status is not in VALID_DRAW_TRANSITIONS
   */
  async advanceDrawStatus(
    drawId: string,
    constructionLoanId: string,
    newStatus: DrawRequestStatus,
    updatedBy: string
  ): Promise<DrawRequest> {
    const draw = await this.getDrawById(drawId, constructionLoanId);
    const allowed = VALID_DRAW_TRANSITIONS[draw.status];

    if (!allowed.has(newStatus)) {
      throw new Error(
        `DrawRequestService.advanceDrawStatus: invalid transition "${draw.status}" → "${newStatus}" ` +
        `for draw "${drawId}". Allowed from ${draw.status}: [${[...allowed].join(', ') || 'none — terminal state'}]`
      );
    }

    const updated: DrawRequest = {
      ...draw,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    const result = await this.cosmosService.upsertDocument<DrawRequest>(CONTAINER, updated);

    this.logger.info('DrawRequest status advanced', {
      drawId,
      constructionLoanId,
      fromStatus: draw.status,
      toStatus: newStatus,
      updatedBy,
    });

    return result;
  }

  // ── approveDrawLineItems ──────────────────────────────────────────────────────

  /**
   * Records the reviewer's line-item decisions on a draw that is in UNDER_REVIEW status.
   *
   * Computes aggregate approval totals from the line-item results and sets the draw
   * status to APPROVED (all items approved/reduced) or PARTIALLY_APPROVED (any item DENIED).
   *
   * @throws if draw status is not UNDER_REVIEW
   */
  async approveDrawLineItems(
    drawId: string,
    constructionLoanId: string,
    lineItemResults: DrawLineItemResult[],
    reviewedBy: string
  ): Promise<DrawRequest> {
    const draw = await this.getDrawById(drawId, constructionLoanId);

    if (draw.status !== 'UNDER_REVIEW') {
      throw new Error(
        `DrawRequestService.approveDrawLineItems: draw "${drawId}" must be in UNDER_REVIEW status ` +
        `to record line-item approvals; current status: ${draw.status}`
      );
    }

    const approvedAmount = lineItemResults.reduce((sum, li) => sum + li.approvedAmount, 0);
    const retainageWithheld = lineItemResults.reduce((sum, li) => sum + li.retainageWithheld, 0);
    const netDisbursementAmount = lineItemResults.reduce((sum, li) => sum + li.netDisbursed, 0);

    const hasDenied = lineItemResults.some((li) => li.status === 'DENIED');
    const newStatus: DrawRequestStatus = hasDenied ? 'PARTIALLY_APPROVED' : 'APPROVED';

    const now = new Date().toISOString();
    const updated: DrawRequest = {
      ...draw,
      status: newStatus,
      lineItemResults,
      approvedAmount,
      retainageWithheld,
      netDisbursementAmount,
      reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    };

    const result = await this.cosmosService.upsertDocument<DrawRequest>(CONTAINER, updated);

    this.logger.info('DrawRequest line items approved', {
      drawId,
      constructionLoanId,
      status: newStatus,
      approvedAmount,
      netDisbursementAmount,
      reviewedBy,
    });

    return result;
  }
}
