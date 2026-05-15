/**
 * Default authorization capability materialization
 *
 * This file defines the DEFAULT `authorization-capability` document content
 * that is seeded into Cosmos for Casbin's coarse capability gate.
 *
 * Runtime Casbin loading reads from Cosmos only. This file exists solely to
 * bootstrap the initial materialization shape; it is not a second runtime
 * policy source.
 */

import type { Role, ResourceType, Action } from '../types/authorization.types.js';
import type { AuthorizationCapabilityDocument } from '../types/policy.types.js';

export interface CapabilityRule {
  role: Role;
  resourceType: ResourceType;
  actions: Action[];
  effect: 'allow' | 'deny';
  enabled?: boolean;
  description: string;
}

/**
 * Shared partition key used for materialized Casbin capabilities.
 * This keeps the coarse capability source centralized in Cosmos while the
 * row-scope rules remain tenant-specific `authorization-policy` documents.
 */
export const AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID = 'platform-capabilities';

const ALL_RESOURCE_TYPES: ResourceType[] = [
  'order', 'client_order', 'vendor_order',
  'vendor', 'access_graph', 'admin_panel', 'ai', 'code', 'qc_review', 'qc_queue',
  'revision', 'escalation', 'analytics',
  'user', 'rov_request', 'arv_analysis',
  'document', 'engagement', 'appraiser',
  'inspection', 'client', 'negotiation',
  'esignature', 'policy',
];

const ALL_ACTIONS: Action[] = ['read', 'create', 'update', 'delete', 'execute', 'approve', 'reject', 'manage'];

