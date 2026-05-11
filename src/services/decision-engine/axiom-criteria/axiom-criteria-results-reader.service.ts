/**
 * AxiomCriteriaResultsReader — L4 of
 * `appraisal-management-backend/docs/DECISION_ENGINE_RULES_SURFACE.md` /
 * `services/decision-engine/axiom-criteria/AXIOM_INTEGRATION_SURVEY.md`.
 *
 * Real reader implementation that joins AMS's `axiom-executions` (tenant-
 * scoped, partitioned by `/tenantId`) to the cached evaluation result docs
 * in `aiInsights` and projects them into the Decision Engine analytics
 * shape. No new container — every data source already exists.
 *
 * Query path:
 *   1. `axiom-executions` → AxiomExecutionRecord docs with tenantId = T,
 *      createdAt ≥ window-start, status = COMPLETED. These are the
 *      "decision events" — one per Axiom pipeline run.
 *   2. For each execution, `execution.results.criteria[]` is the projected
 *      AxiomEvaluationResult shape that the v2 webhook handler writes
 *      onto the execution doc when the pipeline completes (see
 *      AxiomService.storeEvaluationRecord). Each criterion entry carries
 *      `criterionId + criterionName + evaluation + confidence`.
 *   3. Aggregate per-criterion fire counts, daily histograms, and per-
 *      verdict outcome counts. `fail` and `needs_review` count as
 *      escalations (they require human attention).
 *
 * Why count `evaluation: 'fail' | 'needs_review' | 'cannot_evaluate'` as
 * a fire for analytics purposes:
 *   - 'pass'                — criterion was satisfied; not interesting for ops
 *   - 'fail'                — criterion FAILED; that IS the "rule fired" signal
 *   - 'needs_review'        — criterion couldn't be auto-resolved → escalation
 *   - 'cannot_evaluate'     — missing data; surfaces as data-quality fire
 *   - 'not_applicable'      — out of scope; skip
 * 'pass' verdicts are still counted in totalEvaluations + outcomeCounts;
 * they just don't increment per-criterion fire counts.
 *
 * Boundaries:
 *   - Tenant-scoped: every Cosmos read carries `tenantId =` filter.
 *   - Bounded: days clamped to [1, MAX_WINDOW_DAYS]; execution scan capped at
 *     MAX_EXECUTIONS to keep response time predictable.
 *   - Read-only.
 */

import { Logger } from '../../../utils/logger.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import type {
	CategoryAnalyticsInput,
	CategoryAnalyticsRule,
	CategoryAnalyticsSummary,
} from '../category-definition.js';
import type { AxiomExecutionRecord } from '../../../types/axiom.types.js';

const CATEGORY_ID = 'axiom-criteria';
const EXECUTIONS_CONTAINER = 'axiom-executions';
const MAX_WINDOW_DAYS = 90;
const MAX_EXECUTIONS = 2000;

/**
 * AxiomEvaluationResult shape stored on `execution.results`. Mirrors the
 * relevant fields from `AxiomService.AxiomEvaluationResult` — kept local
 * to avoid pulling the entire axiom.service.ts type graph into Decision
 * Engine readers.
 */
interface ExecutionResultBundle {
	evaluationId?: string;
	status?: string;
	overallRiskScore?: number;
	timestamp?: string;
	criteria?: Array<{
		criterionId: string;
		criterionName?: string;
		evaluation?: string; // pass | fail | needs_review | cannot_evaluate | not_applicable | warning
		confidence?: number;
		reasoning?: string;
	}>;
}

type CriterionFireBucket = {
	fireCount: number;
	daily: number[];
	failContribution: number;
};

export class AxiomCriteriaResultsReader {
	private readonly logger = new Logger('AxiomCriteriaResultsReader');

	constructor(private readonly db: CosmosDbService | null = null) {}

