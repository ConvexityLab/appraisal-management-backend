/**
 * Shared validator for Prio-style rule packs (vendor-matching, review-program,
 * firing-rules, etc.). All three categories use the same wire-format rule
 * shape that MOP's Prio engine consumes:
 *   { name, pattern_id, salience, conditions, actions: [{ type, fact_id, source, data }] }
 *
 * Phase F/G/H of docs/DECISION_ENGINE_RULES_SURFACE.md. Lifts the validator
 * out of vendor-matching.category.ts so each new Prio-backed category can
 * reuse it; categories with their own rule shape (e.g. Axiom criteria, when
 * its custom editor lands in Phase H polish) supply their own validator.
 *
 * Returns { errors, warnings } in the shape `CategoryDefinition.validateRules`
 * expects. Errors block the storage write; warnings surface alongside the
 * success response so operators can see them inline.
 */

import type { CategoryValidationResult } from '../category-definition.js';

interface PrioRuleLike {
  name?: unknown;
  pattern_id?: unknown;
  salience?: unknown;
  conditions?: unknown;
  actions?: unknown;
}

export function validatePrioRulePack(rules: unknown[]): CategoryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(rules) || rules.length === 0) {
    errors.push('Rule pack must contain at least one rule (empty array rejected)');
    return { errors, warnings };
  }

  const names = new Set<string>();
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i] as PrioRuleLike | null | undefined;
    if (!r || typeof r !== 'object') {
      errors.push(`rules[${i}] must be an object`);
      continue;
    }
    if (typeof r.name !== 'string' || r.name.trim() === '') {
      errors.push(`rules[${i}].name is required and must be a non-empty string`);
      continue;
    }
    if (names.has(r.name)) {
      errors.push(`Duplicate rule name "${r.name}" — names must be unique within a pack`);
      continue;
    }
    names.add(r.name);
    if (typeof r.pattern_id !== 'string' || r.pattern_id.trim() === '') {
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
}
