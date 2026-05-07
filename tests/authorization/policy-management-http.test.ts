/**
 * HTTP Authorization Tests — /api/policies
 *
 * Verifies that the policy management endpoints enforce the admin-only gate:
 *   - No token          → 401
 *   - Non-admin roles   → 403 AUTHORIZATION_DENIED
 *   - Admin role        → passes the auth gate (response may be 200/201/404/500
 *                         from the mock container, never 401/403)
 *
 * What is REAL:
 *   - JWT parsing & test-token validation (UnifiedAuthMiddleware)
 *   - Casbin engine loaded from real policy.csv / model.conf
 *   - Express middleware chain: authenticate → loadUserProfile → authorize
 *
 * What is MOCKED:
 *   - CosmosDbService (no live Azure Cosmos)
 *   - AuthorizationService.getUserProfile (returns crafted profiles)
 *
 * Covered routes:
 *   GET    /api/policies
 *   POST   /api/policies
 *   PUT    /api/policies/:id
 *   DELETE /api/policies/:id
 *   GET    /api/policies/:id/history
 *   POST   /api/policies/evaluate
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// ─── Env bootstrap (must precede any module import) ─────────────────────────
process.env.NODE_ENV = 'test';
process.env.ENFORCE_AUTHORIZATION = 'true';
process.env.AXIOM_CLIENT_ID = 'test-client-id';
process.env.AXIOM_SUB_CLIENT_ID = 'test-sub-client-id';

// ─── Mock CosmosDbService ────────────────────────────────────────────────────
vi.mock('../../src/services/cosmos-db.service.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/services/cosmos-db.service.js')>();
  const OriginalClass = mod.CosmosDbService;

  const fakeContainer = {
    items: {
      query: () => ({ fetchAll: async () => ({ resources: [] }) }),
      create: async () => ({ resource: null }),
      upsert: async () => ({ resource: null }),
      readAll: () => ({ fetchAll: async () => ({ resources: [] }) }),
    },
    item: (_id: string, _partitionKey?: string) => ({
      read: async () => ({ resource: null }),
      replace: async () => ({ resource: null }),
      delete: async () => ({}),
    }),
  };

  class MockedCosmosDbService extends OriginalClass {
    override async initialize(): Promise<void> { /* no-op */ }
    override getContainer(_name: string) { return fakeContainer as any; }
  }

  return { ...mod, CosmosDbService: MockedCosmosDbService };
});

import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { AuthorizationService } from '../../src/services/authorization.service.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import type { UserProfile } from '../../src/types/authorization.types.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT = 'policy-http-test-tenant';

