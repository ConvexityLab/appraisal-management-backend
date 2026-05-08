/**
 * Engagement-primacy guard — slice 8g tests
 *
 * Asserts that every order-creation path enforces parent Engagement linkage.
 * Three layers of defence:
 *   1. dbService.createOrder rejects writes lacking engagementId.
 *   2. order.controller / production-order.controller reject orphan API
 *      requests with 400 before they reach the service layer.
 *   3. ai-action-dispatcher's CREATE_ORDER tool requires engagementId in
 *      its payload (handled via getString throwing on missing field).
 */

import { describe, expect, it, vi } from 'vitest';

// ─── DB-level guard ──────────────────────────────────────────────────────────

describe('CosmosDbService.createOrder — engagement-primacy guard', () => {
  // We test the guard's behaviour with a stub harness that mirrors
  // CosmosDbService.createOrder's relevant paths without real Cosmos.
  // The actual production call goes through the same shape.

  function makeStubService() {
    // Reuse the real implementation by importing the module and binding
    // a lightweight `this` that supplies the methods createOrder reads.
    return {
      logger: { error: vi.fn(), info: vi.fn() },
      ordersContainer: {
        items: { create: vi.fn().mockResolvedValue({ resource: { id: 'should-not-reach' } }) },
      },
      generateVendorOrderId: vi.fn().mockReturnValue('vorder-001'),
    };
  }

  async function callGuarded(thiz: any, order: any) {
    // Invoke createOrder via the prototype with our stub `this` so we exercise
    // the actual guard logic from the production module.
    const { CosmosDbService } = await import('../../src/services/cosmos-db.service.js');
    return (CosmosDbService.prototype.createOrder as any).call(thiz, order);
  }

  it('rejects with engagement-primacy error when engagementId is missing', async () => {
    const thiz = makeStubService();
    const result = await callGuarded(thiz, {
      tenantId: 'tenant-1',
      clientId:  'client-1',
      productType: 'FULL_APPRAISAL',
      // engagementId intentionally omitted
    });
    expect(result.success).toBe(false);
    expect(result.error.message).toMatch(/engagementId is required/i);
    expect(thiz.ordersContainer.items.create).not.toHaveBeenCalled();
  });

  it('rejects when engagementId is present but empty/whitespace', async () => {
    const thiz = makeStubService();
    const result = await callGuarded(thiz, {
      tenantId: 'tenant-1',
      clientId: 'client-1',
      engagementId: '   ',
      productType: 'FULL_APPRAISAL',
    });
    expect(result.success).toBe(false);
    expect(result.error.message).toMatch(/engagementId is required/i);
  });

  it('proceeds to write when full engagement linkage is supplied', async () => {
    const thiz = makeStubService();
    const result = await callGuarded(thiz, {
      tenantId: 'tenant-1',
      clientId: 'client-1',
      engagementId: 'eng-1',
      engagementLoanId: 'loan-1',
      engagementClientOrderId: 'co-1',
      productType: 'FULL_APPRAISAL',
    });
    expect(result.success).toBe(true);
    expect(thiz.ordersContainer.items.create).toHaveBeenCalledTimes(1);
  });

  // Engagement-primacy linkage: engagementLoanId is required.
  // Without it, orders are queryable by engagementId but can't be attributed to
  // a specific loan — breaking per-loan rollups and the removeLoan safety guard.
  it('rejects when engagementLoanId is missing', async () => {
    const thiz = makeStubService();
    const result = await callGuarded(thiz, {
      tenantId: 'tenant-1',
      clientId: 'client-1',
      engagementId: 'eng-1',
      // engagementLoanId omitted
      engagementClientOrderId: 'co-1',
      productType: 'FULL_APPRAISAL',
    });
    expect(result.success).toBe(false);
    expect(result.error.message).toMatch(/engagementLoanId is required/i);
    expect(thiz.ordersContainer.items.create).not.toHaveBeenCalled();
  });

  it('rejects when engagementLoanId is whitespace-only', async () => {
    const thiz = makeStubService();
    const result = await callGuarded(thiz, {
      tenantId: 'tenant-1',
      clientId: 'client-1',
      engagementId: 'eng-1',
      engagementLoanId: '   ',
      engagementClientOrderId: 'co-1',
      productType: 'FULL_APPRAISAL',
    });
    expect(result.success).toBe(false);
    expect(result.error.message).toMatch(/engagementLoanId is required/i);
  });

  // Engagement-primacy linkage: engagementClientOrderId is required.
  // Without it, orders can't be attributed to a specific EngagementClientOrder —
  // breaking per-product rollups and orphaning the order from its parent product spec.
  it('rejects when engagementClientOrderId is missing', async () => {
    const thiz = makeStubService();
    const result = await callGuarded(thiz, {
      tenantId: 'tenant-1',
      clientId: 'client-1',
      engagementId: 'eng-1',
      engagementLoanId: 'loan-1',
      // engagementClientOrderId omitted
      productType: 'FULL_APPRAISAL',
    });
    expect(result.success).toBe(false);
    expect(result.error.message).toMatch(/engagementClientOrderId is required/i);
    expect(thiz.ordersContainer.items.create).not.toHaveBeenCalled();
  });

  it('rejects when engagementClientOrderId is whitespace-only', async () => {
    const thiz = makeStubService();
    const result = await callGuarded(thiz, {
      tenantId: 'tenant-1',
      clientId: 'client-1',
      engagementId: 'eng-1',
      engagementLoanId: 'loan-1',
      engagementClientOrderId: '\t\n  ',
      productType: 'FULL_APPRAISAL',
    });
    expect(result.success).toBe(false);
    expect(result.error.message).toMatch(/engagementClientOrderId is required/i);
  });
});

