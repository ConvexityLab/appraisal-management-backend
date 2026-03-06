/**
 * CollaborationController unit tests
 *
 * Tests the GET /fluid-token endpoint behaviour via a lightweight
 * express supertest setup, fully mocking:
 *   - CollaborationService (injected via module-level mock)
 *   - CosmosDbService (injected via module-level mock)
 *   - AuthorizationService (injected via module-level mock)
 *   - UnifiedAuth middleware (replaced with a simple stub that reads
 *     x-test-user-id / x-test-user-name / x-test-tenant-id headers so we can
 *     exercise both authenticated and unauthenticated paths)
 *
 * Scenarios:
 *   1.  401 when no user in request
 *   2.  503 when service not configured
 *   3.  400 when validation fails (bad containerId)
 *   4.  200 happy path — correct token returned
 *   5.  500 when service.generateToken throws
 *   6.  Correct userId/userName/containerId passed to generateToken
 *   7.  Works without containerId (new container)
 *   8.  Uses tenantId query param when provided
 *   9.  403 when employee lacks canAccess permission
 *   10. 403 when record not found
 *   11. 200 when vendor matches assignedVendorId
 *   12. 403 when external user has no matching ID
 *   13. 200 when queue container, user has a UserProfile (employee)
 *   14. 403 when queue container, user has no UserProfile (external)
 */

import express from 'express';
import request from 'supertest';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── Mock the service modules ─────────────────────────────────────────────────

const mockIsConfigured = jest.fn<() => boolean>().mockReturnValue(true);
const mockGenerateTokenService = jest.fn<() => Promise<any>>();

jest.mock('../services/collaboration.service', () => ({
  CollaborationService: jest.fn().mockImplementation(() => ({
    isConfigured: mockIsConfigured,
    generateToken: mockGenerateTokenService,
  })),
}));

const mockGetDocument = jest.fn<() => Promise<any>>();
jest.mock('../services/cosmos-db.service', () => ({
  CosmosDbService: jest.fn().mockImplementation(() => ({
    getDocument: mockGetDocument,
  })),
}));

const mockGetUserProfile = jest.fn<() => Promise<any>>();
const mockCanAccess = jest.fn<() => Promise<any>>();
jest.mock('../services/authorization.service', () => ({
  AuthorizationService: jest.fn().mockImplementation(() => ({
    getUserProfile: mockGetUserProfile,
    canAccess: mockCanAccess,
  })),
}));

// ─── Stub auth middleware ─────────────────────────────────────────────────────

function attachTestUser(req: express.Request, _res: express.Response, next: express.NextFunction) {
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

import { createCollaborationRouter } from '../controllers/collaboration.controller.js';

// ─── Build test app ───────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  // Simulate what api-server.ts does: apply auth, then mount router
  app.use('/api/collaboration', attachTestUser, createCollaborationRouter());
  return app;
}

// ─── Default record used in authorization mocks ───────────────────────────────

const DEFAULT_RECORD = {
  id: 'record-1',
  accessControl: {
    ownerId: 'user-1',
    assignedUserIds: ['user-1'],
    visibilityScope: 'TEAM' as const,
    tenantId: 'test-tenant',
  },
};

