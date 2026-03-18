/**
 * LOS Controller unit tests
 *
 * Tests all three routes via a lightweight Express + supertest setup.
 * The LOS provider factory is fully mocked — no real LOS credentials needed.
 *
 * Scenarios covered:
 *   POST /orders/import
 *     1.  401 when no authenticated user
 *     2.  400 when loanNumber is missing
 *     3.  201 with import result on happy path
 *     4.  500 when provider.importOrder throws
 *
 *   POST /orders/:orderId/push
 *     5.  401 when no authenticated user
 *     6.  400 when loanNumber is missing
 *     7.  400 when statusCode is missing
 *     8.  200 on successful push
 *     9.  502 when provider returns success=false
 *     10. 500 when provider.pushOrder throws
 *
 *   GET /loans/:loanNumber
 *     11. 401 when no authenticated user
 *     12. 404 when provider returns null
 *     13. 200 with loan data on happy path
 *     14. 500 when provider.getLoan throws
 */

import express from 'express';
import request from 'supertest';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── Mock provider functions (module-scope so jest.mock factory can close over) ─

const mockImportOrder = jest.fn<() => Promise<any>>();
const mockPushOrder   = jest.fn<() => Promise<any>>();
const mockGetLoan     = jest.fn<() => Promise<any>>();

jest.mock('../services/los-providers/factory', () => ({
  createLosProvider: () => ({
    name: 'Mock LOS (test)',
    isAvailable: () => true,
    importOrder: mockImportOrder,
    pushOrder:   mockPushOrder,
    getLoan:     mockGetLoan,
  }),
}));

// CosmosDbService is passed into the router but not used in these routes —
// a minimal stub is sufficient.
jest.mock('../services/cosmos-db.service', () => ({
  CosmosDbService: jest.fn().mockImplementation(() => ({})),
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
      name: req.headers['x-test-user-name'] ?? id,
      tenantId: (req.headers['x-test-tenant-id'] as string | undefined) ?? 'test-tenant',
    };
  }
  next();
}

// ─── Import router after mocks ────────────────────────────────────────────────

import { createLosRouter } from '../controllers/los.controller.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  const db = new (CosmosDbService as any)();
  app.use('/api/los', attachTestUser, createLosRouter(db));
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_LOAN = {
  loanNumber: 'LN-001',
  borrowerName: 'Alice Appleton',
  loanAmountCents: 40000000,
  loanPurpose: 'Purchase',
  propertyAddress: '123 Main St',
  propertyCity: 'Springfield',
  propertyState: 'IL',
  propertyZip: '62701',
  losStatus: 'Processing',
  lenderName: 'Mock Mortgage Co.',
  loanOfficerName: 'Bob Broker',
  loanOfficerEmail: 'bob@mockmortgage.example',
};

const MOCK_IMPORT_RESULT = {
  orderId: 'mock-los-test-tenant-LN-001-1710000000000',
  loan: MOCK_LOAN,
  created: true,
};

