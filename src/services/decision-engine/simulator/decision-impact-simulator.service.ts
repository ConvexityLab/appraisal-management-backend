/**
 * DecisionImpactSimulatorService — projects the effect of publishing a
 * proposed rule pack against IN-FLIGHT decisions (outcome = pending_bid).
 *
 * Scope-expansion item promised in rev 15 of
 * `docs/DECISION_ENGINE_RULES_SURFACE.md`. The existing /replay endpoint
 * answers "what would these rules have done historically?". The simulator
 * answers "if I publish this pack RIGHT NOW, which bids get re-routed?".
 *
 * Reuses VendorMatchingReplayService — only the trace filter differs:
 *   - replay:    every trace in a sinceDays window.
 *   - simulate:  only traces where outcome IN (pending_bid, broadcast).
 *
 * Output extends CategoryReplayDiff with simulator-specific aggregates:
 * `losingBidVendors` (originally-selected vendor now denied) and
 * `newlyEscalatedOrders` (proposed pack denies every considered vendor).
 *
 * Read-only.
 */

import type { CosmosDbService } from '../../cosmos-db.service.js';
import type { MopRulePackPusher } from '../../mop-rule-pack-pusher.service.js';
import { Logger } from '../../../utils/logger.js';
import type { AssignmentTraceDocument } from '../../../types/assignment-trace.types.js';
import { VendorMatchingReplayService } from '../replay/vendor-matching-replay.service.js';
import type { CategoryReplayDecision, CategoryReplayInput } from '../category-definition.js';

const TRACES_CONTAINER = 'assignment-traces';
const MAX_PENDING_TRACES = 500;
const PENDING_LOOKBACK_DAYS = 14;

export interface SimulationInput {
	tenantId: string;
	rules: unknown[];
	packId?: string;
}

export interface SimulationResult {
	pendingCount: number;
	changedCount: number;
	unchangedCount: number;
	skippedCount: number;
	newlyEscalatedOrders: string[];
	losingBidVendors: Array<{ vendorId: string; orderId: string; reasons: string[] }>;
	perDecision: CategoryReplayDecision[];
}

export class DecisionImpactSimulatorService {
	private readonly logger = new Logger('DecisionImpactSimulatorService');
	private readonly replayer: VendorMatchingReplayService;

	constructor(
		private readonly db: CosmosDbService,
		private readonly pusher: MopRulePackPusher,
	) {
		this.replayer = new VendorMatchingReplayService(db, pusher);
	}

	async simulate(input: SimulationInput): Promise<SimulationResult> {
		if (!input.tenantId) throw new Error('simulate: tenantId is required');

		const pending = await this.fetchPendingTraces(input.tenantId);
		this.logger.info('simulator: pending decisions queried', {
			tenantId: input.tenantId,
			pendingCount: pending.length,
		});

		if (pending.length === 0) {
			return {
				pendingCount: 0,
				changedCount: 0,
				unchangedCount: 0,
				skippedCount: 0,
				newlyEscalatedOrders: [],
				losingBidVendors: [],
				perDecision: [],
			};
		}

		const replayInput: CategoryReplayInput = {
			tenantId: input.tenantId,
			rules: input.rules,
			ids: pending.map(t => t.orderId),
			...(input.packId ? { packId: input.packId } : {}),
		};
		const diff = await this.replayer.replay(replayInput);

		const traceById = new Map<string, AssignmentTraceDocument>(pending.map(t => [t.id, t]));
		const losingBidVendors: SimulationResult['losingBidVendors'] = [];
		const newlyEscalatedOrders: string[] = [];

		for (const dec of diff.perDecision) {
			const trace = traceById.get(dec.decisionId);
			if (!trace || !dec.changed) continue;
			const details = dec.details ?? {};
			const newDenials = (details['newDenials'] as Array<{ vendorId: string; reasons: string[] }> | undefined) ?? [];

			if (trace.selectedVendorId) {
				const denied = newDenials.find(d => d.vendorId === trace.selectedVendorId);
				if (denied) {
					losingBidVendors.push({
						vendorId: trace.selectedVendorId,
						orderId: trace.orderId,
						reasons: denied.reasons,
					});
				}
			}

			const newAcceptances = (details['newAcceptances'] as string[] | undefined) ?? [];
			const allRankedNowDenied = trace.rankedVendors.length > 0
				&& trace.rankedVendors.every(r => newDenials.some(d => d.vendorId === r.vendorId));
			if (allRankedNowDenied && newAcceptances.length === 0) {
				newlyEscalatedOrders.push(trace.orderId);
			}
		}

		this.logger.info('simulator: complete', {
			tenantId: input.tenantId,
			pendingCount: pending.length,
			changedCount: diff.changedCount,
			losingBidCount: losingBidVendors.length,
			newlyEscalatedCount: newlyEscalatedOrders.length,
		});

		return {
			pendingCount: pending.length,
			changedCount: diff.changedCount,
			unchangedCount: diff.unchangedCount,
			skippedCount: diff.skippedCount,
			newlyEscalatedOrders,
			losingBidVendors,
			perDecision: diff.perDecision,
		};
	}

	private async fetchPendingTraces(tenantId: string): Promise<AssignmentTraceDocument[]> {
		const sinceIso = new Date(Date.now() - PENDING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
		return this.db.queryDocuments<AssignmentTraceDocument>(
			TRACES_CONTAINER,
			`SELECT TOP @limit * FROM c
			 WHERE c.type = 'assignment-trace'
			   AND c.tenantId = @tenantId
			   AND c.initiatedAt >= @sinceIso
			   AND (c.outcome = 'pending_bid' OR c.outcome = 'broadcast')
			 ORDER BY c.initiatedAt DESC`,
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@sinceIso', value: sinceIso },
				{ name: '@limit', value: MAX_PENDING_TRACES },
			],
		);
	}
}
