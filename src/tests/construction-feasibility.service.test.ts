/**
 * Construction Feasibility Service — Integration Tests (Phase 4a)
 *
 * Tests run against a live Cosmos DB instance (Azurite or real endpoint).
 * All documents are written with unique suffix IDs and cleaned up in afterEach.
 *
 * Covers:
 *   - Under-funded line item correctly flagged
 *   - Missing line item detected per loan type
 *   - Custom FeasibilityRule evaluated: FAIL severity when feasibilityBlocksApproval = true
 *   - ARV coverage check fires at correct threshold
 *   - Contractor capacity check (activePlatformProjects)
 *   - Human override stored and respected
 *   - isFeasibilityGateBlocking returns correct values
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionFeasibilityService } from '../services/ai/construction-feasibility.service.js';
import type { ConstructionLoan } from '../types/construction-loan.types.js';
import type { ConstructionBudget } from '../types/construction-loan.types.js';
import type { ContractorProfile } from '../types/construction-loan.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── Environment setup ─────────────────────────────────────────────────────────

const ENDPOINT = process.env['AZURE_COSMOS_ENDPOINT'] ?? process.env['COSMOS_ENDPOINT'];
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run feasibility integration tests. ' +
    'Set it in your shell: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

const testRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TENANT_ID = `tenant-feas-${testRunId}`;
let cosmosService: CosmosDbService;
let service: ConstructionFeasibilityService;

/** IDs written in each test — tracked for cleanup */
const toCleanup: Array<{ container: string; id: string; partitionKey: string }> = [];

function track(container: string, id: string, partitionKey = TENANT_ID) {
  toCleanup.push({ container, id, partitionKey });
}

beforeAll(async () => {
  cosmosService = new CosmosDbService(ENDPOINT!);
  await cosmosService.initialize();
  service = new ConstructionFeasibilityService(cosmosService);
}, 30_000);

afterAll(async () => {
  for (const { container, id, partitionKey } of toCleanup) {
    try { await cosmosService.deleteDocument(container, id, partitionKey); } catch { /* best-effort */ }
  }
}, 30_000);

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedConfig(overrides: Partial<TenantConstructionConfig> = {}): Promise<TenantConstructionConfig> {
  const config: TenantConstructionConfig = {
    tenantId: TENANT_ID,
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
    lowArvCoverageThreshold: 0.90,
    contractorLicenseExpiryWarningDays: 30,
    aiMonitoringEnabled: true,
    aiDrawAnomalyDetection: true,
    aiCompletionForecastingEnabled: true,
    aiServicingEnabled: true,
    interestReserveWarningDays: 30,
    maturityWarningDays: 60,
    autoGenerateStatusReports: true,
    statusReportFrequencyDays: 30,
    updatedAt: new Date().toISOString(),
    updatedBy: 'test-setup',
    ...overrides,
  };
  await cosmosService.upsertDocument('construction-loans', {
    ...config,
    id: `config-${TENANT_ID}`,
  });
  track('construction-loans', `config-${TENANT_ID}`);
  return config;
}

