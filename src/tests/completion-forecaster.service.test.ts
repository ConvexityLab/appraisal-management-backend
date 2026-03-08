/**
 * Completion Forecaster Service — Integration Tests (Phase 4b)
 *
 * Tests run against a live Cosmos DB instance (Azurite or real endpoint).
 *
 * Covers:
 *   - P50 forecast is computed from elapsed time and % complete
 *   - P25 ≤ P50 ≤ P75 ordering is always maintained
 *   - Returns null when aiCompletionForecastingEnabled = false
 *   - Returns null when aiMonitoringEnabled = false
 *   - Loan already at 100% complete returns today for all percentiles
 *   - forecastCompletion throws when loan not found
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { CompletionForecasterService } from '../services/ai/completion-forecaster.service.js';
import type { ConstructionLoan } from '../types/construction-loan.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── Environment ───────────────────────────────────────────────────────────────

const ENDPOINT = process.env['AZURE_COSMOS_ENDPOINT'] ?? process.env['COSMOS_ENDPOINT'];
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run completion-forecaster integration tests. ' +
    'Set it: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

// ─── Test state ────────────────────────────────────────────────────────────────

const testRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TENANT_ID = `tenant-cf-${testRunId}`;

let db:  CosmosDbService;
let svc: CompletionForecasterService;

const toCleanup: Array<{ container: string; id: string; partitionKey: string }> = [];
function track(container: string, id: string, partitionKey = TENANT_ID) {
  toCleanup.push({ container, id, partitionKey });
}

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT!);
  await db.initialize();
  svc = new CompletionForecasterService(db);
}, 30_000);

afterAll(async () => {
  for (const { container, id, partitionKey } of toCleanup) {
    try { await db.deleteDocument(container, id, partitionKey); } catch { /* best-effort */ }
  }
}, 30_000);

// ─── Seed helpers ──────────────────────────────────────────────────────────────

