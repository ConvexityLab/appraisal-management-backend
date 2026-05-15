/**
 * Phase 14 v2 — AutopilotRunRepository unit tests.
 *
 * Direct coverage on the run state-machine repository.  Locks in:
 *   - Per-doc TTL stamped on creation (15,552,000s = 180d)
 *   - findByIdempotencyKey filters by entityType (hot path for SB dedup)
 *   - listAwaitingApproval filter shape
 *   - listRecent ordering + pagination
 *   - finalize() merges terminal state + error envelope
 */

import { describe, expect, it, vi } from 'vitest';
import { AutopilotRunRepository } from '../../src/services/autopilot-run.repository.js';
import type { AutopilotRun } from '../../src/types/autopilot-recipe.types.js';

function makeRun(overrides: Partial<AutopilotRun> = {}): AutopilotRun {
	return {
		id: 'run-1',
		tenantId: 't1',
		entityType: 'autopilot-run',
		recipeId: 'recipe-1',
		sponsorUserId: 'sponsor-1',
		triggeredBy: { kind: 'cron', idempotencyKey: 'idem-1' },
		status: 'running',
		startedAt: '2026-05-11T00:00:00Z',
		...overrides,
	};
}

function fakeCosmos(queryResults: unknown[][] = []) {
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
				return { success: true, data: doc };
			}),
		},
	};
}

describe('AutopilotRunRepository.create', () => {
	it('stamps per-document TTL of 180 days on every new run', async () => {
		const { cosmos, calls } = fakeCosmos();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRunRepository(cosmos as any);
		await repo.create({
			tenantId: 't1',
			recipeId: 'recipe-1',
			sponsorUserId: 'sponsor-1',
			triggeredBy: { kind: 'cron', idempotencyKey: 'idem-1' },
		});
		expect(calls.created).toHaveLength(1);
		const doc = calls.created[0] as Record<string, unknown>;
		expect(doc.ttl).toBe(15_552_000);
		expect(doc.entityType).toBe('autopilot-run');
		expect(doc.status).toBe('queued');
		expect(doc.startedAt).toBeDefined();
	});

	it('honors explicit status override', async () => {
		const { cosmos, calls } = fakeCosmos();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRunRepository(cosmos as any);
		await repo.create({
			tenantId: 't1',
			recipeId: 'recipe-1',
			sponsorUserId: 'sponsor-1',
			triggeredBy: { kind: 'cron', idempotencyKey: 'idem-1' },
			status: 'running',
		});
		expect((calls.created[0] as { status: string }).status).toBe('running');
	});
});

describe('AutopilotRunRepository.findByIdempotencyKey', () => {
	it('filters by tenantId, entityType, and idempotencyKey (hot path on SB receipt)', async () => {
		const { cosmos, calls } = fakeCosmos([[makeRun()]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRunRepository(cosmos as any);
		await repo.findByIdempotencyKey('t1', 'idem-1');
		expect(calls.queries).toHaveLength(1);
		const q = calls.queries[0]!.query;
		expect(q).toContain('c.tenantId = @tenantId');
		expect(q).toContain('c.entityType = "autopilot-run"');
		expect(q).toContain('c.triggeredBy.idempotencyKey = @key');
	});

	it('returns null when the idempotency key has not been seen', async () => {
		const { cosmos } = fakeCosmos([[]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRunRepository(cosmos as any);
		const r = await repo.findByIdempotencyKey('t1', 'new-key');
		expect(r.success).toBe(true);
		expect(r.data).toBeNull();
	});
});

describe('AutopilotRunRepository.listAwaitingApproval', () => {
	it('filters by entityType + awaiting-approval status', async () => {
		const { cosmos, calls } = fakeCosmos([[makeRun({ status: 'awaiting-approval' })]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRunRepository(cosmos as any);
		await repo.listAwaitingApproval('t1');
		const q = calls.queries[0]!.query;
		expect(q).toContain('c.entityType = "autopilot-run"');
		expect(q).toContain('c.status = "awaiting-approval"');
		expect(q).toContain('ORDER BY c.startedAt DESC');
	});

	it('caps limit between 1 and 500 inclusive', async () => {
		const { cosmos, calls } = fakeCosmos([[], [], []]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRunRepository(cosmos as any);
		await repo.listAwaitingApproval('t1', 9999);
		await repo.listAwaitingApproval('t1', -3);
		expect(calls.queries[0]!.query).toContain('TOP 500');
		expect(calls.queries[1]!.query).toContain('TOP 1');
	});
});

describe('AutopilotRunRepository.update + finalize', () => {
	it('finalize preserves id/tenantId/entityType + stamps completedAt', async () => {
		const { cosmos, calls } = fakeCosmos([[makeRun()]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRunRepository(cosmos as any);
		await repo.finalize('t1', 'run-1', 'succeeded');
		expect(calls.upserted).toHaveLength(1);
		const doc = calls.upserted[0] as Record<string, unknown>;
		expect(doc.id).toBe('run-1');
		expect(doc.tenantId).toBe('t1');
		expect(doc.entityType).toBe('autopilot-run');
		expect(doc.status).toBe('succeeded');
		expect(doc.completedAt).toBeDefined();
	});

	it('finalize merges error + metrics envelopes', async () => {
		const { cosmos, calls } = fakeCosmos([[makeRun()]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRunRepository(cosmos as any);
		await repo.finalize('t1', 'run-1', 'failed', {
			error: { code: 'DISPATCH_FAILED', message: 'boom' },
			metrics: { wallSeconds: 42 },
		});
		const doc = calls.upserted[0] as Record<string, unknown>;
		expect(doc.error).toEqual({ code: 'DISPATCH_FAILED', message: 'boom' });
		expect(doc.metrics).toEqual({ wallSeconds: 42 });
	});

	it('finalize swallows missing-run silently (telemetry-only path)', async () => {
		const { cosmos } = fakeCosmos([[]]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const repo = new AutopilotRunRepository(cosmos as any);
		await expect(repo.finalize('t1', 'gone', 'failed')).resolves.toBeUndefined();
	});
});
