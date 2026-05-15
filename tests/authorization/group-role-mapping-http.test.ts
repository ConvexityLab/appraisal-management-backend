import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';

process.env.NODE_ENV = 'test';
process.env.ENFORCE_AUTHORIZATION = 'true';
process.env.AXIOM_CLIENT_ID = 'test-client-id';
process.env.AXIOM_SUB_CLIENT_ID = 'test-sub-client-id';
process.env.INSPECTION_PROVIDER = process.env.INSPECTION_PROVIDER ?? 'ivueit';
process.env.IVUEIT_API_KEY = process.env.IVUEIT_API_KEY || 'test-placeholder-key';
process.env.IVUEIT_SECRET = process.env.IVUEIT_SECRET || 'test-placeholder-secret';
process.env.IVUEIT_BASE_URL = process.env.IVUEIT_BASE_URL ?? 'https://test-placeholder.ivueit.local';

vi.mock('../../src/services/cosmos-db.service.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/services/cosmos-db.service.js')>();
  const OriginalClass = mod.CosmosDbService;
  const capabilityMod = await import('../../src/data/platform-capability-matrix.js');
  const capabilityDocs = capabilityMod.materializeAuthorizationCapabilityDocuments(
    capabilityMod.AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
    'test',
  );

  const mappings: Array<{
    id: string;
    type: 'entra-group-role-mapping';
    tenantId: string;
    groupObjectId: string;
    role: string;
    priority: number;
    description?: string;
  }> = [
    {
      id: 'mapping-1',
      type: 'entra-group-role-mapping',
      tenantId: 'tenant-a',
      groupObjectId: 'group-admins',
      role: 'manager',
      priority: 100,
      description: 'existing mapping',
    },
  ];

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

          if (querySpec?.query?.includes("c.type = 'entra-group-role-mapping'")) {
            const tenantId = querySpec.parameters?.find((parameter) => parameter.name === '@tenantId')?.value;
            return {
              resources: mappings
                .filter((mapping) => mapping.tenantId === tenantId)
                .sort((left, right) => right.priority - left.priority),
            };
          }

          return { resources: [] };
        },
      }),
      create: async (document: (typeof mappings)[number]) => {
        mappings.push(document);
        return { resource: document };
      },
      upsert: async () => ({ resource: null }),
      readAll: () => ({ fetchAll: async () => ({ resources: [] }) }),
    },
    item: (id: string, tenantId?: string) => ({
      read: async () => ({
        resource: mappings.find((mapping) => mapping.id === id && mapping.tenantId === tenantId) ?? null,
      }),
      replace: async () => ({ resource: null }),
      delete: async () => {
        const index = mappings.findIndex((mapping) => mapping.id === id && mapping.tenantId === tenantId);
        if (index >= 0) {
          mappings.splice(index, 1);
        }
        return {};
      },
    }),
  };

  class MockedCosmosDbService extends OriginalClass {
    override async initialize(): Promise<void> {}
    override getContainer(_name: string) {
      return fakeContainer as any;
    }
  }

  return { ...mod, CosmosDbService: MockedCosmosDbService };
});

import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { AuthorizationService } from '../../src/services/authorization.service.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';
import type { UserProfile } from '../../src/types/authorization.types.js';

const TENANT = 'tenant-a';

