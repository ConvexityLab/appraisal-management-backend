/**
 * Seed Module: User Profiles
 *
 * Seeds UserProfile documents into the `users` Cosmos container for local dev/test.
 * Covers all three portal domains and the roles defined in AUTH_IDENTITY_MODEL_FINAL.md.
 *
 * Identity model: role × portalDomain + attributes
 *   platform domain  → [] boundEntityIds; scope via accessScope
 *   vendor domain    → isInternal: true  → [] boundEntityIds (internal staff)
 *                    → isInternal: false → [vendorId(s)]  (external contractors)
 *   client domain    → [clientId(s)] of the lender
 *
 * Container: users (partition /tenantId)
 * Depends on: vendors module (VENDOR_IDS), clients module (CLIENT_IDS)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer, daysAgo } from '../seed-types.js';
import { USER_IDS, VENDOR_IDS, CLIENT_IDS, INTERNAL_STAFF_IDS } from '../seed-ids.js';
// CLIENT_IDS and VENDOR_IDS are used only in boundEntityIds (identity facts) — never in accessScope

const CONTAINER = 'users';

function buildUserProfiles(tenantId: string): Record<string, unknown>[] {
  const now = new Date().toISOString();

  // ── Helper to build a minimal but complete AccessScope ──────────────────────
  function scope(overrides: Record<string, unknown> = {}) {
    return {
      teamIds: [],
      departmentIds: [],
      ...overrides,
    };
  }

  return [
    // ────────────────────────────────────────────────────────────────────────
    // PLATFORM DOMAIN
    // ────────────────────────────────────────────────────────────────────────

    {
      id: USER_IDS.PLATFORM_ADMIN,
      email: 'admin@internal.visionvmc.com',
      name: 'Platform Admin',
      tenantId,
      role: 'admin',
      portalDomain: 'platform',
      boundEntityIds: [],
      isActive: true,
      accessScope: scope({ canViewAllOrders: true, canViewAllVendors: true, canOverrideQC: true }),
      // NOTE: client access governed by policy rules, NOT by managedClientIds in the user record
      createdAt: daysAgo(365),
      updatedAt: daysAgo(1),
    },

    {
      id: USER_IDS.PLATFORM_MANAGER_OPS,
      email: 'ops.manager@internal.visionvmc.com',
      name: 'Operations Manager',
      tenantId,
      role: 'manager',
      portalDomain: 'platform',
      boundEntityIds: [],
      isActive: true,
      accessScope: scope({
        teamIds: ['team-east'],
        canViewAllOrders: false,
        canViewAllVendors: true,
      }),
      createdAt: daysAgo(300),
      updatedAt: daysAgo(2),
    },

    // ── David Russo + Doug Reid (real users) ────────────────────────────────
    // Both carry the `confidential:read` extra scope so they see the trusted-
    // vendor + confidential-classifications fields that the BE vendor
    // serializer strips for everyone else. Other managers do NOT get this
    // scope — it's a deliberately narrow grant per the David/Doug meeting
    // ("we can add a field or two that will only be seen by David and Doug").
    {
      id: 'platform-user-david-russo',
      email: 'david@visionvmc.com',
      name: 'David Russo',
      tenantId,
      role: 'manager',
      portalDomain: 'platform',
      boundEntityIds: [],
      isActive: true,
      accessScope: scope({
        canViewAllOrders: true,
        canViewAllVendors: true,
        extraScopes: ['confidential:read'],
      }),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },

    {
      id: 'platform-user-doug-reid',
      email: 'doug@visionvmc.com',
      name: 'Doug Reid',
      tenantId,
      role: 'manager',
      portalDomain: 'platform',
      boundEntityIds: [],
      isActive: true,
      accessScope: scope({
        canViewAllOrders: true,
        canViewAllVendors: true,
        extraScopes: ['confidential:read'],
      }),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },

    {
      id: USER_IDS.PLATFORM_QC_ANALYST,
      email: 'qc.analyst@internal.visionvmc.com',
      name: 'QC Analyst',
      tenantId,
      role: 'analyst',
      portalDomain: 'platform',
      boundEntityIds: [],
      isActive: true,
      accessScope: scope({ teamIds: ['team-qc'], canViewAllOrders: true }),
      createdAt: daysAgo(240),
      updatedAt: daysAgo(1),
    },

    {
      id: USER_IDS.PLATFORM_SUPERVISOR,
      email: 'supervisor@internal.visionvmc.com',
      name: 'Platform Supervisor',
      tenantId,
      role: 'supervisor',
      portalDomain: 'platform',
      boundEntityIds: [],
      isActive: true,
      accessScope: scope({
        teamIds: ['team-east'],
        canViewAllOrders: true,
        canViewAllVendors: true,
        canOverrideQC: true,
      }),
      createdAt: daysAgo(500),
      updatedAt: daysAgo(1),
    },

    // ────────────────────────────────────────────────────────────────────────
    // VENDOR DOMAIN — INTERNAL STAFF (isInternal: true)
    // These users have vendor-domain sessions but are platform employees who
    // bypass the bid loop and get expanded read access per policy.
    // Their operational identity lives in the vendors container (INTERNAL_STAFF_IDS).
    // ────────────────────────────────────────────────────────────────────────

    {
      id: USER_IDS.VENDOR_SARAH_CHEN,
      // Links to the vendors-container record for workflow dispatch
      vendorContainerRef: INTERNAL_STAFF_IDS.SARAH_CHEN_TX_APPRAISER,
      email: 'sarah.chen@internal.com',
      name: 'Sarah Chen',
      tenantId,
      role: 'appraiser',
      portalDomain: 'vendor',
      boundEntityIds: [],   // internal staff — scoped by isInternal, not by firm id
      isInternal: true,
      isActive: true,
      accessScope: scope({ teamIds: ['team-appraisers-tx'], statesCovered: ['TX'] }),
      createdAt: daysAgo(900),
      updatedAt: daysAgo(1),
    },

    {
      id: USER_IDS.VENDOR_JAMES_OKONKWO,
      vendorContainerRef: INTERNAL_STAFF_IDS.JAMES_OKONKWO_TX_REVIEWER,
      email: 'james.okonkwo@internal.com',
      name: 'James Okonkwo',
      tenantId,
      role: 'reviewer',
      portalDomain: 'vendor',
      boundEntityIds: [],
      isInternal: true,
      isActive: true,
      accessScope: scope({ teamIds: ['team-reviewers-tx'], statesCovered: ['TX'] }),
      createdAt: daysAgo(1100),
      updatedAt: daysAgo(1),
    },

    {
      id: USER_IDS.VENDOR_DIANA_MORALES,
      vendorContainerRef: INTERNAL_STAFF_IDS.DIANA_MORALES_TX_SUPERVISOR,
      email: 'diana.morales@internal.com',
      name: 'Diana Morales',
      tenantId,
      role: 'supervisor',
      portalDomain: 'vendor',
      boundEntityIds: [],
      isInternal: true,
      isActive: true,
      accessScope: scope({
        teamIds: ['team-appraisers-tx', 'team-reviewers-tx'],
        statesCovered: ['TX'],
        canOverrideQC: true,
      }),
      createdAt: daysAgo(1200),
      updatedAt: daysAgo(1),
    },

    // ────────────────────────────────────────────────────────────────────────
    // VENDOR DOMAIN — EXTERNAL CONTRACTORS
    // boundEntityIds contains the vendor firm(s) this user works for.
    // Policy: bound_entity_in → doc.accessControl.vendorId IN user.boundEntityIds
    // ────────────────────────────────────────────────────────────────────────

    {
      id: USER_IDS.VENDOR_PREMIER_COORD,
      email: 'coordinator@premierappraisal.com',
      name: 'Premier Coordinator',
      tenantId,
      role: 'manager',
      portalDomain: 'vendor',
      boundEntityIds: [VENDOR_IDS.PREMIER],
      isInternal: false,
      isActive: true,
      // boundEntityIds carries the firm binding; policy engine uses that — no managedVendorIds in user record
      accessScope: scope(),
      createdAt: daysAgo(400),
      updatedAt: daysAgo(1),
    },

    {
      id: USER_IDS.VENDOR_PREMIER_APR,
      email: 'michael.thompson@premierappraisal.com',
      name: 'Michael Thompson',
      tenantId,
      role: 'appraiser',
      portalDomain: 'vendor',
      boundEntityIds: [VENDOR_IDS.PREMIER],
      isInternal: false,
      isActive: true,
      accessScope: scope({ statesCovered: ['TX'] }),
      createdAt: daysAgo(350),
      updatedAt: daysAgo(2),
    },

    // ────────────────────────────────────────────────────────────────────────
    // CLIENT DOMAIN
    // boundEntityIds contains the client firm(s) this user belongs to.
    // Policy: bound_entity_in → doc.accessControl.clientId IN user.boundEntityIds
    // ────────────────────────────────────────────────────────────────────────

    {
      id: USER_IDS.CLIENT_FH_ADMIN,
      email: 'admin@firsthorizon.example.com',
      name: 'First Horizon Admin',
      tenantId,
      role: 'manager',
      portalDomain: 'client',
      boundEntityIds: [CLIENT_IDS.FIRST_HORIZON],
      isActive: true,
      // Policy engine enforces client scoping via boundEntityIds — no managedClientIds on user record
      accessScope: scope(),
      createdAt: daysAgo(200),
      updatedAt: daysAgo(1),
    },

    {
      id: USER_IDS.CLIENT_FH_READONLY,
      email: 'viewer@firsthorizon.example.com',
      name: 'First Horizon Read-Only',
      tenantId,
      role: 'analyst',
      portalDomain: 'client',
      boundEntityIds: [CLIENT_IDS.FIRST_HORIZON],
      isActive: true,
      // 'analyst' + 'client' domain policy grants read-only — no writes permitted
      accessScope: scope(),
      createdAt: daysAgo(180),
      updatedAt: daysAgo(3),
    },
  ];
}

export const module: SeedModule = {
  name: 'users',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    for (const profile of buildUserProfiles(ctx.tenantId)) {
      await upsert(ctx, CONTAINER, profile, result);
    }

    return result;
  },
};
