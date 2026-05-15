/**
 * VendorMatchingAnalyticsService — per-rule analytics for the
 * Decision Engine workspace's Analytics tab + the cross-category landing
 * page.
 *
 * Phase E of docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * MVP design: compute on-the-fly from `assignment-traces` rather than
 * standing up a pre-aggregated `decision-rule-analytics` Cosmos container.
 * Trade-off: slower for very large windows / very high decision volumes,
 * but no extra storage to keep in sync, no aggregation cron to operate,
 * and the numbers match traces exactly (no aggregation lag). When per-call
 * latency starts to bite, this service is a swap-in replacement for the
 * future analytics container reader.
 *
 * Counts are derived from `rankedVendors[].explanation.appliedRuleIds`
 * (the explanation surface produced by the rules engine on every
 * evaluation). Denial contributions come from `deniedVendors[].appliedRuleIds`
 * when present; otherwise the trace's `deniedVendors[i].reason` field
 * is the only signal and we conservatively skip per-rule attribution.
 */

import type { CosmosDbService } from '../../cosmos-db.service.js';
import { Logger } from '../../../utils/logger.js';
import type {
	CategoryAnalyticsInput,
	CategoryAnalyticsRule,
	CategoryAnalyticsSummary,
} from '../category-definition.js';
import type { AssignmentTraceDocument } from '../../../types/assignment-trace.types.js';

const TRACES_CONTAINER = 'assignment-traces';
const VENDOR_MATCHING_CATEGORY_ID = 'vendor-matching';

const MAX_WINDOW_DAYS = 90;
/** Hard cap on traces inspected per call so very chatty tenants don't break the endpoint. */
const MAX_TRACES_PER_CALL = 10_000;

interface RankedVendorWithExplanation {
	vendorId: string;
	score?: number;
	explanation?: {
		appliedRuleIds?: string[];
		scoreAdjustment?: number;
	};
}

interface DeniedVendorWithExplanation {
	vendorId: string;
	reason?: string;
	appliedRuleIds?: string[];
}

export class VendorMatchingAnalyticsService {
	private readonly logger = new Logger('VendorMatchingAnalyticsService');

	constructor(private readonly db: CosmosDbService) {}

	async summary(input: CategoryAnalyticsInput): Promise<CategoryAnalyticsSummary> {
		if (!input.tenantId) throw new Error('analytics: tenantId is required');
		const days = clampDays(input.days ?? 30);
		const windowStartMs = Date.now() - days * 24 * 60 * 60 * 1000;
		const sinceIso = new Date(windowStartMs).toISOString();
		const windowDates = buildWindowDates(days);

		const traces = await this.fetchTraces(input.tenantId, sinceIso);

		// ── Aggregate ────────────────────────────────────────────────────────
		let totalEvaluations = 0;
		const outcomeCounts: Record<string, number> = {};
		// rule → daily fire counts (length = days), aligned with windowDates
		const fireByRule = new Map<string, { fireCount: number; daily: number[]; denialCount: number; scoreAdjSum: number }>();

		for (const trace of traces) {
			const traceDayIdx = dayIndex(trace.initiatedAt, windowDates);
			if (traceDayIdx < 0) continue; // outside window guard (defence in depth)

			const ranked = (trace.rankedVendors ?? []) as RankedVendorWithExplanation[];
			const denied = (trace.deniedVendors ?? []) as DeniedVendorWithExplanation[];
			totalEvaluations += ranked.length + denied.length;

			outcomeCounts[trace.outcome] = (outcomeCounts[trace.outcome] ?? 0) + 1;

			for (const r of ranked) {
				const ruleIds = r.explanation?.appliedRuleIds ?? [];
				const scoreAdj = r.explanation?.scoreAdjustment ?? 0;
				for (const ruleId of ruleIds) {
					const bucket = ensureBucket(fireByRule, ruleId, days);
					bucket.fireCount += 1;
					bucket.daily[traceDayIdx]! += 1;
					bucket.scoreAdjSum += scoreAdj;
				}
			}

			for (const d of denied) {
				const ruleIds = d.appliedRuleIds ?? [];
				for (const ruleId of ruleIds) {
					const bucket = ensureBucket(fireByRule, ruleId, days);
					bucket.fireCount += 1;
					bucket.daily[traceDayIdx]! += 1;
					bucket.denialCount += 1;
				}
			}
		}

		const perRule: CategoryAnalyticsRule[] = Array.from(fireByRule.entries())
			.map(([ruleId, b]) => ({
				ruleId,
				fireCount: b.fireCount,
				fireRatePercent:
					totalEvaluations > 0 ? round1((b.fireCount / totalEvaluations) * 100) : 0,
				denialContributionCount: b.denialCount,
				scoreAdjustmentSum: b.scoreAdjSum,
				daily: b.daily,
			}))
			.sort((a, b) => b.fireCount - a.fireCount);

		const escalationCount = (outcomeCounts['escalated'] ?? 0) + (outcomeCounts['exhausted'] ?? 0);

		this.logger.info('vendor-matching analytics summary', {
			tenantId: input.tenantId,
			days,
			totalDecisions: traces.length,
			totalEvaluations,
			ruleCount: perRule.length,
			escalationCount,
		});

		return {
			category: VENDOR_MATCHING_CATEGORY_ID,
			windowDays: days,
			windowDates,
			totalDecisions: traces.length,
			totalEvaluations,
			escalationCount,
			outcomeCounts,
			perRule,
			computedAt: new Date().toISOString(),
		};
	}

	private async fetchTraces(tenantId: string, sinceIso: string): Promise<AssignmentTraceDocument[]> {
		// Cap row count via SELECT TOP — Cosmos pagination would let us go higher
		// but this MVP path keeps memory bounded and a single round-trip simple.
		return this.db.queryDocuments<AssignmentTraceDocument>(
			TRACES_CONTAINER,
			`SELECT TOP @limit * FROM c
			 WHERE c.type = 'assignment-trace'
			   AND c.tenantId = @tenantId
			   AND c.initiatedAt >= @sinceIso
			 ORDER BY c.initiatedAt DESC`,
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@sinceIso', value: sinceIso },
				{ name: '@limit', value: MAX_TRACES_PER_CALL },
			],
		);
	}
}

// ── Pure helpers (exported for tests) ───────────────────────────────────────

/** UTC-day buckets for the requested window, oldest → newest. */
export function buildWindowDates(days: number): string[] {
	const out: string[] = [];
	const now = new Date();
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setUTCDate(now.getUTCDate() - i);
		out.push(d.toISOString().slice(0, 10));
	}
	return out;
}

/** Index of the trace's UTC day inside windowDates, -1 if outside. */
export function dayIndex(initiatedAt: string, windowDates: string[]): number {
	const day = initiatedAt.slice(0, 10);
	return windowDates.indexOf(day);
}

function ensureBucket(
	map: Map<string, { fireCount: number; daily: number[]; denialCount: number; scoreAdjSum: number }>,
	ruleId: string,
	days: number,
) {
	let b = map.get(ruleId);
	if (!b) {
		b = { fireCount: 0, daily: new Array(days).fill(0), denialCount: 0, scoreAdjSum: 0 };
		map.set(ruleId, b);
	}
	return b;
}

function clampDays(d: number): number {
	if (!Number.isFinite(d) || d <= 0) return 30;
	return Math.min(Math.floor(d), MAX_WINDOW_DAYS);
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}
