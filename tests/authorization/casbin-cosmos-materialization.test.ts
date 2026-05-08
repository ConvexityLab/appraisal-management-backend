import { describe, it, expect, vi } from 'vitest';
import { CasbinAuthorizationEngine } from '../../src/services/casbin-engine.service.js';
import {
  materializeAuthorizationCapabilityDocuments,
  AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
} from '../../src/data/platform-capability-matrix.js';
import type { AuthorizationContext } from '../../src/types/authorization.types.js';
import type { AuthorizationCapabilityDocument } from '../../src/types/policy.types.js';

function makeMockDb(capabilityDocs: AuthorizationCapabilityDocument[]) {
  return {
    getContainer: vi.fn(() => ({
      items: {
        query: (querySpec: { parameters?: Array<{ name: string; value: unknown }> }) => ({
          fetchAll: async () => {
            const tenantId = querySpec.parameters?.find((parameter) => parameter.name === '@tenantId')?.value;
            return {
              resources: capabilityDocs.filter(
                (doc) => doc.tenantId === tenantId && doc.enabled !== false,
              ),
            };
          },
        }),
      },
    })),
  } as any;
}

function makeContext(role: AuthorizationContext['user']['role'], resourceType: AuthorizationContext['resource']['type'], action: AuthorizationContext['action']): AuthorizationContext {
  return {
    user: {
      id: 'user-1',
      role,
      portalDomain: 'platform',
      boundEntityIds: [],
      email: 'user@test.local',
      teamIds: [],
      departmentIds: [],
    },
    resource: {
      type: resourceType,
      id: 'resource-1',
    },
    action,
    context: {
      timestamp: new Date(),
      requestId: 'req-1',
    },
  };
}

describe('CasbinAuthorizationEngine Cosmos materialization', () => {
  it('loads capability tuples from Cosmos and enforces them', async () => {
    const engine = new CasbinAuthorizationEngine(
      makeMockDb(materializeAuthorizationCapabilityDocuments(AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID, 'test')),
    );

    await engine.initialize();

    const managerRead = await engine.enforce(makeContext('manager', 'order', 'read'));
    const managerDelete = await engine.enforce(makeContext('manager', 'order', 'delete'));
    const reviewerRead = await engine.enforce(makeContext('reviewer', 'document', 'read'));

    expect(managerRead.allowed).toBe(true);
    expect(managerDelete.allowed).toBe(false);
    expect(reviewerRead.allowed).toBe(true);

    const policies = await engine.getAllPolicies();
    expect(policies.length).toBeGreaterThan(0);
  });

  it('reloads Cosmos-backed capability tuples after they change', async () => {
    const docs = materializeAuthorizationCapabilityDocuments(AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID, 'test');
    const engine = new CasbinAuthorizationEngine(makeMockDb(docs));

    await engine.initialize();
    const before = await engine.enforce(makeContext('reviewer', 'order', 'read'));
    expect(before.allowed).toBe(true);

    for (const doc of docs) {
      if (doc.role === 'reviewer' && doc.resourceType === 'order') {
        doc.enabled = false;
      }
    }

    await engine.reloadPolicies();

    const after = await engine.enforce(makeContext('reviewer', 'order', 'read'));
    expect(after.allowed).toBe(false);
  });

  it('fails startup when capability materialization is missing', async () => {
    const engine = new CasbinAuthorizationEngine(makeMockDb([]));

    await expect(engine.initialize()).rejects.toThrow(/No Casbin capability materialization documents were found/i);
  });
});
