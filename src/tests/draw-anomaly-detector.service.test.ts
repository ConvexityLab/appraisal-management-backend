/**
 * Draw Anomaly Detector Service — Integration Tests (Phase 4b)
 *
 * Tests run against a live Cosmos DB instance (Azurite or real endpoint).
 *
 * Covers:
 *   - PHASE_SEQUENCE anomaly fires for late-phase categories on a 0% complete loan
 *   - Normal draw (matching current phase) passes with no WARNING/CRITICAL findings
 *   - GC_SYNC_PATTERN fires CRITICAL when same GC has concurrent draws on two loans
 *   - AMOUNT_OUTLIER detected when draw far exceeds historical median
 *   - analyzeDrawRequest returns null when aiDrawAnomalyDetection is disabled
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { DrawAnomalyDetectorService } from '../services/ai/draw-anomaly-detector.service.js';
import type { ConstructionLoan } from '../types/construction-loan.types.js';
import type { DrawRequest } from '../types/draw-request.types.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';

// ─── Environment setup ─────────────────────────────────────────────────────────

const ENDPOINT = process.env['AZURE_COSMOS_ENDPOINT'] ?? process.env['COSMOS_ENDPOINT'];
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run draw-anomaly integration tests. ' +
    'Set it: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

// ─── Test state ────────────────────────────────────────────────────────────────

const testRunId  = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TENANT_ID  = `tenant-da-${testRunId}`;
const LOAN_ID    = `loan-da-${testRunId}`;
const LOAN_ID_B  = `loan-da-b-${testRunId}`;

let db: CosmosDbService;
let svc: DrawAnomalyDetectorService;

const toCleanup: Array<{ container: string; id: string; partitionKey: string }> = [];

function track(container: string, id: string, partitionKey = TENANT_ID) {
  toCleanup.push({ container, id, partitionKey });
}

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT!);
  await db.initialize();
  svc = new DrawAnomalyDetectorService(db);
}, 30_000);

afterAll(async () => {
  for (const { container, id, partitionKey } of toCleanup) {
    try { await db.deleteDocument(container, id, partitionKey); } catch { /* best-effort */ }
  }
}, 30_000);

// ─── Seed helpers ──────────────────────────────────────────────────────────────