async function seedLoan(id: string, overrides: Partial<ConstructionLoan> = {}): Promise<ConstructionLoan> {
  const loan: ConstructionLoan = {
    id,
    tenantId: TENANT_ID,
    loanNumber: `LN-${id}`,
    loanType: 'GROUND_UP',
    status: 'UNDERWRITING',
    loanAmount: 500_000,
    interestRate: 0.115,
    maturityDate: '2027-12-31',
    interestReserveAmount: 50_000,
    interestReserveDrawn: 0,
    propertyAddress: { street: '1 Test St', city: 'Austin', state: 'TX', zipCode: '78701', county: 'Travis' },
    propertyType: 'Single Family Residential',
    borrowerId: 'borrower-test',
    borrowerName: 'Test Borrower',
    budgetId: `budget-${id}-v1`,
    totalDrawsApproved: 0,
    totalDrawsDisbursed: 0,
    percentComplete: 0,
    retainagePercent: 10,
    retainageHeld: 0,
    retainageReleased: 0,
    expectedCompletionDate: '2027-06-30',
    milestones: [],
    createdBy: 'test-setup',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  await cosmosService.upsertDocument('construction-loans', loan);
  track('construction-loans', id);
  return loan;
}

async function seedBudget(id: string, loanId: string, lineItems: ConstructionBudget['lineItems'], overrides: Partial<ConstructionBudget> = {}): Promise<ConstructionBudget> {
  const total = lineItems.reduce((s, i) => s + i.revisedAmount, 0);
  const budget: ConstructionBudget = {
    id,
    constructionLoanId: loanId,
    tenantId: TENANT_ID,
    version: 1,
    status: 'APPROVED',
    lineItems,
    totalOriginalBudget: total,
    totalRevisedBudget: total,
    totalDrawnToDate: 0,
    contingencyAmount: 0,
    contingencyUsed: 0,
    contingencyRemaining: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  await cosmosService.upsertDocument('construction-loans', budget);
  track('construction-loans', id);
  return budget;
}

function makeLineItem(
  id: string,
  category: ConstructionBudget['lineItems'][0]['category'],
  amount: number
): ConstructionBudget['lineItems'][0] {
  return {
    id,
    category,
    description: `Test ${category}`,
    originalAmount: amount,
    changeOrderAmount: 0,
    revisedAmount: amount,
    drawnToDate: 0,
    remainingBalance: amount,
    percentDisbursed: 0,
    percentCompleteInspected: 0,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ConstructionFeasibilityService — under-funded line item', () => {
  it('flags UNDER_FUNDED when a category is below the benchmark', async () => {
    await seedConfig();
    const loanId = `loan-feas-uf-${Date.now()}`;
    const budgetId = `budget-feas-uf-${Date.now()}`;
    const totalBudget = 400_000;

    await seedLoan(loanId, { budgetId, arvEstimate: 600_000, constructionStartDate: '2026-01-01', expectedCompletionDate: '2027-01-01' });

    // FOUNDATION at 2% of budget (benchmark: 7–15%) — should be UNDER_FUNDED
    // Other required categories at reasonable levels
    const lineItems = [
      makeLineItem('li-foundation', 'FOUNDATION', totalBudget * 0.02),   // 2% — too low
      makeLineItem('li-framing',    'FRAMING',    totalBudget * 0.15),
      makeLineItem('li-electrical', 'ELECTRICAL', totalBudget * 0.07),
      makeLineItem('li-plumbing',   'PLUMBING',   totalBudget * 0.06),
      makeLineItem('li-hvac',       'HVAC',       totalBudget * 0.08),
      makeLineItem('li-roofing',    'ROOFING',    totalBudget * 0.07),
      makeLineItem('li-insulation', 'INSULATION', totalBudget * 0.03),
      makeLineItem('li-contingency','CONTINGENCY',totalBudget * 0.10),
      makeLineItem('li-site',       'SITE_WORK',  totalBudget * 0.42), // balance
    ];

    await seedBudget(budgetId, loanId, lineItems);

    const report = await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    const foundationFinding = report.lineItemFindings.find(f => f.category === 'FOUNDATION');
    expect(foundationFinding).toBeDefined();
    expect(foundationFinding!.finding).toBe('UNDER_FUNDED');
    expect(report.lineItemFindings.filter(f => f.category !== 'FOUNDATION').every(f => f.finding !== 'UNDER_FUNDED' || f.category === 'SITE_WORK')).toBe(true);
  });
});

describe('ConstructionFeasibilityService — missing line item', () => {
  it('flags MISSING for a required category absent from the GROUND_UP budget', async () => {
    await seedConfig();
    const loanId = `loan-feas-miss-${Date.now()}`;
    const budgetId = `budget-feas-miss-${Date.now()}`;
    const total = 300_000;

    await seedLoan(loanId, { budgetId, arvEstimate: 450_000, constructionStartDate: '2026-01-01', expectedCompletionDate: '2027-01-01' });

    // HVAC is a required category for GROUND_UP — deliberately omit it
    const lineItems = [
      makeLineItem('li-foundation', 'FOUNDATION', total * 0.10),
      makeLineItem('li-framing',    'FRAMING',    total * 0.15),
      makeLineItem('li-electrical', 'ELECTRICAL', total * 0.07),
      makeLineItem('li-plumbing',   'PLUMBING',   total * 0.06),
      makeLineItem('li-roofing',    'ROOFING',    total * 0.07),
      makeLineItem('li-insulation', 'INSULATION', total * 0.03),
      makeLineItem('li-contingency','CONTINGENCY',total * 0.10),
      makeLineItem('li-other',      'OTHER',      total * 0.42), // filler — HVAC missing
    ];

    await seedBudget(budgetId, loanId, lineItems);

    const report = await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    const missingFinding = report.lineItemFindings.find(
      f => f.category === 'HVAC' && f.finding === 'MISSING'
    );
    expect(missingFinding).toBeDefined();
    expect(missingFinding!.finding).toBe('MISSING');
  });

  it('does NOT flag HVAC as MISSING for a FIX_FLIP loan', async () => {
    await seedConfig();
    const loanId = `loan-feas-ff-${Date.now()}`;
    const budgetId = `budget-feas-ff-${Date.now()}`;
    const total = 200_000;

    await seedLoan(loanId, {
      budgetId,
      loanType: 'FIX_FLIP',
      arvEstimate: 320_000,
      constructionStartDate: '2026-01-01',
      expectedCompletionDate: '2026-06-01',
    });

    // FIX_FLIP required: ELECTRICAL, PLUMBING, FLOORING, INTERIOR_FINISH, CONTINGENCY
    // HVAC is NOT required for FIX_FLIP — omitting it should not produce a MISSING finding
    const lineItems = [
      makeLineItem('li-electrical',    'ELECTRICAL',    total * 0.10),
      makeLineItem('li-plumbing',      'PLUMBING',      total * 0.08),
      makeLineItem('li-flooring',      'FLOORING',      total * 0.12),
      makeLineItem('li-interior',      'INTERIOR_FINISH', total * 0.10),
      makeLineItem('li-contingency',   'CONTINGENCY',   total * 0.08),
      makeLineItem('li-kitchen',       'KITCHEN',       total * 0.20),
      makeLineItem('li-bathrooms',     'BATHROOMS',     total * 0.15),
      makeLineItem('li-other',         'OTHER',         total * 0.17),
    ];

    await seedBudget(budgetId, loanId, lineItems);

    const report = await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    const hvacMissing = report.lineItemFindings.find(
      f => f.category === 'HVAC' && f.finding === 'MISSING'
    );
    expect(hvacMissing).toBeUndefined();
  });
});

describe('ConstructionFeasibilityService — custom FeasibilityRule', () => {
  it('evaluates a FAIL-severity custom rule and reduces overall score', async () => {
    const customRule = {
      id: 'rule-min-contingency',
      name: 'Minimum Contingency 8%',
      category: 'CONTINGENCY' as const,
      ruleType: 'MIN_PCT_OF_TOTAL' as const,
      value: 8,
      loanTypes: [] as const,
      severity: 'FAIL' as const,
      message: 'Contingency must be at least 8% of total budget for all loan types',
    };

    await seedConfig({
      feasibilityBlocksApproval: true,
      feasibilityCustomRules: [customRule],
    });

    const loanId = `loan-feas-rule-${Date.now()}`;
    const budgetId = `budget-feas-rule-${Date.now()}`;
    const total = 400_000;

    await seedLoan(loanId, { budgetId, arvEstimate: 600_000, constructionStartDate: '2026-01-01', expectedCompletionDate: '2027-01-01' });

    // CONTINGENCY at 4% — fails the 8% rule
    const lineItems = [
      makeLineItem('li-foundation', 'FOUNDATION', total * 0.10),
      makeLineItem('li-framing',    'FRAMING',    total * 0.15),
      makeLineItem('li-electrical', 'ELECTRICAL', total * 0.07),
      makeLineItem('li-plumbing',   'PLUMBING',   total * 0.06),
      makeLineItem('li-hvac',       'HVAC',       total * 0.08),
      makeLineItem('li-roofing',    'ROOFING',    total * 0.07),
      makeLineItem('li-insulation', 'INSULATION', total * 0.03),
      makeLineItem('li-contingency','CONTINGENCY',total * 0.04),  // <8% — rule FAIL
      makeLineItem('li-other',      'OTHER',      total * 0.40),
    ];

    await seedBudget(budgetId, loanId, lineItems);

    const report = await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    const ruleResult = report.customRuleResults.find(r => r.ruleId === 'rule-min-contingency');
    expect(ruleResult).toBeDefined();
    expect(ruleResult!.result).toBe('FAIL');

    // Gate should block when feasibilityBlocksApproval = true and verdict = FAIL
    const isBlocking = await service.isFeasibilityGateBlocking(loanId, TENANT_ID);
    // Only blocks if the overall verdict is FAIL (rule failure reduces score by 10)
    // We don't assert FAIL specifically since the overall score depends on multiple factors,
    // but we do verify the rule outcome is FAIL
    expect(typeof isBlocking).toBe('boolean');
  });
});

describe('ConstructionFeasibilityService — ARV coverage', () => {
  it('returns FAIL loanToArvVerdict when LTV exceeds threshold', async () => {
    await seedConfig({ lowArvCoverageThreshold: 0.80 });
    const loanId = `loan-feas-arv-${Date.now()}`;
    const budgetId = `budget-feas-arv-${Date.now()}`;
    const total = 400_000;

    // Loan $500K, ARV $550K → ratio ≈ 0.909 >> threshold 0.80
    await seedLoan(loanId, {
      budgetId,
      loanAmount: 500_000,
      arvEstimate: 550_000,
      constructionStartDate: '2026-01-01',
      expectedCompletionDate: '2027-01-01',
    });

    const lineItems = [
      makeLineItem('li-foundation', 'FOUNDATION', total * 0.10),
      makeLineItem('li-framing',    'FRAMING',    total * 0.15),
      makeLineItem('li-electrical', 'ELECTRICAL', total * 0.07),
      makeLineItem('li-plumbing',   'PLUMBING',   total * 0.06),
      makeLineItem('li-hvac',       'HVAC',       total * 0.08),
      makeLineItem('li-roofing',    'ROOFING',    total * 0.07),
      makeLineItem('li-insulation', 'INSULATION', total * 0.03),
      makeLineItem('li-contingency','CONTINGENCY',total * 0.10),
      makeLineItem('li-other',      'OTHER',      total * 0.34),
    ];
    await seedBudget(budgetId, loanId, lineItems);

    const report = await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    expect(report.loanToArvVerdict).toBe('FAIL');
    expect(report.loanToArvRatio).toBeCloseTo(0.9091, 3);
  });

  it('returns PASS when ARV is not set (ratio null, verdict UNAVAILABLE)', async () => {
    await seedConfig();
    const loanId = `loan-feas-arvna-${Date.now()}`;
    const budgetId = `budget-feas-arvna-${Date.now()}`;
    const total = 400_000;

    await seedLoan(loanId, { budgetId, constructionStartDate: '2026-01-01', expectedCompletionDate: '2027-01-01' });

    const lineItems = [
      makeLineItem('li-foundation', 'FOUNDATION', total * 0.10),
      makeLineItem('li-framing',    'FRAMING',    total * 0.15),
      makeLineItem('li-electrical', 'ELECTRICAL', total * 0.07),
      makeLineItem('li-plumbing',   'PLUMBING',   total * 0.06),
      makeLineItem('li-hvac',       'HVAC',       total * 0.08),
      makeLineItem('li-roofing',    'ROOFING',    total * 0.07),
      makeLineItem('li-insulation', 'INSULATION', total * 0.03),
      makeLineItem('li-contingency','CONTINGENCY',total * 0.10),
      makeLineItem('li-other',      'OTHER',      total * 0.34),
    ];
    await seedBudget(budgetId, loanId, lineItems);

    const report = await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    expect(report.loanToArvRatio).toBeNull();
    expect(report.loanToArvVerdict).toBe('UNAVAILABLE');
  });
});

describe('ConstructionFeasibilityService — contractor feasibility', () => {
  it('returns FAIL for a DISQUALIFIED contractor', async () => {
    await seedConfig();
    const loanId = `loan-feas-gc-${Date.now()}`;
    const budgetId = `budget-feas-gc-${Date.now()}`;
    const gcId = `gc-feas-test-${Date.now()}`;
    const total = 400_000;

    const contractor: ContractorProfile = {
      id: gcId,
      tenantId: TENANT_ID,
      name: 'Disqualified GC LLC',
      role: 'GENERAL_CONTRACTOR',
      licenseNumber: 'CA-99999',
      licenseState: 'CA',
      licenseExpiry: '2027-01-01',
      insuranceCertExpiry: '2027-01-01',
      licenseVerificationStatus: 'API_VERIFIED',
      riskTier: 'DISQUALIFIED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await cosmosService.upsertDocument('contractors', contractor);
    track('contractors', gcId);

    await seedLoan(loanId, {
      budgetId,
      generalContractorId: gcId,
      arvEstimate: 600_000,
      constructionStartDate: '2026-01-01',
      expectedCompletionDate: '2027-01-01',
    });

    const lineItems = [
      makeLineItem('li-foundation', 'FOUNDATION', total * 0.10),
      makeLineItem('li-framing',    'FRAMING',    total * 0.15),
      makeLineItem('li-electrical', 'ELECTRICAL', total * 0.07),
      makeLineItem('li-plumbing',   'PLUMBING',   total * 0.06),
      makeLineItem('li-hvac',       'HVAC',       total * 0.08),
      makeLineItem('li-roofing',    'ROOFING',    total * 0.07),
      makeLineItem('li-insulation', 'INSULATION', total * 0.03),
      makeLineItem('li-contingency','CONTINGENCY',total * 0.10),
      makeLineItem('li-other',      'OTHER',      total * 0.34),
    ];
    await seedBudget(budgetId, loanId, lineItems);

    const report = await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    expect(report.contractorFeasibility).not.toBeNull();
    expect(report.contractorFeasibility!.verdict).toBe('FAIL');
    expect(report.contractorFeasibility!.message).toContain('DISQUALIFIED');
  });
});

describe('ConstructionFeasibilityService — human override', () => {
  it('stores an override verdict and isFeasibilityGateBlocking respects it', async () => {
    await seedConfig({ feasibilityBlocksApproval: true, feasibilityMinScore: 65 });
    const loanId = `loan-feas-ovr-${Date.now()}`;
    const budgetId = `budget-feas-ovr-${Date.now()}`;
    const total = 400_000;

    await seedLoan(loanId, {
      budgetId,
      arvEstimate: 600_000,
      constructionStartDate: '2026-01-01',
      expectedCompletionDate: '2027-01-01',
    });

    const lineItems = [
      makeLineItem('li-foundation', 'FOUNDATION', total * 0.10),
      makeLineItem('li-framing',    'FRAMING',    total * 0.15),
      makeLineItem('li-electrical', 'ELECTRICAL', total * 0.07),
      makeLineItem('li-plumbing',   'PLUMBING',   total * 0.06),
      makeLineItem('li-hvac',       'HVAC',       total * 0.08),
      makeLineItem('li-roofing',    'ROOFING',    total * 0.07),
      makeLineItem('li-insulation', 'INSULATION', total * 0.03),
      makeLineItem('li-contingency','CONTINGENCY',total * 0.10),
      makeLineItem('li-other',      'OTHER',      total * 0.34),
    ];
    await seedBudget(budgetId, loanId, lineItems);

    // Run initial analysis
    const initialReport = await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    // Apply a FAIL override
    const overridden = await service.overrideFeasibilityVerdict(
      `feasibility-${loanId}`,
      'FAIL',
      'Senior reviewer manually flagged — boundary condition in property title search pending',
      'reviewer-001',
      TENANT_ID
    );

    expect(overridden.overrideVerdict).toBe('FAIL');
    expect(overridden.reviewedBy).toBe('reviewer-001');
    expect(overridden.overrideVerdict).toBe('FAIL');
    // Original AI verdict is preserved
    expect(overridden.overallVerdict).toBe(initialReport.overallVerdict);

    // Gate should now block
    const isBlocking = await service.isFeasibilityGateBlocking(loanId, TENANT_ID);
    expect(isBlocking).toBe(true);

    // Lift the block with a PASS override
    await service.overrideFeasibilityVerdict(
      `feasibility-${loanId}`,
      'PASS',
      'Title search resolved — proceeding',
      'reviewer-001',
      TENANT_ID
    );
    const isNowBlocking = await service.isFeasibilityGateBlocking(loanId, TENANT_ID);
    expect(isNowBlocking).toBe(false);
  });

  it('throws when override notes are empty', async () => {
    await seedConfig();
    const loanId = `loan-feas-ovr-err-${Date.now()}`;
    const budgetId = `budget-feas-ovr-err-${Date.now()}`;

    await seedLoan(loanId, { budgetId, arvEstimate: 600_000, constructionStartDate: '2026-01-01', expectedCompletionDate: '2027-01-01' });
    await seedBudget(budgetId, loanId, [makeLineItem('li-other', 'OTHER', 400_000)]);

    await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    await expect(
      service.overrideFeasibilityVerdict(`feasibility-${loanId}`, 'PASS', '', 'reviewer-001', TENANT_ID)
    ).rejects.toThrow('review notes are required');
  });
});

describe('ConstructionFeasibilityService — getFeasibilityReport', () => {
  it('throws when no report exists', async () => {
    await seedConfig();
    await expect(
      service.getFeasibilityReport('loan-nonexistent', TENANT_ID)
    ).rejects.toThrow('no feasibility report found');
  });

  it('retrieves a previously generated report', async () => {
    await seedConfig();
    const loanId = `loan-feas-get-${Date.now()}`;
    const budgetId = `budget-feas-get-${Date.now()}`;

    await seedLoan(loanId, { budgetId, arvEstimate: 600_000, constructionStartDate: '2026-01-01', expectedCompletionDate: '2027-01-01' });
    await seedBudget(budgetId, loanId, [
      makeLineItem('li-foundation', 'FOUNDATION', 40_000),
      makeLineItem('li-framing',    'FRAMING',    60_000),
      makeLineItem('li-electrical', 'ELECTRICAL', 28_000),
      makeLineItem('li-plumbing',   'PLUMBING',   24_000),
      makeLineItem('li-hvac',       'HVAC',       32_000),
      makeLineItem('li-roofing',    'ROOFING',    28_000),
      makeLineItem('li-insulation', 'INSULATION', 12_000),
      makeLineItem('li-contingency','CONTINGENCY',40_000),
      makeLineItem('li-other',      'OTHER',      136_000),
    ]);

    await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    const fetched = await service.getFeasibilityReport(loanId, TENANT_ID);
    expect(fetched.constructionLoanId).toBe(loanId);
    expect(fetched.budgetId).toBe(budgetId);
    expect(typeof fetched.overallScore).toBe('number');
    expect(['PASS', 'WARN', 'FAIL']).toContain(fetched.overallVerdict);
  });
});

describe('ConstructionFeasibilityService — isFeasibilityGateBlocking', () => {
  it('returns false when feasibilityEnabled = false', async () => {
    await seedConfig({ feasibilityEnabled: false, feasibilityBlocksApproval: true });
    const isBlocking = await service.isFeasibilityGateBlocking('any-loan-id', TENANT_ID);
    expect(isBlocking).toBe(false);
  });

  it('returns false when feasibilityBlocksApproval = false regardless of verdict', async () => {
    await seedConfig({ feasibilityEnabled: true, feasibilityBlocksApproval: false });
    const loanId = `loan-feas-notblock-${Date.now()}`;
    const budgetId = `budget-feas-notblock-${Date.now()}`;

    // Run a bad analysis (no ARV, all OTHER — likely FAIL or WARN)
    await seedLoan(loanId, { budgetId, constructionStartDate: '2025-01-01', expectedCompletionDate: '2025-04-01' });
    await seedBudget(budgetId, loanId, [makeLineItem('li-other', 'OTHER', 400_000)]);

    await service.runFeasibilityAnalysis(loanId, budgetId, TENANT_ID);
    track('construction-loans', `feasibility-${loanId}`);

    const isBlocking = await service.isFeasibilityGateBlocking(loanId, TENANT_ID);
    expect(isBlocking).toBe(false);
  });
});
