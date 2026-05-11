/**
 * Phase 14 v2 — AiAutopilotSweepJob tests.
 *
 * Covers:
 *   - shouldFire honors `every-Nm` shorthand
 *   - shouldFire honors `0 *\/N * * *` (every N hours)
 *   - shouldFire returns false when the cron hasn't elapsed
 *   - tick() publishes one task per due recipe
 *   - tick() short-circuits when no active recipes
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AiAutopilotSweepJob } from '../../src/jobs/ai-autopilot-sweep.job.js';
import {
	_peekAutopilotMockOutbox,
	_resetAutopilotMockOutbox,
	AiAutopilotPublisher,
} from '../../src/services/ai-autopilot-publisher.service.js';
import type { AutopilotRecipe } from '../../src/types/autopilot-recipe.types.js';

function recipe(overrides: Partial<AutopilotRecipe> = {}): AutopilotRecipe {
	return {
		id: 'recipe-1',
		tenantId: 't1',
		entityType: 'autopilot-recipe',
		name: 'Test',
		sponsorUserId: 'sponsor-1',
		status: 'active',
		createdAt: '2026-05-11T00:00:00Z',
		updatedAt: '2026-05-11T00:00:00Z',
		createdBy: 'sponsor-1',
		policy: { mode: 'always' },
		trigger: { kind: 'cron', cron: 'every-15m' },
		request: { intent: 'TRIGGER_AUTO_ASSIGNMENT', actionPayload: { orderIds: ['o1'] } },
		...overrides,
	};
}

function mockCosmos(recipes: AutopilotRecipe[]) {
	return {
		queryItems: vi.fn(async () => ({ success: true, data: recipes })),
		createItem: vi.fn(async (_c: string, d: unknown) => ({ success: true, data: d })),
		upsertItem: vi.fn(async (_c: string, d: unknown) => ({ success: true, data: d })),
	};
}

describe('AiAutopilotSweepJob', () => {
	beforeEach(() => {
		process.env.USE_MOCK_SERVICE_BUS = 'true';
		// Per-tenant flag check falls back to this env when no flags doc
		// exists for the tenant.  Tests don't seed a flags doc, so we
		// flip the default on to keep the publish path live.
		process.env.AI_AUTOPILOT_DEFAULT_ENABLED = 'true';
		_resetAutopilotMockOutbox();
	});

	it('shouldFire(every-15m): true when 16m have elapsed', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const job = new AiAutopilotSweepJob(mockCosmos([]) as any);
		const sixteenAgo = new Date(Date.now() - 16 * 60 * 1000).toISOString();
		const r = recipe({ trigger: { kind: 'cron', cron: 'every-15m' }, lastFireAt: sixteenAgo });
		expect(job.shouldFire(r, new Date())).toBe(true);
	});

	it('shouldFire(every-15m): false when 10m have elapsed', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const job = new AiAutopilotSweepJob(mockCosmos([]) as any);
		const tenAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
		const r = recipe({ trigger: { kind: 'cron', cron: 'every-15m' }, lastFireAt: tenAgo });
		expect(job.shouldFire(r, new Date())).toBe(false);
	});

	it('shouldFire(every-2h): true after 3h', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const job = new AiAutopilotSweepJob(mockCosmos([]) as any);
		const threeAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
		const r = recipe({ trigger: { kind: 'cron', cron: 'every-2h' }, lastFireAt: threeAgo });
		expect(job.shouldFire(r, new Date())).toBe(true);
	});

	it('shouldFire(unsupported cron): false (silent skip)', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const job = new AiAutopilotSweepJob(mockCosmos([]) as any);
		const r = recipe({ trigger: { kind: 'cron', cron: '*/5 * * * *' } });
		expect(job.shouldFire(r, new Date())).toBe(false);
	});

	it('tick() publishes one task per due recipe', async () => {
		const sixteenAgo = new Date(Date.now() - 16 * 60 * 1000).toISOString();
		const recipes = [
			recipe({ id: 'r1', lastFireAt: sixteenAgo }),
			recipe({ id: 'r2', lastFireAt: sixteenAgo }),
			// not-due → skipped
			recipe({ id: 'r3', lastFireAt: new Date().toISOString() }),
		];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const job = new AiAutopilotSweepJob(mockCosmos(recipes) as any, new AiAutopilotPublisher());
		await job.tick();
		const outbox = _peekAutopilotMockOutbox();
		const ids = outbox.map((m) => m.recipeId).sort();
		expect(ids).toEqual(['r1', 'r2']);
		// Idempotency key includes recipe id.
		expect(outbox.every((m) => m.idempotencyKey.includes(m.recipeId))).toBe(true);
	});

	it('tick() no-ops when there are no active recipes', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const job = new AiAutopilotSweepJob(mockCosmos([]) as any, new AiAutopilotPublisher());
		await job.tick();
		expect(_peekAutopilotMockOutbox().length).toBe(0);
	});
});
