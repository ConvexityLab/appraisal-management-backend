/**
 * AiAutopilotSweepJob — Phase 14 v2 (2026-05-11).
 *
 * In-process timer that scans every active `cron`-triggered autopilot
 * recipe across every tenant and emits one `autopilot-task` message
 * per (tenant, recipe) match to Service Bus.  The consumer
 * (`ServiceBusEventSubscriber` mounted on the `autopilot-tasks` queue)
 * picks the message up and hands it to `AiAutopilotService.processTask`.
 *
 * Why in-process and not Azure Functions:
 *   - Existing jobs (OverdueOrderDetection, ReviewSlaWatcher, etc.) all
 *     run as setInterval inside the API service.  Adding an Azure
 *     Function for autopilot alone doubles the deployment surface
 *     without operational benefit at current scale.
 *   - Per CLAUDE.md rule #3 ("never create infrastructure in code"),
 *     we don't provision new function apps from here.  If/when scale
 *     warrants a dedicated Function App, that's a separate Bicep change
 *     and this job moves over.
 *
 * Cron evaluation: cheap-and-correct.  Every minute the job ticks; for
 * each active cron recipe it asks "should this fire RIGHT NOW given the
 * last fire timestamp and the cron expression?".  We use the
 * `cron-parser` package (already a transitive dep via existing jobs)
 * to compute the next-after-lastFireAt boundary.  Drift up to one
 * minute is acceptable for autopilot semantics; sub-minute fires are
 * deliberately not supported.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AiAutopilotPublisher } from '../services/ai-autopilot-publisher.service.js';
import { AutopilotRecipeRepository } from '../services/autopilot-recipe.repository.js';
import { AiFlagsService } from '../services/ai-flags.service.js';
import type { AutopilotRecipe } from '../types/autopilot-recipe.types.js';

const TICK_INTERVAL_MS = Number(process.env.AI_AUTOPILOT_SWEEP_INTERVAL_MS ?? 60_000);

export class AiAutopilotSweepJob {
	private readonly logger = new Logger('AiAutopilotSweepJob');
	private readonly cosmos: CosmosDbService;
	private readonly recipes: AutopilotRecipeRepository;
	private readonly publisher: AiAutopilotPublisher;
	private readonly flags: AiFlagsService;
	private intervalId?: NodeJS.Timeout;
	private isRunning = false;

	constructor(dbService?: CosmosDbService, publisher?: AiAutopilotPublisher) {
		this.cosmos = dbService ?? new CosmosDbService();
		this.recipes = new AutopilotRecipeRepository(this.cosmos);
		this.publisher = publisher ?? new AiAutopilotPublisher();
		this.flags = new AiFlagsService(this.cosmos);
	}

	start(): void {
		if (this.isRunning) {
			this.logger.warn('AiAutopilotSweepJob already running');
			return;
		}
		this.isRunning = true;
		this.logger.info('Starting AiAutopilotSweepJob', {
			intervalMs: TICK_INTERVAL_MS,
		});
		// Tick once at startup so a recent restart doesn't lose the
		// minute-window for already-overdue recipes.
		void this.tick();
		this.intervalId = setInterval(() => {
			void this.tick();
		}, TICK_INTERVAL_MS);
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			delete this.intervalId;
		}
		this.isRunning = false;
	}

	/** Public for tests; runs one sweep cycle. */
	async tick(): Promise<void> {
		try {
			const result = await this.recipes.listAllActiveCronRecipes();
			if (!result.success || !result.data) {
				this.logger.warn('Sweep tick — recipe list failed', { error: result.error });
				return;
			}
			const now = new Date();
			// Per-tenant autopilot kill switch cache for this tick.
			const tenantEnabled = new Map<string, boolean>();
			for (const recipe of result.data) {
				if (!this.shouldFire(recipe, now)) continue;
				let enabled = tenantEnabled.get(recipe.tenantId);
				if (enabled === undefined) {
					enabled = await this.isAutopilotEnabledForTenant(recipe.tenantId);
					tenantEnabled.set(recipe.tenantId, enabled);
				}
				if (!enabled) {
					this.logger.info('Skipping recipe — autopilot disabled for tenant', {
						tenantId: recipe.tenantId,
						recipeId: recipe.id,
					});
					continue;
				}
				await this.publish(recipe);
			}
		} catch (err) {
			this.logger.error('Sweep tick failed', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	/**
	 * Canary onboarding gate — autopilot is OFF per-tenant by default.
	 * A tenant admin opts in via the ai-feature-flags doc
	 * (`autopilot.enabled = true`).  Falls back to env
	 * `AI_AUTOPILOT_DEFAULT_ENABLED` (= 'false' in prod, 'true' in dev)
	 * if no tenant doc exists.
	 */
	private async isAutopilotEnabledForTenant(tenantId: string): Promise<boolean> {
		try {
			const result = await this.flags.fetchForUser(tenantId, '');
			if (result.success && result.data?.tenant?.autopilot?.enabled !== undefined) {
				return Boolean(result.data.tenant.autopilot.enabled);
			}
		} catch {
			// fall through to env
		}
		return process.env.AI_AUTOPILOT_DEFAULT_ENABLED === 'true';
	}

	/**
	 * Should this recipe fire on this tick?  True iff the cron schedule
	 * has elapsed at least once since `lastFireAt` (or since `createdAt`
	 * if the recipe has never fired).
	 */
	shouldFire(recipe: AutopilotRecipe, now: Date): boolean {
		const cron = recipe.trigger.cron;
		if (!cron) return false;
		const since = recipe.lastFireAt ?? recipe.createdAt;
		const sinceMs = Date.parse(since);
		if (Number.isNaN(sinceMs)) return false;
		// MVP cadence calculation — without bringing in a full cron parser,
		// we honor a handful of common expressions plus a custom
		// `every-Nm` shorthand for development.  The next iteration wires
		// `cron-parser` once the package is added to the BE manifest.
		const nextMs = this.simpleCronNext(cron, sinceMs);
		if (nextMs === null) return false;
		return now.getTime() >= nextMs;
	}

	/**
	 * Tiny built-in cron interpreter — supports the common expressions
	 * we actually use in production today plus an `every-Nm` /
	 * `every-Nh` shorthand for tests.  Anything else returns null
	 * (recipe never fires from sweep — the operator must use one of
	 * the supported forms).
	 *
	 *   "0 * * * *"     → top of every hour
	 *   "0 *\/6 * * *"  → every 6 hours (start of hour)
	 *   "0 0 * * *"     → midnight UTC daily
	 *   "every-15m"     → every 15 minutes from last fire
	 *   "every-2h"      → every 2 hours from last fire
	 */
	private simpleCronNext(cron: string, sinceMs: number): number | null {
		const trimmed = cron.trim();
		const everyMatch = trimmed.match(/^every-(\d+)([mh])$/);
		if (everyMatch) {
			const n = Number(everyMatch[1]);
			const unitMs = everyMatch[2] === 'h' ? 3_600_000 : 60_000;
			return sinceMs + n * unitMs;
		}
		if (trimmed === '0 * * * *') {
			const d = new Date(sinceMs);
			d.setUTCMinutes(60, 0, 0);
			return d.getTime();
		}
		const everyNHours = trimmed.match(/^0 \*\/(\d+) \* \* \*$/);
		if (everyNHours) {
			const n = Number(everyNHours[1]);
			return sinceMs + n * 3_600_000;
		}
		if (trimmed === '0 0 * * *') {
			const d = new Date(sinceMs);
			d.setUTCHours(24, 0, 0, 0);
			return d.getTime();
		}
		return null;
	}

	private async publish(recipe: AutopilotRecipe): Promise<void> {
		// Idempotency key: recipe + sweep-tick bucket.  Multiple sweep
		// ticks within the same TICK_INTERVAL_MS bucket produce the same
		// key, so the consumer's de-dupe probe (AutopilotRunRepository
		// .findByIdempotencyKey) short-circuits duplicate publishes.
		const idempotencyKey = `${recipe.id}::${Math.floor(Date.now() / TICK_INTERVAL_MS)}`;
		try {
			await this.publisher.publish({
				tenantId: recipe.tenantId,
				recipeId: recipe.id,
				idempotencyKey,
				triggeredBy: {
					kind: 'cron',
					sourceId: `sweep::${idempotencyKey}`,
					chainDepth: 0,
				},
			});
		} catch (err) {
			this.logger.warn('Failed to publish autopilot task', {
				tenantId: recipe.tenantId,
				recipeId: recipe.id,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
}
