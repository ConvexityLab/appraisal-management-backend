/**
 * CollaborationController unit tests (Vitest)
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
 * Also tests container-registry GET and PUT routes (Cosmos-backed).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mock function references (vi.hoisted runs before hoisted vi.mock) ────────

const {
  mockIsConfigured,
  mockGenerateTokenService,
  mockGetDocument,
  mockUpsertDocument,
  mockGetUserProfile,
  mockCanAccess,
} = vi.hoisted(() => ({
  mockIsConfigured: vi.fn(),
  mockGenerateTokenService: vi.fn(),
  mockGetDocument: vi.fn(),
  mockUpsertDocument: vi.fn(),
  mockGetUserProfile: vi.fn(),
  mockCanAccess: vi.fn(),
}));

// ─── Mock the service modules ─────────────────────────────────────────────────

vi.mock('../../src/services/collaboration.service.js', () => ({
  CollaborationService: vi.fn().mockImplementation(() => ({
    isConfigured: mockIsConfigured,
    generateToken: mockGenerateTokenService,
  })),
}));

vi.mock('../../src/services/cosmos-db.service.js', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({
    getDocument: mockGetDocument,
    upsertDocument: mockUpsertDocument,
  })),
}));

vi.mock('../../src/services/authorization.service.js', () => ({
  AuthorizationService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
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

import { createCollaborationRouter } from '../../src/controllers/collaboration.controller.js';
import { CosmosDbService } from '../../src/services/cosmos-db.service.js';

// ─── Build test app ───────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/collaboration', attachTestUser, createCollaborationRouter(new CosmosDbService()));
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
    vi.clearAllMocks();
    process.env.AZURE_FLUID_RELAY_TENANT_ID = 'tenant-xyz';

    mockIsConfigured.mockReturnValue(true);
    mockGenerateTokenService.mockResolvedValue({
      token: 'test-fluid-jwt',
      tenantId: 'tenant-xyz',
      expiresAt: 9999999999,
    });

    mockGetDocument.mockResolvedValue(DEFAULT_RECORD);
    mockGetUserProfile.mockResolvedValue(DEFAULT_USER_PROFILE);
    mockCanAccess.mockResolvedValue({ allowed: true });

    app = buildApp();
  });

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

  it('returns 500 when generateToken throws a non-KV error', async () => {
    mockGenerateTokenService.mockRejectedValue(new Error('Unexpected internal failure'));

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ containerId: 'order-1' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('TOKEN_GENERATION_FAILED');
  });

  it('returns 503 when generateToken throws a Key Vault error', async () => {
    mockGenerateTokenService.mockRejectedValue(new Error('Key Vault unavailable'));

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ containerId: 'order-1' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('KEYVAULT_UNAVAILABLE');
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
    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ containerId: 'assignment-queue' });

    expect(res.status).toBe(200);
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

// ── Container Registry tests ──────────────────────────────────────────────────

describe('GET /api/collaboration/container-registry/:logicalId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertDocument.mockResolvedValue({});
    app = buildApp();
  });

  it('returns 401 when no authenticated user', async () => {
    const res = await request(app).get('/api/collaboration/container-registry/order-abc');
    expect(res.status).toBe(401);
  });

  it('returns 404 when logicalId is not registered', async () => {
    mockGetDocument.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/collaboration/container-registry/order-missing')
      .set('x-test-user-id', 'user-1');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 with serviceId when registered', async () => {
    mockGetDocument.mockResolvedValue({ id: 'order-abc', serviceId: 'fluid-uuid-123', tenantId: 'test-tenant' });
    const res = await request(app)
      .get('/api/collaboration/container-registry/order-abc')
      .set('x-test-user-id', 'user-1');
    expect(res.status).toBe(200);
    expect(res.body.data.serviceId).toBe('fluid-uuid-123');
  });

  it('returns 500 when Cosmos lookup throws', async () => {
    mockGetDocument.mockRejectedValue(new Error('Cosmos unavailable'));
    const res = await request(app)
      .get('/api/collaboration/container-registry/order-abc')
      .set('x-test-user-id', 'user-1');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('REGISTRY_LOOKUP_FAILED');
  });
});

describe('PUT /api/collaboration/container-registry/:logicalId', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertDocument.mockResolvedValue({});
    app = buildApp();
  });

  it('returns 401 when no authenticated user', async () => {
    const res = await request(app)
      .put('/api/collaboration/container-registry/order-abc')
      .send({ serviceId: 'fluid-uuid-123' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when serviceId is missing', async () => {
    const res = await request(app)
      .put('/api/collaboration/container-registry/order-abc')
      .set('x-test-user-id', 'user-1')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SERVICE_ID');
  });

  it('returns 200 and upserts to Cosmos on success', async () => {
    const res = await request(app)
      .put('/api/collaboration/container-registry/order-abc')
      .set('x-test-user-id', 'user-1')
      .set('x-test-tenant-id', 'tenant-xyz')
      .send({ serviceId: 'fluid-uuid-456' });
    expect(res.status).toBe(200);
    expect(res.body.data.serviceId).toBe('fluid-uuid-456');
    expect(mockUpsertDocument).toHaveBeenCalledWith(
      'fluid-container-registry',
      expect.objectContaining({
        id: 'order-abc',
        tenantId: 'tenant-xyz',
        serviceId: 'fluid-uuid-456',
        registeredBy: 'user-1',
      }),
    );
  });

  it('returns 500 when Cosmos upsert throws', async () => {
    mockUpsertDocument.mockRejectedValue(new Error('Cosmos unavailable'));
    const res = await request(app)
      .put('/api/collaboration/container-registry/order-abc')
      .set('x-test-user-id', 'user-1')
      .send({ serviceId: 'fluid-uuid-456' });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('REGISTRY_UPSERT_FAILED');
  });
});
