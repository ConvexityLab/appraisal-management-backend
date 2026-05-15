/**
 * Decision Rule Pack — generic types backing the Decision Engine Rules Surface
 * (see docs/DECISION_ENGINE_RULES_SURFACE.md, Phase A).
 *
 * Replaces the vendor-matching-specific types in
 * `vendor-matching-rule-pack.types.ts` (which now re-exports from this file).
 *
 * Storage model is unchanged from Phase 3 of the vendor-matching rollout —
 * immutable, versioned packs with append-only audit — but every document
 * now carries a `category` field so a single container can host packs for
 * every decision system the surface manages (vendor matching, review
 * programs, firing rules, Axiom criteria, …).
 *
 * Synthetic id pattern: `${tenantId}__${category}__${packId}__v${version}`
 *   → keeps point-reads partition-scoped and uniqueness intact.
 */

/**
 * Free-form string so new categories can be registered without a type change.
 * Known values today: 'vendor-matching'. Future: 'review-program',
 * 'firing-rules', 'axiom-criteria', etc.
 */
export type DecisionRuleCategory = string;

/**
 * One immutable rule pack version. The active version per
 * (tenantId, category, packId) is the highest-numbered one with
 * status='active'; CRUD writes a new version rather than mutating.
 *
 * Storage container: `decision-rule-packs`, partitioned by `/tenantId`.
 *
 * Generic over the rule shape `R` so each category can express its own
 * rule schema (Prio's RuleDef for vendor-matching today; criteria
 * objects for Axiom; etc.). The container stores them as opaque JSON.
 */
export interface RulePackDocument<R = unknown> {
  id: string;
  type: 'decision-rule-pack';
  category: DecisionRuleCategory;
  tenantId: string;
  packId: string;
  version: number;
  parentVersion: number | null;
  /**
   * 'active'    — currently used by the category's evaluator.
   * 'inactive'  — staged for later activation; not used yet.
   * 'archived'  — historical; kept for replay (Phase D).
   * Only one version per (tenantId, category, packId) is 'active' at any time.
   */
  status: 'active' | 'inactive' | 'archived';
  rules: R[];
  metadata: {
    name?: string;
    description?: string;
  };
  createdAt: string;
  createdBy: string;
}

/**
 * Append-only audit row. Storage container: `decision-rule-audit`,
 * partitioned by `/tenantId`. Document id is a uuid.
 */
export interface RulePackAuditEntry {
  id: string;
  type: 'decision-rule-audit';
  category: DecisionRuleCategory;
  tenantId: string;
  packId: string;
  fromVersion: number | null;
  toVersion: number;
  action: 'create' | 'update' | 'activate' | 'deactivate' | 'archive';
  /**
   * Shallow diff of the rule list, by rule name. Categories that don't have
   * named rules can omit the diff or supply an empty one.
   */
  diff?: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  actor: string;
  reason?: string;
  timestamp: string;
}

/**
 * Public input for creating a new pack version. Excludes the synthesized
 * fields (id, version, parentVersion, createdAt) — those come from the
 * service.
 */
export interface CreateRulePackInput<R = unknown> {
  category: DecisionRuleCategory;
  tenantId: string;
  packId: string;
  rules: R[];
  metadata?: { name?: string; description?: string };
  createdBy: string;
  /** Optional human-readable reason captured in the audit row. */
  reason?: string;
}
