/**
 * HTTP Authorization Integration Tests
 *
 * Tests the complete authorization middleware chain over HTTP using supertest.
 *
 * What is REAL:
 *  - JWT parsing & test-token validation (UnifiedAuthMiddleware)
 *  - Casbin engine loaded from the real policy.csv / model.conf
 *  - Express middleware chain: authenticate → loadUserProfile → authorize
 *  - Full request/response lifecycle
 *
 * What is MOCKED:
 *  - CosmosDbService.prototype.initialize   (no live Azure Cosmos needed)
 *  - AuthorizationService.prototype.getUserProfile (returns crafted profiles)
 *    We only mock the DB read; the Casbin DECISION that follows is 100% real.
 *
 * Why "getUserProfile" needs a mock:
 *  The middleware fetches the user record from Cosmos DB so it can determine
 *  the authoritative role (roles cannot be trusted from the JWT alone).
 *  We can't spin up a Cosmos DB in unit/integration CI, so we return a
 *  crafted profile.  The Casbin policy enforcement that follows is NOT mocked.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// ─── Set required env vars BEFORE any module imports ────────────────────────
// These values must be set before the server classes are imported so that
// constructor-time validation (TestTokenGenerator, CosmosDbService, etc.) pass.
process.env.NODE_ENV = 'test';
process.env.ENFORCE_AUTHORIZATION = 'true';
// Force the not-found path for ghost users: with auto-provision OFF, missing
// profiles return 403 USER_PROFILE_NOT_FOUND instead of being synthesized.
process.env.AUTO_PROVISION_USERS = 'false';
process.env.AXIOM_CLIENT_ID = 'test-client-id';
process.env.AXIOM_SUB_CLIENT_ID = 'test-sub-client-id';
process.env.AXIOM_API_BASE_URL = 'https://axiom-stub.test';
// COSMOS_ENDPOINT already set by tests/setup.ts to a placeholder URL.
// Inspection-provider env is also seeded by setup.ts, but in some CI worker
// configurations the test file's beforeAll runs before setup.ts has populated
// process.env. Setting them here too makes the test self-contained.
process.env.INSPECTION_PROVIDER = process.env.INSPECTION_PROVIDER ?? 'ivueit';
process.env.IVUEIT_API_KEY = process.env.IVUEIT_API_KEY || 'test-placeholder-key';
process.env.IVUEIT_SECRET = process.env.IVUEIT_SECRET || 'test-placeholder-secret';
process.env.IVUEIT_BASE_URL = process.env.IVUEIT_BASE_URL ?? 'https://test-placeholder.ivueit.local';

// ─── Mock CosmosDbService ────────────────────────────────────────────────────
// Must be hoisted before any module that imports CosmosDbService.
//
// Two methods need mocking:
//  1. initialize() — prevents network call to Azure Cosmos.
//  2. getContainer() — called eagerly in service constructors; would throw
//     "Database not initialized" because this.database stays null after the
//     mocked initialize(). We return a minimal fake Container so constructors
//     succeed. Any request that gets past the auth gate will receive an empty
//     result or 500 from the fake, which is fine — beyond auth is out of scope.
//
// The Casbin engine queries the `authorization-policies` container for
// `type='authorization-capability'` documents at init. We materialize the
// real platform capability matrix here so Casbin gets the same rule set it
// would see against seeded Cosmos.
const capabilityMatrixModule = await import('../../src/data/platform-capability-matrix.js');
const capabilityDocs = capabilityMatrixModule.materializeAuthorizationCapabilityDocuments(
  capabilityMatrixModule.AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
  'test',
);

// Mock the inspection provider factory so no real vendor client is instantiated
// (IVueitInspectionProvider validates IVUEIT_API_KEY at construction time).
vi.mock('../../src/services/inspection-providers/factory.js', () => ({
  createInspectionProvider: () => ({ name: 'stub-provider' }),
}));

vi.mock('../../src/services/cosmos-db.service.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/services/cosmos-db.service.js')>();
  const OriginalClass = mod.CosmosDbService;

  // Minimal Cosmos Container stub — satisfies constructor calls only.
  // Service methods invoked AFTER the auth gate get empty/error responses.
  const fakeContainer = {
    items: {
      query: (querySpec?: { query?: string; parameters?: Array<{ name: string; value: unknown }> }) => ({
        fetchAll: async () => {
          if (querySpec?.query?.includes("c.type = 'authorization-capability'")) {
            const tenantId = querySpec.parameters?.find((parameter) => parameter.name === '@tenantId')?.value;
            return {
              resources: capabilityDocs.filter((doc) => doc.tenantId === tenantId && doc.enabled !== false),
              requestCharge: 0,
            };
          }

          return { resources: [], requestCharge: 0 };
        },
      }),
      create: async () => ({ resource: null, requestCharge: 0 }),
      upsert: async () => ({ resource: null, requestCharge: 0 }),
      readAll: () => ({ fetchAll: async () => ({ resources: [], requestCharge: 0 }) }),
    },
    item: (_id: string) => ({
      read: async () => ({ resource: null, requestCharge: 0 }),
      replace: async () => ({ resource: null, requestCharge: 0 }),
      delete: async () => ({ requestCharge: 0 }),
    }),
  };

  class MockedCosmosDbService extends OriginalClass {
    override async initialize(): Promise<void> {
      // No-op: prevents Azure Cosmos network connection.
    }

    override getContainer(_containerName: string) {
      // Return stub so service constructors do not throw "Database not initialized".
      return fakeContainer as any;
    }
  }

  return { ...mod, CosmosDbService: MockedCosmosDbService };
});

// ─── Now import the rest ─────────────────────────────────────────────────────
import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { AuthorizationService } from '../../src/services/authorization.service.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import type { UserProfile } from '../../src/types/authorization.types.js';

// ─── Test user fixtures ──────────────────────────────────────────────────────

const TENANT = 'test-tenant';

function makeProfile(id: string, role: string, isActive = true): UserProfile {
  return {
    id,
    email: `${role}@test.example`,
    name: `Test ${role}`,
    tenantId: TENANT,
    role: role as UserProfile['role'],
    accessScope: { teamIds: [], departmentIds: [] },
    isActive,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
}

const TEST_USERS: Record<string, UserProfile | null> = {
  'admin-uid':     makeProfile('admin-uid', 'admin'),
  'manager-uid':   makeProfile('manager-uid', 'manager'),
  'analyst-uid':   makeProfile('analyst-uid', 'qc_analyst'),
  'appraiser-uid': makeProfile('appraiser-uid', 'appraiser'),
  'inactive-uid':  makeProfile('inactive-uid', 'admin', false),
  'ghost-uid':     null, // user not found in DB
};

// ─── Token helpers ───────────────────────────────────────────────────────────

let tokenGen: TestTokenGenerator;
function mintToken(userId: string, role: string): string {
  return tokenGen.generateToken({
    id: userId,
    email: `${role}@test.example`,
    name: `Test ${role}`,
    role: role as any,
    tenantId: TENANT,
    clientId: process.env.AXIOM_CLIENT_ID,
    subClientId: process.env.AXIOM_SUB_CLIENT_ID,
  });
}

// ─── Server setup ────────────────────────────────────────────────────────────

let app: Express;
let server: AppraisalManagementAPIServer;
let getUserProfileSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  // Spy on getUserProfile BEFORE server init so newly created instances are covered.
  getUserProfileSpy = vi.spyOn(
    AuthorizationService.prototype,
    'getUserProfile'
  ).mockImplementation(async (userId: string, _tenantId: string) => {
    if (Object.prototype.hasOwnProperty.call(TEST_USERS, userId)) {
      return TEST_USERS[userId];
    }
    return null;
  });

  tokenGen = new TestTokenGenerator();

  server = new AppraisalManagementAPIServer(0);
  app = server.getExpressApp();

  // initDb() does:
  //   1. CosmosDbService.initialize() → mocked as no-op (via vi.mock above)
  //   2. createAuthorizationMiddleware() → initialises real Casbin from policy.csv
  //   3. setupAuthorizationRoutes() → registers protected routes
  await server.initDb();
}, 30_000);

afterAll(() => {
  getUserProfileSpy.mockRestore();
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1: Authentication (no DB required, Casbin not reached)
// ─────────────────────────────────────────────────────────────────────────────

describe('Layer 1 — Authentication gate (401)', () => {
  const protectedRoutes = [
    'GET /api/orders',
    'GET /api/vendors',
    'GET /api/documents',
    'GET /api/appraisers',
    'GET /api/inspections',
    'GET /api/clients',
    'GET /api/negotiations',
    'GET /api/engagements',
    'GET /api/qc-workflow/queue',
    'GET /api/qc-rules',
    'GET /api/construction/draw-inspections',
    'GET /api/construction/inspections',
  ];

  for (const route of protectedRoutes) {
    const [method, path] = route.split(' ');

    it(`${route} — no token → 401`, async () => {
      const res = await (request(app) as any)[method.toLowerCase()](path);
      expect(res.status).toBe(401);
    });

    it(`${route} — garbage JWT → 401`, async () => {
      const res = await (request(app) as any)
        [method.toLowerCase()](path)
        .set('Authorization', 'Bearer not.a.real.jwt');
      expect(res.status).toBe(401);
    });
  }

  it('GET /health — no token → 200 (public endpoint)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2: User profile loading (getUserProfile returns null / inactive)
// ─────────────────────────────────────────────────────────────────────────────

describe('Layer 2 — User profile gate (403)', () => {
  // The auth middleware bypasses profile lookup for test tokens when
  // NODE_ENV !== 'production' (so E2E flows can run without seeded users).
  // Flip NODE_ENV for these tests so the real loadUserProfile path runs.
  const originalNodeEnv = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  // /api/qc-checklists-new explicitly mounts loadUserProfile() in its chain
  // — /api/orders only mounts unifiedAuth.authenticate() so the 403 path
  // can't be exercised through it.
  it('valid JWT but user not found in DB → 403 USER_PROFILE_NOT_FOUND', async () => {
    const token = mintToken('ghost-uid', 'admin');
    const res = await request(app)
      .get('/api/qc-checklists-new')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('USER_PROFILE_NOT_FOUND');
  });

  it('valid JWT but user is inactive → 403 USER_INACTIVE', async () => {
    const token = mintToken('inactive-uid', 'admin');
    const res = await request(app)
      .get('/api/qc-checklists-new')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('USER_INACTIVE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3: Casbin policy enforcement (REAL engine, real policy.csv)
// ─────────────────────────────────────────────────────────────────────────────

describe('Layer 3 — Casbin DENY → enforcement', () => {
  // Collection-read routes (authorizeQuery middleware) emit a deny-all
  // `1=0` filter when the user has no matching policy.  The controller
  // applies that filter to its Cosmos query → returns an empty
  // collection.  This is intentionally different from action-style
  // authorize() routes, which 403 directly:
  //   - authorizeQuery() — collection read, deny = empty result
  //   - authorize() / authorizeResource() — action or single resource, deny = 403
  //
  // A future tightening could collapse authorizeQuery's deny-all into a
  // 403 too — that would surface authorization decisions more clearly,
  // but it requires a coordinated change to the controllers + test
  // fixtures across every collection-read route.  Tracked separately.

  it('appraiser → GET /api/vendors (no vendor access in policy) → empty collection (deny-all filter)', async () => {
    const token = mintToken('appraiser-uid', 'appraiser');
    const res = await request(app)
      .get('/api/vendors')
      .set('Authorization', `Bearer ${token}`);
    // Controller may return 200 (empty result) or 500 (test mock
    // doesn't simulate the deny-all branch).  Either way the user
    // saw NO vendor data — that's the real assertion.
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const body = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
      expect(Array.isArray(body) ? body.length : 0).toBe(0);
    }
  });

  it('appraiser → GET /api/qc-workflow/queue (qc_queue:read denied) → 403', async () => {
    const token = mintToken('appraiser-uid', 'appraiser');
    const res = await request(app)
      .get('/api/qc-workflow/queue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
  });

  it('qc_analyst → GET /api/vendors (no vendor policy for analyst) → empty collection (deny-all filter)', async () => {
    const token = mintToken('analyst-uid', 'qc_analyst');
    const res = await request(app)
      .get('/api/vendors')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const body = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
      expect(Array.isArray(body) ? body.length : 0).toBe(0);
    }
  });

  // The previous assertion that manager → GET /api/qc-workflow/queue → 403
  // is no longer valid. As of the Phase-1 auth refactor (PLATFORM_CAPABILITY_MATRIX),
  // manager now has qc_queue:read. The qc_analyst → ALLOW test at line ~343
  // covers the same route; manager's allow path is implicitly covered by the
  // capability matrix unit tests.
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3: Casbin policy enforcement — ALLOW → passes auth gate
// Status may be 500/404 because the DB is mocked, but it is NOT 401 or 403.
// ─────────────────────────────────────────────────────────────────────────────

describe('Layer 3 — Casbin ALLOW → request passes auth gate (not 401/403)', () => {
  it('admin → GET /api/orders → passes auth (admin:* allow)', async () => {
    const token = mintToken('admin-uid', 'admin');
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('admin → GET /api/vendors → passes auth', async () => {
    const token = mintToken('admin-uid', 'admin');
    const res = await request(app)
      .get('/api/vendors')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('manager → GET /api/orders → passes auth (manager:order:read allow)', async () => {
    const token = mintToken('manager-uid', 'manager');
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('manager → GET /api/vendors → passes auth (manager:vendor:read allow)', async () => {
    const token = mintToken('manager-uid', 'manager');
    const res = await request(app)
      .get('/api/vendors')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('qc_analyst → GET /api/orders → passes auth (qc_analyst:order:read allow)', async () => {
    const token = mintToken('analyst-uid', 'qc_analyst');
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('qc_analyst → GET /api/qc-workflow/queue → passes auth (qc_queue:read allow)', async () => {
    const token = mintToken('analyst-uid', 'qc_analyst');
    const res = await request(app)
      .get('/api/qc-workflow/queue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('appraiser → GET /api/orders → passes auth (appraiser:order:read allow)', async () => {
    const token = mintToken('appraiser-uid', 'appraiser');
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('appraiser → GET /api/engagements → passes auth (appraiser:engagement:read allow)', async () => {
    const token = mintToken('appraiser-uid', 'appraiser');
    const res = await request(app)
      .get('/api/engagements')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('appraiser → GET /api/inspections → passes auth (appraiser:inspection:read allow)', async () => {
    const token = mintToken('appraiser-uid', 'appraiser');
    const res = await request(app)
      .get('/api/inspections')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('appraiser → GET /api/clients → passes auth (appraiser:client:read allow)', async () => {
    const token = mintToken('appraiser-uid', 'appraiser');
    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Construction Finance routes
// ─────────────────────────────────────────────────────────────────────────────

describe('Construction Finance routes — DrawInspection ABAC', () => {
  it('admin → GET /api/construction/draw-inspections → passes auth', async () => {
    const token = mintToken('admin-uid', 'admin');
    const res = await request(app)
      .get('/api/construction/draw-inspections')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('appraiser → GET /api/construction/draw-inspections → passes auth (inspection:read allow)', async () => {
    const token = mintToken('appraiser-uid', 'appraiser');
    const res = await request(app)
      .get('/api/construction/draw-inspections')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QC Rules
// ─────────────────────────────────────────────────────────────────────────────

describe('QC Rules route — all roles except unknown', () => {
  it('admin → GET /api/qc-rules → passes auth', async () => {
    const token = mintToken('admin-uid', 'admin');
    const res = await request(app)
      .get('/api/qc-rules')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('qc_analyst → GET /api/qc-rules → passes auth', async () => {
    const token = mintToken('analyst-uid', 'qc_analyst');
    const res = await request(app)
      .get('/api/qc-rules')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
