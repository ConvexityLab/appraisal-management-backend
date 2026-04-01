import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
const mockPublish = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

import { BulkIngestionCanonicalWorkerService } from '../../src/services/bulk-ingestion-canonical-worker.service.js';

describe('BulkIngestionCanonicalWorkerService', () => {
  const jobId = 'bulk-ingest-001';
  const tenantId = 'tenant-001';
  const clientId = 'client-001';

  function makeProcessedEvent(overrides?: Partial<any>) {
    return {
      id: 'evt-001',
      type: 'bulk.ingestion.processed',
      timestamp: new Date(),
      source: 'bulk-ingestion-processor-service',
      version: '1.0',
      category: 'document',
      data: {
        jobId,
        tenantId,
        clientId,
        adapterKey: 'bridge-standard',
        ingestionMode: 'MULTIPART',
        status: 'COMPLETED',
        totalItems: 1,
        successItems: 1,
        failedItems: 0,
        completedAt: new Date().toISOString(),
        priority: 'normal',
        ...overrides,
      },
    } as any;
  }

  function makeJob(overrides?: Partial<any>) {
    return {
      id: jobId,
      type: 'bulk-ingestion-job',
      tenantId,
      clientId,
      ingestionMode: 'MULTIPART',
      status: 'COMPLETED',
      adapterKey: 'bridge-standard',
      dataFileName: 'tape.csv',
      dataFileBlobName: 'bulk-ingestion/tenant-001/123/data/tape.csv',
      documentFileNames: ['doc1.pdf'],
      documentBlobMap: {
        'doc1.pdf': 'bulk-ingestion/tenant-001/123/document/doc1.pdf',
      },
      submittedBy: 'user-001',
      submittedAt: new Date().toISOString(),
      totalItems: 1,
      successItems: 1,
      failedItems: 0,
      pendingItems: 0,
      completedAt: new Date().toISOString(),
      items: [
        {
          id: `${jobId}:1`,
          jobId,
          tenantId,
          clientId,
          rowIndex: 1,
          correlationKey: `${jobId}::LN-001`,
          status: 'COMPLETED',
          source: {
            rowIndex: 1,
            loanNumber: 'LN-001',
            externalId: 'EXT-001',
            propertyAddress: '123 Main St',
            documentFileName: 'doc1.pdf',
          },
          matchedDocumentFileNames: ['doc1.pdf'],
          failures: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      ...overrides,
    };
  }

  function makeDbStub(job: any) {
    return {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
      upsertItem: vi.fn().mockImplementation((_container: string, doc: any) =>
        Promise.resolve({ success: true, data: doc }),
      ),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists canonical records and summary for bridge-standard adapter', async () => {
    const db = makeDbStub(makeJob());
    const service = new BulkIngestionCanonicalWorkerService(db as any);

    await (service as any).onBulkIngestionProcessed(makeProcessedEvent());

    expect(db.upsertItem).toHaveBeenCalledTimes(2);
    const canonicalRecord = db.upsertItem.mock.calls[0][1];
    const summary = db.upsertItem.mock.calls[1][1];

    expect(canonicalRecord.type).toBe('bulk-ingestion-canonical-record');
    expect(canonicalRecord.adapterKey).toBe('bridge-standard');
    expect(canonicalRecord.documentBlobName).toContain('/document/doc1.pdf');

    expect(summary.type).toBe('bulk-ingestion-canonicalization-summary');
    expect(summary.persistedCount).toBe(1);
    expect(summary.failedCount).toBe(0);

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bulk.ingestion.canonicalized',
        data: expect.objectContaining({
          jobId,
          adapterKey: 'bridge-standard',
          persistedCount: 1,
          failedCount: 0,
        }),
      }),
    );
  });

  it('records adapter validation failures in summary for unsupported adapter', async () => {
    const db = makeDbStub(makeJob({ adapterKey: 'unknown-adapter' }));
    const service = new BulkIngestionCanonicalWorkerService(db as any);

    await (service as any).onBulkIngestionProcessed(
      makeProcessedEvent({ adapterKey: 'unknown-adapter' }),
    );

    expect(db.upsertItem).toHaveBeenCalledTimes(1);
    const summary = db.upsertItem.mock.calls[0][1];
    expect(summary.type).toBe('bulk-ingestion-canonicalization-summary');
    expect(summary.persistedCount).toBe(0);
    expect(summary.failedCount).toBe(1);
    expect(summary.failures[0].code).toBe('UNSUPPORTED_ADAPTER');
    expect(summary.failures[0].stage).toBe('adapter-registry');
    expect(summary.failures[0].diagnostics.supportedAdapters).toEqual(
      expect.arrayContaining(['bridge-standard', 'bpo-report-v1']),
    );

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bulk.ingestion.canonicalized',
        data: expect.objectContaining({
          failedCount: 1,
        }),
      }),
    );
  });

  it('skips canonicalization when processed event status is FAILED', async () => {
    const db = makeDbStub(makeJob());
    const service = new BulkIngestionCanonicalWorkerService(db as any);

    await (service as any).onBulkIngestionProcessed(
      makeProcessedEvent({ status: 'FAILED', successItems: 0, failedItems: 1 }),
    );

    expect(db.queryItems).not.toHaveBeenCalled();
    expect(db.upsertItem).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
