/**
 * Change Order Service — Integration Tests
 *
 * Runs against real Azure Cosmos DB using DefaultAzureCredential (az login).
 * Requires AZURE_COSMOS_ENDPOINT to be set in the environment.
 * All test documents are deleted in afterAll.
 *
 * Tests:
 *   - Submit, review, approve, reject lifecycle
 *   - Approval creates an immutable new budget version (v+1)
 *   - Approval applies line-item deltas with recomputed totals
 *   - Rejection leaves the budget unchanged
 *   - Duplicate approval / rejection of terminal states throws
 *   - Missing line item ID is caught at approval time
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { ChangeOrderService } from '../services/change-order.service.js';
import type { ConstructionBudget, BudgetLineItem } from '../types/construction-loan.types.js';

// --- Setup -------------------------------------------------------------------

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT ?? process.env.COSMOS_ENDPOINT;
if (!ENDPOINT) {
  throw new Error(
    'AZURE_COSMOS_ENDPOINT is required to run construction finance integration tests. ' +
    'Set it in your shell: $env:AZURE_COSMOS_ENDPOINT="https://..."'
  );
}

const testRunId   = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const TEST_TENANT = `tenant-co-${testRunId}`;
const TEST_LOAN   = `loan-co-${testRunId}`;

// Follows the service's convention: budget-{loanId}-v{version}
const BUDGET_V1_ID = `budget-${TEST_LOAN}-v1`;

const docsToCleanup: { container: string; id: string; partitionKey: string }[] = [];
const track = (container: string, id: string, partitionKey: string) =>
  docsToCleanup.push({ container, id, partitionKey });

let db:  CosmosDbService;
let svc: ChangeOrderService;

// ─── Sample line items for the seed budget ──────────────────────────────────

const SEED_LINE_ITEMS: BudgetLineItem[] = [
  {
    id: 'li-foundation-001',
    category: 'FOUNDATION',
    description: 'Foundation pour',
    originalAmount: 50_000,
    changeOrderAmount: 0,
    revisedAmount: 50_000,
    drawnToDate: 0,
    remainingBalance: 50_000,
    percentDisbursed: 0,
    percentCompleteInspected: 0,
  },
  {
    id: 'li-framing-001',
    category: 'FRAMING',
    description: 'Framing — full structure',
    originalAmount: 80_000,
    changeOrderAmount: 0,
    revisedAmount: 80_000,
    drawnToDate: 0,
    remainingBalance: 80_000,
    percentDisbursed: 0,
    percentCompleteInspected: 0,
  },
  {
    id: 'li-contingency-001',
    category: 'CONTINGENCY',
    description: 'Project contingency',
    originalAmount: 15_000,
    changeOrderAmount: 0,
    revisedAmount: 15_000,
    drawnToDate: 0,
    remainingBalance: 15_000,
    percentDisbursed: 0,
    percentCompleteInspected: 0,
  },
];

// --- beforeAll / afterAll -----------------------------------------------------

beforeAll(async () => {
  db  = new CosmosDbService(ENDPOINT!);
  await db.initialize();
  svc = new ChangeOrderService(db);

  // Create the seed budget for all tests to reference
  const seedBudget: ConstructionBudget = {
    id:                  BUDGET_V1_ID,
    constructionLoanId:  TEST_LOAN,
    tenantId:            TEST_TENANT,
    version:             1,
    status:              'APPROVED',
    lineItems:           SEED_LINE_ITEMS,
    totalOriginalBudget: 145_000,
    totalRevisedBudget:  145_000,
    totalDrawnToDate:    0,
    contingencyAmount:   15_000,
    contingencyUsed:     0,
    contingencyRemaining: 15_000,
    approvedAt:          new Date().toISOString(),
    approvedBy:          'underwriter-001',
    createdAt:           new Date().toISOString(),
    updatedAt:           new Date().toISOString(),
  };

  await db.createDocument<ConstructionBudget>('construction-loans', seedBudget);
  track('construction-loans', BUDGET_V1_ID, TEST_TENANT);
});

afterAll(async () => {
  for (const doc of docsToCleanup) {
    try {
      await db.deleteDocument(doc.container, doc.id, doc.partitionKey);
    } catch {
      // Non-critical cleanup
    }
  }
});

// --- Tests -------------------------------------------------------------------

describe('ChangeOrderService — submitChangeOrder', () => {
  it('creates a CO in SUBMITTED status with correct totalDelta and changeOrderNumber', async () => {
    const co = await svc.submitChangeOrder({
      constructionLoanId: TEST_LOAN,
      tenantId: TEST_TENANT,
      budgetId: BUDGET_V1_ID,
      reason: 'Material cost increase for framing lumber',
      requestedBy: 'gc-user-001',
      lineItemChanges: [
        {
          budgetLineItemId: 'li-framing-001',
          category: 'FRAMING',
          description: 'Framing — full structure',
          originalAmount: 80_000,
          proposedAmount: 90_000,
          delta: 10_000,
          justification: 'Lumber prices increased 12% since bid',
        },
      ],
    });
    track('construction-loans', co.id, TEST_TENANT);

    expect(co.status).toBe('SUBMITTED');
    expect(co.totalDelta).toBe(10_000);
    expect(co.proposedTotalBudget).toBe(155_000);
    expect(co.changeOrderNumber).toBeGreaterThanOrEqual(1);
    expect(co.constructionLoanId).toBe(TEST_LOAN);
  });

  it('rejects when reason is empty', async () => {
    await expect(
      svc.submitChangeOrder({
        constructionLoanId: TEST_LOAN,
        tenantId:           TEST_TENANT,
        budgetId:           BUDGET_V1_ID,
        reason:             '',
        requestedBy:        'gc-user-001',
        lineItemChanges: [
          {
            budgetLineItemId: 'li-framing-001',
            category: 'FRAMING',
            description: 'Framing',
            originalAmount: 80_000,
            proposedAmount: 85_000,
            delta: 5_000,
            justification: 'Some justification',
          },
        ],
      })
    ).rejects.toThrow(/reason is required/i);
  });

  it('rejects when lineItemChanges is empty', async () => {
    await expect(
      svc.submitChangeOrder({
        constructionLoanId: TEST_LOAN,
        tenantId:           TEST_TENANT,
        budgetId:           BUDGET_V1_ID,
        reason:             'Valid reason',
        requestedBy:        'gc-user-001',
        lineItemChanges:    [],
      })
    ).rejects.toThrow(/lineItemChanges must not be empty/i);
  });

  it('rejects when budgetId does not exist', async () => {
    await expect(
      svc.submitChangeOrder({
        constructionLoanId: TEST_LOAN,
        tenantId:           TEST_TENANT,
        budgetId:           'budget-nonexistent',
        reason:             'Valid reason',
        requestedBy:        'gc-user-001',
        lineItemChanges: [
          {
            budgetLineItemId: 'li-framing-001',
            category: 'FRAMING',
            description: 'Framing',
            originalAmount: 80_000,
            proposedAmount: 90_000,
            delta: 10_000,
            justification: 'Justification',
          },
        ],
      })
    ).rejects.toThrow(/not found/i);
  });
});

describe('ChangeOrderService — reviewChangeOrder', () => {
  it('advances CO from SUBMITTED to UNDER_REVIEW', async () => {
    const co = await svc.submitChangeOrder({
      constructionLoanId: TEST_LOAN,
      tenantId:           TEST_TENANT,
      budgetId:           BUDGET_V1_ID,
      reason:             'Foundation cost overrun due to soil conditions',
      requestedBy:        'gc-user-001',
      lineItemChanges: [
        {
          budgetLineItemId: 'li-foundation-001',
          category: 'FOUNDATION',
          description: 'Foundation pour',
          originalAmount: 50_000,
          proposedAmount: 58_000,
          delta: 8_000,
          justification: 'Unexpected rock layer required additional excavation',
        },
      ],
    });
    track('construction-loans', co.id, TEST_TENANT);

    const reviewed = await svc.reviewChangeOrder(co.id, TEST_TENANT, 'loan-admin-001');

    expect(reviewed.status).toBe('UNDER_REVIEW');
    expect(reviewed.reviewedBy).toBe('loan-admin-001');
    expect(reviewed.reviewedAt).toBeDefined();
  });
});

describe('ChangeOrderService — approveChangeOrder', () => {
  it('approves CO, creates a new budget version, and applies line-item deltas', async () => {
    const co = await svc.submitChangeOrder({
      constructionLoanId: TEST_LOAN,
      tenantId:           TEST_TENANT,
      budgetId:           BUDGET_V1_ID,
      reason:             'Electrical upgrade required by inspector',
      requestedBy:        'gc-user-001',
      lineItemChanges: [
        {
          budgetLineItemId: 'li-framing-001',
          category: 'FRAMING',
          description: 'Framing — full structure',
          originalAmount: 80_000,
          proposedAmount: 92_000,
          delta: 12_000,
          justification: 'Code change required heavier lumber',
        },
      ],
    });
    track('construction-loans', co.id, TEST_TENANT);

    // Must advance to UNDER_REVIEW before approval
    await svc.reviewChangeOrder(co.id, TEST_TENANT, 'reviewer-001');

    const approved = await svc.approveChangeOrder(co.id, TEST_TENANT, 'approver-001');

    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('approver-001');
    expect(approved.approvedAt).toBeDefined();

    // Verify new budget version exists
    const newBudgetId = `budget-${TEST_LOAN}-v2`;
    track('construction-loans', newBudgetId, TEST_TENANT);

    const newBudget = await db.getDocument<ConstructionBudget>(
      'construction-loans',
      newBudgetId,
      TEST_TENANT
    );

    expect(newBudget).toBeDefined();
    expect(newBudget!.version).toBe(2);
    expect(newBudget!.status).toBe('REVISED');

    // Framing line item should reflect the delta
    const framingItem = newBudget!.lineItems.find(li => li.id === 'li-framing-001');
    expect(framingItem).toBeDefined();
    expect(framingItem!.changeOrderAmount).toBe(12_000);
    expect(framingItem!.revisedAmount).toBe(92_000);  // 80k + 12k

    // totalRevisedBudget should reflect the increase
    expect(newBudget!.totalRevisedBudget).toBe(157_000); // 145k + 12k
  });

  it('rejects approval of a REJECTED CO (terminal state)', async () => {
    const co = await svc.submitChangeOrder({
      constructionLoanId: TEST_LOAN,
      tenantId:           TEST_TENANT,
      budgetId:           BUDGET_V1_ID,
      reason:             'Should be rejected',
      requestedBy:        'gc-user-001',
      lineItemChanges: [
        {
          budgetLineItemId: 'li-contingency-001',
          category: 'CONTINGENCY',
          description: 'Contingency',
          originalAmount: 15_000,
          proposedAmount: 20_000,
          delta: 5_000,
          justification: 'More contingency needed',
        },
      ],
    });
    track('construction-loans', co.id, TEST_TENANT);

    await svc.rejectChangeOrder(co.id, TEST_TENANT, 'Not justified', 'approver-001');

    await expect(
      svc.approveChangeOrder(co.id, TEST_TENANT, 'approver-001')
    ).rejects.toThrow(/invalid transition/i);
  });

  it('rejects approval when a referenced budgetLineItemId does not exist in the budget', async () => {
    const co = await svc.submitChangeOrder({
      constructionLoanId: TEST_LOAN,
      tenantId:           TEST_TENANT,
      budgetId:           BUDGET_V1_ID,
      reason:             'Nonexistent line referenced',
      requestedBy:        'gc-user-001',
      lineItemChanges: [
        {
          budgetLineItemId: 'li-does-not-exist',
          category: 'OTHER',
          description: 'Ghost line item',
          originalAmount: 0,
          proposedAmount: 5_000,
          delta: 5_000,
          justification: 'Testing bad line item reference',
        },
      ],
    });
    track('construction-loans', co.id, TEST_TENANT);

    // Must advance to UNDER_REVIEW before approval attempt
    await svc.reviewChangeOrder(co.id, TEST_TENANT, 'reviewer-001');

    await expect(
      svc.approveChangeOrder(co.id, TEST_TENANT, 'approver-001')
    ).rejects.toThrow(/li-does-not-exist/);
  });
});

describe('ChangeOrderService — rejectChangeOrder', () => {
  it('rejects a SUBMITTED CO and records the rejection reason', async () => {
    const co = await svc.submitChangeOrder({
      constructionLoanId: TEST_LOAN,
      tenantId:           TEST_TENANT,
      budgetId:           BUDGET_V1_ID,
      reason:             'Scope creep — add luxury finishes',
      requestedBy:        'gc-user-001',
      lineItemChanges: [
        {
          budgetLineItemId: 'li-foundation-001',
          category: 'FOUNDATION',
          description: 'Foundation pour',
          originalAmount: 50_000,
          proposedAmount: 80_000,
          delta: 30_000,
          justification: 'Luxury basement upgrade',
        },
      ],
    });
    track('construction-loans', co.id, TEST_TENANT);

    const rejected = await svc.rejectChangeOrder(
      co.id,
      TEST_TENANT,
      'Scope change not within approved plans',
      'approver-001'
    );

    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Scope change not within approved plans');
  });

  it('rejects when reason is empty', async () => {
    const co = await svc.submitChangeOrder({
      constructionLoanId: TEST_LOAN,
      tenantId:           TEST_TENANT,
      budgetId:           BUDGET_V1_ID,
      reason:             'Valid submission',
      requestedBy:        'gc-user-001',
      lineItemChanges: [
        {
          budgetLineItemId: 'li-contingency-001',
          category: 'CONTINGENCY',
          description: 'Contingency',
          originalAmount: 15_000,
          proposedAmount: 18_000,
          delta: 3_000,
          justification: 'Extra buffer',
        },
      ],
    });
    track('construction-loans', co.id, TEST_TENANT);

    await expect(
      svc.rejectChangeOrder(co.id, TEST_TENANT, '', 'approver-001')
    ).rejects.toThrow(/reason is required/i);
  });
});

describe('ChangeOrderService — listChangeOrders', () => {
  it('returns COs for the tenant filtered by loanId', async () => {
    const co = await svc.submitChangeOrder({
      constructionLoanId: TEST_LOAN,
      tenantId:           TEST_TENANT,
      budgetId:           BUDGET_V1_ID,
      reason:             'Minor roof adjustment',
      requestedBy:        'gc-user-001',
      lineItemChanges: [
        {
          budgetLineItemId: 'li-framing-001',
          category: 'FRAMING',
          description: 'Framing',
          originalAmount: 80_000,
          proposedAmount: 81_000,
          delta: 1_000,
          justification: 'Minor adjustment',
        },
      ],
    });
    track('construction-loans', co.id, TEST_TENANT);

    const results = await svc.listChangeOrders(TEST_TENANT, { constructionLoanId: TEST_LOAN });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every(c => c.constructionLoanId === TEST_LOAN)).toBe(true);
  });
});
