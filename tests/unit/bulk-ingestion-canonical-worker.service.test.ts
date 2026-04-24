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
    const tenantAdapterDefinitions: any[] = [];
    return {
      queryItems: vi.fn().mockImplementation(async (_container: string, _query: string, parameters?: any[]) => {
        const type = parameters?.find((entry: any) => entry.name === '@type')?.value;
        if (type === 'bulk-ingestion-job') {
          return { success: true, data: [job] };
        }
        if (type === 'bulk-adapter-definition') {
          return { success: true, data: tenantAdapterDefinitions };
        }
        return { success: true, data: [] };
      }),
      upsertItem: vi.fn().mockImplementation((_container: string, doc: any) =>
        Promise.resolve({ success: true, data: doc }),
      ),
      __tenantAdapterDefinitions: tenantAdapterDefinitions,
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

  it('persists canonical records for statebridge adapter (exact key)', async () => {
    const job = makeJob({
      adapterKey: 'statebridge',
      documentBlobMap: { 'doc1.pdf': 'bulk-ingestion/tenant-001/123/document/doc1.pdf' },
    });
    const db = makeDbStub(job);
    const service = new BulkIngestionCanonicalWorkerService(db as any);

    await (service as any).onBulkIngestionProcessed(
      makeProcessedEvent({ adapterKey: 'statebridge' }),
    );

    expect(db.upsertItem).toHaveBeenCalledTimes(2);
    const canonicalRecord = db.upsertItem.mock.calls[0][1];
    const summary = db.upsertItem.mock.calls[1][1];

    expect(canonicalRecord.type).toBe('bulk-ingestion-canonical-record');
    expect(canonicalRecord.adapterKey).toBe('statebridge');
    expect(canonicalRecord.documentBlobName).toContain('/document/doc1.pdf');
    expect(canonicalRecord.canonicalData.sourceAdapter).toBe('statebridge');

    expect(summary.persistedCount).toBe(1);
    expect(summary.failedCount).toBe(0);
  });

  it('persists canonical records for statebridge adapter with run-id suffix (prefix match)', async () => {
    const runSuffix = 'mngvr5xl';
    const adapterKey = `statebridge-${runSuffix}`;
    const job = makeJob({
      adapterKey,
      documentBlobMap: { 'doc1.pdf': 'bulk-ingestion/tenant-001/123/document/doc1.pdf' },
    });
    const db = makeDbStub(job);
    const service = new BulkIngestionCanonicalWorkerService(db as any);

    await (service as any).onBulkIngestionProcessed(makeProcessedEvent({ adapterKey }));

    expect(db.upsertItem).toHaveBeenCalledTimes(2);
    const canonicalRecord = db.upsertItem.mock.calls[0][1];
    const summary = db.upsertItem.mock.calls[1][1];

    expect(canonicalRecord.type).toBe('bulk-ingestion-canonical-record');
    expect(canonicalRecord.adapterKey).toBe(adapterKey);
    expect(canonicalRecord.canonicalData.sourceAdapter).toBe('statebridge');

    expect(summary.persistedCount).toBe(1);
    expect(summary.failedCount).toBe(0);
  });

  it('reports STATEBRIDGE_ID_REQUIRED when statebridge item has no loanNumber or externalId', async () => {
    const adapterKey = 'statebridge-abc12345';
    const job = makeJob({
      adapterKey,
      documentBlobMap: { 'doc1.pdf': 'bulk-ingestion/tenant-001/123/document/doc1.pdf' },
      items: [
        {
          id: 'bulk-ingest-001:1',
          jobId: 'bulk-ingest-001',
          rowIndex: 1,
          correlationKey: 'bulk-ingest-001::row1',
          status: 'COMPLETED',
          source: {
            rowIndex: 1,
            loanNumber: '',
            externalId: '',
            documentFileName: 'doc1.pdf',
          },
          matchedDocumentFileNames: ['doc1.pdf'],
          failures: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const db = makeDbStub(job);
    const service = new BulkIngestionCanonicalWorkerService(db as any);

    await (service as any).onBulkIngestionProcessed(makeProcessedEvent({ adapterKey }));

    const summary = db.upsertItem.mock.calls[0][1];
    expect(summary.persistedCount).toBe(0);
    expect(summary.failedCount).toBe(1);
    expect(summary.failures[0].code).toBe('STATEBRIDGE_ID_REQUIRED');
  });

  it('persists canonical records for tape-conversion adapter without documents', async () => {
    const adapterKey = 'tape-conversion-v1';
    const job = makeJob({
      adapterKey,
      ingestionMode: 'TAPE_CONVERSION',
      dataFileBlobName: undefined,
      documentFileNames: [],
      documentBlobMap: {},
      items: [
        {
          id: `${jobId}:1`,
          jobId,
          tenantId,
          clientId,
          rowIndex: 1,
          correlationKey: `${jobId}::LN-TAPE-001`,
          status: 'COMPLETED',
          source: {
            rowIndex: 1,
            loanNumber: 'LN-TAPE-001',
            propertyAddress: '789 Pine Rd',
            city: 'Phoenix',
            state: 'AZ',
            zipCode: '85004',
          },
          matchedDocumentFileNames: [],
          failures: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const db = makeDbStub(job);
    const service = new BulkIngestionCanonicalWorkerService(db as any);

    await (service as any).onBulkIngestionProcessed(
      makeProcessedEvent({ adapterKey, ingestionMode: 'TAPE_CONVERSION' }),
    );

    expect(db.upsertItem).toHaveBeenCalledTimes(2);
    const canonicalRecord = db.upsertItem.mock.calls[0][1];
    const summary = db.upsertItem.mock.calls[1][1];

    expect(canonicalRecord.adapterKey).toBe(adapterKey);
    expect(canonicalRecord.canonicalData.sourceAdapter).toBe('tape-conversion-v1');
    expect(canonicalRecord.documentBlobName).toBeUndefined();
    expect(summary.persistedCount).toBe(1);
    expect(summary.failedCount).toBe(0);
  });

  it('loads tenant-defined adapter definitions from persistence', async () => {
    const adapterKey = 'custom-appraisal-v1';
    const job = makeJob({
      adapterKey,
      items: [
        {
          id: `${jobId}:1`,
          jobId,
          tenantId,
          clientId,
          rowIndex: 1,
          correlationKey: `${jobId}::LN-CUSTOM-001`,
          status: 'COMPLETED',
          source: {
            rowIndex: 1,
            loanNumber: 'LN-CUSTOM-001',
            propertyAddress: '123 Main St',
            documentFileName: 'doc1.pdf',
          },
          matchedDocumentFileNames: ['doc1.pdf'],
          failures: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const db = makeDbStub(job);
    db.__tenantAdapterDefinitions.push({
      id: `bulk-adapter-definition:${tenantId}:${adapterKey}`,
      type: 'bulk-adapter-definition',
      tenantId,
      adapterKey,
      name: 'Custom Appraisal',
      matchMode: 'EXACT',
      sourceAdapter: adapterKey,
      documentRequirement: {
        required: true,
        code: 'CUSTOM_DOCUMENT_REQUIRED',
        messageTemplate: "custom-appraisal-v1 requires mapped document blob for item '{itemId}'",
      },
      requiredFields: [
        {
          source: 'item.source.propertyAddress',
          code: 'CUSTOM_ADDRESS_REQUIRED',
          messageTemplate: "custom-appraisal-v1 requires propertyAddress (item '{itemId}')",
        },
      ],
      canonicalFieldMappings: [
        { targetField: 'correlationKey', source: 'item.correlationKey' },
        { targetField: 'loanNumber', source: 'item.source.loanNumber' },
        { targetField: 'propertyAddress', source: 'item.source.propertyAddress' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const service = new BulkIngestionCanonicalWorkerService(db as any);

    await (service as any).onBulkIngestionProcessed(makeProcessedEvent({ adapterKey }));

    expect(db.upsertItem).toHaveBeenCalledTimes(2);
    const canonicalRecord = db.upsertItem.mock.calls[0][1];
    expect(canonicalRecord.adapterKey).toBe(adapterKey);
    expect(canonicalRecord.canonicalData.sourceAdapter).toBe(adapterKey);
    expect(canonicalRecord.canonicalData.propertyAddress).toBe('123 Main St');
  });

  it('persists canonical records for fnma-1004-v1 built-in adapter', async () => {
    const adapterKey = 'fnma-1004-v1';
    const job = makeJob({
      adapterKey,
      items: [
        {
          id: `${jobId}:1`,
          jobId,
          tenantId,
          clientId,
          rowIndex: 1,
          correlationKey: `${jobId}::LN-1004-001`,
          status: 'COMPLETED',
          source: {
            rowIndex: 1,
            loanNumber: 'LN-1004-001',
            propertyAddress: '456 Oak Ave',
            city: 'Dallas',
            state: 'TX',
            zipCode: '75201',
            propertyType: 'SFR',
            loanAmount: 450000,
            loanPurpose: 'Purchase',
            occupancyType: 'Primary',
            documentFileName: 'doc1.pdf',
          },
          matchedDocumentFileNames: ['doc1.pdf'],
          failures: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const db = makeDbStub(job);
    const service = new BulkIngestionCanonicalWorkerService(db as any);

    await (service as any).onBulkIngestionProcessed(makeProcessedEvent({ adapterKey }));

    const canonicalRecord = db.upsertItem.mock.calls[0][1];
    expect(canonicalRecord.canonicalData.sourceAdapter).toBe('fnma-1004-v1');
    expect(canonicalRecord.canonicalData.appraisalForm).toBe('FNMA_1004');
    expect(canonicalRecord.canonicalData.loanAmount).toBe(450000);
  });
});
