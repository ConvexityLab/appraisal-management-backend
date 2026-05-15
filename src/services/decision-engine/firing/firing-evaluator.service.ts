/**
 * FiringEvaluator — pure: take a firing-rules pack + a vendor metric bundle,
 * evaluate via the in-process JSONLogic evaluator, return the decision
 * (which rules fired, which actions, the rolled-up outcome).
 *
 * Phase G of docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * No I/O — easy to unit-test and shareable between:
 *   - the daily cron that runs every tenant's pack against current metrics
 *   - the Sandbox replay endpoint that runs proposed rules against a
 *     historical metricsSnapshot
 *   - the workspace's preview pane that runs proposed rules against a
 *     synthetic operator-supplied metric bundle
 */

import { evaluate as evaluateJsonLogic } from '../shared/jsonlogic-evaluator.js';
import type {
	FiringActionFired,
	FiringActionType,
	FiringDecisionDocument,
} from '../../../types/firing-decision.types.js';
import type { VendorMatchingRuleDef } from '../../../types/vendor-matching-rule-pack.types.js';

const KNOWN_FACT_IDS: ReadonlySet<FiringActionType> = new Set([
	'vendor_probation',
	'vendor_fire',
	'notify_supervisor',
]);

const TERMINAL_FACT_IDS: ReadonlySet<FiringActionType> = new Set([
	'vendor_probation',
	'vendor_fire',
]);

export interface FiringEvalResult {
	firedRuleIds: string[];
	actionsFired: FiringActionFired[];
	terminalActionFired: boolean;
	outcome: FiringDecisionDocument['outcome'];
}

/**
 * Run a single vendor's metric bundle through every rule in the pack.
 * Rules are evaluated in salience order (lower runs first); each rule
 * whose `conditions` evaluate truthy contributes its `actions` to the
 * decision. No short-circuit: a fire rule + a notify rule both contribute
 * even if a fire is "stronger" — operators see the full picture in the
 * trace and downstream consumers decide what to honour.
 */
export function evaluateFiringRules(
	rules: VendorMatchingRuleDef[],
	metricsBundle: Record<string, unknown>,
): FiringEvalResult {
	const sorted = [...rules].sort((a, b) => (a.salience ?? 0) - (b.salience ?? 0));

	const firedRuleIds: string[] = [];
	const actionsFired: FiringActionFired[] = [];

	for (const rule of sorted) {
		let matched: boolean;
		try {
			matched = Boolean(evaluateJsonLogic(rule.conditions ?? {}, metricsBundle));
		} catch {
			// Malformed rule conditions — skip silently, operators see this
			// at preview time. We don't want one bad rule to stop the whole
			// pack from firing for an entire vendor pool.
			continue;
		}
		if (!matched) continue;

		firedRuleIds.push(rule.name);
		for (const action of rule.actions ?? []) {
			const factId = action?.fact_id as FiringActionType | undefined;
			const type: FiringActionType = factId && KNOWN_FACT_IDS.has(factId) ? factId : 'unknown';
			actionsFired.push({
				type,
				ruleId: rule.name,
				data: (action?.data as Record<string, unknown> | undefined) ?? {},
			});
		}
	}

	const terminalActionFired = actionsFired.some(a => TERMINAL_FACT_IDS.has(a.type));
	let outcome: FiringDecisionDocument['outcome'] = 'no_action';
	if (actionsFired.some(a => a.type === 'vendor_fire')) outcome = 'fire';
	else if (actionsFired.some(a => a.type === 'vendor_probation')) outcome = 'probation';
	else if (actionsFired.some(a => a.type === 'notify_supervisor')) outcome = 'notify_only';

	return { firedRuleIds, actionsFired, terminalActionFired, outcome };
}
