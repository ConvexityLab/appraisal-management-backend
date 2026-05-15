/**
 * Default policy rules — canonical replication of the hardcoded
 * `CasbinAuthorizationEngine.buildQueryFilter()` logic as DB-backed
 * `PolicyRule` documents.
 *
 * USAGE
 *   - `scripts/seed-default-policies.ts` calls `buildDefaultPolicies(tenantId)`
 *     and upserts the returned documents into the `authorization-policies` container.
 *   - `tests/authorization/policy-evaluator-parity.test.ts` imports the same
 *     function to drive mock responses for PolicyEvaluatorService.
 *
 * CONVENTIONS
 *   - OR-alternative conditions for the same (role, resourceType) are modelled
 *     as SEPARATE rules at the same priority (PolicyEvaluatorService OR-joins
 *     allow fragments from independent rules).
 *   - AND-required conditions within a single rule are modelled as MULTIPLE
 *     PolicyCondition entries in one rule's `conditions` array.
 *   - `managedClientIds` / `managedVendorIds` are reachable via the
 *     `accessScope.*` userField path in PolicyEvaluatorService — they are NOT
 *     `boundEntityIds` (those are for external non-platform users per
 *     AUTH_IDENTITY_MODEL_FINAL.md).
 *
 * DIVERGENCES from Casbin (documented for parity-test awareness)
 *   1. `accessScope.canViewAllOrders` / `canViewAllVendors` are not modelled
 *      here.  These special flags were evaluated before the role switch in
 *      Casbin; they should be migrated to explicit admin-granted PolicyRules
 *      or access-scope PATCH operations.
 *   2. Older code paths used the legacy alias `qc_analyst`, but the canonical
 *      `Role` value is `analyst`. These rules use `analyst` only.
 *   3. `supervisor` and `reviewer` have no Casbin rules; they are not seeded
 *      here and will receive `1=0` until explicit rules are added.
 */

import { v4 as uuidv4 } from 'uuid';
import type { PolicyRule } from '../types/policy.types.js';
import type { ResourceType } from '../types/authorization.types.js';

// ─── All resource types — used to build admin catch-all rules ────────────────

const ALL_RESOURCE_TYPES: ResourceType[] = [
  'order', 'client_order', 'vendor_order',
  'vendor', 'access_graph', 'admin_panel', 'ai', 'code', 'qc_review', 'qc_queue',
  'revision', 'escalation', 'analytics',
  'user', 'rov_request', 'arv_analysis',
  'document', 'engagement', 'appraiser',
  'inspection', 'client', 'negotiation',
  'esignature', 'policy',
];

// ─── Builder helpers ─────────────────────────────────────────────────────────

