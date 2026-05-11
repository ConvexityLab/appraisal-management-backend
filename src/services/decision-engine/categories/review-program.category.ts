/**
 * ReviewProgramCategory — second live Decision Engine category.
 *
 * Phase F (storage + workspace) + Phase F polish (analytics + decision
 * surface) of docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * MVP scope (Phase F shipped):
 *   - Storage works (rules persist via the generic `decision-rule-packs`
 *     container with `category='review-program'`).
 *   - validateRules uses the shared Prio validator.
 *   - analytics: reads existing review program decisions from the platform's
 *     `bulk-portfolio-jobs` + `review-results` containers (no new container)
 *     and aggregates per-flag fire counts + decision-outcome counts. Powered
 *     by ReviewProgramResultsReader; wires only when a Cosmos handle is
 *     supplied.
 *
 * Pending Phase F polish v2:
 *   - replay: re-evaluate proposed rules against historical
 *     ReviewTapeResults' RiskTapeItem fields (needs the variable-name
 *     mapping between the FE catalog and the canonical projection).
 *   - push / preview: route to MOP's `review-program` Prio program once it
 *     ships.
 */

import { Logger } from '../../../utils/logger.js';
import type {
	CategoryAnalyticsInput,
	CategoryAnalyticsRule,
	CategoryAnalyticsSummary,
	CategoryDefinition,
} from '../category-definition.js';
import { validatePrioRulePack } from '../shared/prio-rule-validator.js';
import { ReviewProgramResultsReader } from '../review-program/review-program-results-reader.service.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';

export const REVIEW_PROGRAM_CATEGORY_ID = 'review-program';

const MAX_WINDOW_DAYS = 90;

export function buildReviewProgramCategory(opts: { db?: CosmosDbService } = {}): CategoryDefinition {
	const { db } = opts;
	const logger = new Logger('ReviewProgramCategory');
	const reader = db ? new ReviewProgramResultsReader(db) : null;

	const definition: CategoryDefinition = {
		id: REVIEW_PROGRAM_CATEGORY_ID,
		label: 'Review Programs',
		description:
			'Rules that route a submitted appraisal to a desk / field / full-scope review program based on loan, appraiser, and order context.',
		icon: 'heroicons-outline:clipboard-document-check',
		validateRules: validatePrioRulePack,
	};

	if (reader) {
		definition.analytics = async (input: CategoryAnalyticsInput): Promise<CategoryAnalyticsSummary> => {
			if (!input.tenantId) throw new Error('analytics: tenantId is required');
			const days = clampDays(input.days ?? 30);
			const windowDates = buildWindowDates(days);
			const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

			const decisions = await reader.listSince(input.tenantId, sinceIso);

			let totalEvaluations = 0;
			const outcomeCounts: Record<string, number> = {};
			const fireByRule = new Map<string, { fireCount: number; daily: number[]; denialCount: number }>();

			for (const d of decisions) {
				totalEvaluations += 1;
				const outcome = d.overrideDecision ?? d.computedDecision ?? 'unknown';
				outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;
				const dayBucket = d.evaluatedAt.slice(0, 10);
				const dayIdx = windowDates.indexOf(dayBucket);
				const isReject = outcome === 'Reject';
				for (const flagId of d.firedFlagIds) {
					const bucket = ensureBucket(fireByRule, flagId, days);
					bucket.fireCount += 1;
					if (dayIdx >= 0) bucket.daily[dayIdx]! += 1;
					if (isReject) bucket.denialCount += 1;
				}
			}

			const perRule: CategoryAnalyticsRule[] = Array.from(fireByRule.entries())
				.map(([ruleId, b]) => ({
					ruleId,
					fireCount: b.fireCount,
					fireRatePercent:
						totalEvaluations > 0 ? Math.round((b.fireCount / totalEvaluations) * 1000) / 10 : 0,
					denialContributionCount: b.denialCount,
					scoreAdjustmentSum: 0,
					daily: b.daily,
				}))
				.sort((a, b) => b.fireCount - a.fireCount);

			const escalationCount = outcomeCounts['Reject'] ?? 0;

			logger.info('review-program analytics summary', {
				tenantId: input.tenantId,
				days,
				totalDecisions: decisions.length,
				ruleCount: perRule.length,
				escalationCount,
			});

			return {
				category: REVIEW_PROGRAM_CATEGORY_ID,
				windowDays: days,
				windowDates,
				totalDecisions: decisions.length,
				totalEvaluations,
				escalationCount,
				outcomeCounts,
				perRule,
				computedAt: new Date().toISOString(),
			};
		};
	}

	return definition;
}

// ── Local helpers ───────────────────────────────────────────────────────────

function clampDays(d: number): number {
	if (!Number.isFinite(d) || d <= 0) return 30;
	return Math.min(Math.floor(d), MAX_WINDOW_DAYS);
}

function buildWindowDates(days: number): string[] {
	const out: string[] = [];
	const now = new Date();
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setUTCDate(now.getUTCDate() - i);
		out.push(d.toISOString().slice(0, 10));
	}
	return out;
}

function ensureBucket(
	map: Map<string, { fireCount: number; daily: number[]; denialCount: number }>,
	ruleId: string,
	days: number,
) {
	let b = map.get(ruleId);
	if (!b) {
		b = { fireCount: 0, daily: new Array(days).fill(0), denialCount: 0 };
		map.set(ruleId, b);
	}
	return b;
}

