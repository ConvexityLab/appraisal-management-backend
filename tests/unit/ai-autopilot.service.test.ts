/**
 * Phase 14 v2 — AiAutopilotService unit tests.
 *
 * Covers the orchestration paths:
 *   - Idempotency short-circuit
 *   - Recipe not found
 *   - Recipe in non-active status
 *   - Policy 'never' → cancelled
 *   - Policy 'approve' / 'admin' → awaiting-approval (parked)
 *   - Policy 'always' + concrete intent → dispatched via AiActionDispatcherService
 *   - Chain depth cap
 *   - Message validation refusals
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AiAutopilotService } from '../../src/services/ai-autopilot.service.js';
import type { AutopilotRecipe, AutopilotRun } from '../../src/types/autopilot-recipe.types.js';

function recipe(overrides: Partial<AutopilotRecipe> = {}): AutopilotRecipe {
	return {
		id: 'recipe-1',
		tenantId: 't1',
		entityType: 'autopilot-recipe',
		name: 'Test recipe',
		sponsorUserId: 'sponsor-1',
		status: 'active',
		createdAt: '2026-05-11T00:00:00Z',
		updatedAt: '2026-05-11T00:00:00Z',
		createdBy: 'sponsor-1',
		policy: { mode: 'always' },
		trigger: { kind: 'cron', cron: '0 * * * *' },
		request: { intent: 'TRIGGER_AUTO_ASSIGNMENT', actionPayload: { orderIds: ['o1'] } },
		...overrides,
	};
}

function run(overrides: Partial<AutopilotRun> = {}): AutopilotRun {
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

interface MockCosmosCalls {
	queries: Array<{ query: string; params: unknown[] }>;
	created: unknown[];
	upserted: unknown[];
}

function makeMockCosmos(
	prebuiltQueryResults: Array<unknown[]> = [],
): { mock: unknown; calls: MockCosmosCalls } {
	const calls: MockCosmosCalls = { queries: [], created: [], upserted: [] };
	const queue = [...prebuiltQueryResults];
	const mock = {
		queryItems: vi.fn(async (_container: string, query: string, params: unknown[]) => {
			calls.queries.push({ query, params });
			const next = queue.shift();
			return { success: true, data: next ?? [] };
		}),
		createItem: vi.fn(async (_container: string, doc: unknown) => {
			calls.created.push(doc);
			return { success: true, data: doc };
		}),
		upsertItem: vi.fn(async (_container: string, doc: unknown) => {
			calls.upserted.push(doc);
			return { success: true, data: doc };
		}),
	};
	return { mock, calls };
}

describe('AiAutopilotService.processTask', () => {
	let dispatcherSpies: {
		handleTriggerAutoAssignment: ReturnType<typeof vi.fn>;
		handleCreateOrder: ReturnType<typeof vi.fn>;
		handleCreateEngagement: ReturnType<typeof vi.fn>;
		handleAssignVendor: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		dispatcherSpies = {
			handleTriggerAutoAssignment: vi.fn(async () => ({ message: 'auto-assigned', data: {} })),
			handleCreateOrder: vi.fn(async () => ({ message: 'order created', data: {} })),
			handleCreateEngagement: vi.fn(async () => ({ message: 'engagement created', data: {} })),
			handleAssignVendor: vi.fn(async () => ({ message: 'vendor assigned', data: {} })),
		};
	});

	function buildService(
		prebuiltQueries: Array<unknown[]>,
		sponsorResult: { ok: boolean; reason?: string; message?: string } = {
			ok: true,
		},
	) {
		const { mock, calls } = makeMockCosmos(prebuiltQueries);
		const sponsorIdentity = {
			resolve: vi.fn(async () =>
				sponsorResult.ok
					? {
							ok: true,
							tenantId: 't1',
							userId: 'sponsor-1',
							role: 'admin',
						}
					: {
							ok: false,
							reason: sponsorResult.reason ?? 'sponsor-missing',
							message: sponsorResult.message ?? 'sponsor unknown',
						},
			),
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const service = new AiAutopilotService(mock as any, sponsorIdentity as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(service as any).dispatcher = dispatcherSpies;
		return { service, calls, sponsorIdentity };
	}

	it('refuses messages missing tenantId', async () => {
		const { service } = buildService([]);
		const r = await service.processTask({
			// @ts-expect-error — intentionally malformed
			tenantId: undefined,
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(false);
		expect(r.status).toBe('failed');
		expect(r.reason).toBe('missing-tenantId');
	});

	it('short-circuits on idempotency replay', async () => {
		// Query 1: idempotency probe — returns existing run.
		const { service, calls } = buildService([[run({ status: 'succeeded' })]]);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(true);
		expect(r.status).toBe('succeeded');
		expect(r.reason).toBe('idempotent-replay');
		// Only ONE query — the idempotency probe.  No recipe lookup, no
		// dispatch, no run creation.
		expect(calls.queries.length).toBe(1);
		expect(calls.created.length).toBe(0);
		expect(dispatcherSpies.handleTriggerAutoAssignment).not.toHaveBeenCalled();
	});

	it('cancels when chain depth exceeds cap', async () => {
		const { service } = buildService([]);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'ai-chain', chainDepth: 999 },
		});
		expect(r.ok).toBe(false);
		expect(r.status).toBe('cancelled');
		expect(r.reason).toContain('Chain depth');
	});

	it('returns failed when recipe is not found', async () => {
		// Queries: idempotency probe (empty), then recipe lookup (empty).
		const { service } = buildService([[], []]);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'missing',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(false);
		expect(r.status).toBe('failed');
		expect(r.reason).toBe('recipe-not-found');
	});

	it('cancels when recipe status is paused', async () => {
		// Queries: idempotency probe (empty), recipe lookup (paused).
		const { service } = buildService([[], [recipe({ status: 'paused' })]]);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(false);
		expect(r.status).toBe('cancelled');
		expect(r.reason).toBe('recipe-status-paused');
	});

	it('parks for approval when policy is approve', async () => {
		// Queries: idempotency (empty), recipe (approve-policy).
		const { service, calls } = buildService([
			[],
			[recipe({ policy: { mode: 'approve' } })],
		]);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(true);
		expect(r.status).toBe('awaiting-approval');
		// Run row was created.
		expect(calls.created.length).toBeGreaterThan(0);
		// No dispatch happened.
		expect(dispatcherSpies.handleTriggerAutoAssignment).not.toHaveBeenCalled();
	});

	it('cancels when policy is never', async () => {
		const { service } = buildService([
			[],
			[recipe({ policy: { mode: 'never' } })],
		]);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(false);
		expect(r.status).toBe('cancelled');
		expect(r.reason).toBe('policy-never');
	});

	it('dispatches when policy is always + intent is concrete', async () => {
		// Queries for: idempotency probe (empty), recipe lookup (always),
		// then the finalize() inside dispatch makes a getById call to
		// resolve the prior run + a recordFire() getById too.  Queue a
		// few empties to be safe.
		const { service } = buildService([
			[],
			[recipe({ policy: { mode: 'always' } })],
			[run({ status: 'running' })],
			[recipe({ policy: { mode: 'always' } })],
		]);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(true);
		expect(r.status).toBe('succeeded');
		expect(dispatcherSpies.handleTriggerAutoAssignment).toHaveBeenCalledOnce();
		const dispatchCall = dispatcherSpies.handleTriggerAutoAssignment.mock.calls[0]!;
		expect(dispatchCall[1]).toEqual({ tenantId: 't1', userId: 'sponsor-1' });
	});

	it('parks prompt-only recipes for approval (no intent yet)', async () => {
		const promptRecipe = recipe({
			policy: { mode: 'always' },
			request: { prompt: 'Triage stuck orders' },
		});
		const { service } = buildService([
			[],
			[promptRecipe],
		]);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(true);
		expect(r.status).toBe('awaiting-approval');
		expect(r.reason).toBe('prompt-driven-recipes-need-approval-in-v2');
		expect(dispatcherSpies.handleTriggerAutoAssignment).not.toHaveBeenCalled();
	});

	it('pauses recipe + cancels run when sponsor is missing', async () => {
		// Queries: idempotency (empty), recipe (active), recipe-lookup
		// for the pause update.  Sponsor resolver fails.
		const { service, calls, sponsorIdentity } = buildService(
			[[], [recipe()], [recipe()]],
			{ ok: false, reason: 'sponsor-missing', message: 'gone' },
		);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(false);
		expect(r.status).toBe('cancelled');
		expect(r.reason).toBe('sponsor-missing');
		expect(sponsorIdentity.resolve).toHaveBeenCalledOnce();
		// The recipe should have been upserted with status='sponsor-missing'.
		const upsertedRecipe = calls.upserted.find(
			(d) => (d as Record<string, unknown>).entityType === 'autopilot-recipe',
		);
		expect((upsertedRecipe as Record<string, unknown> | undefined)?.status).toBe('sponsor-missing');
		// Dispatch never ran.
		expect(dispatcherSpies.handleTriggerAutoAssignment).not.toHaveBeenCalled();
	});

	it('cancels with sponsor-inactive when isActive is false', async () => {
		const { service } = buildService(
			[[], [recipe()], [recipe()]],
			{ ok: false, reason: 'sponsor-inactive', message: 'user deactivated' },
		);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(false);
		expect(r.status).toBe('cancelled');
		expect(r.reason).toBe('sponsor-inactive');
	});

	it('records failed run when dispatcher throws', async () => {
		dispatcherSpies.handleTriggerAutoAssignment.mockRejectedValueOnce(new Error('boom'));
		const { service } = buildService([
			[],
			[recipe({ policy: { mode: 'always' } })],
			[run({ status: 'running' })],
			[recipe({ policy: { mode: 'always' } })],
		]);
		const r = await service.processTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(false);
		expect(r.status).toBe('failed');
		expect(r.reason).toBe('boom');
	});

	// AI-chain trigger contract — Phase 14 v2 follow-up (2026-05-11).
	describe('AI-chain follow-up', () => {
		function buildWithPublisher(
			prebuiltQueries: Array<unknown[]>,
			sponsorOk = true,
		) {
			const { mock } = makeMockCosmos(prebuiltQueries);
			const sponsorIdentity = {
				resolve: vi.fn(async () =>
					sponsorOk
						? { ok: true, tenantId: 't1', userId: 'sponsor-1', role: 'admin' }
						: { ok: false, reason: 'sponsor-missing', message: 'x' },
				),
			};
			const publisher = {
				publish: vi.fn(async () => undefined),
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const service = new AiAutopilotService(mock as any, sponsorIdentity as any, publisher as any);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(service as any).dispatcher = dispatcherSpies;
			return { service, publisher };
		}

		it('publishes the chained task on successful dispatch', async () => {
			const chainedRecipe = recipe({
				policy: { mode: 'always' },
				chainTo: { recipeId: 'child-recipe-1', reason: 'parent-ok' },
			});
			const { service, publisher } = buildWithPublisher([
				[],
				[chainedRecipe],
				[run({ status: 'running' })],
				[chainedRecipe],
			]);
			const r = await service.processTask({
				tenantId: 't1',
				recipeId: 'recipe-1',
				idempotencyKey: 'idem-1',
				triggeredBy: { kind: 'cron' },
			});
			expect(r.ok).toBe(true);
			expect(r.status).toBe('succeeded');
			expect(publisher.publish).toHaveBeenCalledOnce();
			const task = publisher.publish.mock.calls[0]![0] as {
				recipeId: string;
				idempotencyKey: string;
				triggeredBy: { kind: string; parentRunId: string; chainDepth: number; sourceId: string };
			};
			expect(task.recipeId).toBe('child-recipe-1');
			expect(task.triggeredBy.kind).toBe('ai-chain');
			// runs.create generates a fresh uuid for the parent run, so
			// assert shape rather than specific value.
			expect(task.triggeredBy.parentRunId).toMatch(/^[0-9a-f-]+$/);
			expect(task.triggeredBy.chainDepth).toBe(1);
			expect(task.triggeredBy.sourceId).toBe('parent-ok');
			expect(task.idempotencyKey).toMatch(/^child-recipe-1::ai-chain::[0-9a-f-]+$/);
			// Cross-check: the idempotency key contains the same parentRunId.
			expect(task.idempotencyKey).toContain(task.triggeredBy.parentRunId);
		});

		it('increments chainDepth from the parent message depth', async () => {
			const chainedRecipe = recipe({
				policy: { mode: 'always' },
				chainTo: { recipeId: 'child-recipe-2' },
			});
			// Parent run row carries chainDepth: 2 (came from a previous chain).
			const { service, publisher } = buildWithPublisher([
				[],
				[chainedRecipe],
				[run({ status: 'running', triggeredBy: { kind: 'ai-chain', chainDepth: 2 } })],
				[chainedRecipe],
			]);
			await service.processTask({
				tenantId: 't1',
				recipeId: 'recipe-1',
				idempotencyKey: 'idem-2',
				triggeredBy: { kind: 'ai-chain', chainDepth: 2 },
			});
			const task = publisher.publish.mock.calls[0]![0] as { triggeredBy: { chainDepth: number } };
			expect(task.triggeredBy.chainDepth).toBe(3);
		});

		it('refuses chain publish past MAX_CHAIN_DEPTH', async () => {
			const chainedRecipe = recipe({
				policy: { mode: 'always' },
				chainTo: { recipeId: 'child-recipe-3' },
			});
			// Parent run was at the depth cap (3 by default).  Child would
			// be depth 4 — refused.
			const { service, publisher } = buildWithPublisher([
				[],
				[chainedRecipe],
				[run({ status: 'running', triggeredBy: { kind: 'ai-chain', chainDepth: 3 } })],
				[chainedRecipe],
			]);
			await service.processTask({
				tenantId: 't1',
				recipeId: 'recipe-1',
				idempotencyKey: 'idem-3',
				triggeredBy: { kind: 'ai-chain', chainDepth: 3 },
			});
			expect(publisher.publish).not.toHaveBeenCalled();
		});

		it('does NOT chain on failed dispatch', async () => {
			dispatcherSpies.handleTriggerAutoAssignment.mockRejectedValueOnce(new Error('dispatch-failed'));
			const chainedRecipe = recipe({
				policy: { mode: 'always' },
				chainTo: { recipeId: 'child-recipe-4' },
			});
			const { service, publisher } = buildWithPublisher([
				[],
				[chainedRecipe],
				[run({ status: 'running' })],
				[chainedRecipe],
			]);
			const r = await service.processTask({
				tenantId: 't1',
				recipeId: 'recipe-1',
				idempotencyKey: 'idem-4',
				triggeredBy: { kind: 'cron' },
			});
			expect(r.ok).toBe(false);
			expect(publisher.publish).not.toHaveBeenCalled();
		});

		it('does NOT chain on approval-queued runs', async () => {
			const chainedRecipe = recipe({
				policy: { mode: 'approve' },
				chainTo: { recipeId: 'child-recipe-5' },
			});
			const { service, publisher } = buildWithPublisher([
				[],
				[chainedRecipe],
			]);
			const r = await service.processTask({
				tenantId: 't1',
				recipeId: 'recipe-1',
				idempotencyKey: 'idem-5',
				triggeredBy: { kind: 'cron' },
			});
			expect(r.status).toBe('awaiting-approval');
			expect(publisher.publish).not.toHaveBeenCalled();
		});

		it('publisher errors do not roll back the parent succeeded state', async () => {
			const chainedRecipe = recipe({
				policy: { mode: 'always' },
				chainTo: { recipeId: 'child-recipe-6' },
			});
			const { service, publisher } = buildWithPublisher([
				[],
				[chainedRecipe],
				[run({ status: 'running' })],
				[chainedRecipe],
			]);
			publisher.publish.mockRejectedValueOnce(new Error('SB down'));
			const r = await service.processTask({
				tenantId: 't1',
				recipeId: 'recipe-1',
				idempotencyKey: 'idem-6',
				triggeredBy: { kind: 'cron' },
			});
			expect(r.ok).toBe(true);
			expect(r.status).toBe('succeeded');
		});
	});
});
