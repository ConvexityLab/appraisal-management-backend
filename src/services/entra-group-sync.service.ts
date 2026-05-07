/**
 * EntraGroupSyncService (Sprint 4)
 *
 * Maps Azure Entra (AAD) group Object IDs present in a user's JWT token to
 * the application `Role` enum by looking up `EntraGroupRoleMapping` documents
 * in the `authorization-policies` Cosmos container.
 *
 * Flow (called by AuthorizationMiddleware after loadUserProfile):
 *   1. If req.user.groups is absent or empty → no-op, return null
 *   2. Fetch all EntraGroupRoleMapping docs for this tenant
 *   3. Find any mapping whose groupObjectId is in the user's groups array
 *   4. Pick the mapped role with the highest priority
 *   5. If that role differs from the UserProfile's current role:
 *        a. Update the `users` container document
 *        b. Write an audit entry to `audit-trail`
 *        c. Return the new role (so middleware can hot-patch req.userProfile)
 *   6. Otherwise return null (no change needed)
 *
 * The `EntraGroupRoleMapping` documents live in `authorization-policies`
 * (same container as PolicyRule / PolicyChangeAuditEntry) with a distinct
 * `type` discriminator so they are easy to query and manage via the policy API.
 *
 * IMPORTANT: NEVER create containers or infrastructure here.
 * The `authorization-policies` container MUST already exist (provisioned by Bicep).
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { Role } from '../types/authorization.types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * `authorization-policies` document that maps a single Entra group OID to a Role.
 * Managed by the policy management API (createPolicyManagementRouter handles
 * GET /api/policies which returns all documents in this container).
 */
export interface EntraGroupRoleMapping {
  id: string;
  type: 'entra-group-role-mapping';
  tenantId: string;
  /** Azure Entra (AAD) group Object ID (UUID string). */
  groupObjectId: string;
  /** The application Role to confer on members of this group. */
  role: Role;
  /**
   * Tiebreak when the user belongs to multiple mapped groups.
   * Higher number wins.  Use distinct values to get deterministic results.
   */
  priority: number;
  description?: string;
}

const CONTAINER = 'authorization-policies';
/** Cache TTL for group mappings per tenant (2 minutes). */
const CACHE_TTL_MS = 120_000;

// ─── Service ─────────────────────────────────────────────────────────────────

export class EntraGroupSyncService {
  private readonly logger: Logger;
  private readonly dbService: CosmosDbService;
  /** Simple per-tenant cache: tenantId → { mappings, expiresAt } */
  private readonly cache = new Map<string, { mappings: EntraGroupRoleMapping[]; expiresAt: number }>();

  constructor(dbService: CosmosDbService) {
    this.logger = new Logger();
    this.dbService = dbService;
  }

  /**
   * Resolve the appropriate role for a user given their Entra group OIDs.
   *
   * - Returns null if no mapped role is found or all matches are identical to `currentRole`.
   * - Returns the new `Role` value if it differs from `currentRole` (and writes the update).
   *
   * Callers MUST patch `req.userProfile.role` with the returned value.
   */
  async syncGroupsToRole(
    userId: string,
    tenantId: string,
    currentRole: Role,
    groupOids: string[],
  ): Promise<Role | null> {
    if (groupOids.length === 0) {
      return null;
    }

    const mappings = await this.loadMappings(tenantId);
    if (mappings.length === 0) {
      return null;
    }

    // Find all mappings that match one of the user's groups, pick the highest priority.
    const matched = mappings
      .filter(m => groupOids.includes(m.groupObjectId))
      .sort((a, b) => b.priority - a.priority);

    if (matched.length === 0) {
      return null;
    }

    const resolvedRole = matched[0]!.role;

    if (resolvedRole === currentRole) {
      return null; // No change — no DB write needed.
    }

    // Role changed — persist the update and emit an audit entry.
    await this.applyRoleChange(userId, tenantId, currentRole, resolvedRole);
    return resolvedRole;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async loadMappings(tenantId: string): Promise<EntraGroupRoleMapping[]> {
    const now = Date.now();
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > now) {
      return cached.mappings;
    }

    try {
      const container = this.dbService.getContainer(CONTAINER);
      const { resources } = await container.items.query<EntraGroupRoleMapping>({
        query: `SELECT * FROM c
                WHERE c.type = 'entra-group-role-mapping'
                  AND c.tenantId = @tenantId`,
        parameters: [{ name: '@tenantId', value: tenantId }],
      }).fetchAll();

      this.cache.set(tenantId, { mappings: resources, expiresAt: now + CACHE_TTL_MS });
      return resources;
    } catch (err) {
      this.logger.error('EntraGroupSyncService: failed to load group-role mappings', { tenantId, error: err });
      return [];
    }
  }

  private async applyRoleChange(
    userId: string,
    tenantId: string,
    previousRole: Role,
    newRole: Role,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    try {
      // Patch the users document using a query-then-upsert pattern (no point read)
      const usersContainer = this.dbService.getContainer('users');
      const { resources } = await usersContainer.items.query<{ id: string; role: Role; [k: string]: unknown }>({
        query: `SELECT * FROM c WHERE c.id = @userId AND c.tenantId = @tenantId`,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@tenantId', value: tenantId },
        ],
      }).fetchAll();

      const existing = resources[0];
      if (existing) {
        await usersContainer.items.upsert({ ...existing, role: newRole, updatedAt: timestamp });
        this.logger.info('EntraGroupSyncService: role updated via group sync', {
          userId, tenantId, previousRole, newRole,
        });
      }

      // Audit entry
      await this.dbService.upsertDocument('audit-trail', {
        id: `entra-sync-${userId}-${Date.now()}`,
        orderId: 'system',
        type: 'entra-group-role-sync',
        userId,
        tenantId,
        previousRole,
        newRole,
        timestamp,
      });
    } catch (err) {
      // Log but do not throw — the sync is best-effort; the resolved in-memory
      // role is still correct for this request.
      this.logger.error('EntraGroupSyncService: failed to persist role change', {
        userId, tenantId, previousRole, newRole, error: err,
      });
    }
  }
}
