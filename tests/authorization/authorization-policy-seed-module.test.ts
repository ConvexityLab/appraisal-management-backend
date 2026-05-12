import { describe, it, expect, vi } from 'vitest';
import { buildSeedPolicies, deterministicSeedPolicyId, module as authorizationPoliciesModule } from '../../src/scripts/seed/modules/authorization-policies.js';
import type { SeedContext } from '../../src/scripts/seed/seed-types.js';
import type { PolicyRule } from '../../src/types/policy.types.js';

function sampleRule(): PolicyRule {
  return {
    id: 'rule-1',
    type: 'authorization-policy',
    tenantId: 'tenant-a',
    role: 'manager',
    resourceType: 'order',
    actions: ['read'],
    conditions: [],
    effect: 'allow',
    priority: 100,
    description: 'manager: order access by teamId',
    createdAt: new Date('2026-05-08T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-05-08T00:00:00.000Z').toISOString(),
    createdBy: 'system:seed',
  };
}

describe('authorization policy seed module', () => {
  it('generates deterministic seed-policy IDs', () => {
    const rule = sampleRule();

    const first = deterministicSeedPolicyId('tenant-a', rule);
    const second = deterministicSeedPolicyId('tenant-a', rule);
    const differentTenant = deterministicSeedPolicyId('tenant-b', rule);

    expect(first).toBe(second);
    expect(first.startsWith('seed-policy-')).toBe(true);
    expect(differentTenant).not.toBe(first);
  });

  it('buildSeedPolicies replaces generated ids with deterministic seed ids', () => {
    const rules = buildSeedPolicies('tenant-a');

    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((rule) => rule.id.startsWith('seed-policy-'))).toBe(true);
    expect(rules.every((rule) => rule.createdBy === 'system:seed')).toBe(true);
  });

  it('module.run upserts authorization policies into the shared container', async () => {
    const upsert = vi.fn(async () => ({}));
    const ctx: SeedContext = {
      cosmosClient: {} as any,
      db: {
        container: vi.fn(() => ({
          items: { upsert },
        })),
      } as any,
      tenantId: 'tenant-a',
      clientId: 'client-a',
      subClientId: 'sub-a',
      now: new Date().toISOString(),
      clean: false,
      cleanOnly: false,
      storageAccountName: '',
    };

    const result = await authorizationPoliciesModule.run(ctx);

    expect(result.failed).toBe(0);
    expect(result.created).toBeGreaterThan(0);
    expect((ctx.db.container as any)).toHaveBeenCalledWith('authorization-policies');
    expect(upsert).toHaveBeenCalled();
  });
});
