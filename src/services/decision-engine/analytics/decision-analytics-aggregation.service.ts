/**
 * DecisionAnalyticsAggregationService — Phase E.preagg of
 * `docs/DECISION_ENGINE_RULES_SURFACE.md`.
 *
 * Read/write surface for pre-aggregated analytics snapshots in the
 * `decision-rule-analytics` Cosmos container. The nightly aggregation
 * job (`DecisionAnalyticsAggregationJob`) writes one row per
 * (tenantId, category, days) tuple per day; the Decision Engine
 * controller reads through this service before falling back to on-the-fly
 * computation.
 *
 * Doc shape:
 *   {
 *     id: "${tenantId}__${category}__${days}d__${YYYY-MM-DD}",
 *     type: 'decision-analytics-snapshot',
 *     tenantId, category, days,
 *     computedAt: ISO ts (overall summary timestamp),
 *     computedDate: 'YYYY-MM-DD',
 *     summary: CategoryAnalyticsSummary,
 *   }
 *
 * Freshness model:
 *   - `readLatestSnapshot` returns the most recent snapshot for the tuple
 *     iff its `computedAt` is within `maxAgeMs` of "now". Older rows are
 *     treated as missing — the controller falls back to live compute.
 *   - Container TTL is 30 days; older snapshots auto-purge.
 */

import { Logger } from '../../../utils/logger.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import type { CategoryAnalyticsSummary } from '../category-definition.js';

const ANALYTICS_CONTAINER = 'decision-rule-analytics';
const DOC_TYPE = 'decision-analytics-snapshot';

export interface AnalyticsSnapshotDoc {
	id: string;
	type: typeof DOC_TYPE;
	tenantId: string;
	category: string;
	days: number;
	computedAt: string;
	computedDate: string;
	summary: CategoryAnalyticsSummary;
}

export class DecisionAnalyticsAggregationService {
	private readonly logger = new Logger('DecisionAnalyticsAggregationService');

	constructor(private readonly db: CosmosDbService) {}

	/**
	 * Upsert a pre-aggregated snapshot for the given tuple. The id is
	 * deterministic on (tenantId, category, days, today) so repeated runs
	 * on the same UTC day idempotently overwrite each other rather than
	 * accumulating rows.
	 */
	async writeSnapshot(
		tenantId: string,
		category: string,
		days: number,
		summary: CategoryAnalyticsSummary,
	): Promise<void> {
		const computedDate = new Date().toISOString().slice(0, 10);
		const doc: AnalyticsSnapshotDoc = {
			id: composeSnapshotId(tenantId, category, days, computedDate),
			type: DOC_TYPE,
			tenantId,
			category,
			days,
			computedAt: summary.computedAt,
			computedDate,
			summary,
		};
		await this.db.upsertDocument(ANALYTICS_CONTAINER, doc);
		this.logger.info('analytics snapshot persisted', {
			tenantId, category, days, computedDate,
			totalDecisions: summary.totalDecisions,
			ruleCount: summary.perRule.length,
		});
	}

	/**
	 * Read the most recent fresh snapshot for the (tenant, category, days)
	 * tuple. Returns `null` when no row exists OR the most recent row is
	 * older than `maxAgeMs` (defaults to 26h — generous over the nightly
	 * cadence so a delayed cron tick still beats live compute).
	 */
	async readLatestSnapshot(
		tenantId: string,
		category: string,
		days: number,
		maxAgeMs: number = 26 * 60 * 60 * 1000,
	): Promise<CategoryAnalyticsSummary | null> {
		const docs = await this.db.queryDocuments<AnalyticsSnapshotDoc>(
			ANALYTICS_CONTAINER,
			`SELECT TOP 1 * FROM c
			 WHERE c.tenantId = @tenantId
			   AND c.category = @category
			   AND c.days = @days
			 ORDER BY c.computedAt DESC`,
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@category', value: category },
				{ name: '@days', value: days },
			],
		);
		const row = docs[0];
		if (!row) return null;
		const ageMs = Date.now() - new Date(row.computedAt).getTime();
		if (ageMs > maxAgeMs) {
			this.logger.info('analytics snapshot stale — falling back to live compute', {
				tenantId, category, days, ageMs, maxAgeMs,
			});
			return null;
		}
		return row.summary;
	}
}

export function composeSnapshotId(
	tenantId: string,
	category: string,
	days: number,
	computedDate: string,
): string {
	return `${tenantId}__${category}__${days}d__${computedDate}`;
}
