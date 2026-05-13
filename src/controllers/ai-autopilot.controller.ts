/**
 * AI Autopilot Controller — Phase 14 v2 (2026-05-11).
 *
 * Admin surface for the autopilot runtime:
 *
 *   POST   /api/ai/autopilot/recipes           — create recipe
 *   GET    /api/ai/autopilot/recipes           — list recipes for tenant
 *   GET    /api/ai/autopilot/recipes/:id       — single recipe
 *   PATCH  /api/ai/autopilot/recipes/:id       — update recipe
 *   POST   /api/ai/autopilot/recipes/:id/pause — quick pause
 *   POST   /api/ai/autopilot/recipes/:id/resume— quick resume
 *   GET    /api/ai/autopilot/runs/awaiting     — approval queue
 *   GET    /api/ai/autopilot/runs/recent       — recent runs
 *   GET    /api/ai/autopilot/runs/:id          — single run
 *   POST   /api/ai/autopilot/runs/:id/approve  — admin approves + dispatches
 *   POST   /api/ai/autopilot/runs/:id/reject   — admin rejects + closes
 *
 * Auth: all routes require an authenticated tenant.  Approve/reject
 * require the admin role.  Other read routes are tenant-scoped only —
 * sponsoring users see the runs their recipes spawned.
 */

