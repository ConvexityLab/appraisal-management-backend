/**
 * PackVersionDiffService — compute the rule-level diff between any two
 * versions of a decision-rule pack, plus optional behavioral replay
 * (run both packs against the same historical window and compare
 * outcomes).
 *
 * Scope-expansion item promised in rev 15 of
 * `docs/DECISION_ENGINE_RULES_SURFACE.md`. No new storage — both packs
 * already live in `decision-rule-packs`. Rule identity is the rule's
 * `name` field; equality is canonical-JSON (keys sorted lex) so cosmetic
 * key-order differences don't surface as edits.
 *
 * Read-only.
 */

import { Logger } from '../../../utils/logger.js';
import type { DecisionRulePackService } from '../../decision-rule-pack.service.js';
import type { RulePackDocument } from '../../../types/decision-rule-pack.types.js';
import type { CategoryReplayDiff, CategoryReplayInput } from '../category-definition.js';

export interface DiffInput {
	tenantId: string;
	category: string;
	packId: string;
	versionA: number;
	versionB: number;
}

export interface PackVersionDiff {
	versionA: number;
	versionB: number;
	added:    Array<{ name: string; rule: unknown }>;
	removed:  Array<{ name: string; rule: unknown }>;
	modified: Array<{ name: string; before: unknown; after: unknown }>;
	unchanged: Array<{ name: string }>;
	metadataChanges: Array<{ field: string; before: unknown; after: unknown }>;
}

export interface BehavioralDiffInput extends DiffInput {
	sinceDays?: number;
	samplePercent?: number;
}

export interface BehavioralDiff {
	pack: PackVersionDiff;
	replayA: CategoryReplayDiff;
	replayB: CategoryReplayDiff;
	divergence: Array<{
		decisionId: string;
		subjectId: string;
		summaryA: string;
		summaryB: string;
		changedA: boolean;
		changedB: boolean;
	}>;
}

interface RuleLike { name?: unknown }

export class PackVersionDiffService {
	private readonly logger = new Logger('PackVersionDiffService');

	constructor(
		private readonly packs: DecisionRulePackService,
	) {}

	async diff(input: DiffInput): Promise<PackVersionDiff> {
		const [packA, packB] = await Promise.all([
			this.loadVersion(input, input.versionA),
			this.loadVersion(input, input.versionB),
		]);
		return this.diffFromPacks(input, packA, packB);
	}

	/** Compute the diff from two already-loaded pack docs. Pure (no I/O). */
	private diffFromPacks(input: DiffInput, packA: RulePackDocument, packB: RulePackDocument): PackVersionDiff {
		const rulesA = (Array.isArray(packA.rules) ? packA.rules : []) as unknown[];
		const rulesB = (Array.isArray(packB.rules) ? packB.rules : []) as unknown[];
		const byNameA = indexByName(rulesA);
		const byNameB = indexByName(rulesB);

		const added:    PackVersionDiff['added']    = [];
		const removed:  PackVersionDiff['removed']  = [];
		const modified: PackVersionDiff['modified'] = [];
		const unchanged: PackVersionDiff['unchanged'] = [];

		for (const [name, ruleA] of byNameA) {
			const ruleB = byNameB.get(name);
			if (!ruleB) {
				removed.push({ name, rule: ruleA });
				continue;
			}
			if (canonicalize(ruleA) !== canonicalize(ruleB)) {
				modified.push({ name, before: ruleA, after: ruleB });
			} else {
				unchanged.push({ name });
			}
		}
		for (const [name, ruleB] of byNameB) {
			if (!byNameA.has(name)) added.push({ name, rule: ruleB });
		}

		const metadataChanges = compareMetadata(packA, packB);

		this.logger.info('pack diff complete', {
			tenantId: input.tenantId,
			category: input.category,
			packId: input.packId,
			versionA: input.versionA,
			versionB: input.versionB,
			counts: { added: added.length, removed: removed.length, modified: modified.length, unchanged: unchanged.length },
		});

		return {
			versionA: input.versionA,
			versionB: input.versionB,
			added,
			removed,
			modified,
			unchanged,
			metadataChanges,
		};
	}

	async behavioralDiff(
		input: BehavioralDiffInput,
		replayer: (replayInput: CategoryReplayInput) => Promise<CategoryReplayDiff>,
	): Promise<BehavioralDiff> {
		// Load both packs ONCE, then compute the rule diff from those in-memory
		// copies instead of re-running listVersions a second time inside .diff().
		// Was 4 list-versions calls; now 2.
		const [packA, packB] = await Promise.all([
			this.loadVersion(input, input.versionA),
			this.loadVersion(input, input.versionB),
		]);
		const pack = this.diffFromPacks(input, packA, packB);

		const replayBase = {
			tenantId: input.tenantId,
			...(input.sinceDays !== undefined ? { sinceDays: input.sinceDays } : {}),
			...(input.samplePercent !== undefined ? { samplePercent: input.samplePercent } : {}),
		};
		const [replayA, replayB] = await Promise.all([
			replayer({ ...replayBase, rules: (packA.rules as unknown[]) ?? [], packId: `${input.packId}-v${input.versionA}` }),
			replayer({ ...replayBase, rules: (packB.rules as unknown[]) ?? [], packId: `${input.packId}-v${input.versionB}` }),
		]);

		const byIdA = new Map(replayA.perDecision.map(d => [d.decisionId, d]));
		const divergence: BehavioralDiff['divergence'] = [];
		for (const decB of replayB.perDecision) {
			const decA = byIdA.get(decB.decisionId);
			if (!decA) continue;
			if (decA.changed !== decB.changed || decA.summary !== decB.summary) {
				divergence.push({
					decisionId: decB.decisionId,
					subjectId: decB.subjectId,
					summaryA: decA.summary,
					summaryB: decB.summary,
					changedA: decA.changed,
					changedB: decB.changed,
				});
			}
		}

		return { pack, replayA, replayB, divergence };
	}

	private async loadVersion(input: DiffInput, version: number): Promise<RulePackDocument> {
		const all = await this.packs.listVersions(input.category, input.tenantId, input.packId);
		const pack = all.find(p => p.version === version);
		if (!pack) {
			throw new Error(
				`Pack '${input.packId}' v${version} not found for tenant '${input.tenantId}' in category '${input.category}'.`,
			);
		}
		return pack as RulePackDocument;
	}
}

export function indexByName(rules: unknown[]): Map<string, unknown> {
	const out = new Map<string, unknown>();
	for (const r of rules) {
		const name = (r as RuleLike)?.name;
		if (typeof name !== 'string' || name.length === 0) continue;
		out.set(name, r);
	}
	return out;
}

export function canonicalize(value: unknown): string {
	return JSON.stringify(value, (_key, v) => {
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			return Object.keys(v).sort().reduce<Record<string, unknown>>((acc, k) => {
				acc[k] = (v as Record<string, unknown>)[k];
				return acc;
			}, {});
		}
		return v;
	});
}

export function compareMetadata(
	a: RulePackDocument,
	b: RulePackDocument,
): Array<{ field: string; before: unknown; after: unknown }> {
	const out: Array<{ field: string; before: unknown; after: unknown }> = [];
	const fields: Array<keyof RulePackDocument['metadata']> = ['name', 'description'];
	for (const f of fields) {
		const va = a.metadata?.[f];
		const vb = b.metadata?.[f];
		if (va !== vb) out.push({ field: `metadata.${String(f)}`, before: va ?? null, after: vb ?? null });
	}
	if (a.createdBy !== b.createdBy) out.push({ field: 'createdBy', before: a.createdBy, after: b.createdBy });
	return out;
}
