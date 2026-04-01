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

import { BulkIngestionProcessorService } from '../../src/services/bulk-ingestion-processor.service.js';

describe('BulkIngestionProcessorService', () => {
  const tenantId = 'tenant-001';
  const clientId = 'client-001';
  const jobId = 'bulk-ingest-001';

  const makeBaseJob = () => ({
    id: jobId,
    type: 'bulk-ingestion-job' as const,
    tenantId,
    clientId,
    ingestionMode: 'MULTIPART' as const,
    status: 'PENDING' as const,
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
    successItems: 0,
    failedItems: 0,
    pendingItems: 1,
    items: [
      {
        id: `${jobId}:1`,
        jobId,
        tenantId,
        clientId,
        rowIndex: 1,
        correlationKey: `${jobId}::1`,
        status: 'PENDING' as const,
        source: {
          rowIndex: 1,
          loanNumber: 'LN-001',
          documentFileName: 'doc1.pdf',
        },
        matchedDocumentFileNames: ['doc1.pdf'],
        failures: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  function makeDbStub(jobOverride?: any) {
    const job = { ...makeBaseJob(), ...(jobOverride ?? {}) };
    return {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [job] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: job }),
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };
  }

  function makeEvent(overrides?: Partial<any>) {
    return {
      id: 'evt-001',
      type: 'bulk.ingestion.requested',
      timestamp: new Date(),
      source: 'test',
      version: '1.0',
      category: 'document',
      data: {
        jobId,
        tenantId,
        clientId,
        ingestionMode: 'MULTIPART',
        adapterKey: 'bridge-standard',
        dataFileName: 'tape.csv',
        dataFileBlobName: 'bulk-ingestion/tenant-001/123/data/tape.csv',
        documentFileNames: ['doc1.pdf'],
        priority: 'normal',
        ...overrides,
      },
    } as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORAGE_CONTAINER_DOCUMENTS = 'appraisal-documents';
  });

  it('marks multipart items as COMPLETED when document artifacts match', async () => {
    const db = makeDbStub();
    const blobService = { uploadBlob: vi.fn() } as any;
    const service = new BulkIngestionProcessorService(db as any, blobService);

    await (service as any).onBulkIngestionRequested(makeEvent());

    expect(db.queryItems).toHaveBeenCalled();
    expect(db.upsertItem).toHaveBeenCalledTimes(1);
    expect(db.createItem).not.toHaveBeenCalled();

    const persistedJob = db.upsertItem.mock.calls[0][1];
    expect(persistedJob.status).toBe('COMPLETED');
    expect(persistedJob.successItems).toBe(1);
    expect(persistedJob.failedItems).toBe(0);
    expect(persistedJob.items[0].status).toBe('COMPLETED');
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bulk.ingestion.processed',
        data: expect.objectContaining({
          jobId,
          tenantId,
          status: 'COMPLETED',
          successItems: 1,
          failedItems: 0,
        }),
      }),
    );
    expect(persistedJob.items[0].canonicalRecord).toEqual(
      expect.objectContaining({
        loanNumber: 'LN-001',
        adapterKey: 'bridge-standard',
      }),
    );
  });

  it('copies shared storage artifacts and completes the job', async () => {
    const db = makeDbStub({
      ingestionMode: 'SHARED_STORAGE',
      dataFileBlobName: undefined,
      dataFileName: 'incoming/tape.csv',
      documentFileNames: [],
      documentBlobMap: {},
      items: [
        {
          ...makeBaseJob().items[0],
          source: {
            rowIndex: 1,
            externalId: 'EXT-001',
            documentFileName: 'doc-shared.pdf',
          },
        },
      ],
    });

    const blobService = {
      uploadBlob: vi.fn().mockImplementation(async (request: any) => ({
        blobName: request.blobName,
        url: `https://storage.example/${request.blobName}`,
      })),
    } as any;

    const service = new BulkIngestionProcessorService(db as any, blobService);
    vi.spyOn(service as any, 'downloadBlobFromAccount').mockResolvedValue(Buffer.from('file-data'));

    await (service as any).onBulkIngestionRequested(
      makeEvent({
        ingestionMode: 'SHARED_STORAGE',
        sharedStorage: {
          storageAccountName: 'sharedacct',
          containerName: 'incoming',
          dataFileBlobName: 'incoming/tape.csv',
          documentBlobNames: ['incoming/doc-shared.pdf'],
        },
      }),
    );

    expect(blobService.uploadBlob).toHaveBeenCalledTimes(2);
    const persistedJob = db.upsertItem.mock.calls[0][1];
    expect(persistedJob.status).toBe('COMPLETED');
    expect(persistedJob.dataFileBlobName).toContain('/copied/data/');
    expect(persistedJob.documentBlobMap['doc-shared.pdf']).toContain('/copied/document/');
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bulk.ingestion.processed',
        data: expect.objectContaining({
          status: 'COMPLETED',
          ingestionMode: 'SHARED_STORAGE',
        }),
      }),
    );
  });

  it('marks the job FAILED when an item references a missing document blob', async () => {
    const db = makeDbStub({
      documentBlobMap: {
        'other.pdf': 'bulk-ingestion/tenant-001/123/document/other.pdf',
      },
    });
    const blobService = { uploadBlob: vi.fn() } as any;
    const service = new BulkIngestionProcessorService(db as any, blobService);

    await (service as any).onBulkIngestionRequested(makeEvent());

    const persistedJob = db.upsertItem.mock.calls[0][1];
    expect(persistedJob.status).toBe('FAILED');
    expect(persistedJob.failedItems).toBe(1);
    expect(persistedJob.items[0].failures.some((f: any) => f.code === 'DOCUMENT_BLOB_NOT_FOUND')).toBe(true);
    expect(db.createItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'bulk-ingestion-manual-review-item',
        reasonCode: 'DOCUMENT_NOT_FOUND',
      }),
    );
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bulk.ingestion.processed',
        data: expect.objectContaining({
          status: 'FAILED',
          failedItems: 1,
        }),
      }),
    );
  });

  it('queues manual review when document association is ambiguous', async () => {
    const db = makeDbStub({
      documentBlobMap: {
        'incoming/a/doc1.pdf': 'bulk-ingestion/tenant-001/a/document/doc1.pdf',
        'incoming/b/doc1.pdf': 'bulk-ingestion/tenant-001/b/document/doc1.pdf',
      },
    });
    const blobService = { uploadBlob: vi.fn() } as any;
    const service = new BulkIngestionProcessorService(db as any, blobService);

    await (service as any).onBulkIngestionRequested(makeEvent());

    const persistedJob = db.upsertItem.mock.calls[0][1];
    expect(persistedJob.status).toBe('FAILED');
    expect(
      persistedJob.items[0].failures.some((f: any) => f.code === 'DOCUMENT_ASSOCIATION_AMBIGUOUS'),
    ).toBe(true);
    expect(db.createItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'bulk-ingestion-manual-review-item',
        reasonCode: 'DOCUMENT_ASSOCIATION_AMBIGUOUS',
        candidateDocumentBlobNames: expect.arrayContaining([
          'bulk-ingestion/tenant-001/a/document/doc1.pdf',
          'bulk-ingestion/tenant-001/b/document/doc1.pdf',
        ]),
      }),
    );
  });
});
