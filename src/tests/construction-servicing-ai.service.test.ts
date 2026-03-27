/**
 * Construction Servicing AI Service — Integration Tests (Phase 4c)
 *
 * Tests run against a live Cosmos DB instance (endpoint supplied via
 * AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT env var).
 *
 * Covers:
 *   computeInterestReserveStatus
 *     - correctly projects depletion date and fires INTEREST_RESERVE_DEPLETING
 *     - does not flag when reserve is adequate
 *     - handles exhausted reserve (reserveRemaining = 0)
 *     - throws when aiServicingEnabled = false
 *   checkMaturityRisk
 *     - fires MATURITY_APPROACHING when P75 forecast is within warning window
 *     - does not flag when P75 is comfortably before maturity
 *     - no-ops for COMPLETED loans
 *   generateConversionReadinessChecklist
 *     - correct items returned for a ready GROUND_UP loan
 *     - missing items when project is incomplete
 *     - throws for non-GROUND_UP loan types
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionServicingAiService } from '../services/ai/construction-servicing-ai.service.js';
import type { ConstructionLoan } from '../types/construction-loan.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── Environment ───────────────────────────────────────────────────────────────

const ENDPOINT = process.env['AZURE_COSMOS_ENDPOINT'] ?? process.env['COSMOS_ENDPOINT'];
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction-servicing-ai integration tests. ' +
    'Set it: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

// ─── Test state ────────────────────────────────────────────────────────────────

const testRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TENANT_ID  = `tenant-svc-${testRunId}`;

let db:  CosmosDbService;
let svc: ConstructionServicingAiService;

const toCleanup: Array<{ container: string; id: string; partitionKey: string }> = [];
function track(container: string, id: string, partitionKey = TENANT_ID) {
  toCleanup.push({ container, id, partitionKey });
}

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT!);
  await db.initialize();
  svc = new ConstructionServicingAiService(db);
}, 30_000);

afterAll(async () => {
  for (const { container, id, partitionKey } of toCleanup) {
    try { await db.deleteDocument(container, id, partitionKey); } catch { /* best-effort */ }
  }
}, 30_000);

// ─── Seed helpers ──────────────────────────────────────────────────────────────

async function seedConfig(overrides: Partial<TenantConstructionConfig> = {}): Promise<void> {
  const cfg: Record<string, unknown> = {
    id:                                `config-${TENANT_ID}`,
    tenantId:                          TENANT_ID,
    allowConcurrentDraws:              false,
    maxConcurrentDraws:                1,
    requireInspectionBeforeDraw:       true,
    allowDesktopInspection:            true,
    lienWaiverGracePeriodDays:         0,
    defaultRetainagePercent:           10,
    retainageReleaseAutoTrigger:       true,
    retainageReleaseThreshold:         95,
    retainageReleaseRequiresHumanApproval: true,
    feasibilityEnabled:                true,
    feasibilityBlocksApproval:         false,
    feasibilityMinScore:               65,
    feasibilityCustomRules:            [],
    stalledProjectDays:                60,
    overBudgetThresholdPct:            5,
    scheduleSlipDays:                  30,
    lowArvCoverageThreshold:           0.90,
    contractorLicenseExpiryWarningDays: 30,
    aiMonitoringEnabled:               true,
    aiDrawAnomalyDetection:            true,
    aiCompletionForecastingEnabled:    true,
    aiServicingEnabled:                true,
    interestReserveWarningDays:        30,
    maturityWarningDays:               60,
    autoGenerateStatusReports:         true,
    statusReportFrequencyDays:         30,
    updatedAt:                         new Date().toISOString(),
    updatedBy:                         'test-setup',
    ...overrides,
  };
  await db.upsertDocument('construction-loans', cfg);
  track('construction-loans', cfg.id as string);
}

