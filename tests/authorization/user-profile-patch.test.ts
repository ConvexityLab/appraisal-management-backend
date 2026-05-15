/**
 * HTTP Authorization Tests — PATCH /api/users/:userId/role
 *                            PATCH /api/users/:userId/access-scope
 *
 * Verifies:
 *   1. Auth gate: no token → 401; non-admin → 403; admin → passes
 *   2. Audit log: admin patch emits a logger.info call with actor/target/role
 *   3. Cross-tenant isolation: an admin from tenant-B cannot read/modify a user
 *      in tenant-A.  The controller reads `req.userProfile.tenantId`, so it will
 *      query against the caller's tenant.  If the target userId belongs to a
 *      different tenant, the service returns null → 404 (no data leak, no
 *      cross-tenant mutation).
 *
 * What is REAL:
 *   - JWT parsing (UnifiedAuthMiddleware)
 *   - Casbin engine from real policy.csv / model.conf
 *   - Express middleware chain: authenticate → loadUserProfile → authorize
 *
 * What is MOCKED:
 *   - CosmosDbService (no live Azure Cosmos)
 *   - AuthorizationService.getUserProfile (returns crafted profiles)
 *   - UserProfileService.updateRole / patchAccessScope (returns stub profiles)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

const auditWrites: Array<Record<string, unknown>> = [];

function getUserAdminMutationAudits(): Array<Record<string, unknown>> {
  return auditWrites.filter((entry) => entry.type === 'user-admin-mutation');
}

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

          if (querySpec?.query?.includes("c.type = 'user-admin-mutation'")) {
            const tenantId = querySpec.parameters?.find((parameter) => parameter.name === '@tenantId')?.value;
            const targetUserId = querySpec.parameters?.find((parameter) => parameter.name === '@targetUserId')?.value;
            return {
              resources: auditWrites.filter((entry) => {
                if (entry.tenantId !== tenantId) return false;
                if (targetUserId && entry.targetUserId !== targetUserId) return false;
                return entry.type === 'user-admin-mutation';
              }),
            };
          }

          return { resources: [] };
        },
      }),
      create: async () => ({ resource: null }),
      upsert: async () => ({ resource: null }),
      readAll: () => ({ fetchAll: async () => ({ resources: [] }) }),
    },
    item: (_id: string, _pk?: string) => ({
      read: async () => ({ resource: null }),
      replace: async () => ({ resource: null }),
      delete: async () => ({}),
    }),
  };

  class MockedCosmosDbService extends OriginalClass {
    override async initialize(): Promise<void> { /* no-op */ }
    override getContainer(_name: string) { return fakeContainer as any; }
    override async upsertDocument<T>(_containerName: string, document: T): Promise<T> {
      auditWrites.push(document as Record<string, unknown>);
      return document;
    }
  }

  return { ...mod, CosmosDbService: MockedCosmosDbService };
});