	async summary(input: CategoryAnalyticsInput): Promise<CategoryAnalyticsSummary> {
		if (!input.tenantId) throw new Error('analytics: tenantId is required');
		const days = clampDays(input.days ?? 30);
		const windowDates = buildWindowDates(days);

		// L1 fallback — no db handle wired. Keeps the FE non-501 in environments
		// where the Decision Engine controller is initialised without a Cosmos
		// service (eg. unit fixtures). Returns the explicit "pending" marker so
		// the FE renders the inline integration-pending panel.
		if (!this.db) {
			this.logger.info('axiom-criteria analytics: no db handle, returning L1 pending stub', {
				tenantId: input.tenantId,
				days,
			});
			return pendingStub(days, windowDates);
		}

		const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

		const executions = await this.db.queryDocuments<AxiomExecutionRecord & { results?: ExecutionResultBundle }>(
			EXECUTIONS_CONTAINER,
			`SELECT TOP @limit c.id, c.tenantId, c.orderId, c.axiomJobId, c.status,
			        c.createdAt, c.completedAt, c.results
			 FROM c
			 WHERE c.tenantId = @tenantId
			   AND c.createdAt >= @sinceIso
			 ORDER BY c.createdAt DESC`,
			[
				{ name: '@tenantId', value: input.tenantId },
				{ name: '@sinceIso', value: sinceIso },
				{ name: '@limit', value: MAX_EXECUTIONS },
			],
		);

		const completed = executions.filter(e => e.status === 'COMPLETED' && e.results?.criteria);
		const totalDecisions = completed.length;

		const outcomeCounts: Record<string, number> = {};
		const fireByCriterion = new Map<string, CriterionFireBucket>();
		let totalEvaluations = 0;
		let escalationCount = 0;

		for (const exec of completed) {
			const evalDate = (exec.completedAt ?? exec.createdAt ?? '').slice(0, 10);
			const dayIdx = windowDates.indexOf(evalDate);

			const criteria = exec.results?.criteria ?? [];
			let escalated = false;

			for (const c of criteria) {
				if (!c.criterionId) continue;
				totalEvaluations += 1;
				const verdict = (c.evaluation ?? 'unknown').toLowerCase();
				outcomeCounts[verdict] = (outcomeCounts[verdict] ?? 0) + 1;

				const fires = verdict === 'fail'
					|| verdict === 'needs_review'
					|| verdict === 'cannot_evaluate'
					|| verdict === 'warning';
				if (!fires) continue;

				const bucket = ensureBucket(fireByCriterion, c.criterionId, days);
				bucket.fireCount += 1;
				if (dayIdx >= 0) bucket.daily[dayIdx]! += 1;
				if (verdict === 'fail') bucket.failContribution += 1;

				if (verdict === 'fail' || verdict === 'needs_review') escalated = true;
			}

			if (escalated) escalationCount += 1;
		}

		const perRule: CategoryAnalyticsRule[] = Array.from(fireByCriterion.entries())
			.map(([ruleId, b]) => ({
				ruleId,
				fireCount: b.fireCount,
				fireRatePercent:
					totalEvaluations > 0 ? Math.round((b.fireCount / totalEvaluations) * 1000) / 10 : 0,
				denialContributionCount: b.failContribution,
				scoreAdjustmentSum: 0,
				daily: b.daily,
			}))
			.sort((a, b) => b.fireCount - a.fireCount);

		this.logger.info('axiom-criteria analytics summary', {
			tenantId: input.tenantId,
			days,
			executionsScanned: executions.length,
			completedDecisions: totalDecisions,
			totalEvaluations,
			ruleCount: perRule.length,
			escalationCount,
		});

		return {
			category: CATEGORY_ID,
			windowDays: days,
			windowDates,
			totalDecisions,
			totalEvaluations,
			escalationCount,
			outcomeCounts,
			perRule,
			computedAt: new Date().toISOString(),
		};
	}
}

// ── helpers ─────────────────────────────────────────────────────────────────

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
	map: Map<string, CriterionFireBucket>,
	id: string,
	days: number,
): CriterionFireBucket {
	let b = map.get(id);
	if (!b) {
		b = { fireCount: 0, daily: new Array(days).fill(0), failContribution: 0 };
		map.set(id, b);
	}
	return b;
}

function pendingStub(days: number, windowDates: string[]): CategoryAnalyticsSummary {
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