function makeProfile(id: string, role: UserProfile['role']): UserProfile {
  return {
    id,
    email: `${role}@group-mapping.dev`,
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
  'group-admin-uid': makeProfile('group-admin-uid', 'admin'),
  'group-manager-uid': makeProfile('group-manager-uid', 'manager'),
  'group-analyst-uid': makeProfile('group-analyst-uid', 'analyst'),
};

let app: Application;
let server: AppraisalManagementAPIServer;
let tokenGen: TestTokenGenerator;
let getUserProfileSpy: ReturnType<typeof vi.spyOn>;

function mintToken(userId: string): string {
  const profile = TEST_USERS[userId]!;
  return tokenGen.generateToken({
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    tenantId: profile.tenantId,
    clientId: process.env.AXIOM_CLIENT_ID,
    subClientId: process.env.AXIOM_SUB_CLIENT_ID,
  });
}

beforeAll(async () => {
  getUserProfileSpy = vi.spyOn(AuthorizationService.prototype, 'getUserProfile')
    .mockImplementation(async (userId: string) => TEST_USERS[userId] ?? null);

  tokenGen = new TestTokenGenerator();
  server = new AppraisalManagementAPIServer(0);
  app = server.getExpressApp();
  await server.initDb();
}, 30_000);

afterAll(() => {
  getUserProfileSpy.mockRestore();
});

describe('Group-role mapping admin API', () => {
  it('GET /api/admin/group-role-mappings requires admin access', async () => {
    const noToken = await request(app).get('/api/admin/group-role-mappings');
    expect(noToken.status).toBe(401);

    const managerRes = await request(app)
      .get('/api/admin/group-role-mappings')
      .set('Authorization', `Bearer ${mintToken('group-manager-uid')}`);
    expect(managerRes.status).toBe(403);

    const adminRes = await request(app)
      .get('/api/admin/group-role-mappings')
      .set('Authorization', `Bearer ${mintToken('group-admin-uid')}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data[0]).toMatchObject({
      id: 'mapping-1',
      groupObjectId: 'group-admins',
      role: 'manager',
    });
  });

  it('POST /api/admin/group-role-mappings creates a mapping for admins only', async () => {
    const analystRes = await request(app)
      .post('/api/admin/group-role-mappings')
      .set('Authorization', `Bearer ${mintToken('group-analyst-uid')}`)
      .send({ groupObjectId: 'group-analysts', role: 'analyst' });
    expect(analystRes.status).toBe(403);

    const adminRes = await request(app)
      .post('/api/admin/group-role-mappings')
      .set('Authorization', `Bearer ${mintToken('group-admin-uid')}`)
      .send({ groupObjectId: 'group-reviewers', role: 'reviewer', priority: 25, description: 'review team' })
      .set('Content-Type', 'application/json');

    expect(adminRes.status).toBe(201);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data).toMatchObject({
      type: 'entra-group-role-mapping',
      tenantId: TENANT,
      groupObjectId: 'group-reviewers',
      role: 'reviewer',
      priority: 25,
      description: 'review team',
    });
  });

  it('PUT /api/admin/group-role-mappings/:id updates a mapping for admins only', async () => {
    const analystRes = await request(app)
      .put('/api/admin/group-role-mappings/mapping-1')
      .set('Authorization', `Bearer ${mintToken('group-analyst-uid')}`)
      .send({ groupObjectId: 'group-admins-updated', role: 'admin', priority: 5 });
    expect(analystRes.status).toBe(403);

    const adminRes = await request(app)
      .put('/api/admin/group-role-mappings/mapping-1')
      .set('Authorization', `Bearer ${mintToken('group-admin-uid')}`)
      .send({ groupObjectId: 'group-admins-updated', role: 'admin', priority: 5, description: 'updated mapping' })
      .set('Content-Type', 'application/json');

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data).toMatchObject({
      id: 'mapping-1',
      groupObjectId: 'group-admins-updated',
      role: 'admin',
      priority: 5,
      description: 'updated mapping',
    });
  });

  it('DELETE /api/admin/group-role-mappings/:id deletes a mapping for admins only', async () => {
    const managerRes = await request(app)
      .delete('/api/admin/group-role-mappings/mapping-1')
      .set('Authorization', `Bearer ${mintToken('group-manager-uid')}`);
    expect(managerRes.status).toBe(403);

    const adminRes = await request(app)
      .delete('/api/admin/group-role-mappings/mapping-1')
      .set('Authorization', `Bearer ${mintToken('group-admin-uid')}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);

    const listRes = await request(app)
      .get('/api/admin/group-role-mappings')
      .set('Authorization', `Bearer ${mintToken('group-admin-uid')}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((entry: { id: string }) => entry.id === 'mapping-1')).toBe(false);
  });
});