function rule(
  tenantId: string,
  partial: Omit<PolicyRule, 'id' | 'type' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'>,
): PolicyRule {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    type: 'authorization-policy',
    tenantId,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system:seed',
    ...partial,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the full default policy ruleset for a given tenant.
 * All rules are idempotent-safe when upserted by `id`.
 *
 * NOTE: Because PolicyRule.id is a UUID generated here, repeated calls to
 * `buildDefaultPolicies` with the same tenantId will produce NEW ids on each
 * invocation.  The seed script uses an upsert keyed by a deterministic
 * `(tenantId, role, resourceType, description)` selector — see
 * `scripts/seed-default-policies.ts`.
 */
export function buildDefaultPolicies(tenantId: string): PolicyRule[] {
  const rules: PolicyRule[] = [];

  // ── Admin: unconditional allow on every resource type ──────────────────────
  // Includes the coarse 'manage' action so admin-only routes (policy CRUD,
  // group-role mappings) gated by `authorize('policy', 'manage')` pass for
  // admin without needing a separate per-resource policy.
  for (const rt of ALL_RESOURCE_TYPES) {
    rules.push(rule(tenantId, {
      role: 'admin',
      resourceType: rt,
      actions: ['read', 'create', 'update', 'delete', 'execute', 'approve', 'reject', 'manage'],
      conditions: [{ attribute: 'id', operator: 'any' }],
      effect: 'allow',
      priority: 1000,
      description: `admin: unconditional access to ${rt}`,
    }));
  }

  // ── Manager: order ─────────────────────────────────────────────────────────
  // Rule 1 of 3: team-based access
  rules.push(rule(tenantId, {
    role: 'manager',
    resourceType: 'order',
    actions: ['read', 'create', 'update', 'approve', 'reject'],
    conditions: [{ attribute: 'accessControl.teamId', operator: 'in', userField: 'accessScope.teamIds' }],
    effect: 'allow',
    priority: 100,
    description: 'manager: order access by teamId',
  }));
  // Rule 2 of 3: client-based access
  rules.push(rule(tenantId, {
    role: 'manager',
    resourceType: 'order',
    actions: ['read', 'create', 'update', 'approve', 'reject'],
    conditions: [{ attribute: 'accessControl.clientId', operator: 'in', userField: 'accessScope.managedClientIds' }],
    effect: 'allow',
    priority: 100,
    description: 'manager: order access by clientId',
  }));
  // Rule 3 of 3: department-based access
  rules.push(rule(tenantId, {
    role: 'manager',
    resourceType: 'order',
    actions: ['read', 'create', 'update', 'approve', 'reject'],
    conditions: [{ attribute: 'accessControl.departmentId', operator: 'in', userField: 'accessScope.departmentIds' }],
    effect: 'allow',
    priority: 100,
    description: 'manager: order access by departmentId',
  }));

  // ── Manager: vendor ─────────────────────────────────────────────────────────
  // Matches vendor doc `id` against manager's managedVendorIds list.
  rules.push(rule(tenantId, {
    role: 'manager',
    resourceType: 'vendor',
    actions: ['read', 'approve', 'reject'],
    conditions: [{ attribute: 'id', operator: 'in', userField: 'accessScope.managedVendorIds' }],
    effect: 'allow',
    priority: 100,
    description: 'manager: vendor access by managedVendorIds',
  }));

  // ── Manager: engagement ─────────────────────────────────────────────────────
  rules.push(rule(tenantId, {
    role: 'manager',
    resourceType: 'engagement',
    actions: ['read'],
    conditions: [{ attribute: 'client.clientId', operator: 'in', userField: 'accessScope.managedClientIds' }],
    effect: 'allow',
    priority: 100,
    description: 'manager: engagement access by client.clientId',
  }));

  // ── Manager: qc_review ──────────────────────────────────────────────────────
  rules.push(rule(tenantId, {
    role: 'manager',
    resourceType: 'qc_review',
    actions: ['read', 'approve', 'reject'],
    conditions: [{ attribute: 'accessControl.teamId', operator: 'in', userField: 'accessScope.teamIds' }],
    effect: 'allow',
    priority: 100,
    description: 'manager: qc_review access by teamId',
  }));

  // ── Analyst: assigned items ────────────────────────────────────────────────
  const analystAssignedResources: ResourceType[] = ['order', 'qc_review', 'revision', 'escalation'];
  for (const rt of analystAssignedResources) {
    rules.push(rule(tenantId, {
      role: 'analyst',
      resourceType: rt,
      actions: ['read', 'update'],
      conditions: [{ attribute: 'accessControl.assignedUserIds', operator: 'is_assigned' }],
      effect: 'allow',
      priority: 100,
      description: `analyst: ${rt} access when assigned`,
    }));
  }
  // Queue: readable by all analysts
  rules.push(rule(tenantId, {
    role: 'analyst',
    resourceType: 'qc_queue',
    actions: ['read'],
    conditions: [{ attribute: 'id', operator: 'any' }],
    effect: 'allow',
    priority: 100,
    description: 'analyst: qc_queue always readable',
  }));
  rules.push(rule(tenantId, {
    role: 'analyst',
    resourceType: 'engagement',
    actions: ['read'],
    conditions: [{ attribute: 'tenantId', operator: 'in', userField: 'tenantId' }],
    effect: 'allow',
    priority: 100,
    description: 'analyst: engagement access by tenantId',
  }));

  // ── Manager: engagement ─────────────────────────────────────────────────────
  // Rule 1 of 3: team-based access
  rules.push(rule(tenantId, {
    role: 'manager',
    resourceType: 'engagement',
    actions: ['read', 'create', 'update', 'approve', 'reject'],
    conditions: [{ attribute: 'accessControl.teamId', operator: 'in', userField: 'accessScope.teamIds' }],
    effect: 'allow',
    priority: 100,
    description: 'manager: engagement access by teamId',
  }));
  // Rule 2 of 3: client-based access
  rules.push(rule(tenantId, {
    role: 'manager',
    resourceType: 'engagement',
    actions: ['read', 'create', 'update', 'approve', 'reject'],
    conditions: [{ attribute: 'accessControl.clientId', operator: 'in', userField: 'accessScope.managedClientIds' }],
    effect: 'allow',
    priority: 100,
    description: 'manager: engagement access by clientId',
  }));
  // Rule 3 of 3: department-based access
  rules.push(rule(tenantId, {
    role: 'manager',
    resourceType: 'engagement',
    actions: ['read', 'create', 'update', 'approve', 'reject'],
    conditions: [{ attribute: 'accessControl.departmentId', operator: 'in', userField: 'accessScope.departmentIds' }],
    effect: 'allow',
    priority: 100,
    description: 'manager: engagement access by departmentId',
  }));

  // ── Analyst: engagement (assigned only) ─────────────────────────────────────
  rules.push(rule(tenantId, {
    role: 'analyst',
    resourceType: 'engagement',
    actions: ['read', 'update'],
    conditions: [{ attribute: 'accessControl.assignedUserIds', operator: 'is_assigned' }],
    effect: 'allow',
    priority: 100,
    description: 'analyst: engagement access when assigned',
  }));

  // ── Appraiser: owned or assigned ────────────────────────────────────────────
  const appraiserResources: ResourceType[] = ['order', 'revision', 'qc_review', 'escalation'];
  for (const rt of appraiserResources) {
    // Rule A: owner
    rules.push(rule(tenantId, {
      role: 'appraiser',
      resourceType: rt,
      actions: ['read', 'update'],
      conditions: [{ attribute: 'accessControl.ownerId', operator: 'is_owner' }],
      effect: 'allow',
      priority: 100,
      description: `appraiser: ${rt} access as owner`,
    }));
    // Rule B: assigned
    rules.push(rule(tenantId, {
      role: 'appraiser',
      resourceType: rt,
      actions: ['read', 'update'],
      conditions: [{ attribute: 'accessControl.assignedUserIds', operator: 'is_assigned' }],
      effect: 'allow',
      priority: 100,
      description: `appraiser: ${rt} access when assigned`,
    }));
  }
  rules.push(rule(tenantId, {
    role: 'appraiser',
    resourceType: 'engagement',
    actions: ['read'],
    conditions: [{ attribute: 'tenantId', operator: 'in', userField: 'tenantId' }],
    effect: 'allow',
    priority: 100,
    description: 'appraiser: engagement access by tenantId',
  }));

  rules.push(rule(tenantId, {
    role: 'supervisor',
    resourceType: 'engagement',
    actions: ['read'],
    conditions: [{ attribute: 'tenantId', operator: 'in', userField: 'tenantId' }],
    effect: 'allow',
    priority: 100,
    description: 'supervisor: engagement access by tenantId',
  }));

  rules.push(rule(tenantId, {
    role: 'reviewer',
    resourceType: 'engagement',
    actions: ['read'],
    conditions: [{ attribute: 'tenantId', operator: 'in', userField: 'tenantId' }],
    effect: 'allow',
    priority: 100,
    description: 'reviewer: engagement access by tenantId',
  }));

  return rules;
}

/**
 * Returns only the rules for a specific (role, resourceType) pair.
 * Convenient for mocking in tests.
 */
export function filterRules(
  rules: PolicyRule[],
  role: string,
  resourceType: string,
): PolicyRule[] {
  return rules.filter(r => r.role === role && r.resourceType === resourceType && r.type === 'authorization-policy');
}
