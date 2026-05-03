import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Service Bus mocks ────────────────────────────────────────────────────────

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

// ── Axiom service mock ────────────────────────────────────────────────────────

const mockSubmitCriteriaReevaluation = vi.fn();
const mockWatchOrderPipelineStream = vi.fn();

vi.mock('../../src/services/axiom.service.js', () => ({
  AxiomService: vi.fn().mockImplementation(() => ({
    submitCriteriaReevaluation: mockSubmitCriteriaReevaluation,
    watchOrderPipelineStream: mockWatchOrderPipelineStream,
  })),
}));

import { BulkIngestionCriteriaWorkerService } from '../../src/services/bulk-ingestion-criteria-worker.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const JOB_ID = 'job-crit-001';
const TENANT_ID = 'tenant-001';
const CLIENT_ID = 'client-001';
const ITEM_ID = 'item-001';
const ORDER_ID = 'order-001';
const PIPELINE_JOB_ID = 'pjob-axiom-001';
const EVALUATION_ID = 'eval-001';

function makeExtractionCompletedEvent(overrides?: Record<string, unknown>) {
  return {
    id: 'evt-001',
    type: 'bulk.ingestion.extraction.completed',
    timestamp: new Date(),
    source: 'extraction-worker',
    version: '1.0',
    category: 'document',
    data: {
      jobId: JOB_ID,
      tenantId: TENANT_ID,
      clientId: CLIENT_ID,
      itemId: ITEM_ID,
      rowIndex: 0,
      correlationId: 'corr-001',
      status: 'completed',
      completedAt: new Date().toISOString(),
      priority: 'normal',
      ...overrides,
    },
  } as any;
}

function makeJob(itemOverrides?: Record<string, unknown>, jobOverrides?: Record<string, unknown>) {
  return {
    id: JOB_ID,
    type: 'bulk-ingestion-job',
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    subClientId: 'sub-001',
    analysisType: 'AVM',
    ingestionMode: 'MULTIPART',
    engagementGranularity: 'PER_LOAN',
    status: 'PROCESSING',
    adapterKey: 'bridge-standard',
    dataFileName: 'tape.csv',
    documentFileNames: ['doc.pdf'],
    submittedBy: 'user-001',
    submittedAt: new Date().toISOString(),
    totalItems: 1,
    successItems: 0,
    failedItems: 0,
    pendingItems: 1,
    items: [
      {
        id: ITEM_ID,
        jobId: JOB_ID,
        tenantId: TENANT_ID,
        clientId: CLIENT_ID,
        rowIndex: 0,
        correlationKey: 'row-0',
        status: 'PROCESSING',
        source: {},
        matchedDocumentFileNames: [],
        failures: [],
        canonicalRecord: {
          orderId: ORDER_ID,
          axiomPipelineJobId: 'pjob-extract-001',
        },
        ...itemOverrides,
      },
    ],
    ...jobOverrides,
  } as any;
}

function makeDbService(jobOverride?: any) {
  return {
    queryItems: vi.fn().mockImplementation((_container: string, query: string) => {
      // loadCriteriaConfig uses ORDER BY c.clientId DESC — return empty to skip local rules.
      if (query.includes('clientId DESC')) {
        return Promise.resolve({ success: true, data: [] });
      }
      // All other queries (job load) return the job.
      return Promise.resolve({ success: true, data: [jobOverride ?? makeJob()] });
    }),
    upsertItem: vi.fn().mockResolvedValue({ success: true }),
  } as any;
}