// ─── Mock UserProfileService ─────────────────────────────────────────────────
// Applied AFTER CosmosDb mock so service constructors succeed.
vi.mock('../../src/services/user-profile.service.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/services/user-profile.service.js')>();
  const OriginalClass = mod.UserProfileService;

  type UserProfile = import('../../src/types/authorization.types.js').UserProfile;

  class MockedUserProfileService extends OriginalClass {
    override async syncUserProfile(request: any): Promise<UserProfile> {
      return {
        id: 'user_new_user_tenant_a_dev',
        email: request.email,
        name: request.name,
        azureAdObjectId: request.azureAdObjectId,
        tenantId: request.tenantId,
        role: request.role,
        portalDomain: request.portalDomain,
        boundEntityIds: request.boundEntityIds ?? [],
        isInternal: request.isInternal ?? false,
        accessScope: {
          teamIds: request.accessScope?.teamIds ?? [],
          departmentIds: request.accessScope?.departmentIds ?? [],
        },
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };
    }

    override async updateRole(userId: string, tenantId: string, _newRole: any): Promise<UserProfile | null> {
      // Simulate cross-tenant isolation: only find users in tenant-A
      if (tenantId !== 'tenant-a') return null;
      if (userId !== 'user-in-tenant-a') return null;
      return {
        id: userId,
        email: 'target@tenant-a.dev',
        name: 'Target User',
        tenantId: 'tenant-a',
        role: _newRole,
        portalDomain: 'platform',
        boundEntityIds: [],
        accessScope: { teamIds: [], departmentIds: [] },
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };
    }

    override async patchAccessScope(userId: string, tenantId: string, _updates: any): Promise<UserProfile | null> {
      if (tenantId !== 'tenant-a') return null;
      if (userId !== 'user-in-tenant-a') return null;
      return {
        id: userId,
        email: 'target@tenant-a.dev',
        name: 'Target User',
        tenantId: 'tenant-a',
        role: 'appraiser',
        portalDomain: 'platform',
        boundEntityIds: [],
        accessScope: { teamIds: _updates.teamIds ?? [], departmentIds: [] },
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };
    }

    override async getUserProfile(userId: string, tenantId: string): Promise<UserProfile | null> {
      if (tenantId !== 'tenant-a') return null;
      if (userId !== 'user-in-tenant-a') return null;
      return {
        id: userId,
        email: 'target@tenant-a.dev',
        name: 'Target User',
        tenantId: 'tenant-a',
        role: 'appraiser',
        portalDomain: 'platform',
        boundEntityIds: [],
        accessScope: { teamIds: [], departmentIds: [] },
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
    }

    override async deactivateUser(userId: string, tenantId: string): Promise<UserProfile | null> {
      if (tenantId !== 'tenant-a') return null;
      if (userId !== 'user-in-tenant-a') return null;
      return {
        id: userId,
        email: 'target@tenant-a.dev',
        name: 'Target User',
        tenantId: 'tenant-a',
        role: 'appraiser',
        portalDomain: 'platform',
        boundEntityIds: [],
        accessScope: { teamIds: [], departmentIds: [] },
        isActive: false,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };
    }

    override async reactivateUser(userId: string, tenantId: string): Promise<UserProfile | null> {
      if (tenantId !== 'tenant-a') return null;
      if (userId !== 'user-in-tenant-a') return null;
      return {
        id: userId,
        email: 'target@tenant-a.dev',
        name: 'Target User',
        tenantId: 'tenant-a',
        role: 'appraiser',
        portalDomain: 'platform',
        boundEntityIds: [],
        accessScope: { teamIds: [], departmentIds: [] },
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };
    }

    override async updateActiveStatus(userId: string, tenantId: string, status: 'active' | 'inactive'): Promise<UserProfile | null> {
      if (tenantId !== 'tenant-a') return null;
      if (userId !== 'user-in-tenant-a') return null;
      return {
        id: userId,
        email: 'target@tenant-a.dev',
        name: 'Target User',
        tenantId: 'tenant-a',
        role: 'appraiser',
        portalDomain: 'platform',
        boundEntityIds: [],
        accessScope: { teamIds: [], departmentIds: [] },
        isActive: status === 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };
    }
  }

  return { ...mod, UserProfileService: MockedUserProfileService };
});

import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { AuthorizationService } from '../../src/services/authorization.service.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import { Logger } from '../../src/utils/logger.js';
import type { UserProfile } from '../../src/types/authorization.types.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

