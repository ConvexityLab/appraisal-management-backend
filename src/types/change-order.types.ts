/**
 * Construction Finance Module — Change Order Types
 *
 * Change orders record approved revisions to an existing construction budget.
 * Every approved change order:
 *   - increments ConstructionBudget.version
 *   - writes an immutable snapshot of the prior budget
 *   - updates affected BudgetLineItem.changeOrderAmount values
 *
 * Stored in the `construction-loans` Cosmos container (partition key: /tenantId)
 * alongside ConstructionBudget documents, keyed by type discriminator.
 */

// ─── Change Order Status ──────────────────────────────────────────────────────

/** Lifecycle states for a change order. */
export type ChangeOrderStatus =
  | 'DRAFT'        // Requester is composing the change order
  | 'SUBMITTED'    // Submitted to the lender for review
  | 'UNDER_REVIEW' // Reviewer is evaluating financial impact and justification
  | 'APPROVED'     // Approved; budget versioning and line-item updates will execute
  | 'REJECTED';    // Denied; existing budget is unchanged

// ─── Change Order ─────────────────────────────────────────────────────────────

/**
 * A formal request to revise the approved construction budget.
 * Any net increase to a budget line item requires a ChangeOrder.
 * Reductions via CO are also tracked here for full audit history.
 */
export interface ChangeOrder {
  id: string;
  constructionLoanId: string;

  /** ID of the ConstructionBudget version this change order targets. */
  budgetId: string;

  tenantId: string;

  /** Sequential change order number for this loan: CO-1, CO-2, etc. */
  changeOrderNumber: number;

  status: ChangeOrderStatus;

  // ── Submission ────────────────────────────────────────────────────────────
  /** User ID of the borrower, GC, or loan admin who submitted the CO. */
  requestedBy: string;
  requestedAt: string;

  /** Required explanation of why the budget is being revised. Must be substantive. */
  reason: string;

  // ── Line Item Changes ─────────────────────────────────────────────────────
  lineItemChanges: {
    /** Refers to an existing BudgetLineItem.id. */
    budgetLineItemId: string;

    /** Denormalised for display without budget re-fetch. */
    category: string;
    description: string;

    /** BudgetLineItem.revisedAmount before this change order. */
    originalAmount: number;

    /** Proposed new BudgetLineItem.revisedAmount if this CO is approved. */
    proposedAmount: number;

    /** proposedAmount − originalAmount (positive = cost increase, negative = reduction). */
    delta: number;

    /** Required per-line justification (e.g. "Material cost increase per attached supplier quote"). */
    justification: string;
  }[];

  // ── Financial Summary ─────────────────────────────────────────────────────
  /**
   * Net cost impact: sum of all lineItemChanges.delta values.
   * Positive = overall budget increase.  Negative = overall reduction.
   */
  totalDelta: number;

  /** ConstructionBudget.totalRevisedBudget + totalDelta — the budget if this CO is approved. */
  proposedTotalBudget: number;

  // ── Review & Approval ─────────────────────────────────────────────────────
  reviewedBy?: string;
  reviewedAt?: string;

  /** User ID of the individual who gave final CO approval. */
  approvedBy?: string;
  approvedAt?: string;

  /** Required when status is REJECTED. */
  rejectionReason?: string;

  createdAt: string;
  updatedAt: string;
}
