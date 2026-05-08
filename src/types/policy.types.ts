/**
 * DB-backed Policy Types (Phase 3 — Sprint 3)
 *
 * These types represent the Cosmos `authorization-policies` container documents.
 * They replace the hardcoded logic in `casbin-engine.service.ts`; policies are
 * evaluated at runtime by `PolicyEvaluatorService`.
 *
 * Design constraints:
 *  - `boundEntityIds` (NOT `accessScope.managedClientIds`) is used for external
 *    entity scoping.  See AUTH_IDENTITY_MODEL_FINAL.md.
 *  - `PolicyOperator` is sourced from `authorization.types.ts` — DO NOT redefine.
 *  - Every write must also write a `PolicyChangeAuditEntry` for traceability.
 */

import type { PolicyOperator, Role, PortalDomain, ResourceType, Action } from './authorization.types.js';

// ─── Condition ────────────────────────────────────────────────────────────────

/**
 * A single attribute-based constraint that, when combined with other conditions,
 * produces a Cosmos SQL fragment at query time.
 *
 * Examples:
 *   { attribute: 'accessControl.ownerId',    operator: 'is_owner' }
 *   { attribute: 'accessControl.assignedUserIds', operator: 'is_assigned' }
 *   { attribute: 'accessControl.clientId',   operator: 'bound_entity_in' }
 *   { attribute: 'accessControl.teamId',     operator: 'in', userField: 'accessScope.teamIds' }
 *   { attribute: 'status',                   operator: 'eq', staticValue: 'PENDING' }
 */
export interface PolicyCondition {
  /**
   * JSON path of the document field to test (relative to the document root).
   * e.g. 'accessControl.clientId', 'accessControl.teamId', 'status'
   */
  attribute: string;

  /**
   * Semantic operator — see `PolicyOperator` in authorization.types.ts for
   * full semantics.
   */
  operator: PolicyOperator;

  /**
   * For `in` / `contains` / `bound_entity_in` operators: the dot-notation path
   * into the caller's `UserProfile` that holds the comparison set.
   * e.g. 'accessScope.teamIds', 'boundEntityIds'
   *
   * Omit for user-identity operators (`is_owner`, `is_assigned`, `is_internal`, `any`).
   */
  userField?: string;

  /**
   * For `eq` / `in` operators with a static (non-user-derived) comparison value.
   * Only used when the comparison set is a literal list, not a user attribute.
   */
  staticValue?: string | string[];
}

// ─── PolicyRule ───────────────────────────────────────────────────────────────

/**
 * A single access rule stored in Cosmos `authorization-policies`.
 *
 * Evaluation at query time:
 *   1. Load all rules where (tenantId, role, resourceType) matches the caller
 *   2. Filter to rules where `actions` contains the requested action
 *   3. Evaluate each rule's `conditions` against the caller's `UserProfile`
 *   4. Higher `priority` wins on conflict; `deny` beats `allow` at equal priority
 *   5. Compose matching allow-conditions into a SQL WHERE clause with OR
 */
export interface PolicyRule {
  /** Cosmos document id */
  id: string;

  /** Cosmos document type discriminator */
  type: 'authorization-policy';

  /** Partition key */
  tenantId: string;

  /** Optional client-specific scope. When omitted, the rule is tenant-wide. */
  clientId?: string;

  /** Optional sub-client-specific scope. When omitted, the rule is not sub-client constrained. */
  subClientId?: string;

  /** Role this rule applies to */
  role: Role;

  /**
   * Optional: restrict this rule to a specific portal domain.
   * If omitted, the rule applies to all portal domains for the role.
   */
  portalDomain?: PortalDomain;

  /** Resource type this rule governs */
  resourceType: ResourceType;

  /** Actions this rule permits/denies (at least one must match the request) */
  actions: Action[];

  /** Attribute-based conditions; ALL must pass (AND semantics within one rule) */
  conditions: PolicyCondition[];

  /** Whether a match allows or denies access */
  effect: 'allow' | 'deny';

  /** Soft-delete / toggle without document removal. Omitted means enabled. */
  enabled?: boolean;

  /**
   * Higher numbers take precedence. When a deny and an allow rule match at the
   * same priority, deny wins.
   */
  priority: number;

  /** Human-readable description of intent */
  description: string;

  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ─── Capability materialization ────────────────────────────────────────────

/**
 * Coarse capability tuples materialized for Casbin into the same
 * `authorization-policies` container.
 *
 * Unlike `PolicyRule`, these documents answer only the boolean question
 * "can role X perform action Y on resource Z at all?" They do not carry
 * row-scope conditions.
 */
export interface AuthorizationCapabilityDocument {
  /** Cosmos document id */
  id: string;

  /** Cosmos document type discriminator */
  type: 'authorization-capability';

  /** Partition key for the capability materialization partition. */
  tenantId: string;

  role: Role;
  resourceType: ResourceType;
  actions: Action[];
  effect: 'allow' | 'deny';
  enabled?: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ─── Audit trail ─────────────────────────────────────────────────────────────

/**
 * Immutable record of every create / update / delete applied to a `PolicyRule`.
 * Written to Cosmos `authorization-policies` alongside the rule document
 * (different partition may be used for large tenants — same container, type discriminator).
 */
export interface PolicyChangeAuditEntry {
  /** Cosmos document id */
  id: string;

  /** Cosmos document type discriminator */
  type: 'authorization-policy-audit';

  /** Policy document that was changed */
  policyId: string;

  /** Partition key — same as the affected policy */
  tenantId: string;

  /** User who triggered the change */
  actorUserId: string;

  /** Nature of the change */
  changeType: 'create' | 'update' | 'delete';

  /** State of the policy before the change (null for 'create') */
  before?: Partial<PolicyRule>;

  /** State of the policy after the change (null for 'delete') */
  after?: Partial<PolicyRule>;

  /** ISO-8601 timestamp */
  timestamp: string;
}
