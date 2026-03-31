import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPublish = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

vi.mock('../../src/services/blob-storage.service.js', () => ({
  BlobStorageService: vi.fn().mockImplementation(() => ({
    generateReadSasUrl: vi.fn().mockResolvedValue('https://blob/sas'),
  })),
}));

vi.mock('../../src/services/axiom-execution.service.js', () => ({
  AxiomExecutionService: vi.fn().mockImplementation(() => ({
    updateExecutionStatus: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/bulk-portfolio.service', () => ({
  BulkPortfolioService: vi.fn().mockImplementation(() => ({
    stampBatchEvaluationResults: vi.fn().mockResolvedValue({ items: [] }),
    processExtractionCompletion: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { AxiomController } from '../../src/controllers/axiom.controller.js';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('AxiomController webhook durable ACK', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 only after ORDER webhook durable processing succeeds', async () => {
    const dbStub = {
      updateOrder: vi.fn().mockResolvedValue({ success: true }),
      findOrderById: vi.fn().mockResolvedValue({ success: true, data: { tenantId: 'tenant-1', orderNumber: 'ORD-1' } }),
    };

    const axiomServiceStub = {
      fetchAndStorePipelineResults: vi.fn().mockResolvedValue(undefined),
      handleWebhook: vi.fn().mockResolvedValue(undefined),
      broadcastBatchJobUpdate: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new AxiomController(dbStub as any, axiomServiceStub as any);
    const req: any = {
      body: {
        correlationId: 'order-1',
        correlationType: 'ORDER',
        pipelineJobId: 'pjob-1',
        status: 'completed',
        result: { overallRiskScore: 42, overallDecision: 'ACCEPT', flags: ['f1'] },
      },
    };
    const res = makeRes();

    await controller.handleWebhook(req, res);

    expect(dbStub.updateOrder).toHaveBeenCalledTimes(1);
    expect(axiomServiceStub.fetchAndStorePipelineResults).toHaveBeenCalledWith('order-1', 'pjob-1');
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 when durable ORDER webhook update fails', async () => {
    const dbStub = {
      updateOrder: vi.fn().mockResolvedValue({ success: false, error: 'cosmos write failed' }),
      findOrderById: vi.fn().mockResolvedValue({ success: true, data: { tenantId: 'tenant-1', orderNumber: 'ORD-1' } }),
    };

    const axiomServiceStub = {
      fetchAndStorePipelineResults: vi.fn().mockResolvedValue(undefined),
      handleWebhook: vi.fn().mockResolvedValue(undefined),
      broadcastBatchJobUpdate: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new AxiomController(dbStub as any, axiomServiceStub as any);
    const req: any = {
      body: {
        correlationId: 'order-1',
        correlationType: 'ORDER',
        pipelineJobId: 'pjob-1',
        status: 'completed',
      },
    };
    const res = makeRes();

    await controller.handleWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
