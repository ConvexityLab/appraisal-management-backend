/**
 * AxiomCriteriaResultsReader — L1 stub.
 *
 * Phase L of docs/DECISION_ENGINE_RULES_SURFACE.md. Stubbed reader so
 * `AxiomCriteriaCategory.analytics` returns a clear "pending" payload
 * instead of 501.
 *
 * See sibling AXIOM_INTEGRATION_SURVEY.md for the query path this would
 * implement (AxiomExecutionRecord tenantId-scoped → result docs in
 * aiInsights). Implementation gated on the Axiom-side
 * "register criteria set" endpoint (L2) so AMS-authored packs have a
 * round-trip to Axiom in the first place.
 */

import { Logger } from '../../../utils/logger.js';
import type { CategoryAnalyticsInput, CategoryAnalyticsSummary } from '../category-definition.js';

const CATEGORY_ID = 'axiom-criteria';

export class AxiomCriteriaResultsReader {
	private readonly logger = new Logger('AxiomCriteriaResultsReader');

	async summary(input: CategoryAnalyticsInput): Promise<CategoryAnalyticsSummary> {
		if (!input.tenantId) throw new Error('analytics: tenantId is required');
		const days = clampDays(input.days ?? 30);
		const windowDates = buildWindowDates(days);

		this.logger.info('axiom-criteria analytics — L1 stub returning pending', {
			tenantId: input.tenantId,
			days,
		});

		return {
			category: CATEGORY_ID,
			windowDays: days,
			windowDates,
			totalDecisions: 0,
			totalEvaluations: 0,
			escalationCount: 0,
			outcomeCounts: {
				__pending: 1,
			},
			perRule: [],
			computedAt: new Date().toISOString(),
		};
	}
}

function clampDays(d: number): number {
	if (!Number.isFinite(d) || d <= 0) return 30;
	return Math.min(Math.floor(d), 90);
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
