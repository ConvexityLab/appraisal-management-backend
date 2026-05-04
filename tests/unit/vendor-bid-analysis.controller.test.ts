import { beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createVendorBidAnalysisRouter } from '../../src/controllers/vendor-bid-analysis.controller.js';

function buildDb(order: any | null) {
  return {
    findOrderById: async (id: string) => ({
      success: !!order,
      data: order && order.id === id ? order : null,
    }),
  };
}

function buildApp(order: any | null, tenantId = 'tenant-1') {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).user = { tenantId };
    next();
  });
  app.use('/api/agent', createVendorBidAnalysisRouter(buildDb(order) as any));
  return app;
}

describe('Vendor bid analysis controller', () => {
  beforeEach(() => {
    // no-op placeholder for symmetry with other controller tests
  });

  it('returns cached vendor-bid analysis for the requested order', async () => {
    const app = buildApp({
      id: 'order-1',
      tenantId: 'tenant-1',
      vendorBidAnalysis: {
        recommendation: 'vendor-2',
        confidence: 0.94,
        rulesBasedTopVendorId: 'vendor-1',
        finalTopVendorId: 'vendor-2',
        dispatchDecisionReason: 'AI recommendation was applied because confidence 94% met the 85% threshold.',
      },
    });

    const res = await request(app).get('/api/agent/analyze/vendor-bid/order-1');

    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe('order-1');
    expect(res.body.data.analysis).toEqual(
      expect.objectContaining({
        recommendation: 'vendor-2',
        confidence: 0.94,
        rulesBasedTopVendorId: 'vendor-1',
        finalTopVendorId: 'vendor-2',
        dispatchDecisionReason: 'AI recommendation was applied because confidence 94% met the 85% threshold.',
      }),
    );
  });

  it('returns 404 when the order has no cached vendor-bid analysis', async () => {
    const app = buildApp({
      id: 'order-1',
      tenantId: 'tenant-1',
    });

    const res = await request(app).get('/api/agent/analyze/vendor-bid/order-1');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('does not have cached vendor-bid analysis');
  });

  it('returns 404 when the order belongs to another tenant', async () => {
    const app = buildApp({
      id: 'order-1',
      tenantId: 'tenant-2',
      vendorBidAnalysis: { recommendation: 'vendor-2' },
    });

    const res = await request(app).get('/api/agent/analyze/vendor-bid/order-1');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Order 'order-1' was not found");
  });
});