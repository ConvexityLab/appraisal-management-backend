/**
 * Construction Risk Service — Integration Tests (Phase 3)
 *
 * Runs against real Azure Cosmos DB (DefaultAzureCredential / az login).
 * Requires AZURE_COSMOS_ENDPOINT to be set in the environment.
 * All test documents are deleted in afterAll.
 *
 * Scenarios:
 *   1. OVER_BUDGET fires when totalDrawnToDate exceeds budget × (1 + threshold%)
 *   2. LIEN_WAIVER_MISSING fires for DISBURSED draws with lienWaiverStatus=PENDING
 *   3. CONTRACTOR_DISQUALIFIED fires when riskTier === 'DISQUALIFIED'
 *   4. MATURITY_APPROACHING fires within maturityWarningDays
 *   5. CPP_TRIGGER fires when 3 or more CRITICAL flags are active
 *   6. AI-managed flags (e.g. DRAW_ANOMALY) are preserved by computeRiskFlags
 *   7. resolveFlag stamps resolvedAt on the matched flag
 *   8. getRiskFlags returns only unresolved flags
 *   9. computePortfolioRiskSummary aggregates across active loans
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionRiskService } from '../services/construction-risk.service.js';
import type { ConstructionLoan } from '../types/construction-loan.types.js';
import type { ConstructionBudget, BudgetLineItem } from '../types/construction-loan.types.js';
import type { ContractorProfile } from '../types/construction-loan.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';
import type { DrawRequest } from '../types/draw-request.types.js';

// ─── Environment setup ────────────────────────────────────────────────────────

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction risk integration tests. ' +
    'Set it in your shell: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const testRunId   = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TENANT      = `tenant-risk-${testRunId}`;
const LOAN_A      = `loan-risk-a-${testRunId}`;   // main test loan
const LOAN_B      = `loan-risk-b-${testRunId}`;   // used in portfolio summary test
const BUDGET_A    = `budget-${LOAN_A}-v1`;
const CONFIG_ID   = `config-${TENANT}`;
const GC_ID       = `gc-risk-${testRunId}`;

// ─── Cleanup tracking ─────────────────────────────────────────────────────────

const cleanup: { container: string; id: string; pk: string }[] = [];
const track = (container: string, id: string, pk: string) =>
  cleanup.push({ container, id, pk });

// ─── Service instances ────────────────────────────────────────────────────────

let db:  CosmosDbService;
let svc: ConstructionRiskService;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

const SEED_LINE_ITEM: BudgetLineItem = {
  id:                    'li-framing-001',
  category:              'FRAMING',
  description:           'Framing — full structure',
  originalAmount:        100_000,
  changeOrderAmount:     0,
  revisedAmount:         100_000,
  drawnToDate:           0,
  remainingBalance:      100_000,
  percentDisbursed:      0,
  percentCompleteInspected: 0,
};

function makeLoan(id: string, overrides: Partial<ConstructionLoan> = {}): ConstructionLoan {
  return {
    id,
    tenantId:              TENANT,
    loanNumber:            `LN-${id.slice(-4).toUpperCase()}`,
    loanType:              'FIX_AND_FLIP',
    status:                'ACTIVE',
    loanAmount:            200_000,
    interestRate:          0.12,
    maturityDate:          futureDate(120),   // 120 days out — no MATURITY_APPROACHING by default
    interestReserveAmount: 20_000,
    interestReserveDrawn:  0,
    propertyAddress: {
      street: '123 Test St',
      city:   'Austin',
      state:  'TX',
      zipCode: '78701',
      county:  'Travis',
    },
    propertyType:        'Single Family Residential',
    borrowerId:          'borrower-001',
    borrowerName:        'Test Borrower',
    budgetId:            `budget-${id}-v1`,
    totalDrawsApproved:  0,
    totalDrawsDisbursed: 0,
    percentComplete:     0,
    retainagePercent:    10,
    retainageHeld:       0,
    retainageReleased:   0,
    milestones:          [],
    expectedCompletionDate: futureDate(90),
    createdBy:           'underwriter-001',
    createdAt:           new Date().toISOString(),
    updatedAt:           new Date().toISOString(),
    ...overrides,
  };
}

function makeBudget(id: string, loanId: string, overrides: Partial<ConstructionBudget> = {}): ConstructionBudget {
  return {
    id,
    constructionLoanId:   loanId,
    tenantId:             TENANT,
    version:              1,
    status:               'APPROVED',
    lineItems:            [SEED_LINE_ITEM],
    totalOriginalBudget:  100_000,
    totalRevisedBudget:   100_000,
    totalDrawnToDate:     0,
    contingencyAmount:    10_000,
    contingencyUsed:      0,
    contingencyRemaining: 10_000,
    approvedAt:           new Date().toISOString(),
    approvedBy:           'underwriter-001',
    createdAt:            new Date().toISOString(),
    updatedAt:            new Date().toISOString(),
    ...overrides,
  };
}

function makeConfig(overrides: Partial<TenantConstructionConfig> = {}): TenantConstructionConfig {
  return {
    tenantId:                         TENANT,
    allowConcurrentDraws:             false,
    maxConcurrentDraws:               1,
    requireInspectionBeforeDraw:      true,
    allowDesktopInspection:           true,
    lienWaiverGracePeriodDays:        0,
    defaultRetainagePercent:          10,
    retainageReleaseAutoTrigger:      true,
    retainageReleaseThreshold:        95,
    retainageReleaseRequiresHumanApproval: true,
    feasibilityEnabled:               true,
    feasibilityBlocksApproval:        false,
    feasibilityMinScore:              65,
    feasibilityCustomRules:           [],
    stalledProjectDays:               60,
    overBudgetThresholdPct:           5,    // > 5% over triggers flag
    scheduleSlipDays:                 30,
    lowArvCoverageThreshold:          0.90,
    contractorLicenseExpiryWarningDays: 30,
    aiMonitoringEnabled:              true,
    aiDrawAnomalyDetection:           true,
    aiCompletionForecastingEnabled:   true,
    aiServicingEnabled:               true,
    interestReserveWarningDays:       30,
    maturityWarningDays:              45,   // flag fires when maturity < 45 days away
    autoGenerateStatusReports:        true,
    statusReportFrequencyDays:        30,
    updatedAt:                        new Date().toISOString(),
    updatedBy:                        'test-setup',
    ...overrides,
  };
}

function makeDraw(
  id: string,
  loanId: string,
  overrides: Partial<DrawRequest> = {}
): DrawRequest {
  return {
    id,
    drawNumber:          1,
    constructionLoanId:  loanId,
    budgetId:            `budget-${loanId}-v1`,
    tenantId:            TENANT,
    status:              'DISBURSED',
    requestedBy:         'gc-001',
    requestedAt:         new Date().toISOString(),
    requestedAmount:     20_000,
    lineItemRequests:    [],
    lienWaiverStatus:    'RECEIVED',
    titleUpdateRequired: false,
    createdAt:           new Date().toISOString(),
    updatedAt:           new Date().toISOString(),
    ...overrides,
  };
}

// ─── beforeAll / afterAll ─────────────────────────────────────────────────────

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT!);
  await db.initialize();
  svc = new ConstructionRiskService(db);

  // Config document (ID pattern: config-{tenantId})
  const config: TenantConstructionConfig & { id: string } = {
    id: CONFIG_ID,
    ...makeConfig(),
  };
  await db.createDocument<TenantConstructionConfig & { id: string }>(
    'construction-loans',
    config
  );
  track('construction-loans', CONFIG_ID, TENANT);
});

afterAll(async () => {
  for (const doc of cleanup) {
    try {
      await db.deleteDocument(doc.container, doc.id, doc.pk);
    } catch {
      // Cleanup failures are non-fatal
    }
  }
});

// ─── 1. OVER_BUDGET ──────────────────────────────────────────────────────────

describe('ConstructionRiskService — OVER_BUDGET', () => {
  it('fires when totalDrawnToDate exceeds budget × (1 + threshold%)', async () => {
    const loan = makeLoan(LOAN_A);
    const budget = makeBudget(BUDGET_A, LOAN_A, {
      totalRevisedBudget: 100_000,
      totalDrawnToDate:   106_000,  // 6% over — config threshold is 5% → flag fires
    });

    await db.createDocument<ConstructionLoan>('construction-loans', loan);
    await db.createDocument<ConstructionBudget>('construction-loans', budget);
    track('construction-loans', LOAN_A, TENANT);
    track('construction-loans', BUDGET_A, TENANT);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);
    const overBudget = flags.find(f => f.code === 'OVER_BUDGET');

    expect(overBudget).toBeDefined();
    expect(overBudget?.severity).toBe('CRITICAL');
    expect(overBudget?.message).toMatch(/revised budget/i);
  });

  it('does NOT fire when totalDrawnToDate is within threshold', async () => {
    // Update the budget to a safe level by overwriting the loan's flags check
    // Reload and update the budget so drawn is inside the threshold
    const budget = makeBudget(BUDGET_A, LOAN_A, {
      totalRevisedBudget: 100_000,
      totalDrawnToDate:   103_000,  // 3% over — below 5% threshold
    });
    await db.upsertDocument<ConstructionBudget>('construction-loans', budget);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);
    const overBudget = flags.find(f => f.code === 'OVER_BUDGET');

    expect(overBudget).toBeUndefined();
  });
});

// ─── 2. LIEN_WAIVER_MISSING ──────────────────────────────────────────────────

describe('ConstructionRiskService — LIEN_WAIVER_MISSING', () => {
  const DRAW_LW = `draw-lw-${testRunId}`;

  it('fires when a DISBURSED draw has lienWaiverStatus=PENDING', async () => {
    const draw = makeDraw(DRAW_LW, LOAN_A, {
      status:           'DISBURSED',
      lienWaiverStatus: 'PENDING',
      disbursedAt:      pastDate(5),
    });
    await db.createDocument<DrawRequest>('draws', draw);
    track('draws', DRAW_LW, LOAN_A);

    const budget = makeBudget(BUDGET_A, LOAN_A, {
      totalRevisedBudget: 100_000,
      totalDrawnToDate:   20_000,  // back to safe level
    });
    await db.upsertDocument<ConstructionBudget>('construction-loans', budget);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);
    const lienFlag = flags.find(f => f.code === 'LIEN_WAIVER_MISSING');

    expect(lienFlag).toBeDefined();
    expect(lienFlag?.severity).toBe('WARNING');
  });

  it('does NOT fire when lien waiver is RECEIVED', async () => {
    const updatedDraw = makeDraw(DRAW_LW, LOAN_A, {
      status:           'DISBURSED',
      lienWaiverStatus: 'RECEIVED',
      disbursedAt:      pastDate(5),
    });
    await db.upsertDocument<DrawRequest>('draws', updatedDraw);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);
    const lienFlag = flags.find(f => f.code === 'LIEN_WAIVER_MISSING');
    expect(lienFlag).toBeUndefined();
  });
});

// ─── 3. CONTRACTOR_DISQUALIFIED ──────────────────────────────────────────────

describe('ConstructionRiskService — CONTRACTOR_DISQUALIFIED', () => {
  it('fires when contractor riskTier is DISQUALIFIED', async () => {
    const gc: ContractorProfile = {
      id:                     GC_ID,
      tenantId:               TENANT,
      name:                   'Bad GC LLC',
      businessEntityType:     'LLC',
      licenseNumber:          'LIC-001',
      licenseState:           'TX',
      licenseExpiry:          futureDate(90), // not expired — but disqualified by tier
      licenseVerificationStatus: 'API_VERIFIED',
      verificationHistory:    [],
      riskTier:               'DISQUALIFIED',
      activeProjectCount:     0,
      totalProjectCount:      0,
      averageCompletionDays:  0,
      onTimeCompletionRate:   0,
      notes:                  'Failed background check',
      createdAt:              new Date().toISOString(),
      updatedAt:              new Date().toISOString(),
    };
    await db.createDocument<ContractorProfile>('contractors', gc);
    track('contractors', GC_ID, TENANT);

    // Attach contractor to the loan
    const loan = makeLoan(LOAN_A, { generalContractorId: GC_ID });
    await db.upsertDocument<ConstructionLoan>('construction-loans', loan);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);
    const disqFlag = flags.find(f => f.code === 'CONTRACTOR_DISQUALIFIED');

    expect(disqFlag).toBeDefined();
    expect(disqFlag?.severity).toBe('CRITICAL');
    expect(disqFlag?.message).toMatch(/DISQUALIFIED/i);
  });

  it('does NOT fire when contractor is in good standing', async () => {
    const gc: ContractorProfile = {
      id:                     GC_ID,
      tenantId:               TENANT,
      name:                   'Good GC LLC',
      businessEntityType:     'LLC',
      licenseNumber:          'LIC-001',
      licenseState:           'TX',
      licenseExpiry:          futureDate(180),
      licenseVerificationStatus: 'API_VERIFIED',
      verificationHistory:    [],
      riskTier:               'PREFERRED',
      activeProjectCount:     1,
      totalProjectCount:      5,
      averageCompletionDays:  120,
      onTimeCompletionRate:   0.9,
      notes:                  '',
      createdAt:              new Date().toISOString(),
      updatedAt:              new Date().toISOString(),
    };
    await db.upsertDocument<ContractorProfile>('contractors', gc);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);
    const disqFlag = flags.find(f => f.code === 'CONTRACTOR_DISQUALIFIED');
    expect(disqFlag).toBeUndefined();
  });
});

// ─── 4. MATURITY_APPROACHING ─────────────────────────────────────────────────

describe('ConstructionRiskService — MATURITY_APPROACHING', () => {
  it('fires when maturityDate is within config.maturityWarningDays', async () => {
    // Loan_A maturity is 120 days out by default (> 45-day threshold)
    // Override to 30 days out → inside 45-day threshold
    const loan = makeLoan(LOAN_A, {
      maturityDate:      futureDate(30),      // 30 days < maturityWarningDays (45)
      generalContractorId: GC_ID,
    });
    await db.upsertDocument<ConstructionLoan>('construction-loans', loan);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);
    const matFlag = flags.find(f => f.code === 'MATURITY_APPROACHING');

    expect(matFlag).toBeDefined();
    expect(matFlag?.message).toMatch(/30 days/);
  });

  it('does NOT fire when maturity is beyond the warning window', async () => {
    const loan = makeLoan(LOAN_A, {
      maturityDate:      futureDate(90),      // 90 days > 45-day threshold
      generalContractorId: GC_ID,
    });
    await db.upsertDocument<ConstructionLoan>('construction-loans', loan);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);
    const matFlag = flags.find(f => f.code === 'MATURITY_APPROACHING');
    expect(matFlag).toBeUndefined();
  });
});

// ─── 5. CPP_TRIGGER ──────────────────────────────────────────────────────────

describe('ConstructionRiskService — CPP_TRIGGER', () => {
  it('fires when 3 or more CRITICAL flags are active', async () => {
    // Stage a loan with conditions that produce 3+ CRITICAL flags:
    //   - OVER_BUDGET (totalDrawnToDate >> budget)
    //   - CONTRACTOR_DISQUALIFIED (riskTier = DISQUALIFIED — already on GC_ID from prev test)
    //   - MATURITY_APPROACHING within threshold AND severity CRITICAL (≤ 30 days)

    const loan = makeLoan(LOAN_A, {
      maturityDate:        futureDate(10),    // → MATURITY_APPROACHING severity=CRITICAL (≤30d)
      generalContractorId: GC_ID,
    });
    const budget = makeBudget(BUDGET_A, LOAN_A, {
      totalRevisedBudget: 100_000,
      totalDrawnToDate:   110_000,            // → OVER_BUDGET (10% over)
    });

    // Ensure contractor is still DISQUALIFIED
    const gc: ContractorProfile = {
      id:                     GC_ID,
      tenantId:               TENANT,
      name:                   'Bad GC LLC',
      businessEntityType:     'LLC',
      licenseNumber:          'LIC-001',
      licenseState:           'TX',
      licenseExpiry:          futureDate(90),
      licenseVerificationStatus: 'API_VERIFIED',
      verificationHistory:    [],
      riskTier:               'DISQUALIFIED',
      activeProjectCount:     0,
      totalProjectCount:      0,
      averageCompletionDays:  0,
      onTimeCompletionRate:   0,
      notes:                  '',
      createdAt:              new Date().toISOString(),
      updatedAt:              new Date().toISOString(),
    };

    await Promise.all([
      db.upsertDocument<ConstructionLoan>('construction-loans', loan),
      db.upsertDocument<ConstructionBudget>('construction-loans', budget),
      db.upsertDocument<ContractorProfile>('contractors', gc),
    ]);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);

    const criticalFlags = flags.filter(f => f.severity === 'CRITICAL' && f.code !== 'CPP_TRIGGER');
    expect(criticalFlags.length).toBeGreaterThanOrEqual(3);

    const cppFlag = flags.find(f => f.code === 'CPP_TRIGGER');
    expect(cppFlag).toBeDefined();
    expect(cppFlag?.severity).toBe('CRITICAL');
    expect(cppFlag?.message).toMatch(/escalation/i);
  });
});

// ─── 6. AI flags are preserved ───────────────────────────────────────────────

describe('ConstructionRiskService — AI flag preservation', () => {
  it('preserves DRAW_ANOMALY flag set by AI service when recomputing data-driven flags', async () => {
    // Directly write an AI flag onto the loan, then re-run computeRiskFlags
    const aiFlag = {
      code: 'DRAW_ANOMALY' as const,
      severity: 'WARNING' as const,
      message: 'AI: draw pattern anomaly detected',
      detectedAt: new Date().toISOString(),
    };

    const loan = await db.getDocument<ConstructionLoan>('construction-loans', LOAN_A, TENANT);
    expect(loan).not.toBeNull();
    const updatedLoan: ConstructionLoan = {
      ...loan!,
      activeRiskFlags: [...(loan!.activeRiskFlags ?? []), aiFlag],
    };
    await db.upsertDocument<ConstructionLoan>('construction-loans', updatedLoan);

    const flags = await svc.computeRiskFlags(LOAN_A, TENANT);
    const drawAnomaly = flags.find(f => f.code === 'DRAW_ANOMALY');

    expect(drawAnomaly).toBeDefined();
    expect(drawAnomaly?.message).toBe(aiFlag.message);
  });
});

// ─── 7. resolveFlag ──────────────────────────────────────────────────────────

describe('ConstructionRiskService — resolveFlag', () => {
  it('stamps resolvedAt on the matched flag and saves the loan', async () => {
    // Ensure there is an OVER_BUDGET flag to resolve  
    const budget = makeBudget(BUDGET_A, LOAN_A, {
      totalRevisedBudget: 100_000,
      totalDrawnToDate:   110_000,
    });
    await db.upsertDocument<ConstructionBudget>('construction-loans', budget);
    await svc.computeRiskFlags(LOAN_A, TENANT);

    const flags = await svc.getRiskFlags(LOAN_A, TENANT);
    const overBudget = flags.find(f => f.code === 'OVER_BUDGET');
    expect(overBudget).toBeDefined();

    await svc.resolveFlag(LOAN_A, 'OVER_BUDGET', 'underwriter-001', 'Approved cost overrun', TENANT);

    const afterFlags = await svc.getRiskFlags(LOAN_A, TENANT);
    const resolved = afterFlags.find(f => f.code === 'OVER_BUDGET');
    // getRiskFlags returns only unresolved — so it should be absent
    expect(resolved).toBeUndefined();
  });

  it('throws when the flag code is not found on the loan', async () => {
    await expect(
      svc.resolveFlag(LOAN_A, 'STALLED_PROJECT', 'user-001', 'No stall', TENANT)
    ).rejects.toThrow(/no active flag.*STALLED_PROJECT/i);
  });

  it('throws when resolvedBy is empty', async () => {
    await expect(
      svc.resolveFlag(LOAN_A, 'OVER_BUDGET', '', 'Some note', TENANT)
    ).rejects.toThrow(/resolvedBy is required/i);
  });
});

// ─── 8. getRiskFlags ─────────────────────────────────────────────────────────

describe('ConstructionRiskService — getRiskFlags', () => {
  it('returns only unresolved flags from the stored loan document', async () => {
    // computeRiskFlags has already run in previous tests — the loan has a mix of flags
    const allRaw = await db.getDocument<ConstructionLoan>('construction-loans', LOAN_A, TENANT);
    const allStored = allRaw?.activeRiskFlags ?? [];

    const unresolved = await svc.getRiskFlags(LOAN_A, TENANT);
    const expectedUnresolvedCount = allStored.filter(f => !f.resolvedAt).length;

    expect(unresolved.length).toBe(expectedUnresolvedCount);
    expect(unresolved.every(f => !f.resolvedAt)).toBe(true);
  });
});

// ─── 9. computePortfolioRiskSummary ──────────────────────────────────────────

describe('ConstructionRiskService — computePortfolioRiskSummary', () => {
  it('includes LOAN_A in the portfolio summary with at least one critical flag', async () => {
    // Refresh LOAN_A flags to a known critical state
    const budget = makeBudget(BUDGET_A, LOAN_A, {
      totalRevisedBudget: 100_000,
      totalDrawnToDate:   112_000,
    });
    const loan = makeLoan(LOAN_A, {
      maturityDate:        futureDate(10),
      generalContractorId: GC_ID,
    });
    await Promise.all([
      db.upsertDocument<ConstructionLoan>('construction-loans', loan),
      db.upsertDocument<ConstructionBudget>('construction-loans', budget),
    ]);
    await svc.computeRiskFlags(LOAN_A, TENANT);

    const summary = await svc.computePortfolioRiskSummary(TENANT);

    expect(summary.tenantId).toBe(TENANT);
    expect(summary.activeLoanCount).toBeGreaterThanOrEqual(1);
    expect(summary.criticalCount).toBeGreaterThanOrEqual(1);
    expect(summary.flagBreakdown['OVER_BUDGET']).toBeGreaterThanOrEqual(1);
  });

  it('creates a second ACTIVE loan and counts it in the summary', async () => {
    const loanB = makeLoan(LOAN_B, {
      // healthy loan — no flags should fire
      maturityDate: futureDate(200),
    });
    const budgetB = makeBudget(`budget-${LOAN_B}-v1`, LOAN_B, {
      totalRevisedBudget: 80_000,
      totalDrawnToDate:   30_000,
    });

    await db.createDocument<ConstructionLoan>('construction-loans', loanB);
    await db.createDocument<ConstructionBudget>('construction-loans', budgetB);
    track('construction-loans', LOAN_B, TENANT);
    track('construction-loans', `budget-${LOAN_B}-v1`, TENANT);

    const summary = await svc.computePortfolioRiskSummary(TENANT);

    expect(summary.activeLoanCount).toBeGreaterThanOrEqual(2);
  });
});
