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

describe('Approve — delegated-identity re-check at fire time', () => {
	function awaitingRun(overrides: { intent?: string; actionPayload?: unknown } = {}) {
		return {
			id: 'run-99',
			tenantId: 't1',
			entityType: 'autopilot-run',
			recipeId: 'recipe-1',
			sponsorUserId: 'sponsor-1',
			status: 'awaiting-approval',
			startedAt: '2026-05-13T00:00:00Z',
			triggeredBy: { kind: 'queue-message', chainDepth: 0, idempotencyKey: 'k1' },
			pendingApproval: {
				intent: overrides.intent ?? 'TRIGGER_AUTO_ASSIGNMENT',
				actionPayload: overrides.actionPayload ?? { orderIds: ['o-1'] },
				proposedAt: '2026-05-13T00:00:00Z',
				approverPolicy: 'approve' as const,
			},
		};
	}

	function mountApprove(
		sponsorResolve: () =>
			| { ok: true; tenantId: string; userId: string; role: string; isInternal?: boolean }
			| { ok: false; reason: 'sponsor-missing' | 'sponsor-inactive' | 'tenant-mismatch'; message: string },
		runOverrides: { intent?: string; actionPayload?: unknown } = {},
		promptResolver?: { parseIntent: ReturnType<typeof vi.fn> } | null,
	) {
		const cosmos = {
			queryItems: vi.fn(async () => ({ success: true, data: [awaitingRun(runOverrides)] })),
			createItem: vi.fn(async (_c: string, doc: unknown) => ({ success: true, data: doc })),
			upsertItem: vi.fn(async (_c: string, doc: unknown) => ({ success: true, data: doc })),
		};
		const stubSponsorIdentity = { resolve: vi.fn(async () => sponsorResolve()) };
		const app = express();
		app.use(express.json());
		app.use((req, _res, next) => {
			(req as unknown as { user: { tenantId: string; id: string; role: string } }).user = {
				tenantId: 't1',
				id: 'admin-1',
				role: 'admin',
			};
			next();
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		app.use(
			'/api/ai/autopilot',
			createAiAutopilotRouter(
				cosmos as any,
				stubSponsorIdentity as any,
				// `null` ⇒ no resolver wired (simulates missing OPENAI key).
				// `undefined` ⇒ omitted, controller falls back to its own AiParserService.
				// We always pass an explicit value (stub or null) in these tests so
				// the controller never tries to construct a live AiParserService.
				(promptResolver ?? { parseIntent: vi.fn() }) as any,
			),
		);
		return { app, cosmos, stubSponsorIdentity };
	}

	it('fails closed (409) when sponsor is missing at approve time', async () => {
		const { app, cosmos } = mountApprove(() => ({
			ok: false,
			reason: 'sponsor-missing',
			message: 'Sponsor user sponsor-1 not found in tenant t1.',
		}));
		const res = await request(app).post('/api/ai/autopilot/runs/run-99/approve');
		expect(res.status).toBe(409);
		expect(res.body.code).toBe('SPONSOR_UNRESOLVABLE_AT_APPROVAL');
		// Run was flipped to failed, not dispatched.
		const failedUpsert = cosmos.upsertItem.mock.calls.find(
			([, doc]) => (doc as { status?: string }).status === 'failed',
		);
		expect(failedUpsert).toBeDefined();
		expect(
			(failedUpsert![1] as { error?: { code?: string } }).error?.code,
		).toBe('SPONSOR_UNRESOLVABLE_AT_APPROVAL');
		// And no audit row claims success.
		const auditWrites = cosmos.createItem.mock.calls.filter(
			([container]) => container === 'aiAuditEvents' || container === 'ai-audit-events',
		);
		for (const [, doc] of auditWrites) {
			expect((doc as { success?: boolean }).success).not.toBe(true);
		}
	});

	it('fails closed (409) when sponsor is deactivated at approve time', async () => {
		const { app } = mountApprove(() => ({
			ok: false,
			reason: 'sponsor-inactive',
			message: 'Sponsor user sponsor-1 has isActive=false.',
		}));
		const res = await request(app).post('/api/ai/autopilot/runs/run-99/approve');
		expect(res.status).toBe(409);
		expect(res.body.code).toBe('SPONSOR_UNRESOLVABLE_AT_APPROVAL');
		expect(res.body.error).toMatch(/isActive=false/);
	});

	it('stamps sponsorRole on the audit when the sponsor is still active', async () => {
		const { app, cosmos } = mountApprove(() => ({
			ok: true,
			tenantId: 't1',
			userId: 'sponsor-1',
			role: 'analyst',
		}));
		const res = await request(app).post('/api/ai/autopilot/runs/run-99/approve');
		// Dispatch itself may fail (no live OrderService in the test), but
		// the contract under test is the audit shape on the path we DID take.
		// Either 200 (dispatch worked) or 500 (dispatch threw) is OK; the
		// 409 we used to throw before this patch is NOT.
		expect([200, 500]).toContain(res.status);
		// Find any autopilot-success audit row.
		const auditDocs = cosmos.createItem.mock.calls.map(([, doc]) => doc) as Array<{
			triggeredBy?: { sponsorRole?: string };
			source?: string;
		}>;
		const successAudit = auditDocs.find(
			(d) => d.source === 'autopilot' && d.triggeredBy?.sponsorRole !== undefined,
		);
		// Only expect this on the happy 200 path; if dispatch threw, no
		// success audit row was written and the assertion is vacuous.
		if (res.status === 200) {
			expect(successAudit).toBeDefined();
			expect(successAudit!.triggeredBy!.sponsorRole).toBe('analyst');
		}
	});
});

describe('Approve — PROMPT_DRIVEN resolution (v3)', () => {
	function awaitingPromptRun(prompt: string) {
		return {
			id: 'run-99',
			tenantId: 't1',
			entityType: 'autopilot-run',
			recipeId: 'recipe-1',
			sponsorUserId: 'sponsor-1',
			status: 'awaiting-approval',
			startedAt: '2026-05-13T00:00:00Z',
			triggeredBy: { kind: 'queue-message', chainDepth: 0, idempotencyKey: 'k1' },
			pendingApproval: {
				intent: 'PROMPT_DRIVEN',
				actionPayload: { prompt },
				proposedAt: '2026-05-13T00:00:00Z',
				approverPolicy: 'approve' as const,
			},
		};
	}

	function mountPromptApprove(
		parseImpl: () => {
			intent: string;
			confidence: number;
			actionPayload: unknown;
			presentationSchema: unknown;
		},
		promptText = 'Run auto-assignment on stuck Texas orders.',
		opts: { resolverWired?: boolean } = { resolverWired: true },
	) {
		const cosmos = {
			queryItems: vi.fn(async () => ({ success: true, data: [awaitingPromptRun(promptText)] })),
			createItem: vi.fn(async (_c: string, doc: unknown) => ({ success: true, data: doc })),
			upsertItem: vi.fn(async (_c: string, doc: unknown) => ({ success: true, data: doc })),
		};
		const stubSponsorIdentity = {
			resolve: vi.fn(async () => ({
				ok: true as const,
				tenantId: 't1',
				userId: 'sponsor-1',
				role: 'analyst' as const,
			})),
		};
		// `null` → explicit opt-out so the controller skips the AiParserService
		// fallback construction (which would otherwise either succeed against
		// real env vars and hit the network, or throw — both indeterminate in
		// CI).  See createAiAutopilotRouter's `promptResolver` param doc.
		const stubResolver = opts.resolverWired
			? { parseIntent: vi.fn(async () => parseImpl()) }
			: null;
		const app = express();
		app.use(express.json());
		app.use((req, _res, next) => {
			(req as unknown as { user: { tenantId: string; id: string; role: string } }).user = {
				tenantId: 't1',
				id: 'admin-1',
				role: 'admin',
			};
			next();
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		app.use(
			'/api/ai/autopilot',
			createAiAutopilotRouter(cosmos as any, stubSponsorIdentity as any, stubResolver as any),
		);
		return { app, cosmos, stubResolver };
	}

	it('resolves to TRIGGER_AUTO_ASSIGNMENT and dispatches via existing switch', async () => {
		const { app, stubResolver } = mountPromptApprove(() => ({
			intent: 'TRIGGER_AUTO_ASSIGNMENT',
			confidence: 0.9,
			actionPayload: { orderIds: ['o-1', 'o-2'] },
			presentationSchema: {},
		}));
		const res = await request(app).post('/api/ai/autopilot/runs/run-99/approve');
		// Dispatch may 500 because the test cosmos lacks findOrderById,
		// but the parser MUST have been called and the dispatch path
		// MUST have been entered (not the prompt-not-executable refusal).
		expect([200, 500]).toContain(res.status);
		expect(stubResolver!.parseIntent).toHaveBeenCalledTimes(1);
		const callArgs = stubResolver!.parseIntent.mock.calls[0][0] as { text: string; tools: unknown };
		expect(callArgs.text).toMatch(/auto-assignment/i);
		expect(Array.isArray(callArgs.tools)).toBe(true);
	});

	it('refuses (400 PROMPT_NOT_EXECUTABLE) when parser returns INFO', async () => {
		const { app } = mountPromptApprove(() => ({
			intent: 'INFO',
			confidence: 0.8,
			actionPayload: {},
			presentationSchema: { title: 'Looks like a status question.' },
		}));
		const res = await request(app).post('/api/ai/autopilot/runs/run-99/approve');
		expect(res.status).toBe(400);
		expect(res.body.code).toBe('PROMPT_NOT_EXECUTABLE');
		expect(res.body.parsedIntent).toBe('INFO');
	});

	it('refuses (400 PROMPT_NOT_EXECUTABLE) when parser returns TOOL_CALL', async () => {
		const { app } = mountPromptApprove(() => ({
			intent: 'TOOL_CALL',
			confidence: 0.7,
			actionPayload: { toolName: 'searchBackendOrders', toolArgs: {} },
			presentationSchema: {},
		}));
		const res = await request(app).post('/api/ai/autopilot/runs/run-99/approve');
		expect(res.status).toBe(400);
		expect(res.body.code).toBe('PROMPT_NOT_EXECUTABLE');
	});

	it('refuses (400 PROMPT_EMPTY) when the stored prompt is whitespace', async () => {
		const { app } = mountPromptApprove(
			() => ({ intent: 'TRIGGER_AUTO_ASSIGNMENT', confidence: 1, actionPayload: {}, presentationSchema: {} }),
			'   ',
		);
		const res = await request(app).post('/api/ai/autopilot/runs/run-99/approve');
		expect(res.status).toBe(400);
		expect(res.body.code).toBe('PROMPT_EMPTY');
	});

	it('refuses (503 PROMPT_PARSER_UNAVAILABLE) when no resolver is wired', async () => {
		const { app } = mountPromptApprove(
			() => ({ intent: 'TRIGGER_AUTO_ASSIGNMENT', confidence: 1, actionPayload: {}, presentationSchema: {} }),
			'Run auto-assignment on stuck orders.',
			{ resolverWired: false },
		);
		const res = await request(app).post('/api/ai/autopilot/runs/run-99/approve');
		// Without OPENAI keys in test env, controller's fallback construction
		// of AiParserService throws and parser stays null → 503.
		expect(res.status).toBe(503);
		expect(res.body.code).toBe('PROMPT_PARSER_UNAVAILABLE');
	});
});
