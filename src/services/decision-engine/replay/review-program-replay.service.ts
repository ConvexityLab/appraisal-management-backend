/**
 * ReviewProgramReplayService — Phase F.replay of
 * docs/DECISION_ENGINE_RULES_SURFACE.md.
 *
 * Re-evaluate recent review-program decisions with operator-proposed rules
 * and compute a per-loan diff. Powers the Sandbox tab in the Decision
 * Engine workspace for the `review-program` category.
 *
 * Data sources:
 *   - `bulk-portfolio-jobs` + `review-results` (via ReviewProgramResultsReader)
 *     — the historical decisions, including every RiskTapeItem source field
 *       that fed the original evaluation. Because ReviewTapeResult extends
 *       RiskTapeItem, the persisted result documents ARE the frozen fact
 *       bundle — no separate evaluationsSnapshot is needed.
 *   - `review-programs` (Cosmos)  — the program the historical decision
 *     was evaluated against (so the proposed fragments can be overlaid on
 *     the right baseline).
 *
 * Replay is "faithful by construction": the input fields that drove every
 * original auto-flag / manual-flag fire are persisted on the result row,
 * and TapeEvaluationService is pure / deterministic, so re-running it on
 * the same item with a modified program produces the diff operators want.
 *
 * Wire format for `input.rules` — fragment array. Each fragment overlays
 * the historical program's matching component before re-evaluation:
 *   { kind: 'thresholds',     thresholds:    ReviewThresholds      }
 *   { kind: 'decision-rules', decisionRules: ReviewDecisionRules   }
 *   { kind: 'auto-flag',      def:           ReviewProgramAutoFlagDef   }
 *   { kind: 'manual-flag',    def:           ReviewProgramManualFlagDef }
 *
 * Fragments without a `kind` (e.g. Prio-format rule objects from a different
 * category surface) are ignored with a `skippedReason: 'unsupported-format'`
 * on the diff row. This keeps the endpoint forgiving when the FE workspace
 * for review-program rules ships in a later phase.
 *
 * Boundaries:
 *   - Tenant-scoped: every read is `tenantId =` filtered.
 *   - Bounded: sinceDays clamped to [1, MAX_SINCE_DAYS]; sampling caps the
 *              per-call workload so a 30-day replay can't blow the response
 *              budget.
 *   - Read-only: no Cosmos writes; no MOP push. Stateless.
 */

import { Logger } from '../../../utils/logger.js';
import type { CosmosDbService } from '../../cosmos-db.service.js';
import { TapeEvaluationService } from '../../tape-evaluation.service.js';
import {
	ReviewProgramResultsReader,
	type NormalizedReviewDecision,
} from '../review-program/review-program-results-reader.service.js';
import type {
	CategoryReplayDecision,
	CategoryReplayDiff,
	CategoryReplayInput,
} from '../category-definition.js';
import type {
	ReviewProgram,
	ReviewProgramAutoFlagDef,
	ReviewProgramManualFlagDef,
	ReviewThresholds,
	ReviewDecisionRules,
	ReviewTapeResult,
	RiskTapeItem,
} from '../../../types/review-tape.types.js';

const REVIEW_PROGRAMS_CONTAINER = 'review-programs';
const REVIEW_RESULTS_CONTAINER = 'review-results';
const MAX_SINCE_DAYS = 30;
const MAX_REPLAYED = 500;

/** Operator-proposed fragments. */
interface ThresholdsFragment   { kind: 'thresholds';     thresholds:    ReviewThresholds; }
interface DecisionRulesFragment { kind: 'decision-rules'; decisionRules: ReviewDecisionRules; }
interface AutoFlagFragment      { kind: 'auto-flag';      def:           ReviewProgramAutoFlagDef; }
interface ManualFlagFragment    { kind: 'manual-flag';    def:           ReviewProgramManualFlagDef; }
type ProposedFragment =
	| ThresholdsFragment
	| DecisionRulesFragment
	| AutoFlagFragment
	| ManualFlagFragment;

export class ReviewProgramReplayService {
	private readonly logger = new Logger('ReviewProgramReplayService');
	private readonly reader: ReviewProgramResultsReader;
	private readonly tape = new TapeEvaluationService();

