/**
 * Construction Finance Module — Change Order Service
 *
 * Manages ChangeOrder documents and the associated budget versioning in the
 * `construction-loans` Cosmos container (partition key: /tenantId).
 *
 * Responsibilities:
 *   - Change order CRUD + state machine (DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED)
 *   - On approval: applies deltas to budget line items and creates a new immutable budget version
 *     using the pure helper `applyChangeOrderToLineItems` from construction-budget.service.ts
 *
 * The budget versioning contract:
 *   - Budget doc IDs follow the pattern `budget-{loanId}-v{version}` for deterministic access.
 *   - Each approved CO increments the version counter and writes a new budget snapshot.
 *   - Prior budget versions are NEVER mutated — they remain as immutable history.
 *
 * This service does NOT create Cosmos infrastructure — all containers must be
 * provisioned via Bicep before this service runs.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import {
  applyChangeOrderToLineItems,
  computeBudgetTotals,
  computeLineItemDerived,
} from './construction-budget.service.js';
import type { ChangeOrder, ChangeOrderStatus } from '../types/change-order.types.js';
import type { ConstructionBudget, ConstructionLoan } from '../types/construction-loan.types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER = 'construction-loans';

// ─── Valid Status Transitions ─────────────────────────────────────────────────

const VALID_CO_TRANSITIONS: Record<ChangeOrderStatus, Set<ChangeOrderStatus>> = {
  DRAFT:       new Set(['SUBMITTED']),
  SUBMITTED:   new Set(['UNDER_REVIEW', 'REJECTED']),
  UNDER_REVIEW: new Set(['APPROVED', 'REJECTED']),
  APPROVED:    new Set(),  // terminal
  REJECTED:    new Set(),  // terminal
};

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface ChangeOrderImpact {
  changeOrderId: string;
  constructionLoanId: string;
  /** Net dollar change this CO would apply to the budget (positive = increase, negative = reduction). */
  totalDelta: number;
  /** Current totalRevisedBudget before this CO is applied. */
  currentBudgetTotal: number;
  /** Projected totalRevisedBudget if this CO were approved. */
  newBudgetTotal: number;
  /** (newBudgetTotal - currentBudgetTotal) / currentBudgetTotal × 100, rounded to 2 dp. */
  budgetChangePercent: number;
  /**
   * ARV coverage metrics — only present when the loan has an arvEstimate.
   * These use the loan amount (not budget) against ARV, which is the standard LTV metric.
   */
  arvCoverageImpact?: {
    arvEstimate: number;
    loanAmount: number;
    /** loanAmount / arvEstimate — does not change on a CO (CO affects budget, not loan amount). */
    currentLoanToArv: number;
    /**
     * Approximate future loan-to-ARV if the CO were funded entirely from a loan increase.
     * (loanAmount + totalDelta) / arvEstimate — informational only.
     */
    projectedLoanToArv: number;
  };
}

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface SubmitChangeOrderInput {
  constructionLoanId: string;
  tenantId: string;
  /** ID of the ConstructionBudget version this CO targets — format: `budget-{loanId}-v{n}`. */
  budgetId: string;
  reason: string;
  requestedBy: string;
  lineItemChanges: ChangeOrder['lineItemChanges'];
}

export interface ChangeOrderListFilter {
  constructionLoanId?: string;
}

// ─── ChangeOrderService ───────────────────────────────────────────────────────

export class ChangeOrderService {
  private readonly logger = new Logger('ChangeOrderService');

