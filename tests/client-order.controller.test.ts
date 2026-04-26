/**
 * Tests for ClientOrderController — REST surface over ClientOrderService +
 * OrderDecompositionService. Uses an in-memory mock of CosmosDbService so
 * the controller is exercised end-to-end through Express via supertest
 * without touching real Cosmos.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

import { ClientOrderController } from '../src/controllers/client-order.controller';
import {
  CLIENT_ORDERS_CONTAINER,
  type ClientOrder,
} from '../src/types/client-order.types';
import {
  DECOMPOSITION_RULES_CONTAINER,
  DECOMPOSITION_RULE_DOC_TYPE,
  GLOBAL_DEFAULT_TENANT,
  type DecompositionRule,
} from '../src/types/decomposition-rule.types';
import { ProductType } from '../src/types/product-catalog';

// ── Mock Cosmos ─────────────────────────────────────────────────────────────

interface MockDb {
  db: any;
  coStore: Map<string, ClientOrder>;
  vendorOrders: any[];
  ruleStore: DecompositionRule[];
  createdCalls: ClientOrder[];
  replacedCalls: ClientOrder[];
}

function makeMockDb(): MockDb {
  const coStore = new Map<string, ClientOrder>();
  const vendorOrders: any[] = [];
  const ruleStore: DecompositionRule[] = [];
  const createdCalls: ClientOrder[] = [];
  const replacedCalls: ClientOrder[] = [];
  let voIdCounter = 0;

  const coContainer = {
    items: {
      create: vi.fn(async (doc: ClientOrder) => {
        createdCalls.push(doc);
        coStore.set(doc.id, { ...doc });
        return { resource: { ...doc } };
      }),
    },
    item: vi.fn((id: string, _pk: string) => ({
      read: vi.fn(async () => {
        const found = coStore.get(id);
        return { resource: found ? { ...found } : undefined };
      }),
      replace: vi.fn(async (doc: ClientOrder) => {
        replacedCalls.push(doc);
        coStore.set(doc.id, { ...doc });
        return { resource: { ...doc } };
      }),
    })),
  };

  const ruleContainer = {
    items: {
      query: vi.fn((spec: { query: string; parameters: Array<{ name: string; value: any }> }) => {
        const params = Object.fromEntries(spec.parameters.map((p) => [p.name, p.value]));
        return {
          fetchAll: async () => {
            // Mimic the 3-tier predicates by inspecting which @-params are set.
            const filtered = ruleStore.filter((r) => {
              if (r.type !== DECOMPOSITION_RULE_DOC_TYPE) return false;
              if (params['@productType'] !== undefined && r.productType !== params['@productType']) {
                return false;
              }
              if (params['@tenantId'] !== undefined && r.tenantId !== params['@tenantId']) {
                return false;
              }
              if (params['@clientId'] !== undefined && r.clientId !== params['@clientId']) {
                return false;
              }
              // Tier 2 has no @clientId param: only return tenant-default rules
              // (those whose clientId is missing/null).
              if (
                params['@tenantId'] !== undefined &&
                params['@clientId'] === undefined &&
                r.tenantId !== GLOBAL_DEFAULT_TENANT &&
                r.clientId !== undefined &&
                r.clientId !== null
              ) {
                return false;
              }
              return true;
            });
            return { resources: filtered };
          },
        };
      }),
    },
  };

  const db = {
    getContainer: vi.fn((name: string) => {
      if (name === CLIENT_ORDERS_CONTAINER) return coContainer;
      if (name === DECOMPOSITION_RULES_CONTAINER) return ruleContainer;
      throw new Error(`Unexpected container request: ${name}`);
    }),
    createOrder: vi.fn(async (order: any) => {
      voIdCounter += 1;
      const id = `vo-${voIdCounter}`;
      const created = { ...order, id, type: 'order' };
      vendorOrders.push(created);
      return { success: true, data: created };
    }),
  };

  return { db, coStore, vendorOrders, ruleStore, createdCalls, replacedCalls };
}

function makeApp(mock: MockDb) {
  const app = express();
  app.use(express.json());
  // Inject a mock authenticated user — controller reads tenantId/id from req.user.
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'u@example.com',
      name: 'U',
    };
    next();
  });
  const controller = new ClientOrderController(mock.db);
  app.use('/api/client-orders', controller.router);
  return app;
}

const validBody = () => ({
  engagementId: 'eng-1',
  engagementLoanId: 'loan-1',
  clientId: 'client-1',
  productType: ProductType.FULL_APPRAISAL,
  propertyDetails: {
    propertyType: 'SINGLE_FAMILY',
    yearBuilt: 1995,
    grossLivingArea: 2000,
    bedrooms: 3,
    bathrooms: 2,
  },
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/client-orders', () => {
  let mock: MockDb;
  let app: express.Express;

  beforeEach(() => {
    mock = makeMockDb();
    app = makeApp(mock);
  });

  it('creates a ClientOrder with no children when vendorOrders omitted', async () => {
    const res = await request(app).post('/api/client-orders').send(validBody());

    expect(res.status).toBe(201);
    expect(res.body.clientOrder.type).toBe('client-order');
    expect(res.body.clientOrder.tenantId).toBe('tenant-a');
    expect(res.body.clientOrder.createdBy).toBe('user-1');
    expect(res.body.clientOrder.vendorOrderIds).toEqual([]);
    expect(res.body.vendorOrders).toEqual([]);
    expect(mock.db.createOrder).not.toHaveBeenCalled();
  });

  it('creates a ClientOrder + N VendorOrders when specs provided', async () => {
    const res = await request(app)
      .post('/api/client-orders')
      .send({
        ...validBody(),
        vendorOrders: [
          { vendorWorkType: ProductType.FULL_APPRAISAL },
          { vendorWorkType: ProductType.BPO },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.vendorOrders).toHaveLength(2);
    expect(res.body.clientOrder.vendorOrderIds).toEqual(['vo-1', 'vo-2']);
    expect(mock.db.createOrder).toHaveBeenCalledTimes(2);
  });

  it('returns 400 with INVALID_CLIENT_ORDER_INPUT when required field missing', async () => {
    const body = validBody();
    delete (body as any).engagementId;
    const res = await request(app).post('/api/client-orders').send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CLIENT_ORDER_INPUT');
    expect(res.body.missing).toEqual(['engagementId']);
  });

  it('returns 400 when vendorOrders is not an array', async () => {
    const res = await request(app)
      .post('/api/client-orders')
      .send({ ...validBody(), vendorOrders: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('ignores tenantId/createdBy from the body and uses req.user', async () => {
    const res = await request(app)
      .post('/api/client-orders')
      .send({ ...validBody(), tenantId: 'evil-tenant', createdBy: 'evil-user' });
    expect(res.status).toBe(201);
    expect(res.body.clientOrder.tenantId).toBe('tenant-a');
    expect(res.body.clientOrder.createdBy).toBe('user-1');
  });
});

describe('GET /api/client-orders/suggestions', () => {
  let mock: MockDb;
  let app: express.Express;

  beforeEach(() => {
    mock = makeMockDb();
    app = makeApp(mock);
  });

  it('returns empty templates and autoApply=false when no rule matches', async () => {
    const res = await request(app)
      .get('/api/client-orders/suggestions')
      .query({ clientId: 'client-1', productType: ProductType.FULL_APPRAISAL });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ vendorOrders: [], autoApply: false, ruleId: null });
  });

  it('returns templates from a tenant+client rule and surfaces autoApply', async () => {
    mock.ruleStore.push({
      id: 'rule-1',
      type: DECOMPOSITION_RULE_DOC_TYPE,
      tenantId: 'tenant-a',
      clientId: 'client-1',
      productType: ProductType.FULL_APPRAISAL,
      vendorOrders: [{ vendorWorkType: ProductType.FULL_APPRAISAL }],
      autoApply: true,
    } as DecompositionRule);

    const res = await request(app)
      .get('/api/client-orders/suggestions')
      .query({ clientId: 'client-1', productType: ProductType.FULL_APPRAISAL });
    expect(res.status).toBe(200);
    expect(res.body.vendorOrders).toEqual([{ vendorWorkType: ProductType.FULL_APPRAISAL }]);
    expect(res.body.autoApply).toBe(true);
    expect(res.body.ruleId).toBe('rule-1');
  });

  it('returns 400 when clientId or productType missing', async () => {
    const res = await request(app)
      .get('/api/client-orders/suggestions')
      .query({ clientId: 'client-1' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/client-orders/:id', () => {
  let mock: MockDb;
  let app: express.Express;

  beforeEach(() => {
    mock = makeMockDb();
    app = makeApp(mock);
  });

  it('returns the ClientOrder when found', async () => {
    const placed = await request(app).post('/api/client-orders').send(validBody());
    const id = placed.body.clientOrder.id;

    const res = await request(app).get(`/api/client-orders/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.type).toBe('client-order');
  });

  it('returns 404 when not found', async () => {
    const res = await request(app).get('/api/client-orders/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/client-orders/:id/vendor-orders', () => {
  let mock: MockDb;
  let app: express.Express;

  beforeEach(() => {
    mock = makeMockDb();
    app = makeApp(mock);
  });

  it('appends VendorOrders to an existing ClientOrder', async () => {
    const placed = await request(app).post('/api/client-orders').send(validBody());
    const id = placed.body.clientOrder.id;

    const res = await request(app)
      .post(`/api/client-orders/${id}/vendor-orders`)
      .send({ vendorOrders: [{ vendorWorkType: ProductType.BPO }] });

    expect(res.status).toBe(201);
    expect(res.body.vendorOrders).toHaveLength(1);
    expect(res.body.vendorOrders[0].id).toBe('vo-1');

    const reread = await request(app).get(`/api/client-orders/${id}`);
    expect(reread.body.vendorOrderIds).toEqual(['vo-1']);
  });

  it('returns 404 when parent ClientOrder does not exist', async () => {
    const res = await request(app)
      .post('/api/client-orders/missing/vendor-orders')
      .send({ vendorOrders: [{ vendorWorkType: ProductType.BPO }] });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CLIENT_ORDER_NOT_FOUND');
  });

  it('returns 400 when vendorOrders is not an array', async () => {
    const res = await request(app)
      .post('/api/client-orders/whatever/vendor-orders')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
