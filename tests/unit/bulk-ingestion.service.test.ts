import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPublish = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

import { BulkIngestionService } from '../../src/services/bulk-ingestion.service.js';

describe('BulkIngestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeJobWithFailedItem(overrides?: Partial<any>) {
    return {
      id: 'bulk-ingest-001',
      type: 'bulk-ingestion-job',
      tenantId: 'tenant-001',
      clientId: 'client-001',
      ingestionMode: 'MULTIPART',
      status: 'FAILED',
      adapterKey: 'bridge-standard',
      dataFileName: 'tape.csv',
      documentFileNames: ['doc1.pdf'],
      submittedBy: 'user-001',
      submittedAt: new Date().toISOString(),
      totalItems: 1,
      successItems: 0,
      failedItems: 1,
      pendingItems: 0,
      items: [
        {
          id: 'bulk-ingest-001:1',
          jobId: 'bulk-ingest-001',
          tenantId: 'tenant-001',
          clientId: 'client-001',
          rowIndex: 1,
          correlationKey: 'bulk-ingest-001::1',
          status: 'FAILED',
          source: {
            rowIndex: 1,
            loanNumber: 'LN-001',
            documentFileName: 'doc1.pdf',
          },
          matchedDocumentFileNames: ['doc1.pdf'],
          failures: [
            {
              code: 'DOCUMENT_BLOB_NOT_FOUND',
              stage: 'artifact-resolution',
              message: 'missing document',
              retryable: true,
              occurredAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      ...overrides,
    };
  }

  it('returns canonicalization summary and records by jobId and tenantId', async () => {
    const queryItems = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'bulk-canonical-summary-bulk-ingest-001',
            type: 'bulk-ingestion-canonicalization-summary',
            tenantId: 'tenant-001',
            clientId: 'client-001',
            jobId: 'bulk-ingest-001',
            adapterKey: 'bridge-standard',
            totalCandidateItems: 2,
            persistedCount: 1,
            failedCount: 1,
            failures: [],
            processedAt: new Date().toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'bulk-canonical-bulk-ingest-001-1',
            type: 'bulk-ingestion-canonical-record',
            tenantId: 'tenant-001',
            clientId: 'client-001',
            jobId: 'bulk-ingest-001',
            itemId: 'bulk-ingest-001:1',
            rowIndex: 1,
            adapterKey: 'bridge-standard',
            canonicalData: { loanNumber: 'LN-001' },
            sourceData: { loanNumber: 'LN-001' },
            persistedAt: new Date().toISOString(),
          },
        ],
      });

    const db = { queryItems };
    const service = new BulkIngestionService(db as any);

    const result = await service.getCanonicalizationByJobId('bulk-ingest-001', 'tenant-001');

    expect(queryItems).toHaveBeenCalledTimes(2);
    expect(queryItems.mock.calls[0][0]).toBe('bulk-portfolio-jobs');
    expect(queryItems.mock.calls[1][0]).toBe('bulk-portfolio-jobs');

    expect(result.summary?.type).toBe('bulk-ingestion-canonicalization-summary');
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.type).toBe('bulk-ingestion-canonical-record');
  });

  it('exports bulk ingestion failures as CSV with header and rows', async () => {
    const job = makeJobWithFailedItem();
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
    };

    const service = new BulkIngestionService(db as any);
    const exported = await service.exportFailuresCsv('bulk-ingest-001', 'tenant-001');

    expect(exported.contentType).toBe('text/csv; charset=utf-8');
    expect(exported.fileName).toContain('bulk-ingestion-failures-bulk-ingest-001-');
    expect(typeof exported.content).toBe('string');
    expect(exported.content).toContain('jobId,itemId,rowIndex,itemStatus,failureStage,failureCode,failureMessage,retryable,occurredAt,loanNumber,externalId,documentFileName');
    expect(exported.content).toContain('bulk-ingest-001,bulk-ingest-001:1,1,FAILED,artifact-resolution,DOCUMENT_BLOB_NOT_FOUND,missing document,true');
  });

  it('exports bulk ingestion failures as XLSX binary', async () => {
    const job = makeJobWithFailedItem();
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
    };

    const service = new BulkIngestionService(db as any);
    const exported = await service.exportFailures('bulk-ingest-001', 'tenant-001', 'xlsx');

    expect(exported.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(exported.fileName).toContain('bulk-ingestion-failures-bulk-ingest-001-');
    expect(exported.fileName.endsWith('.xlsx')).toBe(true);
    expect(Buffer.isBuffer(exported.content)).toBe(true);
    expect((exported.content as Buffer).subarray(0, 2).toString()).toBe('PK');
  });

  it('listJobs returns lightweight summaries without selecting full item payloads', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'bulk-ingest-001',
            tenantId: 'tenant-001',
            clientId: 'client-001',
            status: 'COMPLETED',
            submittedAt: '2026-04-01T00:00:00.000Z',
            completedAt: '2026-04-01T00:10:00.000Z',
            totalItems: 100,
            successItems: 100,
            failedItems: 0,
            pendingItems: 0,
          },
        ],
      }),
    };

    const service = new BulkIngestionService(db as any);
    const jobs = await service.listJobs('tenant-001', 'client-001');

    expect(db.queryItems).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.stringContaining('SELECT c.id, c.tenantId, c.clientId, c.status, c.submittedAt, c.completedAt, c.totalItems, c.successItems, c.failedItems, c.pendingItems FROM c'),
      [
        { name: '@type', value: 'bulk-ingestion-job' },
        { name: '@tenantId', value: 'tenant-001' },
        { name: '@clientId', value: 'client-001' },
      ],
    );
    expect(jobs).toHaveLength(1);
    expect((jobs[0] as any).items).toBeUndefined();
  });

  it('lists failures with cursor-based pagination', async () => {
    const baseJob = makeJobWithFailedItem({
      items: [
        {
          ...makeJobWithFailedItem().items[0],
          id: 'bulk-ingest-001:2',
          rowIndex: 2,
          status: 'FAILED',
          source: {
            rowIndex: 2,
            loanNumber: 'LN-002',
            externalId: 'EXT-2',
            documentFileName: 'doc2.pdf',
          },
          failures: [
            {
              code: 'DOCUMENT_TIMEOUT',
              stage: 'artifact-resolution',
              message: 'timed out',
              retryable: true,
              occurredAt: '2026-01-01T00:00:01.000Z',
            },
          ],
        },
        {
          ...makeJobWithFailedItem().items[0],
          id: 'bulk-ingest-001:1',
          rowIndex: 1,
          status: 'FAILED',
          source: {
            rowIndex: 1,
            loanNumber: 'LN-001',
            externalId: 'EXT-1',
            documentFileName: 'doc1.pdf',
          },
          failures: [
            {
              code: 'DOCUMENT_BLOB_NOT_FOUND',
              stage: 'artifact-resolution',
              message: 'missing document',
              retryable: false,
              occurredAt: '2026-01-01T00:00:02.000Z',
            },
          ],
        },
      ],
    });

    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [baseJob] }),
    };

    const service = new BulkIngestionService(db as any);
    const firstPage = await service.listFailures('bulk-ingest-001', 'tenant-001', {
      stage: 'artifact-resolution',
      sort: 'rowIndex_asc',
      limit: 1,
    });

    expect(firstPage.jobId).toBe('bulk-ingest-001');
    expect(firstPage.total).toBe(2);
    expect(firstPage.limit).toBe(1);
    expect(firstPage.sort).toBe('rowIndex_asc');
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0]?.itemId).toBe('bulk-ingest-001:1');
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.prevCursor).toBeNull();
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await service.listFailures('bulk-ingest-001', 'tenant-001', {
      stage: 'artifact-resolution',
      sort: 'rowIndex_asc',
      limit: 1,
      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(secondPage.total).toBe(2);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.itemId).toBe('bulk-ingest-001:2');
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.prevCursor).toBeTruthy();
    expect(secondPage.nextCursor).toBeNull();
  });

  it('writes immutable submit audit event when creating a new bulk ingestion job', async () => {
    const db = {
      upsertItem: vi.fn().mockResolvedValue({
        success: true,
        data: makeJobWithFailedItem({
          id: 'bulk-ingest-created-1',
          status: 'PENDING',
          failedItems: 0,
          pendingItems: 1,
          successItems: 0,
          items: [
            {
              ...makeJobWithFailedItem().items[0],
              id: 'bulk-ingest-created-1:1',
              jobId: 'bulk-ingest-created-1',
              status: 'PENDING',
              failures: [],
            },
          ],
        }),
      }),
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new BulkIngestionService(db as any);

    await service.submit(
      {
        clientId: 'client-001',
        ingestionMode: 'MULTIPART',
        dataFileName: 'bulk.csv',
        documentFileNames: ['doc1.pdf'],
        adapterKey: 'bridge-standard',
        items: [{ rowIndex: 1, loanNumber: 'LN-001', documentFileName: 'doc1.pdf' }],
      },
      'tenant-001',
      'operator-001',
    );

    expect(db.createItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'bulk-ingestion-audit-event',
        action: 'SUBMIT',
        actorId: 'operator-001',
        immutable: true,
      }),
    );
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('retries a specific FAILED item and writes immutable operator audit event', async () => {
    const job = makeJobWithFailedItem();
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: job }),
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new BulkIngestionService(db as any);
    const updated = await service.retryItem('bulk-ingest-001', 'bulk-ingest-001:1', 'tenant-001', 'operator-123');

    expect(updated.items[0]?.status).toBe('PENDING');
    expect(updated.status).toBe('PROCESSING');
    expect(db.upsertItem).toHaveBeenCalledTimes(1);
    expect(db.createItem).toHaveBeenCalledTimes(1);
    expect(db.createItem.mock.calls[0][0]).toBe('bulk-portfolio-jobs');
    expect(db.createItem.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        type: 'bulk-ingestion-audit-event',
        action: 'RETRY_ITEM',
        actorId: 'operator-123',
        immutable: true,
      }),
    );
  });

  it('enforces stage-level retry policy and rejects retries when disabled', async () => {
    const job = makeJobWithFailedItem({
      items: [
        {
          ...makeJobWithFailedItem().items[0],
          failures: [
            {
              code: 'MISSING_IDENTIFIER',
              stage: 'validation',
              message: 'invalid row',
              retryable: true,
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      ],
    });

    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: job }),
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new BulkIngestionService(db as any);

    await expect(
      service.retryItem('bulk-ingest-001', 'bulk-ingest-001:1', 'tenant-001', 'operator-123'),
    ).rejects.toThrow("Retry is disabled for stage 'validation'");
  });

  it('bulk retry only retries allowed items and writes immutable audit event', async () => {
    const job = {
      ...makeJobWithFailedItem(),
      totalItems: 2,
      failedItems: 2,
      items: [
        makeJobWithFailedItem().items[0],
        {
          ...makeJobWithFailedItem().items[0],
          id: 'bulk-ingest-001:2',
          rowIndex: 2,
          failures: [
            {
              code: 'MISSING_IDENTIFIER',
              stage: 'validation',
              message: 'invalid row',
              retryable: true,
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      ],
    };

    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: job }),
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new BulkIngestionService(db as any);
    const updated = await service.retryFailedItems('bulk-ingest-001', 'tenant-001', 'operator-321');

    const item1 = updated.items.find((item) => item.id === 'bulk-ingest-001:1');
    const item2 = updated.items.find((item) => item.id === 'bulk-ingest-001:2');

    expect(item1?.status).toBe('PENDING');
    expect(item2?.status).toBe('FAILED');
    expect(item2?.failures.some((f: any) => f.code === 'RETRY_REJECTED')).toBe(true);
    expect(db.createItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'bulk-ingestion-audit-event',
        action: 'RETRY_FAILED_ITEMS',
        actorId: 'operator-321',
      }),
    );
  });

  it('pauses a PROCESSING job and writes immutable audit event', async () => {
    const job = makeJobWithFailedItem({
      status: 'PROCESSING',
      failedItems: 0,
      pendingItems: 1,
      items: [
        {
          ...makeJobWithFailedItem().items[0],
          status: 'PROCESSING',
          failures: [],
        },
      ],
    });

    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: job }),
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new BulkIngestionService(db as any);
    const updated = await service.pauseJob('bulk-ingest-001', 'tenant-001', 'operator-77');

    expect(updated.status).toBe('PAUSED');
    expect(updated.items[0]?.status).toBe('PENDING');
    expect(db.createItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'bulk-ingestion-audit-event',
        action: 'PAUSE_JOB',
        actorId: 'operator-77',
      }),
    );
  });

  it('resumes a PAUSED job and computes next status from items', async () => {
    const job = makeJobWithFailedItem({
      status: 'PAUSED',
      failedItems: 0,
      pendingItems: 1,
      items: [
        {
          ...makeJobWithFailedItem().items[0],
          status: 'PENDING',
          failures: [],
        },
      ],
    });

    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: job }),
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new BulkIngestionService(db as any);
    const updated = await service.resumeJob('bulk-ingest-001', 'tenant-001', 'operator-88');

    expect(updated.status).toBe('PROCESSING');
    expect(db.createItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'bulk-ingestion-audit-event',
        action: 'RESUME_JOB',
        actorId: 'operator-88',
      }),
    );
  });

  it('cancels an active job, marks pending items cancelled, and writes immutable audit event', async () => {
    const job = makeJobWithFailedItem({
      status: 'PENDING',
      failedItems: 0,
      pendingItems: 1,
      items: [
        {
          ...makeJobWithFailedItem().items[0],
          status: 'PENDING',
          failures: [],
        },
      ],
    });

    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: job }),
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new BulkIngestionService(db as any);
    const updated = await service.cancelJob('bulk-ingest-001', 'tenant-001', 'operator-99');

    expect(updated.status).toBe('CANCELLED');
    expect(updated.pendingItems).toBe(0);
    expect(updated.items[0]?.status).toBe('CANCELLED');
    expect(db.createItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'bulk-ingestion-audit-event',
        action: 'CANCEL_JOB',
        actorId: 'operator-99',
      }),
    );
  });

  it('rejects pause when job is already terminal', async () => {
    const job = makeJobWithFailedItem({ status: 'COMPLETED' });
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
    };

    const service = new BulkIngestionService(db as any);
    await expect(service.pauseJob('bulk-ingest-001', 'tenant-001', 'operator-1')).rejects.toThrow(
      "Cannot pause job from status 'COMPLETED'",
    );
  });
});
