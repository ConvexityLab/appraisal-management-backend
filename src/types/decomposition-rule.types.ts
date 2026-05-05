/**
 * DecompositionRule — Cosmos-stored configuration that maps a ClientOrder
 * (productType + scope) to the set of VendorOrders that should be created.
 *
 * Hierarchy:
 *   ClientOrder.placed → OrderDecompositionService.decompose() → VendorOrderSpec[]
 *
 * Cosmos container: `decomposition-rules`
 * Partition key:    /tenantId   (rules can also be tenant-agnostic — see below)
 *
 * Lookup precedence (most specific wins):
 *   1. (tenantId + clientId + productType)   — tenant-and-client override
 *   2. (tenantId + productType)              — tenant default
 *   3. (productType, default: true)          — global default
 *
 * If no rule matches, OrderDecompositionService throws
 * DecompositionRuleMissingError. There is NO silent fallback to a 1-to-1
 * default — operators must seed an explicit rule. See plan §"Open risks".
 */

import type { ProductType } from './product-catalog.js';

// ─── Discriminator + container ───────────────────────────────────────────────

export const DECOMPOSITION_RULE_DOC_TYPE = 'decomposition-rule' as const;

export const DECOMPOSITION_RULES_CONTAINER = 'decomposition-rules' as const;

// ─── Templates ───────────────────────────────────────────────────────────────

/**
 * Template for a single VendorOrder to be created when a matching ClientOrder
 * is placed. The decomposition service populates concrete fields (ids,
 * timestamps, denormalized ancestry) from the ClientOrder at placement time.
 */
export interface VendorOrderTemplate {
  /** Vendor work type — today equal to the ClientOrder's productType. */
  vendorWorkType: ProductType;
  /** Optional: vendor fee for this work item, if known up-front. */
  vendorFee?: number;
  /** Optional: free-form instructions surfaced to the assigned vendor. */
  instructions?: string;
  /**
   * Optional: ids of other VendorOrderTemplate entries (within this rule)
   * that must complete before this one can start. EMPTY today (all parallel);
   * field is reserved for future sequencing without a schema change.
   */
  dependsOn?: string[];
  /**
   * Optional: a stable name for this template entry, used by `dependsOn` to
   * reference siblings within the same rule.
   */
  templateKey?: string;
}

// ─── Rule ────────────────────────────────────────────────────────────────────

/**
 * One decomposition rule. The service picks at most one rule per ClientOrder
 * via the precedence above.
 */
export interface DecompositionRule {
  /** Cosmos document id — recommend `rule-{scope}-{productType}` for readability. */
  id: string;
  /**
   * Partition key.
   *   - For tenant-scoped rules:    tenantId of the owning tenant.
   *   - For global default rules:   sentinel `'__global__'` (rules with
   *                                 default: true must use this value).
   */
  tenantId: string;
  type: typeof DECOMPOSITION_RULE_DOC_TYPE;

  // ── Match criteria ───────────────────────────────────────────────────────
  /** Required — the ClientOrder.productType this rule applies to. */
  productType: ProductType;
  /** Optional — restrict this rule to a specific client within the tenant. */
  clientId?: string;
  /**
   * Optional — marks this row as the global default for the productType.
   * Global defaults MUST set tenantId to '__global__' and omit clientId.
   */
  default?: boolean;

  /**
   * When true, callers MAY materialize this rule's vendorOrders without
   * user confirmation. When false / undefined (default), the rule is
   * advisory only — callers must surface its vendorOrders to a human as
   * suggestions.
   *
   * Phase 1 callers ignore this flag (every rule is a suggestion). A future
   * phase introduces an "auto-place" code path that respects it. Per-rule
   * (not global) so operators can opt low-risk products into auto-placement
   * (e.g. AVM) before higher-risk multi-vendor decompositions.
   */
  autoApply?: boolean;

  // ── Output ───────────────────────────────────────────────────────────────
  /** One or more VendorOrder templates to instantiate. Must be non-empty. */
  vendorOrders: VendorOrderTemplate[];

  // ── Audit ────────────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
  /** Free-form note describing why this rule exists. */
  description?: string;
}

/** Sentinel partition value for global default rules. */
export const GLOBAL_DEFAULT_TENANT = '__global__' as const;
