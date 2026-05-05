/**
 * Tests for VendorOrderController — read-only REST surface over the
 * `orders` Cosmos container, filtered to VendorOrder docs (legacy or
 * target discriminator).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Response, type NextFunction } from 'express';
import request from 'supertest';

import { VendorOrderController } from '../src/controllers/vendor-order.controller';
import {
  VENDOR_ORDERS_CONTAINER,
  VENDOR_ORDER_DOC_TYPE,
  LEGACY_VENDOR_ORDER_DOC_TYPE,
} from '../src/types/vendor-order.types';

interface VOStored {
  id: string;
  tenantId: string;
  type: typeof VENDOR_ORDER_DOC_TYPE | typeof LEGACY_VENDOR_ORDER_DOC_TYPE | string;
  clientOrderId?: string;
  [k: string]: any;
}

function makeMockDb() {
  const store = new Map<string, VOStored>();

  const container = {
    items: {
      query: vi.fn((spec: { query: string; parameters: Array<{ name: string; value: any }> }) => {
        const params = Object.fromEntries(spec.parameters.map((p) => [p.name, p.value]));
        return {
          fetchAll: async () => {
            const matches = Array.from(store.values()).filter((doc) => {
              if (
                doc.type !== VENDOR_ORDER_DOC_TYPE &&
                doc.type !== LEGACY_VENDOR_ORDER_DOC_TYPE
              )
                return false;
              if (params['@tenantId'] !== undefined && doc.tenantId !== params['@tenantId'])
                return false;
              if (
                params['@clientOrderId'] !== undefined &&
                doc.clientOrderId !== params['@clientOrderId']
              )
                return false;
              return true;
            });
            return { resources: matches };
          },
        };
      }),
    },
    item: vi.fn((id: string, _pk: string) => ({
      read: vi.fn(async () => {
        const found = store.get(id);
        return { resource: found ? { ...found } : undefined };
      }),
    })),
  };

  const db = {
    getContainer: vi.fn((name: string) => {
      if (name !== VENDOR_ORDERS_CONTAINER) {
        throw new Error(`Unexpected container request: ${name}`);
      }
      return container;
    }),
  } as any;

  return { db, store };
}

function makeApp(db: any) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'u@example.com',
      name: 'U',
    };
    next();
  });
  const ctrl = new VendorOrderController(db);
  app.use('/api/vendor-orders', ctrl.router);
  return app;
}

describe('GET /api/vendor-orders', () => {
  it('returns 400 without clientOrderId', async () => {
    const { db } = makeMockDb();
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('lists VendorOrders for a parent ClientOrder, scoped to the caller tenant', async () => {
    const { db, store } = makeMockDb();
    store.set('vo-1', {
      id: 'vo-1',
      tenantId: 'tenant-a',
      type: 'order',
      clientOrderId: 'co-1',
    });
    store.set('vo-2', {
      id: 'vo-2',
      tenantId: 'tenant-a',
      type: 'vendor-order',
      clientOrderId: 'co-1',
    });
    // Other tenant's child — must be excluded.
    store.set('vo-3', {
      id: 'vo-3',
      tenantId: 'tenant-b',
      type: 'order',
      clientOrderId: 'co-1',
    });
    // Different parent — excluded.
    store.set('vo-4', {
      id: 'vo-4',
      tenantId: 'tenant-a',
      type: 'order',
      clientOrderId: 'co-2',
    });
    // Non-vendor doc that happens to share container — excluded.
    store.set('other-1', {
      id: 'other-1',
      tenantId: 'tenant-a',
      type: 'something-else',
      clientOrderId: 'co-1',
    });

    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders').query({ clientOrderId: 'co-1' });
    expect(res.status).toBe(200);
    expect(res.body.vendorOrders.map((v: any) => v.id).sort()).toEqual(['vo-1', 'vo-2']);
  });

  it('returns empty list when nothing matches', async () => {
    const { db } = makeMockDb();
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders').query({ clientOrderId: 'nope' });
    expect(res.status).toBe(200);
    expect(res.body.vendorOrders).toEqual([]);
  });
});

describe('GET /api/vendor-orders/:id', () => {
  it('returns the vendor order when found and type matches', async () => {
    const { db, store } = makeMockDb();
    store.set('vo-1', {
      id: 'vo-1',
      tenantId: 'tenant-a',
      type: 'order',
      clientOrderId: 'co-1',
    });
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/vo-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('vo-1');
  });

  it('returns 404 when not found', async () => {
    const { db } = makeMockDb();
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/missing');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns 404 when the doc has a non-vendor discriminator', async () => {
    const { db, store } = makeMockDb();
    store.set('weird-1', {
      id: 'weird-1',
      tenantId: 'tenant-a',
      type: 'something-else',
    });
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/weird-1');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