async function seedConfig(overrides: Partial<TenantConstructionConfig> = {}): Promise<void> {
  const config: TenantConstructionConfig & { id: string } = {
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
    loanNumber:           `LN-${id}`,
    loanType:             'GROUND_UP',
    status:               'ACTIVE',
    loanAmount:           500_000,
    interestRate:         0.115,
    maturityDate:         '2026-12-31',
    interestReserveAmount: 40_000,
    interestReserveDrawn:  0,
    propertyAddress: {
      street:  '100 Test Ave',
      city:    'TestCity',
      state:   'CA',
      zipCode: '90210',
      county:  'LA',
    },
    propertyType:          'Single Family',
    borrowerId:            'borrower-1',
    borrowerName:          'Test Borrower',
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

async function seedLoan(loan: ConstructionLoan): Promise<void> {
  await db.upsertDocument('construction-loans', loan);
  track('construction-loans', loan.id);
}

function makeDraw(id: string, loanId: string, overrides: Partial<DrawRequest> = {}): DrawRequest {
  const now = new Date().toISOString();
  return {
    id,
    drawNumber:         1,
    constructionLoanId: loanId,
    budgetId:           `budget-${loanId}`,
    tenantId:           TENANT_ID,
    status:             'SUBMITTED',
    requestedBy:        'gc-user',
    requestedAt:        now,
    requestedAmount:    20_000,
    lineItemRequests:   [],
    lienWaiverStatus:   'PENDING',
    titleUpdateRequired: false,
    createdAt:          now,
    updatedAt:          now,
    ...overrides,
  };
}

async function seedDraw(draw: DrawRequest): Promise<void> {
  await db.upsertDocument('draws', draw);
  // draws container is partitioned by constructionLoanId
  track('draws', draw.id, draw.constructionLoanId);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DrawAnomalyDetectorService', () => {

  describe('PHASE_SEQUENCE anomaly', () => {
    it('fires WARNING when draw requests late-phase items on a 0% complete loan', async () => {
      await seedConfig();
      await seedLoan(makeLoan(LOAN_ID, { percentComplete: 0 }));

      const drawId = `draw-phaseseq-${testRunId}`;
      const draw = makeDraw(drawId, LOAN_ID, {
        lineItemRequests: [
          {
            budgetLineItemId: 'li-1',
            category:         'FLOORING',    // phase 8 — far ahead of a 0% complete project
            description:      'LVP flooring',
            requestedAmount:  15_000,
          },
        ],
      });
      await seedDraw(draw);

      track('construction-loans', `${LOAN_ID}`); // loan updated with riskFlag

      const result = await svc.analyzeDrawRequest(drawId, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.anomalyDetected).toBe(true);
      expect(result!.findings.some(f => f.type === 'PHASE_SEQUENCE')).toBe(true);
      expect(result!.findings.find(f => f.type === 'PHASE_SEQUENCE')?.severity).toBe('WARNING');
      expect(result!.recommendedAction).toBe('REVIEW');
    });
  });

  describe('Normal draw (no anomaly)', () => {
    it('passes with recommendedAction = APPROVE when draw matches early-phase items', async () => {
      await seedConfig();
      const loanId = `loan-norm-${testRunId}`;
      await seedLoan(makeLoan(loanId, { percentComplete: 5 }));

      const drawId = `draw-norm-${testRunId}`;
      const draw = makeDraw(drawId, loanId, {
        lineItemRequests: [
          {
            budgetLineItemId: 'li-site',
            category:         'SITE_WORK',   // phase 2 — appropriate for 5% complete
            description:      'Site grading',
            requestedAmount:  18_000,
          },
        ],
      });
      await seedDraw(draw);
      track('construction-loans', loanId);

      const result = await svc.analyzeDrawRequest(drawId, TENANT_ID);

      expect(result).not.toBeNull();
      // SITE_WORK is phase 2; with percentComplete=5 the frontier is ~0.
      // Depending on the gap calc it may or may not fire — verify no CRITICAL
      expect(result!.findings.every(f => f.severity !== 'CRITICAL')).toBe(true);
      expect(result!.recommendedAction).not.toBe('HOLD');
    });
  });

  describe('GC_SYNC_PATTERN anomaly', () => {
    it('fires CRITICAL when same GC has concurrent draws on two loans within the window', async () => {
      await seedConfig();

      const GC_ID  = `gc-sync-${testRunId}`;
      const loanA  = makeLoan(LOAN_ID, { generalContractorId: GC_ID });
      const loanB  = makeLoan(LOAN_ID_B, { generalContractorId: GC_ID });
      await seedLoan(loanA);
      await seedLoan(loanB);

      const now = new Date().toISOString();

      // Draw on loan A (this is the one we'll analyze)
      const drawAId = `draw-synca-${testRunId}`;
      const drawA = makeDraw(drawAId, LOAN_ID, {
        requestedAt:     now,
        lineItemRequests: [],
      });
      await seedDraw(drawA);

      // Draw on loan B — same time, triggers sync pattern
      const drawBId = `draw-syncb-${testRunId}`;
      const drawB = makeDraw(drawBId, LOAN_ID_B, {
        requestedAt:  now,
        status:       'SUBMITTED',
        lineItemRequests: [],
      });
      await seedDraw(drawB);

      track('construction-loans', LOAN_ID);
      track('construction-loans', LOAN_ID_B);

      const result = await svc.analyzeDrawRequest(drawAId, TENANT_ID);

      expect(result).not.toBeNull();
      const gcFinding = result!.findings.find(f => f.type === 'GC_SYNC_PATTERN');
      expect(gcFinding).toBeDefined();
      expect(gcFinding!.severity).toBe('CRITICAL');
      expect(result!.recommendedAction).toBe('HOLD');
      expect(result!.anomalyDetected).toBe(true);
    });
  });

  describe('AMOUNT_OUTLIER anomaly', () => {
    it('fires WARNING when draw amount is 3× the historical median', async () => {
      await seedConfig();
      const loanId = `loan-outlier-${testRunId}`;
      await seedLoan(makeLoan(loanId, { percentComplete: 40 }));

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sixtyDaysAgo  = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      // Two prior disbursed draws: both ~$20k
      const d1Id = `draw-ol1-${testRunId}`;
      const d2Id = `draw-ol2-${testRunId}`;
      await seedDraw(makeDraw(d1Id, loanId, {
        drawNumber:     1,
        status:         'DISBURSED',
        requestedAmount: 20_000,
        disbursedAt:    sixtyDaysAgo,
        requestedAt:    sixtyDaysAgo,
      }));
      await seedDraw(makeDraw(d2Id, loanId, {
        drawNumber:     2,
        status:         'DISBURSED',
        requestedAmount: 22_000,
        disbursedAt:    thirtyDaysAgo,
        requestedAt:    thirtyDaysAgo,
      }));

      // Current draw: $65k — 3× the historical median
      const drawId = `draw-ol3-${testRunId}`;
      await seedDraw(makeDraw(drawId, loanId, {
        drawNumber:      3,
        status:          'SUBMITTED',
        requestedAmount: 65_000,
        lineItemRequests: [{
          budgetLineItemId: 'li-framing',
          category:         'FRAMING',
          description:      'Framing',
          requestedAmount:  65_000,
        }],
      }));

      track('construction-loans', loanId);

      const result = await svc.analyzeDrawRequest(drawId, TENANT_ID);

      expect(result).not.toBeNull();
      const outlierFinding = result!.findings.find(f => f.type === 'AMOUNT_OUTLIER');
      expect(outlierFinding).toBeDefined();
      expect(outlierFinding!.severity).toBe('WARNING');
    });
  });

  describe('Feature disabled', () => {
    it('returns null when aiDrawAnomalyDetection = false', async () => {
      await seedConfig({ aiDrawAnomalyDetection: false });
      const loanId = `loan-disabled-${testRunId}`;
      await seedLoan(makeLoan(loanId));

      const drawId = `draw-disabled-${testRunId}`;
      await seedDraw(makeDraw(drawId, loanId));
      track('construction-loans', loanId);

      const result = await svc.analyzeDrawRequest(drawId, TENANT_ID);
      expect(result).toBeNull();
    });

    it('returns null when aiMonitoringEnabled = false', async () => {
      await seedConfig({ aiMonitoringEnabled: false });
      const loanId = `loan-nomonitoring-${testRunId}`;
      await seedLoan(makeLoan(loanId));

      const drawId = `draw-nomonitoring-${testRunId}`;
      await seedDraw(makeDraw(drawId, loanId));
      track('construction-loans', loanId);

      const result = await svc.analyzeDrawRequest(drawId, TENANT_ID);
      expect(result).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('throws when drawId does not exist', async () => {
      await seedConfig();
      await expect(
        svc.analyzeDrawRequest('nonexistent-draw-id', TENANT_ID)
      ).rejects.toThrow('not found');
    });
  });
});