import { Router, Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import { AutopilotRecipeRepository } from '../services/autopilot-recipe.repository.js';
import { AutopilotRunRepository } from '../services/autopilot-run.repository.js';
import { AiAuditServerEmitter } from '../services/ai-audit-server.service.js';
import { AiActionDispatcherService } from '../services/ai-action-dispatcher.service.js';
import { AutopilotSponsorIdentity } from '../services/autopilot-sponsor-identity.service.js';
import { AiParserService } from '../services/ai-parser.service.js';
import {
	AUTOPILOT_PROMPT_TOOLS,
	isAutopilotExecutableIntent,
} from '../services/ai-autopilot-prompt-tools.js';
import type { AutopilotRecipe } from '../types/autopilot-recipe.types.js';

const logger = new Logger('AiAutopilotController');

function isAdmin(role: unknown): boolean {
	const arr = Array.isArray(role) ? role : [role];
	return arr.some((r) => typeof r === 'string' && r.toLowerCase() === 'admin');
}

/**
 * Recipe write-authz — admin can manage any recipe in the tenant; a
 * non-admin can only manage recipes they sponsor themselves.  Returns
 * the typed reason for the audit log + the HTTP status to send.
 *
 * Reads are tenant-scoped only (every signed-in user in the tenant can
 * see every recipe + run row).  Writes are the locked-down surface.
 */
function canManageRecipe(
	user: { id?: string; role?: unknown } | undefined,
	recipe: { sponsorUserId: string },
): { ok: true } | { ok: false; status: 401 | 403; reason: string } {
	if (!user?.id) {
		return { ok: false, status: 401, reason: 'Authenticated user required.' };
	}
	if (isAdmin(user.role)) {
		return { ok: true };
	}
	if (recipe.sponsorUserId === user.id) {
		return { ok: true };
	}
	return {
		ok: false,
		status: 403,
		reason: 'Recipe management requires admin role OR you must be the recipe sponsor.',
	};
}

export interface AutopilotPromptResolver {
	parseIntent: AiParserService['parseIntent'];
}

export function createAiAutopilotRouter(
	cosmos: CosmosDbService,
	sponsorIdentity?: AutopilotSponsorIdentity,
	/**
	 * `undefined` → controller constructs its own AiParserService (production default).
	 * Stub object → use injected resolver (tests with mock).
	 * `null` → explicitly disable PROMPT_DRIVEN approval; returns 503.
	 *          Lets tests assert the no-parser path without env juggling.
	 */
	promptResolver?: AutopilotPromptResolver | null,
): Router {
	const router = Router();
	const recipes = new AutopilotRecipeRepository(cosmos);
	const runs = new AutopilotRunRepository(cosmos);
	const audit = new AiAuditServerEmitter(cosmos);
	const dispatcher = new AiActionDispatcherService(cosmos);
	// Delegated-identity re-check at approve time: if the sponsor was
	// deactivated or removed between proposal and approval, fail closed
	// instead of dispatching with stale authority.  Optional ctor param
	// keeps tests + alternate wiring overrideable.
	const sponsors = sponsorIdentity ?? new AutopilotSponsorIdentity();
	// Phase 14 v3 (2026-05-13): when a PROMPT_DRIVEN run lands in the
	// approval queue, the approve handler resolves the prompt to a
	// concrete executable intent via the parser.  Optional dep so tests
	// can inject a stub without spinning up Azure OpenAI.  Constructor
	// catches the "no OPENAI key" case and leaves resolver null — the
	// approve handler then returns a typed 503 instead of crashing.
	let parser: AutopilotPromptResolver | null;
	if (promptResolver === null) {
		// Explicit opt-out — leave parser disabled.
		parser = null;
	} else if (promptResolver !== undefined) {
		parser = promptResolver;
	} else {
		try {
			parser = new AiParserService(cosmos);
		} catch (err) {
			parser = null;
			logger.warn('AiParserService unavailable — PROMPT_DRIVEN approvals will return 503', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	// ── Recipes ──────────────────────────────────────────────────────────

	router.post('/recipes', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId || !user?.id) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant + user required.' });
		}
		const body = req.body as Partial<AutopilotRecipe>;
		if (!body?.name || !body?.policy || !body?.trigger || !body?.request) {
			return res.status(400).json({
				success: false,
				error: 'Recipe requires name, policy, trigger, and request fields.',
			});
		}
		// Sponsorship authz — a non-admin caller can only sponsor THEMSELVES.
		// Admins can sponsor any user in the tenant (for tenant-scoped
		// recipes that aren't tied to a specific human's workflow).  This
		// closes the gap where any signed-in user could create a recipe
		// naming someone else as sponsor — that recipe would then run
		// with the named sponsor's scopes (delegated identity flow), an
		// obvious privilege-escalation vector.
		const requestedSponsorUserId = body.sponsorUserId ?? user.id;
		if (requestedSponsorUserId !== user.id && !isAdmin(user.role)) {
			logger.warn('Refused autopilot recipe creation with non-self sponsor', {
				tenantId: user.tenantId,
				callerUserId: user.id,
				requestedSponsorUserId,
			});
			return res.status(403).json({
				success: false,
				error: 'Only admins may create autopilot recipes sponsored by another user.  Non-admin callers must omit sponsorUserId or set it to their own id.',
			});
		}
		const result = await recipes.create({
			tenantId: user.tenantId,
			sponsorUserId: requestedSponsorUserId,
			createdBy: user.id,
			name: body.name,
			description: body.description ?? '',
			policy: body.policy,
			trigger: body.trigger,
			request: body.request,
		});
		if (!result.success) {
			return res.status(500).json({ success: false, error: result.error });
		}
		return res.status(201).json({ success: true, data: result.data });
	});

	router.get('/recipes', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant required.' });
		}
		const result = await recipes.listForTenant(user.tenantId);
		if (!result.success) {
			return res.status(500).json({ success: false, error: result.error });
		}
		return res.json({ success: true, data: result.data ?? [] });
	});

	router.get('/recipes/:id', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant required.' });
		}
		const recipeId = req.params.id;
		if (!recipeId) {
			return res.status(400).json({ success: false, error: 'Missing recipe id.' });
		}
		const result = await recipes.getById(user.tenantId, recipeId);
		if (!result.success) return res.status(500).json({ success: false, error: result.error });
		if (!result.data) return res.status(404).json({ success: false, error: 'Recipe not found.' });
		return res.json({ success: true, data: result.data });
	});

	router.patch('/recipes/:id', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant required.' });
		}
		const recipeId = req.params.id;
		if (!recipeId) {
			return res.status(400).json({ success: false, error: 'Missing recipe id.' });
		}
		// Load before patch so we can authz against the existing sponsor.
		const existing = await recipes.getById(user.tenantId, recipeId);
		if (!existing.success) return res.status(500).json({ success: false, error: existing.error });
		if (!existing.data) return res.status(404).json({ success: false, error: 'Recipe not found.' });
		const authz = canManageRecipe(user, existing.data);
		if (!authz.ok) return res.status(authz.status).json({ success: false, error: authz.reason });
		const patch = req.body as Partial<AutopilotRecipe>;
		// Even on PATCH, a non-admin can't transfer sponsorship to someone
		// else — that would let a sponsor hand their recipe to a more-
		// privileged user.
		if (patch.sponsorUserId && patch.sponsorUserId !== existing.data.sponsorUserId && !isAdmin(user.role)) {
			return res.status(403).json({
				success: false,
				error: 'Only admins may transfer recipe sponsorship to a different user.',
			});
		}
		const result = await recipes.update(user.tenantId, recipeId, patch);
		if (!result.success) return res.status(500).json({ success: false, error: result.error });
		return res.json({ success: true, data: result.data });
	});

	router.post('/recipes/:id/pause', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant required.' });
		}
		const recipeId = req.params.id;
		if (!recipeId) {
			return res.status(400).json({ success: false, error: 'Missing recipe id.' });
		}
		const existing = await recipes.getById(user.tenantId, recipeId);
		if (!existing.success) return res.status(500).json({ success: false, error: existing.error });
		if (!existing.data) return res.status(404).json({ success: false, error: 'Recipe not found.' });
		const authz = canManageRecipe(user, existing.data);
		if (!authz.ok) return res.status(authz.status).json({ success: false, error: authz.reason });
		const result = await recipes.update(user.tenantId, recipeId, { status: 'paused' });
		if (!result.success) return res.status(500).json({ success: false, error: result.error });
		return res.json({ success: true, data: result.data });
	});

	router.post('/recipes/:id/resume', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant required.' });
		}
		const recipeId = req.params.id;
		if (!recipeId) {
			return res.status(400).json({ success: false, error: 'Missing recipe id.' });
		}
		const existing = await recipes.getById(user.tenantId, recipeId);
		if (!existing.success) return res.status(500).json({ success: false, error: existing.error });
		if (!existing.data) return res.status(404).json({ success: false, error: 'Recipe not found.' });
		const authz = canManageRecipe(user, existing.data);
		if (!authz.ok) return res.status(authz.status).json({ success: false, error: authz.reason });
		const result = await recipes.update(user.tenantId, recipeId, { status: 'active' });
		if (!result.success) return res.status(500).json({ success: false, error: result.error });
		return res.json({ success: true, data: result.data });
	});

	// ── Runs (approval queue) ────────────────────────────────────────────

	router.get('/runs/awaiting', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant required.' });
		}
		const limit = Number(req.query.limit ?? 100);
		const result = await runs.listAwaitingApproval(user.tenantId, limit);
		if (!result.success) return res.status(500).json({ success: false, error: result.error });
		return res.json({ success: true, data: result.data ?? [] });
	});

	router.get('/runs/recent', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant required.' });
		}
		const limit = Number(req.query.limit ?? 50);
		const result = await runs.listRecent(user.tenantId, limit);
		if (!result.success) return res.status(500).json({ success: false, error: result.error });
		return res.json({ success: true, data: result.data ?? [] });
	});

	router.get('/runs/:id', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant required.' });
		}
		const runId = req.params.id;
		if (!runId) {
			return res.status(400).json({ success: false, error: 'Missing run id.' });
		}
		const result = await runs.getById(user.tenantId, runId);
		if (!result.success) return res.status(500).json({ success: false, error: result.error });
		if (!result.data) return res.status(404).json({ success: false, error: 'Run not found.' });
		return res.json({ success: true, data: result.data });
	});

	router.post('/runs/:id/approve', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId || !user?.id) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant + user required.' });
		}
		if (!isAdmin(user.role)) {
			return res.status(403).json({ success: false, error: 'Admin role required to approve autopilot runs.' });
		}
		const runId = req.params.id;
		if (!runId) {
			return res.status(400).json({ success: false, error: 'Missing run id.' });
		}
		const runResult = await runs.getById(user.tenantId, runId);
		if (!runResult.success || !runResult.data) {
			return res.status(404).json({ success: false, error: 'Run not found.' });
		}
		const run = runResult.data;
		if (run.status !== 'awaiting-approval' || !run.pendingApproval) {
			return res.status(409).json({
				success: false,
				error: `Run is not awaiting approval (current status: ${run.status}).`,
			});
		}

		// Delegated-identity re-check: between the moment this run was
		// parked as awaiting-approval and the admin's click here, the
		// sponsor may have been offboarded or deactivated.  Re-resolving
		// at approve time fails closed (run flips to 'failed' with the
		// typed reason) instead of dispatching with stale authority.
		const sponsorAtApprove = await sponsors.resolve(run.tenantId, run.sponsorUserId);
		if (!sponsorAtApprove.ok) {
			await runs.update(user.tenantId, runId, {
				status: 'failed',
				completedAt: new Date().toISOString(),
				error: {
					code: 'SPONSOR_UNRESOLVABLE_AT_APPROVAL',
					message: sponsorAtApprove.message,
				},
			});
			const auditTriggerKind: 'cron' | 'webhook' | 'user-rule' | 'ai-chain' | 'queue' =
				run.triggeredBy.kind === 'queue-message' ? 'queue' : run.triggeredBy.kind;
			await audit.emit({
				tenantId: run.tenantId,
				userId: run.sponsorUserId,
				kind: 'intent',
				name: run.pendingApproval.intent,
				scopes: [],
				sideEffect: 'read',
				description: `Autopilot run ${runId} approval refused: ${sponsorAtApprove.message}`,
				success: false,
				errorMessage: sponsorAtApprove.reason,
				source: 'autopilot',
				timestamp: new Date().toISOString(),
				triggeredBy: {
					kind: auditTriggerKind,
					recipeId: run.recipeId,
					sponsorUserId: run.sponsorUserId,
				},
			});
			return res.status(409).json({
				success: false,
				error: sponsorAtApprove.message,
				code: 'SPONSOR_UNRESOLVABLE_AT_APPROVAL',
			});
		}

		let intent: string = run.pendingApproval.intent;
		let payload: unknown = run.pendingApproval.actionPayload;
		let parsedFromPrompt = false;

		// Phase 14 v3 (2026-05-13): resolve PROMPT_DRIVEN runs through the
		// parser at approve time, then fall through to the existing
		// dispatch switch as if the recipe had carried a concrete intent.
		if (intent === 'PROMPT_DRIVEN') {
			if (!parser) {
				return res.status(503).json({
					success: false,
					error: 'PROMPT_DRIVEN approvals require AI parser (OPENAI key) which is not configured on this instance.',
					code: 'PROMPT_PARSER_UNAVAILABLE',
				});
			}
			const promptText = typeof (payload as { prompt?: unknown })?.prompt === 'string'
				? ((payload as { prompt: string }).prompt)
				: '';
			if (!promptText.trim()) {
				return res.status(400).json({
					success: false,
					error: 'PROMPT_DRIVEN run has no prompt text to resolve.',
					code: 'PROMPT_EMPTY',
				});
			}
			try {
				const parseResult = await parser.parseIntent(
					{
						text: promptText,
						tools: AUTOPILOT_PROMPT_TOOLS,
						context: { currentPage: 'autopilot-approval' },
					},
					{ tenantId: run.tenantId, userId: run.sponsorUserId },
				);
				if (!isAutopilotExecutableIntent(parseResult.intent)) {
					logger.warn('PROMPT_DRIVEN approval refused — parser returned non-executable intent', {
						runId, parsedIntent: parseResult.intent, confidence: parseResult.confidence,
					});
					await runs.update(user.tenantId, runId, {
						status: 'failed',
						completedAt: new Date().toISOString(),
						error: {
							code: 'PROMPT_NOT_EXECUTABLE',
							message: `Parser resolved to non-executable intent '${parseResult.intent}'. Autopilot can only dispatch CREATE_ORDER, CREATE_ENGAGEMENT, ASSIGN_VENDOR, or TRIGGER_AUTO_ASSIGNMENT from a prompt.`,
						},
					});
					return res.status(400).json({
						success: false,
						error: `Parser returned '${parseResult.intent}' — autopilot can't dispatch that from a prompt. Edit the recipe to use one of the 4 executable intents, or recreate it with a deterministic action payload.`,
						code: 'PROMPT_NOT_EXECUTABLE',
						parsedIntent: parseResult.intent,
					});
				}
				intent = parseResult.intent;
				payload = parseResult.actionPayload;
				parsedFromPrompt = true;
				logger.info('PROMPT_DRIVEN approval resolved to executable intent', {
					runId, resolvedIntent: intent, confidence: parseResult.confidence,
				});
			} catch (parseErr) {
				const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
				logger.warn('PROMPT_DRIVEN approval — parser call failed', { runId, error: msg });
				await runs.update(user.tenantId, runId, {
					status: 'failed',
					completedAt: new Date().toISOString(),
					error: { code: 'PROMPT_PARSE_FAILED', message: msg },
				});
				return res.status(500).json({
					success: false,
					error: `Failed to resolve prompt to an executable intent: ${msg}`,
					code: 'PROMPT_PARSE_FAILED',
				});
			}
		}

		try {
			// Re-use the dispatcher with the SPONSOR's identity, not the
			// approving admin's — preserves audit attribution.
			const ctx = { tenantId: run.tenantId, userId: run.sponsorUserId };
			let result: unknown;
			switch (intent) {
				case 'CREATE_ORDER':
					result = await dispatcher.handleCreateOrder(payload, ctx);
					break;
				case 'CREATE_ENGAGEMENT':
					result = await dispatcher.handleCreateEngagement(payload, ctx);
					break;
				case 'ASSIGN_VENDOR':
					result = await dispatcher.handleAssignVendor(payload, ctx);
					break;
				case 'TRIGGER_AUTO_ASSIGNMENT':
					result = await dispatcher.handleTriggerAutoAssignment(payload, ctx);
					break;
				default:
					return res.status(400).json({
						success: false,
						error: `Unsupported intent for autopilot approval: ${intent}`,
					});
			}
			await runs.update(user.tenantId, runId, {
				status: 'succeeded',
				completedAt: new Date().toISOString(),
				pendingApproval: {
					...run.pendingApproval,
					approvedByUserId: user.id,
					approvedAt: new Date().toISOString(),
				},
			});
			const auditTriggerKind: 'cron' | 'webhook' | 'user-rule' | 'ai-chain' | 'queue' =
				run.triggeredBy.kind === 'queue-message' ? 'queue' : run.triggeredBy.kind;
			await audit.emit({
				tenantId: run.tenantId,
				userId: run.sponsorUserId,
				kind: 'intent',
				name: intent,
				scopes: [],
				sideEffect: 'write',
				description: parsedFromPrompt
					? `Autopilot run ${runId} approved by ${user.id} — prompt resolved to ${intent}, dispatched.`
					: `Autopilot run ${runId} approved by ${user.id} and dispatched.`,
				success: true,
				source: 'autopilot',
				timestamp: new Date().toISOString(),
				triggeredBy: {
					kind: auditTriggerKind,
					recipeId: run.recipeId,
					sponsorUserId: run.sponsorUserId,
					sponsorRole: sponsorAtApprove.role,
				},
			});
			return res.json({ success: true, data: { runId, result } });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.warn('Autopilot approval dispatch failed', { runId, error: msg });
			await runs.update(user.tenantId, runId, {
				status: 'failed',
				completedAt: new Date().toISOString(),
				error: { code: 'APPROVE_DISPATCH_FAILED', message: msg },
			});
			return res.status(500).json({ success: false, error: msg });
		}
	});

	router.post('/runs/:id/reject', async (req: UnifiedAuthRequest, res: Response) => {
		const user = req.user;
		if (!user?.tenantId || !user?.id) {
			return res.status(401).json({ success: false, error: 'Authenticated tenant + user required.' });
		}
		if (!isAdmin(user.role)) {
			return res.status(403).json({ success: false, error: 'Admin role required to reject autopilot runs.' });
		}
		const runId = req.params.id;
		if (!runId) {
			return res.status(400).json({ success: false, error: 'Missing run id.' });
		}
		const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'rejected-by-admin';
		const runResult = await runs.getById(user.tenantId, runId);
		if (!runResult.success || !runResult.data) {
			return res.status(404).json({ success: false, error: 'Run not found.' });
		}
		const run = runResult.data;
		if (run.status !== 'awaiting-approval') {
			return res.status(409).json({
				success: false,
				error: `Run is not awaiting approval (current status: ${run.status}).`,
			});
		}
		await runs.update(user.tenantId, runId, {
			status: 'cancelled',
			completedAt: new Date().toISOString(),
			pendingApproval: {
				...run.pendingApproval!,
				rejectedByUserId: user.id,
				rejectedAt: new Date().toISOString(),
				rejectionReason: reason,
			},
		});
		const auditTriggerKind: 'cron' | 'webhook' | 'user-rule' | 'ai-chain' | 'queue' =
			run.triggeredBy.kind === 'queue-message' ? 'queue' : run.triggeredBy.kind;
		await audit.emit({
			tenantId: run.tenantId,
			userId: run.sponsorUserId,
			timestamp: new Date().toISOString(),
			kind: 'intent',
			name: run.pendingApproval?.intent ?? 'autopilot-run',
			scopes: [],
			sideEffect: 'read',
			description: `Autopilot run ${runId} rejected by ${user.id}: ${reason}`,
			success: false,
			source: 'autopilot',
			errorMessage: reason,
			triggeredBy: {
				kind: auditTriggerKind,
				recipeId: run.recipeId,
				sponsorUserId: run.sponsorUserId,
			},
		});
		return res.json({ success: true, data: { runId, status: 'cancelled' } });
	});

	return router;
}
