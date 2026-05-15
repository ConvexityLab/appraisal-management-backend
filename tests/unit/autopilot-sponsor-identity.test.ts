/**
 * Phase 14 v2 delegated identity — AutopilotSponsorIdentity tests.
 */

import { describe, expect, it, vi } from 'vitest';
import { AutopilotSponsorIdentity } from '../../src/services/autopilot-sponsor-identity.service.js';

function profile(overrides: Record<string, unknown> = {}) {
	return {
		userId: 'sponsor-1',
		email: 'a@b.com',
		name: 'A B',
		role: 'admin',
		tenantId: 't1',
		isActive: true,
		boundEntityIds: [],
		accessScope: {},
		portalDomain: 'platform',
		azureAdObjectId: 'aad-1',
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeService(returnedProfile: ReturnType<typeof profile> | null) {
	const profiles = {
		getUserProfile: vi.fn(async () => returnedProfile),
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return { resolver: new AutopilotSponsorIdentity(profiles as any), profiles };
}

describe('AutopilotSponsorIdentity.resolve', () => {
	it('refuses when tenantId is missing', async () => {
		const { resolver } = makeService(profile());
		const r = await resolver.resolve('', 'sponsor-1');
		expect(r.ok).toBe(false);
		expect(r.ok === false && r.reason).toBe('sponsor-missing');
	});

	it('refuses with sponsor-missing when no profile is returned', async () => {
		const { resolver } = makeService(null);
		const r = await resolver.resolve('t1', 'sponsor-1');
		expect(r.ok).toBe(false);
		expect(r.ok === false && r.reason).toBe('sponsor-missing');
	});

	it('refuses with tenant-mismatch when profile belongs to another tenant', async () => {
		const { resolver } = makeService(profile({ tenantId: 'other' }));
		const r = await resolver.resolve('t1', 'sponsor-1');
		expect(r.ok).toBe(false);
		expect(r.ok === false && r.reason).toBe('tenant-mismatch');
	});

	it('refuses with sponsor-inactive when isActive=false', async () => {
		const { resolver } = makeService(profile({ isActive: false }));
		const r = await resolver.resolve('t1', 'sponsor-1');
		expect(r.ok).toBe(false);
		expect(r.ok === false && r.reason).toBe('sponsor-inactive');
	});

	it('returns OK envelope with role on success', async () => {
		const { resolver } = makeService(profile({ role: 'manager' }));
		const r = await resolver.resolve('t1', 'sponsor-1');
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.tenantId).toBe('t1');
			expect(r.userId).toBe('sponsor-1');
			expect(r.role).toBe('manager');
		}
	});

	it('returns sponsor-missing when the lookup itself throws', async () => {
		const profiles = {
			getUserProfile: vi.fn(async () => {
				throw new Error('cosmos down');
			}),
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const resolver = new AutopilotSponsorIdentity(profiles as any);
		const r = await resolver.resolve('t1', 'sponsor-1');
		expect(r.ok).toBe(false);
		expect(r.ok === false && r.reason).toBe('sponsor-missing');
	});
});
