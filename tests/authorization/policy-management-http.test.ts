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
 *   GET    /audit
 *   POST   /api/policies
 *   PUT    /api/policies/:id
 *   DELETE /api/policies/:id
 *   GET    /api/policies/:id/history
 *   POST   /api/policies/evaluate
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

// ─── Env bootstrap (must precede any module import) ─────────────────────────
// Defensive: tests/setup.ts also seeds these, but in some CI worker
// configurations the test file's beforeAll runs before setup.ts has populated
// process.env. Setting them here too makes the test self-contained.
process.env.NODE_ENV = 'test';
process.env.ENFORCE_AUTHORIZATION = 'true';
process.env.AXIOM_CLIENT_ID = 'test-client-id';
process.env.AXIOM_SUB_CLIENT_ID = 'test-sub-client-id';
process.env.INSPECTION_PROVIDER = process.env.INSPECTION_PROVIDER ?? 'ivueit';
process.env.IVUEIT_API_KEY = process.env.IVUEIT_API_KEY || 'test-placeholder-key';
process.env.IVUEIT_SECRET = process.env.IVUEIT_SECRET || 'test-placeholder-secret';
process.env.IVUEIT_BASE_URL = process.env.IVUEIT_BASE_URL ?? 'https://test-placeholder.ivueit.local';

