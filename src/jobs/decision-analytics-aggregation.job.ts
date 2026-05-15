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

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import type { CategoryRegistry } from '../services/decision-engine/category-definition.js';
import { DecisionAnalyticsAggregationService } from '../services/decision-engine/analytics/decision-analytics-aggregation.service.js';

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 30_000;
/** Windows the job pre-aggregates. Matches the values the FE workspace asks for. */
const AGGREGATION_WINDOWS_DAYS = [7, 30] as const;
/** Lease container — reuses the analytics container with a discriminator
 *  doc type so we don't provision new infrastructure. */
const LEASE_CONTAINER = 'decision-rule-analytics';
const LEASE_DOC_TYPE  = 'aggregation-lease';
/** Lease holders self-renew this often; if the doc isn't touched for this
 *  long, another replica can take over. */
const LEASE_TTL_SECONDS = 60 * 60 * 6; // 6h — survives transient replica restarts

export class DecisionAnalyticsAggregationJob {
	private readonly logger = new Logger('DecisionAnalyticsAggregationJob');
	private readonly aggregator: DecisionAnalyticsAggregationService;
	private intervalId: NodeJS.Timeout | undefined;
	private startupTimeoutId: NodeJS.Timeout | undefined;
	private isRunning = false;
	/** Unique per-process identifier used to claim the daily lease. */
	private readonly replicaId: string = `${process.env['HOSTNAME'] ?? 'local'}__${uuidv4().slice(0, 8)}`;

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
		// .catch wrappers: void-fire-and-forget would leak unhandled rejections
		// if runOnce throws before its own try/finally enters.
		this.startupTimeoutId = setTimeout(() => {
			this.runOnce().catch(err => this.logger.error('aggregation startup tick crashed', {
				error: err instanceof Error ? err.message : String(err),
			}));
		}, STARTUP_DELAY_MS);
		this.intervalId = setInterval(() => {
			this.runOnce().catch(err => this.logger.error('aggregation interval tick crashed', {
				error: err instanceof Error ? err.message : String(err),
			}));
		}, RUN_INTERVAL_MS);
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

		// Per-day Cosmos lease so only one replica writes snapshots per UTC day.
		// `isRunning` only protects against re-entry within a single process;
		// it's useless across the multi-replica Container App. The lease is
		// stored in the analytics container itself (with a discriminator type
		// so it doesn't pollute snapshot queries).
		const lease = await this.tryAcquireLease();
		if (!lease.acquired) {
			this.logger.info('aggregation tick skipped — lease held by another replica', {
				lockedBy: lease.holder, leaseDate: lease.date,
			});
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
	 * Distinct tenantIds across all decision-rule packs AND tenants that have
	 * historical decisions in any of the per-category trace stores.
	 *
	 * Why the union: tenants running purely on the upstream evaluator's seed
	 * pack don't have a `decision-rule-pack` row yet but DO produce traces.
	 * Restricting discovery to active-pack tenants would skip them forever
	 * and `/analytics` would always fall through to live compute — defeating
	 * the point of pre-aggregation. We sweep five containers cross-partition;
	 * this runs once daily and is well within the RU budget.
	 */
	private async discoverTenants(): Promise<string[]> {
		const containers: Array<{ container: string; whereClause: string }> = [
			{ container: 'decision-rule-packs',  whereClause: "c.type = 'decision-rule-pack'" },
			{ container: 'assignment-traces',    whereClause: "c.type = 'assignment-trace'" },
			{ container: 'firing-decisions',     whereClause: "c.type = 'firing-decision'" },
			{ container: 'review-results',       whereClause: 'IS_DEFINED(c.tenantId)' },
			{ container: 'axiom-executions',     whereClause: 'IS_DEFINED(c.tenantId)' },
		];

		const out = new Set<string>();
		for (const { container, whereClause } of containers) {
			try {
				const docs = await this.db.queryDocuments<{ tenantId: string }>(
					container,
					`SELECT DISTINCT VALUE c.tenantId FROM c WHERE ${whereClause}`,
					[],
				);
				for (const t of docs as unknown as string[]) {
					if (typeof t === 'string' && t.length > 0) out.add(t);
				}
			} catch (err) {
				// Container might not exist in some envs (e.g. firing-decisions
				// is provisioned per Phase G). Log + continue so a missing
				// container doesn't black-hole the whole sweep.
				this.logger.warn('discoverTenants: container scan failed', {
					container,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}
		return Array.from(out);
	}

	/**
	 * Per-day Cosmos lease for multi-replica coordination. Each UTC day, the
	 * first replica to `upsertDocument` with `If-None-Match: *` wins; others
	 * back off until the next day. The lease doc lives in the analytics
	 * container with a discriminator type so it doesn't pollute snapshot
	 * queries.
	 *
	 * Failure mode: if the lease check itself errors, we fall through to
	 * "acquired=true" so a Cosmos hiccup doesn't black-hole the cron forever.
	 * Worst case is one extra replica running the same day's work — wasted
	 * RU, but no data corruption (writeSnapshot is idempotent upsert).
	 */
	private async tryAcquireLease(): Promise<{ acquired: boolean; holder?: string; date?: string }> {
		const today = new Date().toISOString().slice(0, 10);
		// One sentinel partition for all leases so we can read the current
		// holder cheaply. The container is `/tenantId`-partitioned, so we
		// reuse `__lease` as the partition value for these docs.
		const leasePartition = '__lease';
		const leaseId = `aggregation-lease__${today}`;
		const nowIso = new Date().toISOString();

		try {
			// Try to read first — if the lease for today exists and is held
			// by SOMEONE ELSE within the TTL, back off. Else claim it.
			const existing = await this.db.queryDocuments<{
				id: string; holder: string; acquiredAt: string;
			}>(
				LEASE_CONTAINER,
				`SELECT TOP 1 * FROM c
				 WHERE c.id = @id
				   AND c.type = @type
				   AND c.tenantId = @partition`,
				[
					{ name: '@id', value: leaseId },
					{ name: '@type', value: LEASE_DOC_TYPE },
					{ name: '@partition', value: leasePartition },
				],
			);
			const row = existing[0];
			if (row) {
				const ageSec = (Date.now() - new Date(row.acquiredAt).getTime()) / 1000;
				if (row.holder !== this.replicaId && ageSec < LEASE_TTL_SECONDS) {
					return { acquired: false, holder: row.holder, date: today };
				}
			}

			// Claim or renew. Upsert is OK — there's a small window between
			// read-and-write where two replicas can both pass the check, but
			// the cost (a duplicate run) is bounded and idempotent.
			await this.db.upsertDocument(LEASE_CONTAINER, {
				id: leaseId,
				type: LEASE_DOC_TYPE,
				tenantId: leasePartition,
				holder: this.replicaId,
				acquiredAt: nowIso,
				ttl: LEASE_TTL_SECONDS,
			});
			return { acquired: true, holder: this.replicaId, date: today };
		} catch (err) {
			this.logger.warn('lease acquisition failed; proceeding without coordination', {
				error: err instanceof Error ? err.message : String(err),
			});
			return { acquired: true, date: today };
		}
	}
}
