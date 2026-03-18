/**
 * Portal Controller unit tests
 *
 * Tests all 5 routes via Express + supertest.
 * CosmosDbService is fully mocked — no Azure connection needed.
 *
 * Scenarios covered:
 *   GET /orders/:orderId
 *     1.  401 when no user
 *     2.  404 when Cosmos returns empty results
 *     3.  200 with portal-safe order fields only
 *     4.  500 on Cosmos error
 *
 *   GET /econsent/:orderId
 *     5.  401 when no user
 *     6.  200 with consent record
 *     7.  200 with null when no consent exists
 *
 *   POST /econsent/:orderId/sign
 *     8.  401 when no user
 *     9.  400 when borrowerName is missing
 *     10. 201 with consent record on sign
 *     11. 500 on upsert error
 *
 *   GET /delivery/:orderId
 *     12. 401 when no user
 *     13. 404 when no delivery receipt
 *     14. 200 with download URL
 *
 *   POST /rov
 *     15. 401 when no user
 *     16. 400 when orderId is missing
 *     17. 400 when reason is missing
 *     18. 201 on successful ROV submission
 *     19. 500 on upsert error
 */

import express from 'express';
import request from 'supertest';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── Mock Cosmos helpers ───────────────────────────────────────────────────────

const mockFetchAll = jest.fn<() => Promise<any>>();
const mockUpsert   = jest.fn<() => Promise<any>>();

// Container created fresh per getContainer call — reuse the same mock fns
const mockContainer = {
  items: {
    query: jest.fn(() => ({ fetchAll: mockFetchAll })),
    upsert: mockUpsert,
  },
};

const mockGetContainer = jest.fn(() => mockContainer);

jest.mock('../services/cosmos-db.service', () => ({
  CosmosDbService: jest.fn().mockImplementation(() => ({
    getContainer: mockGetContainer,
  })),
}));

// ─── Auth stub ─────────────────────────────────────────────────────────────────

function attachTestUser(
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
): void {
  const id = req.headers['x-test-user-id'] as string | undefined;
  if (id) {
    (req as any).user = {
      id,
      tenantId: (req.headers['x-test-tenant-id'] as string | undefined) ?? 'test-tenant',
    };
  }
  next();
}

// ─── Import router after mocks ────────────────────────────────────────────────

import { createPortalRouter } from '../controllers/portal.controller.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  const db = new (CosmosDbService as any)();
  app.use('/api/portal', attachTestUser, createPortalRouter(db));
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ORDER = {
  id: 'order-001',
  status: 'Completed',
  orderType: 'Full',
  propertyAddress: '123 Main St, Springfield IL 62701',
  effectiveDueDate: '2026-02-01',
  submittedAt: '2026-01-01T00:00:00Z',
  completedAt: '2026-01-15T00:00:00Z',
  deliveredAt: '2026-01-16T00:00:00Z',
  borrowerName: 'Alice Appleton',
  loanNumber: 'LN-001',
  // These internal fields should NOT be returned by the portal route:
  internalNotes: 'Appraiser comment — MUST NOT leak',
  appraiserId: 'appraiser-secret-id',
};

const MOCK_CONSENT = {
  id: 'consent-order-001-abc',
  type: 'econsent',
  orderId: 'order-001',
  status: 'given',
  consentGivenAt: '2026-01-02T00:00:00Z',
  deliveryMethod: 'EMAIL',
  language: 'en',
};

const MOCK_DELIVERY_RECEIPT = {
  id: 'receipt-order-001',
  orderId: 'order-001',
  deliveryMethod: 'EMAIL',
  downloadUrl: 'https://storage.example.com/reports/order-001.pdf',
  deliveredAt: '2026-01-16T08:00:00Z',
  reportType: 'URAR',
};

// ─── GET /orders/:orderId ──────────────────────────────────────────────────────