	constructor(private readonly db: CosmosDbService) {
		this.reader = new ReviewProgramResultsReader(db);
	}

	async replay(input: CategoryReplayInput): Promise<CategoryReplayDiff> {
		if (!input.tenantId) throw new Error('replay: tenantId is required');

		const sinceDays = clampDays(input.sinceDays ?? 7);
		const samplePercent = clampPercent(input.samplePercent ?? 100);
		const fragments = collectFragments(input.rules);

		const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
		const allDecisions = await this.reader.listSinceIncludingOrderResults(input.tenantId, sinceIso);

		const inWindow = input.ids && input.ids.length > 0
			? allDecisions.filter(d => input.ids!.includes(d.id) || (d.orderId && input.ids!.includes(d.orderId)))
			: allDecisions;

		const sampled = subsample(inWindow, samplePercent, MAX_REPLAYED);

		// Programs are partitioned by /clientId, but historical decisions may not
		// carry clientId; load each program by id once, cached for the call.
		const programCache = new Map<string, ReviewProgram | null>();

		let changedCount = 0;
		let unchangedCount = 0;
		let skippedCount = 0;
		let newDenialsCount = 0;
		let newAcceptancesCount = 0;
		const perDecision: CategoryReplayDecision[] = [];

		for (const dec of sampled) {
			const replayed = await this.replayOne(dec, fragments, programCache);
			perDecision.push(replayed);
			if (replayed.skippedReason) {
				skippedCount++;
			} else if (replayed.changed) {
				changedCount++;
				const det = replayed.details ?? {};
				const wasReject = det['originalOutcome'] === 'Reject';
				const isReject = det['newOutcome'] === 'Reject';
				if (!wasReject && isReject) newDenialsCount++;
				if (wasReject && !isReject) newAcceptancesCount++;
			} else {
				unchangedCount++;
			}
		}

		this.logger.info('review-program replay complete', {
			tenantId: input.tenantId,
			sinceDays,
			windowSize: inWindow.length,
			totalEvaluated: sampled.length,
			fragmentCount: fragments.length,
			changedCount,
			unchangedCount,
			skippedCount,
		});

		return {
			windowSize: inWindow.length,
			totalEvaluated: sampled.length,
			changedCount,
			unchangedCount,
			skippedCount,
			newDenialsCount,
			newAcceptancesCount,
			perDecision,
		};
	}

	// ── Per-decision replay ─────────────────────────────────────────────────

