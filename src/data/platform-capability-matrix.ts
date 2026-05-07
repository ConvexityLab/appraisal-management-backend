/**
 * Platform Capability Matrix
 *
 * Defines what each role is ALLOWED to do on each resource type, platform-wide.
 * This is the authoritative source for the Casbin boolean gate.
 *
 * KEY ARCHITECTURE NOTES:
 *   - These rules are the SAME for every tenant.  They define what a role CAN do
 *     in principle, not which specific rows it can see.
 *   - Per-tenant / per-client / per-subClient row-level scoping is handled
 *     entirely by `PolicyEvaluatorService` using the `authorization-policies`
 *     Cosmos container.
 *   - To add a new resource or change what a role can do, edit this file.
 *     No CSV, no database write, no re-seed required.
 *   - Casbin loads from this constant at startup — pure in-memory, zero I/O.
 */

import type { Role, ResourceType, Action } from '../types/authorization.types.js';

export interface CapabilityRule {
  role: Role;
  resourceType: ResourceType;
  actions: Action[];
  effect: 'allow' | 'deny';
}

const ALL_RESOURCE_TYPES: ResourceType[] = [
  'order', 'client_order', 'vendor_order',
  'vendor', 'qc_review', 'qc_queue',
  'revision', 'escalation', 'analytics',
  'user', 'rov_request', 'arv_analysis',
  'document', 'engagement', 'appraiser',
  'inspection', 'client', 'negotiation',
  'esignature', 'policy',
];

const ALL_ACTIONS: Action[] = ['read', 'create', 'update', 'delete', 'execute', 'approve', 'reject', 'manage'];

function allow(role: Role, resourceType: ResourceType, actions: Action[]): CapabilityRule {
  return { role, resourceType, actions, effect: 'allow' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM CAPABILITY MATRIX
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_CAPABILITY_MATRIX: CapabilityRule[] = [

  // ── Admin: unrestricted on all resources ─────────────────────────────────
  ...ALL_RESOURCE_TYPES.map(rt => allow('admin', rt, ALL_ACTIONS)),

  // ── Manager ───────────────────────────────────────────────────────────────
  allow('manager', 'order',         ['read', 'create', 'update', 'approve', 'reject']),
  allow('manager', 'client_order',  ['read', 'create', 'update', 'approve', 'reject']),
  allow('manager', 'vendor_order',  ['read', 'create', 'update', 'approve', 'reject']),
  allow('manager', 'vendor',        ['read', 'update', 'approve', 'reject']),
  allow('manager', 'qc_review',     ['read', 'approve', 'reject']),
  allow('manager', 'qc_queue',      ['read']),
  allow('manager', 'revision',      ['read', 'create', 'update']),
  allow('manager', 'escalation',    ['read', 'create', 'update', 'approve', 'reject']),
  allow('manager', 'analytics',     ['read']),
  allow('manager', 'user',          ['read', 'create', 'update']),
  allow('manager', 'document',      ['read', 'create', 'update']),
  allow('manager', 'engagement',    ['read', 'execute']),
  allow('manager', 'appraiser',     ['read', 'create', 'update', 'delete']),
  allow('manager', 'inspection',    ['read', 'create', 'update']),
  allow('manager', 'client',        ['read', 'create', 'update', 'delete']),
  allow('manager', 'negotiation',   ['read', 'execute']),
  allow('manager', 'esignature',    ['read', 'create', 'delete']),
  allow('manager', 'rov_request',   ['read', 'create', 'update']),
  allow('manager', 'arv_analysis',  ['read', 'create', 'update']),

  // ── Analyst (canonical role name; was "qc_analyst") ───────────────────────
  allow('analyst',  'order',        ['read', 'update']),
  allow('analyst',  'client_order', ['read', 'update']),
  allow('analyst',  'vendor_order', ['read', 'update']),
  allow('analyst',  'qc_review',    ['read', 'create', 'update', 'execute', 'approve', 'reject']),
  allow('analyst',  'qc_queue',     ['read']),
  allow('analyst',  'revision',     ['read', 'create', 'update']),
  allow('analyst',  'escalation',   ['read', 'create', 'update']),
  allow('analyst',  'document',     ['read', 'create']),
  allow('analyst',  'engagement',   ['read']),
  allow('analyst',  'appraiser',    ['read']),
  allow('analyst',  'inspection',   ['read']),
  allow('analyst',  'client',       ['read']),
  allow('analyst',  'negotiation',  ['read']),
  allow('analyst',  'esignature',   ['read']),
  allow('analyst',  'rov_request',  ['read', 'create']),
  allow('analyst',  'arv_analysis', ['read']),

  // ── Supervisor: management-level read + approve/reject, no create/delete ──
  allow('supervisor', 'order',       ['read', 'approve', 'reject']),
  allow('supervisor', 'qc_review',   ['read', 'approve', 'reject']),
  allow('supervisor', 'qc_queue',    ['read']),
  allow('supervisor', 'revision',    ['read', 'approve', 'reject']),
  allow('supervisor', 'escalation',  ['read', 'approve', 'reject']),
  allow('supervisor', 'analytics',   ['read']),
  allow('supervisor', 'document',    ['read']),
  allow('supervisor', 'engagement',  ['read']),
  allow('supervisor', 'appraiser',   ['read']),
  allow('supervisor', 'inspection',  ['read']),
  allow('supervisor', 'client',      ['read']),
  allow('supervisor', 'negotiation', ['read']),
  allow('supervisor', 'esignature',  ['read']),
  allow('supervisor', 'user',        ['read']),

  // ── Reviewer: read-only across all primary resources ─────────────────────
  allow('reviewer', 'order',        ['read']),
  allow('reviewer', 'client_order', ['read']),
  allow('reviewer', 'vendor_order', ['read']),
  allow('reviewer', 'qc_review',    ['read']),
  allow('reviewer', 'qc_queue',     ['read']),
  allow('reviewer', 'revision',     ['read']),
  allow('reviewer', 'escalation',   ['read']),
  allow('reviewer', 'document',     ['read']),
  allow('reviewer', 'engagement',   ['read']),
  allow('reviewer', 'appraiser',    ['read']),
  allow('reviewer', 'inspection',   ['read']),
  allow('reviewer', 'client',       ['read']),
  allow('reviewer', 'negotiation',  ['read']),
  allow('reviewer', 'esignature',   ['read']),

  // ── Appraiser: scoped to owned/assigned work ──────────────────────────────
  allow('appraiser', 'order',        ['read', 'update']),
  allow('appraiser', 'document',     ['read', 'create']),
  allow('appraiser', 'revision',     ['read', 'create', 'update']),
  allow('appraiser', 'escalation',   ['read', 'create']),
  allow('appraiser', 'qc_review',    ['read']),
  allow('appraiser', 'engagement',   ['read']),
  allow('appraiser', 'appraiser',    ['read']),
  allow('appraiser', 'inspection',   ['read', 'update']),
  allow('appraiser', 'client',       ['read']),
  allow('appraiser', 'negotiation',  ['read', 'create', 'update']),
  allow('appraiser', 'esignature',   ['read', 'create']),
  allow('appraiser', 'rov_request',  ['read', 'create', 'update']),
  allow('appraiser', 'arv_analysis', ['read']),
];