// Pull out the registered handler from the subscribe mock.
function getExtractionHandler() {
  const [, handler] = mockSubscribe.mock.calls[0] as [string, any];
  return handler;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BulkIngestionCriteriaWorkerService — T3.4 (Axiom criteria path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure criteria stage is enabled.
    vi.stubEnv('BULK_INGESTION_ENABLE_CRITERIA_STAGE', 'true');
  });

  it('submits criteria to Axiom when programId and orderId are present', async () => {
    mockSubmitCriteriaReevaluation.mockResolvedValue({
      pipelineJobId: PIPELINE_JOB_ID,
      evaluationId: EVALUATION_ID,
    });

    const svc = new BulkIngestionCriteriaWorkerService(makeDbService());
    await svc.start();

    const handler = getExtractionHandler();
    await handler.handle(makeExtractionCompletedEvent());

    expect(mockSubmitCriteriaReevaluation).toHaveBeenCalledOnce();
    expect(mockSubmitCriteriaReevaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        tenantId: TENANT_ID,
        clientId: CLIENT_ID,
        programId: 'FNMA-URAR',
        programVersion: '1.0.0',
        fileSetId: 'fs-pjob-extract-001',
      }),
    );

    expect(mockWatchOrderPipelineStream).toHaveBeenCalledWith(PIPELINE_JOB_ID, ORDER_ID);

    expect(mockPublish).toHaveBeenCalledOnce();
    const publishedEvent = mockPublish.mock.calls[0][0] as any;
    expect(publishedEvent.data.status).toBe('completed');
    expect(publishedEvent.data.criteriaStatus).toBe('completed');
    expect(publishedEvent.data.reason).toContain(PIPELINE_JOB_ID);
  });

  it('stamps axiomCriteriaPipelineJobId and axiomCriteriaEvaluationId on the item', async () => {
    mockSubmitCriteriaReevaluation.mockResolvedValue({
      pipelineJobId: PIPELINE_JOB_ID,
      evaluationId: EVALUATION_ID,
    });
    const db = makeDbService();

    const svc = new BulkIngestionCriteriaWorkerService(db);
    await svc.start();

    const handler = getExtractionHandler();
    await handler.handle(makeExtractionCompletedEvent());

    expect(db.upsertItem).toHaveBeenCalledOnce();
    const savedJob = (db.upsertItem.mock.calls[0] as [string, any])[1];
    const savedItem = savedJob.items.find((i: any) => i.id === ITEM_ID);
    expect(savedItem?.canonicalRecord?.['axiomCriteriaPipelineJobId']).toBe(PIPELINE_JOB_ID);
    expect(savedItem?.canonicalRecord?.['axiomCriteriaEvaluationId']).toBe(EVALUATION_ID);
  });

  it('falls through to local rules when Axiom returns null (mock/disabled mode)', async () => {
    // Axiom disabled → returns null.
    mockSubmitCriteriaReevaluation.mockResolvedValue(null);

    const db = makeDbService(); // no criteria config → auto-PASS via local rules
    const svc = new BulkIngestionCriteriaWorkerService(db);
    await svc.start();

    const handler = getExtractionHandler();
    await handler.handle(makeExtractionCompletedEvent());

    // watchOrderPipelineStream must NOT have been called.
    expect(mockWatchOrderPipelineStream).not.toHaveBeenCalled();

    // Local rules path publishes auto-pass.
    expect(mockPublish).toHaveBeenCalledOnce();
    const publishedEvent = mockPublish.mock.calls[0][0] as any;
    expect(publishedEvent.data.criteriaDecision).toBe('PASSED');
  });

  it('falls through to local rules when item has no orderId (extraction worker skipped order creation)', async () => {
    // Item's canonical record has no orderId.
    const job = makeJob({ canonicalRecord: { axiomPipelineJobId: 'pjob-extract-001' } });
    const db = makeDbService(job);

    const svc = new BulkIngestionCriteriaWorkerService(db);
    await svc.start();

    const handler = getExtractionHandler();
    await handler.handle(makeExtractionCompletedEvent());

    expect(mockSubmitCriteriaReevaluation).not.toHaveBeenCalled();

    // Should auto-pass via local rules (no config).
    const publishedEvent = mockPublish.mock.calls[0][0] as any;
    expect(publishedEvent.data.criteriaDecision).toBe('PASSED');
  });

  it('propagates extraction failure without calling Axiom', async () => {
    const db = makeDbService();
    const svc = new BulkIngestionCriteriaWorkerService(db);
    await svc.start();

    const handler = getExtractionHandler();
    await handler.handle(makeExtractionCompletedEvent({ status: 'failed', error: 'OCR timeout' }));

    expect(mockSubmitCriteriaReevaluation).not.toHaveBeenCalled();
    const publishedEvent = mockPublish.mock.calls[0][0] as any;
    expect(publishedEvent.data.status).toBe('failed');
    expect(publishedEvent.data.reason).toContain('OCR timeout');
  });

  it('skips criteria entirely when BULK_INGESTION_ENABLE_CRITERIA_STAGE is false', async () => {
    vi.stubEnv('BULK_INGESTION_ENABLE_CRITERIA_STAGE', 'false');
    const db = makeDbService();
    const svc = new BulkIngestionCriteriaWorkerService(db);
    await svc.start();

    const handler = getExtractionHandler();
    await handler.handle(makeExtractionCompletedEvent());

    expect(mockSubmitCriteriaReevaluation).not.toHaveBeenCalled();
    const publishedEvent = mockPublish.mock.calls[0][0] as any;
    expect(publishedEvent.data.criteriaStatus).toBe('skipped');
  });
});
