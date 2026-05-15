import { beforeAll, describe, expect, it, vi } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.ALLOW_TEST_TOKENS = 'true';
process.env.BYPASS_TEST_TOKEN_PROFILE_CHECK = 'true';
process.env.ENFORCE_AUTHORIZATION = 'true';
process.env.AUTO_PROVISION_USERS = 'false';
process.env.AXIOM_CLIENT_ID = process.env.AXIOM_CLIENT_ID ?? 'test-client-id';
process.env.AXIOM_SUB_CLIENT_ID = process.env.AXIOM_SUB_CLIENT_ID ?? 'test-sub-client-id';
process.env.AXIOM_API_BASE_URL = process.env.AXIOM_API_BASE_URL ?? 'https://axiom-stub.test';
process.env.INSPECTION_PROVIDER = process.env.INSPECTION_PROVIDER ?? 'ivueit';
process.env.IVUEIT_API_KEY = process.env.IVUEIT_API_KEY ?? 'test-placeholder-key';
process.env.IVUEIT_SECRET = process.env.IVUEIT_SECRET ?? 'test-placeholder-secret';
process.env.IVUEIT_BASE_URL = process.env.IVUEIT_BASE_URL ?? 'https://test-placeholder.ivueit.local';
process.env.AZURE_TENANT_ID = process.env.AZURE_TENANT_ID ?? 'test-tenant';

const capabilityMatrixModule = await import('../../src/data/platform-capability-matrix.js');
const capabilityDocs = capabilityMatrixModule.materializeAuthorizationCapabilityDocuments(
  capabilityMatrixModule.AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
  'test',
);

vi.mock('../../src/services/inspection-providers/factory.js', () => ({
  createInspectionProvider: () => ({ name: 'stub-provider' }),
}));

vi.mock('../../src/services/cosmos-db.service.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/services/cosmos-db.service.js')>();
  const OriginalClass = mod.CosmosDbService;

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
    override async initialize(): Promise<void> {}

    override getContainer(_containerName: string) {
      return fakeContainer as any;
    }
  }

  return { ...mod, CosmosDbService: MockedCosmosDbService };
});

import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';
import { AzureEntraAuthMiddleware } from '../../src/middleware/azure-entra-auth.middleware.js';
import { createUnifiedAuth } from '../../src/middleware/unified-auth.middleware.js';
import { TestTokenGenerator } from '../../src/utils/test-token-generator.js';

describe('legacy role normalization', () => {
  it('normalizes legacy qc_analyst test tokens to canonical analyst claims', () => {
    const generator = new TestTokenGenerator();
    const token = generator.generateToken({
      id: 'legacy-analyst',
      email: 'legacy-analyst@test.local',
      name: 'Legacy Analyst',
      role: 'qc_analyst',
      tenantId: 'test-tenant',
    });

    const result = generator.verifyToken(token);

    expect(result.valid).toBe(true);
    expect(result.user?.role).toBe('analyst');
    expect(result.user?.permissions).toContain('qc_review:execute');
    expect(result.user?.permissions).not.toContain('qc_execute');
  });

  it('normalizes Azure Entra QCAnalyst app roles to analyst without legacy permissions', async () => {
    const middleware = new AzureEntraAuthMiddleware({
      tenantId: 'test-tenant',
      clientId: 'test-client-id',
    });
    const req = {
      headers: { authorization: 'Bearer fake-token' },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const next = vi.fn();

    vi.spyOn(middleware as any, 'validateToken').mockResolvedValue({
      oid: 'entra-user-1',
      email: 'entra-analyst@test.local',
      name: 'Entra Analyst',
      tid: 'test-tenant',
      roles: ['QCAnalyst'],
      groups: [],
      clientId: 'test-client-id',
      subClientId: 'test-sub-client-id',
    });

    await middleware.authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user.role).toBe('analyst');
    expect(req.user.permissions).toContain('qc_review:execute');
    expect(req.user.permissions).not.toContain('qc_execute');
  });
});

describe('legacy role normalization over HTTP', () => {
  let app: Application;

  beforeAll(async () => {
    const server = new AppraisalManagementAPIServer(0);
    app = server.getExpressApp();
    await server.initDb();
  }, 30_000);

  it('authenticates a legacy qc_analyst token as analyst through unified auth', async () => {
    const unifiedAuth = createUnifiedAuth();
    const generator = new TestTokenGenerator();
    const token = generator.generateToken({
      id: 'legacy-analyst',
      email: 'legacy-analyst@test.local',
      name: 'Legacy Analyst',
      role: 'qc_analyst',
      tenantId: 'test-tenant',
    });

    const authApp = express();
    authApp.get('/whoami', unifiedAuth.authenticate(), (req, res) => {
      res.json((req as any).user);
    });

    const res = await request(authApp)
      .get('/whoami')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('analyst');
    expect(res.body.permissions).toContain('qc_review:execute');
    expect(res.body.permissions).not.toContain('qc_execute');
  });

  it('treats a legacy qc_analyst token like an analyst for route authorization', async () => {
    const generator = new TestTokenGenerator();
    const token = generator.generateToken({
      id: 'legacy-analyst',
      email: 'legacy-analyst@test.local',
      name: 'Legacy Analyst',
      role: 'qc_analyst',
      tenantId: 'test-tenant',
    });

    const allowed = await request(app)
      .get('/api/qc-workflow/queue')
      .set('Authorization', `Bearer ${token}`);

    const denied = await request(app)
      .get('/api/axiom/admin/queue/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(allowed.status).not.toBe(401);
    expect(allowed.status).not.toBe(403);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('AUTHORIZATION_DENIED');
  });
});