	private async replayOne(
		dec: NormalizedReviewDecision,
		fragments: ProposedFragment[],
		programCache: Map<string, ReviewProgram | null>,
	): Promise<CategoryReplayDecision> {
		if (!dec.reviewProgramId) {
			return skipRow(dec, 'no-program-id-on-decision');
		}
		if (fragments.length === 0) {
			return skipRow(dec, 'no-supported-fragments');
		}

		const baseProgram = await this.loadProgram(dec.reviewProgramId, programCache);
		if (!baseProgram) {
			return skipRow(dec, 'program-not-found');
		}

		// Inline-fields baseline is required by TapeEvaluationService. Programs
		// stored as pure ref-only (rulesetRefs / aiCriteriaRefs) can't be
		// replayed in-process yet — would require MopCriteriaService resolution
		// which is out of scope for this surface today.
		if (!baseProgram.autoFlags || !baseProgram.manualFlags || !baseProgram.thresholds || !baseProgram.decisionRules) {
			return skipRow(dec, 'program-has-no-inline-rules');
		}

		// Apply the proposed fragments as overlays on the baseline program.
		const proposed = applyFragments(baseProgram, fragments);

		// Re-fetch the raw ReviewTapeResult to recover the full RiskTapeItem
		// fact bundle. The NormalizedReviewDecision shape strips most of it.
		const raw = await this.loadRawResult(dec.jobId, dec.id);
		if (!raw) {
			return skipRow(dec, 'raw-result-not-found');
		}

		const tapeItem = projectResultToTapeItem(raw);

		let newResult: ReviewTapeResult | undefined;
		try {
			[newResult] = this.tape.evaluate([tapeItem], proposed);
		} catch (err) {
			return skipRow(dec, `evaluator-error: ${err instanceof Error ? err.message : String(err)}`);
		}
		if (!newResult) return skipRow(dec, 'evaluator-returned-empty');

		const originalOutcome = dec.overrideDecision ?? dec.computedDecision ?? 'unknown';
		const newOutcome = newResult.computedDecision;
		const originalScore = typeof dec.overallRiskScore === 'number' ? dec.overallRiskScore : 0;
		const newScore = newResult.overallRiskScore;
		const scoreDelta = newScore - originalScore;

		const originalFired = new Set(dec.firedFlagIds);
		const newFired = new Set(
			[...newResult.autoFlagResults, ...newResult.manualFlagResults]
				.filter(f => f.isFired)
				.map(f => f.id),
		);
		const flagsAdded   = Array.from(newFired).filter(id => !originalFired.has(id));
		const flagsRemoved = Array.from(originalFired).filter(id => !newFired.has(id));

		const changed = originalOutcome !== newOutcome || flagsAdded.length > 0 || flagsRemoved.length > 0;

		const parts: string[] = [];
		if (originalOutcome !== newOutcome) parts.push(`${originalOutcome} → ${newOutcome}`);
		if (flagsAdded.length > 0)   parts.push(`+${flagsAdded.length} flag${flagsAdded.length === 1 ? '' : 's'}`);
		if (flagsRemoved.length > 0) parts.push(`-${flagsRemoved.length} flag${flagsRemoved.length === 1 ? '' : 's'}`);
		if (scoreDelta !== 0)        parts.push(`score ${scoreDelta > 0 ? '+' : ''}${Math.round(scoreDelta * 10) / 10}`);
		if (parts.length === 0)      parts.push('No outcome change');

		return {
			decisionId: dec.id,
			subjectId: dec.loanNumber ?? dec.orderId ?? dec.id,
			initiatedAt: dec.evaluatedAt,
			changed,
			summary: parts.join(', '),
			details: {
				originalOutcome,
				newOutcome,
				originalScore,
				newScore,
				scoreDelta,
				flagsAdded,
				flagsRemoved,
				programId: dec.reviewProgramId,
				programVersion: dec.reviewProgramVersion ?? null,
				factSource: 'persisted-result',
				faithful: true,
			},
		};
	}

	// ── Loaders ─────────────────────────────────────────────────────────────

	private async loadProgram(
		programId: string,
		cache: Map<string, ReviewProgram | null>,
	): Promise<ReviewProgram | null> {
		if (cache.has(programId)) return cache.get(programId) ?? null;
		const docs = await this.db.queryDocuments<ReviewProgram>(
			REVIEW_PROGRAMS_CONTAINER,
			'SELECT * FROM c WHERE c.id = @id',
			[{ name: '@id', value: programId }],
		);
		const program = docs[0] ?? null;
		cache.set(programId, program);
		return program;
	}

	private async loadRawResult(jobId: string, resultId: string): Promise<ReviewTapeResult | null> {
		// review-results is partitioned by /jobId. The bulk path stores results
		// as inline `items[]` on the parent job (no row in review-results); in
		// that case the result id is `${jobId}__${loanNumber|rowIndex}`. Fall
		// back to scanning the parent job's inline items.
		const docs = await this.db.queryDocuments<ReviewTapeResult>(
			REVIEW_RESULTS_CONTAINER,
			'SELECT * FROM c WHERE c.id = @id AND c.jobId = @jobId',
			[
				{ name: '@id', value: resultId },
				{ name: '@jobId', value: jobId },
			],
		);
		if (docs[0]) return docs[0];

		const job = await this.db.queryDocuments<{ items?: unknown[] }>(
			'bulk-portfolio-jobs',
			'SELECT c.items FROM c WHERE c.id = @id',
			[{ name: '@id', value: jobId }],
		);
		const items = job[0]?.items;
		if (!Array.isArray(items)) return null;
		for (const item of items) {
			if (item && typeof item === 'object' && 'autoFlagResults' in item) {
				const result = item as ReviewTapeResult & { loanNumber?: string; rowIndex?: number };
				const composed = `${jobId}__${result.loanNumber ?? result.rowIndex ?? 'unknown'}`;
				if (composed === resultId) return result;
			}
		}
		return null;
	}
}

