/**
 * TDD Tests — construction-budget.service.ts (pure functions)
 *
 * These tests define the required behaviour BEFORE the service is implemented.
 * The service must be a collection of pure, exported functions with no I/O,
 * following the arv-engine.service.ts pattern.
 *
 * Run: pnpm vitest run src/tests/construction-budget.service.test.ts
 */

import { describe, it, expect } from '@jest/globals';

import {
  computeLineItemDerived,
  computeBudgetTotals,
  computeDrawRetainage,
  applyChangeOrderToLineItems,
  computeContingencyUsed,
  validateRetainageReleaseEligibility,
} from '../services/construction-budget.service.js';

import type { BudgetLineItem } from '../types/construction-loan.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLineItem(overrides: Partial<BudgetLineItem> = {}): BudgetLineItem {
  return {
    id: 'li-001',
    category: 'FRAMING',
    description: 'Structural framing',
    originalAmount: 50_000,
    changeOrderAmount: 0,
    revisedAmount: 0,          // computed — intentionally wrong until computeLineItemDerived runs
    drawnToDate: 10_000,
    remainingBalance: 0,       // computed
    percentDisbursed: 0,       // computed
    percentCompleteInspected: 20,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<TenantConstructionConfig> = {}): TenantConstructionConfig {
  return {
    tenantId: 'tenant-1',
    allowConcurrentDraws: false,
    maxConcurrentDraws: 1,
    requireInspectionBeforeDraw: true,
    allowDesktopInspection: true,
    lienWaiverGracePeriodDays: 0,
    defaultRetainagePercent: 10,
    retainageReleaseAutoTrigger: true,
    retainageReleaseThreshold: 95,
    retainageReleaseRequiresHumanApproval: true,
    feasibilityEnabled: true,
    feasibilityBlocksApproval: false,
    feasibilityMinScore: 65,
    feasibilityCustomRules: [],
    stalledProjectDays: 60,
    overBudgetThresholdPct: 5,
    scheduleSlipDays: 30,
    lowArvCoverageThreshold: 0.9,
    contractorLicenseExpiryWarningDays: 30,
    aiMonitoringEnabled: true,
    aiDrawAnomalyDetection: true,
    aiCompletionForecastingEnabled: true,
    aiServicingEnabled: true,
    interestReserveWarningDays: 30,
    maturityWarningDays: 60,
    autoGenerateStatusReports: true,
    statusReportFrequencyDays: 30,
    updatedAt: '2026-03-01T00:00:00.000Z',
    updatedBy: 'system',
    ...overrides,
  };
}

// ─── computeLineItemDerived ────────────────────────────────────────────────────

describe('computeLineItemDerived()', () => {
  it('computes revisedAmount as originalAmount + changeOrderAmount', () => {
    const item = makeLineItem({ originalAmount: 50_000, changeOrderAmount: 5_000 });
    const result = computeLineItemDerived(item);
    expect(result.revisedAmount).toBe(55_000);
  });

  it('computes revisedAmount with negative changeOrderAmount (CO reduction)', () => {
    const item = makeLineItem({ originalAmount: 50_000, changeOrderAmount: -5_000 });
    const result = computeLineItemDerived(item);
    expect(result.revisedAmount).toBe(45_000);
  });

  it('computes remainingBalance as revisedAmount - drawnToDate', () => {
    const item = makeLineItem({ originalAmount: 50_000, changeOrderAmount: 0, drawnToDate: 20_000 });
    const result = computeLineItemDerived(item);
    expect(result.remainingBalance).toBe(30_000);
  });

  it('computes percentDisbursed as (drawnToDate / revisedAmount) * 100, rounded to 2 decimals', () => {
    const item = makeLineItem({ originalAmount: 50_000, changeOrderAmount: 0, drawnToDate: 15_000 });
    const result = computeLineItemDerived(item);
    expect(result.percentDisbursed).toBe(30);
  });

  it('returns percentDisbursed of 0 when revisedAmount is 0 (avoids division by zero)', () => {
    const item = makeLineItem({ originalAmount: 0, changeOrderAmount: 0, drawnToDate: 0 });
    const result = computeLineItemDerived(item);
    expect(result.percentDisbursed).toBe(0);
  });

  it('returns percentDisbursed of 100 when line is fully drawn', () => {
    const item = makeLineItem({ originalAmount: 10_000, changeOrderAmount: 0, drawnToDate: 10_000 });
    const result = computeLineItemDerived(item);
    expect(result.percentDisbursed).toBe(100);
  });

  it('does not mutate the input object', () => {
    const item = makeLineItem({ originalAmount: 50_000, changeOrderAmount: 1_000, drawnToDate: 10_000 });
    const beforeRevisedAmount = item.revisedAmount;
    computeLineItemDerived(item);
    expect(item.revisedAmount).toBe(beforeRevisedAmount); // input unchanged
  });
});

