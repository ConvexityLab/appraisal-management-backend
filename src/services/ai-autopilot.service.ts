/**
 * AiAutopilotService — Phase 14 v2 (2026-05-11).
 *
 * Processes one autopilot-task message: idempotency probe → recipe
 * lookup → sponsor verification → policy evaluation → dispatch (or
 * queue-for-approval) → audit + run row update.
 *
 * Mounted by:
 *   - the Service Bus consumer (`AiAutopilotSweeperJob` for cron;
 *     ServiceBusEventSubscriber for queue/webhook/chain triggers)
 *   - the existing `/api/ai/execute` route when an `autonomy: 'always'`
 *     intent is dispatched via composite chaining
 *
 * Identity model: delegated.  Every run uses the recipe's sponsorUserId
 * as the audit attribution + the dispatch tenant/user context.  We do
 * NOT mint a tenant-system token here; the sponsor's identity is
 * carried through every downstream call.  Sponsor-active checks are
 * the responsibility of the consumer before calling `processTask` —
 * once we're in here, we trust the auth context.
 *
 * Safety:
 *   - Idempotency key short-circuits duplicate SB deliveries.
 *   - Chain depth cap (`MAX_CHAIN_DEPTH`) prevents runaway AI→AI loops.
 *   - Budget enforcement defers to the per-recipe `policy.budget` +
 *     the per-tenant `costBudget` snapshot (read from ai-audit-events
 *     rollup, via Phase 17b token-meter).
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import { AutopilotRecipeRepository } from './autopilot-recipe.repository.js';
import { AutopilotRunRepository } from './autopilot-run.repository.js';
import { AiAuditServerEmitter } from './ai-audit-server.service.js';
import { AiActionDispatcherService } from './ai-action-dispatcher.service.js';
import { AiAutopilotPublisher } from './ai-autopilot-publisher.service.js';
import {
	AutopilotSponsorIdentity,
	type SponsorIdentityResult,
} from './autopilot-sponsor-identity.service.js';
import type {
	AutopilotPolicy,
	AutopilotPolicyMode,
	AutopilotRecipe,
	AutopilotRun,
	AutopilotTriggerKind,
} from '../types/autopilot-recipe.types.js';

const MAX_CHAIN_DEPTH = Number(process.env.AI_AUTOPILOT_MAX_CHAIN_DEPTH ?? 3);

export interface AutopilotTaskMessage {
	tenantId: string;
	recipeId: string;
	idempotencyKey: string;
	triggeredBy: {
		kind: AutopilotTriggerKind;
		sourceId?: string;
		parentRunId?: string;
		/** Depth of the AI-chain that produced this message. */
		chainDepth?: number;
	};
}

export interface AutopilotProcessResult {
	ok: boolean;
	status: AutopilotRun['status'];
	runId?: string;
	reason?: string;
}

export class AiAutopilotService {
	private readonly logger = new Logger('AiAutopilotService');
	private readonly recipes: AutopilotRecipeRepository;
	private readonly runs: AutopilotRunRepository;
	private readonly audit: AiAuditServerEmitter;
	private readonly dispatcher: AiActionDispatcherService;
	private readonly sponsorIdentity: AutopilotSponsorIdentity;
	private readonly publisher: AiAutopilotPublisher;

	constructor(
		cosmos: CosmosDbService,
		sponsorIdentity?: AutopilotSponsorIdentity,
		publisher?: AiAutopilotPublisher,
	) {
		this.recipes = new AutopilotRecipeRepository(cosmos);
		this.runs = new AutopilotRunRepository(cosmos);
		this.audit = new AiAuditServerEmitter(cosmos);
		this.dispatcher = new AiActionDispatcherService(cosmos);
		this.sponsorIdentity = sponsorIdentity ?? new AutopilotSponsorIdentity();
		// Lazily created — `chainTo` follow-ups are the only place
		// processTask needs to publish.  Reuses the singleton publisher
		// pattern from the consumer + sweep job (mock mode in tests).
		this.publisher = publisher ?? new AiAutopilotPublisher();
	}

