/**
 * Tests for UadCompliancePackResolver — the BASE → CLIENT overlay.
 *
 * Pins the merge semantics:
 *   - BASE-only: configs from BASE flow through, appliedPackIds = [base.id]
 *   - CLIENT-only (no BASE): CLIENT configs alone, appliedPackIds = [client.id]
 *   - BASE + CLIENT: CLIENT entries REPLACE BASE entries whole for shared
 *     rule ids; rules present in BASE but not CLIENT pass through unchanged
 *   - clientId absent: CLIENT lookup is skipped entirely (no wasted DB call)
 *   - Pack lookup errors are swallowed; resolver returns whatever it has
 *     (resilience over correctness — UAD compliance must still compute on a
 *     transient Cosmos hiccup)
 */

import { describe, it, expect } from 'vitest';
import {
	UadCompliancePackResolver,
	clientPackId,
	UAD_BASE_PACK_ID,
} from '../uad-compliance-resolver.service';
import { UAD_COMPLIANCE_CATEGORY_ID } from '../uad-compliance.category';
import type { UadCustomRule, UadPackRule, UadRuleConfig } from '../../../uad-compliance-evaluator.service';

interface FakePack {
	id: string;
	rules: UadPackRule[];
}

function makeCustom(overrides: Partial<UadCustomRule>): UadCustomRule {
	return {
		kind: 'custom',
		id: 'tenant-rule',
		enabled: true,
		label: 'Tenant rule',
		severity: 'HIGH',
		condition: { '==': [1, 1] },
		message: 'Tenant rule failed.',
		...overrides,
	};
}

function makeOverride(overrides: Partial<UadRuleConfig>): UadRuleConfig {
	return {
		id: 'subject-parcel-number',
		enabled: true,
		...overrides,
	};
}

function makeStubPacks(packs: Array<{ tenantId: string; packId: string; pack: FakePack | null }>) {
	const calls: Array<{ category: string; tenantId: string; packId: string }> = [];
	const svc = {
		async getActive<R>(category: string, tenantId: string, packId: string) {
			calls.push({ category, tenantId, packId });
			const hit = packs.find((p) => p.tenantId === tenantId && p.packId === packId);
			return (hit?.pack ?? null) as unknown as R | null;
		},
	};
	return { svc: svc as never, calls };
}

