import { describe, expect, it } from 'vitest';
import {
  VendorMatchingRulesService,
  type VendorMatchingRule,
  type RuleEvaluationContext,
} from '../../src/services/vendor-matching-rules.service.js';

const service = new VendorMatchingRulesService(null as any);

function makeRule(overrides: Partial<VendorMatchingRule>): VendorMatchingRule {
  return {
    id: 'rule-default',
    tenantId: 'tenant-1',
    name: 'Test rule',
    description: '',
    isActive: true,
    priority: 50,
    ruleType: 'blacklist',
    action: 'deny',
    createdAt: '2026-05-08T00:00:00Z',
    updatedAt: '2026-05-08T00:00:00Z',
    createdBy: 'test',
    type: 'vendor-matching-rule',
    ...overrides,
  };
}

function makeContext(overrides: { vendor?: Partial<RuleEvaluationContext['vendor']>; order?: Partial<RuleEvaluationContext['order']> } = {}): RuleEvaluationContext {
  return {
    vendor: {
      id: 'vendor-1',
      capabilities: [],
      states: [],
      ...(overrides.vendor || {}),
    },
    order: {
      ...(overrides.order || {}),
    },
  };
}

describe('VendorMatchingRulesService.applyRules', () => {
  describe('empty rules', () => {
    it('returns eligible=true with no rules', () => {
      const result = service.applyRules([], makeContext());
      expect(result.eligible).toBe(true);
      expect(result.scoreAdjustment).toBe(0);
      expect(result.appliedRuleIds).toEqual([]);
      expect(result.denyReasons).toEqual([]);
    });
  });

  describe('blacklist deny rules', () => {
    it('denies the vendor when blacklist rule matches vendor.id', () => {
      const rule = makeRule({ id: 'r1', ruleType: 'blacklist', action: 'deny', vendorId: 'vendor-1', name: 'Blacklist v1' });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'vendor-1' } }));
      expect(result.eligible).toBe(false);
      expect(result.denyReasons[0]).toContain('blacklisted');
      expect(result.denyReasons[0]).toContain('Blacklist v1');
      expect(result.appliedRuleIds).toEqual(['r1']);
    });

    it('does not deny when blacklist rule.vendorId differs', () => {
      const rule = makeRule({ ruleType: 'blacklist', vendorId: 'other-vendor' });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'vendor-1' } }));
      expect(result.eligible).toBe(true);
      expect(result.appliedRuleIds).toEqual([]);
    });
  });

  describe('license_required deny rules', () => {
    it('denies when vendor lacks the required license type', () => {
      const rule = makeRule({ ruleType: 'license_required', requiredLicenseType: 'CertifiedResidential' });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', licenseType: 'Trainee' } }));
      expect(result.eligible).toBe(false);
      expect(result.denyReasons[0]).toContain('CertifiedResidential');
    });

    it('passes when vendor has the required license type', () => {
      const rule = makeRule({ ruleType: 'license_required', requiredLicenseType: 'CertifiedResidential' });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', licenseType: 'CertifiedResidential' } }));
      expect(result.eligible).toBe(true);
    });

    it('passes (no-op) when rule has no requiredLicenseType', () => {
      const rule = makeRule({ ruleType: 'license_required' });
      const result = service.applyRules([rule], makeContext());
      expect(result.eligible).toBe(true);
    });
  });

  describe('required_capability deny rules', () => {
    it('denies when vendor lacks the required capability', () => {
      const rule = makeRule({ ruleType: 'required_capability', requiredCapability: 'fha_approved' });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', capabilities: ['va_panel'] } }));
      expect(result.eligible).toBe(false);
      expect(result.denyReasons[0]).toContain('fha_approved');
    });

    it('passes when vendor has the required capability', () => {
      const rule = makeRule({ ruleType: 'required_capability', requiredCapability: 'fha_approved' });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', capabilities: ['fha_approved', 'va_panel'] } }));
      expect(result.eligible).toBe(true);
    });

    it('treats missing vendor.capabilities as empty (denies)', () => {
      const rule = makeRule({ ruleType: 'required_capability', requiredCapability: 'fha_approved' });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', capabilities: undefined } }));
      expect(result.eligible).toBe(false);
    });
  });

  describe('min_performance_score deny rules', () => {
    it('denies when performance below threshold', () => {
      const rule = makeRule({ ruleType: 'min_performance_score', minPerformanceScore: 80 });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', performanceScore: 75 } }));
      expect(result.eligible).toBe(false);
      expect(result.denyReasons[0]).toContain('75');
      expect(result.denyReasons[0]).toContain('80');
    });

    it('passes when performance equals threshold (gte)', () => {
      const rule = makeRule({ ruleType: 'min_performance_score', minPerformanceScore: 80 });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', performanceScore: 80 } }));
      expect(result.eligible).toBe(true);
    });

    it('passes when performance above threshold', () => {
      const rule = makeRule({ ruleType: 'min_performance_score', minPerformanceScore: 80 });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', performanceScore: 95 } }));
      expect(result.eligible).toBe(true);
    });

    it('treats missing performanceScore as 0 (denied if threshold > 0)', () => {
      const rule = makeRule({ ruleType: 'min_performance_score', minPerformanceScore: 50 });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', performanceScore: undefined } }));
      expect(result.eligible).toBe(false);
    });
  });

  describe('max_order_value deny rules', () => {
    it('denies when order value exceeds max', () => {
      const rule = makeRule({ ruleType: 'max_order_value', maxOrderValueUsd: 500000 });
      const result = service.applyRules([rule], makeContext({ order: { orderValueUsd: 750000 } }));
      expect(result.eligible).toBe(false);
      expect(result.denyReasons[0]).toContain('750000');
      expect(result.denyReasons[0]).toContain('500000');
    });

    it('passes when order value at max', () => {
      const rule = makeRule({ ruleType: 'max_order_value', maxOrderValueUsd: 500000 });
      const result = service.applyRules([rule], makeContext({ order: { orderValueUsd: 500000 } }));
      expect(result.eligible).toBe(true);
    });

    it('passes when order value below max', () => {
      const rule = makeRule({ ruleType: 'max_order_value', maxOrderValueUsd: 500000 });
      const result = service.applyRules([rule], makeContext({ order: { orderValueUsd: 250000 } }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('max_distance_miles deny rules', () => {
    it('denies when vendor distance exceeds max', () => {
      const rule = makeRule({ ruleType: 'max_distance_miles', maxDistanceMiles: 100 });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', distance: 150 } }));
      expect(result.eligible).toBe(false);
      expect(result.denyReasons[0]).toContain('150');
      expect(result.denyReasons[0]).toContain('100');
    });

    it('passes when distance equals max', () => {
      const rule = makeRule({ ruleType: 'max_distance_miles', maxDistanceMiles: 100 });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', distance: 100 } }));
      expect(result.eligible).toBe(true);
    });

    it('passes (no-op) when distance is null', () => {
      const rule = makeRule({ ruleType: 'max_distance_miles', maxDistanceMiles: 100 });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', distance: null } }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('state_restriction deny rules', () => {
    it('denies when vendor not licensed in property state', () => {
      const rule = makeRule({ ruleType: 'state_restriction', states: ['FL'] });
      const result = service.applyRules([rule], makeContext({
        vendor: { id: 'v', states: ['CA', 'NV'] },
        order: { propertyState: 'FL' },
      }));
      expect(result.eligible).toBe(false);
      expect(result.denyReasons[0]).toContain('FL');
    });

    it('passes when vendor licensed in property state', () => {
      const rule = makeRule({ ruleType: 'state_restriction', states: ['FL'] });
      const result = service.applyRules([rule], makeContext({
        vendor: { id: 'v', states: ['FL', 'GA'] },
        order: { propertyState: 'FL' },
      }));
      expect(result.eligible).toBe(true);
    });

    it('skips rule when order has no propertyState', () => {
      const rule = makeRule({ ruleType: 'state_restriction', states: ['FL'] });
      const result = service.applyRules([rule], makeContext({ vendor: { id: 'v', states: [] } }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('property_type_restriction deny rules', () => {
    it('denies when productType matches the restricted list', () => {
      const rule = makeRule({ ruleType: 'property_type_restriction', productTypes: ['MANUFACTURED', 'COMMERCIAL'] });
      const result = service.applyRules([rule], makeContext({ order: { productType: 'MANUFACTURED' } }));
      expect(result.eligible).toBe(false);
      expect(result.denyReasons[0]).toContain('MANUFACTURED');
    });

    it('passes when productType is not in the restricted list', () => {
      // NOTE: ruleAppliesTo also filters on productTypes — when productTypes is set
      // and order.productType is not in it, the rule is skipped entirely (not denied,
      // not passed). The deny logic only runs for in-scope rules.
      const rule = makeRule({ ruleType: 'property_type_restriction', productTypes: ['MANUFACTURED'] });
      const result = service.applyRules([rule], makeContext({ order: { productType: 'SFR' } }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('whitelist (allow) overrides deny', () => {
    it('a matching whitelist rule overrides a deny rule for the same vendor', () => {
      const blacklist = makeRule({
        id: 'deny-1',
        ruleType: 'blacklist',
        action: 'deny',
        vendorId: 'vendor-1',
        priority: 10,
        name: 'Block v1',
      });
      const whitelist = makeRule({
        id: 'allow-1',
        ruleType: 'whitelist',
        action: 'allow',
        vendorId: 'vendor-1',
        priority: 20,
        name: 'VIP override',
      });
      const result = service.applyRules([blacklist, whitelist], makeContext({ vendor: { id: 'vendor-1' } }));
      expect(result.eligible).toBe(true);
      expect(result.denyReasons).toEqual([]);
      expect(result.appliedRuleIds).toContain('deny-1');
      expect(result.appliedRuleIds).toContain('allow-1');
    });

    it('whitelist rule for a different vendor does not override a deny', () => {
      const blacklist = makeRule({ id: 'deny-1', ruleType: 'blacklist', action: 'deny', vendorId: 'vendor-1', priority: 10 });
      const whitelist = makeRule({ id: 'allow-1', ruleType: 'whitelist', action: 'allow', vendorId: 'vendor-2', priority: 20 });
      const result = service.applyRules([blacklist, whitelist], makeContext({ vendor: { id: 'vendor-1' } }));
      expect(result.eligible).toBe(false);
    });

    it('whitelist alone (no deny rules) is a no-op', () => {
      const whitelist = makeRule({ id: 'allow-1', ruleType: 'whitelist', action: 'allow', vendorId: 'vendor-1' });
      const result = service.applyRules([whitelist], makeContext({ vendor: { id: 'vendor-1' } }));
      expect(result.eligible).toBe(true);
      expect(result.appliedRuleIds).toEqual(['allow-1']);
    });

    it('whitelist overrides multiple deny rules for the same vendor', () => {
      const blacklist = makeRule({ id: 'deny-1', ruleType: 'blacklist', action: 'deny', vendorId: 'vendor-1', priority: 10 });
      const minPerf = makeRule({ id: 'deny-2', ruleType: 'min_performance_score', action: 'deny', minPerformanceScore: 80, priority: 15 });
      const whitelist = makeRule({ id: 'allow-1', ruleType: 'whitelist', action: 'allow', vendorId: 'vendor-1', priority: 20 });
      const result = service.applyRules([blacklist, minPerf, whitelist], makeContext({ vendor: { id: 'vendor-1', performanceScore: 50 } }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('boost / reduce score adjustments', () => {
    it('accumulates boost adjustment points', () => {
      const rule = makeRule({ id: 'b1', ruleType: 'score_boost', action: 'boost', adjustmentPoints: 10 });
      const result = service.applyRules([rule], makeContext());
      expect(result.eligible).toBe(true);
      expect(result.scoreAdjustment).toBe(10);
      expect(result.appliedRuleIds).toEqual(['b1']);
    });

    it('accumulates reduce adjustment points (subtracts)', () => {
      const rule = makeRule({ id: 'r1', ruleType: 'score_reduce', action: 'reduce', adjustmentPoints: 15 });
      const result = service.applyRules([rule], makeContext());
      expect(result.scoreAdjustment).toBe(-15);
    });

    it('combines boost and reduce', () => {
      const boost = makeRule({ id: 'b1', action: 'boost', ruleType: 'score_boost', adjustmentPoints: 20 });
      const reduce = makeRule({ id: 'r1', action: 'reduce', ruleType: 'score_reduce', adjustmentPoints: 5 });
      const result = service.applyRules([boost, reduce], makeContext());
      expect(result.scoreAdjustment).toBe(15);
    });

    it('ignores boost rule with non-positive adjustmentPoints', () => {
      const rule = makeRule({ action: 'boost', ruleType: 'score_boost', adjustmentPoints: 0 });
      const result = service.applyRules([rule], makeContext());
      expect(result.scoreAdjustment).toBe(0);
      expect(result.appliedRuleIds).toEqual([]);
    });

    it('ignores reduce rule with non-positive adjustmentPoints', () => {
      const rule = makeRule({ action: 'reduce', ruleType: 'score_reduce', adjustmentPoints: 0 });
      const result = service.applyRules([rule], makeContext());
      expect(result.scoreAdjustment).toBe(0);
    });

    it('still accumulates boost when vendor is denied (current behavior; eligible=false)', () => {
      // Documenting current behavior: boost/reduce is independent of deny outcome.
      // The caller gets eligible=false but a non-zero scoreAdjustment.
      const deny = makeRule({ id: 'd1', ruleType: 'blacklist', action: 'deny', vendorId: 'v', priority: 10 });
      const boost = makeRule({ id: 'b1', action: 'boost', ruleType: 'score_boost', adjustmentPoints: 5, priority: 50 });
      const result = service.applyRules([deny, boost], makeContext({ vendor: { id: 'v' } }));
      expect(result.eligible).toBe(false);
      expect(result.scoreAdjustment).toBe(5);
    });
  });

  describe('priority ordering', () => {
    it('evaluates rules in ascending priority order', () => {
      const r1 = makeRule({ id: 'r-pri-90', priority: 90, action: 'boost', ruleType: 'score_boost', adjustmentPoints: 1 });
      const r2 = makeRule({ id: 'r-pri-10', priority: 10, action: 'boost', ruleType: 'score_boost', adjustmentPoints: 1 });
      const r3 = makeRule({ id: 'r-pri-50', priority: 50, action: 'boost', ruleType: 'score_boost', adjustmentPoints: 1 });
      const result = service.applyRules([r1, r2, r3], makeContext());
      expect(result.appliedRuleIds).toEqual(['r-pri-10', 'r-pri-50', 'r-pri-90']);
    });
  });

  describe('scope filters (ruleAppliesTo)', () => {
    it('skips rule when productTypes specified and order productType is not in it', () => {
      const rule = makeRule({ id: 'r1', action: 'boost', ruleType: 'score_boost', adjustmentPoints: 10, productTypes: ['VA_LOAN'] });
      const result = service.applyRules([rule], makeContext({ order: { productType: 'CONVENTIONAL' } }));
      expect(result.scoreAdjustment).toBe(0);
      expect(result.appliedRuleIds).toEqual([]);
    });

    it('applies rule when productTypes specified and matches', () => {
      const rule = makeRule({ id: 'r1', action: 'boost', ruleType: 'score_boost', adjustmentPoints: 10, productTypes: ['VA_LOAN'] });
      const result = service.applyRules([rule], makeContext({ order: { productType: 'VA_LOAN' } }));
      expect(result.scoreAdjustment).toBe(10);
    });

    it('applies rule when productTypes is empty (means all)', () => {
      const rule = makeRule({ id: 'r1', action: 'boost', ruleType: 'score_boost', adjustmentPoints: 10, productTypes: [] });
      const result = service.applyRules([rule], makeContext({ order: { productType: 'WHATEVER' } }));
      expect(result.scoreAdjustment).toBe(10);
    });

    it('skips rule when states specified and order propertyState not in it', () => {
      const rule = makeRule({ id: 'r1', action: 'boost', ruleType: 'score_boost', adjustmentPoints: 10, states: ['FL'] });
      const result = service.applyRules([rule], makeContext({ order: { propertyState: 'CA' } }));
      expect(result.scoreAdjustment).toBe(0);
    });

    it('applies rule when states is empty (means all)', () => {
      const rule = makeRule({ id: 'r1', action: 'boost', ruleType: 'score_boost', adjustmentPoints: 10, states: [] });
      const result = service.applyRules([rule], makeContext({ order: { propertyState: 'CA' } }));
      expect(result.scoreAdjustment).toBe(10);
    });
  });

  describe('integration scenarios', () => {
    it('VIP vendor flow: blacklist + whitelist + boost = eligible with positive adjustment', () => {
      const blacklist = makeRule({ id: 'd1', ruleType: 'blacklist', action: 'deny', vendorId: 'vip-1', priority: 5, name: 'Standard blacklist' });
      const whitelist = makeRule({ id: 'a1', ruleType: 'whitelist', action: 'allow', vendorId: 'vip-1', priority: 10, name: 'VIP override' });
      const boost = makeRule({ id: 'b1', action: 'boost', ruleType: 'score_boost', adjustmentPoints: 25, priority: 50, name: 'VIP boost' });
      const result = service.applyRules([blacklist, whitelist, boost], makeContext({ vendor: { id: 'vip-1' } }));
      expect(result.eligible).toBe(true);
      expect(result.scoreAdjustment).toBe(25);
      expect(result.appliedRuleIds).toEqual(['d1', 'a1', 'b1']);
    });

    it('multiple denies all captured in appliedRuleIds even when one allow overrides', () => {
      const d1 = makeRule({ id: 'd1', ruleType: 'blacklist', action: 'deny', vendorId: 'v', priority: 5 });
      const d2 = makeRule({ id: 'd2', ruleType: 'min_performance_score', action: 'deny', minPerformanceScore: 90, priority: 8 });
      const allow = makeRule({ id: 'a1', ruleType: 'whitelist', action: 'allow', vendorId: 'v', priority: 10 });
      const result = service.applyRules([d1, d2, allow], makeContext({ vendor: { id: 'v', performanceScore: 50 } }));
      expect(result.eligible).toBe(true);
      expect(result.appliedRuleIds).toContain('d1');
      expect(result.appliedRuleIds).toContain('d2');
      expect(result.appliedRuleIds).toContain('a1');
    });

    it('returns stable structure when no rules apply at all', () => {
      const rule = makeRule({ ruleType: 'state_restriction', states: ['FL'] });
      const result = service.applyRules([rule], makeContext({ order: { propertyState: 'CA' } }));
      expect(result).toEqual({
        eligible: true,
        scoreAdjustment: 0,
        appliedRuleIds: [],
        denyReasons: [],
      });
    });
  });
});
