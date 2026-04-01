import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetOperationalMetrics = vi.fn();
const mockListDlqEvents = vi.fn();
const mockReplayDlqEvent = vi.fn();

vi.mock('../../src/services/axiom-bulk-submission.service.js', () => ({
  AxiomBulkSubmissionService: vi.fn().mockImplementation(() => ({
    getOperationalMetrics: mockGetOperationalMetrics,
    listDlqEvents: mockListDlqEvents,
    replayDlqEvent: mockReplayDlqEvent,
  })),
}));

vi.mock('../../src/services/axiom.service', () => ({
  AxiomService: vi.fn().mockImplementation(() => ({
    isEnabled: vi.fn().mockReturnValue(true),
  })),
}));

vi.mock('../../src/services/axiom-execution.service', () => ({
  AxiomExecutionService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/bulk-portfolio.service', () => ({
  BulkPortfolioService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/blob-storage.service', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { AxiomController } from '../../src/controllers/axiom.controller.js';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('AxiomController bulk submission ops endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns bulk submission metrics', async () => {
    mockGetOperationalMetrics.mockResolvedValue({
      eventsReceived: 3,
      submissionsSucceeded: 2,
      submissionsFailed: 1,
    });

    const controller = new AxiomController({} as any);
    const req: any = { user: { id: 'operator-1', tenantId: 'tenant-1' } };
    const res = makeRes();

    await controller.getBulkSubmissionMetrics(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          metrics: expect.objectContaining({ eventsReceived: 3 }),
        }),
      }),
    );
  });

  it('returns DLQ entries with applied filters', async () => {
    mockListDlqEvents.mockResolvedValue({
      items: [
        {
          id: 'axiom-bulk-submission-dlq:evt-1',
          type: 'axiom-bulk-submission-dlq',
          tenantId: 'tenant-1',
          clientId: 'client-1',
          jobId: 'job-1',
          eventId: 'evt-1',
          source: 'axiom-bulk-submission-service',
          failedAt: new Date().toISOString(),
          error: 'submit failed',
          status: 'OPEN',
          retryCount: 0,
        },
      ],
      page: 2,
      pageSize: 25,
      hasMore: true,
      sortPreset: 'RETRY_COUNT_DESC',
      ageBucket: 'LAST_7_DAYS',
    });

    const controller = new AxiomController({} as any);
    const req: any = {
      query: {
        tenantId: 'tenant-1',
        jobId: 'job-1',
        status: 'OPEN',
        fromFailedAt: '2026-03-01T00:00:00.000Z',
        toFailedAt: '2026-03-31T23:59:59.000Z',
        sortPreset: 'RETRY_COUNT_DESC',
        ageBucket: 'LAST_7_DAYS',
        page: '2',
        pageSize: '25',
      },
      user: { id: 'operator-1', tenantId: 'tenant-1' },
    };
    const res = makeRes();

    await controller.getBulkSubmissionDlq(req, res);

    expect(mockListDlqEvents).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      jobId: 'job-1',
      status: 'OPEN',
      fromFailedAt: '2026-03-01T00:00:00.000Z',
      toFailedAt: '2026-03-31T23:59:59.000Z',
      sortPreset: 'RETRY_COUNT_DESC',
      ageBucket: 'LAST_7_DAYS',
      page: 2,
      pageSize: 25,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          count: 1,
          pagination: expect.objectContaining({
            page: 2,
            pageSize: 25,
            hasMore: true,
          }),
          items: expect.any(Array),
        }),
      }),
    );
  });

  it('returns 400 for invalid DLQ status filter', async () => {
    const controller = new AxiomController({} as any);
    const req: any = {
      query: {
        status: 'INVALID',
      },
      user: { id: 'operator-1', tenantId: 'tenant-1' },
    };
    const res = makeRes();

    await controller.getBulkSubmissionDlq(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockListDlqEvents).not.toHaveBeenCalled();
  });

  it('returns 400 when fromFailedAt is after toFailedAt', async () => {
    const controller = new AxiomController({} as any);
    const req: any = {
      query: {
        fromFailedAt: '2026-04-01T00:00:00.000Z',
        toFailedAt: '2026-03-01T00:00:00.000Z',
      },
      user: { id: 'operator-1', tenantId: 'tenant-1' },
    };
    const res = makeRes();

    await controller.getBulkSubmissionDlq(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockListDlqEvents).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid sort preset', async () => {
    const controller = new AxiomController({} as any);
    const req: any = {
      query: {
        sortPreset: 'BAD_SORT',
      },
      user: { id: 'operator-1', tenantId: 'tenant-1' },
    };
    const res = makeRes();

    await controller.getBulkSubmissionDlq(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockListDlqEvents).not.toHaveBeenCalled();
  });

  it('replays DLQ event and returns 202 response payload', async () => {
    mockReplayDlqEvent.mockResolvedValue({
      replayEventId: 'replay-123',
      pipelineJobId: 'pipeline-1',
      batchId: 'batch-1',
    });

    const controller = new AxiomController({} as any);
    const req: any = {
      params: { eventId: 'evt-123' },
      user: { id: 'operator-1', tenantId: 'tenant-1' },
    };
    const res = makeRes();

    await controller.replayBulkSubmissionDlqEvent(req, res);

    expect(mockReplayDlqEvent).toHaveBeenCalledWith('evt-123', 'operator-1');
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it('returns 404 when requested DLQ event does not exist', async () => {
    mockReplayDlqEvent.mockRejectedValue(new Error("DLQ event 'evt-missing' not found"));

    const controller = new AxiomController({} as any);
    const req: any = {
      params: { eventId: 'evt-missing' },
      user: { id: 'operator-1', tenantId: 'tenant-1' },
    };
    const res = makeRes();

    await controller.replayBulkSubmissionDlqEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