describe('GET /api/portal/orders/:orderId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
    mockContainer.items.query.mockReturnValue({ fetchAll: mockFetchAll });
  });

  it('returns 401 when no user', async () => {
    const res = await request(app).get('/api/portal/orders/order-001');

    expect(res.status).toBe(401);
    expect(mockFetchAll).not.toHaveBeenCalled();
  });

  it('returns 404 when Cosmos returns no results', async () => {
    mockFetchAll.mockResolvedValue({ resources: [] });

    const res = await request(app)
      .get('/api/portal/orders/order-999')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 with portal-safe fields only', async () => {
    mockFetchAll.mockResolvedValue({ resources: [MOCK_ORDER] });

    const res = await request(app)
      .get('/api/portal/orders/order-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.id).toBe('order-001');
    expect(data.status).toBe('Completed');
    expect(data.borrowerName).toBe('Alice Appleton');
    expect(data.loanNumber).toBe('LN-001');

    // Internal fields must NOT appear in the portal response
    expect(data.internalNotes).toBeUndefined();
    expect(data.appraiserId).toBeUndefined();
  });

  it('returns 500 on Cosmos error', async () => {
    mockFetchAll.mockRejectedValue(new Error('Cosmos query failed'));

    const res = await request(app)
      .get('/api/portal/orders/order-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

// ─── GET /econsent/:orderId ────────────────────────────────────────────────────

describe('GET /api/portal/econsent/:orderId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
    mockContainer.items.query.mockReturnValue({ fetchAll: mockFetchAll });
  });

  it('returns 401 when no user', async () => {
    const res = await request(app).get('/api/portal/econsent/order-001');
    expect(res.status).toBe(401);
  });

  it('returns 200 with consent record when found', async () => {
    mockFetchAll.mockResolvedValue({ resources: [MOCK_CONSENT] });

    const res = await request(app)
      .get('/api/portal/econsent/order-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('given');
    expect(res.body.data.deliveryMethod).toBe('EMAIL');
  });

  it('returns 200 with null when no consent record exists', async () => {
    mockFetchAll.mockResolvedValue({ resources: [] });

    const res = await request(app)
      .get('/api/portal/econsent/order-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

// ─── POST /econsent/:orderId/sign ──────────────────────────────────────────────

describe('POST /api/portal/econsent/:orderId/sign', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
    mockUpsert.mockResolvedValue({ resource: {} });
  });

  it('returns 401 when no user', async () => {
    const res = await request(app)
      .post('/api/portal/econsent/order-001/sign')
      .send({ borrowerName: 'Alice Appleton' });

    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 400 when borrowerName is missing', async () => {
    const res = await request(app)
      .post('/api/portal/econsent/order-001/sign')
      .set('x-test-user-id', 'u-1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/borrowerName/i);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 201 with consent record on successful sign', async () => {
    const res = await request(app)
      .post('/api/portal/econsent/order-001/sign')
      .set('x-test-user-id', 'u-1')
      .send({ borrowerName: 'Alice Appleton', deliveryMethod: 'EMAIL', language: 'en' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderId).toBe('order-001');
    expect(res.body.data.borrowerName).toBe('Alice Appleton');
    expect(res.body.data.status).toBe('given');
    expect(res.body.data.type).toBe('econsent');
    expect(res.body.data.consentGivenAt).toBeDefined();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when upsert throws', async () => {
    mockUpsert.mockRejectedValue(new Error('write throttled'));

    const res = await request(app)
      .post('/api/portal/econsent/order-001/sign')
      .set('x-test-user-id', 'u-1')
      .send({ borrowerName: 'Alice Appleton' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

// ─── GET /delivery/:orderId ────────────────────────────────────────────────────

describe('GET /api/portal/delivery/:orderId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
    mockContainer.items.query.mockReturnValue({ fetchAll: mockFetchAll });
  });

  it('returns 401 when no user', async () => {
    const res = await request(app).get('/api/portal/delivery/order-001');
    expect(res.status).toBe(401);
  });

  it('returns 404 when no delivery receipt found', async () => {
    mockFetchAll.mockResolvedValue({ resources: [] });

    const res = await request(app)
      .get('/api/portal/delivery/order-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_DELIVERED');
  });

  it('returns 200 with download URL when receipt exists', async () => {
    mockFetchAll.mockResolvedValue({ resources: [MOCK_DELIVERY_RECEIPT] });

    const res = await request(app)
      .get('/api/portal/delivery/order-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.downloadUrl).toBe('https://storage.example.com/reports/order-001.pdf');
    expect(res.body.data.deliveryMethod).toBe('EMAIL');
    expect(res.body.data.reportType).toBe('URAR');
    expect(res.body.data.orderId).toBe('order-001');
  });
});

// ─── POST /rov ─────────────────────────────────────────────────────────────────

describe('POST /api/portal/rov', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
    mockUpsert.mockResolvedValue({ resource: {} });
  });

  it('returns 401 when no user', async () => {
    const res = await request(app)
      .post('/api/portal/rov')
      .send({ orderId: 'order-001', reason: 'Value seems low' });

    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns 400 when orderId is missing', async () => {
    const res = await request(app)
      .post('/api/portal/rov')
      .set('x-test-user-id', 'u-1')
      .send({ reason: 'Value seems low' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/orderId/i);
  });

  it('returns 400 when reason is missing', async () => {
    const res = await request(app)
      .post('/api/portal/rov')
      .set('x-test-user-id', 'u-1')
      .send({ orderId: 'order-001' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/reason/i);
  });

  it('returns 201 with rovId and SUBMITTED status on success', async () => {
    const res = await request(app)
      .post('/api/portal/rov')
      .set('x-test-user-id', 'u-1')
      .send({
        orderId: 'order-001',
        reason: 'Comparable sales support a higher value',
        comps: [{ address: '456 Elm St', salePrice: 540000 }],
        contactName: 'Alice Appleton',
        contactEmail: 'alice@example.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.rovId).toMatch(/^rov-portal-/);
    expect(res.body.data.submittedAt).toBeDefined();
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    const upserted = (mockUpsert as jest.Mock).mock.calls[0]![0] as Record<string, unknown>;
    expect(upserted['orderId']).toBe('order-001');
    expect(upserted['source']).toBe('portal');
    expect((upserted['comps'] as unknown[]).length).toBe(1);
  });

  it('returns 500 when upsert throws', async () => {
    mockUpsert.mockRejectedValue(new Error('Cosmos partition key error'));

    const res = await request(app)
      .post('/api/portal/rov')
      .set('x-test-user-id', 'u-1')
      .send({ orderId: 'order-001', reason: 'Value seems low' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