// ─── Mock CosmosDbService ────────────────────────────────────────────────────
vi.mock('../../src/services/cosmos-db.service.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/services/cosmos-db.service.js')>();
  const OriginalClass = mod.CosmosDbService;
  const capabilityMod = await import('../../src/data/platform-capability-matrix.js');
  const capabilityDocs = capabilityMod.materializeAuthorizationCapabilityDocuments(
    capabilityMod.AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
    'test',
  );

  const fakeContainer = {
    items: {
      query: (querySpec?: { query?: string; parameters?: Array<{ name: string; value: unknown }> }) => ({
        fetchAll: async () => {
          if (querySpec?.query?.includes("c.type = 'authorization-capability'")) {
            const tenantId = querySpec.parameters?.find((parameter) => parameter.name === '@tenantId')?.value;
            return {
              resources: capabilityDocs.filter((doc) => doc.tenantId === tenantId),
            };
          }

          if (querySpec?.query?.includes("c.type = 'authorization-policy'")) {
            const tenantId = querySpec.parameters?.find((parameter) => parameter.name === '@tenantId')?.value;
            return {
              resources: SEEDED_POLICIES.filter((doc) => doc.tenantId === tenantId),
            };
          }

          return { resources: [] };
        },
      }),
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
import type { PolicyRule } from '../../src/types/policy.types.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT = 'policy-http-test-tenant';

function makeProfile(
  id: string,
  role: UserProfile['role'],
  overrides: Partial<Pick<UserProfile, 'portalDomain' | 'boundEntityIds' | 'clientId' | 'subClientId' | 'accessScope'>> = {},
): UserProfile {
  return {
    id,
    email: `${role}@policy-test.dev`,
    name: `Test ${role}`,
    tenantId: TENANT,
    role,
    clientId: overrides.clientId,
    subClientId: overrides.subClientId,
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
      ...overrides.accessScope,
    },
    boundEntityIds: overrides.boundEntityIds ?? [],
    isInternal: false,
    isActive: true,
    portalDomain: overrides.portalDomain ?? 'platform',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const TEST_USERS: Record<string, UserProfile> = {
  'pm-admin-uid':     makeProfile('pm-admin-uid', 'admin'),
  'pm-manager-uid':   makeProfile('pm-manager-uid', 'manager'),
  'pm-client-admin-uid': makeProfile('pm-client-admin-uid', 'manager', {
    portalDomain: 'client',
    boundEntityIds: ['client-123'],
    clientId: 'client-123',
    subClientId: 'sub-789',
  }),
  'pm-client-analyst-uid': makeProfile('pm-client-analyst-uid', 'analyst', {
    portalDomain: 'client',
    boundEntityIds: ['client-123'],
    clientId: 'client-123',
    subClientId: 'sub-789',
  }),
  'pm-analyst-uid':   makeProfile('pm-analyst-uid', 'analyst'),
  'pm-appraiser-uid': makeProfile('pm-appraiser-uid', 'appraiser'),
  'pm-reviewer-uid':  makeProfile('pm-reviewer-uid', 'reviewer'),
};

const SEEDED_POLICIES: PolicyRule[] = [
  {
    id: 'policy-3',
    type: 'authorization-policy',
    tenantId: TENANT,
    role: 'manager',
    resourceType: 'engagement',
    actions: ['read'],
    conditions: [],
    effect: 'allow',
    priority: 100,
    description: 'manager engagement read for client 123',
    clientId: 'client-123',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed',
  },
  {
    id: 'policy-2',
    type: 'authorization-policy',
    tenantId: TENANT,
    role: 'admin',
    resourceType: 'order',
    actions: ['read'],
    conditions: [],
    effect: 'allow',
    priority: 50,
    description: 'admin order read low priority',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed',
  },
  {
    id: 'policy-1',
    type: 'authorization-policy',
    tenantId: TENANT,
    role: 'admin',
    resourceType: 'order',
    actions: ['read'],
    conditions: [],
    effect: 'allow',
    priority: 200,
    description: 'admin order read high priority',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed',
  },
  {
    id: 'policy-4',
    type: 'authorization-policy',
    tenantId: TENANT,
    role: 'analyst',
    resourceType: 'escalation',
    actions: ['read'],
    conditions: [],
    effect: 'allow',
    priority: 125,
    description: 'analyst escalation read for client 123 sub 789',
    clientId: 'client-123',
    subClientId: 'sub-789',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed',
  },
  {
    id: 'policy-5',
    type: 'authorization-policy',
    tenantId: TENANT,
    role: 'analyst',
    resourceType: 'escalation',
    actions: ['read'],
    conditions: [],
    effect: 'allow',
    priority: 90,
    description: 'analyst escalation read for client 123 other sub',
    clientId: 'client-123',
    subClientId: 'sub-other',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed',
  },
  {
    id: 'policy-6',
    type: 'authorization-policy',
    tenantId: TENANT,
    role: 'manager',
    resourceType: 'engagement',
    actions: ['read'],
    conditions: [],
    effect: 'allow',
    priority: 100,
    description: 'manager engagement read for other client',
    clientId: 'client-999',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'seed',
  },
];

// ─── Server setup ────────────────────────────────────────────────────────────

let app: Application;
let server: AppraisalManagementAPIServer;
let tokenGen: TestTokenGenerator;
let getUserProfileSpy: { mockRestore: () => void };

function mintToken(userId: string): string {
  const profile = TEST_USERS[userId];
  return tokenGen.generateToken({
    id: userId,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    tenantId: TENANT,
    clientId: profile.clientId ?? process.env.AXIOM_CLIENT_ID,
    subClientId: profile.subClientId ?? process.env.AXIOM_SUB_CLIENT_ID,
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

const NON_ADMIN_IDS = ['pm-manager-uid', 'pm-client-analyst-uid', 'pm-analyst-uid', 'pm-appraiser-uid', 'pm-reviewer-uid'];
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

  it('admin → returns policies sorted by role, resource type, then priority desc', async () => {
    const token = mintToken('pm-admin-uid');
    const res = await request(app)
      .get('/api/policies')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((policy: PolicyRule) => policy.id)).toEqual([
      'policy-1',
      'policy-2',
      'policy-4',
      'policy-5',
      'policy-3',
      'policy-6',
    ]);
  });

  it('client admin → returns only their client and matching sub-client policies', async () => {
    const token = mintToken('pm-client-admin-uid');
    const res = await request(app)
      .get('/api/policies')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((policy: PolicyRule) => policy.id)).toEqual([
      'policy-4',
      'policy-3',
    ]);
  });

  it('client admin → supports scoped server-side filters', async () => {
    const token = mintToken('pm-client-admin-uid');
    const res = await request(app)
      .get('/api/policies?scope=sub-client-scoped&clientId=client-123&subClientId=sub-789')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((policy: PolicyRule) => policy.id)).toEqual(['policy-4']);
  });

  it('client admin → cannot request another client scope', async () => {
    const token = mintToken('pm-client-admin-uid');
    const res = await request(app)
      .get('/api/policies?clientId=client-999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('POLICY_SCOPE_FORBIDDEN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/policies
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/policies/audit', () => {
  const path = '/api/policies/audit';

  it('no token → 401', async () => { await assert401('get', path); });

  for (const uid of NON_ADMIN_IDS) {
    it(`${TEST_USERS[uid].role} → 403`, async () => {
      await assert403('get', path, uid);
    });
  }

  it('admin → passes auth gate and returns audit array', async () => {
    const token = mintToken('pm-admin-uid');
    const res = await request(app)
      .get(path)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// POST /api/policies
// ────────────────────────────────────────────────────────────────────────────

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

  it('client admin → can create a policy inside their scope', async () => {
    const token = mintToken('pm-client-admin-uid');
    const res = await request(app)
      .post('/api/policies')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...SAMPLE_POLICY, clientId: 'client-123', subClientId: 'sub-789' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
  });

  it('client admin → cannot create tenant-wide policy', async () => {
    const token = mintToken('pm-client-admin-uid');
    const res = await request(app)
      .post('/api/policies')
      .set('Authorization', `Bearer ${token}`)
      .send(SAMPLE_POLICY)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('POLICY_SCOPE_FORBIDDEN');
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
      expect(res.body.evaluatedUserId).toBe('pm-admin-uid');
    }
  });

  it('admin can evaluate a target user profile in the same tenant', async () => {
    const token = mintToken('pm-admin-uid');
    const res = await request(app)
      .post('/api/policies/evaluate')
      .set('Authorization', `Bearer ${token}`)
      .send({ resourceType: 'order', action: 'read', targetUserId: 'pm-manager-uid' })
      .set('Content-Type', 'application/json');

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.evaluatedUserId).toBe('pm-manager-uid');
    }
  });

  it('admin gets 404 for an unknown target user', async () => {
    const token = mintToken('pm-admin-uid');
    const res = await request(app)
      .post('/api/policies/evaluate')
      .set('Authorization', `Bearer ${token}`)
      .send({ resourceType: 'order', action: 'read', targetUserId: 'missing-user-id' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TARGET_USER_NOT_FOUND');
  });
});
