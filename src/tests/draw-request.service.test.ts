/**
 * Draw Request Service � Integration Tests
 *
 * Runs against real Azure Cosmos DB using DefaultAzureCredential (az login).
 * Requires AZURE_COSMOS_ENDPOINT to be set in the environment.
 * All test documents are deleted in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { DrawRequestService } from '../services/draw-request.service.js';
import type { TenantConstructionConfig } from '../types/construction-config.types.js';
import type { DrawLineItemRequest, DrawLineItemResult } from '../types/draw-request.types.js';

// --- Setup -------------------------------------------------------------------

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction finance integration tests. ' +
    'Set it in your shell: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

const testRunId   = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TEST_TENANT = `tenant-draw-${testRunId}`;
const TEST_LOAN   = `loan-draw-${testRunId}`;

const docsToCleanup: { container: string; id: string; partitionKey: string }[] = [];
const track = (container: string, id: string, partitionKey: string) =>
  docsToCleanup.push({ container, id, partitionKey });

let db:  CosmosDbService;
let svc: DrawRequestService;

/** A permissive config � allows concurrent draws, no lien waiver gate */
const PERMISSIVE_CONFIG: TenantConstructionConfig = {
  tenantId: TEST_TENANT,
  allowConcurrentDraws: true,
  maxConcurrentDraws: 5,
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

/** A strict config � no concurrent draws, lien waiver required */
const STRICT_CONFIG: TenantConstructionConfig = {
  ...PERMISSIVE_CONFIG,
  allowConcurrentDraws: false,
  maxConcurrentDraws: 1,
  lienWaiverGracePeriodDays: 0,
};

const TEST_BUDGET = `budget-draw-${testRunId}`;

const SAMPLE_LINE_ITEM_REQUESTS: DrawLineItemRequest[] = [
  {
    budgetLineItemId: 'bli-framing',
    category: 'FRAMING',
    description: 'Structural framing',
    requestedAmount: 15_000,
  },
];

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT);
  await db.initialize();
  svc = new DrawRequestService(db);
}, 30_000);

afterAll(async () => {
  for (const doc of docsToCleanup) {
    try { await db.deleteDocument(doc.container, doc.id, doc.partitionKey); } catch { /* best-effort */ }
  }
}, 30_000);

// --- submitDraw ---------------------------------------------------------------

describe('DrawRequestService -- submitDraw', () => {
  it('creates a draw document with SUBMITTED status and persisted line items', async () => {
    const draw = await svc.submitDraw(
      { constructionLoanId: TEST_LOAN, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: SAMPLE_LINE_ITEM_REQUESTS },
      PERMISSIVE_CONFIG,
    );
    track('draws', draw.id, draw.constructionLoanId);

    expect(draw.constructionLoanId).toBe(TEST_LOAN);
    expect(draw.tenantId).toBe(TEST_TENANT);
    expect(draw.status).toBe('SUBMITTED');
    expect(draw.lineItemRequests).toHaveLength(1);
    expect(draw.lineItemRequests[0]!.requestedAmount).toBe(15_000);

    // Round-trip read
    const readBack = await svc.getDrawById(draw.id, TEST_LOAN);
    expect(readBack.id).toBe(draw.id);
    expect(readBack.status).toBe('SUBMITTED');
  });

  it('rejects submissions with no line items', async () => {
    await expect(
      svc.submitDraw(
        { constructionLoanId: TEST_LOAN, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: [] },
        PERMISSIVE_CONFIG,
      ),
    ).rejects.toThrow(/line.?item/i);
  });

  it('enforces the concurrent draw limit for STRICT_CONFIG', async () => {
    // submitDraw creates in SUBMITTED status, which counts as in-flight immediately
    const loanId = `${TEST_LOAN}-concurrent`;
    const first = await svc.submitDraw(
      { constructionLoanId: loanId, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: SAMPLE_LINE_ITEM_REQUESTS },
      STRICT_CONFIG,
    );
    track('draws', first.id, first.constructionLoanId);

    // Second draw on the same loan should be blocked immediately
    await expect(
      svc.submitDraw(
        { constructionLoanId: loanId, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: SAMPLE_LINE_ITEM_REQUESTS },
        STRICT_CONFIG,
      ),
    ).rejects.toThrow(/concurrent/i);
  });
});

// --- getDrawById --------------------------------------------------------------

describe('DrawRequestService � getDrawById', () => {
  it('throws a clear error when draw does not exist', async () => {
    await expect(svc.getDrawById(`nonexistent-${testRunId}`, TEST_LOAN))
      .rejects.toThrow(/not found/i);
  });
});

// --- listDrawsForLoan ---------------------------------------------------------

