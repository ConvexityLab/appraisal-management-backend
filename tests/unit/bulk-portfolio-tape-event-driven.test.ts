import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPublish = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

import { BulkPortfolioService } from '../../src/services/bulk-portfolio.service.js';

describe('BulkPortfolioService tape evaluation Axiom submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues an event-driven bulk submission and does not use inline per-loan submitOrderEvaluation fan-out', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const dbStub = {
      getReviewProgramsContainer: () => ({
        items: {
          query: () => ({
            fetchAll: async () => ({ resources: [{ id: 'program-1', version: '1.0' }] }),
          }),
        },
      }),
      getBulkPortfolioJobsContainer: () => ({
        items: {
          upsert,
        },
      }),
    };

    const service = new BulkPortfolioService(dbStub as any);

    (service as any)._tapeEvaluationService = {
      evaluate: vi.fn().mockReturnValue([
        {
          rowIndex: 0,
          loanNumber: 'LN-001',
          overallRiskScore: 35,
          computedDecision: 'Accept',
          autoFlagResults: [],
          manualFlagResults: [],
          dataQualityIssues: [],
          evaluatedAt: new Date().toISOString(),
          programId: 'program-1',
          programVersion: '1.0',
        },
      ]),
    };

    const inlineSubmitSpy = vi.fn();
    (service as any)._axiomService = { submitOrderEvaluation: inlineSubmitSpy };

    const request: any = {
      clientId: 'client-1',
      fileName: 'tape.csv',
      processingMode: 'TAPE_EVALUATION',
      reviewProgramId: 'program-1',
      items: [{ loanNumber: 'LN-001' }],
    };

    await (service as any)._submitTapeEvaluation(
      request,
      'bulk-job-1',
      new Date().toISOString(),
      'user-1',
      'tenant-1',
    );

    expect(mockPublish).toHaveBeenCalledTimes(1);
    const publishedEvent = mockPublish.mock.calls[0]?.[0];
    expect(publishedEvent.type).toBe('axiom.bulk-evaluation.requested');
    expect(publishedEvent.data).toMatchObject({
      jobId: 'bulk-job-1',
      tenantId: 'tenant-1',
      clientId: 'client-1',
      reviewProgramId: 'program-1',
    });

    expect(inlineSubmitSpy).not.toHaveBeenCalled();
  });
});