const MOCK_PUSH_RESULT = {
  success: true,
  losConfirmationId: 'mock-los-confirm-9999',
  message: 'Mock LOS updated loan LN-001 to status Completed',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/los/orders/import', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 when no authenticated user', async () => {
    const res = await request(app)
      .post('/api/los/orders/import')
      .send({ loanNumber: 'LN-001' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(mockImportOrder).not.toHaveBeenCalled();
  });

  it('returns 400 when loanNumber is missing', async () => {
    const res = await request(app)
      .post('/api/los/orders/import')
      .set('x-test-user-id', 'u-1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/loanNumber/i);
    expect(mockImportOrder).not.toHaveBeenCalled();
  });

  it('returns 201 with import result on happy path', async () => {
    mockImportOrder.mockResolvedValue(MOCK_IMPORT_RESULT);

    const res = await request(app)
      .post('/api/los/orders/import')
      .set('x-test-user-id', 'u-1')
      .send({ loanNumber: 'LN-001' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderId).toBe(MOCK_IMPORT_RESULT.orderId);
    expect(res.body.data.loan.loanNumber).toBe('LN-001');
    expect(res.body.data.created).toBe(true);

    expect(mockImportOrder).toHaveBeenCalledWith(
      expect.objectContaining({ loanNumber: 'LN-001', tenantId: 'test-tenant' }),
    );
  });

  it('passes optional losFileId when provided', async () => {
    mockImportOrder.mockResolvedValue(MOCK_IMPORT_RESULT);

    await request(app)
      .post('/api/los/orders/import')
      .set('x-test-user-id', 'u-1')
      .send({ loanNumber: 'LN-001', losFileId: 'FILE-42' });

    expect(mockImportOrder).toHaveBeenCalledWith(
      expect.objectContaining({ loanNumber: 'LN-001', losFileId: 'FILE-42' }),
    );
  });

  it('returns 500 when provider.importOrder throws', async () => {
    mockImportOrder.mockRejectedValue(new Error('LOS connection refused'));

    const res = await request(app)
      .post('/api/los/orders/import')
      .set('x-test-user-id', 'u-1')
      .send({ loanNumber: 'LN-001' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('LOS_IMPORT_ERROR');
    expect(res.body.error.message).toMatch(/connection refused/i);
  });
});

describe('POST /api/los/orders/:orderId/push', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 when no authenticated user', async () => {
    const res = await request(app)
      .post('/api/los/orders/order-99/push')
      .send({ loanNumber: 'LN-001', statusCode: 'Completed' });

    expect(res.status).toBe(401);
    expect(mockPushOrder).not.toHaveBeenCalled();
  });

  it('returns 400 when loanNumber is missing', async () => {
    const res = await request(app)
      .post('/api/los/orders/order-99/push')
      .set('x-test-user-id', 'u-1')
      .send({ statusCode: 'Completed' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/loanNumber/i);
  });

  it('returns 400 when statusCode is missing', async () => {
    const res = await request(app)
      .post('/api/los/orders/order-99/push')
      .set('x-test-user-id', 'u-1')
      .send({ loanNumber: 'LN-001' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/statusCode/i);
  });

  it('returns 200 on successful push', async () => {
    mockPushOrder.mockResolvedValue(MOCK_PUSH_RESULT);

    const res = await request(app)
      .post('/api/los/orders/order-xyz/push')
      .set('x-test-user-id', 'u-1')
      .send({ loanNumber: 'LN-001', statusCode: 'Completed', appraisedValueCents: 45000000 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.losConfirmationId).toBe('mock-los-confirm-9999');

    expect(mockPushOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-xyz',
        loanNumber: 'LN-001',
        statusCode: 'Completed',
        appraisedValueCents: 45000000,
      }),
    );
  });

  it('returns 502 when provider returns success=false', async () => {
    mockPushOrder.mockResolvedValue({ success: false, losConfirmationId: null, message: 'Upstream rejected' });

    const res = await request(app)
      .post('/api/los/orders/order-99/push')
      .set('x-test-user-id', 'u-1')
      .send({ loanNumber: 'LN-001', statusCode: 'Completed' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when provider.pushOrder throws', async () => {
    mockPushOrder.mockRejectedValue(new Error('LOS timeout'));

    const res = await request(app)
      .post('/api/los/orders/order-99/push')
      .set('x-test-user-id', 'u-1')
      .send({ loanNumber: 'LN-001', statusCode: 'Completed' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('LOS_PUSH_ERROR');
  });
});

describe('GET /api/los/loans/:loanNumber', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 401 when no authenticated user', async () => {
    const res = await request(app).get('/api/los/loans/LN-001');

    expect(res.status).toBe(401);
    expect(mockGetLoan).not.toHaveBeenCalled();
  });

  it('returns 404 when provider returns null', async () => {
    mockGetLoan.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/los/loans/NOTFOUND')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 with loan data on happy path', async () => {
    mockGetLoan.mockResolvedValue(MOCK_LOAN);

    const res = await request(app)
      .get('/api/los/loans/LN-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.loanNumber).toBe('LN-001');
    expect(res.body.data.borrowerName).toBe('Alice Appleton');

    expect(mockGetLoan).toHaveBeenCalledWith('LN-001', 'test-tenant');
  });

  it('returns 500 when provider.getLoan throws', async () => {
    mockGetLoan.mockRejectedValue(new Error('Network error'));

    const res = await request(app)
      .get('/api/los/loans/LN-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('LOS_LOOKUP_ERROR');
  });
});
