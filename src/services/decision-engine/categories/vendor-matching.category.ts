/**
 * VendorMatchingCategory — first concrete CategoryDefinition.
 *
 * Phase B of docs/DECISION_ENGINE_RULES_SURFACE.md. Wraps the existing
 * `MopRulePackPusher` (push / preview / getSeed / drop) and the existing
 * vendor-matching rule shape into the generic plugin contract so the
 * DecisionEngineRulesController can dispatch into it without knowing
 * anything vendor-matching-specific.
 *
 * Validation here is the SAME light pre-write check the original
 * VendorMatchingRulePackService applied (duplicate names, missing
 * required fields). Heavy semantic validation (recognized fact_ids,
 * action shapes, JSONLogic well-formedness) lives server-side in MOP
 * via VendorMatchingService::validateRulesJson and surfaces on push or
 * preview.
 */

import type {
  CategoryDefinition,
  CategoryPreviewInput,
  CategoryPreviewResult,
  CategoryReplayDiff,
  CategoryReplayInput,
  CategoryValidationResult,
} from '../category-definition.js';
import type { MopRulePackPusher } from '../../mop-rule-pack-pusher.service.js';
import type { RulePackDocument } from '../../../types/decision-rule-pack.types.js';
import type { VendorMatchingRuleDef } from '../../../types/vendor-matching-rule-pack.types.js';

export const VENDOR_MATCHING_CATEGORY_ID = 'vendor-matching';

/**
 * Build the vendor-matching category. The pusher is optional — when MOP
 * isn't configured (local dev without MOP_RULES_BASE_URL) the category
 * still validates and serves CRUD; only the push / preview / seed / drop
 * methods are absent and the controller surfaces 503 for those endpoints.
 */
export function buildVendorMatchingCategory(opts: {
  pusher: MopRulePackPusher | null;
}): CategoryDefinition {
  const { pusher } = opts;

  const definition: CategoryDefinition = {
    id: VENDOR_MATCHING_CATEGORY_ID,
    label: 'Vendor Matching',
    description:
      "Rules that pick which vendors are eligible for an order and how they're scored.",
    icon: 'heroicons-outline:user-group',

    validateRules(rules: unknown[]): CategoryValidationResult {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!Array.isArray(rules) || rules.length === 0) {
        errors.push('Rule pack must contain at least one rule (empty array rejected)');
        return { errors, warnings };
      }

      const names = new Set<string>();
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i] as Partial<VendorMatchingRuleDef> | null | undefined;
        if (!r || typeof r !== 'object') {
          errors.push(`rules[${i}] must be an object`);
          continue;
        }
        if (!r.name || typeof r.name !== 'string') {
          errors.push(`rules[${i}].name is required and must be a non-empty string`);
          continue;
        }
        if (names.has(r.name)) {
          errors.push(`Duplicate rule name "${r.name}" — names must be unique within a pack`);
          continue;
        }
        names.add(r.name);
        if (!r.pattern_id || typeof r.pattern_id !== 'string') {
          errors.push(`rules[${i}].pattern_id is required (rule "${r.name}")`);
        }
        if (typeof r.salience !== 'number') {
          errors.push(`rules[${i}].salience must be a number (rule "${r.name}")`);
        }
        if (!r.conditions || typeof r.conditions !== 'object') {
          errors.push(`rules[${i}].conditions must be an object (rule "${r.name}")`);
        }
        if (!Array.isArray(r.actions) || r.actions.length === 0) {
          errors.push(`rules[${i}].actions must be a non-empty array (rule "${r.name}")`);
        }
      }

      return { errors, warnings };
    },
  };

  if (pusher) {
    definition.push = async (pack: RulePackDocument<unknown>): Promise<void> => {
      // Cast: RulePackDocument<unknown> is structurally compatible with the
      // pusher's expected shape — it accepts any rule type since it serializes
      // to JSON.
      await pusher.push(pack as Parameters<MopRulePackPusher['push']>[0]);
    };

    definition.preview = async (
      input: CategoryPreviewInput,
    ): Promise<CategoryPreviewResult[]> => {
      const result = await pusher.preview({
        rulePack: {
          program: {
            name: `Preview (vendor-matching pack=${input.packId ?? 'default'})`,
            programId: 'vendor-matching',
            version: 'preview',
            description: 'Stateless preview from Decision Engine workspace',
          },
          rules: input.rules,
        },
        evaluations: input.evaluations,
      });
      return result.results.map(r => ({
        eligible: r.eligible,
        scoreAdjustment: r.scoreAdjustment,
        appliedRuleIds: r.appliedRuleIds,
        denyReasons: r.denyReasons,
      }));
    };

    definition.getSeed = async (): Promise<{
      program: Record<string, unknown>;
      rules: unknown[];
    }> => {
      return pusher.getSeed();
    };

    definition.drop = async (tenantId: string): Promise<void> => {
      await pusher.drop(tenantId);
    };
  }

  // Replay deferred to Phase D. The controller surfaces 501 when this is
  // missing, so categories opt-in by implementing it.
  void undefined as unknown as (input: CategoryReplayInput) => Promise<CategoryReplayDiff>;

  return definition;
}