// ─── computeBudgetTotals ──────────────────────────────────────────────────────

describe('computeBudgetTotals()', () => {
  it('sums line item originalAmounts into totalOriginalBudget', () => {
    const items = [
      computeLineItemDerived(makeLineItem({ id: 'li-1', originalAmount: 20_000, changeOrderAmount: 0, drawnToDate: 0 })),
      computeLineItemDerived(makeLineItem({ id: 'li-2', originalAmount: 30_000, changeOrderAmount: 0, drawnToDate: 0 })),
    ];
    const totals = computeBudgetTotals(items);
    expect(totals.totalOriginalBudget).toBe(50_000);
  });

  it('sums revisedAmounts into totalRevisedBudget', () => {
    const items = [
      computeLineItemDerived(makeLineItem({ id: 'li-1', originalAmount: 20_000, changeOrderAmount: 5_000, drawnToDate: 0 })),
      computeLineItemDerived(makeLineItem({ id: 'li-2', originalAmount: 30_000, changeOrderAmount: -2_000, drawnToDate: 0 })),
    ];
    const totals = computeBudgetTotals(items);
    expect(totals.totalRevisedBudget).toBe(53_000);
  });

  it('sums drawnToDate into totalDrawnToDate', () => {
    const items = [
      computeLineItemDerived(makeLineItem({ id: 'li-1', originalAmount: 20_000, changeOrderAmount: 0, drawnToDate: 8_000 })),
      computeLineItemDerived(makeLineItem({ id: 'li-2', originalAmount: 30_000, changeOrderAmount: 0, drawnToDate: 12_000 })),
    ];
    const totals = computeBudgetTotals(items);
    expect(totals.totalDrawnToDate).toBe(20_000);
  });

  it('returns all zeros for empty line items array', () => {
    const totals = computeBudgetTotals([]);
    expect(totals.totalOriginalBudget).toBe(0);
    expect(totals.totalRevisedBudget).toBe(0);
    expect(totals.totalDrawnToDate).toBe(0);
  });
});

// ─── computeDrawRetainage ─────────────────────────────────────────────────────

describe('computeDrawRetainage()', () => {
  it('withholds the correct percentage of the approved amount', () => {
    const result = computeDrawRetainage(100_000, 10);
    expect(result.retainageWithheld).toBe(10_000);
    expect(result.netDisbursed).toBe(90_000);
  });

  it('computes net disbursement as approvedAmount - retainageWithheld', () => {
    const result = computeDrawRetainage(75_000, 5);
    expect(result.netDisbursed).toBe(71_250);    // 75000 - 3750
    expect(result.retainageWithheld).toBe(3_750);
  });

  it('returns approvedAmount as netDisbursed when retainagePercent is 0', () => {
    const result = computeDrawRetainage(50_000, 0);
    expect(result.retainageWithheld).toBe(0);
    expect(result.netDisbursed).toBe(50_000);
  });

  it('throws when retainagePercent is negative', () => {
    expect(() => computeDrawRetainage(50_000, -1)).toThrow();
  });

  it('throws when retainagePercent exceeds 100', () => {
    expect(() => computeDrawRetainage(50_000, 101)).toThrow();
  });

  it('throws when approvedAmount is negative', () => {
    expect(() => computeDrawRetainage(-1, 10)).toThrow();
  });
});

// ─── applyChangeOrderToLineItems ──────────────────────────────────────────────

