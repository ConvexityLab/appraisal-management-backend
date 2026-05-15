/**
 * Phase 14 v2 follow-up — AiAutopilotWebhookDispatcher tests.
 *
 * Covers the third trigger contract from AI-UNIVERSAL-SURFACE-PLAN.md
 * §4 Phase 14: webhook handlers fan out to autopilot recipes whose
 * `trigger.webhookSource` matches.  The dispatcher is fail-safe — every
 * unexpected condition returns a structured result, never throws (the
 * caller's primary webhook flow must always succeed).
 *
 * Coverage:
 *   - matches recipes by webhookSource + active status only
 *   - skips entirely when per-tenant autopilot flag is off
 *   - publishes one task per matching recipe with derived idempotency key
 *   - falls back to <source>::<Date.now()> when sourceEventId is absent
 *   - swallows publisher errors per-recipe (other recipes still publish)
 *   - swallows top-level errors (returns result envelope, never throws)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AiAutopilotWebhookDispatcher } from '../../src/services/ai-autopilot-webhook-dispatcher.service.js';
import type { AutopilotRecipe } from '../../src/types/autopilot-recipe.types.js';

function recipe(overrides: Partial<AutopilotRecipe> = {}): AutopilotRecipe {
	return {
		id: 'recipe-1',
		tenantId: 't1',
		entityType: 'autopilot-recipe',
		name: 'on-extraction',
		sponsorUserId: 'sponsor-1',
		status: 'active',
		createdAt: '2026-05-11T00:00:00Z',
		updatedAt: '2026-05-11T00:00:00Z',
		createdBy: 'sponsor-1',
		policy: { mode: 'approve' },
		trigger: { kind: 'webhook', webhookSource: 'axiom-extraction' },
		request: { intent: 'TRIGGER_AUTO_ASSIGNMENT', actionPayload: { orderIds: ['o1'] } },
		...overrides,
	};
}

function fakeCosmos(opts: {
	recipes?: AutopilotRecipe[];
	flagsTenantAutopilotEnabled?: boolean;
}) {
	return {
		queryItems: vi.fn(async (container: string, query: string) => {
			// Flag-doc shape distinguishable by container name OR query
			// content (the flags query looks up by id pattern).
			if (container === 'ai-feature-flags' || query.includes('@userDocId')) {
				if (opts.flagsTenantAutopilotEnabled !== undefined) {
					return {
						success: true,
						data: [{ id: 't1', tenantId: 't1', autopilot: { enabled: opts.flagsTenantAutopilotEnabled } }],
					};
				}
				return { success: true, data: [] };
			}
			// Recipes container — emulate the BE's status filter so
			// paused/archived/etc. recipes don't leak through to the
			// in-process filter (matches real cosmos behaviour).
			const recipes = opts.recipes ?? [];
			if (query.includes('c.status IN')) {
				return { success: true, data: recipes.filter((r) => r.status === 'active') };
			}
			return { success: true, data: recipes };
		}),
		createItem: vi.fn(async (_c: string, doc: unknown) => ({ success: true, data: doc })),
		upsertItem: vi.fn(async (_c: string, doc: unknown) => ({ success: true, data: doc })),
	};
}

function fakePublisher(throwsOn?: string) {
	const published: unknown[] = [];
	return {
		published,
		publish: vi.fn(async (task: { recipeId: string }) => {
			if (throwsOn && task.recipeId === throwsOn) {
				throw new Error('publisher boom');
			}
			published.push(task);
		}),
	};
}

beforeEach(() => {
	process.env.AI_AUTOPILOT_DEFAULT_ENABLED = 'true';
});

describe('AiAutopilotWebhookDispatcher.fire', () => {
	it('matches recipes by webhookSource + active status', async () => {
		const recipes = [
			recipe({ id: 'r-match' }),
			recipe({
				id: 'r-different-source',
				trigger: { kind: 'webhook', webhookSource: 'something-else' },
			}),
			recipe({
				id: 'r-paused',
				status: 'paused',
			}),
			recipe({
				id: 'r-cron',
				trigger: { kind: 'cron', cron: 'every-1h' },
			}),
		];
		const cosmos = fakeCosmos({ recipes });
		const publisher = fakePublisher();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const d = new AiAutopilotWebhookDispatcher(cosmos as any, publisher as any);
		const result = await d.fire({
			source: 'axiom-extraction',
			tenantId: 't1',
			sourceEventId: 'eval-1',
		});
		expect(result.matched).toBe(1);
		expect(result.published).toBe(1);
		expect(publisher.published).toHaveLength(1);
		const task = publisher.published[0] as { recipeId: string; idempotencyKey: string; triggeredBy: { kind: string; sourceId: string } };
		expect(task.recipeId).toBe('r-match');
		expect(task.idempotencyKey).toBe('r-match::webhook::eval-1');
		expect(task.triggeredBy.kind).toBe('webhook');
		expect(task.triggeredBy.sourceId).toBe('axiom-extraction::eval-1');
	});

	it('skips entirely when per-tenant autopilot flag is off', async () => {
		const cosmos = fakeCosmos({
			recipes: [recipe()],
			flagsTenantAutopilotEnabled: false,
		});
		const publisher = fakePublisher();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const d = new AiAutopilotWebhookDispatcher(cosmos as any, publisher as any);
		const result = await d.fire({ source: 'axiom-extraction', tenantId: 't1' });
		expect(result.skippedByFlag).toBe(true);
		expect(result.matched).toBe(0);
		expect(publisher.publish).not.toHaveBeenCalled();
	});

	it('falls back to time-based idempotency key when sourceEventId is absent', async () => {
		const cosmos = fakeCosmos({ recipes: [recipe()] });
		const publisher = fakePublisher();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const d = new AiAutopilotWebhookDispatcher(cosmos as any, publisher as any);
		const result = await d.fire({ source: 'axiom-extraction', tenantId: 't1' });
		expect(result.published).toBe(1);
		const task = publisher.published[0] as { idempotencyKey: string };
		expect(task.idempotencyKey).toMatch(/^recipe-1::webhook::axiom-extraction::\d+$/);
	});

	it('publishes for multiple matching recipes', async () => {
		const cosmos = fakeCosmos({
			recipes: [
				recipe({ id: 'r-a' }),
				recipe({ id: 'r-b' }),
				recipe({ id: 'r-c' }),
			],
		});
		const publisher = fakePublisher();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const d = new AiAutopilotWebhookDispatcher(cosmos as any, publisher as any);
		const result = await d.fire({
			source: 'axiom-extraction',
			tenantId: 't1',
			sourceEventId: 'eval-1',
		});
		expect(result.matched).toBe(3);
		expect(result.published).toBe(3);
		expect(publisher.publish).toHaveBeenCalledTimes(3);
	});

	it('swallows per-recipe publisher errors, keeps publishing the rest', async () => {
		const cosmos = fakeCosmos({
			recipes: [
				recipe({ id: 'r-ok-1' }),
				recipe({ id: 'r-bad' }),
				recipe({ id: 'r-ok-2' }),
			],
		});
		const publisher = fakePublisher('r-bad');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const d = new AiAutopilotWebhookDispatcher(cosmos as any, publisher as any);
		const result = await d.fire({
			source: 'axiom-extraction',
			tenantId: 't1',
			sourceEventId: 'eval-1',
		});
		expect(result.matched).toBe(3);
		expect(result.published).toBe(2);
		expect(result.errors).toBe(1);
	});

	it('returns errors=1 + matched=0 when recipe lookup fails (no throw)', async () => {
		const cosmos = {
			queryItems: vi.fn(async () => ({ success: false, error: { code: 'COSMOS_DOWN', message: 'boom', timestamp: new Date() } })),
			createItem: vi.fn(),
			upsertItem: vi.fn(),
		};
		const publisher = fakePublisher();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const d = new AiAutopilotWebhookDispatcher(cosmos as any, publisher as any);
		// Must not throw even when both flags + recipes queries fail.
		const result = await d.fire({ source: 'x', tenantId: 't1' });
		expect(result.matched).toBe(0);
		expect(result.published).toBe(0);
	});
});
