/**
 * Vendor Matching Rule Pack — vendor-matching-specific types.
 *
 * As of Phase A of docs/DECISION_ENGINE_RULES_SURFACE.md the underlying
 * storage types live in `decision-rule-pack.types.ts` and are reused across
 * categories (vendor-matching, review-program, firing-rules, axiom-criteria).
 * This file now re-exports those generics with the rule shape pinned to
 * `VendorMatchingRuleDef` so all pre-existing call sites
 * (`import { RulePackDocument } from '.../vendor-matching-rule-pack.types'`)
 * keep compiling unchanged.
 *
 * Slated for removal once Phase C lands and FE/BE consumers have been
 * migrated to the generic API surface.
 */

import type {
  RulePackDocument as GenericRulePackDocument,
  RulePackAuditEntry as GenericRulePackAuditEntry,
  CreateRulePackInput as GenericCreateRulePackInput,
} from './decision-rule-pack.types.js';

/**
 * Single rule shape Prio consumes. Matches the structure baked into
 * mortgage-origination-platform/config/rules/vendor-matching.json and
 * validated by VendorMatchingService::validateRulesJson.
 *
 * This shape is vendor-matching-specific. Other categories define their
 * own rule shape (an Axiom criterion, for instance, has nothing in common
 * with this).
 */
export interface VendorMatchingRuleDef {
  name: string;
  pattern_id: string;
  salience: number;
  description?: string;
  /** JSONLogic condition expression (e.g. {"<": [{"var":"performance_score"}, 80]}). */
  conditions: Record<string, unknown>;
  actions: Array<{
    type: 'assert' | 'retract' | 'modify';
    fact_id: string;
    source: string;
    data: Record<string, unknown>;
  }>;
}

/**
 * Vendor-matching pack — the generic pack with `rules` typed to
 * `VendorMatchingRuleDef[]`. Old call sites that imported `RulePackDocument`
 * from this module continue to receive the same shape they always did.
 */
export type RulePackDocument = GenericRulePackDocument<VendorMatchingRuleDef>;

/** Audit entry shape is identical across categories. */
export type RulePackAuditEntry = GenericRulePackAuditEntry;

/**
 * Vendor-matching create input. The generic `CreateRulePackInput<R>` requires
 * `category`; the vendor-matching shim hardcodes that field at the service
 * layer, so callers never supply it through this type.
 */
export type CreateRulePackInput = Omit<
  GenericCreateRulePackInput<VendorMatchingRuleDef>,
  'category'
>;

// Re-export the generic types under their generic names for callers that
// want to import the broader surface without the vendor-matching binding.
export type {
  DecisionRuleCategory,
} from './decision-rule-pack.types.js';
