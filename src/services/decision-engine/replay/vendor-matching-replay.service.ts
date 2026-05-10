/**
 * VendorMatchingReplayService — re-evaluate recent vendor-matching
 * decisions with proposed rules and compute a side-by-side diff.
 *
 * Phase D of docs/DECISION_ENGINE_RULES_SURFACE.md. Powers the Sandbox tab
 * in the Decision Engine workspace: operators edit a proposed rule pack,
 * click "Replay against last N days", and see how those rules would have
 * altered each historical assignment.
 *
 * Data sources:
 *   - assignment-traces (Cosmos)  — the historical decisions to re-evaluate.
 *   - vendors (Cosmos)            — current vendor facts. The trace stores
 *                                  vendor IDs but not the full fact bundle
 *                                  that went into the original eval, so
 *                                  replay rebuilds evaluations from current
 *                                  vendor data + the trace's order context.
 *                                  This is "best-effort" replay: vendor
 *                                  performance metrics may have shifted
 *                                  since the original decision. Faithful
 *                                  replay (frozen-fact snapshots on the
 *                                  trace) is a follow-up.
 *
 * Boundaries:
 *   - Tenant-scoped: replay never crosses tenants.
 *   - Bounded: sinceDays clamped to [1, 30]; sampling caps the per-call
 *              workload so a 30-day replay can't overrun preview latency.
 *   - Read-only: no Cosmos writes; no MOP push. preview is stateless.
 */

import type { CosmosDbService } from '../../cosmos-db.service.js';
import type { MopRulePackPusher } from '../../mop-rule-pack-pusher.service.js';
import { Logger } from '../../../utils/logger.js';
import type {
	CategoryReplayDecision,
	CategoryReplayDiff,
	CategoryReplayInput,
} from '../category-definition.js';
import type { AssignmentTraceDocument } from '../../../types/assignment-trace.types.js';

const TRACES_CONTAINER = 'assignment-traces';
const VENDORS_CONTAINER = 'vendors';

/** Max sinceDays the operator can request; protects MOP /preview from being flooded. */
const MAX_SINCE_DAYS = 30;
/** Max traces sampled per call (after sinceDays + samplePercent are applied). */
const MAX_REPLAYED_TRACES = 200;

interface VendorRecord {
	id: string;
	tenantId?: string;
	capabilities?: string[];
	serviceAreas?: Array<{ state?: string }>;
	licenseType?: string;
	overallScore?: number;
}

interface VendorMatchingPreviewEvaluation {
	vendor: {
		id: string;
		capabilities?: string[];
		states?: string[];
		performanceScore?: number;
		licenseType?: string;
		distance?: number;
	};
	order: {
		productType?: string;
		propertyState?: string;
		orderValueUsd?: number;
	};
	__originalRanked: boolean;
	__originalScore: number;
}

export class VendorMatchingReplayService {
	private readonly logger = new Logger('VendorMatchingReplayService');

	constructor(
		private readonly db: CosmosDbService,
		private readonly pusher: MopRulePackPusher,
	) {}

	async replay(input: CategoryReplayInput): Promise<CategoryReplayDiff> {
		if (!input.tenantId) throw new Error('replay: tenantId is required');

		const sinceDays = clampDays(input.sinceDays ?? 7);
		const sincePercent = clampPercent(input.samplePercent ?? 100);
		const packLabel = input.packId ?? 'sandbox';

		const traces = await this.fetchTracesInWindow(
			input.tenantId,
			sinceDays,
			input.ids,
		);
		const sampled = subsample(traces, sincePercent, MAX_REPLAYED_TRACES);

		const vendorIdSet = new Set<string>();
		for (const t of sampled) {
			for (const r of t.rankedVendors ?? []) vendorIdSet.add(r.vendorId);
			for (const d of t.deniedVendors ?? []) vendorIdSet.add(d.vendorId);
		}

		const vendorById = await this.fetchVendorsByIds(input.tenantId, vendorIdSet);

		let changedCount = 0;
		let unchangedCount = 0;
		let skippedCount = 0;
		let newDenialsCount = 0;
		let newAcceptancesCount = 0;
		const perDecision: CategoryReplayDecision[] = [];

		for (const trace of sampled) {
			const decision = await this.replayOne(trace, input.rules, packLabel, vendorById);
			perDecision.push(decision);
			if (decision.skippedReason) {
				skippedCount++;
			} else if (decision.changed) {
				changedCount++;
				const det = decision.details ?? {};
				newDenialsCount += Number((det['newDenials'] as unknown[] | undefined)?.length ?? 0);
				newAcceptancesCount += Number((det['newAcceptances'] as unknown[] | undefined)?.length ?? 0);
			} else {
				unchangedCount++;
			}
		}

		this.logger.info('vendor-matching replay complete', {
			tenantId: input.tenantId,
			sinceDays,
			windowSize: traces.length,
			totalEvaluated: sampled.length,
			changedCount,
			unchangedCount,
			skippedCount,
			newDenialsCount,
			newAcceptancesCount,
		});

		return {
			windowSize: traces.length,
			totalEvaluated: sampled.length,
			changedCount,
			unchangedCount,
			skippedCount,
			newDenialsCount,
			newAcceptancesCount,
			perDecision,
		};
	}

