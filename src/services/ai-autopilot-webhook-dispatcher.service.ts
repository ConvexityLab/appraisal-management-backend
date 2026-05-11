/**
 * AiAutopilotWebhookDispatcher — Phase 14 v2 follow-up (2026-05-11).
 *
 * Lookup-and-fire helper that the existing webhook handlers call AFTER
 * they finish their primary work.  Implements the third trigger contract
 * from AI-UNIVERSAL-SURFACE-PLAN.md §4 Phase 14:
 *
 *   "Webhook ingress — existing vendor / Axiom callbacks at
 *    `/api/webhooks/*` get an opt-in `triggerAiOn` field.  When the
 *    webhook fires, the handler emits an autopilot-task message.
 *    NOT a new endpoint — augmentation of existing ones."
 *
 * Why a separate service (not inlined into each handler):
 *   - One place to enumerate every recipe matching the webhook source.
 *   - One place to honour the per-tenant `autopilot.enabled` flag.
 *   - One place to swallow failures (a webhook handler must succeed even
 *     if the autopilot fan-out fails — we never lose the primary event).
 *
 * Idempotency keying: `<recipeId>::webhook::<sourceEventId>` so duplicate
 * webhook deliveries (vendor retry, etc.) hit the existing run-row
 * dedup probe in AutopilotRunRepository.findByIdempotencyKey.
 *
 * Webhook payloads are NEVER trusted as prompts.  They become
 * `triggeredBy.sourceId` on the autopilot task; the recipe's pre-resolved
 * `intent + actionPayload` (or curated prompt) is what actually runs.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from './cosmos-db.service.js';
import { AutopilotRecipeRepository } from './autopilot-recipe.repository.js';
import { AiAutopilotPublisher } from './ai-autopilot-publisher.service.js';
import { AiFlagsService } from './ai-flags.service.js';
import type { AutopilotRecipe } from '../types/autopilot-recipe.types.js';

export interface WebhookFireInput {
	/** Which webhook fired — matches `recipe.trigger.webhookSource`. */
	source: string;
	/** Tenant the webhook event belongs to. */
	tenantId: string;
	/**
	 * Unique-per-delivery id from the source webhook (vendor event id,
	 * Axiom delivery id, etc.) used to derive the autopilot idempotency
	 * key.  If absent, falls back to `<source>::<Date.now()>` which will
	 * de-dup duplicate immediate retries but not delayed redeliveries.
	 */
	sourceEventId?: string;
}

export interface WebhookFireResult {
	matched: number;
	published: number;
	skippedByFlag: boolean;
	errors: number;
}

export class AiAutopilotWebhookDispatcher {
	private readonly logger = new Logger('AiAutopilotWebhookDispatcher');
	private readonly recipes: AutopilotRecipeRepository;
	private readonly publisher: AiAutopilotPublisher;
	private readonly flags: AiFlagsService;

	constructor(
		cosmos: CosmosDbService,
		publisher?: AiAutopilotPublisher,
	) {
		this.recipes = new AutopilotRecipeRepository(cosmos);
		this.publisher = publisher ?? new AiAutopilotPublisher();
		this.flags = new AiFlagsService(cosmos);
	}

	/**
	 * Fan out one webhook event to every matching autopilot recipe.
	 * Fail-safe: errors are logged + returned in the `errors` count
	 * but never thrown — the caller's primary webhook flow always
	 * succeeds.
	 */
	async fire(input: WebhookFireInput): Promise<WebhookFireResult> {
		const result: WebhookFireResult = {
			matched: 0,
			published: 0,
			skippedByFlag: false,
			errors: 0,
		};
		try {
			// Per-tenant autopilot kill switch — same as the sweep job.
			const tenantEnabled = await this.isAutopilotEnabledForTenant(input.tenantId);
			if (!tenantEnabled) {
				result.skippedByFlag = true;
				this.logger.info('Webhook trigger skipped — autopilot disabled for tenant', {
					tenantId: input.tenantId,
					source: input.source,
				});
				return result;
			}

			const all = await this.recipes.listForTenant(input.tenantId, ['active']);
			if (!all.success || !all.data) {
				this.logger.warn('Webhook trigger — recipe list failed', {
					tenantId: input.tenantId,
					source: input.source,
					error: all.error,
				});
				return result;
			}
			// Defensive in-code filter — never publish for a paused /
			// archived / sponsor-missing recipe even if the upstream
			// `listForTenant(['active'])` filter is bypassed (mock seam,
			// schema drift, or a stale cosmos read).  Belt-and-suspenders
			// because a webhook fire is an external trigger we don't want
			// firing recipes that the operator paused.
			const matching = all.data.filter((r: AutopilotRecipe) =>
				r.status === 'active' &&
				r.trigger.kind === 'webhook' &&
				r.trigger.webhookSource === input.source,
			);
			result.matched = matching.length;

			const eventId = input.sourceEventId ?? `${input.source}::${Date.now()}`;
			for (const recipe of matching) {
				try {
					await this.publisher.publish({
						tenantId: recipe.tenantId,
						recipeId: recipe.id,
						idempotencyKey: `${recipe.id}::webhook::${eventId}`,
						triggeredBy: {
							kind: 'webhook',
							sourceId: `${input.source}::${eventId}`,
							chainDepth: 0,
						},
					});
					result.published += 1;
				} catch (err) {
					result.errors += 1;
					this.logger.warn('Webhook trigger — publish failed for recipe', {
						tenantId: input.tenantId,
						recipeId: recipe.id,
						source: input.source,
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}
		} catch (err) {
			result.errors += 1;
			this.logger.error('Webhook trigger — unexpected error', {
				source: input.source,
				tenantId: input.tenantId,
				error: err instanceof Error ? err.message : String(err),
			});
		}
		return result;
	}

	private async isAutopilotEnabledForTenant(tenantId: string): Promise<boolean> {
		try {
			// `_system` is a stable non-user placeholder — fetchForUser
			// requires both ids non-empty but the tenant doc lookup
			// (`c.id = @tenantId`) doesn't care what the userId is.
			// Per-user override (`${tenantId}:_system`) won't match
			// anything, which is the desired behaviour.
			const r = await this.flags.fetchForUser(tenantId, '_system');
			if (r.success && r.data?.tenant?.autopilot?.enabled !== undefined) {
				return Boolean(r.data.tenant.autopilot.enabled);
			}
		} catch {
			// fall through to env
		}
		return process.env.AI_AUTOPILOT_DEFAULT_ENABLED === 'true';
	}
}