function allow(
  role: Role,
  resourceType: ResourceType,
  actions: Action[],
  description: string,
): CapabilityRule {
  return { role, resourceType, actions, effect: 'allow', enabled: true, description };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT AUTHORIZATION CAPABILITY DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_AUTHORIZATION_CAPABILITY_DEFINITIONS: CapabilityRule[] = [

  // ── Admin: unrestricted on all resources ─────────────────────────────────
  ...ALL_RESOURCE_TYPES.map(rt => allow('admin', rt, ALL_ACTIONS, `default capability for admin on ${rt}`)),

  // ── Manager ───────────────────────────────────────────────────────────────
  allow('manager', 'order',         ['read', 'create', 'update', 'approve', 'reject'], 'default capability for manager on order'),
  allow('manager', 'client_order',  ['read', 'create', 'update', 'approve', 'reject'], 'default capability for manager on client_order'),
  allow('manager', 'vendor_order',  ['read', 'create', 'update', 'approve', 'reject'], 'default capability for manager on vendor_order'),
  allow('manager', 'vendor',        ['read', 'update', 'approve', 'reject'], 'default capability for manager on vendor'),
  allow('manager', 'qc_review',     ['read', 'approve', 'reject'], 'default capability for manager on qc_review'),
  allow('manager', 'qc_queue',      ['read'], 'default capability for manager on qc_queue'),
  allow('manager', 'revision',      ['read', 'create', 'update'], 'default capability for manager on revision'),
  allow('manager', 'escalation',    ['read', 'create', 'update', 'approve', 'reject'], 'default capability for manager on escalation'),
  allow('manager', 'analytics',     ['read'], 'default capability for manager on analytics'),
  allow('manager', 'user',          ['read', 'create', 'update'], 'default capability for manager on user'),
  allow('manager', 'document',      ['read', 'create', 'update'], 'default capability for manager on document'),
  allow('manager', 'engagement',    ['read', 'execute'], 'default capability for manager on engagement'),
  allow('manager', 'appraiser',     ['read', 'create', 'update', 'delete'], 'default capability for manager on appraiser'),
  allow('manager', 'inspection',    ['read', 'create', 'update'], 'default capability for manager on inspection'),
  allow('manager', 'client',        ['read', 'create', 'update', 'delete'], 'default capability for manager on client'),
  allow('manager', 'negotiation',   ['read', 'execute'], 'default capability for manager on negotiation'),
  allow('manager', 'esignature',    ['read', 'create', 'delete'], 'default capability for manager on esignature'),
  allow('manager', 'rov_request',   ['read', 'create', 'update'], 'default capability for manager on rov_request'),
  allow('manager', 'arv_analysis',  ['read', 'create', 'update'], 'default capability for manager on arv_analysis'),

  // ── Analyst (canonical role name) ─────────────────────────────────────────
  allow('analyst',  'order',        ['read', 'update'], 'default capability for analyst on order'),
  allow('analyst',  'client_order', ['read', 'update'], 'default capability for analyst on client_order'),
  allow('analyst',  'vendor_order', ['read', 'update'], 'default capability for analyst on vendor_order'),
  allow('analyst',  'qc_review',    ['read', 'create', 'update', 'execute', 'approve', 'reject'], 'default capability for analyst on qc_review'),
  allow('analyst',  'qc_queue',     ['read'], 'default capability for analyst on qc_queue'),
  allow('analyst',  'revision',     ['read', 'create', 'update'], 'default capability for analyst on revision'),
  allow('analyst',  'escalation',   ['read', 'create', 'update'], 'default capability for analyst on escalation'),
  allow('analyst',  'document',     ['read', 'create'], 'default capability for analyst on document'),
  allow('analyst',  'engagement',   ['read'], 'default capability for analyst on engagement'),
  allow('analyst',  'appraiser',    ['read'], 'default capability for analyst on appraiser'),
  allow('analyst',  'inspection',   ['read'], 'default capability for analyst on inspection'),
  allow('analyst',  'client',       ['read'], 'default capability for analyst on client'),
  allow('analyst',  'negotiation',  ['read'], 'default capability for analyst on negotiation'),
  allow('analyst',  'esignature',   ['read'], 'default capability for analyst on esignature'),
  allow('analyst',  'rov_request',  ['read', 'create'], 'default capability for analyst on rov_request'),
  allow('analyst',  'arv_analysis', ['read'], 'default capability for analyst on arv_analysis'),

  // ── Supervisor: management-level read + approve/reject, no create/delete ──
  allow('supervisor', 'order',       ['read', 'approve', 'reject'], 'default capability for supervisor on order'),
  allow('supervisor', 'qc_review',   ['read', 'approve', 'reject'], 'default capability for supervisor on qc_review'),
  allow('supervisor', 'qc_queue',    ['read'], 'default capability for supervisor on qc_queue'),
  allow('supervisor', 'revision',    ['read', 'approve', 'reject'], 'default capability for supervisor on revision'),
  allow('supervisor', 'escalation',  ['read', 'approve', 'reject'], 'default capability for supervisor on escalation'),
  allow('supervisor', 'analytics',   ['read'], 'default capability for supervisor on analytics'),
  allow('supervisor', 'document',    ['read'], 'default capability for supervisor on document'),
  allow('supervisor', 'engagement',  ['read'], 'default capability for supervisor on engagement'),
  allow('supervisor', 'appraiser',   ['read'], 'default capability for supervisor on appraiser'),
  allow('supervisor', 'inspection',  ['read'], 'default capability for supervisor on inspection'),
  allow('supervisor', 'client',      ['read'], 'default capability for supervisor on client'),
  allow('supervisor', 'negotiation', ['read'], 'default capability for supervisor on negotiation'),
  allow('supervisor', 'esignature',  ['read'], 'default capability for supervisor on esignature'),
  allow('supervisor', 'user',        ['read'], 'default capability for supervisor on user'),

  // ── Reviewer: read-only across all primary resources ─────────────────────
  allow('reviewer', 'order',        ['read'], 'default capability for reviewer on order'),
  allow('reviewer', 'client_order', ['read'], 'default capability for reviewer on client_order'),
  allow('reviewer', 'vendor_order', ['read'], 'default capability for reviewer on vendor_order'),
  allow('reviewer', 'qc_review',    ['read'], 'default capability for reviewer on qc_review'),
  allow('reviewer', 'qc_queue',     ['read'], 'default capability for reviewer on qc_queue'),
  allow('reviewer', 'revision',     ['read'], 'default capability for reviewer on revision'),
  allow('reviewer', 'escalation',   ['read'], 'default capability for reviewer on escalation'),
  allow('reviewer', 'document',     ['read'], 'default capability for reviewer on document'),
  allow('reviewer', 'engagement',   ['read'], 'default capability for reviewer on engagement'),
  allow('reviewer', 'appraiser',    ['read'], 'default capability for reviewer on appraiser'),
  allow('reviewer', 'inspection',   ['read'], 'default capability for reviewer on inspection'),
  allow('reviewer', 'client',       ['read'], 'default capability for reviewer on client'),
  allow('reviewer', 'negotiation',  ['read'], 'default capability for reviewer on negotiation'),
  allow('reviewer', 'esignature',   ['read'], 'default capability for reviewer on esignature'),

  // ── Appraiser: scoped to owned/assigned work ──────────────────────────────
  allow('appraiser', 'order',        ['read', 'update'], 'default capability for appraiser on order'),
  allow('appraiser', 'document',     ['read', 'create'], 'default capability for appraiser on document'),
  allow('appraiser', 'revision',     ['read', 'create', 'update'], 'default capability for appraiser on revision'),
  allow('appraiser', 'escalation',   ['read', 'create'], 'default capability for appraiser on escalation'),
  allow('appraiser', 'qc_review',    ['read'], 'default capability for appraiser on qc_review'),
  allow('appraiser', 'engagement',   ['read'], 'default capability for appraiser on engagement'),
  allow('appraiser', 'appraiser',    ['read'], 'default capability for appraiser on appraiser'),
  allow('appraiser', 'inspection',   ['read', 'update'], 'default capability for appraiser on inspection'),
  allow('appraiser', 'client',       ['read'], 'default capability for appraiser on client'),
  allow('appraiser', 'negotiation',  ['read', 'create', 'update'], 'default capability for appraiser on negotiation'),
  allow('appraiser', 'esignature',   ['read', 'create'], 'default capability for appraiser on esignature'),
  allow('appraiser', 'rov_request',  ['read', 'create', 'update'], 'default capability for appraiser on rov_request'),
  allow('appraiser', 'arv_analysis', ['read'], 'default capability for appraiser on arv_analysis'),
];

/**
 * Stable document id for a default capability materialization row.
 */
export function buildAuthorizationCapabilityDocumentId(
  tenantId: string,
  definition: Pick<CapabilityRule, 'role' | 'resourceType' | 'effect'>,
): string {
  return `seed-capability-${tenantId}-${definition.role}-${definition.resourceType}-${definition.effect}`;
}

/**
 * Bootstrap/materialize the default authorization capabilities into Cosmos
 * `authorization-capability` documents.
 */
export function materializeAuthorizationCapabilityDocuments(
  tenantId: string = AUTHORIZATION_CAPABILITY_MATERIALIZATION_TENANT_ID,
  createdBy: string = 'system:seed',
): AuthorizationCapabilityDocument[] {
  const timestamp = new Date().toISOString();

  return DEFAULT_AUTHORIZATION_CAPABILITY_DEFINITIONS.map((definition) => ({
    id: buildAuthorizationCapabilityDocumentId(tenantId, definition),
    type: 'authorization-capability',
    tenantId,
    role: definition.role,
    resourceType: definition.resourceType,
    actions: definition.actions,
    effect: definition.effect,
    enabled: definition.enabled ?? true,
    description: definition.description,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy,
  }));
}
