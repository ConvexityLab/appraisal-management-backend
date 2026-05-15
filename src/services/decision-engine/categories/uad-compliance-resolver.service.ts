/**
 * UadCompliancePackResolver
 *
 * Layers BASE → CLIENT UAD-compliance packs into a single resolved
 * UadRuleConfigMap that the evaluator consumes. Mirrors the BASE/CLIENT
 * overlay pattern from ScorecardRollupProfileService — but stays inside
 * the generic Decision Engine pack store rather than introducing a new
 * container.
 *
 * Scope encoding via packId convention:
 *   - BASE pack:     packId = 'BASE'                — tenant-wide default
 *   - CLIENT pack:   packId = `client:${clientId}`  — per-client carve-out
 *
 * Overlay semantics: the resolved map merges by rule id, with CLIENT
 * entries replacing BASE entries WHOLE (we don't field-merge the per-rule
 * config — admins authoring a CLIENT override are stating the complete
 * config for that rule, including enabled/severityOverride/messageOverride).
 *
 * Why packId convention rather than a new "scope" column on the pack
 * doc: zero schema changes, audit/replay/versioning all work out of the
 * box, and the generic /api/decision-engine/rules/uad-compliance surface
 * already supports multi-packId per tenant. The price is a string
 * convention; documented here so it stays consistent.
 */

import type { DecisionRulePackService } from '../../decision-rule-pack.service.js';
import type {
	UadRuleConfig,
	UadRuleConfigMap,
} from '../../uad-compliance-evaluator.service.js';
import { UAD_COMPLIANCE_CATEGORY_ID, buildConfigMap } from './uad-compliance.category.js';
import { Logger } from '../../../utils/logger.js';

export const UAD_BASE_PACK_ID = 'BASE';

/** Build the client-scoped packId from a clientId. Exported so admin tools build matching ids. */
export function clientPackId(clientId: string): string {
	return `client:${clientId}`;
}

export interface UadCompliancePackResolution {
	/** Configs to hand to evaluator.evaluate(). Empty when neither pack exists. */
	configMap: UadRuleConfigMap;
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

		if (basePack && Array.isArray(basePack.rules)) {
			configMap = buildConfigMap(basePack.rules);
			appliedPackIds.push(basePack.id);
		}
		if (clientPack && Array.isArray(clientPack.rules)) {
			// CLIENT entries replace BASE entries whole — admins authoring a
			// CLIENT override are stating the complete config for that rule.
			const clientMap = buildConfigMap(clientPack.rules);
			configMap = { ...configMap, ...clientMap };
			appliedPackIds.push(clientPack.id);
		}

		return { configMap, appliedPackIds };
	}

	private async loadActive(tenantId: string, packId: string) {
		try {
			return await this.packs.getActive<UadRuleConfig>(
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
