/**
 * FiringRulesEvaluatorJob — daily cron that runs every tenant's
 * firing-rules pack against current vendor performance metrics and writes
 * the per-vendor outcome to `firing-decisions`.
 *
 * Phase G of docs/DECISION_ENGINE_RULES_SURFACE.md. Runs at startup +
 * every 24h. Designed to be safe on multi-replica deployments: the
 * synthetic id `${tenantId}__${vendorId}__${runDate}` makes same-day
 * re-runs idempotent (409 = no-op).
 *
 * NOT registered automatically yet — api-server.ts wires it. Toggle
 * via `FIRING_RULES_JOB_ENABLED=true` once the tenant population has
 * started authoring firing-rules packs (see env.example). Default off so
 * tenants without rules don't accumulate empty no_action documents.
 */

import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import type { DecisionRulePackService } from '../services/decision-rule-pack.service.js';
import { FiringDecisionRecorder } from '../services/decision-engine/firing/firing-decision-recorder.service.js';
import { evaluateFiringRules } from '../services/decision-engine/firing/firing-evaluator.service.js';
import { FIRING_RULES_CATEGORY_ID } from '../services/decision-engine/categories/firing-rules.category.js';
import type { VendorPerformanceMetrics } from '../types/vendor-marketplace.types.js';
import type {
	FiringDecisionDocument,
} from '../types/firing-decision.types.js';
import type { RulePackDocument } from '../types/decision-rule-pack.types.js';
import type { VendorMatchingRuleDef } from '../types/vendor-matching-rule-pack.types.js';