	// ── Trace fetch ──────────────────────────────────────────────────────────

	private async fetchTracesInWindow(
		tenantId: string,
		sinceDays: number,
		ids?: string[],
	): Promise<AssignmentTraceDocument[]> {
		if (ids && ids.length > 0) {
			// Explicit ids: read each by orderId. Batched by partition.
			const results: AssignmentTraceDocument[] = [];
			for (const orderId of ids) {
				const docs = await this.db.queryDocuments<AssignmentTraceDocument>(
					TRACES_CONTAINER,
					`SELECT * FROM c
					 WHERE c.type = 'assignment-trace'
					   AND c.tenantId = @tenantId
					   AND c.orderId = @orderId
					 ORDER BY c.initiatedAt DESC`,
					[
						{ name: '@tenantId', value: tenantId },
						{ name: '@orderId', value: orderId },
					],
				);
				if (docs[0]) results.push(docs[0]);
			}
			return results;
		}

		const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
		return this.db.queryDocuments<AssignmentTraceDocument>(
			TRACES_CONTAINER,
			`SELECT * FROM c
			 WHERE c.type = 'assignment-trace'
			   AND c.tenantId = @tenantId
			   AND c.initiatedAt >= @sinceIso
			 ORDER BY c.initiatedAt DESC`,
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@sinceIso', value: sinceIso },
			],
		);
	}

	// ── Vendor fetch ─────────────────────────────────────────────────────────

	private async fetchVendorsByIds(
		tenantId: string,
		ids: Set<string>,
	): Promise<Map<string, VendorRecord>> {
		const map = new Map<string, VendorRecord>();
		if (ids.size === 0) return map;
		const idArray = Array.from(ids);
		// Single IN-list query — the vendor partition key is /tenantId so this
		// stays partition-scoped.
		const docs = await this.db.queryDocuments<VendorRecord>(
			VENDORS_CONTAINER,
			`SELECT c.id, c.tenantId, c.capabilities, c.serviceAreas, c.licenseType, c.overallScore
			 FROM c
			 WHERE c.tenantId = @tenantId
			   AND ARRAY_CONTAINS(@ids, c.id)`,
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@ids', value: idArray },
			],
		);
		for (const v of docs) map.set(v.id, v);
		return map;
	}

	// ── Per-trace replay ─────────────────────────────────────────────────────

	private async replayOne(
		trace: AssignmentTraceDocument,
		rules: unknown[],
		packLabel: string,
		vendorById: Map<string, VendorRecord>,
	): Promise<CategoryReplayDecision> {
		const evaluations: VendorMatchingPreviewEvaluation[] = [];
		const ranked = trace.rankedVendors ?? [];
		const denied = trace.deniedVendors ?? [];
		const allConsidered: Array<{ id: string; originallyRanked: boolean; originalScore: number }> = [
			...ranked.map(r => ({ id: r.vendorId, originallyRanked: true, originalScore: r.score })),
			...denied.map(d => ({ id: d.vendorId, originallyRanked: false, originalScore: 0 })),
		];

		for (const v of allConsidered) {
			const rec = vendorById.get(v.id);
			if (!rec) continue; // Vendor was deleted/inactive — skip from replay.
			evaluations.push({
				vendor: {
					id: rec.id,
					...(rec.capabilities ? { capabilities: rec.capabilities } : {}),
					...(rec.serviceAreas
						? { states: rec.serviceAreas.map(sa => sa.state).filter((s): s is string => Boolean(s)) }
						: {}),
					...(rec.overallScore !== undefined ? { performanceScore: rec.overallScore } : {}),
					...(rec.licenseType !== undefined ? { licenseType: rec.licenseType } : {}),
				},
				order: {
					// trace stores `propertyType` (the product/loan-product type at decision time);
					// MOP's vendor-matching facts call this `productType`. Same value, different name.
					...(trace.matchRequest.propertyType ? { productType: trace.matchRequest.propertyType } : {}),
					// propertyState would need address parsing — skipped for MVP. Operators
					// see this in the trace's matchRequest.propertyAddress field anyway.
				},
				__originalRanked: v.originallyRanked,
				__originalScore: v.originalScore,
			});
		}

		if (evaluations.length === 0) {
			return {
				decisionId: trace.id,
				subjectId: trace.orderId,
				initiatedAt: trace.initiatedAt,
				changed: false,
				summary: 'Skipped — no current vendors found for any considered vendor IDs.',
				skippedReason: 'no-current-vendor-data',
			};
		}

		let previewResult: { results: Array<{ eligible: boolean; scoreAdjustment: number; appliedRuleIds: string[]; denyReasons: string[] }> };
		try {
			previewResult = await this.pusher.preview({
				rulePack: {
					program: {
						name: `Replay ${packLabel} for tenant ${trace.tenantId} order ${trace.orderId}`,
						programId: 'vendor-matching',
						version: 'replay',
						description: `Sandbox replay of trace ${trace.id}`,
					},
					rules,
				},
				evaluations: evaluations.map(({ vendor, order }) => ({ vendor, order })),
			});
		} catch (err) {
			return {
				decisionId: trace.id,
				subjectId: trace.orderId,
				initiatedAt: trace.initiatedAt,
				changed: false,
				summary: `Skipped — preview failed: ${err instanceof Error ? err.message : String(err)}`,
				skippedReason: 'preview-failure',
			};
		}

		// Compare per-vendor: was originallyRanked === isEligibleNow?
		const newDenials: Array<{ vendorId: string; reasons: string[] }> = [];
		const newAcceptances: string[] = [];
		const scoreDeltas: Array<{ vendorId: string; delta: number }> = [];

		previewResult.results.forEach((r, i) => {
			const ev = evaluations[i]!;
			if (ev.__originalRanked && !r.eligible) {
				newDenials.push({ vendorId: ev.vendor.id, reasons: r.denyReasons });
			} else if (!ev.__originalRanked && r.eligible) {
				newAcceptances.push(ev.vendor.id);
			}
			if (r.eligible && r.scoreAdjustment !== 0) {
				scoreDeltas.push({ vendorId: ev.vendor.id, delta: r.scoreAdjustment });
			}
		});

		const changed = newDenials.length > 0 || newAcceptances.length > 0;
		const parts: string[] = [];
		if (newDenials.length > 0) parts.push(`${newDenials.length} new denial${newDenials.length === 1 ? '' : 's'}`);
		if (newAcceptances.length > 0) parts.push(`${newAcceptances.length} new acceptance${newAcceptances.length === 1 ? '' : 's'}`);
		if (parts.length === 0) parts.push('No outcome change');
		const summary = parts.join(', ');

		return {
			decisionId: trace.id,
			subjectId: trace.orderId,
			initiatedAt: trace.initiatedAt,
			changed,
			summary,
			details: {
				originalOutcome: trace.outcome,
				originalSelectedVendorId: trace.selectedVendorId,
				newDenials,
				newAcceptances,
				scoreDeltas,
				vendorsConsidered: evaluations.length,
				vendorsMissingFromCurrentDataset: allConsidered.length - evaluations.length,
			},
		};
	}
}

// ── Utilities ───────────────────────────────────────────────────────────────

function clampDays(d: number): number {
	if (!Number.isFinite(d) || d <= 0) return 7;
	return Math.min(Math.floor(d), MAX_SINCE_DAYS);
}

function clampPercent(p: number): number {
	if (!Number.isFinite(p)) return 100;
	return Math.max(1, Math.min(100, Math.floor(p)));
}

function subsample<T>(arr: T[], percent: number, hardCap: number): T[] {
	if (arr.length === 0) return arr;
	const targetByPercent = Math.ceil((arr.length * percent) / 100);
	const target = Math.min(targetByPercent, hardCap);
	if (target >= arr.length) return arr.slice(0, hardCap);
	// Deterministic stride-based sample so the same input always produces the
	// same output (operators reading the result table can refer to specific
	// rows without races).
	const stride = arr.length / target;
	const out: T[] = [];
	for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * stride)]!);
	return out;
}
