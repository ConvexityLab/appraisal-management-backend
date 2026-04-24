/**
 * BulkPortfolioService.submit() — engagement association unit tests
 */

import { describe, it, expect, vi } from 'vitest';
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

function makeDbService() {
  const savedJobs: BulkPortfolioJob[] = [];
  const createOrder = vi.fn().mockResolvedValue({
    success: true,
    data: { id: 'order-001', orderNumber: 'ORD-001' },
  });

  const container = {
    items: {
      upsert: async (job: BulkPortfolioJob) => {
        savedJobs.push(job);
        return { resource: job };
      },
    },
  };

  const db = {
    createOrder,
    getBulkPortfolioJobsContainer: () => container,
  } as unknown as CosmosDbService;

  return { db, createOrder, savedJobs };
}

describe('BulkPortfolioService.submit()', () => {
  it('passes engagementId into created orders and persists it on the bulk job', async () => {
    const { db, createOrder, savedJobs } = makeDbService();
    const service = new BulkPortfolioService(db);

    const job = await service.submit(
      makeRequest({ engagementId: 'eng-001' }),
      'user-001',
      'tenant-001',
    );

    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        engagementId: 'eng-001',
      }),
    );
    expect(job.engagementId).toBe('eng-001');
    expect(savedJobs[0]?.engagementId).toBe('eng-001');
  });

  it('creates one shared engagement for the batch when engagementGranularity is PER_BATCH', async () => {
    const { db, createOrder, savedJobs } = makeDbService();
    const service = new BulkPortfolioService(db);
    const createEngagement = vi.fn().mockResolvedValue({ id: 'eng-batch-001' });
    (service as any)._engagementService = { createEngagement };

    const job = await service.submit(
      makeRequest({
        engagementGranularity: 'PER_BATCH',
        items: [
          makeItem({ rowIndex: 1, loanNumber: 'LN-001' }),
          makeItem({ rowIndex: 2, loanNumber: 'LN-002', propertyAddress: '456 Oak St' }),
        ],
      }),
      'user-001',
      'tenant-001',
    );

    expect(createEngagement).toHaveBeenCalledTimes(1);
    expect(createOrder).toHaveBeenNthCalledWith(1, expect.objectContaining({ engagementId: 'eng-batch-001' }));
    expect(createOrder).toHaveBeenNthCalledWith(2, expect.objectContaining({ engagementId: 'eng-batch-001' }));
    expect(job.engagementId).toBe('eng-batch-001');
    expect(job.engagementGranularity).toBe('PER_BATCH');
    expect(savedJobs[0]?.engagementId).toBe('eng-batch-001');
  });

  it('creates one engagement per valid row when engagementGranularity is PER_LOAN', async () => {
    const { db, createOrder, savedJobs } = makeDbService();
    const service = new BulkPortfolioService(db);
    const createEngagement = vi
      .fn()
      .mockResolvedValueOnce({ id: 'eng-loan-001' })
      .mockResolvedValueOnce({ id: 'eng-loan-002' });
    (service as any)._engagementService = { createEngagement };

    const job = await service.submit(
      makeRequest({
        engagementGranularity: 'PER_LOAN',
        items: [
          makeItem({ rowIndex: 1, loanNumber: 'LN-001' }),
          makeItem({ rowIndex: 2, loanNumber: 'LN-002', propertyAddress: '456 Oak St' }),
        ],
      }),
      'user-001',
      'tenant-001',
    );

    expect(createEngagement).toHaveBeenCalledTimes(2);
    expect(createOrder).toHaveBeenNthCalledWith(1, expect.objectContaining({ engagementId: 'eng-loan-001' }));
    expect(createOrder).toHaveBeenNthCalledWith(2, expect.objectContaining({ engagementId: 'eng-loan-002' }));
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
