/**
 * ReviewProgramCategory — second live Decision Engine category.
 *
 * Phase F of docs/DECISION_ENGINE_RULES_SURFACE.md. Operators author per-tenant
 * rules that route a submitted appraisal to a review program (desk / field /
 * full-scope) based on report fields, appraiser context, and order context.
 *
 * MVP scope:
 *   - Storage works (rules persist via the generic `decision-rule-packs`
 *     container, partitioned by /tenantId, with `category='review-program'`).
 *   - validateRules uses the shared Prio validator (rules are MOP-shaped).
 *   - push / preview / replay / analytics are NOT wired here yet — those
 *     require a `review-program` Prio program registered MOP-side and a
 *     `review-program-decisions` trace store. The controller surfaces 501
 *     for those endpoints; the FE Sandbox + Analytics tabs render an
 *     empty state indicating the upstream evaluator hasn't shipped yet.
 *
 * Phase F polish (separate work) wires the upstream evaluator and trace
 * store; everything else (CRUD / audit / version history) is already
 * inherited from the generic Decision Engine surface.
 */

import type { CategoryDefinition } from '../category-definition.js';
import { validatePrioRulePack } from '../shared/prio-rule-validator.js';

export const REVIEW_PROGRAM_CATEGORY_ID = 'review-program';

export function buildReviewProgramCategory(): CategoryDefinition {
  return {
    id: REVIEW_PROGRAM_CATEGORY_ID,
    label: 'Review Programs',
    description:
      'Rules that route a submitted appraisal to a desk / field / full-scope review program based on loan, appraiser, and order context.',
    icon: 'heroicons-outline:clipboard-document-check',
    validateRules: validatePrioRulePack,
    // push / preview / getSeed / drop / replay / analytics intentionally absent.
    // Wiring those is Phase F polish — needs a `review-program` Prio program
    // registered MOP-side + a `review-program-decisions` trace store.
  };
}
