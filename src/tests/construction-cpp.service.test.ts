/**
 * Construction CPP Service — Integration Tests (Phase 4b)
 *
 * Tests run against a live Cosmos DB instance (Azurite or real endpoint).
 *
 * Covers:
 *   - evaluateCppTrigger returns false for single non-critical flag
 *   - evaluateCppTrigger returns true when ≥ 2 CRITICAL flags active
 *   - evaluateCppTrigger returns true when CPP_TRIGGER flag is explicitly present
 *   - createCppWorkoutPlan generates steps matching the active flags
 *   - getCppStatus returns null before plan created, CppRecord after
 *   - resolveCpp sets resolvedAt + resolution; clears CPP_TRIGGER flag
 *   - resolveCpp throws when already resolved
 *   - resolveCpp throws when no CppRecord exists
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ConstructionCppService } from '../services/ai/construction-cpp.service.js';
import type { ConstructionLoan } from '../types/construction-loan.types.js';
import type { ConstructionRiskFlag } from '../types/construction-risk.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── Environment ───────────────────────────────────────────────────────────────

const ENDPOINT = process.env['AZURE_COSMOS_ENDPOINT'] ?? process.env['COSMOS_ENDPOINT'];
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction-cpp integration tests. ' +
    'Set it: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

// ─── Test state ────────────────────────────────────────────────────────────────

const testRunId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TENANT_ID = `tenant-cpp-${testRunId}`;

let db:  CosmosDbService;
let svc: ConstructionCppService;

const toCleanup: Array<{ container: string; id: string; partitionKey: string }> = [];
function track(container: string, id: string, partitionKey = TENANT_ID) {
  toCleanup.push({ container, id, partitionKey });
}

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT!);
  await db.initialize();
  svc = new ConstructionCppService(db);
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

function makeFlag(
  code: ConstructionRiskFlag['code'],
  severity: ConstructionRiskFlag['severity'],
  resolved = false
): ConstructionRiskFlag {
  return {
    code,
    severity,
    message:    `Test flag: ${code}`,
    detectedAt: new Date().toISOString(),
    ...(resolved ? { resolvedAt: new Date().toISOString() } : {}),
  };
}

function makeLoan(id: string, flags: ConstructionRiskFlag[] = []): ConstructionLoan {
  const now = new Date().toISOString();
  return {
    id,
    tenantId:             TENANT_ID,
    loanNumber:           `LN-CPP-${id}`,
    loanType:             'GROUND_UP',
    status:               'ACTIVE',
    loanAmount:           600_000,
    interestRate:         0.115,
    maturityDate:         '2026-12-31',
    interestReserveAmount: 50_000,
    interestReserveDrawn:  5_000,
    propertyAddress: {
      street:  '300 CPP Lane',
      city:    'Workoutville',
      state:   'FL',
      zipCode: '33101',
      county:  'Miami-Dade',
    },
    propertyType:          'Single Family',
    borrowerId:            'borrower-cpp',
    borrowerName:          'CPP Test Borrower',
    budgetId:              `budget-${id}`,
    totalDrawsApproved:    120_000,
    totalDrawsDisbursed:   100_000,
    percentComplete:       20,
    retainagePercent:      10,
    retainageHeld:         12_000,
    retainageReleased:     0,
    expectedCompletionDate: '2026-06-30',
    milestones:            [],
    activeRiskFlags:       flags,
    createdBy:             'test-setup',
    createdAt:             now,
    updatedAt:             now,
  };
}

async function seedLoan(loan: ConstructionLoan): Promise<void> {
  await db.upsertDocument('construction-loans', loan);
  track('construction-loans', loan.id);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ConstructionCppService', () => {

  describe('evaluateCppTrigger', () => {
    it('returns false for a single WARNING flag', async () => {
      const flags = [makeFlag('CONTINGENCY_NEARLY_EXHAUSTED', 'WARNING')];
      const loanId = `loan-nocpp-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      const triggered = await svc.evaluateCppTrigger(loanId, flags, TENANT_ID);
      expect(triggered).toBe(false);
    });

    it('returns false for a single CRITICAL flag', async () => {
      const flags = [makeFlag('STALLED_PROJECT', 'CRITICAL')];
      const loanId = `loan-onecrit-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      const triggered = await svc.evaluateCppTrigger(loanId, flags, TENANT_ID);
      expect(triggered).toBe(false);
    });

    it('returns true when 2 or more CRITICAL flags are active', async () => {
      const flags = [
        makeFlag('STALLED_PROJECT',    'CRITICAL'),
        makeFlag('LOW_ARV_COVERAGE',   'CRITICAL'),
      ];
      const loanId = `loan-twocrit-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      const triggered = await svc.evaluateCppTrigger(loanId, flags, TENANT_ID);
      expect(triggered).toBe(true);
    });

    it('returns true when CPP_TRIGGER flag is explicitly present', async () => {
      const flags = [makeFlag('CPP_TRIGGER', 'CRITICAL')];
      const loanId = `loan-cppflag-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      const triggered = await svc.evaluateCppTrigger(loanId, flags, TENANT_ID);
      expect(triggered).toBe(true);
    });

    it('ignores already-resolved flags when evaluating trigger', async () => {
      const flags = [
        makeFlag('STALLED_PROJECT',  'CRITICAL', true),  // resolved — should not count
        makeFlag('LOW_ARV_COVERAGE', 'CRITICAL', true),  // resolved — should not count
        makeFlag('OVER_BUDGET',      'WARNING',  false),
      ];
      const loanId = `loan-resolvedflag-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      const triggered = await svc.evaluateCppTrigger(loanId, flags, TENANT_ID);
      expect(triggered).toBe(false);
    });
  });

  describe('createCppWorkoutPlan', () => {
    it('generates a workout plan with steps when STALLED_PROJECT and OVER_BUDGET are active', async () => {
      const flags = [
        makeFlag('STALLED_PROJECT', 'CRITICAL'),
        makeFlag('OVER_BUDGET',     'CRITICAL'),
        makeFlag('CPP_TRIGGER',     'CRITICAL'),
      ];
      const loanId = `loan-plan-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      const cpp = await svc.createCppWorkoutPlan(loanId, TENANT_ID);

      expect(cpp).toBeDefined();
      expect(cpp.workoutPlan.length).toBeGreaterThan(0);
      expect(cpp.triggeringFlags).toContain('STALLED_PROJECT');
      expect(cpp.triggeringFlags).toContain('OVER_BUDGET');
      expect(cpp.narrative).toContain('STALLED PROJECT');
      // Workout steps include steps for both STALLED_PROJECT and OVER_BUDGET
      const actions = cpp.workoutPlan.map(s => s.action);
      // STALLED_PROJECT steps should be present
      expect(actions.some(a => a.toLowerCase().includes('stoppage'))).toBe(true);
      // OVER_BUDGET steps should be present
      expect(actions.some(a => a.toLowerCase().includes('budget'))).toBe(true);
    });

    it('workout steps have no duplicate action text', async () => {
      const flags = [
        makeFlag('STALLED_PROJECT',   'CRITICAL'),
        makeFlag('SCHEDULE_SLIP',     'WARNING'),
        makeFlag('CPP_TRIGGER',       'CRITICAL'),
      ];
      const loanId = `loan-dedup-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      const cpp = await svc.createCppWorkoutPlan(loanId, TENANT_ID);

      const actions   = cpp.workoutPlan.map(s => s.action);
      const uniqueSet = new Set(actions);
      expect(actions.length).toBe(uniqueSet.size);
    });

    it('throws when loan is not found', async () => {
      await expect(
        svc.createCppWorkoutPlan('nonexistent-loan-cpp', TENANT_ID)
      ).rejects.toThrow('not found');
    });
  });

  describe('getCppStatus', () => {
    it('returns null before a CPP workout plan is created', async () => {
      const loanId = `loan-nocppstatus-${testRunId}`;
      await seedLoan(makeLoan(loanId));

      const status = await svc.getCppStatus(loanId, TENANT_ID);
      expect(status).toBeNull();
    });

    it('returns the CppRecord after createCppWorkoutPlan is called', async () => {
      const flags = [
        makeFlag('STALLED_PROJECT',  'CRITICAL'),
        makeFlag('LOW_ARV_COVERAGE', 'CRITICAL'),
        makeFlag('CPP_TRIGGER',      'CRITICAL'),
      ];
      const loanId = `loan-getstatuscpp-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      await svc.createCppWorkoutPlan(loanId, TENANT_ID);
      const status = await svc.getCppStatus(loanId, TENANT_ID);

      expect(status).not.toBeNull();
      expect(status!.resolvedAt).toBeUndefined();
      expect(status!.workoutPlan.length).toBeGreaterThan(0);
    });
  });

  describe('resolveCpp', () => {
    it('sets resolvedAt, resolvedBy, and resolution on the CppRecord', async () => {
      const flags = [
        makeFlag('STALLED_PROJECT',  'CRITICAL'),
        makeFlag('MATURITY_APPROACHING', 'CRITICAL'),
        makeFlag('CPP_TRIGGER',      'CRITICAL'),
      ];
      const loanId = `loan-resolvecpp-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      await svc.createCppWorkoutPlan(loanId, TENANT_ID);
      const resolved = await svc.resolveCpp(loanId, 'CURED', 'admin-user-1', TENANT_ID);

      expect(resolved.resolvedAt).toBeDefined();
      expect(resolved.resolvedBy).toBe('admin-user-1');
      expect(resolved.resolution).toBe('CURED');

      // CPP_TRIGGER flag should now be resolved on the loan
      const loan = await db.getDocument<ConstructionLoan>('construction-loans', loanId, TENANT_ID);
      const cppFlag = loan?.activeRiskFlags?.find(f => f.code === 'CPP_TRIGGER');
      expect(cppFlag?.resolvedAt).toBeDefined();
    });

    it('stores optional resolutionNotes on the CppRecord', async () => {
      const flags = [
        makeFlag('OVER_BUDGET',      'CRITICAL'),
        makeFlag('CHANGE_ORDER_VELOCITY', 'CRITICAL'),
        makeFlag('CPP_TRIGGER',      'CRITICAL'),
      ];
      const loanId = `loan-cppresolvenote-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      await svc.createCppWorkoutPlan(loanId, TENANT_ID);
      const resolved = await svc.resolveCpp(
        loanId,
        'MODIFIED',
        'senior-lender',
        TENANT_ID,
        'Loan modification executed; maturity extended 90 days.'
      );

      expect(resolved.resolutionNotes).toBe('Loan modification executed; maturity extended 90 days.');
    });

    it('throws when resolveCpp is called with no CppRecord', async () => {
      const loanId = `loan-noresolvecpp-${testRunId}`;
      await seedLoan(makeLoan(loanId));

      await expect(
        svc.resolveCpp(loanId, 'CURED', 'admin', TENANT_ID)
      ).rejects.toThrow('no CppRecord');
    });

    it('throws when CPP is already resolved', async () => {
      const flags = [
        makeFlag('STALLED_PROJECT',  'CRITICAL'),
        makeFlag('DRAW_ANOMALY',     'CRITICAL'),
        makeFlag('CPP_TRIGGER',      'CRITICAL'),
      ];
      const loanId = `loan-doublecpp-${testRunId}`;
      await seedLoan(makeLoan(loanId, flags));

      await svc.createCppWorkoutPlan(loanId, TENANT_ID);
      await svc.resolveCpp(loanId, 'CURED', 'admin', TENANT_ID);

      await expect(
        svc.resolveCpp(loanId, 'SOLD', 'admin', TENANT_ID)
      ).rejects.toThrow('already resolved');
    });
  });
});