describe('applyChangeOrderToLineItems()', () => {
  it('applies delta to the matching line item changeOrderAmount', () => {
    const items = [
      makeLineItem({ id: 'li-1', originalAmount: 30_000, changeOrderAmount: 0, drawnToDate: 0 }),
      makeLineItem({ id: 'li-2', originalAmount: 20_000, changeOrderAmount: 0, drawnToDate: 0 }),
    ];
    const changes = [{ budgetLineItemId: 'li-1', delta: 5_000 }];
    const updated = applyChangeOrderToLineItems(items, changes);

    const li1 = updated.find(i => i.id === 'li-1')!;
    expect(li1.changeOrderAmount).toBe(5_000);
    expect(li1.revisedAmount).toBe(35_000);  // derived must be recomputed
  });

  it('handles multiple simultaneous line item changes in one CO', () => {
    const items = [
      makeLineItem({ id: 'li-1', originalAmount: 30_000, changeOrderAmount: 0, drawnToDate: 0 }),
      makeLineItem({ id: 'li-2', originalAmount: 20_000, changeOrderAmount: 0, drawnToDate: 0 }),
    ];
    const changes = [
      { budgetLineItemId: 'li-1', delta: 5_000 },
      { budgetLineItemId: 'li-2', delta: -2_000 },
    ];
    const updated = applyChangeOrderToLineItems(items, changes);

    expect(updated.find(i => i.id === 'li-1')!.changeOrderAmount).toBe(5_000);
    expect(updated.find(i => i.id === 'li-2')!.changeOrderAmount).toBe(-2_000);
  });

  it('accumulates multiple approved COs on the same line item', () => {
    const items = [
      makeLineItem({ id: 'li-1', originalAmount: 30_000, changeOrderAmount: 2_000, drawnToDate: 0 }),
    ];
    const changes = [{ budgetLineItemId: 'li-1', delta: 3_000 }];
    const updated = applyChangeOrderToLineItems(items, changes);
    expect(updated.find(i => i.id === 'li-1')!.changeOrderAmount).toBe(5_000); // 2000 + 3000
  });

  it('throws when a change references a budgetLineItemId that does not exist', () => {
    const items = [makeLineItem({ id: 'li-1' })];
    const changes = [{ budgetLineItemId: 'li-NONEXISTENT', delta: 1_000 }];
    expect(() => applyChangeOrderToLineItems(items, changes)).toThrow(/li-NONEXISTENT/);
  });

  it('does not mutate the input line items array', () => {
    const items = [makeLineItem({ id: 'li-1', originalAmount: 30_000, changeOrderAmount: 0, drawnToDate: 0 })];
    const changes = [{ budgetLineItemId: 'li-1', delta: 5_000 }];
    applyChangeOrderToLineItems(items, changes);
    expect(items[0]!.changeOrderAmount).toBe(0); // original unchanged
  });
});

// ─── computeContingencyUsed ───────────────────────────────────────────────────

describe('computeContingencyUsed()', () => {
  it('returns sum of drawnToDate for all CONTINGENCY category line items', () => {
    const items: BudgetLineItem[] = [
      computeLineItemDerived(makeLineItem({ id: 'c1', category: 'CONTINGENCY', originalAmount: 20_000, changeOrderAmount: 0, drawnToDate: 5_000 })),
      computeLineItemDerived(makeLineItem({ id: 'c2', category: 'CONTINGENCY', originalAmount: 10_000, changeOrderAmount: 0, drawnToDate: 2_000 })),
      computeLineItemDerived(makeLineItem({ id: 'f1', category: 'FRAMING', originalAmount: 50_000, changeOrderAmount: 0, drawnToDate: 25_000 })),
    ];
    expect(computeContingencyUsed(items)).toBe(7_000); // only CONTINGENCY lines
  });

  it('returns 0 when no CONTINGENCY line items exist', () => {
    const items: BudgetLineItem[] = [
      computeLineItemDerived(makeLineItem({ category: 'FRAMING', originalAmount: 50_000, changeOrderAmount: 0, drawnToDate: 10_000 })),
    ];
    expect(computeContingencyUsed(items)).toBe(0);
  });
});

// ─── validateRetainageReleaseEligibility ──────────────────────────────────────

describe('validateRetainageReleaseEligibility()', () => {
  it('returns eligible when percentComplete meets the configured threshold', () => {
    const config = makeConfig({ retainageReleaseThreshold: 95 });
    const result = validateRetainageReleaseEligibility(95, config);
    expect(result.eligible).toBe(true);
  });

  it('returns eligible when percentComplete exceeds the threshold', () => {
    const config = makeConfig({ retainageReleaseThreshold: 95 });
    const result = validateRetainageReleaseEligibility(100, config);
    expect(result.eligible).toBe(true);
  });

  it('returns not eligible when percentComplete is below the threshold', () => {
    const config = makeConfig({ retainageReleaseThreshold: 95 });
    const result = validateRetainageReleaseEligibility(94.9, config);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/95/); // message references the threshold
  });

  it('always indicates human approval is required regardless of config value', () => {
    // retainageReleaseRequiresHumanApproval is always true at service level by design.
    const config = makeConfig({ retainageReleaseRequiresHumanApproval: false });
    const result = validateRetainageReleaseEligibility(96, config);
    expect(result.requiresHumanApproval).toBe(true);
  });
});