function makeProfile(id: string, role: UserProfile['role']): UserProfile {
  return {
    id,
    email: `${role}@policy-test.dev`,
    name: `Test ${role}`,
    tenantId: TENANT,
    role,
    accessScope: {
      teamIds: [],
      departmentIds: [],
      managedClientIds: [],
      managedVendorIds: [],
      managedUserIds: [],
      regionIds: [],
      statesCovered: [],
      canViewAllOrders: false,
      canViewAllVendors: false,
      canOverrideQC: false,
    },
    boundEntityIds: [],
    isInternal: false,
    isActive: true,
    portalDomain: 'platform',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const TEST_USERS: Record<string, UserProfile> = {
  'pm-admin-uid':     makeProfile('pm-admin-uid', 'admin'),
  'pm-manager-uid':   makeProfile('pm-manager-uid', 'manager'),
  'pm-analyst-uid':   makeProfile('pm-analyst-uid', 'analyst'),
  'pm-appraiser-uid': makeProfile('pm-appraiser-uid', 'appraiser'),
  'pm-reviewer-uid':  makeProfile('pm-reviewer-uid', 'reviewer'),
};

// ─── Server setup ────────────────────────────────────────────────────────────

let app: Express;
let server: AppraisalManagementAPIServer;
let tokenGen: TestTokenGenerator;
let getUserProfileSpy: ReturnType<typeof vi.spyOn>;

function mintToken(userId: string): string {
  const profile = TEST_USERS[userId];
  return tokenGen.generateToken({
    id: userId,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    tenantId: TENANT,
    clientId: process.env.AXIOM_CLIENT_ID,
    subClientId: process.env.AXIOM_SUB_CLIENT_ID,
  });
}

beforeAll(async () => {
  getUserProfileSpy = vi.spyOn(
    AuthorizationService.prototype,
    'getUserProfile',
  ).mockImplementation(async (userId: string) => TEST_USERS[userId] ?? null);

  tokenGen = new TestTokenGenerator();
  server = new AppraisalManagementAPIServer(0);
  app = server.getExpressApp();
  await server.initDb();
}, 30_000);

afterAll(() => {
  getUserProfileSpy.mockRestore();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Assert a route returns 401 when no token is provided. */
async function assert401(method: 'get' | 'post' | 'put' | 'delete', path: string) {
  const res = await (request(app) as any)[method](path);
  expect(res.status, `${method.toUpperCase()} ${path} without token should → 401`).toBe(401);
}

/** Assert a route returns 403 for a given role token. */
async function assert403(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  userId: string,
  body?: Record<string, unknown>,
) {
  const token = mintToken(userId);
  let req = (request(app) as any)[method](path).set('Authorization', `Bearer ${token}`);
  if (body) req = req.send(body).set('Content-Type', 'application/json');
  const res = await req;
  expect(res.status, `${method.toUpperCase()} ${path} as ${TEST_USERS[userId].role} should → 403`).toBe(403);
}

/** Assert a route passes the auth gate (non-4xx or expected 404/500 from mock). */
async function assertAdminPasses(
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  body?: Record<string, unknown>,
) {
  const token = mintToken('pm-admin-uid');
  let req = (request(app) as any)[method](path).set('Authorization', `Bearer ${token}`);
  if (body) req = req.send(body).set('Content-Type', 'application/json');
  const res = await req;
  // Auth gate is the concern here; downstream mock may return 200/201/404/500.
  expect(
    [200, 201, 400, 404, 500].includes(res.status),
    `${method.toUpperCase()} ${path} as admin should pass auth gate — got ${res.status}: ${JSON.stringify(res.body)}`,
  ).toBe(true);
  expect(res.status, `Must NOT be 401 or 403`).not.toBe(401);
  expect(res.status).not.toBe(403);
}

const NON_ADMIN_IDS = ['pm-manager-uid', 'pm-analyst-uid', 'pm-appraiser-uid', 'pm-reviewer-uid'];
const SAMPLE_POLICY = {
  role: 'manager',
  resourceType: 'order',
  actions: ['read'],
  conditions: [],
  effect: 'allow',
  priority: 100,
  description: 'test policy',
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/policies
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/policies', () => {
  it('no token → 401', async () => { await assert401('get', '/api/policies'); });

  for (const uid of NON_ADMIN_IDS) {
    it(`${TEST_USERS[uid].role} → 403`, async () => {
      await assert403('get', '/api/policies', uid);
    });
  }

  it('admin → passes auth gate', async () => {
    await assertAdminPasses('get', '/api/policies');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/policies
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/policies', () => {
  it('no token → 401', async () => { await assert401('post', '/api/policies'); });

  for (const uid of NON_ADMIN_IDS) {
    it(`${TEST_USERS[uid].role} → 403`, async () => {
      await assert403('post', '/api/policies', uid, SAMPLE_POLICY);
    });
  }

  it('admin → passes auth gate', async () => {
    await assertAdminPasses('post', '/api/policies', SAMPLE_POLICY);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/policies/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/policies/:id', () => {
  const path = '/api/policies/some-policy-id';

  it('no token → 401', async () => { await assert401('put', path); });

  for (const uid of NON_ADMIN_IDS) {
    it(`${TEST_USERS[uid].role} → 403`, async () => {
      await assert403('put', path, uid, SAMPLE_POLICY);
    });
  }

  it('admin → passes auth gate (404 because mock returns no resource)', async () => {
    await assertAdminPasses('put', path, SAMPLE_POLICY);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/policies/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/policies/:id', () => {
  const path = '/api/policies/some-policy-id';

  it('no token → 401', async () => { await assert401('delete', path); });

  for (const uid of NON_ADMIN_IDS) {
    it(`${TEST_USERS[uid].role} → 403`, async () => {
      await assert403('delete', path, uid);
    });
  }

  it('admin → passes auth gate', async () => {
    await assertAdminPasses('delete', path);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/policies/:id/history
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/policies/:id/history', () => {
  const path = '/api/policies/some-policy-id/history';

  it('no token → 401', async () => { await assert401('get', path); });

  for (const uid of NON_ADMIN_IDS) {
    it(`${TEST_USERS[uid].role} → 403`, async () => {
      await assert403('get', path, uid);
    });
  }

  it('admin → passes auth gate and returns empty history array', async () => {
    const token = mintToken('pm-admin-uid');
    const res = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    // Mock container returns empty array → success with empty data
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/policies/evaluate
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/policies/evaluate', () => {
  it('no token → 401', async () => { await assert401('post', '/api/policies/evaluate'); });

  for (const uid of NON_ADMIN_IDS) {
    it(`${TEST_USERS[uid].role} → 403`, async () => {
      await assert403('post', '/api/policies/evaluate', uid, { resourceType: 'order', action: 'read' });
    });
  }

  it('admin → passes auth gate and returns QueryFilter', async () => {
    const token = mintToken('pm-admin-uid');
    const res = await request(app)
      .post('/api/policies/evaluate')
      .set('Authorization', `Bearer ${token}`)
      .send({ resourceType: 'order', action: 'read' })
      .set('Content-Type', 'application/json');

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('sql');
    }
  });
});
