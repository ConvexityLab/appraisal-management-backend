/**
 * FiringRulesCategory — third live Decision Engine category.
 *
 * Phase G of docs/DECISION_ENGINE_RULES_SURFACE.md. Operators author per-tenant
 * rules that put a vendor on probation or fire them based on performance
 * metrics (decline rate, completion rate, scorecard trend, etc.).
 *
 * MVP scope:
 *   - Storage works (rules persist via the generic `decision-rule-packs`
 *     container with `category='firing-rules'`).
 *   - validateRules uses the shared Prio validator (rules are MOP-shaped
 *     even though firing evaluation is recommended to run in-process —
 *     the wire format stays consistent so operators see the same surface).
 *   - push / preview / replay / analytics are NOT wired here yet. Firing
 *     decisions are infrequent (per the doc, an in-process evaluator on
 *     a daily cron is the recommended path). When the evaluator + trace
 *     store ship, those endpoints can be wired without changing this
 *     factory's signature.
 */

import type { CategoryDefinition } from '../category-definition.js';
import { validatePrioRulePack } from '../shared/prio-rule-validator.js';

export const FIRING_RULES_CATEGORY_ID = 'firing-rules';

export function buildFiringRulesCategory(): CategoryDefinition {
  return {
    id: FIRING_RULES_CATEGORY_ID,
    label: 'Firing Rules',
    description:
      'Rules that put a vendor on probation or fire them based on performance metrics (decline rate, completion rate, scorecard trend).',
    icon: 'heroicons-outline:shield-exclamation',
    validateRules: validatePrioRulePack,
    // push / preview / replay / analytics deferred — firing decisions need
    // their own in-process evaluator + `firing-decisions` trace store.
  };
}
