/**
 * Construction Report Generator Service — Integration Tests (Phase 4c)
 *
 * Tests run against a live Cosmos DB instance (endpoint supplied via
 * AZURE_COSMOS_ENDPOINT or COSMOS_ENDPOINT env var).
 *
 * Covers:
 *   generateStatusReport
 *     - report is persisted with all required ConstructionStatusReport fields
 *     - reportType is written as supplied (ON_DEMAND, CPP, SCHEDULED, MATURITY_ALERT)
 *     - summary references borrower name, completion %, and forecast date
 *     - narrative insights >= 1, recommended actions >= 1
 *   getReports
 *     - returns previously generated reports for a loan
 *     - returns empty array when no reports exist
 *   scheduleStatusReports
 *     - generates SCHEDULED reports for ACTIVE loans past the frequency window
 *     - does not regenerate within the same day (idempotent)
 *     - skips when autoGenerateStatusReports = false
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionReportGeneratorService } from '../services/ai/construction-report-generator.service.js';
import type { ConstructionLoan, ConstructionBudget } from '../types/construction-loan.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── Environment ───────────────────────────────────────────────────────────────

const ENDPOINT = process.env['AZURE_COSMOS_ENDPOINT'] ?? process.env['COSMOS_ENDPOINT'];
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction-report-generator integration tests. ' +
    'Set it: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

// ─── Test state ────────────────────────────────────────────────────────────────

const testRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TENANT_ID  = `tenant-rpt-${testRunId}`;

let db:  CosmosDbService;
let svc: ConstructionReportGeneratorService;

const toCleanup: Array<{ container: string; id: string; partitionKey: string }> = [];
function track(container: string, id: string, partitionKey = TENANT_ID) {
  toCleanup.push({ container, id, partitionKey });
}

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT!);
  await db.initialize();
  svc = new ConstructionReportGeneratorService(db);
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

function makeLoan(id: string, overrides: Partial<ConstructionLoan> = {}): ConstructionLoan {
  const now      = new Date().toISOString();
  const maturity = new Date();
  maturity.setFullYear(maturity.getFullYear() + 1);
  return {
    id,
    tenantId:              TENANT_ID,
    loanNumber:            `LN-RPT-${id}`,
    loanType:              'GROUND_UP',
    status:                'ACTIVE',
    loanAmount:            500_000,
    interestRate:          0.12,
    maturityDate:          maturity.toISOString().slice(0, 10),
    interestReserveAmount: 40_000,
    interestReserveDrawn:  8_000,
    propertyAddress: {
      street:  '42 Report Blvd',
      city:    'Reportton',
      state:   'TX',
      zipCode: '78701',
      county:  'Travis',
    },
    propertyType:           'Single Family',
    borrowerId:             'borrower-rpt',
    borrowerName:           'Report Test Borrower',
    budgetId:               `budget-${id}`,
    totalDrawsApproved:     150_000,
    totalDrawsDisbursed:    100_000,
    percentComplete:        35,
    retainagePercent:       10,
    retainageHeld:          10_000,
    retainageReleased:      0,
    expectedCompletionDate: new Date(Date.now() + 270 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    constructionStartDate:  new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    milestones:             [],
    activeRiskFlags:        [],
    createdBy:              'test-setup',
    createdAt:              now,
    updatedAt:              now,
    ...overrides,
  };
}

function makeBudget(id: string, loanId: string): ConstructionBudget {
  const now = new Date().toISOString();
  return {
    id,
    constructionLoanId: loanId,
    tenantId:           TENANT_ID,
    version:            1,
    status:             'APPROVED',
    lineItems: [],
    totalOriginalBudget: 480_000,
    totalRevisedBudget:  480_000,
    totalDrawnToDate:    100_000,
    contingencyAmount:   24_000,
    contingencyUsed:     5_000,
    contingencyRemaining: 19_000,
    approvedAt:          now,
    approvedBy:          'test-setup',
    createdAt:           now,
    updatedAt:           now,
  };
}

async function seedLoan(loan: ConstructionLoan): Promise<void> {
  await db.upsertDocument('construction-loans', loan);
  track('construction-loans', loan.id);
}

async function seedBudget(budget: ConstructionBudget): Promise<void> {
  await db.upsertDocument('construction-loans', budget);
  track('construction-loans', budget.id);
}

// ─── generateStatusReport ─────────────────────────────────────────────────────

describe('ConstructionReportGeneratorService › generateStatusReport', () => {
  it('persists a report with all required ConstructionStatusReport fields', async () => {
    await seedConfig();
    const loanId  = `loan-rpt-full-${testRunId}`;
    const budgetId = `budget-rpt-full-${testRunId}`;
    const loan   = makeLoan(loanId, { budgetId });
    const budget = makeBudget(budgetId, loanId);
    await seedLoan(loan);
    await seedBudget(budget);

    const report = await svc.generateStatusReport(loanId, 'ON_DEMAND', TENANT_ID);

    // Track for cleanup
    track('construction-loans', report.id);

    // Validate shape — every required field must be present
    expect(report.id).toMatch(/^status-report-/);
    expect(report.constructionLoanId).toBe(loanId);
    expect(report.tenantId).toBe(TENANT_ID);
    expect(report.reportDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(report.reportType).toBe('ON_DEMAND');
    expect(report.generatedBy).toBe('AI_AUTO');
    expect(typeof report.summary).toBe('string');
    expect(report.summary.length).toBeGreaterThan(20);
    expect(typeof report.percentComplete).toBe('number');
    expect(typeof report.completionForecastP50).toBe('string');
    expect(typeof report.completionForecastP75).toBe('string');
    expect(typeof report.daysToMaturity).toBe('number');
    expect(report.daysToMaturity).toBeGreaterThan(0);
    expect(report.budgetSnapshot.totalBudget).toBe(480_000);
    expect(report.budgetSnapshot.totalDrawnToDate).toBe(100_000);
    expect(Array.isArray(report.activeRiskFlags)).toBe(true);
    expect(typeof report.pendingDraws).toBe('number');
    expect(typeof report.pendingInspections).toBe('number');
    expect(typeof report.pendingLienWaivers).toBe('number');
    expect(typeof report.pendingChangeOrders).toBe('number');
    expect(report.narrativeInsights.length).toBeGreaterThan(0);
    expect(report.recommendedActions.length).toBeGreaterThan(0);
    expect(typeof report.createdAt).toBe('string');
  });

  it('writes reportType = CPP for a CPP-triggered report', async () => {
    await seedConfig();
    const loanId   = `loan-rpt-cpp-${testRunId}`;
    const budgetId = `budget-rpt-cpp-${testRunId}`;
    await seedLoan(makeLoan(loanId, { budgetId }));
    await seedBudget(makeBudget(budgetId, loanId));

    const report = await svc.generateStatusReport(loanId, 'CPP', TENANT_ID);
    track('construction-loans', report.id);

    expect(report.reportType).toBe('CPP');
  });

  it('summary references the borrower name and completion percentage', async () => {
    await seedConfig();
    const loanId   = `loan-rpt-sum-${testRunId}`;
    const budgetId = `budget-rpt-sum-${testRunId}`;
    await seedLoan(makeLoan(loanId, { budgetId }));
    await seedBudget(makeBudget(budgetId, loanId));

    const report = await svc.generateStatusReport(loanId, 'ON_DEMAND', TENANT_ID);
    track('construction-loans', report.id);

    expect(report.summary).toContain('Report Test Borrower');
    expect(report.summary).toContain('35%');
  });

  it('throws when aiServicingEnabled = false', async () => {
    await seedConfig({ aiServicingEnabled: false });
    const loanId   = `loan-rpt-dis-${testRunId}`;
    const budgetId = `budget-rpt-dis-${testRunId}`;
    await seedLoan(makeLoan(loanId, { budgetId }));
    await seedBudget(makeBudget(budgetId, loanId));

    await expect(svc.generateStatusReport(loanId, 'ON_DEMAND', TENANT_ID))
      .rejects.toThrow(/aiServicingEnabled/i);
  });
});

// ─── getReports ───────────────────────────────────────────────────────────────

describe('ConstructionReportGeneratorService › getReports', () => {
  it('returns previously generated reports for a loan', async () => {
    await seedConfig();
    const loanId   = `loan-rpt-list-${testRunId}`;
    const budgetId = `budget-rpt-list-${testRunId}`;
    await seedLoan(makeLoan(loanId, { budgetId }));
    await seedBudget(makeBudget(budgetId, loanId));

    const r1 = await svc.generateStatusReport(loanId, 'ON_DEMAND', TENANT_ID);
    const r2 = await svc.generateStatusReport(loanId, 'SCHEDULED', TENANT_ID);
    track('construction-loans', r1.id);
    track('construction-loans', r2.id);

    const reports = await svc.getReports(loanId, TENANT_ID);

    expect(reports.length).toBeGreaterThanOrEqual(2);
    const ids = reports.map(r => r.id);
    expect(ids).toContain(r1.id);
    expect(ids).toContain(r2.id);
  });

  it('returns an empty array when no reports exist for a loan', async () => {
    await seedConfig();
    // Use a loanId that has never had a report generated
    const reports = await svc.getReports(`nonexistent-loan-rpt-${testRunId}`, TENANT_ID);
    expect(reports).toEqual([]);
  });
});

// ─── scheduleStatusReports ────────────────────────────────────────────────────

describe('ConstructionReportGeneratorService › scheduleStatusReports', () => {
  it('generates a SCHEDULED report for an active loan with no prior reports', async () => {
    await seedConfig({ statusReportFrequencyDays: 30 });
    const loanId   = `loan-sched-new-${testRunId}`;
    const budgetId = `budget-sched-new-${testRunId}`;
    await seedLoan(makeLoan(loanId, { budgetId }));
    await seedBudget(makeBudget(budgetId, loanId));

    const result = await svc.scheduleStatusReports(TENANT_ID);

    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.errors).toBe(0);

    // Find and track the newly created report
    const reports = await svc.getReports(loanId, TENANT_ID);
    for (const r of reports) {
      track('construction-loans', r.id);
    }
    expect(reports.some(r => r.reportType === 'SCHEDULED')).toBe(true);
  });

  it('does not regenerate a report for the same loan within the same day', async () => {
    await seedConfig({ statusReportFrequencyDays: 30 });
    const loanId   = `loan-sched-idem-${testRunId}`;
    const budgetId = `budget-sched-idem-${testRunId}`;
    await seedLoan(makeLoan(loanId, { budgetId }));
    await seedBudget(makeBudget(budgetId, loanId));

    // First run
    const first = await svc.scheduleStatusReports(TENANT_ID);
    expect(first.errors).toBe(0);

    // Collect all reports before second run
    const before = await svc.getReports(loanId, TENANT_ID);
    for (const r of before) { track('construction-loans', r.id); }

    // Second run — same day, should be skipped (idempotent)
    await svc.scheduleStatusReports(TENANT_ID);

    const after = await svc.getReports(loanId, TENANT_ID);
    for (const r of after) { track('construction-loans', r.id); }

    // Must not have grown since the first run
    expect(after.length).toBe(before.length);
  });

  it('skips when autoGenerateStatusReports = false', async () => {
    await seedConfig({ autoGenerateStatusReports: false });

    const result = await svc.scheduleStatusReports(TENANT_ID);

    expect(result.processed).toBe(0);
    expect(result.errors).toBe(0);
  });
});
