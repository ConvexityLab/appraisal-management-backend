import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

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

function makeProfile(id: string, role: UserProfile['role']): UserProfile {
  return {
    id,
    email: `${id}@example.test`,
    name: id,
    tenantId: 'tenant-a',
    role,
    portalDomain: 'platform',
    boundEntityIds: [],
    accessScope: {
      teamIds: [],
      departmentIds: [],
      managedClientIds: [],
      managedVendorIds: [],
      managedUserIds: [],
      regionIds: [],
      statesCovered: [],
      canViewAllOrders: role === 'admin',
      canViewAllVendors: role === 'admin',
      canOverrideQC: role === 'admin',
    },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
}

const TEST_USERS: Record<string, UserProfile> = {
  'profile-uid': makeProfile('profile-uid', 'admin'),
};

let tokenGen: TestTokenGenerator;
let app: Express;
let server: AppraisalManagementAPIServer;
let getUserProfileSpy: ReturnType<typeof vi.spyOn>;

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

describe('GET /api/authz-test/profile', () => {
  it('returns the loaded user profile instead of the raw JWT access scope', async () => {
    const token = tokenGen.generateToken({
      id: 'profile-uid',
      email: 'profile-uid@example.test',
      name: 'JWT Manager Profile',
      role: 'manager',
      tenantId: 'tenant-a',
      clientId: process.env.AXIOM_CLIENT_ID,
      subClientId: process.env.AXIOM_SUB_CLIENT_ID,
    });

    const res = await request(app)
      .get('/api/authz-test/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: 'profile-uid',
      email: 'profile-uid@example.test',
      role: 'admin',
    });
    expect(res.body.interpretation).toMatchObject({
      can_view_all: true,
      teams: [],
      clients: [],
      states: [],
    });
  });
});