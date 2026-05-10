/**
 * AxiomCriteriaCategory — fourth live Decision Engine category.
 *
 * Phase H of docs/DECISION_ENGINE_RULES_SURFACE.md. Operators author per-tenant
 * Axiom evaluation criteria — the questions/checks Axiom runs against
 * documents.
 *
 * MVP scope:
 *   - Storage works (criteria packs persist via the generic
 *     `decision-rule-packs` container with `category='axiom-criteria'`).
 *   - validateRules: shape parity with the other Prio-style categories so
 *     the JSON editor accepts the same rule envelope. The actual criteria
 *     content lives in `actions[0].data` for now (text + expected answer
 *     + rubric); a Phase H polish PR will swap in a custom editor with
 *     criteria-shaped inputs.
 *   - push / preview / replay / analytics are NOT wired here. Axiom is an
 *     LLM evaluator with a fundamentally different paradigm than Prio;
 *     the integration design is Phase H polish work. The controller
 *     surfaces 501 for those endpoints; the FE Sandbox + Analytics tabs
 *     render an empty state explaining the upstream evaluator is pending.
 */

import type { CategoryDefinition } from '../category-definition.js';
import { validatePrioRulePack } from '../shared/prio-rule-validator.js';

export const AXIOM_CRITERIA_CATEGORY_ID = 'axiom-criteria';

export function buildAxiomCriteriaCategory(): CategoryDefinition {
  return {
    id: AXIOM_CRITERIA_CATEGORY_ID,
    label: 'Axiom Criteria',
    description:
      "CRUD over Axiom's document evaluation criteria. Custom criteria-shaped editor (text + expected answer + rubric) lands as Phase H polish.",
    icon: 'heroicons-outline:beaker',
    validateRules: validatePrioRulePack,
    // push / preview / replay / analytics deferred — Axiom integration is
    // Phase H polish work (different paradigm than Prio).
  };
}
