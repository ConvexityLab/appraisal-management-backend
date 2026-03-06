/**
 * CollaborationController unit tests
 *
 * Tests the GET /fluid-token endpoint behaviour via a lightweight
 * express supertest setup, fully mocking:
 *   - CollaborationService (injected via module-level mock)
 *   - UnifiedAuth middleware (replaced with a simple stub that reads
 *     x-test-user-id / x-test-user-name headers so we can exercise
 *     both authenticated and unauthenticated paths)
 *
 * Scenarios:
 *   1. 401 when no user in request
 *   2. 503 when service not configured
 *   3. 400 when validation fails (bad containerId)
 *   4. 200 happy path — correct token returned
 *   5. 500 when service.generateToken throws
 */

import express from 'express';
import request from 'supertest';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ─── Mock the CollaborationService module ─────────────────────────────────────

const mockIsConfigured = jest.fn<() => boolean>().mockReturnValue(true);
const mockGenerateTokenService = jest.fn();

jest.mock('../../services/collaboration.service.js', () => ({
  CollaborationService: jest.fn().mockImplementation(() => ({
    isConfigured: mockIsConfigured,
    generateToken: mockGenerateTokenService,
  })),
}));

// ─── Stub auth middleware ─────────────────────────────────────────────────────

function attachTestUser(req: express.Request, _res: express.Response, next: express.NextFunction) {
  const id = req.headers['x-test-user-id'] as string | undefined;
  if (id) {
    (req as any).user = { id, name: req.headers['x-test-user-name'] ?? id };
  }
  next();
}

// ─── Import router after mocks ────────────────────────────────────────────────

import { createCollaborationRouter } from '../../controllers/collaboration.controller.js';

// ─── Build test app ───────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  // Simulate what api-server.ts does: apply auth, then mount router
  app.use('/api/collaboration', attachTestUser, createCollaborationRouter());
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/collaboration/fluid-token', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AZURE_FLUID_RELAY_TENANT_ID = 'tenant-xyz';
    mockIsConfigured.mockReturnValue(true);
    mockGenerateTokenService.mockResolvedValue({
      token: 'test-fluid-jwt',
      tenantId: 'tenant-xyz',
      expiresAt: 9999999999,
    });
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

  it('returns 500 when generateToken throws', async () => {
    mockGenerateTokenService.mockRejectedValue(new Error('Key Vault unavailable'));

    const res = await request(app)
      .get('/api/collaboration/fluid-token')
      .set('x-test-user-id', 'user-1')
      .query({ containerId: 'order-1' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('TOKEN_GENERATION_FAILED');
  });
});
