/**
 * Phase 14 v1 — BE audit emitter unit tests.
 */

import { describe, expect, it, vi } from 'vitest';
import { AiAuditServerEmitter } from '../../src/services/ai-audit-server.service.js';

describe('AiAuditServerEmitter', () => {
	it('persists the row via AiAuditService.write with source + triggeredBy', async () => {
		const createItem = vi.fn(async (_container: string, doc: unknown) => ({
			success: true,
			data: doc,
		}));
		const cosmos = { createItem } as unknown as Parameters<typeof Function>[0];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const emitter = new AiAuditServerEmitter(cosmos as any);

		await emitter.emit({
			tenantId: 't1',
			userId: 'u1',
			name: 'evaluateVendorMatching',
			kind: 'tool',
			sideEffect: 'read',
			scopes: ['order:read', 'vendor:read'],
			success: true,
			source: 'autopilot',
			timestamp: '2026-05-10T20:00:00.000Z',
			triggeredBy: {
				kind: 'cron',
				recipeId: 'stuck-order-triage',
				sponsorUserId: 'u1',
			},
		});

		expect(createItem).toHaveBeenCalledTimes(1);
		const doc = createItem.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(doc.tenantId).toBe('t1');
		expect(doc.userId).toBe('u1');
		expect(doc.name).toBe('evaluateVendorMatching');
		expect(doc.source).toBe('autopilot');
		expect(doc.triggeredBy).toMatchObject({
			kind: 'cron',
			recipeId: 'stuck-order-triage',
			sponsorUserId: 'u1',
		});
	});

	it('swallows persistence errors (does not throw)', async () => {
		const cosmos = {
			createItem: vi.fn(async () => ({
				success: false,
				error: { code: 'COSMOS_DOWN', message: 'boom', timestamp: new Date() },
			})),
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const emitter = new AiAuditServerEmitter(cosmos as any);

		await expect(
			emitter.emit({
				tenantId: 't1',
				userId: 'u1',
				name: 'navigate',
				kind: 'tool',
				sideEffect: 'read',
				scopes: [],
				success: true,
				source: 'be-service',
				timestamp: '2026-05-10T20:00:00.000Z',
			}),
		).resolves.toBeUndefined();
	});

	it('swallows unexpected exceptions (does not throw)', async () => {
		const cosmos = {
			createItem: vi.fn(async () => {
				throw new Error('unexpected');
			}),
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const emitter = new AiAuditServerEmitter(cosmos as any);

		await expect(
			emitter.emit({
				tenantId: 't1',
				userId: 'u1',
				name: 'navigate',
				kind: 'tool',
				sideEffect: 'read',
				scopes: [],
				success: true,
				source: 'be-dispatcher',
				timestamp: '2026-05-10T20:00:00.000Z',
			}),
		).resolves.toBeUndefined();
	});
});
