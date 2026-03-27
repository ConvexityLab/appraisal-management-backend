/**
 * GSE Controller unit tests
 *
 * Tests all 6 routes via Express + supertest.
 * UCDPEADSubmissionService and the GSE provider factory are fully mocked.
 *
 * Scenarios covered (per route):
 *   POST /ucdp/submit/:orderId
 *     1.  401 when no user
 *     2.  400 when xmlContent missing
 *     3.  200 on accepted submission
 *     4.  502 when submission status is ERROR
 *     5.  500 when service.submit throws
 *
 *   GET /ucdp/status/:submissionId
 *     6.  401 when no user
 *     7.  200 on found submission
 *     8.  404 when service throws "not found"
 *     9.  500 on other error
 *
 *   GET /ucdp/order/:orderId
 *     10. 401 when no user
 *     11. 200 with submissions array
 *     12. 500 on error
 *
 *   POST /ead/submit/:orderId  (mirrors UCDP — auth + validation only)
 *     13. 400 when xmlContent missing
 *     14. 200 on accepted EAD submission
 *
 *   GET /ead/status/:submissionId
 *     15. 200 on found EAD submission
 *     16. 404 on "not found" error
 *
 *   GET /ead/order/:orderId
 *     17. 200 with EAD submissions array
 */

import express from 'express';
import request from 'supertest';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── Mock service methods ──────────────────────────────────────────────────────

const mockSubmit              = jest.fn<() => Promise<any>>();
const mockCheckSubmissionStatus = jest.fn<() => Promise<any>>();
const mockGetSubmissionsForOrder = jest.fn<() => Promise<any>>();

jest.mock('../services/ucdp-ead-submission.service', () => ({
  UCDPEADSubmissionService: jest.fn().mockImplementation(() => ({
    submit:                   mockSubmit,
    checkSubmissionStatus:    mockCheckSubmissionStatus,
    getSubmissionsForOrder:   mockGetSubmissionsForOrder,
  })),
}));

// The GSE factory is called inside createGseRouter; stub it out to avoid env checks
jest.mock('../services/gse-providers/factory', () => ({
  createGseProvider: () => ({}),
}));

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
      tenantId: (req.headers['x-test-tenant-id'] as string | undefined) ?? 'test-tenant',
    };
  }
  next();
}

// ─── Import router after mocks ────────────────────────────────────────────────

import { createGseRouter } from '../controllers/gse.controller.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  const db = new (CosmosDbService as any)();
  app.use('/api/gse', attachTestUser, createGseRouter(db));
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_SUBMISSION_RECORD = {
  id: 'sub-001',
  orderId: 'order-001',
  tenantId: 'test-tenant',
  portal: 'UCDP' as const,
  status: 'ACCEPTED' as const,
  portalDocumentId: 'doc-ucdp-001',
  ssrFindings: [],
  retryCount: 0,
  maxRetries: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_SUBMIT_RESULT = {
  submission: MOCK_SUBMISSION_RECORD,
  isAccepted: true,
  hardStopCount: 0,
  warningCount: 0,
};

const SAMPLE_XML = '<VALUATION_RESPONSE>...</VALUATION_RESPONSE>';

// ─── POST /ucdp/submit/:orderId ────────────────────────────────────────────────

describe('POST /api/gse/ucdp/submit/:orderId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmit.mockResolvedValue(MOCK_SUBMIT_RESULT);
    app = buildApp();
  });

  it('returns 401 when no user', async () => {
    const res = await request(app)
      .post('/api/gse/ucdp/submit/order-001')
      .send({ xmlContent: SAMPLE_XML });

    expect(res.status).toBe(401);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('returns 400 when xmlContent is missing', async () => {
    const res = await request(app)
      .post('/api/gse/ucdp/submit/order-001')
      .set('x-test-user-id', 'u-1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/xmlContent/i);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('returns 200 on accepted UCDP submission', async () => {
    const res = await request(app)
      .post('/api/gse/ucdp/submit/order-001')
      .set('x-test-user-id', 'u-1')
      .send({ xmlContent: SAMPLE_XML, loanNumber: 'LN-001' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.submission.id).toBe('sub-001');
    expect(res.body.data.isAccepted).toBe(true);
    expect(res.body.data.hardStopCount).toBe(0);

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-001',
        tenantId: 'test-tenant',
        portal: 'UCDP',
        xmlContent: SAMPLE_XML,
        loanNumber: 'LN-001',
      }),
    );
  });

  it('returns 502 when submission status is ERROR', async () => {
    mockSubmit.mockResolvedValue({
      ...MOCK_SUBMIT_RESULT,
      submission: { ...MOCK_SUBMISSION_RECORD, status: 'ERROR' },
    });

    const res = await request(app)
      .post('/api/gse/ucdp/submit/order-001')
      .set('x-test-user-id', 'u-1')
      .send({ xmlContent: SAMPLE_XML });

    expect(res.status).toBe(502);
    // success:true is intentional — the submit itself succeeded, status reflects GSE response
    expect(res.body.success).toBe(true);
  });

  it('returns 500 when service.submit throws', async () => {
    mockSubmit.mockRejectedValue(new Error('SOAP fault'));

    const res = await request(app)
      .post('/api/gse/ucdp/submit/order-001')
      .set('x-test-user-id', 'u-1')
      .send({ xmlContent: SAMPLE_XML });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('GSE_SUBMIT_ERROR');
    expect(res.body.error.message).toMatch(/SOAP fault/);
  });
});

