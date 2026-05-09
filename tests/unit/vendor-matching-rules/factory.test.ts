import { describe, expect, it, vi } from 'vitest';
import { createVendorMatchingRulesProvider } from '../../../src/services/vendor-matching-rules/factory.js';
import { HomegrownVendorMatchingRulesProvider } from '../../../src/services/vendor-matching-rules/homegrown.provider.js';
import { MopVendorMatchingRulesProvider } from '../../../src/services/vendor-matching-rules/mop.provider.js';
import { FallbackVendorMatchingRulesProvider } from '../../../src/services/vendor-matching-rules/fallback.provider.js';
import type { VendorMatchingRulesService } from '../../../src/services/vendor-matching-rules.service.js';

const stubRulesService = {
  listRules: vi.fn().mockResolvedValue([]),
  applyRules: vi.fn().mockReturnValue({ eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] }),
} as unknown as VendorMatchingRulesService;

describe('createVendorMatchingRulesProvider', () => {
  it('defaults to homegrown when RULES_PROVIDER is unset', () => {
    const provider = createVendorMatchingRulesProvider({
      rulesService: stubRulesService,
      env: {},
    });
    expect(provider).toBeInstanceOf(HomegrownVendorMatchingRulesProvider);
    expect(provider.name).toBe('homegrown');
  });

  it('builds homegrown when RULES_PROVIDER=homegrown', () => {
    const provider = createVendorMatchingRulesProvider({
      rulesService: stubRulesService,
      env: { RULES_PROVIDER: 'homegrown' },
    });
    expect(provider).toBeInstanceOf(HomegrownVendorMatchingRulesProvider);
  });

  it('builds MOP-only when RULES_PROVIDER=mop and base url is set', () => {
    const provider = createVendorMatchingRulesProvider({
      rulesService: stubRulesService,
      env: { RULES_PROVIDER: 'mop', MOP_RULES_BASE_URL: 'http://mop.test:8090' },
    });
    expect(provider).toBeInstanceOf(MopVendorMatchingRulesProvider);
    expect(provider.name).toBe('mop');
  });

  it('throws when RULES_PROVIDER=mop and MOP_RULES_BASE_URL is missing', () => {
    expect(() => createVendorMatchingRulesProvider({
      rulesService: stubRulesService,
      env: { RULES_PROVIDER: 'mop' },
    })).toThrow(/MOP_RULES_BASE_URL is unset/);
  });

  it('throws when RULES_PROVIDER=mop-with-fallback and MOP_RULES_BASE_URL is missing', () => {
    expect(() => createVendorMatchingRulesProvider({
      rulesService: stubRulesService,
      env: { RULES_PROVIDER: 'mop-with-fallback' },
    })).toThrow(/MOP_RULES_BASE_URL is unset/);
  });

  it('builds MOP-with-fallback chain when RULES_PROVIDER=mop-with-fallback', () => {
    const provider = createVendorMatchingRulesProvider({
      rulesService: stubRulesService,
      env: {
        RULES_PROVIDER: 'mop-with-fallback',
        MOP_RULES_BASE_URL: 'http://mop.test:8090',
      },
    });
    expect(provider).toBeInstanceOf(FallbackVendorMatchingRulesProvider);
    expect(provider.name).toBe('mop-with-fallback');
  });

  it('throws on unknown RULES_PROVIDER value', () => {
    expect(() => createVendorMatchingRulesProvider({
      rulesService: stubRulesService,
      env: { RULES_PROVIDER: 'sometihng-else' },
    })).toThrow(/Unknown RULES_PROVIDER/);
  });

  it('case-insensitive: RULES_PROVIDER=MOP works', () => {
    const provider = createVendorMatchingRulesProvider({
      rulesService: stubRulesService,
      env: { RULES_PROVIDER: 'MOP', MOP_RULES_BASE_URL: 'http://mop.test:8090' },
    });
    expect(provider.name).toBe('mop');
  });
});