	/**
	 * Process one autopilot task.  Returns a structured result instead
	 * of throwing so the SB consumer can decide whether to complete /
	 * abandon / dead-letter the message based on the status.
	 */
	async processTask(msg: AutopilotTaskMessage): Promise<AutopilotProcessResult> {
		const validation = this.validateMessage(msg);
		if (!validation.ok) {
			return { ok: false, status: 'failed', reason: validation.reason ?? 'invalid-message' };
		}

		// Chain-depth cap — refuse before doing any work.
		const chainDepth = msg.triggeredBy.chainDepth ?? 0;
		if (chainDepth > MAX_CHAIN_DEPTH) {
			this.logger.warn('Autopilot chain depth exceeded', {
				tenantId: msg.tenantId,
				recipeId: msg.recipeId,
				chainDepth,
				max: MAX_CHAIN_DEPTH,
			});
			return {
				ok: false,
				status: 'cancelled',
				reason: `Chain depth ${chainDepth} > max ${MAX_CHAIN_DEPTH}`,
			};
		}

		// Idempotency probe.  Duplicate SB deliveries terminate here
		// without re-dispatching, returning the existing run id.
		const existing = await this.runs.findByIdempotencyKey(msg.tenantId, msg.idempotencyKey);
		if (existing.success && existing.data) {
			this.logger.info('Idempotent autopilot task — short-circuiting', {
				tenantId: msg.tenantId,
				idempotencyKey: msg.idempotencyKey,
				existingRunId: existing.data.id,
			});
			return {
				ok: true,
				status: existing.data.status,
				runId: existing.data.id,
				reason: 'idempotent-replay',
			};
		}

		// Recipe lookup.
		const recipeResult = await this.recipes.getById(msg.tenantId, msg.recipeId);
		if (!recipeResult.success || !recipeResult.data) {
			return { ok: false, status: 'failed', reason: 'recipe-not-found' };
		}
		const recipe = recipeResult.data;

		// Status gates.
		if (recipe.status !== 'active') {
			return {
				ok: false,
				status: 'cancelled',
				reason: `recipe-status-${recipe.status}`,
			};
		}

		// Delegated identity gate — resolve the sponsoring human at FIRE
		// time so their CURRENT scopes apply.  If the sponsor is gone or
		// deactivated, transition the recipe to 'sponsor-missing' so it
		// stops firing until a tenant admin re-sponsors it.
		const sponsor = await this.sponsorIdentity.resolve(recipe.tenantId, recipe.sponsorUserId);
		if (!sponsor.ok) {
			this.logger.warn('Autopilot sponsor resolution failed', {
				tenantId: recipe.tenantId,
				recipeId: recipe.id,
				sponsorUserId: recipe.sponsorUserId,
				reason: sponsor.reason,
			});
			// Pause the recipe so it doesn't keep firing into the same
			// failure mode every minute.  Operator must re-sponsor or
			// reactivate the user before the recipe runs again.
			await this.recipes.update(recipe.tenantId, recipe.id, {
				status: 'sponsor-missing',
				lastFailureAt: new Date().toISOString(),
				lastFailureReason: sponsor.message,
			});
			return {
				ok: false,
				status: 'cancelled',
				reason: sponsor.reason,
			};
		}

		// Create the Run row up front so failures still leave a trail.
		// chainDepth is persisted on the row so subsequent chain-publish
		// in `dispatch()` knows what depth this run was at without
		// re-reading the triggering message.
		const runResult = await this.runs.create({
			tenantId: msg.tenantId,
			recipeId: recipe.id,
			sponsorUserId: recipe.sponsorUserId,
			triggeredBy: {
				kind: msg.triggeredBy.kind,
				...(msg.triggeredBy.sourceId !== undefined && { sourceId: msg.triggeredBy.sourceId }),
				...(msg.triggeredBy.parentRunId !== undefined && { parentRunId: msg.triggeredBy.parentRunId }),
				idempotencyKey: msg.idempotencyKey,
				chainDepth: msg.triggeredBy.chainDepth ?? 0,
			},
			status: 'running',
		});
		if (!runResult.success || !runResult.data) {
			return { ok: false, status: 'failed', reason: 'run-create-failed' };
		}
		const run = runResult.data;

		// Per-recipe policy → routing decision.
		const decision = this.resolvePolicyOutcome(recipe.policy);

		if (decision === 'never') {
			await this.runs.finalize(msg.tenantId, run.id, 'cancelled', {
				error: { code: 'AUTONOMY_NEVER', message: 'Recipe policy.mode=never refuses autonomous fires.' },
			});
			await this.recipes.recordFire(msg.tenantId, recipe.id, false, 'policy-never');
			await this.emitAudit(run, recipe, false, 'policy-never', {}, sponsor.role);
			return { ok: false, status: 'cancelled', runId: run.id, reason: 'policy-never' };
		}

		if (decision === 'approve' || decision === 'admin') {
			// Park in the approval queue.  The admin UI lands the
			// approve/reject decision back via a separate route.
			await this.runs.update(msg.tenantId, run.id, {
				status: 'awaiting-approval',
				pendingApproval: {
					intent: recipe.request.intent ?? 'PROMPT_DRIVEN',
					actionPayload: recipe.request.actionPayload ?? {},
					proposedAt: new Date().toISOString(),
					approverPolicy: decision,
				},
			});
			await this.emitAudit(run, recipe, true, 'queued-for-approval', {}, sponsor.role);
			return {
				ok: true,
				status: 'awaiting-approval',
				runId: run.id,
				reason: `queued-${decision}`,
			};
		}

		// decision === 'always' → fire it.  Pass the sponsor's role through
		// so dispatch-time audit rows carry the same attribution and the
		// approve-path re-resolution doesn't need to happen on the cron
		// fast-path (re-resolution is the approve endpoint's job).
		return this.dispatch(run, recipe, sponsor.role);
	}