function makeProfile(id: string, role: UserProfile['role'], tenantId: string = TENANT_A): UserProfile {
  return {
    id,
    email: `${role}@${tenantId}.dev`,
    name: `Test ${role}`,
    tenantId,
    role,
    portalDomain: 'platform',
    boundEntityIds: [],
    accessScope: { teamIds: [], departmentIds: [] },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
}

// Users from tenant-A:  admin, manager, analyst
// Users from tenant-B:  admin (cross-tenant scenario)
const TEST_USERS: Record<string, UserProfile> = {
  'up-admin-a-uid':   makeProfile('up-admin-a-uid', 'admin', TENANT_A),
  'up-manager-a-uid': makeProfile('up-manager-a-uid', 'manager', TENANT_A),
  'up-analyst-a-uid': makeProfile('up-analyst-a-uid', 'analyst', TENANT_A),
  'up-admin-b-uid':   makeProfile('up-admin-b-uid', 'admin', TENANT_B),
};

let tokenGen: TestTokenGenerator;
let getUserProfileSpy: any;

function mintToken(userId: string): string {
  const profile = TEST_USERS[userId];
  return tokenGen.generateToken({
    id: userId,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    tenantId: profile.tenantId,
    clientId: process.env.AXIOM_CLIENT_ID,
    subClientId: process.env.AXIOM_SUB_CLIENT_ID,
  });
}

// ─── Server lifecycle ─────────────────────────────────────────────────────────

let app: Application;
let server: AppraisalManagementAPIServer;

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

beforeEach(() => {
  auditWrites.length = 0;
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/users/:userId/role
// ──────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/users/:userId/role', () => {
  describe('auth gate', () => {
    it('no token → 401', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/role')
        .send({ role: 'manager' });
      expect(res.status).toBe(401);
    });

    it('manager → 403', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/role')
        .set('Authorization', `Bearer ${mintToken('up-manager-a-uid')}`)
        .send({ role: 'manager' });
      expect(res.status).toBe(403);
    });

    it('analyst → 403', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/role')
        .set('Authorization', `Bearer ${mintToken('up-analyst-a-uid')}`)
        .send({ role: 'manager' });
      expect(res.status).toBe(403);
    });

    it('admin → passes auth gate (200)', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/role')
        .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
        .send({ role: 'manager' });
      // Auth gate passed; service will return 200 or 404 (never 401/403)
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect([200, 404]).toContain(res.status);
    });

    it('missing role body → 400', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/role')
        .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('audit log', () => {
    it('emits logger.info("User role patched via API") with actor/target/role/tenantId on success', async () => {
      const infoSpy = vi.spyOn(Logger.prototype, 'info');

      await request(app)
        .patch('/api/users/user-in-tenant-a/role')
        .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
        .send({ role: 'manager' });

      const auditCalls = infoSpy.mock.calls.filter((args) => args[0] === 'User role patched via API');
      expect(auditCalls.length).toBeGreaterThan(0);

      const payload = auditCalls[0][1] as Record<string, unknown>;
      expect(payload).toMatchObject({
        actorId: 'up-admin-a-uid',
        targetUserId: 'user-in-tenant-a',
        newRole: 'manager',
        tenantId: TENANT_A,
      });

      infoSpy.mockRestore();
    });

    it('writes a durable audit-trail mutation entry on success', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/role')
        .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
        .send({ role: 'manager' });

      expect(res.status).toBe(200);
      const mutationAudits = getUserAdminMutationAudits();
      expect(mutationAudits).toHaveLength(1);
      expect(mutationAudits[0]).toMatchObject({
        type: 'user-admin-mutation',
        action: 'user-profile.role-patched',
        tenantId: TENANT_A,
        actorUserId: 'up-admin-a-uid',
        targetUserId: 'user-in-tenant-a',
        metadata: {
          previousRole: 'appraiser',
          newRole: 'manager',
        },
      });
    });
  });

  describe('cross-tenant isolation', () => {
    it('admin from tenant-B trying to patch a tenant-A user → 404 (not found in B, no data leak)', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/role')
        .set('Authorization', `Bearer ${mintToken('up-admin-b-uid')}`)
        .send({ role: 'manager' });

      // Auth gate passes (admin role), but the service scopes the query to
      // req.userProfile.tenantId = tenant-B, so the user is not found → 404 or 500.
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect([404, 500]).toContain(res.status);
    });
  });
});

