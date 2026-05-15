/**
 * UadCompliancePackResolver
 *
 * Layers BASE → CLIENT UAD-compliance packs into a single resolved
 * (configMap, customRules) pair that the evaluator consumes. Mirrors
 * the BASE/CLIENT overlay pattern from ScorecardRollupProfileService —
 * but stays inside the generic Decision Engine pack store rather than
 * introducing a new container.
 *
 * Scope encoding via packId convention:
 *   - BASE pack:     packId = 'BASE'                — tenant-wide default
 *   - CLIENT pack:   packId = `client:${clientId}`  — per-client carve-out
 *
 * Overlay semantics:
 *   - configMap (built-in overrides): CLIENT entries replace BASE entries
 *     whole by rule id (we don't field-merge — admins authoring a CLIENT
 *     override are stating the complete config for that rule).
 *   - customRules: CLIENT-defined custom rules are unioned with BASE
 *     custom rules. A CLIENT custom rule with the same id as a BASE
 *     custom rule replaces the BASE one whole (same WHOLE-replace
 *     semantics; no per-field merge).
 *
 * Why packId convention rather than a new "scope" column on the pack
 * doc: zero schema changes, audit/replay/versioning all work out of the
 * box, and the generic /api/decision-engine/rules/uad-compliance surface
 * already supports multi-packId per tenant. The price is a string
 * convention; documented here so it stays consistent.
 */

import type { DecisionRulePackService } from '../../decision-rule-pack.service.js';
import {
	partitionPackRules,
	type UadCustomRule,
	type UadPackRule,
	type UadRuleConfigMap,
} from '../../uad-compliance-evaluator.service.js';
import { UAD_COMPLIANCE_CATEGORY_ID } from './uad-compliance.category.js';
import { Logger } from '../../../utils/logger.js';

export const UAD_BASE_PACK_ID = 'BASE';

/** Build the client-scoped packId from a clientId. Exported so admin tools build matching ids. */
export function clientPackId(clientId: string): string {
	return `client:${clientId}`;
}

export interface UadCompliancePackResolution {
	/** Built-in-rule overrides to hand to evaluator.evaluate(). Empty when neither pack exists. */
	configMap: UadRuleConfigMap;
	/** Admin-authored custom rules (JSONLogic predicates), unioned across BASE + CLIENT. */
	customRules: UadCustomRule[];
	/** Doc ids of every pack that contributed, BASE first then CLIENT. */
	appliedPackIds: string[];
}

export class UadCompliancePackResolver {
	private readonly logger = new Logger('UadCompliancePackResolver');

	constructor(private readonly packs: DecisionRulePackService) {}

	async resolve(input: { tenantId: string; clientId?: string }): Promise<UadCompliancePackResolution> {
		const { tenantId, clientId } = input;

		// Load BASE + CLIENT (when applicable) in parallel; both are best-effort.
		const [basePack, clientPack] = await Promise.all([
			this.loadActive(tenantId, UAD_BASE_PACK_ID),
			clientId ? this.loadActive(tenantId, clientPackId(clientId)) : Promise.resolve(null),
		]);

		const appliedPackIds: string[] = [];
		let configMap: UadRuleConfigMap = {};
		const customByRuleId = new Map<string, UadCustomRule>();

		if (basePack && Array.isArray(basePack.rules)) {
			const parts = partitionPackRules(basePack.rules);
			configMap = parts.configMap;
			for (const rule of parts.customRules) customByRuleId.set(rule.id, rule);
			appliedPackIds.push(basePack.id);
		}
		if (clientPack && Array.isArray(clientPack.rules)) {
			const parts = partitionPackRules(clientPack.rules);
			// Built-in override entries: CLIENT replaces BASE whole per rule id.
			configMap = { ...configMap, ...parts.configMap };
			// Custom rules: CLIENT replaces BASE whole per rule id.
			for (const rule of parts.customRules) customByRuleId.set(rule.id, rule);
			appliedPackIds.push(clientPack.id);
		}

		return {
			configMap,
			customRules: Array.from(customByRuleId.values()),
			appliedPackIds,
		};
	}

	private async loadActive(tenantId: string, packId: string) {
		try {
			return await this.packs.getActive<UadPackRule>(
				UAD_COMPLIANCE_CATEGORY_ID,
				tenantId,
				packId,
			);
		} catch (err) {
			this.logger.warn('UAD pack lookup failed; treating as absent', {
				tenantId,
				packId,
				error: err instanceof Error ? err.message : String(err),
			});
			return null;
		}
	}
}
