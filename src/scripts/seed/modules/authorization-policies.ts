import crypto from 'crypto';
import type { SeedContext, SeedModule, SeedModuleResult } from '../seed-types.js';
import { upsert, cleanContainer } from '../seed-types.js';
import { buildDefaultPolicies } from '../../../data/default-policy-rules.js';
import type { PolicyRule } from '../../../types/policy.types.js';

const CONTAINER = 'authorization-policies';

export function deterministicSeedPolicyId(tenantId: string, rule: PolicyRule): string {
  const key = `${tenantId}|${rule.role}|${rule.resourceType}|${rule.description}`;
  const digest = crypto.createHash('sha1').update(key).digest('hex');
  return `seed-policy-${digest}`;
}

export function buildSeedPolicies(tenantId: string): PolicyRule[] {
  return buildDefaultPolicies(tenantId).map(rule => ({
    ...rule,
    id: deterministicSeedPolicyId(tenantId, rule),
    createdBy: 'system:seed',
  }));
}

export const module: SeedModule = {
  name: 'authorization-policies',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER, '/tenantId', 'seed-policy-');
    }

    for (const rule of buildSeedPolicies(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, rule as unknown as Record<string, unknown>, result);
    }

    return result;
  },
};