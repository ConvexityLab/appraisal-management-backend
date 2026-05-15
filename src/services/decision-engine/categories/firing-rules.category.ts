/**
 * FiringRulesCategory — third live Decision Engine category.
 *
 * Phase G of docs/DECISION_ENGINE_RULES_SURFACE.md. Operators author per-tenant
 * rules that put a vendor on probation or fire them based on performance
 * metrics (decline rate, completion rate, scorecard trend, etc.).
 *
 * MVP scope (Phase G shipped):
 *   - Storage works (persists via the generic `decision-rule-packs` container
 *     with `category='firing-rules'`).
 *   - validateRules uses the shared Prio validator.
 *   - preview: in-process JSONLogic evaluator over a synthetic vendor metric
 *     bundle the operator supplies in the workspace's preview pane.
 *   - analytics: aggregates over `firing-decisions` (written by the daily
 *     FiringRulesEvaluatorJob).
 *   - replay: re-runs proposed rules against each historical decision's
 *     `metricsSnapshot` — faithful because firing decisions store the
 *     facts that drove them.
 *   - push / drop / getSeed are absent: firing rules are evaluated
 *     in-process (no upstream service to push to).
 */

import { Logger } from '../../../utils/logger.js';
import type {
	CategoryAnalyticsInput,
	CategoryAnalyticsRule,
	CategoryAnalyticsSummary,
	CategoryDefinition,
	CategoryPreviewInput,
	CategoryPreviewResult,
	CategoryReplayDecision,
	CategoryReplayDiff,
	CategoryReplayInput,
} from '../category-definition.js';
import { validatePrioRulePack } from '../shared/prio-rule-validator.js';
import { evaluateFiringRules } from '../firing/firing-evaluator.service.js';
import { FiringDecisionRecorder } from '../firing/firing-decision-recorder.service.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import type { VendorMatchingRuleDef } from '../../../types/vendor-matching-rule-pack.types.js';

export const FIRING_RULES_CATEGORY_ID = 'firing-rules';

const MAX_REPLAY_WINDOW_DAYS = 90;
const MAX_REPLAYED_DECISIONS = 500;

export function buildFiringRulesCategory(opts: { db?: CosmosDbService } = {}): CategoryDefinition {
	const { db } = opts;
	const logger = new Logger('FiringRulesCategory');
	const recorder = db ? new FiringDecisionRecorder(db) : null;

	const definition: CategoryDefinition = {
		id: FIRING_RULES_CATEGORY_ID,
		label: 'Firing Rules',
		description:
			'Rules that put a vendor on probation or fire them based on performance metrics (decline rate, completion rate, scorecard trend).',
		icon: 'heroicons-outline:shield-exclamation',
		validateRules: validatePrioRulePack,

		// Preview is in-process and doesn't need a db handle — operators can
		// run it on synthetic vendor metric bundles as soon as the category is
		// registered. No upstream service to call.
		preview(input: CategoryPreviewInput): Promise<CategoryPreviewResult[]> {
			const rules = input.rules as VendorMatchingRuleDef[];
			return Promise.resolve(
				input.evaluations.map(ev => {
					// Operators pass in {vendor: {...}} from the preview panel; the
					// vendor sub-object is the metric bundle for firing-rules.
					const bundle = (ev['vendor'] as Record<string, unknown>) ?? ev;
					const result = evaluateFiringRules(rules, bundle);
					return {
						eligible: !result.terminalActionFired,
						scoreAdjustment: 0,
						appliedRuleIds: result.firedRuleIds,
						denyReasons: result.actionsFired
							.filter(a => a.type === 'vendor_fire' || a.type === 'vendor_probation')
							.map(a => `${a.type}: ${(a.data['reason'] as string | undefined) ?? '(no reason)'}`),
						extras: {
							outcome: result.outcome,
							actionsFired: result.actionsFired,
						},
					};
				}),
			);
		},
	};

	if (recorder) {
		definition.replay = async (input: CategoryReplayInput): Promise<CategoryReplayDiff> => {
			if (!input.tenantId) throw new Error('replay: tenantId is required');
			const days = clampDays(input.sinceDays ?? 7);
			const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
			const traces = await recorder.listSince(input.tenantId, sinceIso);
			const sampled = subsample(traces, input.samplePercent ?? 100, MAX_REPLAYED_DECISIONS);

			let changedCount = 0;
			let unchangedCount = 0;
			const perDecision: CategoryReplayDecision[] = [];
			for (const t of sampled) {
				const proposed = evaluateFiringRules(input.rules as VendorMatchingRuleDef[], t.metricsSnapshot);
				const changed = proposed.outcome !== t.outcome;
				if (changed) changedCount++; else unchangedCount++;
				perDecision.push({
					decisionId: t.id,
					subjectId: t.vendorId,
					initiatedAt: t.evaluatedAt,
					changed,
					summary: changed
						? `Outcome changes: ${t.outcome} → ${proposed.outcome}`
						: `No outcome change (${t.outcome})`,
					details: {
						originalOutcome: t.outcome,
						newOutcome: proposed.outcome,
						originalFiredRuleIds: t.firedRuleIds,
						newFiredRuleIds: proposed.firedRuleIds,
						vendorMetricsSnapshot: t.metricsSnapshot,
					},
				});
			}

			logger.info('firing-rules replay complete', {
				tenantId: input.tenantId,
				windowSize: traces.length,
				totalEvaluated: sampled.length,
				changedCount,
				unchangedCount,
			});

			return {
				windowSize: traces.length,
				totalEvaluated: sampled.length,
				changedCount,
				unchangedCount,
				skippedCount: 0,
				newDenialsCount: 0,
				newAcceptancesCount: 0,
				perDecision,
			};
		};

		definition.analytics = async (input: CategoryAnalyticsInput): Promise<CategoryAnalyticsSummary> => {
			if (!input.tenantId) throw new Error('analytics: tenantId is required');
			const days = clampDays(input.days ?? 30);
			const windowDates = buildWindowDates(days);
			const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
			const decisions = await recorder.listSince(input.tenantId, sinceIso);

			let totalEvaluations = 0;
			const outcomeCounts: Record<string, number> = {};
			// rule → daily fire counts (length = days), aligned with windowDates
			const fireByRule = new Map<string, { fireCount: number; daily: number[]; denialCount: number }>();

			for (const d of decisions) {
				totalEvaluations += 1;
				outcomeCounts[d.outcome] = (outcomeCounts[d.outcome] ?? 0) + 1;
				const dayIdx = windowDates.indexOf(d.runDate);
				if (dayIdx < 0) continue;
				const isTerminal = d.outcome === 'fire' || d.outcome === 'probation';
				for (const rid of d.firedRuleIds) {
					const bucket = ensureBucket(fireByRule, rid, days);
					bucket.fireCount += 1;
					bucket.daily[dayIdx]! += 1;
					if (isTerminal) bucket.denialCount += 1;
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

			const escalationCount = (outcomeCounts['fire'] ?? 0) + (outcomeCounts['probation'] ?? 0);

			return {
				category: FIRING_RULES_CATEGORY_ID,
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
	return Math.min(Math.floor(d), MAX_REPLAY_WINDOW_DAYS);
}

function subsample<T>(arr: T[], percent: number, hardCap: number): T[] {
	if (arr.length === 0) return arr;
	const targetByPercent = Math.ceil((arr.length * percent) / 100);
	const target = Math.min(targetByPercent, hardCap);
	if (target >= arr.length) return arr.slice(0, hardCap);
	const stride = arr.length / target;
	const out: T[] = [];
	for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * stride)]!);
	return out;
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

