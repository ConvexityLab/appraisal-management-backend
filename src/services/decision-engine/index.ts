/**
 * Decision Engine module barrel + helper for wiring registry hooks into
 * the DecisionRulePackService at app startup.
 *
 * Phase B of docs/DECISION_ENGINE_RULES_SURFACE.md.
 */

import type { CategoryRegistry } from './category-definition.js';
import type { DecisionRulePackService } from '../decision-rule-pack.service.js';

export {
  CategoryRegistry,
  type CategoryDefinition,
  type CategoryPreviewInput,
  type CategoryPreviewResult,
  type CategoryReplayDiff,
  type CategoryReplayInput,
  type CategoryValidationResult,
} from './category-definition.js';

export {
  buildVendorMatchingCategory,
  VENDOR_MATCHING_CATEGORY_ID,
} from './categories/vendor-matching.category.js';

export {
  buildReviewProgramCategory,
  REVIEW_PROGRAM_CATEGORY_ID,
} from './categories/review-program.category.js';

export {
  buildFiringRulesCategory,
  FIRING_RULES_CATEGORY_ID,
} from './categories/firing-rules.category.js';

export {
  buildAxiomCriteriaCategory,
  AXIOM_CRITERIA_CATEGORY_ID,
} from './categories/axiom-criteria.category.js';

export {
  buildOrderDecompositionCategory,
  ORDER_DECOMPOSITION_CATEGORY_ID,
} from './categories/order-decomposition.category.js';

/**
 * Wire each registered category's `push` method into the
 * DecisionRulePackService as a per-category onNewActivePack hook.
 *
 * Call once at app startup AFTER all categories are registered. Registering
 * a new category later requires re-wiring (or re-registering the hook
 * directly) — but since the registry is built at startup that's a
 * non-issue in practice.
 */
export function wireRegistryHooks(
  registry: CategoryRegistry,
  packs: DecisionRulePackService,
): void {
  for (const cat of registry.list()) {
    if (cat.push) {
      const pushRef = cat.push;
      packs.onNewActivePack(cat.id, async pack => {
        await pushRef(pack);
      });
    }
  }
}