describe('UadCompliancePackResolver.resolve', () => {
	it('BASE-only: returns BASE configs + base.id in appliedPackIds', async () => {
		const basePack: FakePack = {
			id: 'pack-base-v3',
			rules: [
				{ id: 'subject-parcel-number', enabled: false },
				{ id: 'subject-quality-rating', enabled: true, severityOverride: 'CRITICAL' },
			],
		};
		const { svc } = makeStubPacks([{ tenantId: 't', packId: UAD_BASE_PACK_ID, pack: basePack }]);
		const resolver = new UadCompliancePackResolver(svc);

		const out = await resolver.resolve({ tenantId: 't' });
		expect(out.appliedPackIds).toEqual(['pack-base-v3']);
		expect(out.configMap['subject-parcel-number']?.enabled).toBe(false);
		expect(out.configMap['subject-quality-rating']?.severityOverride).toBe('CRITICAL');
	});

	it('CLIENT-only (no BASE pack): returns CLIENT configs alone', async () => {
		const clientPack: FakePack = {
			id: 'pack-client-acme-v1',
			rules: [{ id: 'subject-parcel-number', enabled: true, severityOverride: 'CRITICAL' }],
		};
		const { svc } = makeStubPacks([
			{ tenantId: 't', packId: UAD_BASE_PACK_ID, pack: null },
			{ tenantId: 't', packId: clientPackId('acme'), pack: clientPack },
		]);
		const resolver = new UadCompliancePackResolver(svc);

		const out = await resolver.resolve({ tenantId: 't', clientId: 'acme' });
		expect(out.appliedPackIds).toEqual(['pack-client-acme-v1']);
		expect(out.configMap['subject-parcel-number']?.severityOverride).toBe('CRITICAL');
	});

	it('BASE + CLIENT: CLIENT replaces BASE entries whole for shared rule ids', async () => {
		const basePack: FakePack = {
			id: 'pack-base-v1',
			rules: [
				{ id: 'subject-parcel-number', enabled: true, severityOverride: 'MEDIUM', messageOverride: 'BASE msg' },
				{ id: 'subject-quality-rating', enabled: true },
			],
		};
		// CLIENT pack only mentions subject-parcel-number — it gets the FULL
		// new config (NOT a field-merge with BASE), and subject-quality-rating
		// passes through from BASE.
		const clientPack: FakePack = {
			id: 'pack-client-bank-v2',
			rules: [{ id: 'subject-parcel-number', enabled: false }],
		};
		const { svc } = makeStubPacks([
			{ tenantId: 't', packId: UAD_BASE_PACK_ID, pack: basePack },
			{ tenantId: 't', packId: clientPackId('bank'), pack: clientPack },
		]);
		const resolver = new UadCompliancePackResolver(svc);

		const out = await resolver.resolve({ tenantId: 't', clientId: 'bank' });
		expect(out.appliedPackIds).toEqual(['pack-base-v1', 'pack-client-bank-v2']);
		// CLIENT-only config wins — note BASE's messageOverride is GONE,
		// not preserved. Admins authoring a CLIENT override are stating the
		// complete config for that rule.
		expect(out.configMap['subject-parcel-number']?.enabled).toBe(false);
		expect(out.configMap['subject-parcel-number']?.messageOverride).toBeUndefined();
		expect(out.configMap['subject-parcel-number']?.severityOverride).toBeUndefined();
		// BASE-only rule passes through untouched.
		expect(out.configMap['subject-quality-rating']?.enabled).toBe(true);
	});

	it('clientId absent: only BASE is looked up', async () => {
		const { svc, calls } = makeStubPacks([
			{ tenantId: 't', packId: UAD_BASE_PACK_ID, pack: null },
		]);
		const resolver = new UadCompliancePackResolver(svc);
		await resolver.resolve({ tenantId: 't' });
		expect(calls).toHaveLength(1);
		expect(calls[0]!.packId).toBe(UAD_BASE_PACK_ID);
	});

	it('clientId present + no client pack found: BASE configs alone', async () => {
		const basePack: FakePack = {
			id: 'pack-base-v1',
			rules: [{ id: 'subject-parcel-number', enabled: false }],
		};
		const { svc } = makeStubPacks([
			{ tenantId: 't', packId: UAD_BASE_PACK_ID, pack: basePack },
			{ tenantId: 't', packId: clientPackId('acme'), pack: null },
		]);
		const resolver = new UadCompliancePackResolver(svc);

		const out = await resolver.resolve({ tenantId: 't', clientId: 'acme' });
		expect(out.appliedPackIds).toEqual(['pack-base-v1']);
		expect(out.configMap['subject-parcel-number']?.enabled).toBe(false);
	});

	it('pack lookup error is swallowed; resolver returns empty map', async () => {
		const svc = {
			async getActive() {
				throw new Error('cosmos transient');
			},
		} as never;
		const resolver = new UadCompliancePackResolver(svc);
		const out = await resolver.resolve({ tenantId: 't' });
		expect(out.appliedPackIds).toEqual([]);
		expect(out.configMap).toEqual({});
	});

	it('looks up packs by the correct category id', async () => {
		const { svc, calls } = makeStubPacks([]);
		const resolver = new UadCompliancePackResolver(svc);
		await resolver.resolve({ tenantId: 't', clientId: 'c' });
		for (const call of calls) {
			expect(call.category).toBe(UAD_COMPLIANCE_CATEGORY_ID);
		}
	});
});

describe('clientPackId helper', () => {
	it('encodes clientId into the client-scoped packId', () => {
		expect(clientPackId('acme')).toBe('client:acme');
		expect(clientPackId('123')).toBe('client:123');
	});
});

