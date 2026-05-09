/**
 * Vendor Matching Rule Pack — types
 *
 * AMS-side storage for per-tenant rule packs that drive the MOP vendor-
 * matching evaluator (Phase 3 of docs/AUTO_ASSIGNMENT_REVIEW.md).
 *
 * Storage model (decision §13.4 D2 — revised, see rev 5 of the doc):
 *   - Immutable, versioned rule packs. Editing creates a new version; the
 *     previous version stays in Cosmos for replay (Phase 6).
 *   - Append-only audit log records every CRUD action with a diff.
 *   - AMS owns storage; MOP caches compiled reasoners and is told about
 *     new versions via PUT /api/v1/vendor-matching/tenants/:tid/rules.
 */

/**
 * Single rule shape Prio consumes. Matches the structure baked into
 * mortgage-origination-platform/config/rules/vendor-matching.json and
 * validated by VendorMatchingService::validateRulesJson.
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
 * One immutable rule pack version. The active version per (tenantId, packId)
 * is the highest-numbered one with status='active'; CRUD writes a new version
 * rather than mutating the existing document.
 *
 * Storage container: `vendor-matching-rule-packs`, partitioned by `/tenantId`.
 * Synthetic id: `${tenantId}__${packId}__v${version}` so listing all versions
 * for a tenant + pack is a single point-read on the partition.
 */
export interface RulePackDocument {
  id: string;
  type: 'vendor-matching-rule-pack';
  tenantId: string;
  /**
   * Logical name for the pack. 'default' is the per-tenant pack consumed by
   * MOP at evaluation time; future scopes (per-product, per-region) can use
   * other packIds.
   */
  packId: string;
  version: number;
  parentVersion: number | null;
  /**
   * 'active'    — currently used by MOP for evaluations of this tenant.
   * 'inactive'  — staged for later activation; not used yet.
   * 'archived'  — historical; kept for replay (Phase 6).
   * Only one version per (tenantId, packId) is 'active' at any time.
   */
  status: 'active' | 'inactive' | 'archived';
  rules: VendorMatchingRuleDef[];
  metadata: {
    name?: string;
    description?: string;
  };
  createdAt: string;
  createdBy: string;
}

/**
 * Append-only audit row. Storage container: `vendor-matching-rule-audit`,
 * partitioned by `/tenantId`. Document id is a uuid.
 */
export interface RulePackAuditEntry {
  id: string;
  type: 'vendor-matching-rule-audit';
  tenantId: string;
  packId: string;
  fromVersion: number | null;
  toVersion: number;
  action: 'create' | 'update' | 'activate' | 'deactivate' | 'archive';
  /**
   * Shallow diff of the rule list. `added`/`removed`/`modified` reference
   * rules by name (which is unique within a pack — enforced by the C++
   * schema validator).
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
export interface CreateRulePackInput {
  tenantId: string;
  packId: string;
  rules: VendorMatchingRuleDef[];
  metadata?: { name?: string; description?: string };
  createdBy: string;
  /** Optional human-readable reason captured in the audit row. */
  reason?: string;
}
