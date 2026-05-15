/**
 * Phase 14 v2 — AiAutopilotConsumer unit tests.
 *
 * The SDK message dispatch path goes through `handleSdkMessage`, but
 * the integration test surface (real SB receiver) requires the broker.
 * These tests target the operator-facing entry points:
 *
 *   - `processOneTask` — synchronous dispatch + result envelope
 *     (delegates to AiAutopilotService; covered indirectly elsewhere
 *     but locked in here for the swallow-throw contract)
 *   - `coerceTask` — message-body validation that decides between
 *     completing, abandoning, or dead-lettering a malformed message
 *   - start/stop lifecycle in mock mode (no real SB SDK call)
 */

import { describe, expect, it, vi } from 'vitest';
import { AiAutopilotConsumer } from '../../src/services/ai-autopilot-consumer.service.js';

function fakeCosmos() {
	return {
		queryItems: vi.fn(async () => ({ success: true, data: [] })),
		createItem: vi.fn(async (_c: string, d: unknown) => ({ success: true, data: d })),
		upsertItem: vi.fn(async (_c: string, d: unknown) => ({ success: true, data: d })),
	};
}

describe('AiAutopilotConsumer mock-mode lifecycle', () => {
	it('start() in mock mode does not throw and is idempotent', async () => {
		process.env.USE_MOCK_SERVICE_BUS = 'true';
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const consumer = new AiAutopilotConsumer(fakeCosmos() as any);
		await expect(consumer.start()).resolves.toBeUndefined();
		await expect(consumer.start()).resolves.toBeUndefined();
		await expect(consumer.stop()).resolves.toBeUndefined();
	});
});

describe('AiAutopilotConsumer.processOneTask', () => {
	it('returns a typed failure envelope when the service throws', async () => {
		process.env.USE_MOCK_SERVICE_BUS = 'true';
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const consumer = new AiAutopilotConsumer(fakeCosmos() as any);
		// Force the underlying autopilot service to throw by replacing it.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(consumer as any).autopilot = {
			processTask: vi.fn(async () => {
				throw new Error('unexpected SDK failure');
			}),
		};
		const r = await consumer.processOneTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r.ok).toBe(false);
		expect(r.status).toBe('failed');
		expect(r.reason).toContain('unexpected');
	});

	it('forwards a successful processTask result through unchanged', async () => {
		process.env.USE_MOCK_SERVICE_BUS = 'true';
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const consumer = new AiAutopilotConsumer(fakeCosmos() as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(consumer as any).autopilot = {
			processTask: vi.fn(async () => ({
				ok: true,
				status: 'succeeded',
				runId: 'run-7',
			})),
		};
		const r = await consumer.processOneTask({
			tenantId: 't1',
			recipeId: 'recipe-1',
			idempotencyKey: 'idem-1',
			triggeredBy: { kind: 'cron' },
		});
		expect(r).toEqual({ ok: true, status: 'succeeded', runId: 'run-7' });
	});
});

describe('AiAutopilotConsumer.coerceTask (message validation)', () => {
	// Access via prototype because the method is private.  The cast is
	// intentional — this is a unit test of an internal helper.
	function coerce(body: unknown): unknown {
		process.env.USE_MOCK_SERVICE_BUS = 'true';
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const consumer = new AiAutopilotConsumer(fakeCosmos() as any) as any;
		return consumer.coerceTask(body);
	}

	it('returns null for non-object bodies', () => {
		expect(coerce(null)).toBeNull();
		expect(coerce('string-body')).toBeNull();
		expect(coerce(42)).toBeNull();
	});

	it('returns null when tenantId/recipeId/idempotencyKey are missing', () => {
		expect(coerce({})).toBeNull();
		expect(coerce({ tenantId: 't1' })).toBeNull();
		expect(coerce({ tenantId: 't1', recipeId: 'r1' })).toBeNull();
		expect(
			coerce({ tenantId: 't1', recipeId: 'r1', idempotencyKey: 'i1' }),
		).toBeNull(); // missing triggeredBy
	});

	it('coerces a valid envelope through unchanged', () => {
		const body = {
			tenantId: 't1',
			recipeId: 'r1',
			idempotencyKey: 'i1',
			triggeredBy: { kind: 'cron', sourceId: 'sweep' },
		};
		expect(coerce(body)).toEqual({
			tenantId: 't1',
			recipeId: 'r1',
			idempotencyKey: 'i1',
			triggeredBy: { kind: 'cron', sourceId: 'sweep' },
		});
	});

	it('forwards optional fields when present', () => {
		const body = {
			tenantId: 't1',
			recipeId: 'r1',
			idempotencyKey: 'i1',
			triggeredBy: {
				kind: 'ai-chain',
				parentRunId: 'run-99',
				chainDepth: 2,
			},
		};
		expect(coerce(body)).toEqual({
			tenantId: 't1',
			recipeId: 'r1',
			idempotencyKey: 'i1',
			triggeredBy: {
				kind: 'ai-chain',
				parentRunId: 'run-99',
				chainDepth: 2,
			},
		});
	});
});
