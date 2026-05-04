import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPublish = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
  })),
}));

const mockGetConfig = vi.fn();

vi.mock('../../src/services/tenant-automation-config.service.js', () => ({
  TenantAutomationConfigService: vi.fn().mockImplementation(() => ({
    getConfig: mockGetConfig,
  })),
}));

import { AxiomTimeoutWatcherJob } from '../../src/jobs/axiom-timeout-watcher.job.js';

function createDbStub(fetchAllImpl?: () => Promise<{ resources: any[] }>) {
  const queryFetchAll = fetchAllImpl ?? (async () => ({ resources: [] }));
  const patch = vi.fn().mockResolvedValue({});

  const container = {
    items: {
      query: vi.fn().mockReturnValue({
        fetchAll: vi.fn().mockImplementation(queryFetchAll),
      }),
    },
    item: vi.fn().mockReturnValue({ patch }),
  };

  return {
    getContainer: vi.fn().mockReturnValue(container),
    _container: container,
    _patch: patch,
  };
}

describe('AxiomTimeoutWatcherJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({ axiomAutoTrigger: true, axiomTimeoutMinutes: 10 });
  });

  it('starts with circuit closed', () => {
    const db = createDbStub();
    const job = new AxiomTimeoutWatcherJob(db as any);
    expect(job.getCircuitState()).toBe('closed');
  });

  it('opens circuit after three consecutive 403 failures', async () => {
    const db = createDbStub(async () => {
      const error: any = new Error('forbidden');
      error.code = 403;
      throw error;
    });
    const job = new AxiomTimeoutWatcherJob(db as any);

    await (job as any).checkTimeouts();
    await (job as any).checkTimeouts();
    await (job as any).checkTimeouts();

    expect(job.getCircuitState()).toBe('open');
  });

  it('publishes timeout event and patches order when timeout threshold is exceeded', async () => {
    const staleSubmittedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const db = createDbStub(async () => ({
      resources: [
        {
          id: 'order-001',
          tenantId: 'tenant-001',
          orderNumber: 'ORD-001',
          axiomSubmittedAt: staleSubmittedAt,
          axiomStatus: 'submitted',
        },
      ],
    }));

    const job = new AxiomTimeoutWatcherJob(db as any);
    await (job as any).checkTimeouts();

    expect(db._container.item).toHaveBeenCalledWith('order-001', 'tenant-001');
    expect(db._patch).toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'axiom.evaluation.timeout',
        data: expect.objectContaining({
          orderId: 'order-001',
          tenantId: 'tenant-001',
          timeoutMinutes: 10,
        }),
      }),
    );
  });

  it('skips candidates already in terminal status', async () => {
    const staleSubmittedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const db = createDbStub(async () => ({
      resources: [
        {
          id: 'order-002',
          tenantId: 'tenant-001',
          orderNumber: 'ORD-002',
          axiomSubmittedAt: staleSubmittedAt,
          axiomStatus: 'completed',
        },
      ],
    }));

    const job = new AxiomTimeoutWatcherJob(db as any);
    await (job as any).checkTimeouts();

    expect(db._patch).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