	/**
	 * Final dispatch: invoke the AiActionDispatcherService with the
	 * recipe's intent + payload, using the sponsor's tenant/user
	 * context.  On success/failure update the Run row + emit audit.
	 *
	 * For prompt-driven recipes (no pre-resolved intent), the autopilot
	 * v2 MVP defers to the FE function-calling path: we record the run
	 * as 'awaiting-approval' instead of executing a free-form prompt.
	 * The v3 follow-up calls parse-intent directly here.
	 */
	private async dispatch(
		run: AutopilotRun,
		recipe: AutopilotRecipe,
		sponsorRole?: string,
	): Promise<AutopilotProcessResult> {
		const request = recipe.request;
		if (!request.intent || !request.actionPayload) {
			// Prompt-only recipes get parked for review in v2.
			await this.runs.update(run.tenantId, run.id, {
				status: 'awaiting-approval',
				pendingApproval: {
					intent: 'PROMPT_DRIVEN',
					actionPayload: { prompt: request.prompt ?? '' },
					proposedAt: new Date().toISOString(),
					approverPolicy: 'approve',
				},
			});
			await this.emitAudit(run, recipe, true, 'prompt-deferred', {}, sponsorRole);
			return {
				ok: true,
				status: 'awaiting-approval',
				runId: run.id,
				reason: 'prompt-driven-recipes-need-approval-in-v2',
			};
		}

		const dispatchCtx = { tenantId: run.tenantId, userId: recipe.sponsorUserId };
		try {
			// AiActionDispatcherService has per-intent handlers rather
			// than a generic dispatchIntent.  Map the recipe's intent to
			// the matching handler here; unknown intents fall through
			// to the failure branch with a clear error.
			let result: unknown;
			switch (request.intent) {
				case 'CREATE_ORDER':
					result = await this.dispatcher.handleCreateOrder(request.actionPayload, dispatchCtx);
					break;
				case 'CREATE_ENGAGEMENT':
					result = await this.dispatcher.handleCreateEngagement(request.actionPayload, dispatchCtx);
					break;
				case 'ASSIGN_VENDOR':
					result = await this.dispatcher.handleAssignVendor(request.actionPayload, dispatchCtx);
					break;
				case 'TRIGGER_AUTO_ASSIGNMENT':
					result = await this.dispatcher.handleTriggerAutoAssignment(request.actionPayload, dispatchCtx);
					break;
				default:
					throw new Error(`Unsupported autopilot intent: ${request.intent}`);
			}
			await this.runs.finalize(run.tenantId, run.id, 'succeeded', {
				metrics: { wallSeconds: this.wallSecondsSince(run.startedAt) },
			});
			await this.recipes.recordFire(run.tenantId, recipe.id, true);
			await this.emitAudit(run, recipe, true, undefined, { dispatchResult: result }, sponsorRole);
			// AI-chain emission — only on success.  Failed / cancelled /
			// awaiting-approval runs never spawn children (prevents
			// chains amplifying transient failures).  The depth check
			// in processTask refuses messages at depth > MAX_CHAIN_DEPTH.
			if (recipe.chainTo?.recipeId) {
				await this.publishChainFollowUp(run, recipe);
			}
			return { ok: true, status: 'succeeded', runId: run.id };
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			await this.runs.finalize(run.tenantId, run.id, 'failed', {
				error: { code: 'DISPATCH_FAILED', message: errorMessage },
				metrics: { wallSeconds: this.wallSecondsSince(run.startedAt) },
			});
			await this.recipes.recordFire(run.tenantId, recipe.id, false, errorMessage);
			await this.emitAudit(run, recipe, false, errorMessage, {}, sponsorRole);
			return { ok: false, status: 'failed', runId: run.id, reason: errorMessage };
		}
	}