describe('POST /api/users', () => {
  it('no token → 401', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({
        email: 'new.user@tenant-a.dev',
        name: 'New User',
        azureAdObjectId: 'entra-new-user',
        role: 'manager',
        portalDomain: 'platform',
        boundEntityIds: [],
      });
    expect(res.status).toBe(401);
  });

  it('manager → 403', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mintToken('up-manager-a-uid')}`)
      .send({
        email: 'new.user@tenant-a.dev',
        name: 'New User',
        azureAdObjectId: 'entra-new-user',
        role: 'manager',
        portalDomain: 'platform',
        boundEntityIds: [],
      });
    expect(res.status).toBe(403);
  });

  it('admin provisions a user profile → 201', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
      .send({
        email: 'new.user@tenant-a.dev',
        name: 'New User',
        azureAdObjectId: 'entra-new-user',
        role: 'manager',
        portalDomain: 'platform',
        boundEntityIds: [],
        accessScope: { teamIds: ['team-a'], departmentIds: ['dept-a'] },
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      email: 'new.user@tenant-a.dev',
      tenantId: TENANT_A,
      role: 'manager',
      portalDomain: 'platform',
      accessScope: { teamIds: ['team-a'], departmentIds: ['dept-a'] },
    });

    const mutationAudits = getUserAdminMutationAudits();
    expect(mutationAudits).toHaveLength(1);
    expect(mutationAudits[0]).toMatchObject({
      type: 'user-admin-mutation',
      action: 'user-profile.provisioned',
      tenantId: TENANT_A,
      actorUserId: 'up-admin-a-uid',
      targetUserId: 'user_new_user_tenant_a_dev',
    });
  });

  it('admin missing portalDomain → 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
      .send({
        email: 'new.user@tenant-a.dev',
        name: 'New User',
        azureAdObjectId: 'entra-new-user',
        role: 'manager',
        boundEntityIds: [],
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_PORTAL_DOMAIN');
  });
});

describe('GET /api/users/audit', () => {
  it('no token → 401', async () => {
    const res = await request(app).get('/api/users/audit');
    expect(res.status).toBe(401);
  });

  it('manager → 403', async () => {
    const res = await request(app)
      .get('/api/users/audit')
      .set('Authorization', `Bearer ${mintToken('up-manager-a-uid')}`);
    expect(res.status).toBe(403);
  });

  it('admin lists user admin mutation audits for the tenant', async () => {
    const res = await request(app)
      .get('/api/users/audit')
      .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /api/users/:userId/access-scope
// ──────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/users/:userId/access-scope', () => {
  describe('auth gate', () => {
    it('no token → 401', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/access-scope')
        .send({ teamIds: ['t1'] });
      expect(res.status).toBe(401);
    });

    it('manager → 403', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/access-scope')
        .set('Authorization', `Bearer ${mintToken('up-manager-a-uid')}`)
        .send({ teamIds: ['t1'] });
      expect(res.status).toBe(403);
    });

    it('analyst → 403', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/access-scope')
        .set('Authorization', `Bearer ${mintToken('up-analyst-a-uid')}`)
        .send({ teamIds: ['t1'] });
      expect(res.status).toBe(403);
    });

    it('admin → passes auth gate (200)', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/access-scope')
        .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
        .send({ teamIds: ['t1'] });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('audit log', () => {
    it('emits logger.info("User access scope patched via API") with actor/target/tenantId on success', async () => {
      const infoSpy = vi.spyOn(Logger.prototype, 'info');

      await request(app)
        .patch('/api/users/user-in-tenant-a/access-scope')
        .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
        .send({ teamIds: ['t1'] });

      const auditCalls = infoSpy.mock.calls.filter((args) => args[0] === 'User access scope patched via API');
      expect(auditCalls.length).toBeGreaterThan(0);

      const payload = auditCalls[0][1] as Record<string, unknown>;
      expect(payload).toMatchObject({
        actorId: 'up-admin-a-uid',
        targetUserId: 'user-in-tenant-a',
        tenantId: TENANT_A,
      });

      infoSpy.mockRestore();
    });

    it('writes a durable audit-trail mutation entry on success', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/access-scope')
        .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
        .send({ teamIds: ['t1'] });

      expect(res.status).toBe(200);
      const mutationAudits = getUserAdminMutationAudits();
      expect(mutationAudits).toHaveLength(1);
      expect(mutationAudits[0]).toMatchObject({
        type: 'user-admin-mutation',
        action: 'user-profile.access-scope-patched',
        tenantId: TENANT_A,
        actorUserId: 'up-admin-a-uid',
        targetUserId: 'user-in-tenant-a',
        metadata: {
          updates: {
            teamIds: ['t1'],
          },
        },
      });
    });
  });

  describe('cross-tenant isolation', () => {
    it('admin from tenant-B trying to patch a tenant-A user → 404 (no data leak)', async () => {
      const res = await request(app)
        .patch('/api/users/user-in-tenant-a/access-scope')
        .set('Authorization', `Bearer ${mintToken('up-admin-b-uid')}`)
        .send({ teamIds: ['t1'] });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect([404, 500]).toContain(res.status);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/users/:userId/deactivate
// POST /api/users/:userId/reactivate
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/users/:userId/deactivate', () => {
  it('no token → 401', async () => {
    const res = await request(app).post('/api/users/user-in-tenant-a/deactivate');
    expect(res.status).toBe(401);
  });

  it('manager → 403', async () => {
    const res = await request(app)
      .post('/api/users/user-in-tenant-a/deactivate')
      .set('Authorization', `Bearer ${mintToken('up-manager-a-uid')}`);
    expect(res.status).toBe(403);
  });

  it('admin deactivates a user and writes a durable audit-trail mutation entry', async () => {
    const res = await request(app)
      .post('/api/users/user-in-tenant-a/deactivate')
      .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'user-in-tenant-a',
      isActive: false,
    });

    const mutationAudits = getUserAdminMutationAudits();
    expect(mutationAudits).toHaveLength(1);
    expect(mutationAudits[0]).toMatchObject({
      type: 'user-admin-mutation',
      action: 'user-profile.deactivated',
      tenantId: TENANT_A,
      actorUserId: 'up-admin-a-uid',
      targetUserId: 'user-in-tenant-a',
    });
  });
});

describe('POST /api/users/:userId/reactivate', () => {
  it('no token → 401', async () => {
    const res = await request(app).post('/api/users/user-in-tenant-a/reactivate');
    expect(res.status).toBe(401);
  });

  it('manager → 403', async () => {
    const res = await request(app)
      .post('/api/users/user-in-tenant-a/reactivate')
      .set('Authorization', `Bearer ${mintToken('up-manager-a-uid')}`);
    expect(res.status).toBe(403);
  });

  it('admin reactivates a user and writes a durable audit-trail mutation entry', async () => {
    const res = await request(app)
      .post('/api/users/user-in-tenant-a/reactivate')
      .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'user-in-tenant-a',
      isActive: true,
    });

    const mutationAudits = getUserAdminMutationAudits();
    expect(mutationAudits).toHaveLength(1);
    expect(mutationAudits[0]).toMatchObject({
      type: 'user-admin-mutation',
      action: 'user-profile.reactivated',
      tenantId: TENANT_A,
      actorUserId: 'up-admin-a-uid',
      targetUserId: 'user-in-tenant-a',
    });
  });
});

describe('PATCH /api/users/:userId/status', () => {
  it('no token → 401', async () => {
    const res = await request(app)
      .patch('/api/users/user-in-tenant-a/status')
      .send({ status: 'inactive' });
    expect(res.status).toBe(401);
  });

  it('manager → 403', async () => {
    const res = await request(app)
      .patch('/api/users/user-in-tenant-a/status')
      .set('Authorization', `Bearer ${mintToken('up-manager-a-uid')}`)
      .send({ status: 'inactive' });
    expect(res.status).toBe(403);
  });

  it('invalid status → 400 with explicit error', async () => {
    const res = await request(app)
      .patch('/api/users/user-in-tenant-a/status')
      .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
      .send({ status: 'paused' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS');
    expect(String(res.body.error)).toContain('paused');
  });

  it('admin updates user status and writes a durable audit-trail mutation entry', async () => {
    const res = await request(app)
      .patch('/api/users/user-in-tenant-a/status')
      .set('Authorization', `Bearer ${mintToken('up-admin-a-uid')}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'user-in-tenant-a',
      isActive: false,
    });

    const mutationAudits = getUserAdminMutationAudits();
    expect(mutationAudits).toHaveLength(1);
    expect(mutationAudits[0]).toMatchObject({
      type: 'user-admin-mutation',
      action: 'user-profile.status-patched',
      tenantId: TENANT_A,
      actorUserId: 'up-admin-a-uid',
      targetUserId: 'user-in-tenant-a',
      metadata: {
        previousStatus: 'active',
        newStatus: 'inactive',
      },
    });
  });
});
