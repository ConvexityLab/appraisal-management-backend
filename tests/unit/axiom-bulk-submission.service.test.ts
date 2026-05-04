import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
const mockSubmitTapeEvaluationJobToAxiom = vi.fn();
const mockPublish = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}));

vi.mock('../../src/services/bulk-portfolio.service.js', () => ({
  BulkPortfolioService: vi.fn().mockImplementation(() => ({
    submitTapeEvaluationJobToAxiom: mockSubmitTapeEvaluationJobToAxiom,
  })),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

import { AxiomBulkSubmissionService } from '../../src/services/axiom-bulk-submission.service.js';

function makeEvent(overrides?: Partial<any>) {
  return {
    id: 'evt-axiom-001',
    type: 'axiom.bulk-evaluation.requested',
    timestamp: new Date(),
    source: 'test',
    version: '1.0',
    category: 'qc',
    data: {
      jobId: 'bulk-job-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      subClientId: 'sub-client-1',
      reviewProgramId: 'program-1',
      priority: 'normal',
      ...overrides,
    },
  } as any;
}

describe('AxiomBulkSubmissionService idempotency and replay handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitTapeEvaluationJobToAxiom.mockResolvedValue({
      pipelineJobId: 'pipeline-1',
      batchId: 'batch-1',
    });
  });

  it('processes first-seen event and persists lock completion metadata', async () => {
    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);
    await (service as any).onBulkEvaluationRequested(makeEvent());

    expect(mockSubmitTapeEvaluationJobToAxiom).toHaveBeenCalledWith(
      'bulk-job-1',
      'tenant-1',
      'client-1',
      'sub-client-1',
      'program-1',
    );

    expect(db.upsertItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'axiom-bulk-submission-lock',
        status: 'completed',
        pipelineJobId: 'pipeline-1',
        batchId: 'batch-1',
      }),
    );
  });

  it('skips replayed event when immutable receipt already exists', async () => {
    const receiptId = 'axiom-bulk-submission-receipt:evt-axiom-001';
    const db = {
      createItem: vi
        .fn()
        .mockResolvedValueOnce({ success: false, error: { message: 'duplicate' } })
        .mockResolvedValue({ success: true, data: {} }),
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [{ id: receiptId, type: 'axiom-bulk-submission-receipt' }],
      }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);
    await (service as any).onBulkEvaluationRequested(makeEvent());

    expect(mockSubmitTapeEvaluationJobToAxiom).not.toHaveBeenCalled();
    expect(db.queryItems).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.stringContaining('SELECT * FROM c WHERE c.id = @id'),
      [{ name: '@id', value: receiptId }],
    );
  });

  it('writes DLQ entry and marks receipt failed when submission throws', async () => {
    mockSubmitTapeEvaluationJobToAxiom.mockRejectedValue(new Error('axiom submit failed'));

    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);

    await expect((service as any).onBulkEvaluationRequested(makeEvent())).rejects.toThrow('axiom submit failed');

    expect(db.createItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'axiom-bulk-submission-dlq',
        status: 'OPEN',
        eventId: 'evt-axiom-001',
      }),
    );

    expect(db.upsertItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        type: 'axiom-bulk-submission-receipt',
        status: 'failed',
      }),
    );
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'system.alert',
      }),
    );
  });

  it('returns zeroed metrics when metrics document does not exist', async () => {
    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);
    const metrics = await service.getOperationalMetrics();

    expect(metrics.eventsReceived).toBe(0);
    expect(metrics.replayAttempts).toBe(0);
    expect(metrics.submissionsSucceeded).toBe(0);
  });

  it('lists DLQ events with tenant/job/status filters', async () => {
    const dlqDoc = {
      id: 'axiom-bulk-submission-dlq:evt-source-3',
      type: 'axiom-bulk-submission-dlq',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      jobId: 'bulk-job-9',
      eventId: 'evt-source-3',
      source: 'axiom-bulk-submission-service',
      failedAt: new Date().toISOString(),
      error: 'submit failed',
      status: 'OPEN',
      retryCount: 0,
    };

    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [dlqDoc] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);
    const result = await service.listDlqEvents({
      tenantId: 'tenant-1',
      jobId: 'bulk-job-9',
      status: 'OPEN',
      limit: 25,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('axiom-bulk-submission-dlq:evt-source-3');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.hasMore).toBe(false);
    expect(db.queryItems).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.stringContaining('c.type = @type AND c.tenantId = @tenantId AND c.jobId = @jobId AND c.status = @status'),
      [
        { name: '@type', value: 'axiom-bulk-submission-dlq' },
        { name: '@tenantId', value: 'tenant-1' },
        { name: '@jobId', value: 'bulk-job-9' },
        { name: '@status', value: 'OPEN' },
      ],
    );
  });

  it('applies failedAt date-range predicates when provided', async () => {
    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);
    await service.listDlqEvents({
      fromFailedAt: '2026-03-01T00:00:00.000Z',
      toFailedAt: '2026-03-31T23:59:59.000Z',
    });

    expect(db.queryItems).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.stringContaining('c.failedAt >= @fromFailedAt AND c.failedAt <= @toFailedAt'),
      expect.arrayContaining([
        { name: '@fromFailedAt', value: '2026-03-01T00:00:00.000Z' },
        { name: '@toFailedAt', value: '2026-03-31T23:59:59.000Z' },
      ]),
    );
  });

  it('applies sort preset, age bucket, and pagination offset', async () => {
    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { id: 'dlq-1', type: 'axiom-bulk-submission-dlq' },
          { id: 'dlq-2', type: 'axiom-bulk-submission-dlq' },
          { id: 'dlq-3', type: 'axiom-bulk-submission-dlq' },
        ],
      }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);
    const result = await service.listDlqEvents({
      sortPreset: 'RETRY_COUNT_DESC',
      ageBucket: 'LAST_7_DAYS',
      page: 2,
      pageSize: 2,
    });

    expect(db.queryItems).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.stringContaining('ORDER BY c.retryCount DESC, c.failedAt DESC OFFSET 2 LIMIT 3'),
      expect.arrayContaining([
        { name: '@type', value: 'axiom-bulk-submission-dlq' },
        { name: '@ageBucketFrom', value: expect.any(String) },
      ]),
    );
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.sortPreset).toBe('RETRY_COUNT_DESC');
    expect(result.ageBucket).toBe('LAST_7_DAYS');
  });

  it('rejects invalid DLQ status filter values', async () => {
    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);
    await expect(service.listDlqEvents({ status: 'BAD_STATUS' as any })).rejects.toThrow(
      "Invalid DLQ status 'BAD_STATUS'",
    );
  });

  it('rejects invalid DLQ age bucket values', async () => {
    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);
    await expect(service.listDlqEvents({ ageBucket: 'LAST_YEAR' as any })).rejects.toThrow(
      "Invalid ageBucket 'LAST_YEAR'",
    );
  });

  it('replays DLQ event and marks it REPLAYED with replay metadata', async () => {
    const dlqDoc = {
      id: 'axiom-bulk-submission-dlq:evt-source-1',
      type: 'axiom-bulk-submission-dlq',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      jobId: 'bulk-job-1',
      eventPayload: { reviewProgramId: 'program-1' },
      status: 'OPEN',
      retryCount: 0,
    };

    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: [dlqDoc] })
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);
    const result = await service.replayDlqEvent('evt-source-1', 'operator-1');

    expect(result.pipelineJobId).toBe('pipeline-1');
    expect(result.batchId).toBe('batch-1');
    expect(result.replayEventId.startsWith('replay-')).toBe(true);

    expect(db.upsertItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        id: 'axiom-bulk-submission-dlq:evt-source-1',
        status: 'REPLAYED',
        replayedBy: 'operator-1',
      }),
    );
  });

  it('keeps DLQ OPEN and increments retry metadata when replay fails', async () => {
    mockSubmitTapeEvaluationJobToAxiom.mockRejectedValue(new Error('replay failed'));

    const dlqDoc = {
      id: 'axiom-bulk-submission-dlq:evt-source-2',
      type: 'axiom-bulk-submission-dlq',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      jobId: 'bulk-job-1',
      eventPayload: { reviewProgramId: 'program-1' },
      status: 'OPEN',
      retryCount: 1,
    };

    const db = {
      createItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      queryItems: vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: [dlqDoc] })
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    const service = new AxiomBulkSubmissionService(db as any);

    await expect(service.replayDlqEvent('evt-source-2', 'operator-2')).rejects.toThrow('replay failed');

    expect(db.upsertItem).toHaveBeenCalledWith(
      'bulk-portfolio-jobs',
      expect.objectContaining({
        id: 'axiom-bulk-submission-dlq:evt-source-2',
        status: 'OPEN',
        lastReplayAttemptBy: 'operator-2',
        retryCount: 2,
      }),
    );
  });
});
