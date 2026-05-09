import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FallbackVendorMatchingRulesProvider } from '../../../src/services/vendor-matching-rules/fallback.provider.js';
import type {
  RuleEvaluationContext,
  RuleEvaluationResult,
  VendorMatchingRulesProvider,
  ProviderName,
} from '../../../src/services/vendor-matching-rules/provider.types.js';

function ctx(id: string): RuleEvaluationContext {
  return { vendor: { id, capabilities: [] }, order: {} };
}

function makeProvider(name: ProviderName, overrides: Partial<{
  evaluateForVendors: VendorMatchingRulesProvider['evaluateForVendors'];
  isHealthy: VendorMatchingRulesProvider['isHealthy'];
}> = {}): VendorMatchingRulesProvider & {
  evaluateForVendors: ReturnType<typeof vi.fn>;
  isHealthy: ReturnType<typeof vi.fn>;
} {
  const okResult: RuleEvaluationResult = { eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] };
  return {
    name,
    evaluateForVendors: vi.fn(overrides.evaluateForVendors ?? (async (_t, c) => c.map(() => ({ ...okResult })))),
    isHealthy: vi.fn(overrides.isHealthy ?? (async () => true)),
  } as any;
}

describe('FallbackVendorMatchingRulesProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes a composed name', () => {
    const fb = new FallbackVendorMatchingRulesProvider(
      makeProvider('mop'),
      makeProvider('homegrown'),
    );
    expect(fb.name).toBe('mop-with-fallback');
  });

  describe('happy path: primary succeeds', () => {
    it('returns primary result and does not call secondary', async () => {
      const primaryResult: RuleEvaluationResult[] = [
        { eligible: true, scoreAdjustment: 5, appliedRuleIds: ['r1'], denyReasons: [] },
      ];
      const primary = makeProvider('mop', { evaluateForVendors: async () => primaryResult });
      const secondary = makeProvider('homegrown');
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary);

      const result = await fb.evaluateForVendors('t1', [ctx('a')]);
      expect(result).toEqual(primaryResult);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(1);
      expect(secondary.evaluateForVendors).not.toHaveBeenCalled();
    });
  });

  describe('primary failure → secondary success', () => {
    it('falls back to secondary on first failure (breaker stays closed)', async () => {
      const secondaryResult: RuleEvaluationResult[] = [
        { eligible: false, scoreAdjustment: 0, appliedRuleIds: ['r9'], denyReasons: ['fallback path'] },
      ];
      const primary = makeProvider('mop', {
        evaluateForVendors: async () => { throw new Error('boom'); },
      });
      const secondary = makeProvider('homegrown', {
        evaluateForVendors: async () => secondaryResult,
      });
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary, { failureThreshold: 3 });

      const result = await fb.evaluateForVendors('t1', [ctx('a')]);
      expect(result).toEqual(secondaryResult);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(1);
      expect(secondary.evaluateForVendors).toHaveBeenCalledTimes(1);
    });

    it('opens the breaker after threshold failures and stops calling primary', async () => {
      const primary = makeProvider('mop', {
        evaluateForVendors: async () => { throw new Error('boom'); },
      });
      const secondary = makeProvider('homegrown');
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary, {
        failureThreshold: 3,
        windowMs: 30_000,
        cooldownMs: 60_000,
      });

      // 3 failures opens the breaker.
      for (let i = 0; i < 3; i++) {
        await fb.evaluateForVendors('t1', [ctx(`v${i}`)]);
      }
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(3);
      expect(secondary.evaluateForVendors).toHaveBeenCalledTimes(3);

      // Subsequent calls skip primary entirely.
      await fb.evaluateForVendors('t1', [ctx('v4')]);
      await fb.evaluateForVendors('t1', [ctx('v5')]);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(3); // unchanged
      expect(secondary.evaluateForVendors).toHaveBeenCalledTimes(5);
    });

    it('failures outside the sliding window do not count toward the threshold', async () => {
      const primary = makeProvider('mop', {
        evaluateForVendors: async () => { throw new Error('boom'); },
      });
      const secondary = makeProvider('homegrown');
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary, {
        failureThreshold: 3,
        windowMs: 30_000,
        cooldownMs: 60_000,
      });

      // 2 failures at t=0
      await fb.evaluateForVendors('t1', [ctx('v0')]);
      await fb.evaluateForVendors('t1', [ctx('v1')]);

      // Advance past the window: previous failures expire from the count.
      vi.advanceTimersByTime(35_000);

      // 2 more failures: should NOT trip the breaker (the first 2 are stale).
      await fb.evaluateForVendors('t1', [ctx('v2')]);
      await fb.evaluateForVendors('t1', [ctx('v3')]);

      // Breaker still closed → next call still hits primary.
      await fb.evaluateForVendors('t1', [ctx('v4')]);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(5);
    });

    it('half-opens after cooldown and re-closes on trial success', async () => {
      let primaryShouldFail = true;
      const primary = makeProvider('mop', {
        evaluateForVendors: async (_t, c) => {
          if (primaryShouldFail) throw new Error('boom');
          return c.map(() => ({ eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] }));
        },
      });
      const secondary = makeProvider('homegrown');
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary, {
        failureThreshold: 2,
        windowMs: 30_000,
        cooldownMs: 60_000,
      });

      // 2 failures → breaker open
      await fb.evaluateForVendors('t1', [ctx('a')]);
      await fb.evaluateForVendors('t1', [ctx('b')]);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(2);

      // While open: skip primary
      await fb.evaluateForVendors('t1', [ctx('c')]);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(2);

      // Advance past cooldown, primary recovers
      primaryShouldFail = false;
      vi.advanceTimersByTime(65_000);

      // Half-open: primary trialed and succeeds → breaker closes
      await fb.evaluateForVendors('t1', [ctx('d')]);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(3);

      // Subsequent call hits primary normally
      await fb.evaluateForVendors('t1', [ctx('e')]);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(4);
    });

    it('half-open trial failure re-opens the breaker', async () => {
      const primary = makeProvider('mop', {
        evaluateForVendors: async () => { throw new Error('still broken'); },
      });
      const secondary = makeProvider('homegrown');
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary, {
        failureThreshold: 2,
        cooldownMs: 60_000,
      });

      await fb.evaluateForVendors('t1', [ctx('a')]);
      await fb.evaluateForVendors('t1', [ctx('b')]);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(65_000);
      await fb.evaluateForVendors('t1', [ctx('c')]); // trial → fails → re-opens
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(3);

      // Next call: skip primary (re-opened)
      await fb.evaluateForVendors('t1', [ctx('d')]);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(3);
    });
  });

  describe('both providers fail', () => {
    it('re-throws the primary error when secondary also fails', async () => {
      const primaryErr = new Error('primary down');
      const secondaryErr = new Error('secondary down');
      const primary = makeProvider('mop', { evaluateForVendors: async () => { throw primaryErr; } });
      const secondary = makeProvider('homegrown', { evaluateForVendors: async () => { throw secondaryErr; } });
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary);

      await expect(fb.evaluateForVendors('t1', [ctx('a')])).rejects.toBe(primaryErr);
    });

    it('throws secondary error when breaker is open and primary not called', async () => {
      const primary = makeProvider('mop', {
        evaluateForVendors: async () => { throw new Error('primary down'); },
      });
      const secondaryErr = new Error('secondary down');
      const secondary = makeProvider('homegrown', {
        evaluateForVendors: async () => { throw secondaryErr; },
      });
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary, {
        failureThreshold: 1, cooldownMs: 60_000,
      });

      // Trip breaker (primary error rethrown because secondary also fails)
      await expect(fb.evaluateForVendors('t1', [ctx('a')])).rejects.toThrow();

      // Breaker is now open. Next call: primary not called, secondary thrown.
      await expect(fb.evaluateForVendors('t1', [ctx('b')])).rejects.toBe(secondaryErr);
      expect(primary.evaluateForVendors).toHaveBeenCalledTimes(1);
    });
  });

  describe('isHealthy', () => {
    it('returns true if primary is healthy', async () => {
      const primary = makeProvider('mop', { isHealthy: async () => true });
      const secondary = makeProvider('homegrown', { isHealthy: async () => false });
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary);
      expect(await fb.isHealthy()).toBe(true);
    });

    it('returns true if secondary is healthy when primary is not', async () => {
      const primary = makeProvider('mop', { isHealthy: async () => false });
      const secondary = makeProvider('homegrown', { isHealthy: async () => true });
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary);
      expect(await fb.isHealthy()).toBe(true);
    });

    it('returns false when both are unhealthy', async () => {
      const primary = makeProvider('mop', { isHealthy: async () => false });
      const secondary = makeProvider('homegrown', { isHealthy: async () => false });
      const fb = new FallbackVendorMatchingRulesProvider(primary, secondary);
      expect(await fb.isHealthy()).toBe(false);
    });
  });
});
