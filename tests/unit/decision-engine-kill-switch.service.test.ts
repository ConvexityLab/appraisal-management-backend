/**
 * Tests for DecisionEngineKillSwitchService — Phase I (kill-switch BE
 * wiring) of DECISION_ENGINE_RULES_SURFACE.md.
 *
 * Pins the invariants the operator-facing toggle + the cron + the
 * controller depend on:
 *   - getFlags returns {} when no doc exists
 *   - setFlag upserts + invalidates the cache (next read reflects new state)
 *   - setFlag preserves other categories' flags (per-key merge)
 *   - isKilled is fast-path + 60s cached
 *   - read failures fail OPEN (return false) — kill-switch is a safety
 *     lever, not a fragility lever
 *   - tenantId / categoryId / updatedBy required on writes
 */

import { describe, expect, it, vi } from 'vitest';
import { DecisionEngineKillSwitchService } from '../../src/services/decision-engine/kill-switch/kill-switch.service.js';

interface FakeDb {
	queryDocuments: ReturnType<typeof vi.fn>;
	upsertDocument: ReturnType<typeof vi.fn>;
}

function makeFakeDb(opts: { initialDoc?: any; readError?: Error } = {}): FakeDb {
	let stored = opts.initialDoc ?? null;
	return {
		queryDocuments: vi.fn(async (_cn, _q, params: { name: string; value: string }[]) => {
			if (opts.readError) throw opts.readError;
			const tenantId = params.find(p => p.name === '@clientId')?.value;
			if (stored && stored.clientId === tenantId) return [stored];
			return [];
		}),
		upsertDocument: vi.fn(async (_cn, doc) => {
			stored = doc;
		}),
	};
}

describe('DecisionEngineKillSwitchService', () => {
	it('getFlags returns empty object when no doc exists', async () => {
		const db = makeFakeDb();
		const svc = new DecisionEngineKillSwitchService(db as never);
		const flags = await svc.getFlags('t1');
		expect(flags).toEqual({});
	});

	it('setFlag upserts and the next read sees the new state (cache invalidated)', async () => {
		const db = makeFakeDb();
		const svc = new DecisionEngineKillSwitchService(db as never);

		// Prime the cache with empty flags
		expect(await svc.getFlags('t1')).toEqual({});

		await svc.setFlag('t1', 'vendor-matching', true, 'tester@l1');

		// Cache must have been invalidated
		const flags = await svc.getFlags('t1');
		expect(flags).toEqual({ 'vendor-matching': true });
		expect(db.upsertDocument).toHaveBeenCalledTimes(1);
	});

	it('setFlag preserves other categories — per-key merge, not replace', async () => {
		const db = makeFakeDb({
			initialDoc: {
				id: 'x',
				clientId: 't1',
				entityType: 'decision-engine-kill-switches',
				flags: { 'firing-rules': true, 'vendor-matching': false },
				updatedAt: '2026-05-09T00:00:00Z',
				updatedBy: 'old',
			},
		});
		const svc = new DecisionEngineKillSwitchService(db as never);
		await svc.setFlag('t1', 'vendor-matching', true, 'tester');
		const flags = await svc.getFlags('t1');
		expect(flags).toEqual({
			'firing-rules': true,
			'vendor-matching': true,
		});
	});

	it('isKilled returns true only when the (tenant, category) flag is on', async () => {
		const db = makeFakeDb({
			initialDoc: {
				id: 'x',
				clientId: 't1',
				entityType: 'decision-engine-kill-switches',
				flags: { 'vendor-matching': true, 'firing-rules': false },
				updatedAt: '2026-05-09T00:00:00Z',
				updatedBy: 'tester',
			},
		});
		const svc = new DecisionEngineKillSwitchService(db as never);
		expect(await svc.isKilled('t1', 'vendor-matching')).toBe(true);
		expect(await svc.isKilled('t1', 'firing-rules')).toBe(false);
		expect(await svc.isKilled('t1', 'review-program')).toBe(false);
		expect(await svc.isKilled('t-other', 'vendor-matching')).toBe(false);
	});

	it('caches isKilled (subsequent calls within TTL hit cache, not Cosmos)', async () => {
		const db = makeFakeDb();
		const svc = new DecisionEngineKillSwitchService(db as never);
		await svc.isKilled('t1', 'vendor-matching');
		await svc.isKilled('t1', 'vendor-matching');
		await svc.isKilled('t1', 'firing-rules');
		// Three checks; one DB hit per tenant for the cache prime.
		expect(db.queryDocuments).toHaveBeenCalledTimes(1);
	});

	it('fails OPEN on read error (returns false, swallows + caches briefly)', async () => {
		const db = makeFakeDb({ readError: new Error('Cosmos down') });
		const svc = new DecisionEngineKillSwitchService(db as never);
		expect(await svc.isKilled('t1', 'vendor-matching')).toBe(false);
		expect(await svc.isKilled('t1', 'firing-rules')).toBe(false);
		// Brief negative cache prevents hammering Cosmos during outage
		expect(db.queryDocuments).toHaveBeenCalledTimes(1);
	});

	it('rejects writes with missing tenantId / categoryId / updatedBy', async () => {
		const db = makeFakeDb();
		const svc = new DecisionEngineKillSwitchService(db as never);
		await expect(svc.setFlag('', 'vendor-matching', true, 'u')).rejects.toThrow(/tenantId/);
		await expect(svc.setFlag('t', '', true, 'u')).rejects.toThrow(/categoryId/);
		await expect(svc.setFlag('t', 'vendor-matching', true, '')).rejects.toThrow(/updatedBy/);
	});

	it('writes to client-configs container with the discriminator entityType', async () => {
		const db = makeFakeDb();
		const svc = new DecisionEngineKillSwitchService(db as never);
		await svc.setFlag('t1', 'firing-rules', true, 'tester');
		const [containerName, doc] = db.upsertDocument.mock.calls[0]!;
		expect(containerName).toBe('client-configs');
		expect(doc.entityType).toBe('decision-engine-kill-switches');
		expect(doc.clientId).toBe('t1');
		expect(doc.flags).toEqual({ 'firing-rules': true });
	});
});
