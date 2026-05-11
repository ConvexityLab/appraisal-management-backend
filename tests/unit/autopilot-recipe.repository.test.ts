/**
 * Phase 14 v2 — AutopilotRecipeRepository unit tests.
 *
 * Direct coverage on the recipe CRUD surface — prior to this file all
 * coverage was indirect via ai-autopilot.service.test.ts (which mocked
 * the repo at the Cosmos boundary).  Tests here exercise the actual
 * repository methods with a fake Cosmos so we lock in:
 *   - Query shape (entityType filter, partition key, sort order)
 *   - listAllActiveCronRecipes cross-tenant enumeration
 *   - recordFire telemetry on success + failure
 *   - update merge semantics (id + tenantId + entityType preserved)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AutopilotRecipeRepository } from '../../src/services/autopilot-recipe.repository.js';
import type { AutopilotRecipe } from '../../src/types/autopilot-recipe.types.js';

function makeRecipe(overrides: Partial<AutopilotRecipe> = {}): AutopilotRecipe {
	return {
		id: 'recipe-1',
		tenantId: 't1',
		entityType: 'autopilot-recipe',
		name: 'live-fire',
		sponsorUserId: 'sponsor-1',
		status: 'active',
		createdAt: '2026-05-11T00:00:00Z',
		updatedAt: '2026-05-11T00:00:00Z',
		createdBy: 'sponsor-1',
		policy: { mode: 'approve' },
		trigger: { kind: 'cron', cron: 'every-2h' },
		request: { intent: 'TRIGGER_AUTO_ASSIGNMENT', actionPayload: { orderIds: ['o-1'] } },
		...overrides,
	};
}

function fakeCosmos(queryResults: unknown[][] = [], upsertSideEffect?: 'fail') {
	const queue = [...queryResults];
	const calls = {
		queries: [] as Array<{ query: string; params: unknown[] }>,
		created: [] as unknown[],
		upserted: [] as unknown[],
	};
	return {
		calls,
		cosmos: {
			queryItems: vi.fn(async (_c: string, query: string, params: unknown[]) => {
				calls.queries.push({ query, params });
				return { success: true, data: queue.shift() ?? [] };
			}),
			createItem: vi.fn(async (_c: string, doc: unknown) => {
				calls.created.push(doc);
				return { success: true, data: doc };
			}),
			upsertItem: vi.fn(async (_c: string, doc: unknown) => {
				calls.upserted.push(doc);
				if (upsertSideEffect === 'fail') {
					return {
						success: false,
						error: { code: 'COSMOS_DOWN', message: 'boom', timestamp: new Date() },
					};
				}
				return { success: true, data: doc };
			}),
		},
	};
}

describe('AutopilotRecipeRepository.create', () => {
	it('rejects when tenantId is missing', async () => {
		const { cosmos } = fakeCosmos();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		const r = await repo.create({
			// @ts-expect-error — testing the guard
			tenantId: undefined,
			sponsorUserId: 's',
			createdBy: 'c',
			name: 'n',
			policy: { mode: 'approve' },
			trigger: { kind: 'cron', cron: 'every-2h' },
			request: { prompt: 'x' },
		});
		expect(r.success).toBe(false);
		expect((r as { error: { code: string } }).error.code).toBe('INVALID_RECIPE');
	});

	it('stamps id, entityType, fireCount, status, createdAt, updatedAt', async () => {
		const { cosmos, calls } = fakeCosmos();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		await repo.create({
			tenantId: 't1',
			sponsorUserId: 'sponsor-1',
			createdBy: 'admin-1',
			name: 'n',
			policy: { mode: 'approve' },
			trigger: { kind: 'cron', cron: 'every-2h' },
			request: { prompt: 'go' },
		});
		expect(calls.created).toHaveLength(1);
		const doc = calls.created[0] as Record<string, unknown>;
		expect(doc.id).toBeDefined();
		expect(doc.entityType).toBe('autopilot-recipe');
		expect(doc.fireCount).toBe(0);
		expect(doc.status).toBe('active');
		expect(doc.createdAt).toBeDefined();
		expect(doc.updatedAt).toBeDefined();
	});
});

describe('AutopilotRecipeRepository.listForTenant', () => {
	it('filters by entityType + tenantId', async () => {
		const { cosmos, calls } = fakeCosmos([[makeRecipe()]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		await repo.listForTenant('t1');
		expect(calls.queries).toHaveLength(1);
		expect(calls.queries[0]!.query).toContain('c.tenantId = @tenantId');
		expect(calls.queries[0]!.query).toContain('c.entityType = "autopilot-recipe"');
		expect(calls.queries[0]!.query).toContain('ORDER BY c.createdAt DESC');
	});

	it('honors status filter when supplied', async () => {
		const { cosmos, calls } = fakeCosmos([[]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		await repo.listForTenant('t1', ['active', 'paused']);
		expect(calls.queries[0]!.query).toContain('c.status IN');
		const params = calls.queries[0]!.params as Array<{ name: string; value: string }>;
		expect(params.find((p) => p.value === 'active')).toBeDefined();
		expect(params.find((p) => p.value === 'paused')).toBeDefined();
	});
});

describe('AutopilotRecipeRepository.listAllActiveCronRecipes', () => {
	it('cross-tenant — no tenantId filter, only entityType + status + trigger', async () => {
		const { cosmos, calls } = fakeCosmos([[makeRecipe()]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		await repo.listAllActiveCronRecipes();
		expect(calls.queries).toHaveLength(1);
		const q = calls.queries[0]!.query;
		expect(q).toContain('c.entityType = "autopilot-recipe"');
		expect(q).toContain('c.status = "active"');
		expect(q).toContain('c.trigger.kind = "cron"');
		expect(q).toContain('IS_DEFINED(c.trigger.cron)');
		// No tenantId filter (that's the whole point of the sweep query).
		expect(q).not.toContain('@tenantId');
	});
});

describe('AutopilotRecipeRepository.update', () => {
	it('preserves id, tenantId, entityType across merge', async () => {
		const { cosmos, calls } = fakeCosmos([[makeRecipe()]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		await repo.update('t1', 'recipe-1', { status: 'paused', name: 'NEW' });
		expect(calls.upserted).toHaveLength(1);
		const doc = calls.upserted[0] as Record<string, unknown>;
		expect(doc.id).toBe('recipe-1');
		expect(doc.tenantId).toBe('t1');
		expect(doc.entityType).toBe('autopilot-recipe');
		expect(doc.status).toBe('paused');
		expect(doc.name).toBe('NEW');
		// updatedAt is refreshed.
		expect(doc.updatedAt).toBeDefined();
		expect(doc.updatedAt).not.toBe('2026-05-11T00:00:00Z');
	});

	it('returns NOT_FOUND when recipe does not exist', async () => {
		const { cosmos } = fakeCosmos([[]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		const r = await repo.update('t1', 'missing', { status: 'paused' });
		expect(r.success).toBe(false);
		expect((r as { error: { code: string } }).error.code).toBe('NOT_FOUND');
	});
});

describe('AutopilotRecipeRepository.recordFire', () => {
	it('increments fireCount + stamps lastFireAt on success', async () => {
		// recordFire calls getById, then update() — update() ALSO calls
		// getById internally before upserting.  Seed both.
		const initial = makeRecipe({ fireCount: 3 });
		const { cosmos, calls } = fakeCosmos([[initial], [initial]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		await repo.recordFire('t1', 'recipe-1', true);
		const doc = calls.upserted[0] as Record<string, unknown>;
		expect(doc.fireCount).toBe(4);
		expect(doc.lastFireAt).toBeDefined();
		expect(doc.lastFailureAt).toBeUndefined();
	});

	it('increments fireCount + stamps lastFailureAt + reason on failure', async () => {
		const initial = makeRecipe({ fireCount: 0 });
		const { cosmos, calls } = fakeCosmos([[initial], [initial]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		await repo.recordFire('t1', 'recipe-1', false, 'dispatch-failed');
		const doc = calls.upserted[0] as Record<string, unknown>;
		expect(doc.fireCount).toBe(1);
		expect(doc.lastFailureAt).toBeDefined();
		expect(doc.lastFailureReason).toBe('dispatch-failed');
	});

	it('swallows missing-recipe silently (telemetry-only path)', async () => {
		const { cosmos } = fakeCosmos([[]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		// Must not throw.
		await expect(repo.recordFire('t1', 'gone', true)).resolves.toBeUndefined();
	});

	it('swallows upsert failure silently', async () => {
		const { cosmos } = fakeCosmos([[makeRecipe()]], 'fail');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRecipeRepository(cosmos as any);
		await expect(repo.recordFire('t1', 'recipe-1', true)).resolves.toBeUndefined();
	});
});
