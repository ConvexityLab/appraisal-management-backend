import { describe, expect, it, vi } from 'vitest';
import { HomegrownVendorMatchingRulesProvider } from '../../../src/services/vendor-matching-rules/homegrown.provider.js';
import type {
  RuleEvaluationContext,
  RuleEvaluationResult,
  VendorMatchingRule,
  VendorMatchingRulesService,
} from '../../../src/services/vendor-matching-rules.service.js';

function makeMockService(overrides: Partial<{
  listRules: () => Promise<VendorMatchingRule[]>;
  applyRules: (rules: VendorMatchingRule[], ctx: RuleEvaluationContext) => RuleEvaluationResult;
}> = {}): VendorMatchingRulesService {
  return {
    listRules: overrides.listRules ?? vi.fn().mockResolvedValue([]),
    applyRules: overrides.applyRules ?? vi.fn().mockReturnValue({
      eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [],
    }),
  } as unknown as VendorMatchingRulesService;
}

function makeContext(id: string): RuleEvaluationContext {
  return { vendor: { id, capabilities: [] }, order: {} };
}

describe('HomegrownVendorMatchingRulesProvider', () => {
  it('has the homegrown name tag', () => {
    const provider = new HomegrownVendorMatchingRulesProvider(makeMockService());
    expect(provider.name).toBe('homegrown');
  });

  it('returns empty array for empty contexts (no rules call)', async () => {
    const listRules = vi.fn().mockResolvedValue([]);
    const provider = new HomegrownVendorMatchingRulesProvider(makeMockService({ listRules }));
    const results = await provider.evaluateForVendors('t1', []);
    expect(results).toEqual([]);
    expect(listRules).not.toHaveBeenCalled();
  });

  it('loads rules once, applies per vendor, results match input order', async () => {
    const rules = [{ id: 'r1' } as VendorMatchingRule];
    const listRules = vi.fn().mockResolvedValue(rules);
    const applyRules = vi.fn().mockImplementation((_rules, ctx: RuleEvaluationContext) => ({
      eligible: ctx.vendor.id !== 'denied',
      scoreAdjustment: ctx.vendor.id === 'boosted' ? 10 : 0,
      appliedRuleIds: ['r1'],
      denyReasons: ctx.vendor.id === 'denied' ? ['nope'] : [],
    }));
    const provider = new HomegrownVendorMatchingRulesProvider(makeMockService({ listRules, applyRules }));

    const results = await provider.evaluateForVendors('t1', [
      makeContext('a'), makeContext('denied'), makeContext('boosted'),
    ]);

    expect(listRules).toHaveBeenCalledTimes(1);
    expect(listRules).toHaveBeenCalledWith('t1', true);
    expect(applyRules).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);
    expect(results[0]?.eligible).toBe(true);
    expect(results[1]?.eligible).toBe(false);
    expect(results[1]?.denyReasons).toEqual(['nope']);
    expect(results[2]?.scoreAdjustment).toBe(10);
  });

  it('fails open when listRules throws (returns all-eligible results)', async () => {
    const listRules = vi.fn().mockRejectedValue(new Error('cosmos down'));
    const applyRules = vi.fn();
    const provider = new HomegrownVendorMatchingRulesProvider(makeMockService({ listRules, applyRules }));

    const results = await provider.evaluateForVendors('t1', [makeContext('a'), makeContext('b')]);

    expect(results).toHaveLength(2);
    expect(results.every(r => r.eligible)).toBe(true);
    expect(results.every(r => r.scoreAdjustment === 0)).toBe(true);
    expect(applyRules).not.toHaveBeenCalled();
  });

  it('isHealthy returns true unconditionally', async () => {
    const provider = new HomegrownVendorMatchingRulesProvider(makeMockService());
    expect(await provider.isHealthy()).toBe(true);
  });
});