// ─── GET /ucdp/status/:submissionId ───────────────────────────────────────────

describe('GET /api/gse/ucdp/status/:submissionId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckSubmissionStatus.mockResolvedValue(MOCK_SUBMIT_RESULT);
    app = buildApp();
  });

  it('returns 401 when no user', async () => {
    const res = await request(app).get('/api/gse/ucdp/status/sub-001');
    expect(res.status).toBe(401);
  });

  it('returns 200 with submission result', async () => {
    const res = await request(app)
      .get('/api/gse/ucdp/status/sub-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.submission.id).toBe('sub-001');
    expect(mockCheckSubmissionStatus).toHaveBeenCalledWith('sub-001', 'test-tenant');
  });

  it('returns 404 when service throws "not found"', async () => {
    mockCheckSubmissionStatus.mockRejectedValue(new Error('submission not found'));

    const res = await request(app)
      .get('/api/gse/ucdp/status/sub-missing')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 on other error', async () => {
    mockCheckSubmissionStatus.mockRejectedValue(new Error('database timeout'));

    const res = await request(app)
      .get('/api/gse/ucdp/status/sub-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('GSE_STATUS_ERROR');
  });
});

// ─── GET /ucdp/order/:orderId ──────────────────────────────────────────────────

describe('GET /api/gse/ucdp/order/:orderId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSubmissionsForOrder.mockResolvedValue([MOCK_SUBMIT_RESULT]);
    app = buildApp();
  });

  it('returns 401 when no user', async () => {
    const res = await request(app).get('/api/gse/ucdp/order/order-001');
    expect(res.status).toBe(401);
  });

  it('returns 200 with submissions array', async () => {
    const res = await request(app)
      .get('/api/gse/ucdp/order/order-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(mockGetSubmissionsForOrder).toHaveBeenCalledWith('order-001', 'test-tenant');
  });

  it('returns 500 on error', async () => {
    mockGetSubmissionsForOrder.mockRejectedValue(new Error('query failed'));

    const res = await request(app)
      .get('/api/gse/ucdp/order/order-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('GSE_LIST_ERROR');
  });
});

// ─── POST /ead/submit/:orderId ─────────────────────────────────────────────────

describe('POST /api/gse/ead/submit/:orderId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmit.mockResolvedValue({
      ...MOCK_SUBMIT_RESULT,
      submission: { ...MOCK_SUBMISSION_RECORD, portal: 'EAD' },
    });
    app = buildApp();
  });

  it('returns 400 when xmlContent is missing', async () => {
    const res = await request(app)
      .post('/api/gse/ead/submit/order-001')
      .set('x-test-user-id', 'u-1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 on accepted EAD submission with portal=EAD', async () => {
    const res = await request(app)
      .post('/api/gse/ead/submit/order-002')
      .set('x-test-user-id', 'u-1')
      .send({ xmlContent: SAMPLE_XML, lenderId: 'LENDER-001' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ portal: 'EAD', orderId: 'order-002', lenderId: 'LENDER-001' }),
    );
  });
});

// ─── GET /ead/status/:submissionId ────────────────────────────────────────────

describe('GET /api/gse/ead/status/:submissionId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 200 on found EAD submission', async () => {
    mockCheckSubmissionStatus.mockResolvedValue({
      ...MOCK_SUBMIT_RESULT,
      submission: { ...MOCK_SUBMISSION_RECORD, portal: 'EAD' },
    });

    const res = await request(app)
      .get('/api/gse/ead/status/sub-ead-001')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(200);
    expect(mockCheckSubmissionStatus).toHaveBeenCalledWith('sub-ead-001', 'test-tenant');
  });

  it('returns 404 when service throws "not found" for EAD', async () => {
    mockCheckSubmissionStatus.mockRejectedValue(new Error('EAD submission not found'));

    const res = await request(app)
      .get('/api/gse/ead/status/sub-missing')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── GET /ead/order/:orderId ───────────────────────────────────────────────────

describe('GET /api/gse/ead/order/:orderId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSubmissionsForOrder.mockResolvedValue([]);
    app = buildApp();
  });

  it('returns 200 with empty array when no EAD submissions', async () => {
    const res = await request(app)
      .get('/api/gse/ead/order/order-new')
      .set('x-test-user-id', 'u-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
    expect(mockGetSubmissionsForOrder).toHaveBeenCalledWith('order-new', 'test-tenant');
  });
});
