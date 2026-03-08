/**
 * Construction Finance Module — Budget Pure-Function Service
 *
 * All exports are pure functions: no I/O, no side effects.
 * Safe to unit-test in isolation and reuse anywhere in the service layer.
 *
 * Responsibilities:
 *   - Compute BudgetLineItem derived fields (revisedAmount, remainingBalance, percentDisbursed)
 *   - Aggregate budget-level totals across line items
 *   - Compute draw retainage withholding amounts
 *   - Apply approved change order deltas to a set of line items (returns a new array)
 *   - Compute contingency consumed across a budget
 *   - Validate retainage release eligibility against TenantConstructionConfig
 */

import type { BudgetLineItem } from '../types/construction-loan.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── computeLineItemDerived ────────────────────────────────────────────────────

/**
 * Computes the derived fields of a BudgetLineItem from its base values.
 * Returns a new object — does NOT mutate the input.
 *
 * Formula:
 *   revisedAmount   = originalAmount + changeOrderAmount
 *   remainingBalance = revisedAmount - drawnToDate
 *   percentDisbursed = drawnToDate / revisedAmount × 100  (0 when revisedAmount = 0)
 */
export function computeLineItemDerived(item: BudgetLineItem): BudgetLineItem {
  const revisedAmount = item.originalAmount + item.changeOrderAmount;
  const remainingBalance = revisedAmount - item.drawnToDate;
  const percentDisbursed = revisedAmount === 0
    ? 0
    : parseFloat(((item.drawnToDate / revisedAmount) * 100).toFixed(2));

  return {
    ...item,
    revisedAmount,
    remainingBalance,
    percentDisbursed,
  };
}

// ─── computeBudgetTotals ──────────────────────────────────────────────────────

export interface BudgetTotals {
  totalOriginalBudget: number;
  totalRevisedBudget: number;
  totalDrawnToDate: number;
}

/**
 * Aggregates line-item amounts into budget-level totals.
 * Input items should already have derived fields computed (call computeLineItemDerived first).
 */
export function computeBudgetTotals(items: BudgetLineItem[]): BudgetTotals {
  return items.reduce<BudgetTotals>(
    (acc, item) => ({
      totalOriginalBudget: acc.totalOriginalBudget + item.originalAmount,
      totalRevisedBudget:  acc.totalRevisedBudget  + item.revisedAmount,
      totalDrawnToDate:    acc.totalDrawnToDate    + item.drawnToDate,
    }),
    { totalOriginalBudget: 0, totalRevisedBudget: 0, totalDrawnToDate: 0 }
  );
}

// ─── computeDrawRetainage ─────────────────────────────────────────────────────

export interface DrawRetainageResult {
  approvedAmount: number;
  retainageWithheld: number;
  netDisbursed: number;
}

/**
 * Computes retainage withholding for a given approved gross draw amount.
 *
 * Formula:
 *   retainageWithheld = approvedAmount × (retainagePercent / 100)
 *   netDisbursed      = approvedAmount − retainageWithheld
 *
 * @throws if approvedAmount < 0 or retainagePercent is not in [0, 100]
 */
export function computeDrawRetainage(approvedAmount: number, retainagePercent: number): DrawRetainageResult {
  if (approvedAmount < 0) {
    throw new Error(
      `computeDrawRetainage: approvedAmount must be ≥ 0; received ${approvedAmount}`
    );
  }
  if (retainagePercent < 0 || retainagePercent > 100) {
    throw new Error(
      `computeDrawRetainage: retainagePercent must be between 0 and 100; received ${retainagePercent}`
    );
  }

  const retainageWithheld = parseFloat((approvedAmount * (retainagePercent / 100)).toFixed(2));
  const netDisbursed = parseFloat((approvedAmount - retainageWithheld).toFixed(2));

  return { approvedAmount, retainageWithheld, netDisbursed };
}

// ─── applyChangeOrderToLineItems ──────────────────────────────────────────────

/**
 * Applies approved change order deltas to a copy of the line items array.
 * Returns a new array — does NOT mutate the input.
 * Re-derives computed fields on each modified line item.
 *
 * @throws with the unknown budgetLineItemId if any change references a non-existent line item
 */
export function applyChangeOrderToLineItems(
  items: BudgetLineItem[],
  changes: { budgetLineItemId: string; delta: number }[]
): BudgetLineItem[] {
  // Validate all referenced IDs exist before applying any changes (fail-fast)
  for (const change of changes) {
    if (!items.find(i => i.id === change.budgetLineItemId)) {
      throw new Error(
        `applyChangeOrderToLineItems: budgetLineItemId "${change.budgetLineItemId}" not found in line items`
      );
    }
  }

  // Build delta map for O(n) application
  const deltaMap = new Map<string, number>();
  for (const change of changes) {
    deltaMap.set(change.budgetLineItemId, (deltaMap.get(change.budgetLineItemId) ?? 0) + change.delta);
  }

  return items.map(item => {
    const delta = deltaMap.get(item.id);
    if (delta === undefined) {
      return item; // Unchanged — return reference as-is (still immutable)
    }
    return computeLineItemDerived({
      ...item,
      changeOrderAmount: item.changeOrderAmount + delta,
    });
  });
}

// ─── computeContingencyUsed ───────────────────────────────────────────────────

/**
 * Returns the total drawnToDate across all CONTINGENCY category line items.
 * Used to track contingency burn rate vs. the CONTINGENCY_NEARLY_EXHAUSTED threshold.
 */
export function computeContingencyUsed(items: BudgetLineItem[]): number {
  return items
    .filter(i => i.category === 'CONTINGENCY')
    .reduce((sum, i) => sum + i.drawnToDate, 0);
}

// ─── validateRetainageReleaseEligibility ──────────────────────────────────────

export interface RetainageReleaseEligibilityResult {
  /** Whether the loan meets all configured criteria for a retainage release draw. */
  eligible: boolean;

  /**
   * Human-readable reason the loan is NOT eligible (undefined when eligible = true).
   * Always includes the actual percentComplete and the configured threshold.
   */
  reason?: string;

  /**
   * Always true — retainage release ALWAYS requires human approval by platform design.
   * This cannot be overridden by TenantConstructionConfig regardless of the config value.
   */
  requiresHumanApproval: true;
}

/**
 * Evaluates whether a loan is eligible for automated retainage release trigger.
 *
 * NOTE: This function returns requiresHumanApproval = true unconditionally.
 * The config field `retainageReleaseRequiresHumanApproval` is intentionally ignored —
 * automated disbursement of retainage without human approval is a prohibited pattern
 * on this platform regardless of tenant configuration.
 *
 * @param percentComplete — current inspector-certified overall % complete (0–100)
 * @param config — tenant construction configuration
 */
export function validateRetainageReleaseEligibility(
  percentComplete: number,
  config: TenantConstructionConfig
): RetainageReleaseEligibilityResult {
  if (percentComplete < config.retainageReleaseThreshold) {
    return {
      eligible: false,
      reason: `Project is ${percentComplete}% complete; retainage release requires ≥${config.retainageReleaseThreshold}% (configured threshold)`,
      requiresHumanApproval: true,
    };
  }

  return {
    eligible: true,
    requiresHumanApproval: true,
  };
}