async function seedConfig(overrides: Partial<TenantConstructionConfig> = {}): Promise<void> {
  const config = {
    id: `config-${TENANT_ID}`,
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
  await db.upsertDocument('construction-loans', config);
  track('construction-loans', config.id);
}

function makeLoan(id: string, overrides: Partial<ConstructionLoan> = {}): ConstructionLoan {
  const now = new Date().toISOString();
  return {
    id,
    tenantId:             TENANT_ID,
    loanNumber:           `LN-CF-${id}`,
    loanType:             'FIX_FLIP',
    status:               'ACTIVE',
    loanAmount:           350_000,
    interestRate:         0.12,
    maturityDate:         '2026-12-31',
    interestReserveAmount: 25_000,
    interestReserveDrawn:  0,
    propertyAddress: {
      street:  '200 Rehab St',
      city:    'Fixville',
      state:   'TX',
      zipCode: '77001',
      county:  'Harris',
    },
    propertyType:          'Single Family',
    borrowerId:            'borrower-cf-1',
    borrowerName:          'CF Test Borrower',
    budgetId:              `budget-${id}`,
    totalDrawsApproved:    0,
    totalDrawsDisbursed:   0,
    percentComplete:       0,
    retainagePercent:      10,
    retainageHeld:         0,
    retainageReleased:     0,
    expectedCompletionDate: '2026-06-30',
    milestones:            [],
    createdBy:             'test-setup',
    createdAt:             now,
    updatedAt:             now,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CompletionForecasterService', () => {

  describe('P25 ≤ P50 ≤ P75 ordering', () => {
    it('always maintains P25 ≤ P50 ≤ P75 on an active in-progress loan', async () => {
      await seedConfig();

      // Loan started 60 days ago, 30% complete
      const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const loanId = `loan-order-${testRunId}`;
      await db.upsertDocument('construction-loans', makeLoan(loanId, {
        constructionStartDate: startDate,
        percentComplete:       30,
      }));
      track('construction-loans', loanId);

      const forecast = await svc.forecastCompletion(loanId, TENANT_ID);

      expect(forecast).not.toBeNull();
      expect(new Date(forecast!.p25) <= new Date(forecast!.p50)).toBe(true);
      expect(new Date(forecast!.p50) <= new Date(forecast!.p75)).toBe(true);
    });
  });

  describe('P50 moves with velocity', () => {
    it('produces a shorter P50 when project pace is faster (more % per day)', async () => {
      await seedConfig();

      // Loan A: 50% complete in 30 days (fast)
      const fastStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const fastLoanId = `loan-fast-${testRunId}`;
      await db.upsertDocument('construction-loans', makeLoan(fastLoanId, {
        constructionStartDate: fastStart,
        percentComplete:       50,
        loanType:              'FIX_FLIP',
      }));
      track('construction-loans', fastLoanId);

      // Loan B: 20% complete in 90 days (slow)
      const slowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const slowLoanId = `loan-slow-${testRunId}`;
      await db.upsertDocument('construction-loans', makeLoan(slowLoanId, {
        constructionStartDate: slowStart,
        percentComplete:       20,
        loanType:              'FIX_FLIP',
      }));
      track('construction-loans', slowLoanId);

      const [fastForecast, slowForecast] = await Promise.all([
        svc.forecastCompletion(fastLoanId, TENANT_ID),
        svc.forecastCompletion(slowLoanId, TENANT_ID),
      ]);

      expect(fastForecast).not.toBeNull();
      expect(slowForecast).not.toBeNull();

      // Fast project should complete EARLIER than slow project
      expect(new Date(fastForecast!.p50) < new Date(slowForecast!.p50)).toBe(true);
    });
  });

  describe('Completed loan', () => {
    it('returns today for all percentiles when loan is at 100% complete', async () => {
      await seedConfig();

      const loanId = `loan-done-${testRunId}`;
      await db.upsertDocument('construction-loans', makeLoan(loanId, {
        percentComplete: 100,
        status:          'COMPLETED',
      }));
      track('construction-loans', loanId);

      const today = new Date().toISOString().slice(0, 10);
      const forecast = await svc.forecastCompletion(loanId, TENANT_ID);

      expect(forecast).not.toBeNull();
      expect(forecast!.p25).toBe(today);
      expect(forecast!.p50).toBe(today);
      expect(forecast!.p75).toBe(today);
    });
  });

  describe('Fallback to benchmark when no start date', () => {
    it('produces a valid forecast using loan-type benchmark when constructionStartDate is absent', async () => {
      await seedConfig();

      const loanId = `loan-nobenchmark-${testRunId}`;
      await db.upsertDocument('construction-loans', makeLoan(loanId, {
        // No constructionStartDate set
        percentComplete: 10,
        loanType:        'REHAB',
      }));
      track('construction-loans', loanId);

      const forecast = await svc.forecastCompletion(loanId, TENANT_ID);

      expect(forecast).not.toBeNull();
      expect(forecast!.p50).not.toBe('');
      expect(forecast!.velocityPctPerDay).toBeGreaterThan(0);
    });
  });

  describe('Feature disabled', () => {
    it('returns null when aiCompletionForecastingEnabled = false', async () => {
      await seedConfig({ aiCompletionForecastingEnabled: false });

      const loanId = `loan-disabled-cf-${testRunId}`;
      await db.upsertDocument('construction-loans', makeLoan(loanId, { percentComplete: 40 }));
      track('construction-loans', loanId);

      const forecast = await svc.forecastCompletion(loanId, TENANT_ID);
      expect(forecast).toBeNull();
    });

    it('returns null when aiMonitoringEnabled = false', async () => {
      await seedConfig({ aiMonitoringEnabled: false });

      const loanId = `loan-nomonitoring-cf-${testRunId}`;
      await db.upsertDocument('construction-loans', makeLoan(loanId, { percentComplete: 40 }));
      track('construction-loans', loanId);

      const forecast = await svc.forecastCompletion(loanId, TENANT_ID);
      expect(forecast).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('throws when loan is not found', async () => {
      await seedConfig();
      await expect(
        svc.forecastCompletion('nonexistent-loan-xyz', TENANT_ID)
      ).rejects.toThrow('not found');
    });
  });
});
