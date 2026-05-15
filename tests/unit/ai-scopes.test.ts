/**
 * Phase 17.6 / C6 (2026-05-11) — BE ai-scopes test gap fill.
 *
 * Mirrors the FE scope-mapping tests for the new BE-side helper.  When
 * these two diverge in production, /api/ai/catalog responses + tool
 * dispatch validity won't agree — the FE catalog merger silently drops
 * entries the BE thought the user could call.  Keep them in lock-step.
 */

import { describe, expect, it } from 'vitest';
import {
	normaliseRoles,
	getScopesForRole,
	getScopesForUser,
	userHasAllScopes,
} from '../../src/utils/ai-scopes.js';

describe('normaliseRoles', () => {
	it('returns [] for null / undefined / empty', () => {
		expect(normaliseRoles(null)).toEqual([]);
		expect(normaliseRoles(undefined)).toEqual([]);
		expect(normaliseRoles('')).toEqual([]);
	});

	it('lowercases + filters empties', () => {
		expect(normaliseRoles(['Admin', '', 'Manager'])).toEqual(['admin', 'manager']);
		expect(normaliseRoles('ADMIN')).toEqual(['admin']);
	});
});

describe('getScopesForRole', () => {
	it('admin gets every scope', () => {
		const adminScopes = getScopesForRole('admin');
		expect(adminScopes).toContain('order:read');
		expect(adminScopes).toContain('vendor:write');
		expect(adminScopes).toContain('comms:send');
		expect(adminScopes).toContain('audit:read');
	});

	it('appraiser gets only document + order read + vendor read', () => {
		const scopes = getScopesForRole('appraiser');
		expect(scopes.sort()).toEqual(['document:read', 'order:read', 'vendor:read']);
	});

	it('reviewer gets only read scopes', () => {
		expect(getScopesForRole('reviewer').sort()).toEqual(['document:read', 'order:read']);
	});

	it('unknown role gets []', () => {
		expect(getScopesForRole('weirdo')).toEqual([]);
	});
});

describe('getScopesForUser + userHasAllScopes', () => {
	it('unions scopes across multiple roles', () => {
		const scopes = getScopesForUser({ role: ['appraiser', 'reviewer'] });
		expect(scopes.sort()).toEqual(['document:read', 'order:read', 'vendor:read']);
	});

	it('returns true for empty `required`', () => {
		expect(userHasAllScopes({ role: 'reviewer' }, [])).toBe(true);
	});

	it('returns false when user is null + scope required', () => {
		expect(userHasAllScopes(null, ['order:read'])).toBe(false);
	});

	it('admin satisfies any scope requirement', () => {
		expect(
			userHasAllScopes({ role: 'admin' }, ['order:read', 'vendor:write', 'comms:send']),
		).toBe(true);
	});

	it('reviewer cannot satisfy vendor:write', () => {
		expect(userHasAllScopes({ role: 'reviewer' }, ['vendor:write'])).toBe(false);
	});

	it('appraiser+reviewer (union) still cannot satisfy comms:send', () => {
		expect(
			userHasAllScopes({ role: ['appraiser', 'reviewer'] }, ['comms:send']),
		).toBe(false);
	});

	it('role arrays handle admin at any index', () => {
		// C4-style regression: don't only look at index 0.
		expect(userHasAllScopes({ role: ['analyst', 'admin'] }, ['comms:send'])).toBe(true);
	});
});
