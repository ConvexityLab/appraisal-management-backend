import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVendorOutboxMonitorRouter } from '../../src/controllers/vendor-outbox-monitor.controller.js';

function createTestApp(db: { queryItems: ReturnType<typeof vi.fn>; updateItem: ReturnType<typeof vi.fn> }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { tenantId: 'tenant-1', id: 'operator-1' };
    next();
  });
  app.use('/api/vendor-integrations/outbox', createVendorOutboxMonitorRouter(db as any));
  return app;
}

describe('VendorOutboxMonitorController', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('returns vendor outbox summary metrics', async () => {
    vi.setSystemTime(new Date('2026-04-23T01:30:00.000Z'));
    const queryItems = vi.fn().mockImplementation(async (_container: string, query: string, parameters: Array<{ name: string; value: unknown }>) => {
      const status = parameters.find((parameter) => parameter.name === '@status')?.value;
      if (query.includes('COUNT(1)') && status === 'PENDING') return { success: true, data: [3] };
      if (query.includes('COUNT(1)') && status === 'PROCESSING') return { success: true, data: [1] };
      if (query.includes('COUNT(1)') && status === 'FAILED') return { success: true, data: [2] };
      if (query.includes('COUNT(1)') && status === 'COMPLETED') return { success: true, data: [10] };
      if (query.includes('COUNT(1)') && status === 'DEAD_LETTER') return { success: true, data: [1] };
      if (query.includes('TOP 1 c.id, c.availableAt')) {
        return {
          success: true,
          data: [{
            id: 'vendor-outbox:evt-1',
            availableAt: '2026-04-23T01:00:00.000Z',
            vendorType: 'aim-port',
            eventType: 'vendor.order.completed',
          }],
        };
      }
      return { success: true, data: [] };
    });

    const res = await request(createTestApp({ queryItems, updateItem: vi.fn() })).get('/api/vendor-integrations/outbox/summary');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      readyBacklogCount: 5,
      statusCounts: {
        PENDING: 3,
        PROCESSING: 1,
        FAILED: 2,
        COMPLETED: 10,
        DEAD_LETTER: 1,
      },
      oldestReadyAgeMinutes: 30,
    });
  });

  it('lists retryable backlog items', async () => {
    const queryItems = vi.fn().mockResolvedValue({
      success: true,
      data: [{
        id: 'vendor-outbox:evt-2',
        status: 'FAILED',
        vendorType: 'aim-port',
        eventType: 'vendor.message.received',
        vendorOrderId: 'AP-2001',
        attemptCount: 2,
      }],
    });

    const res = await request(createTestApp({ queryItems, updateItem: vi.fn() }))
      .get('/api/vendor-integrations/outbox/backlog')
      .query({ limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 'vendor-outbox:evt-2',
        status: 'FAILED',
        vendorOrderId: 'AP-2001',
      }),
    ]);
  });

  it('lists dead-letter items', async () => {
    const queryItems = vi.fn().mockResolvedValue({
      success: true,
      data: [{
        id: 'vendor-outbox:evt-3',
        status: 'DEAD_LETTER',
        vendorType: 'class-valuation',
        eventType: 'vendor.order.completed',
        vendorOrderId: 'CV-3001',
        lastError: 'still failing',
      }],
    });

    const res = await request(createTestApp({ queryItems, updateItem: vi.fn() }))
      .get('/api/vendor-integrations/outbox/dead-letter')
      .query({ limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 'vendor-outbox:evt-3',
        status: 'DEAD_LETTER',
        vendorType: 'class-valuation',
      }),
    ]);
  });

  it('requeues failed items for immediate retry', async () => {
    const queryItems = vi.fn().mockResolvedValue({
      success: true,
      data: [{
        id: 'vendor-outbox:evt-4',
        tenantId: 'tenant-1',
        type: 'vendor-event-outbox',
        direction: 'inbound',
        status: 'FAILED',
        vendorType: 'aim-port',
        connectionId: 'vc-1',
        lenderId: 'lender-1',
        vendorOrderId: 'AP-4001',
        ourOrderId: 'order-1',
        eventType: 'vendor.revision.requested',
        occurredAt: '2026-04-23T00:00:00.000Z',
        receivedAt: '2026-04-23T00:00:00.000Z',
        availableAt: '2026-04-23T00:00:00.000Z',
        attemptCount: 2,
        payload: { subject: 'Revision', content: 'Fix comp grid' },
        metadata: { transport: 'direct_api' },
        lastError: 'Timeout',
      }],
    });
    const updateItem = vi.fn().mockResolvedValue({ success: true, data: { id: 'vendor-outbox:evt-4', status: 'PENDING' } });

    const res = await request(createTestApp({ queryItems, updateItem }))
      .post('/api/vendor-integrations/outbox/vendor-outbox:evt-4/requeue');

    expect(res.status).toBe(200);
    expect(updateItem).toHaveBeenCalledWith(
      'vendor-event-outbox',
      'vendor-outbox:evt-4',
      expect.objectContaining({ status: 'PENDING' }),
      'tenant-1',
    );
  });

  it('acknowledges dead-letter items with operator metadata', async () => {
    const queryItems = vi.fn().mockResolvedValue({
      success: true,
      data: [{
        id: 'vendor-outbox:evt-5',
        tenantId: 'tenant-1',
        type: 'vendor-event-outbox',
        direction: 'inbound',
        status: 'DEAD_LETTER',
        vendorType: 'class-valuation',
        connectionId: 'vc-2',
        lenderId: 'lender-1',
        vendorOrderId: 'CV-5001',
        ourOrderId: 'order-2',
        eventType: 'vendor.file.received',
        occurredAt: '2026-04-23T00:00:00.000Z',
        receivedAt: '2026-04-23T00:00:00.000Z',
        availableAt: '2026-04-23T00:00:00.000Z',
        attemptCount: 8,
        payload: { files: [] },
        metadata: { transport: 'webhook' },
      }],
    });
    const updateItem = vi.fn().mockResolvedValue({ success: true, data: { id: 'vendor-outbox:evt-5', deadLetterAcknowledgedBy: 'operator-1' } });

    const res = await request(createTestApp({ queryItems, updateItem }))
      .post('/api/vendor-integrations/outbox/vendor-outbox:evt-5/acknowledge')
      .send({ note: 'Known vendor issue' });

    expect(res.status).toBe(200);
    expect(updateItem).toHaveBeenCalledWith(
      'vendor-event-outbox',
      'vendor-outbox:evt-5',
      expect.objectContaining({
        deadLetterAcknowledgedBy: 'operator-1',
        deadLetterAcknowledgeNote: 'Known vendor issue',
      }),
      'tenant-1',
    );
  });

  it('rejects acknowledgement notes longer than the maximum length', async () => {
    const queryItems = vi.fn();
    const updateItem = vi.fn();

    const res = await request(createTestApp({ queryItems, updateItem }))
      .post('/api/vendor-integrations/outbox/vendor-outbox:evt-5/acknowledge')
      .send({ note: 'x'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('500 characters or fewer');
    expect(queryItems).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
  });
});