/**
 * Firing Decision — types
 *
 * Per-vendor firing-rules evaluation record persisted by the daily firing
 * evaluator. Powers the Decision Engine workspace's Sandbox + Analytics tabs
 * for the `firing-rules` category.
 *
 * Phase G of docs/DECISION_ENGINE_RULES_SURFACE.md. Stored in Cosmos
 * container `firing-decisions`, partitioned by `/tenantId`. Synthetic id
 * `${tenantId}__${vendorId}__${runDate}` keeps per-day re-runs idempotent
 * (same vendor on the same day → upsert-or-no-op).
 *
 * Unlike assignment-traces (which capture a snapshot of facts derived
 * from order context), firing-decisions snapshot the vendor's
 * performance metric bundle directly — replay against historical
 * decisions IS faithful because the metrics that drove the decision are
 * stored in `metricsSnapshot`.
 */

export type FiringActionType =
	| 'vendor_probation'
	| 'vendor_fire'
	| 'notify_supervisor'
	/** Used when a rule fires but the operator doesn't recognise its action. */
	| 'unknown';

export interface FiringActionFired {
	type: FiringActionType;
	/** Rule that produced this action — matches CategoryReplayDecision rule ids. */
	ruleId: string;
	/** Action's `data` block as authored by the operator (reason / message / etc.). */
	data: Record<string, unknown>;
}

export interface FiringDecisionDocument {
	id: string;
	type: 'firing-decision';
	tenantId: string;
	/** Pack id evaluated (typically 'default'). */
	packId: string;
	/** Pack version evaluated. Lets analytics group results by pack version. */
	packVersion: number;
	vendorId: string;
	vendorName?: string;
	/** ISO timestamp of when the evaluation ran. */
	evaluatedAt: string;
	/** UTC date bucket (YYYY-MM-DD) the daily run wrote into. */
	runDate: string;

	/**
	 * Snapshot of the vendor metric bundle the rules evaluated against.
	 * Persisted so faithful replay works — when an operator sandbox-replays
	 * proposed rules against this decision, the same facts are used.
	 */
	metricsSnapshot: Record<string, unknown>;

	/** Rule ids that fired during this evaluation, in salience order. */
	firedRuleIds: string[];
	/** Actions that fired (joined view of `firedRuleIds` + their action data). */
	actionsFired: FiringActionFired[];

	/** True iff at least one terminal action (fire / probation) fired. */
	terminalActionFired: boolean;
	/** Outcome roll-up for the analytics summary's outcomeCounts bucket. */
	outcome: 'no_action' | 'notify_only' | 'probation' | 'fire';
}

/** Light projection for live-feed style listings. */
export interface FiringDecisionSummary {
	id: string;
	tenantId: string;
	vendorId: string;
	vendorName?: string;
	evaluatedAt: string;
	runDate: string;
	outcome: FiringDecisionDocument['outcome'];
	actionCount: number;
}