	/**
	 * Publish the AI-chain follow-up after a successful dispatch.
	 *
	 * Idempotency key: `<chainRecipeId>::ai-chain::<parentRunId>` so a
	 * second delivery of the parent message (which already produced this
	 * follow-up) hits the dedup probe in AutopilotRunRepository.
	 *
	 * Fail-safe: a publish failure is logged but does NOT roll back the
	 * parent run's success state.  The parent's actual work completed;
	 * the chain is best-effort.
	 */
	private async publishChainFollowUp(
		run: AutopilotRun,
		recipe: AutopilotRecipe,
	): Promise<void> {
		if (!recipe.chainTo?.recipeId) return;
		const parentDepth = run.triggeredBy.chainDepth ?? 0;
		const nextDepth = parentDepth + 1;
		// processTask enforces the same cap, but checking here too saves
		// an unnecessary SB round-trip on doomed messages.
		if (nextDepth > MAX_CHAIN_DEPTH) {
			this.logger.warn('Autopilot chain refused — depth cap reached', {
				tenantId: run.tenantId,
				parentRunId: run.id,
				parentDepth,
				maxDepth: MAX_CHAIN_DEPTH,
				chainRecipeId: recipe.chainTo.recipeId,
			});
			return;
		}
		try {
			await this.publisher.publish({
				tenantId: run.tenantId,
				recipeId: recipe.chainTo.recipeId,
				idempotencyKey: `${recipe.chainTo.recipeId}::ai-chain::${run.id}`,
				triggeredBy: {
					kind: 'ai-chain',
					sourceId: recipe.chainTo.reason ?? `parent-run-${run.id}`,
					parentRunId: run.id,
					chainDepth: nextDepth,
				},
			});
			this.logger.info('Autopilot chain follow-up published', {
				tenantId: run.tenantId,
				parentRunId: run.id,
				chainRecipeId: recipe.chainTo.recipeId,
				nextDepth,
			});
		} catch (err) {
			this.logger.warn('Failed to publish autopilot chain follow-up', {
				tenantId: run.tenantId,
				parentRunId: run.id,
				chainRecipeId: recipe.chainTo.recipeId,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	private resolvePolicyOutcome(policy: AutopilotPolicy): AutopilotPolicyMode {
		return policy?.mode ?? 'approve';
	}

	private validateMessage(msg: AutopilotTaskMessage): { ok: boolean; reason?: string } {
		if (!msg?.tenantId) return { ok: false, reason: 'missing-tenantId' };
		if (!msg?.recipeId) return { ok: false, reason: 'missing-recipeId' };
		if (!msg?.idempotencyKey) return { ok: false, reason: 'missing-idempotencyKey' };
		if (!msg?.triggeredBy?.kind) return { ok: false, reason: 'missing-trigger-kind' };
		return { ok: true };
	}

	private wallSecondsSince(iso: string): number {
		const t0 = Date.parse(iso);
		if (Number.isNaN(t0)) return 0;
		return Math.round((Date.now() - t0) / 1000);
	}

	private async emitAudit(
		run: AutopilotRun,
		recipe: AutopilotRecipe,
		success: boolean,
		errorMessage?: string,
		_extras: Record<string, unknown> = {},
		sponsorRole?: string,
	): Promise<void> {
		// Map the AutopilotTriggerKind union ('queue-message', 'cron', …)
		// onto the audit row's narrower triggeredBy.kind ('queue', 'cron',
		// 'webhook', 'user-rule', 'ai-chain') so the /ai-audit inspector
		// can filter consistently regardless of internal naming drift.
		const auditTriggerKind: 'cron' | 'webhook' | 'user-rule' | 'ai-chain' | 'queue' =
			run.triggeredBy.kind === 'queue-message' ? 'queue' : run.triggeredBy.kind;
		await this.audit.emit({
			tenantId: run.tenantId,
			userId: recipe.sponsorUserId,
			timestamp: new Date().toISOString(),
			kind: 'intent',
			name: recipe.request.intent ?? 'autopilot-run',
			scopes: [],
			sideEffect: recipe.request.intent ? 'write' : 'read',
			description: `Autopilot recipe "${recipe.name}" — run ${run.id}`,
			success,
			...(errorMessage !== undefined && { errorMessage }),
			source: 'autopilot',
			triggeredBy: {
				kind: auditTriggerKind,
				recipeId: recipe.id,
				sponsorUserId: recipe.sponsorUserId,
				...(sponsorRole !== undefined && { sponsorRole }),
				...(run.triggeredBy.parentRunId !== undefined && {
					parentRunId: run.triggeredBy.parentRunId,
				}),
			},
		});
	}
}