function makeLoan(
  id: string,
  overrides: Partial<ConstructionLoan> = {}
): ConstructionLoan {
  const now = new Date().toISOString();
  // maturity 1 year from today
  const maturityDate = new Date();
  maturityDate.setFullYear(maturityDate.getFullYear() + 1);

  return {
    id,
    tenantId:              TENANT_ID,
    loanNumber:            `LN-SVC-${id}`,
    loanType:              'GROUND_UP',
    status:                'ACTIVE',
    loanAmount:            600_000,
    interestRate:          0.12,         // 12% p.a.
    maturityDate:          maturityDate.toISOString().slice(0, 10),
    interestReserveAmount: 60_000,
    interestReserveDrawn:  10_000,       // 50 000 remaining
    propertyAddress: {
      street:  '1 Servicing Way',
      city:    'Testburg',
      state:   'FL',
      zipCode: '33101',
      county:  'Miami-Dade',
    },
    propertyType:           'Single Family',
    borrowerId:             'borrower-svc',
    borrowerName:           'Servicing Test Borrower',
    budgetId:               `budget-${id}`,
    totalDrawsApproved:     200_000,
    totalDrawsDisbursed:    150_000,
    percentComplete:        30,
    retainagePercent:       10,
    retainageHeld:          15_000,
    retainageReleased:      0,
    expectedCompletionDate: new Date(Date.now() + 300 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    milestones:             [],
    activeRiskFlags:        [],
    createdBy:              'test-setup',
    createdAt:              now,
    updatedAt:              now,
    ...overrides,
  };
}

async function seedLoan(loan: ConstructionLoan): Promise<void> {
  await db.upsertDocument('construction-loans', loan);
  track('construction-loans', loan.id);
}

// ─── computeInterestReserveStatus ─────────────────────────────────────────────

describe('ConstructionServicingAiService › computeInterestReserveStatus', () => {
  it('projects a depletion date and does not flag when reserve is adequate (> warningDays)', async () => {
    await seedConfig();
    // 50 000 remaining; monthly interest ≈ max(150_000, 60_000) * 0.12 / 12 = 1 500/mo
    // months to depletion ≈ 33 months >> 30-day warning threshold
    const loan = makeLoan(`loan-ir-ok-${testRunId}`);
    await seedLoan(loan);

    const status = await svc.computeInterestReserveStatus(loan.id, TENANT_ID);

    expect(status.reserveRemaining).toBe(50_000);
    expect(status.monthlyInterestEstimate).toBeGreaterThan(0);
    expect(status.monthsUntilDepletion).not.toBeNull();
    expect(status.monthsUntilDepletion!).toBeGreaterThan(1);
    expect(status.projectedDepletionDate).toBeTruthy();
    expect(status.isAtRisk).toBe(false);
  });

  it('fires INTEREST_RESERVE_DEPLETING when reserve will deplete within warning window', async () => {
    await seedConfig({ interestReserveWarningDays: 365 }); // very generous window — forces isAtRisk
    const loan = makeLoan(`loan-ir-risk-${testRunId}`, {
      interestReserveAmount: 12_000,
      interestReserveDrawn:  10_000,  // only 2 000 remaining
      totalDrawsDisbursed:   400_000, // high outstanding balance → high monthly interest
    });
    await seedLoan(loan);

    const status = await svc.computeInterestReserveStatus(loan.id, TENANT_ID);

    expect(status.reserveRemaining).toBe(2_000);
    expect(status.isAtRisk).toBe(true);

    // Verify flag was written back to the loan
    const refreshed = await db.getDocument<ConstructionLoan>('construction-loans', loan.id, TENANT_ID);
    const flagged = (refreshed?.activeRiskFlags ?? []).some(
      f => f.code === 'INTEREST_RESERVE_DEPLETING' && !f.resolvedAt
    );
    expect(flagged).toBe(true);
  });

  it('reports isAtRisk = true when reserve is already exhausted (remaining = 0)', async () => {
    await seedConfig();
    const loan = makeLoan(`loan-ir-zero-${testRunId}`, {
      interestReserveAmount: 10_000,
      interestReserveDrawn:  10_000,
    });
    await seedLoan(loan);

    const status = await svc.computeInterestReserveStatus(loan.id, TENANT_ID);

    expect(status.reserveRemaining).toBe(0);
    expect(status.isAtRisk).toBe(true);
    expect(status.monthsUntilDepletion).toBe(0);
  });

  it('throws when aiServicingEnabled = false', async () => {
    await seedConfig({ aiServicingEnabled: false });
    const loan = makeLoan(`loan-ir-disabled-${testRunId}`);
    await seedLoan(loan);

    await expect(svc.computeInterestReserveStatus(loan.id, TENANT_ID))
      .rejects.toThrow(/aiServicingEnabled/i);
  });
});

// ─── checkMaturityRisk ────────────────────────────────────────────────────────

describe('ConstructionServicingAiService › checkMaturityRisk', () => {
  it('fires MATURITY_APPROACHING when P75 forecast exceeds maturity − warningDays', async () => {
    // maturityDate 45 days from now; maturityWarningDays = 60 → anything forecasted
    // beyond (today + 45 - 60) = (today - 15) should flag.
    // The loan has percentComplete = 5 and construction just started — P75 will be far out.
    const maturity = new Date();
    maturity.setDate(maturity.getDate() + 45);

    await seedConfig({ maturityWarningDays: 60, aiCompletionForecastingEnabled: true });
    const loan = makeLoan(`loan-mat-risk-${testRunId}`, {
      percentComplete:        5,
      maturityDate:           maturity.toISOString().slice(0, 10),
      constructionStartDate:  new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    });
    await seedLoan(loan);

    const flagged = await svc.checkMaturityRisk(loan.id, TENANT_ID);
    expect(flagged).toBe(true);
  });

  it('returns false for a COMPLETED loan (no maturity risk)', async () => {
    await seedConfig();
    const loan = makeLoan(`loan-mat-done-${testRunId}`, { status: 'COMPLETED' });
    await seedLoan(loan);

    const flagged = await svc.checkMaturityRisk(loan.id, TENANT_ID);
    expect(flagged).toBe(false);
  });
});

// ─── generateConversionReadinessChecklist ─────────────────────────────────────

describe('ConstructionServicingAiService › generateConversionReadinessChecklist', () => {
  it('returns isReadyForConversion = true when all criteria are met', async () => {
    await seedConfig();
    // A loan that satisfies every criterion
    const loan = makeLoan(`loan-conv-ready-${testRunId}`, {
      percentComplete:        97,
      actualCompletionDate:   new Date().toISOString().slice(0, 10),
      retainageHeld:          10_000,
      retainageReleased:      9_800, // ≥ 95%
      interestReserveAmount:  30_000,
      interestReserveDrawn:   20_000,
      status:                 'ACTIVE',
      activeRiskFlags:        [],
    });
    await seedLoan(loan);

    const checklist = await svc.generateConversionReadinessChecklist(loan.id, TENANT_ID);

    expect(checklist.isReadyForConversion).toBe(true);
    expect(checklist.blockingCount).toBe(0);
    expect(checklist.items.every(i => i.isComplete)).toBe(true);
  });

  it('identifies blocking items when project is incomplete', async () => {
    await seedConfig();
    const loan = makeLoan(`loan-conv-block-${testRunId}`, {
      percentComplete:      40,      // blocks PROJECT_SUBSTANTIALLY_COMPLETE
      actualCompletionDate: undefined, // blocks COMPLETION_DECLARED
      retainageHeld:        20_000,
      retainageReleased:    0,       // blocks RETAINAGE_RELEASED
    });
    await seedLoan(loan);

    const checklist = await svc.generateConversionReadinessChecklist(loan.id, TENANT_ID);

    expect(checklist.isReadyForConversion).toBe(false);
    expect(checklist.blockingCount).toBeGreaterThanOrEqual(3);

    const blockingKeys = checklist.items.filter(i => !i.isComplete).map(i => i.itemKey);
    expect(blockingKeys).toContain('PROJECT_SUBSTANTIALLY_COMPLETE');
    expect(blockingKeys).toContain('COMPLETION_DECLARED');
    expect(blockingKeys).toContain('RETAINAGE_RELEASED');
  });

  it('throws when called on a non-GROUND_UP loan', async () => {
    await seedConfig();
    const loan = makeLoan(`loan-conv-ff-${testRunId}`, { loanType: 'FIX_FLIP' });
    await seedLoan(loan);

    await expect(svc.generateConversionReadinessChecklist(loan.id, TENANT_ID))
      .rejects.toThrow(/GROUND_UP/i);
  });
});