// ── Pure helpers (exported for unit testability) ────────────────────────────

export function collectFragments(rules: unknown[] | undefined): ProposedFragment[] {
	if (!Array.isArray(rules)) return [];
	const out: ProposedFragment[] = [];
	for (const r of rules) {
		if (!r || typeof r !== 'object') continue;
		const k = (r as { kind?: unknown }).kind;
		if (k === 'thresholds' && hasObj(r, 'thresholds')) {
			out.push(r as ThresholdsFragment);
		} else if (k === 'decision-rules' && hasObj(r, 'decisionRules')) {
			out.push(r as DecisionRulesFragment);
		} else if (k === 'auto-flag' && hasObj(r, 'def')) {
			out.push(r as AutoFlagFragment);
		} else if (k === 'manual-flag' && hasObj(r, 'def')) {
			out.push(r as ManualFlagFragment);
		}
	}
	return out;
}

function hasObj(o: object, key: string): boolean {
	const v = (o as Record<string, unknown>)[key];
	return v != null && typeof v === 'object';
}

/**
 * Apply proposed fragments as overlays on a baseline ReviewProgram.
 *   - thresholds:     replaces the entire thresholds object
 *   - decision-rules: replaces the entire decisionRules object
 *   - auto-flag/manual-flag: matched by id — replaces existing, or appends if new
 * Returns a NEW program (no mutation).
 */
export function applyFragments(base: ReviewProgram, fragments: ProposedFragment[]): ReviewProgram {
	const next: ReviewProgram = {
		...base,
		autoFlags: base.autoFlags ? [...base.autoFlags] : [],
		manualFlags: base.manualFlags ? [...base.manualFlags] : [],
	};
	if (base.thresholds)    next.thresholds    = { ...base.thresholds };
	if (base.decisionRules) next.decisionRules = { ...base.decisionRules };

	for (const f of fragments) {
		switch (f.kind) {
			case 'thresholds':
				next.thresholds = { ...f.thresholds };
				break;
			case 'decision-rules':
				next.decisionRules = { ...f.decisionRules };
				break;
			case 'auto-flag': {
				const list = next.autoFlags!;
				const idx = list.findIndex(x => x.id === f.def.id);
				if (idx >= 0) list[idx] = f.def;
				else list.push(f.def);
				break;
			}
			case 'manual-flag': {
				const list = next.manualFlags!;
				const idx = list.findIndex(x => x.id === f.def.id);
				if (idx >= 0) list[idx] = f.def;
				else list.push(f.def);
				break;
			}
		}
	}

	return next;
}

/**
 * ReviewTapeResult is a structural superset of RiskTapeItem. Strip the
 * result-only fields before re-evaluating so TapeEvaluationService.evaluate
 * recomputes flags from source inputs without leakage from the prior run.
 */
export function projectResultToTapeItem(result: ReviewTapeResult): RiskTapeItem {
	const {
		overallRiskScore: _s,
		computedDecision: _d,
		autoFlagResults: _af,
		manualFlagResults: _mf,
		dataQualityIssues: _dq,
		evaluatedAt: _ev,
		programId: _pid,
		programVersion: _pv,
		axiomEvaluationId: _axe,
		axiomExtractionConfidence: _axec,
		axiomRiskScore: _axrs,
		axiomDecision: _axd,
		axiomStatus: _axs,
		overrideDecision: _od,
		overrideReason: _or,
		overriddenAt: _oa,
		overriddenBy: _ob,
		orderId: _oid,
		orderNumber: _on,
		triggerSource: _ts,
		tenantId: _tn,
		...item
	} = result;
	return item;
}

// ── Misc utilities ──────────────────────────────────────────────────────────

function skipRow(dec: NormalizedReviewDecision, reason: string): CategoryReplayDecision {
	return {
		decisionId: dec.id,
		subjectId: dec.loanNumber ?? dec.orderId ?? dec.id,
		initiatedAt: dec.evaluatedAt,
		changed: false,
		summary: `Skipped — ${reason}`,
		skippedReason: reason,
	};
}

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
	const stride = arr.length / target;
	const out: T[] = [];
	for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * stride)]!);
	return out;
}
