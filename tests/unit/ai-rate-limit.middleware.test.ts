/**
 * Phase 17.6 — BE rate limiter unit tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	_resetAiRateLimitForTests,
	consumeAiRateSlot,
	setAiRateBudget,
} from '../../src/middleware/ai-rate-limit.middleware.js';

describe('consumeAiRateSlot', () => {
	beforeEach(() => _resetAiRateLimitForTests());
	afterEach(() => _resetAiRateLimitForTests());

	it('permits the first request', () => {
		const r = consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'axiom' });
		expect(r.ok).toBe(true);
	});

	it('refuses after the family limit is hit', () => {
		setAiRateBudget('axiom', { limit: 3, windowMs: 60_000 });
		for (let i = 0; i < 3; i += 1) {
			expect(consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'axiom' }).ok).toBe(true);
		}
		const refused = consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'axiom' });
		expect(refused.ok).toBe(false);
		expect(refused.family).toBe('axiom');
		expect(refused.limit).toBe(3);
		expect(refused.retryInMs).toBeGreaterThan(0);
	});

	it('per-tenant + per-user isolation', () => {
		setAiRateBudget('mop', { limit: 2, windowMs: 60_000 });
		consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'mop' });
		consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'mop' });
		const u1Refused = consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'mop' });
		const u2Permitted = consumeAiRateSlot({ tenantId: 't1', userId: 'u2', family: 'mop' });
		const otherTenant = consumeAiRateSlot({ tenantId: 't2', userId: 'u1', family: 'mop' });
		expect(u1Refused.ok).toBe(false);
		expect(u2Permitted.ok).toBe(true);
		expect(otherTenant.ok).toBe(true);
	});

	it('sliding window — expired timestamps free up slots', () => {
		setAiRateBudget('composite', { limit: 2, windowMs: 1_000 });
		const now = 1_000_000;
		expect(consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'composite', now }).ok).toBe(true);
		expect(consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'composite', now }).ok).toBe(true);
		expect(consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'composite', now }).ok).toBe(false);
		expect(consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'composite', now: now + 1500 }).ok).toBe(true);
	});

	it('per-family isolation', () => {
		setAiRateBudget('axiom', { limit: 1, windowMs: 60_000 });
		setAiRateBudget('native', { limit: 1, windowMs: 60_000 });
		consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'axiom' });
		const axiomRefused = consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'axiom' });
		const nativePermitted = consumeAiRateSlot({ tenantId: 't1', userId: 'u1', family: 'native' });
		expect(axiomRefused.ok).toBe(false);
		expect(nativePermitted.ok).toBe(true);
	});
});
