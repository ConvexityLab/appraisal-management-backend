/**
 * DecisionAnalyticsAggregationJob — Phase E.preagg of
 * `docs/DECISION_ENGINE_RULES_SURFACE.md`.
 *
 * Daily cron that walks every category in the registry × every tenant that
 * has at least one active decision-rule pack, calls each category's
 * `analytics()` method, and persists the result to the
 * `decision-rule-analytics` container.
 *
 * Wired by api-server.ts; toggled via `DECISION_ANALYTICS_JOB_ENABLED`.
 * Default: enabled in production, disabled in tests.
 *
 * Cadence: every 24h starting 30s after app boot. Safe to run on multiple
 * replicas — `writeSnapshot` is an idempotent upsert keyed on the date.
 *
 * Window sizes covered: each tick aggregates the 7-day and 30-day windows
 * (the two values the Decision Engine FE asks for today). Adding more
 * windows is a one-line list extension.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import type { CategoryRegistry } from '../services/decision-engine/category-definition.js';
import { DecisionAnalyticsAggregationService } from '../services/decision-engine/analytics/decision-analytics-aggregation.service.js';

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 30_000;
/** Windows the job pre-aggregates. Matches the values the FE workspace asks for. */
const AGGREGATION_WINDOWS_DAYS = [7, 30] as const;

export class DecisionAnalyticsAggregationJob {
	private readonly logger = new Logger('DecisionAnalyticsAggregationJob');
	private readonly aggregator: DecisionAnalyticsAggregationService;
	private intervalId: NodeJS.Timeout | undefined;
	private startupTimeoutId: NodeJS.Timeout | undefined;
	private isRunning = false;

	constructor(
		private readonly db: CosmosDbService,
		private readonly registry: CategoryRegistry,
	) {
		this.aggregator = new DecisionAnalyticsAggregationService(db);
	}

	start(): void {
		if (this.intervalId) {
			this.logger.warn('DecisionAnalyticsAggregationJob already started');
			return;
		}
		this.startupTimeoutId = setTimeout(() => { void this.runOnce(); }, STARTUP_DELAY_MS);
		this.intervalId = setInterval(() => { void this.runOnce(); }, RUN_INTERVAL_MS);
		this.logger.info('DecisionAnalyticsAggregationJob started — first tick in 30s, then every 24h');
	}

	stop(): void {
		if (this.startupTimeoutId) {
			clearTimeout(this.startupTimeoutId);
			this.startupTimeoutId = undefined;
		}
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}

	/**
	 * Run one aggregation pass. Returns counts so the admin trigger endpoint
	 * can render a summary.
	 */
	async runOnce(): Promise<{
		tuplesAttempted: number;
		tuplesWritten: number;
		errors: number;
	}> {
		if (this.isRunning) {
			this.logger.warn('DecisionAnalyticsAggregationJob runOnce called while already running — skipping');
			return { tuplesAttempted: 0, tuplesWritten: 0, errors: 0 };
		}
		this.isRunning = true;
		const startMs = Date.now();
		let tuplesAttempted = 0;
		let tuplesWritten = 0;
		let errors = 0;

		try {
			const categories = this.registry.list().filter(c => !!c.analytics);
			const tenantIds = await this.discoverTenants();
			this.logger.info('aggregation pass starting', {
				categories: categories.map(c => c.id),
				tenantCount: tenantIds.length,
				windows: AGGREGATION_WINDOWS_DAYS,
			});

			for (const category of categories) {
				for (const tenantId of tenantIds) {
					for (const days of AGGREGATION_WINDOWS_DAYS) {
						tuplesAttempted++;
						try {
							const summary = await category.analytics!({ tenantId, days });
							await this.aggregator.writeSnapshot(tenantId, category.id, days, summary);
							tuplesWritten++;
						} catch (err) {
							errors++;
							this.logger.warn('aggregation tuple failed', {
								tenantId, category: category.id, days,
								error: err instanceof Error ? err.message : String(err),
							});
						}
					}
				}
			}

			this.logger.info('aggregation pass complete', {
				tuplesAttempted, tuplesWritten, errors,
				latencyMs: Date.now() - startMs,
			});
		} finally {
			this.isRunning = false;
		}

		return { tuplesAttempted, tuplesWritten, errors };
	}

	/**
	 * Distinct tenantIds across all decision-rule packs. One cross-partition
	 * query per pass — runs once daily, low cost.
	 */
	private async discoverTenants(): Promise<string[]> {
		const docs = await this.db.queryDocuments<{ tenantId: string }>(
			'decision-rule-packs',
			`SELECT DISTINCT VALUE c.tenantId FROM c
			 WHERE c.type = 'decision-rule-pack' AND c.status = 'active'`,
			[],
		);
		// queryDocuments unwraps VALUE projections into plain strings.
		return docs as unknown as string[];
	}
}
