/**
 * Phase 14 v2 — ai-autopilot.controller authz tests.
 *
 * Closes the gap surfaced by the deep review: prior to this patch any
 * authenticated user could create a recipe with `sponsorUserId` set to
 * another user, and that recipe would later fire with the named
 * sponsor's scopes (delegated identity).  Obvious privilege-escalation
 * vector.
 *
 * Coverage:
 *   - POST /recipes refuses non-admin creating a recipe sponsored by
 *     another user (403)
 *   - POST /recipes admits an admin creating any sponsor
 *   - POST /recipes admits non-admin sponsoring themselves
 *   - PATCH / pause / resume refuse non-sponsor non-admin (403)
 *   - PATCH / pause / resume admit sponsor on their own recipe
 *   - PATCH / pause / resume admit admin on any recipe
 *   - PATCH refuses sponsorship transfer by non-admin (403)
 *   - Approve / reject still require admin (regression check)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAiAutopilotRouter } from '../../src/controllers/ai-autopilot.controller.js';

type Role = string | string[];

function mountWith(user: { tenantId: string; id: string; role: Role } | undefined, cosmosOverrides: Record<string, unknown> = {}) {
	const cosmos = {
		queryItems: vi.fn(async () => ({ success: true, data: [] })),
		createItem: vi.fn(async (_c: string, doc: unknown) => ({ success: true, data: doc })),
		upsertItem: vi.fn(async (_c: string, doc: unknown) => ({ success: true, data: doc })),
		...cosmosOverrides,
	};
	const app = express();
	app.use(express.json());
	app.use((req, _res, next) => {
		if (user) {
			(req as unknown as { user: typeof user }).user = user;
		}
		next();
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	app.use('/api/ai/autopilot', createAiAutopilotRouter(cosmos as any));
	return { app, cosmos };
}

const VALID_RECIPE_BODY = {
	name: 'live-fire',
	policy: { mode: 'approve' as const },
	trigger: { kind: 'cron' as const, cron: 'every-2h' },
	request: { intent: 'TRIGGER_AUTO_ASSIGNMENT', actionPayload: { orderIds: ['o-1'] } },
};

describe('POST /api/ai/autopilot/recipes — sponsor authz', () => {
	it('admin can sponsor any user', async () => {
		const { app } = mountWith({ tenantId: 't1', id: 'admin-1', role: 'admin' });
		const res = await request(app).post('/api/ai/autopilot/recipes').send({
			...VALID_RECIPE_BODY,
			sponsorUserId: 'someone-else',
		});
		expect(res.status).toBe(201);
		expect(res.body.data.sponsorUserId).toBe('someone-else');
	});

	it('non-admin can sponsor themselves (sponsorUserId === caller id)', async () => {
		const { app } = mountWith({ tenantId: 't1', id: 'analyst-1', role: 'analyst' });
		const res = await request(app).post('/api/ai/autopilot/recipes').send({
			...VALID_RECIPE_BODY,
			sponsorUserId: 'analyst-1',
		});
		expect(res.status).toBe(201);
		expect(res.body.data.sponsorUserId).toBe('analyst-1');
	});

	it('non-admin omitting sponsorUserId defaults to themselves', async () => {
		const { app } = mountWith({ tenantId: 't1', id: 'analyst-1', role: 'analyst' });
		const res = await request(app).post('/api/ai/autopilot/recipes').send(VALID_RECIPE_BODY);
		expect(res.status).toBe(201);
		expect(res.body.data.sponsorUserId).toBe('analyst-1');
	});

	it('refuses non-admin attempting to sponsor someone else (403)', async () => {
		const { app, cosmos } = mountWith({ tenantId: 't1', id: 'analyst-1', role: 'analyst' });
		const res = await request(app).post('/api/ai/autopilot/recipes').send({
			...VALID_RECIPE_BODY,
			sponsorUserId: 'admin-1',
		});
		expect(res.status).toBe(403);
		expect(res.body.error).toMatch(/admin/i);
		// Critical: no recipe got created.
		expect(cosmos.createItem).not.toHaveBeenCalled();
	});

	it('refuses unauthenticated callers (401)', async () => {
		const { app } = mountWith(undefined);
		const res = await request(app).post('/api/ai/autopilot/recipes').send(VALID_RECIPE_BODY);
		expect(res.status).toBe(401);
	});

	it('refuses missing body fields (400)', async () => {
		const { app } = mountWith({ tenantId: 't1', id: 'admin-1', role: 'admin' });
		const res = await request(app).post('/api/ai/autopilot/recipes').send({ name: 'only-name' });
		expect(res.status).toBe(400);
	});
});

describe('PATCH / pause / resume — sponsor authz', () => {
	function recipeRow(sponsorUserId = 'sponsor-1') {
		return {
			id: 'recipe-1',
			tenantId: 't1',
			entityType: 'autopilot-recipe',
			name: 'r',
			sponsorUserId,
			status: 'active',
			createdAt: '2026-05-11T00:00:00Z',
			updatedAt: '2026-05-11T00:00:00Z',
			createdBy: sponsorUserId,
			policy: { mode: 'approve' },
			trigger: { kind: 'cron', cron: 'every-2h' },
			request: VALID_RECIPE_BODY.request,
		};
	}

	function mountFor(user: { tenantId: string; id: string; role: Role }) {
		return mountWith(user, {
			queryItems: vi.fn(async () => ({ success: true, data: [recipeRow('sponsor-1')] })),
		});
	}

	const sponsor = { tenantId: 't1', id: 'sponsor-1', role: 'analyst' };
	const stranger = { tenantId: 't1', id: 'stranger-1', role: 'analyst' };
	const admin = { tenantId: 't1', id: 'admin-1', role: 'admin' };

	it('PATCH: sponsor can update their own recipe', async () => {
		const { app } = mountFor(sponsor);
		const res = await request(app).patch('/api/ai/autopilot/recipes/recipe-1').send({ description: 'edited' });
		expect(res.status).toBe(200);
	});

	it('PATCH: admin can update anyone\'s recipe', async () => {
		const { app } = mountFor(admin);
		const res = await request(app).patch('/api/ai/autopilot/recipes/recipe-1').send({ description: 'edited' });
		expect(res.status).toBe(200);
	});

	it('PATCH: non-sponsor non-admin refused (403)', async () => {
		const { app } = mountFor(stranger);
		const res = await request(app).patch('/api/ai/autopilot/recipes/recipe-1').send({ description: 'edited' });
		expect(res.status).toBe(403);
	});

	it('PATCH: refuses sponsorship transfer by non-admin sponsor (403)', async () => {
		const { app } = mountFor(sponsor);
		const res = await request(app).patch('/api/ai/autopilot/recipes/recipe-1').send({
			sponsorUserId: 'admin-1',
		});
		expect(res.status).toBe(403);
		expect(res.body.error).toMatch(/admin/i);
	});

	it('PATCH: admin can transfer sponsorship', async () => {
		const { app } = mountFor(admin);
		const res = await request(app).patch('/api/ai/autopilot/recipes/recipe-1').send({
			sponsorUserId: 'admin-1',
		});
		expect(res.status).toBe(200);
	});

	it('pause: sponsor can pause their own recipe', async () => {
		const { app } = mountFor(sponsor);
		const res = await request(app).post('/api/ai/autopilot/recipes/recipe-1/pause');
		expect(res.status).toBe(200);
	});

	it('pause: stranger refused (403)', async () => {
		const { app } = mountFor(stranger);
		const res = await request(app).post('/api/ai/autopilot/recipes/recipe-1/pause');
		expect(res.status).toBe(403);
	});

	it('resume: admin can resume any recipe', async () => {
		const { app } = mountFor(admin);
		const res = await request(app).post('/api/ai/autopilot/recipes/recipe-1/resume');
		expect(res.status).toBe(200);
	});
});

describe('Approve / reject — admin gate (regression)', () => {
	it('approve refuses non-admin (403)', async () => {
		const { app } = mountWith({ tenantId: 't1', id: 'analyst-1', role: 'analyst' });
		const res = await request(app).post('/api/ai/autopilot/runs/run-1/approve');
		expect(res.status).toBe(403);
	});

	it('reject refuses non-admin (403)', async () => {
		const { app } = mountWith({ tenantId: 't1', id: 'analyst-1', role: 'analyst' });
		const res = await request(app)
			.post('/api/ai/autopilot/runs/run-1/reject')
			.send({ reason: 'no' });
		expect(res.status).toBe(403);
	});
});
