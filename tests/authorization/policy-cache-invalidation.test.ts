import { describe, expect, it, vi } from 'vitest';

import { PolicyEvaluatorService } from '../../src/services/policy-evaluator.service.js';
import type { PolicyRule } from '../../src/types/policy.types.js';

function makeRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    id: overrides.id ?? 'policy-1',
    type: 'authorization-policy',
    tenantId: overrides.tenantId ?? 'tenant-a',
    role: overrides.role ?? 'manager',
    resourceType: overrides.resourceType ?? 'order',
    actions: overrides.actions ?? ['read'],
    conditions: overrides.conditions ?? [],
    effect: overrides.effect ?? 'allow',
    priority: overrides.priority ?? 100,
    description: overrides.description ?? 'test policy',
    createdAt: overrides.createdAt ?? new Date('2024-01-01').toISOString(),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-01').toISOString(),
    createdBy: overrides.createdBy ?? 'tester',
    ...(overrides.portalDomain ? { portalDomain: overrides.portalDomain } : {}),
    ...(overrides.clientId ? { clientId: overrides.clientId } : {}),
    ...(overrides.subClientId ? { subClientId: overrides.subClientId } : {}),
    ...(overrides.enabled !== undefined ? { enabled: overrides.enabled } : {}),
  };
}

describe('PolicyEvaluatorService cache invalidation', () => {
  it('invalidates both the old and new scope buckets when a policy moves across scope keys', () => {
    const service = new PolicyEvaluatorService({} as any);
    const cache = (service as any).cache as Map<string, { rules: PolicyRule[]; expiresAt: number }>;
    const expiresAt = Date.now() + 60_000;

    cache.set('tenant-a:manager:order:platform:*:*', { rules: [], expiresAt });
    cache.set('tenant-a:analyst:qc_review:platform:*:*', { rules: [], expiresAt });
    cache.set('tenant-a:manager:vendor:platform:*:*', { rules: [], expiresAt });

    service.invalidateCacheForPolicyChange(
      makeRule({ role: 'manager', resourceType: 'order' }),
      makeRule({ role: 'analyst', resourceType: 'qc_review' }),
    );

    expect(cache.has('tenant-a:manager:order:platform:*:*')).toBe(false);
    expect(cache.has('tenant-a:analyst:qc_review:platform:*:*')).toBe(false);
    expect(cache.has('tenant-a:manager:vendor:platform:*:*')).toBe(true);
  });

  it('deduplicates invalidation when a policy stays in the same scope bucket', () => {
    const service = new PolicyEvaluatorService({} as any);
    const invalidateSpy = vi.spyOn(service, 'invalidateCache');

    service.invalidateCacheForPolicyChange(
      makeRule({ role: 'manager', resourceType: 'order' }),
      makeRule({ role: 'manager', resourceType: 'order' }),
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith('tenant-a', 'manager', 'order');
  });
});