describe('UadCompliancePackResolver.resolve — custom-rule overlay', () => {
	it('BASE-only custom rules flow through to resolution.customRules', async () => {
		const basePack: FakePack = {
			id: 'pack-base-v1',
			rules: [makeCustom({ id: 'base-rule-1', message: 'BASE msg' })],
		};
		const { svc } = makeStubPacks([{ tenantId: 't', packId: UAD_BASE_PACK_ID, pack: basePack }]);
		const resolver = new UadCompliancePackResolver(svc);

		const out = await resolver.resolve({ tenantId: 't' });
		expect(out.customRules).toHaveLength(1);
		expect(out.customRules[0]!.id).toBe('base-rule-1');
		expect(out.customRules[0]!.message).toBe('BASE msg');
	});

	it('CLIENT custom rules are unioned with BASE; same-id CLIENT replaces BASE whole', async () => {
		const basePack: FakePack = {
			id: 'pack-base-v1',
			rules: [
				makeCustom({ id: 'shared-rule', message: 'BASE shared', severity: 'MEDIUM' }),
				makeCustom({ id: 'base-only-rule', message: 'BASE only' }),
			],
		};
		const clientPack: FakePack = {
			id: 'pack-client-acme-v1',
			rules: [
				makeCustom({ id: 'shared-rule', message: 'CLIENT shared', severity: 'CRITICAL' }),
				makeCustom({ id: 'client-only-rule', message: 'CLIENT only' }),
			],
		};
		const { svc } = makeStubPacks([
			{ tenantId: 't', packId: UAD_BASE_PACK_ID, pack: basePack },
			{ tenantId: 't', packId: clientPackId('acme'), pack: clientPack },
		]);
		const resolver = new UadCompliancePackResolver(svc);

		const out = await resolver.resolve({ tenantId: 't', clientId: 'acme' });
		expect(out.customRules).toHaveLength(3);
		const shared = out.customRules.find((r) => r.id === 'shared-rule')!;
		expect(shared.message).toBe('CLIENT shared');
		expect(shared.severity).toBe('CRITICAL');
		const baseOnly = out.customRules.find((r) => r.id === 'base-only-rule')!;
		expect(baseOnly.message).toBe('BASE only');
		const clientOnly = out.customRules.find((r) => r.id === 'client-only-rule')!;
		expect(clientOnly.message).toBe('CLIENT only');
	});

	it('mixed override + custom rules split correctly across layers', async () => {
		const basePack: FakePack = {
			id: 'pack-base-v1',
			rules: [
				makeOverride({ id: 'subject-parcel-number', enabled: false }),
				makeCustom({ id: 'tenant-rule', message: 'BASE tenant msg' }),
			],
		};
		const clientPack: FakePack = {
			id: 'pack-client-v1',
			rules: [
				makeOverride({ id: 'subject-quality-rating', enabled: true, severityOverride: 'CRITICAL' }),
				makeCustom({ id: 'client-rule', message: 'CLIENT-only tenant msg' }),
			],
		};
		const { svc } = makeStubPacks([
			{ tenantId: 't', packId: UAD_BASE_PACK_ID, pack: basePack },
			{ tenantId: 't', packId: clientPackId('c'), pack: clientPack },
		]);
		const resolver = new UadCompliancePackResolver(svc);

		const out = await resolver.resolve({ tenantId: 't', clientId: 'c' });
		// Overrides: BASE disables APN, CLIENT raises quality severity.
		expect(out.configMap['subject-parcel-number']?.enabled).toBe(false);
		expect(out.configMap['subject-quality-rating']?.severityOverride).toBe('CRITICAL');
		// Custom rules: both flow through.
		const customIds = out.customRules.map((r) => r.id).sort();
		expect(customIds).toEqual(['client-rule', 'tenant-rule']);
		// appliedPackIds carries both pack docs.
		expect(out.appliedPackIds).toEqual(['pack-base-v1', 'pack-client-v1']);
	});

	it('returns empty customRules when no packs exist', async () => {
		const { svc } = makeStubPacks([]);
		const resolver = new UadCompliancePackResolver(svc);
		const out = await resolver.resolve({ tenantId: 't' });
		expect(out.customRules).toEqual([]);
	});
});