// ─── Controller-level guard (order.controller) ───────────────────────────────

describe('OrderController.createOrder — engagement-primacy 400 reject', () => {
  it('returns 400 with ENGAGEMENT_REQUIRED when engagementId missing', async () => {
    const { OrderController } = await import('../../src/controllers/order.controller.js');
    const controller = new OrderController({ createOrder: vi.fn() } as any);

    let statusCode = 0;
    let body: any = undefined;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: unknown) { body = data; return this; },
    };

    await controller.createOrder(
      {
        body: { /* no engagementId */ propertyAddress: { streetAddress: '1 Main' } },
        user: { id: 'u1', tenantId: 't1' },
      } as any,
      res as any,
    );

    expect(statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('ENGAGEMENT_REQUIRED');
  });

  it('returns 400 when engagementId is whitespace-only', async () => {
    const { OrderController } = await import('../../src/controllers/order.controller.js');
    const controller = new OrderController({ createOrder: vi.fn() } as any);
    let statusCode = 0;
    let body: any = undefined;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: unknown) { body = data; return this; },
    };

    await controller.createOrder(
      {
        body: { engagementId: '   ' },
        user: { id: 'u1', tenantId: 't1' },
      } as any,
      res as any,
    );

    expect(statusCode).toBe(400);
    expect(body.error?.code).toBe('ENGAGEMENT_REQUIRED');
  });
});

// ─── Controller-level guard (production-order.controller) ────────────────────

describe('ProductionOrderController.createOrder — engagement-primacy 400 reject', () => {
  it('returns 400 when engagementId missing', async () => {
    const { ProductionOrderController } = await import('../../src/controllers/production-order.controller.js');
    const controller = new ProductionOrderController({ createOrder: vi.fn() } as any);

    let statusCode = 0;
    let body: any = undefined;
    const res = {
      status(code: number) { statusCode = code; return this; },
      json(data: unknown) { body = data; return this; },
    };

    await controller.createOrder(
      { body: { /* no engagementId */ }, user: { id: 'u1', tenantId: 't1' } } as any,
      res as any,
    );

    expect(statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/engagementId is required/i);
  });
});
