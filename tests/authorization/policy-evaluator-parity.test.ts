import { describe, it, expect, vi } from 'vitest';
import { PolicyEvaluatorService } from '../../src/services/policy-evaluator.service.js';
import type { UserProfile, AccessScope } from '../../src/types/authorization.types.js';
import type { PolicyRule } from '../../src/types/policy.types.js';

const TENANT = 'parity-test-tenant';

function makeProfile(
  role: UserProfile['role'],
  accessScope: Partial<AccessScope> = {},
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    id: 'user-parity-1',
    email: 'parity@test.local',
    name: 'Parity User',
    tenantId: TENANT,
    role,
    portalDomain: 'platform',
    boundEntityIds: [],
    isInternal: false,
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
      ...accessScope,
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function rule(overrides: Partial<PolicyRule>): PolicyRule {
  return {
    id: `rule-${Math.random().toString(36).slice(2)}`,
    type: 'authorization-policy',
    tenantId: TENANT,
    role: 'manager',
    resourceType: 'order',
    actions: ['read'],
    conditions: [],
    effect: 'allow',
    priority: 100,
    description: 'test rule',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'test',
    ...overrides,
  };
}

function makeMockDb(rules: PolicyRule[]) {
  const mockContainer = {
    items: {
      query: (querySpec: { parameters: Array<{ name: string; value: any }> }) => ({
        fetchAll: async () => {
          const params = new Map(querySpec.parameters.map(p => [p.name, p.value]));
          const role = params.get('@role');
          const resourceType = params.get('@resourceType');
          const portalDomain = params.get('@portalDomain');
          const clientId = params.get('@clientId');
          const subClientId = params.get('@subClientId');

          return {
            resources: rules.filter(candidate => {
              if (candidate.type !== 'authorization-policy') return false;
              if (candidate.tenantId !== params.get('@tenantId')) return false;
              if (candidate.role !== role) return false;
              if (candidate.resourceType !== resourceType) return false;
              if (candidate.enabled === false) return false;
              if (candidate.portalDomain && candidate.portalDomain !== portalDomain) return false;

              if (clientId !== undefined) {
                if (candidate.clientId && candidate.clientId !== clientId) return false;
              } else if (candidate.clientId) {
                return false;
              }

              if (subClientId !== undefined) {
                if (candidate.subClientId && candidate.subClientId !== subClientId) return false;
              } else if (candidate.subClientId) {
                return false;
              }

              return true;
            }),
          };
        },
      }),
    },
  };

  return {
    getContainer: vi.fn(() => mockContainer),
  } as any;
}

describe('PolicyEvaluatorService', () => {
  it('returns unconditional allow for an admin-scoped rule', async () => {
    const evaluator = new PolicyEvaluatorService(makeMockDb([
      rule({ role: 'admin' }),
    ]));

    const result = await evaluator.buildQueryFilter('user-1', makeProfile('admin'), 'order', 'read');
    expect(result.sql).toBe('1=1');
    expect(result.parameters).toEqual([]);
  });

  it('expands scalar membership rules into valid Cosmos equality clauses', async () => {
    const evaluator = new PolicyEvaluatorService(makeMockDb([
      rule({
        conditions: [{
          attribute: 'accessControl.clientId',
          operator: 'in',
          userField: 'accessScope.managedClientIds',
        }],
      }),
    ]));

    const result = await evaluator.buildQueryFilter(
      'user-1',
      makeProfile('manager', { managedClientIds: ['client-a', 'client-b'] }),
      'order',
      'read',
    );

    expect(result.sql).toContain('c.accessControl.clientId =');
    expect(result.sql).toContain(' OR ');
    expect(result.sql).not.toContain(' IN (');
    expect(result.parameters.map(parameter => parameter.value)).toEqual(['client-a', 'client-b']);
  });

  it('expands bound-entity rules into valid Cosmos equality clauses', async () => {
    const evaluator = new PolicyEvaluatorService(makeMockDb([
      rule({
        role: 'appraiser',
        conditions: [{
          attribute: 'accessControl.vendorId',
          operator: 'bound_entity_in',
          userField: 'boundEntityIds',
        }],
      }),
    ]));

    const result = await evaluator.buildQueryFilter(
      'user-1',
      makeProfile('appraiser', {}, { boundEntityIds: ['vendor-1', 'vendor-2'] }),
      'order',
      'read',
    );

    expect(result.sql).toContain('c.accessControl.vendorId =');
    expect(result.sql).toContain(' OR ');
    expect(result.parameters.map(parameter => parameter.value)).toEqual(['vendor-1', 'vendor-2']);
  });

  it('applies client-scoped allow rules only to matching clients', async () => {
    const evaluator = new PolicyEvaluatorService(makeMockDb([
      rule({ clientId: 'client-a' }),
    ]));

    const matchingClient = await evaluator.buildQueryFilter(
      'user-1',
      makeProfile('manager', {}, { clientId: 'client-a' }),
      'order',
      'read',
    );
    const otherClient = await evaluator.buildQueryFilter(
      'user-1',
      makeProfile('manager', {}, { clientId: 'client-b' }),
      'order',
      'read',
    );

    expect(matchingClient.sql).toBe('1=1');
    expect(otherClient.sql).toBe('1=0');
  });

  it('lets sub-client-specific deny rules override broader client-scoped allow rules', async () => {
    const evaluator = new PolicyEvaluatorService(makeMockDb([
      rule({ clientId: 'client-a', effect: 'allow', priority: 100 }),
      rule({ clientId: 'client-a', subClientId: 'sub-1', effect: 'deny', priority: 1000 }),
    ]));

    const allowed = await evaluator.buildQueryFilter(
      'user-1',
      makeProfile('manager', {}, { clientId: 'client-a', subClientId: 'sub-2' }),
      'order',
      'read',
    );
    const denied = await evaluator.buildQueryFilter(
      'user-1',
      makeProfile('manager', {}, { clientId: 'client-a', subClientId: 'sub-1' }),
      'order',
      'read',
    );

    expect(allowed.sql).toBe('1=1');
    expect(denied.sql).toBe('1=0');
  });

  it('reloads cached rules after invalidating the current cache scope', async () => {
    const rules: PolicyRule[] = [rule({ role: 'manager', resourceType: 'order' })];
    const queryMock = vi.fn((querySpec: { parameters: Array<{ name: string; value: any }> }) => ({
      fetchAll: async () => {
        const params = new Map(querySpec.parameters.map(p => [p.name, p.value]));
        return {
          resources: rules.filter(candidate =>
            candidate.tenantId === params.get('@tenantId')
            && candidate.role === params.get('@role')
            && candidate.resourceType === params.get('@resourceType'),
          ),
        };
      },
    }));
    const evaluator = new PolicyEvaluatorService({
      getContainer: vi.fn(() => ({ items: { query: queryMock } })),
    } as any);

    const profile = makeProfile('manager');
    const first = await evaluator.buildQueryFilter('user-1', profile, 'order', 'read');
    expect(first.sql).toBe('1=1');
    expect(queryMock).toHaveBeenCalledTimes(1);

    rules.splice(0, rules.length, rule({ role: 'manager', resourceType: 'order', effect: 'deny' }));

    const cached = await evaluator.buildQueryFilter('user-1', profile, 'order', 'read');
    expect(cached.sql).toBe('1=1');
    expect(queryMock).toHaveBeenCalledTimes(1);

    evaluator.invalidateCache(profile.tenantId, profile.role, 'order');

    const reloaded = await evaluator.buildQueryFilter('user-1', profile, 'order', 'read');
    expect(reloaded.sql).toBe('1=0');
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('invalidates both old and new cache scopes when a policy changes role or resource type', async () => {
    const rules: PolicyRule[] = [rule({ role: 'manager', resourceType: 'order' })];
    const queryMock = vi.fn((querySpec: { parameters: Array<{ name: string; value: any }> }) => ({
      fetchAll: async () => {
        const params = new Map(querySpec.parameters.map(p => [p.name, p.value]));
        return {
          resources: rules.filter(candidate =>
            candidate.tenantId === params.get('@tenantId')
            && candidate.role === params.get('@role')
            && candidate.resourceType === params.get('@resourceType'),
          ),
        };
      },
    }));
    const evaluator = new PolicyEvaluatorService({
      getContainer: vi.fn(() => ({ items: { query: queryMock } })),
    } as any);

    const managerProfile = makeProfile('manager');
    const analystProfile = makeProfile('analyst');

    const managerBefore = await evaluator.buildQueryFilter('user-1', managerProfile, 'order', 'read');
    const analystBefore = await evaluator.buildQueryFilter('user-2', analystProfile, 'qc_review', 'read');

    expect(managerBefore.sql).toBe('1=1');
    expect(analystBefore.sql).toBe('1=0');
    expect(queryMock).toHaveBeenCalledTimes(2);

    rules.splice(0, rules.length, rule({ role: 'analyst', resourceType: 'qc_review' }));

    const managerCached = await evaluator.buildQueryFilter('user-1', managerProfile, 'order', 'read');
    const analystCached = await evaluator.buildQueryFilter('user-2', analystProfile, 'qc_review', 'read');

    expect(managerCached.sql).toBe('1=1');
    expect(analystCached.sql).toBe('1=0');
    expect(queryMock).toHaveBeenCalledTimes(2);

    evaluator.invalidateRuleChange(
      { tenantId: TENANT, role: 'manager', resourceType: 'order' },
      { tenantId: TENANT, role: 'analyst', resourceType: 'qc_review' },
    );

    const managerAfter = await evaluator.buildQueryFilter('user-1', managerProfile, 'order', 'read');
    const analystAfter = await evaluator.buildQueryFilter('user-2', analystProfile, 'qc_review', 'read');

    expect(managerAfter.sql).toBe('1=0');
    expect(analystAfter.sql).toBe('1=1');
    expect(queryMock).toHaveBeenCalledTimes(4);
  });
});
