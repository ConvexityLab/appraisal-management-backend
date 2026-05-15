/**
 * BulkPortfolioService.submit() — engagement association unit tests
 */

import { describe, it, expect, vi } from 'vitest';

// ReviewDocumentExtractionService requires AXIOM_API_BASE_URL at construction time
// (P2-AX-01 startup validation). This test does not exercise document extraction,
// so we stub the class to prevent the startup guard from throwing.
vi.mock('../../src/services/review-document-extraction.service.js', () => ({
  ReviewDocumentExtractionService: vi.fn().mockImplementation(() => ({})),
}));

import { BulkPortfolioService } from '../../src/services/bulk-portfolio.service.js';
import type { BulkPortfolioJob, BulkPortfolioItem, BulkSubmitRequest } from '../../src/types/bulk-portfolio.types.js';
import type { CosmosDbService } from '../../src/services/cosmos-db.service.js';

function makeItem(overrides: Partial<BulkPortfolioItem> = {}): BulkPortfolioItem {
  return {
    rowIndex: 1,
    analysisType: 'AVM',
    propertyAddress: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    borrowerFirstName: 'Jane',
    borrowerLastName: 'Smith',
    loanNumber: 'LN-001',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<BulkSubmitRequest> = {}): BulkSubmitRequest {
  return {
    clientId: 'client-001',
    fileName: 'batch.xlsx',
    items: [makeItem()],
    ...overrides,
  };
}

/**
 * Phase B test scaffolding: BulkPortfolio now writes via
 * ClientOrderService.addVendorOrders (against the existing standalone
 * ClientOrder created by engagement.service.createEngagement) instead of
 * dbService.createOrder directly.
 *
 * Tests inject:
 *   - createEngagement → returns a full Engagement shape (with embedded
 *     properties[].clientOrders[]) so the bulk service can resolve each
 *     item's clientOrder ids by loanNumber.
 *   - addVendorOrders → returns a single VendorOrder per call.
 */
function makeDbService() {
  const savedJobs: BulkPortfolioJob[] = [];

  const container = {
    items: {
      upsert: async (job: BulkPortfolioJob) => {
        savedJobs.push(job);
        return { resource: job };
      },
    },
  };

  const db = {
    getBulkPortfolioJobsContainer: () => container,
  } as unknown as CosmosDbService;

  return { db, savedJobs };
}

function makeAddVendorOrdersMock() {
  let counter = 0;
  return vi.fn().mockImplementation(async () => {
    counter += 1;
    return [{ id: `order-${String(counter).padStart(3, '0')}`, orderNumber: `ORD-${String(counter).padStart(3, '0')}` }];
  });
}

/**
 * Build a fake Engagement shape that mirrors what engagement.service.createEngagement
 * would return: each input item becomes one EngagementProperty with one embedded
 * clientOrder. The bulk service matches items to properties by loanNumber.
 */
function makeEngagementFor(items: Array<{ loanNumber?: string; rowIndex: number }>, jobId: string, engagementId: string) {
  return {
    id: engagementId,
    properties: items.map((item, i) => ({
      id: `prop-${i + 1}`,
      loanNumber: item.loanNumber ?? `bulk-${jobId}-${item.rowIndex}`,
      clientOrders: [{ id: `co-${i + 1}` }],
    })),
  };
}

describe('BulkPortfolioService.submit()', () => {
  // Phase B step 5: when an existing engagementId is supplied, the new
  // addVendorOrders path can't resolve clientOrder ids without fetching
  // the engagement. The service surfaces this as a per-item failure.
  it('persists the supplied engagementId on the job (existing-engagement flow currently fails items)', async () => {
    const { db, savedJobs } = makeDbService();
    const service = new BulkPortfolioService(db);

    const job = await service.submit(
      makeRequest({ engagementId: 'eng-001' }),
      'user-001',
      'tenant-001',
    );

    expect(job.engagementId).toBe('eng-001');
    expect(savedJobs[0]?.engagementId).toBe('eng-001');
    expect(job.failCount).toBeGreaterThan(0);
    expect(job.successCount).toBe(0);
  });

  it('creates one shared engagement for the batch when engagementGranularity is PER_BATCH', async () => {
    const { db, savedJobs } = makeDbService();
    const service = new BulkPortfolioService(db);

    const items = [
      makeItem({ rowIndex: 1, loanNumber: 'LN-001' }),
      makeItem({ rowIndex: 2, loanNumber: 'LN-002', propertyAddress: '456 Oak St' }),
    ];
    const fakeEngagement = makeEngagementFor(items, 'job-x', 'eng-batch-001');
    const createEngagement = vi.fn().mockResolvedValue(fakeEngagement);
    const addVendorOrders = makeAddVendorOrdersMock();
    (service as any)._engagementService = { createEngagement };
    (service as any)._clientOrderService = { addVendorOrders };

    const job = await service.submit(
      makeRequest({ engagementGranularity: 'PER_BATCH', items }),
      'user-001',
      'tenant-001',
    );

    expect(createEngagement).toHaveBeenCalledTimes(1);
    expect(addVendorOrders).toHaveBeenNthCalledWith(
      1,
      'co-1',
      'tenant-001',
      expect.any(Array),
      expect.objectContaining({ engagementId: 'eng-batch-001' }),
    );
    expect(addVendorOrders).toHaveBeenNthCalledWith(
      2,
      'co-2',
      'tenant-001',
      expect.any(Array),
      expect.objectContaining({ engagementId: 'eng-batch-001' }),
    );
    expect(job.engagementId).toBe('eng-batch-001');
    expect(job.engagementGranularity).toBe('PER_BATCH');
    expect(savedJobs[0]?.engagementId).toBe('eng-batch-001');
  });

  it('creates one engagement per valid row when engagementGranularity is PER_LOAN', async () => {
    const { db, savedJobs } = makeDbService();
    const service = new BulkPortfolioService(db);

    const items = [
      makeItem({ rowIndex: 1, loanNumber: 'LN-001' }),
      makeItem({ rowIndex: 2, loanNumber: 'LN-002', propertyAddress: '456 Oak St' }),
    ];
    const createEngagement = vi
      .fn()
      .mockResolvedValueOnce(makeEngagementFor([items[0]!], 'job-x', 'eng-loan-001'))
      .mockResolvedValueOnce(makeEngagementFor([items[1]!], 'job-x', 'eng-loan-002'));
    const addVendorOrders = makeAddVendorOrdersMock();
    (service as any)._engagementService = { createEngagement };
    (service as any)._clientOrderService = { addVendorOrders };

    const job = await service.submit(
      makeRequest({ engagementGranularity: 'PER_LOAN', items }),
      'user-001',
      'tenant-001',
    );

    expect(createEngagement).toHaveBeenCalledTimes(2);
    expect(addVendorOrders).toHaveBeenNthCalledWith(
      1,
      'co-1',
      'tenant-001',
      expect.any(Array),
      expect.objectContaining({ engagementId: 'eng-loan-001' }),
    );
    expect(addVendorOrders).toHaveBeenNthCalledWith(
      2,
      'co-1',
      'tenant-001',
      expect.any(Array),
      expect.objectContaining({ engagementId: 'eng-loan-002' }),
    );
    expect(job.engagementId).toBeUndefined();
    expect(job.engagementGranularity).toBe('PER_LOAN');
    expect(savedJobs[0]?.engagementGranularity).toBe('PER_LOAN');
  });

  it('rejects PER_LOAN granularity when an existing engagementId is provided', async () => {
    const { db } = makeDbService();
    const service = new BulkPortfolioService(db);

    await expect(
      service.submit(
        makeRequest({
          engagementId: 'eng-existing-001',
          engagementGranularity: 'PER_LOAN',
        }),
        'user-001',
        'tenant-001',
      ),
    ).rejects.toThrow(/PER_LOAN cannot be used when an existing engagementId is provided/);
  });
});