const DEFAULT_USER_PROFILE = {
  id: 'user-1',
  role: 'appraiser',
  email: 'user1@test.com',
  accessScope: { teamIds: [], departmentIds: [] },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/collaboration/fluid-token', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AZURE_FLUID_RELAY_TENANT_ID = 'tenant-xyz';

    // Collaboration service — defaults: configured + token ready
    mockIsConfigured.mockReturnValue(true);
    mockGenerateTokenService.mockResolvedValue({
      token: 'test-fluid-jwt',
      tenantId: 'tenant-xyz',
      expiresAt: 9999999999,
    });

    // Authorization layer — defaults: record exists, employee with access
    mockGetDocument.mockResolvedValue(DEFAULT_RECORD);
    mockGetUserProfile.mockResolvedValue(DEFAULT_USER_PROFILE);
    mockCanAccess.mockResolvedValue({ allowed: true });

    app = buildApp();
  });

  // ── Existing infrastructure tests ─────────────────────────────────────────

  it('returns 401 when no authenticated user', async () => {
    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .query({ containerId: 'order-1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 503 when service is not configured', async () => {
    mockIsConfigured.mockReturnValue(false);

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ containerId: 'order-1' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('COLLABORATION_NOT_CONFIGURED');
  });

  it('returns 200 with token on happy path', async () => {
    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .set('x-test-user-name', 'Alice')
      .query({ containerId: 'order-abc' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('test-fluid-jwt');
    expect(res.body.data.tenantId).toBe('tenant-xyz');
    expect(res.body.data.expiresAt).toBe(9999999999);
  });

  it('passes correct userId and userName to generateToken', async () => {
    await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-42')
      .set('x-test-user-name', 'Bob Smith')
      .query({ containerId: 'qc-999' });

    expect(mockGenerateTokenService).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-42',
        userName: 'Bob Smith',
        containerId: 'qc-999',
        tenantId: 'tenant-xyz',
      }),
    );
  });

  it('works without containerId (undefined → new container)', async () => {
    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(mockGenerateTokenService).toHaveBeenCalledWith(
      expect.objectContaining({ containerId: undefined }),
    );
  });

  it('uses tenantId query param when provided', async () => {
    await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ tenantId: 'override-tenant', containerId: 'order-1' });

    expect(mockGenerateTokenService).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'override-tenant' }),
    );
  });

  it('returns 500 when generateToken throws', async () => {
    mockGenerateTokenService.mockRejectedValue(new Error('Key Vault unavailable'));

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ containerId: 'order-1' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('TOKEN_GENERATION_FAILED');
  });

  // ── Per-record authorization tests ────────────────────────────────────────

  it('returns 403 when employee canAccess returns denied', async () => {
    mockCanAccess.mockResolvedValue({ allowed: false, reason: 'OUTSIDE_TEAM_SCOPE' });

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ containerId: 'order-abc' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COLLABORATION_ACCESS_DENIED');
    expect(res.body.error.reason).toBe('OUTSIDE_TEAM_SCOPE');
    expect(mockGenerateTokenService).not.toHaveBeenCalled();
  });

  it('returns 403 when the record is not found in Cosmos', async () => {
    mockGetDocument.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ containerId: 'order-missing' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COLLABORATION_ACCESS_DENIED');
    expect(res.body.error.reason).toBe('RECORD_NOT_FOUND');
    expect(mockGenerateTokenService).not.toHaveBeenCalled();
  });

  it('returns 200 when vendor matches assignedVendorId on the record', async () => {
    // External user — no UserProfile
    mockGetUserProfile.mockResolvedValue(null);
    mockGetDocument.mockResolvedValue({
      id: 'order-abc',
      assignedVendorId: 'vendor-99',
      accessControl: { ownerId: 'employee-1', assignedUserIds: [], visibilityScope: 'TEAM', tenantId: 'test-tenant' },
    });

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'vendor-99')
      .query({ containerId: 'order-abc' });

    expect(res.status).toBe(200);
    expect(mockCanAccess).not.toHaveBeenCalled();
  });

  it('returns 403 when external user has no matching ID on the record', async () => {
    mockGetUserProfile.mockResolvedValue(null);
    mockGetDocument.mockResolvedValue({
      id: 'order-abc',
      assignedVendorId: 'vendor-different',
      clientId: 'client-different',
      accessControl: { ownerId: 'employee-1', assignedUserIds: [], visibilityScope: 'TEAM', tenantId: 'test-tenant' },
    });

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'unrelated-user')
      .query({ containerId: 'order-abc' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COLLABORATION_ACCESS_DENIED');
    expect(mockGenerateTokenService).not.toHaveBeenCalled();
  });

  it('returns 200 for queue container when user has an internal UserProfile', async () => {
    // mockGetUserProfile already returns DEFAULT_USER_PROFILE by default
    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ containerId: 'assignment-queue' });

    expect(res.status).toBe(200);
    // getDocument should NOT be called for queue containers
    expect(mockGetDocument).not.toHaveBeenCalled();
  });

  it('returns 403 for queue container when user has no UserProfile (external)', async () => {
    mockGetUserProfile.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'vendor-99')
      .query({ containerId: 'acceptance-queue' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COLLABORATION_ACCESS_DENIED');
    expect(res.body.error.reason).toBe('EMPLOYEE_ONLY_CONTAINER');
    expect(mockGenerateTokenService).not.toHaveBeenCalled();
  });
});