describe('DrawRequestService � listDrawsForLoan', () => {
  it('returns all draws for a loan in drawNumber order', async () => {
    const loanId = `${TEST_LOAN}-list`;
    // Sequential (not parallel) to avoid drawNumber race condition
    const d1 = await svc.submitDraw({ constructionLoanId: loanId, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: SAMPLE_LINE_ITEM_REQUESTS }, PERMISSIVE_CONFIG);
    const d2 = await svc.submitDraw({ constructionLoanId: loanId, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: SAMPLE_LINE_ITEM_REQUESTS }, PERMISSIVE_CONFIG);
    track('draws', d1.id, d1.constructionLoanId);
    track('draws', d2.id, d2.constructionLoanId);

    const draws = await svc.listDrawsForLoan(loanId, TEST_TENANT);
    expect(draws.length).toBeGreaterThanOrEqual(2);
    const ids = draws.map(d => d.id);
    expect(ids).toContain(d1.id);
    expect(ids).toContain(d2.id);
  });

  it('returns an empty array for a loan with no draws', async () => {
    const draws = await svc.listDrawsForLoan(`no-draws-${testRunId}`, TEST_TENANT);
    expect(draws).toEqual([]);
  });
});

// --- advanceDrawStatus --------------------------------------------------------

describe('DrawRequestService � advanceDrawStatus', () => {
  it('applies a valid transition (SUBMITTED -> UNDER_REVIEW) and persists the new status', async () => {
    const draw = await svc.submitDraw(
      { constructionLoanId: TEST_LOAN, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: SAMPLE_LINE_ITEM_REQUESTS },
      PERMISSIVE_CONFIG,
    );
    track('draws', draw.id, draw.constructionLoanId);

    const updated = await svc.advanceDrawStatus(draw.id, draw.constructionLoanId, 'UNDER_REVIEW', 'test-runner');
    expect(updated.status).toBe('UNDER_REVIEW');

    const readBack = await svc.getDrawById(draw.id, draw.constructionLoanId);
    expect(readBack.status).toBe('UNDER_REVIEW');
  });

  it('rejects an invalid transition (SUBMITTED -> DISBURSED) and leaves the document unchanged', async () => {
    const draw = await svc.submitDraw(
      { constructionLoanId: TEST_LOAN, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: SAMPLE_LINE_ITEM_REQUESTS },
      PERMISSIVE_CONFIG,
    );
    track('draws', draw.id, draw.constructionLoanId);

    await expect(svc.advanceDrawStatus(draw.id, draw.constructionLoanId, 'DISBURSED', 'test-runner'))
      .rejects.toThrow(/transition/i);

    const unchanged = await svc.getDrawById(draw.id, draw.constructionLoanId);
    expect(unchanged.status).toBe('SUBMITTED');
  });
});

// --- approveDrawLineItems -----------------------------------------------------

describe('DrawRequestService � approveDrawLineItems', () => {
  it('approves line items and sets status to APPROVED when all items pass', async () => {
    const draw = await svc.submitDraw(
      { constructionLoanId: TEST_LOAN, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: SAMPLE_LINE_ITEM_REQUESTS },
      PERMISSIVE_CONFIG,
    );
    track('draws', draw.id, draw.constructionLoanId);

    // Advance SUBMITTED -> UNDER_REVIEW directly
    await svc.advanceDrawStatus(draw.id, draw.constructionLoanId, 'UNDER_REVIEW', 'test-runner');

    const lineItemResults: DrawLineItemResult[] = [
      { budgetLineItemId: 'bli-framing', requestedAmount: 15_000, approvedAmount: 15_000, retainageWithheld: 1_500, netDisbursed: 13_500, status: 'APPROVED' },
    ];
    const approved = await svc.approveDrawLineItems(draw.id, draw.constructionLoanId, lineItemResults, 'test-runner');

    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedAmount).toBe(15_000);
    expect(approved.netDisbursementAmount).toBe(13_500);
  });

  it('sets status to PARTIALLY_APPROVED when at least one item is DENIED', async () => {
    const multiItems: DrawLineItemRequest[] = [
      { budgetLineItemId: 'bli-a', category: 'FRAMING', description: 'A', requestedAmount: 5_000 },
      { budgetLineItemId: 'bli-b', category: 'ROOFING', description: 'B', requestedAmount: 3_000 },
    ];
    const draw = await svc.submitDraw(
      { constructionLoanId: TEST_LOAN, budgetId: TEST_BUDGET, tenantId: TEST_TENANT, requestedBy: 'test-runner', lineItemRequests: multiItems },
      PERMISSIVE_CONFIG,
    );
    track('draws', draw.id, draw.constructionLoanId);

    await svc.advanceDrawStatus(draw.id, draw.constructionLoanId, 'UNDER_REVIEW', 'test-runner');

    const lineItemResults: DrawLineItemResult[] = [
      { budgetLineItemId: 'bli-a', requestedAmount: 5_000, approvedAmount: 5_000, retainageWithheld: 500, netDisbursed: 4_500, status: 'APPROVED' },
      { budgetLineItemId: 'bli-b', requestedAmount: 3_000, approvedAmount: 0, retainageWithheld: 0, netDisbursed: 0, status: 'DENIED' },
    ];
    const partial = await svc.approveDrawLineItems(draw.id, draw.constructionLoanId, lineItemResults, 'test-runner');

    expect(partial.status).toBe('PARTIALLY_APPROVED');
    expect(partial.approvedAmount).toBe(5_000);
  });
});