  constructor(private readonly cosmosService: CosmosDbService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private generateId(): string {
    return `co-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // ── getChangeOrderById ────────────────────────────────────────────────────────

  /**
   * Retrieves a single ChangeOrder by its ID.
   *
   * @throws if coId or tenantId is empty
   * @throws if the document is not found
   */
  async getChangeOrderById(coId: string, tenantId: string): Promise<ChangeOrder> {
    if (!coId) {
      throw new Error('ChangeOrderService.getChangeOrderById: coId is required');
    }
    if (!tenantId) {
      throw new Error('ChangeOrderService.getChangeOrderById: tenantId is required');
    }

    const co = await this.cosmosService.getDocument<ChangeOrder>(CONTAINER, coId, tenantId);

    if (!co) {
      throw new Error(
        `ChangeOrderService.getChangeOrderById: change order "${coId}" not found ` +
        `for tenant "${tenantId}"`
      );
    }

    return co;
  }

  // ── listChangeOrders ──────────────────────────────────────────────────────────

  /**
   * Returns all change orders for a tenant, optionally filtered to a specific loan.
   * Ordered by changeOrderNumber ascending.
   */
  async listChangeOrders(
    tenantId: string,
    filter: ChangeOrderListFilter = {}
  ): Promise<ChangeOrder[]> {
    if (!tenantId) {
      throw new Error('ChangeOrderService.listChangeOrders: tenantId is required');
    }

    let query = 'SELECT * FROM c WHERE c.tenantId = @tenantId AND IS_DEFINED(c.changeOrderNumber)';
    const parameters: { name: string; value: string }[] = [
      { name: '@tenantId', value: tenantId },
    ];

    if (filter.constructionLoanId) {
      query += ' AND c.constructionLoanId = @loanId';
      parameters.push({ name: '@loanId', value: filter.constructionLoanId });
    }

    query += ' ORDER BY c.changeOrderNumber ASC';

    return this.cosmosService.queryDocuments<ChangeOrder>(CONTAINER, query, parameters);
  }

  // ── submitChangeOrder ─────────────────────────────────────────────────────────

  /**
   * Creates a new ChangeOrder in SUBMITTED status.
   * Computes totalDelta and proposedTotalBudget from the provided lineItemChanges
   * and the current budget's totalRevisedBudget.
   *
   * @throws if reason is empty or lineItemChanges is empty
   * @throws if the referenced budgetId is not found
   */
  async submitChangeOrder(input: SubmitChangeOrderInput): Promise<ChangeOrder> {
    const { constructionLoanId, tenantId, budgetId } = input;

    if (!constructionLoanId) {
      throw new Error('ChangeOrderService.submitChangeOrder: constructionLoanId is required');
    }
    if (!tenantId) {
      throw new Error('ChangeOrderService.submitChangeOrder: tenantId is required');
    }
    if (!input.reason || input.reason.trim() === '') {
      throw new Error('ChangeOrderService.submitChangeOrder: reason is required');
    }
    if (!input.lineItemChanges || input.lineItemChanges.length === 0) {
      throw new Error(
        'ChangeOrderService.submitChangeOrder: lineItemChanges must not be empty'
      );
    }

    // Verify the referenced budget exists
    const budget = await this.cosmosService.getDocument<ConstructionBudget>(
      CONTAINER,
      budgetId,
      tenantId
    );
    if (!budget) {
      throw new Error(
        `ChangeOrderService.submitChangeOrder: budget "${budgetId}" not found for tenant "${tenantId}"`
      );
    }

    // Compute sequential CO number for this loan
    const existing = await this.listChangeOrders(tenantId, { constructionLoanId });
    const changeOrderNumber = existing.length + 1;

    const totalDelta = input.lineItemChanges.reduce((sum, c) => sum + c.delta, 0);
    const proposedTotalBudget = budget.totalRevisedBudget + totalDelta;

    const now = new Date().toISOString();
    const co: ChangeOrder = {
      id: this.generateId(),
      constructionLoanId,
      budgetId,
      tenantId,
      changeOrderNumber,
      status: 'SUBMITTED',
      requestedBy: input.requestedBy,
      requestedAt: now,
      reason: input.reason.trim(),
      lineItemChanges: input.lineItemChanges,
      totalDelta,
      proposedTotalBudget,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.cosmosService.createDocument<ChangeOrder>(CONTAINER, co);

    this.logger.info('ChangeOrder submitted', {
      coId: created.id,
      changeOrderNumber,
      constructionLoanId,
      tenantId,
      totalDelta,
    });

    return created;
  }

  // ── reviewChangeOrder ─────────────────────────────────────────────────────────

  /**
   * Advances a change order from SUBMITTED → UNDER_REVIEW.
   *
   * @throws if CO is not in SUBMITTED status
   */
  async reviewChangeOrder(
    coId: string,
    tenantId: string,
    reviewedBy: string
  ): Promise<ChangeOrder> {
    if (!reviewedBy) {
      throw new Error('ChangeOrderService.reviewChangeOrder: reviewedBy is required');
    }

    const co = await this.getChangeOrderById(coId, tenantId);
    this.assertTransition(co, 'UNDER_REVIEW');

    const now = new Date().toISOString();
    const updated: ChangeOrder = {
      ...co,
      status: 'UNDER_REVIEW',
      reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    };

    const saved = await this.cosmosService.upsertDocument<ChangeOrder>(CONTAINER, updated);

    this.logger.info('ChangeOrder under review', { coId, tenantId, reviewedBy });

    return saved;
  }

  // ── approveChangeOrder ────────────────────────────────────────────────────────

  /**
   * Approves a change order.
   *
   * On approval:
   *   1. Validates all referenced budget line item IDs exist in the current budget.
   *   2. Applies deltas to budget line items using the pure `applyChangeOrderToLineItems` helper.
   *   3. Recomputes budget totals.
   *   4. Writes a NEW immutable budget version document (version N+1).
   *      The prior budget version is NOT modified.
   *   5. Sets the CO status to APPROVED.
   *
   * Returns the approved ChangeOrder.
   *
   * @throws if CO is not in SUBMITTED or UNDER_REVIEW status
   * @throws if the referenced budget or line items are not found
   */
  async approveChangeOrder(
    coId: string,
    tenantId: string,
    approverId: string
  ): Promise<ChangeOrder> {
    if (!approverId) {
      throw new Error('ChangeOrderService.approveChangeOrder: approverId is required');
    }

    const co = await this.getChangeOrderById(coId, tenantId);
    this.assertTransition(co, 'APPROVED');

    // Fetch the budget this CO targets
    const budget = await this.cosmosService.getDocument<ConstructionBudget>(
      CONTAINER,
      co.budgetId,
      tenantId
    );
    if (!budget) {
      throw new Error(
        `ChangeOrderService.approveChangeOrder: budget "${co.budgetId}" not found ` +
        `for tenant "${tenantId}" — cannot apply change order without a valid budget`
      );
    }

    // Apply deltas using the pure function (throws if any budgetLineItemId is missing)
    const updatedLineItems = applyChangeOrderToLineItems(
      budget.lineItems.map(computeLineItemDerived),
      co.lineItemChanges.map(c => ({
        budgetLineItemId: c.budgetLineItemId,
        delta: c.delta,
      }))
    );

    const totals = computeBudgetTotals(updatedLineItems);

    // Derive the new budget ID from the version pattern
    const newVersion = budget.version + 1;
    const newBudgetId = `budget-${co.constructionLoanId}-v${newVersion}`;

    const now = new Date().toISOString();
    const newBudget: ConstructionBudget = {
      ...budget,
      id: newBudgetId,
      version: newVersion,
      status: 'REVISED',
      lineItems: updatedLineItems,
      totalOriginalBudget: totals.totalOriginalBudget,
      totalRevisedBudget: totals.totalRevisedBudget,
      totalDrawnToDate: totals.totalDrawnToDate,
      createdAt: now,
      updatedAt: now,
    };

    await this.cosmosService.createDocument<ConstructionBudget>(CONTAINER, newBudget);

    // Approve the CO
    const approvedCo: ChangeOrder = {
      ...co,
      status: 'APPROVED',
      approvedBy: approverId,
      approvedAt: now,
      updatedAt: now,
    };

    const saved = await this.cosmosService.upsertDocument<ChangeOrder>(CONTAINER, approvedCo);

    this.logger.info('ChangeOrder approved — new budget version created', {
      coId,
      tenantId,
      approverId,
      newBudgetId,
      newVersion,
      totalDelta: co.totalDelta,
    });

    return saved;
  }

  // ── rejectChangeOrder ─────────────────────────────────────────────────────────

  /**
   * Rejects a change order.  Existing budget is unchanged.
   *
   * @throws if CO is not in SUBMITTED or UNDER_REVIEW status
   * @throws if reason is empty
   */
  async rejectChangeOrder(
    coId: string,
    tenantId: string,
    reason: string,
    rejectedBy: string
  ): Promise<ChangeOrder> {
    if (!reason || reason.trim() === '') {
      throw new Error('ChangeOrderService.rejectChangeOrder: reason is required');
    }
    if (!rejectedBy) {
      throw new Error('ChangeOrderService.rejectChangeOrder: rejectedBy is required');
    }

    const co = await this.getChangeOrderById(coId, tenantId);
    this.assertTransition(co, 'REJECTED');

    const now = new Date().toISOString();
    const updated: ChangeOrder = {
      ...co,
      status: 'REJECTED',
      rejectionReason: reason.trim(),
      reviewedBy: rejectedBy,
      reviewedAt: now,
      updatedAt: now,
    };

    const saved = await this.cosmosService.upsertDocument<ChangeOrder>(CONTAINER, updated);

    this.logger.info('ChangeOrder rejected', { coId, tenantId, rejectedBy, reason });

    return saved;
  }

  // ── getChangeOrderImpact ──────────────────────────────────────────────────────

  /**
   * Computes the projected financial impact of a change order without approving it.
   * Queries the referenced budget and loan for current values.
   *
   * @throws if the CO or its referenced budget is not found
   */
  async getChangeOrderImpact(
    coId: string,
    tenantId: string
  ): Promise<ChangeOrderImpact> {
    const co = await this.getChangeOrderById(coId, tenantId);

    const budget = await this.cosmosService.getDocument<ConstructionBudget>(
      CONTAINER,
      co.budgetId,
      tenantId
    );
    if (!budget) {
      throw new Error(
        `ChangeOrderService.getChangeOrderImpact: budget "${co.budgetId}" not found for tenant "${tenantId}"`
      );
    }

    const newBudgetTotal = budget.totalRevisedBudget + co.totalDelta;
    const budgetChangePercent =
      budget.totalRevisedBudget > 0
        ? Math.round(((co.totalDelta / budget.totalRevisedBudget) * 100) * 100) / 100
        : 0;

    const loan = await this.cosmosService.getDocument<ConstructionLoan>(
      CONTAINER,
      co.constructionLoanId,
      tenantId
    );

    const impact: ChangeOrderImpact = {
      changeOrderId: co.id,
      constructionLoanId: co.constructionLoanId,
      totalDelta: co.totalDelta,
      currentBudgetTotal: budget.totalRevisedBudget,
      newBudgetTotal,
      budgetChangePercent,
    };

    if (loan?.arvEstimate && loan.arvEstimate > 0) {
      impact.arvCoverageImpact = {
        arvEstimate: loan.arvEstimate,
        loanAmount: loan.loanAmount,
        currentLoanToArv: Math.round((loan.loanAmount / loan.arvEstimate) * 10000) / 10000,
        projectedLoanToArv:
          Math.round(((loan.loanAmount + co.totalDelta) / loan.arvEstimate) * 10000) / 10000,
      };
    }

    return impact;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private assertTransition(co: ChangeOrder, targetStatus: ChangeOrderStatus): void {
    const allowed = VALID_CO_TRANSITIONS[co.status];
    if (!allowed.has(targetStatus)) {
      throw new Error(
        `ChangeOrderService: invalid transition "${co.status}" → "${targetStatus}" ` +
        `for change order "${co.id}". Allowed from ${co.status}: ` +
        `[${[...allowed].join(', ') || 'none — terminal state'}]`
      );
    }
  }
}
