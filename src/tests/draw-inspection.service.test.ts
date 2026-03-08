/**
 * Draw Inspection Service — Integration Tests
 *
 * Runs against real Azure Cosmos DB using DefaultAzureCredential (az login).
 * Requires AZURE_COSMOS_ENDPOINT to be set in the environment.
 * All test documents are deleted in afterAll.
 *
 * Tests the full inspection lifecycle:
 *   scheduleInspection → submitInspectionReport → acceptInspection / disputeInspection
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { DrawRequestService } from '../services/draw-request.service.js';
import { DrawInspectionService } from '../services/draw-inspection.service.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';
import type { DrawLineItemRequest } from '../types/draw-request.types.js';

// --- Setup -------------------------------------------------------------------

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction finance integration tests. ' +
    'Set it in your shell: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

const testRunId   = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TEST_TENANT = `tenant-insp-${testRunId}`;
const TEST_LOAN   = `loan-insp-${testRunId}`;
const TEST_BUDGET = `budget-insp-${testRunId}`;

const docsToCleanup: { container: string; id: string; partitionKey: string }[] = [];
const track = (container: string, id: string, partitionKey: string) =>
  docsToCleanup.push({ container, id, partitionKey });

let db:       CosmosDbService;
let drawSvc:  DrawRequestService;
let inspSvc:  DrawInspectionService;

const PERMISSIVE_CONFIG: TenantConstructionConfig = {
  tenantId: TEST_TENANT,
  allowConcurrentDraws: true,
  maxConcurrentDraws: 50,
  requireInspectionBeforeDraw: false,
  allowDesktopInspection: true,
  lienWaiverGracePeriodDays: 0,
  defaultRetainagePercent: 10,
  retainageReleaseAutoTrigger: true,
  retainageReleaseThreshold: 95,
  retainageReleaseRequiresHumanApproval: true,
  feasibilityEnabled: false,
  feasibilityBlocksApproval: false,
  feasibilityMinScore: 65,
  feasibilityCustomRules: [],
  stalledProjectDays: 60,
  overBudgetThresholdPct: 5,
  scheduleSlipDays: 30,
  lowArvCoverageThreshold: 0.9,
  contractorLicenseExpiryWarningDays: 30,
  aiMonitoringEnabled: false,
  aiDrawAnomalyDetection: false,
  aiCompletionForecastingEnabled: false,
  aiServicingEnabled: false,
  interestReserveWarningDays: 30,
  maturityWarningDays: 60,
  autoGenerateStatusReports: false,
  statusReportFrequencyDays: 30,
  updatedBy: 'test',
  updatedAt: new Date().toISOString(),
};

const SAMPLE_LINE_ITEMS: DrawLineItemRequest[] = [
  {
    budgetLineItemId: 'li-framing-001',
    category: 'FRAMING',
    description: 'Framing — first floor',
    requestedAmount: 15000,
  },
  {
    budgetLineItemId: 'li-foundation-001',
    category: 'FOUNDATION',
    description: 'Foundation pour',
    requestedAmount: 10000,
  },
];

const SAMPLE_LINE_FINDINGS = [
  {
    budgetLineItemId: 'li-framing-001',
    category: 'FRAMING',
    description: 'Framing — first floor',
    previousPercent: 0,
    currentPercent: 60,
    inspectorNotes: 'First floor framing 60% complete',
  },
  {
    budgetLineItemId: 'li-foundation-001',
    category: 'FOUNDATION',
    description: 'Foundation pour',
    previousPercent: 0,
    currentPercent: 100,
    inspectorNotes: 'Foundation complete and cured',
  },
];

// --- beforeAll / afterAll ----------------------------------------------------

beforeAll(async () => {
  db      = new CosmosDbService(ENDPOINT!);
  await db.initialize();
  drawSvc = new DrawRequestService(db);
  inspSvc = new DrawInspectionService(db);
});

afterAll(async () => {
  for (const doc of docsToCleanup) {
    try {
      await db.deleteDocument(doc.container, doc.id, doc.partitionKey);
    } catch {
      // Non-critical cleanup — ignore individual failures
    }
  }
});

// --- Tests -------------------------------------------------------------------

describe('DrawInspectionService — scheduleInspection', () => {
  it('creates an inspection and advances the draw to INSPECTION_ORDERED', async () => {
    const draw = await drawSvc.submitDraw(
      {
        constructionLoanId: TEST_LOAN,
        budgetId: TEST_BUDGET,
        tenantId: TEST_TENANT,
        requestedBy: 'gc-user-001',
        lineItemRequests: SAMPLE_LINE_ITEMS,
      },
      PERMISSIVE_CONFIG
    );
    track('draws', draw.id, TEST_LOAN);

    const inspection = await inspSvc.scheduleInspection({
      drawRequestId: draw.id,
      constructionLoanId: TEST_LOAN,
      tenantId: TEST_TENANT,
      inspectionType: 'FIELD',
      inspectorId: 'vendor-inspector-001',
      inspectorName: 'Jane Doe',
      inspectorLicense: 'CA-INS-12345',
      scheduledDate: '2026-04-01',
    });
    track('draws', inspection.id, TEST_LOAN);

    expect(inspection.status).toBe('SCHEDULED');
    expect(inspection.drawRequestId).toBe(draw.id);
    expect(inspection.constructionLoanId).toBe(TEST_LOAN);
    expect(inspection.inspectionType).toBe('FIELD');

    // The linked DrawRequest should have been advanced
    const updatedDraw = await drawSvc.getDrawById(draw.id, TEST_LOAN);
    expect(updatedDraw.status).toBe('INSPECTION_ORDERED');
    expect(updatedDraw.inspectionId).toBe(inspection.id);
  });

  it('rejects scheduling when draw is not in SUBMITTED status', async () => {
    const draw = await drawSvc.submitDraw(
      {
        constructionLoanId: TEST_LOAN,
        budgetId: TEST_BUDGET,
        tenantId: TEST_TENANT,
        requestedBy: 'gc-user-001',
        lineItemRequests: SAMPLE_LINE_ITEMS,
      },
      PERMISSIVE_CONFIG
    );
    track('draws', draw.id, TEST_LOAN);

    // Advance to UNDER_REVIEW (skipping inspection)
    await drawSvc.advanceDrawStatus(draw.id, TEST_LOAN, 'UNDER_REVIEW', 'loan-admin-001');

    await expect(
      inspSvc.scheduleInspection({
        drawRequestId: draw.id,
        constructionLoanId: TEST_LOAN,
        tenantId: TEST_TENANT,
        inspectionType: 'DESKTOP',
        inspectorId: 'vendor-inspector-001',
        inspectorName: 'Jane Doe',
        scheduledDate: '2026-04-02',
      })
    ).rejects.toThrow(/must be in SUBMITTED status/i);
  });

  it('rejects when draw does not exist', async () => {
    await expect(
      inspSvc.scheduleInspection({
        drawRequestId: 'nonexistent-draw-id',
        constructionLoanId: TEST_LOAN,
        tenantId: TEST_TENANT,
        inspectionType: 'FIELD',
        inspectorId: 'vendor-inspector-001',
        inspectorName: 'Jane Doe',
        scheduledDate: '2026-04-01',
      })
    ).rejects.toThrow(/not found/i);
  });
});

describe('DrawInspectionService — submitInspectionReport', () => {
  it('submits findings and advances the linked draw to INSPECTION_COMPLETE', async () => {
    const draw = await drawSvc.submitDraw(
      {
        constructionLoanId: TEST_LOAN,
        budgetId: TEST_BUDGET,
        tenantId: TEST_TENANT,
        requestedBy: 'gc-user-001',
        lineItemRequests: SAMPLE_LINE_ITEMS,
      },
      PERMISSIVE_CONFIG
    );
    track('draws', draw.id, TEST_LOAN);

    const inspection = await inspSvc.scheduleInspection({
      drawRequestId: draw.id,
      constructionLoanId: TEST_LOAN,
      tenantId: TEST_TENANT,
      inspectionType: 'FIELD',
      inspectorId: 'vendor-inspector-001',
      inspectorName: 'John Smith',
      scheduledDate: '2026-04-01',
    });
    track('draws', inspection.id, TEST_LOAN);

    const submitted = await inspSvc.submitInspectionReport(
      inspection.id,
      TEST_LOAN,
      {
        overallPercentComplete: 55,
        previousOverallPercent: 0,
        lineItemFindings: SAMPLE_LINE_FINDINGS,
        photos: [
          { id: 'photo-001', url: 'https://blob/photo-001.jpg', takenAt: '2026-04-01T10:00:00Z' },
        ],
        concerns: [],
        recommendations: ['Proceed with next phase'],
        recommendedDrawAmount: 23000,
        completedDate: '2026-04-01T14:00:00Z',
      }
    );

    expect(submitted.status).toBe('SUBMITTED');
    expect(submitted.overallPercentComplete).toBe(55);
    expect(submitted.percentCompleteThisDraw).toBe(55);
    expect(submitted.lineItemFindings).toHaveLength(2);
    expect(submitted.recommendedDrawAmount).toBe(23000);

    // Linked draw should be INSPECTION_COMPLETE
    const updatedDraw = await drawSvc.getDrawById(draw.id, TEST_LOAN);
    expect(updatedDraw.status).toBe('INSPECTION_COMPLETE');
  });

  it('rejects submission when inspection is not in SCHEDULED status', async () => {
    const draw = await drawSvc.submitDraw(
      {
        constructionLoanId: TEST_LOAN,
        budgetId: TEST_BUDGET,
        tenantId: TEST_TENANT,
        requestedBy: 'gc-user-001',
        lineItemRequests: SAMPLE_LINE_ITEMS,
      },
      PERMISSIVE_CONFIG
    );
    track('draws', draw.id, TEST_LOAN);

    const inspection = await inspSvc.scheduleInspection({
      drawRequestId:     draw.id,
      constructionLoanId: TEST_LOAN,
      tenantId:          TEST_TENANT,
      inspectionType:    'DESKTOP',
      inspectorId:       'vendor-inspector-001',
      inspectorName:     'Jane Doe',
      scheduledDate:     '2026-04-03',
    });
    track('draws', inspection.id, TEST_LOAN);

    // Submit once
    await inspSvc.submitInspectionReport(inspection.id, TEST_LOAN, {
      overallPercentComplete: 40,
      previousOverallPercent: 0,
      lineItemFindings: SAMPLE_LINE_FINDINGS,
      concerns: [],
      recommendations: [],
      completedDate: '2026-04-03T12:00:00Z',
    });

    // Submit again — should fail
    await expect(
      inspSvc.submitInspectionReport(inspection.id, TEST_LOAN, {
        overallPercentComplete: 50,
        previousOverallPercent: 40,
        lineItemFindings: SAMPLE_LINE_FINDINGS,
        concerns: [],
        recommendations: [],
        completedDate: '2026-04-03T13:00:00Z',
      })
    ).rejects.toThrow(/SCHEDULED or IN_PROGRESS/i);
  });
});

describe('DrawInspectionService — acceptInspection', () => {
  it('accepts a SUBMITTED inspection', async () => {
    const draw = await drawSvc.submitDraw(
      {
        constructionLoanId: TEST_LOAN,
        budgetId: TEST_BUDGET,
        tenantId: TEST_TENANT,
        requestedBy: 'gc-user-001',
        lineItemRequests: SAMPLE_LINE_ITEMS,
      },
      PERMISSIVE_CONFIG
    );
    track('draws', draw.id, TEST_LOAN);

    const inspection = await inspSvc.scheduleInspection({
      drawRequestId: draw.id,
      constructionLoanId: TEST_LOAN,
      tenantId: TEST_TENANT,
      inspectionType: 'DESKTOP',
      inspectorId: 'vendor-inspector-001',
      inspectorName: 'Jane Doe',
      scheduledDate: '2026-04-04',
    });
    track('draws', inspection.id, TEST_LOAN);

    await inspSvc.submitInspectionReport(inspection.id, TEST_LOAN, {
      overallPercentComplete: 70,
      previousOverallPercent: 0,
      lineItemFindings: SAMPLE_LINE_FINDINGS,
      concerns: [],
      recommendations: [],
      completedDate: '2026-04-04T10:00:00Z',
    });

    const accepted = await inspSvc.acceptInspection(inspection.id, TEST_LOAN, 'loan-admin-002');

    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.acceptedAt).toBeDefined();
  });

  it('rejects accept when inspection is not SUBMITTED', async () => {
    const draw = await drawSvc.submitDraw(
      {
        constructionLoanId: TEST_LOAN,
        budgetId: TEST_BUDGET,
        tenantId: TEST_TENANT,
        requestedBy: 'gc-user-001',
        lineItemRequests: SAMPLE_LINE_ITEMS,
      },
      PERMISSIVE_CONFIG
    );
    track('draws', draw.id, TEST_LOAN);

    const inspection = await inspSvc.scheduleInspection({
      drawRequestId: draw.id,
      constructionLoanId: TEST_LOAN,
      tenantId: TEST_TENANT,
      inspectionType: 'FIELD',
      inspectorId: 'vendor-inspector-001',
      inspectorName: 'Jane Doe',
      scheduledDate: '2026-04-05',
    });
    track('draws', inspection.id, TEST_LOAN);

    // Try to accept while still SCHEDULED
    await expect(
      inspSvc.acceptInspection(inspection.id, TEST_LOAN, 'loan-admin-002')
    ).rejects.toThrow(/must be in SUBMITTED/i);
  });
});

describe('DrawInspectionService — disputeInspection', () => {
  it('disputes a SUBMITTED inspection and records reason in concerns', async () => {
    const draw = await drawSvc.submitDraw(
      {
        constructionLoanId: TEST_LOAN,
        budgetId: TEST_BUDGET,
        tenantId: TEST_TENANT,
        requestedBy: 'gc-user-001',
        lineItemRequests: SAMPLE_LINE_ITEMS,
      },
      PERMISSIVE_CONFIG
    );
    track('draws', draw.id, TEST_LOAN);

    const inspection = await inspSvc.scheduleInspection({
      drawRequestId: draw.id,
      constructionLoanId: TEST_LOAN,
      tenantId: TEST_TENANT,
      inspectionType: 'FIELD',
      inspectorId: 'vendor-inspector-001',
      inspectorName: 'Jane Doe',
      scheduledDate: '2026-04-06',
    });
    track('draws', inspection.id, TEST_LOAN);

    await inspSvc.submitInspectionReport(inspection.id, TEST_LOAN, {
      overallPercentComplete: 20,
      previousOverallPercent: 0,
      lineItemFindings: SAMPLE_LINE_FINDINGS,
      concerns: ['Possible moisture issue'],
      recommendations: [],
      completedDate: '2026-04-06T09:00:00Z',
    });

    const disputed = await inspSvc.disputeInspection(
      inspection.id,
      TEST_LOAN,
      'Inspector % complete does not match photo evidence'
    );

    expect(disputed.status).toBe('DISPUTED');
    expect(disputed.concerns.some(c => c.includes('[DISPUTED]'))).toBe(true);
  });

  it('rejects dispute when reason is empty', async () => {
    const draw = await drawSvc.submitDraw(
      {
        constructionLoanId: TEST_LOAN,
        budgetId: TEST_BUDGET,
        tenantId: TEST_TENANT,
        requestedBy: 'gc-user-001',
        lineItemRequests: SAMPLE_LINE_ITEMS,
      },
      PERMISSIVE_CONFIG
    );
    track('draws', draw.id, TEST_LOAN);

    const inspection = await inspSvc.scheduleInspection({
      drawRequestId: draw.id,
      constructionLoanId: TEST_LOAN,
      tenantId: TEST_TENANT,
      inspectionType: 'FIELD',
      inspectorId: 'vendor-inspector-001',
      inspectorName: 'Jane Doe',
      scheduledDate: '2026-04-07',
    });
    track('draws', inspection.id, TEST_LOAN);

    await inspSvc.submitInspectionReport(inspection.id, TEST_LOAN, {
      overallPercentComplete: 30,
      previousOverallPercent: 0,
      lineItemFindings: SAMPLE_LINE_FINDINGS,
      concerns: [],
      recommendations: [],
      completedDate: '2026-04-07T08:00:00Z',
    });

    await expect(
      inspSvc.disputeInspection(inspection.id, TEST_LOAN, '')
    ).rejects.toThrow(/reason is required/i);
  });
});

describe('DrawInspectionService — listInspectionsByDraw', () => {
  it('returns all inspections for a draw, ordered by createdAt', async () => {
    const draw = await drawSvc.submitDraw(
      {
        constructionLoanId: TEST_LOAN,
        budgetId: TEST_BUDGET,
        tenantId: TEST_TENANT,
        requestedBy: 'gc-user-001',
        lineItemRequests: SAMPLE_LINE_ITEMS,
      },
      PERMISSIVE_CONFIG
    );
    track('draws', draw.id, TEST_LOAN);

    const insp = await inspSvc.scheduleInspection({
      drawRequestId: draw.id,
      constructionLoanId: TEST_LOAN,
      tenantId: TEST_TENANT,
      inspectionType: 'FIELD',
      inspectorId: 'vendor-inspector-001',
      inspectorName: 'Jane Doe',
      scheduledDate: '2026-04-08',
    });
    track('draws', insp.id, TEST_LOAN);

    const results = await inspSvc.listInspectionsByDraw(draw.id, TEST_LOAN);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.id === insp.id)).toBe(true);
  });
});