const PERFORMANCE_CONTAINER = 'vendor-performance-metrics';
const PACK_ID_DEFAULT = 'default';
/** 24h cadence — firing decisions are infrequent; daily is plenty. */
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export class FiringRulesEvaluatorJob {
	private readonly logger = new Logger('FiringRulesEvaluatorJob');
	private intervalId: NodeJS.Timeout | undefined;
	private isRunning = false;
	private readonly recorder: FiringDecisionRecorder;

	constructor(
		private readonly db: CosmosDbService,
		private readonly packs: DecisionRulePackService,
	) {
		this.recorder = new FiringDecisionRecorder(this.db);
	}

	start(): void {
		if (this.intervalId) {
			this.logger.warn('FiringRulesEvaluatorJob already started');
			return;
		}
		// Defer the first tick a few seconds so app startup finishes before
		// the job hits Cosmos. Subsequent ticks run on the 24h cadence.
		setTimeout(() => { void this.runOnce(); }, 5_000);
		this.intervalId = setInterval(() => { void this.runOnce(); }, RUN_INTERVAL_MS);
		this.logger.info('FiringRulesEvaluatorJob started — first tick in 5s, then every 24h');
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}

	/**
	 * Run a single evaluation pass: discover tenants that have firing-rules
	 * packs, run each pack against that tenant's current vendor performance
	 * metrics, record per-vendor decisions. Exposed publicly so an admin
	 * endpoint can force a run on demand.
	 */
	async runOnce(): Promise<{ tenantsProcessed: number; decisionsRecorded: number; errors: number }> {
		if (this.isRunning) {
			this.logger.warn('FiringRulesEvaluatorJob runOnce called while already running — skipping');
			return { tenantsProcessed: 0, decisionsRecorded: 0, errors: 0 };
		}
		this.isRunning = true;
		const startMs = Date.now();
		const runDate = new Date().toISOString().slice(0, 10);
		let tenantsProcessed = 0;
		let decisionsRecorded = 0;
		let errors = 0;

		try {
			const tenantIds = await this.discoverTenantsWithFiringPacks();
			for (const tenantId of tenantIds) {
				try {
					const recorded = await this.runForTenant(tenantId, runDate);
					tenantsProcessed++;
					decisionsRecorded += recorded;
				} catch (err) {
					errors++;
					this.logger.error('FiringRulesEvaluatorJob failed for tenant', {
						tenantId,
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}
			this.logger.info('FiringRulesEvaluatorJob run complete', {
				runDate,
				tenantsProcessed,
				decisionsRecorded,
				errors,
				latencyMs: Date.now() - startMs,
			});
		} finally {
			this.isRunning = false;
		}
		return { tenantsProcessed, decisionsRecorded, errors };
	}

	/**
	 * Find every tenantId that has at least one active firing-rules pack.
	 * Cross-partition query intentionally — runs once daily, low cost.
	 */
	private async discoverTenantsWithFiringPacks(): Promise<string[]> {
		const docs = await this.db.queryDocuments<{ tenantId: string }>(
			'decision-rule-packs',
			`SELECT DISTINCT VALUE c.tenantId FROM c
			 WHERE c.type = 'decision-rule-pack'
			   AND c.category = @category
			   AND c.status = 'active'`,
			[{ name: '@category', value: FIRING_RULES_CATEGORY_ID }],
		);
		// queryDocuments unwraps results so VALUE projection returns plain strings.
		return docs as unknown as string[];
	}

	private async runForTenant(tenantId: string, runDate: string): Promise<number> {
		const pack = await this.packs.getActive<VendorMatchingRuleDef>(
			FIRING_RULES_CATEGORY_ID,
			tenantId,
			PACK_ID_DEFAULT,
		);
		if (!pack) return 0;

		const metrics = await this.fetchTenantMetrics(tenantId);
		if (metrics.length === 0) return 0;

		let recorded = 0;
		for (const m of metrics) {
			const bundle = vendorMetricsBundle(m);
			const result = evaluateFiringRules(pack.rules, bundle);

			// Skip writing rows when nothing fired AND nothing terminal —
			// keeps the firing-decisions table from filling with no-action
			// noise that has no operator value.
			if (result.outcome === 'no_action' && result.firedRuleIds.length === 0) {
				continue;
			}

			const doc = buildFiringDecisionDoc({
				tenantId,
				pack,
				vendorMetrics: m,
				runDate,
				result,
			});
			await this.recorder.record(doc);
			recorded++;
		}
		return recorded;
	}

	private async fetchTenantMetrics(tenantId: string): Promise<VendorPerformanceMetrics[]> {
		// Per the schema: metrics are partitioned by /tenantId and one row per
		// (vendor, calculation moment) — we want the LATEST per vendor.
		// Cheapest query for the firing job: pull recent rows then dedupe in
		// memory keyed on vendorId.
		const rows = await this.db.queryDocuments<VendorPerformanceMetrics>(
			PERFORMANCE_CONTAINER,
			`SELECT * FROM c
			 WHERE c.tenantId = @tenantId
			 ORDER BY c.calculatedAt DESC`,
			[{ name: '@tenantId', value: tenantId }],
		);
		const latestByVendor = new Map<string, VendorPerformanceMetrics>();
		for (const r of rows) {
			if (!r.vendorId) continue;
			if (!latestByVendor.has(r.vendorId)) latestByVendor.set(r.vendorId, r);
		}
		return Array.from(latestByVendor.values());
	}
}

/**
 * Project the VendorPerformanceMetrics shape into the fact bundle the
 * firing-rules JSONLogic evaluator reads (variable names match
 * `categoryDefinitions.ts → FIRING_RULES.variableCatalog`).
 *
 * Exported so preview / replay paths can build the same shape from a
 * stored snapshot (replay) or operator-supplied test data (preview).
 */
export function vendorMetricsBundle(m: VendorPerformanceMetrics): Record<string, unknown> {
	return {
		vendor_id:                  m.vendorId,
		vendor_performance_score:   m.overallScore,
		vendor_completion_rate:     m.completionRate,
		vendor_decline_rate:        m.cancellationRate,
		vendor_revision_rate:       m.revisionRate,
		vendor_orders_last_30_days: m.ordersLast30Days,
		vendor_orders_last_90_days: m.ordersLast90Days,
		vendor_score_delta_30d:     0, // TODO Phase G+: derive from VendorPerformanceHistory rows
	};
}

interface BuildArgs {
	tenantId: string;
	pack: RulePackDocument<VendorMatchingRuleDef>;
	vendorMetrics: VendorPerformanceMetrics;
	runDate: string;
	result: ReturnType<typeof evaluateFiringRules>;
}

function buildFiringDecisionDoc(args: BuildArgs): FiringDecisionDocument {
	return {
		id: FiringDecisionRecorder.composeId(args.tenantId, args.vendorMetrics.vendorId, args.runDate),
		type: 'firing-decision',
		tenantId: args.tenantId,
		packId: args.pack.packId,
		packVersion: args.pack.version,
		vendorId: args.vendorMetrics.vendorId,
		evaluatedAt: new Date().toISOString(),
		runDate: args.runDate,
		metricsSnapshot: vendorMetricsBundle(args.vendorMetrics),
		firedRuleIds: args.result.firedRuleIds,
		actionsFired: args.result.actionsFired,
		terminalActionFired: args.result.terminalActionFired,
		outcome: args.result.outcome,
	};
}
