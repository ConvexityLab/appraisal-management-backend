/**
 * Group-Role Mapping Controller
 *
 * Admin-only API for managing the Entra group OID → application Role mappings
 * that `EntraGroupSyncService` uses to confer roles from Azure AD group
 * membership.
 *
 * Routes (mounted at /api/admin/group-role-mappings):
 *   GET    /           — list all mappings for the caller's tenant
 *   POST   /           — create a new mapping
 *   DELETE /:id        — delete a mapping
 *
 * Access: all routes require role 'admin' (enforced in api-server.ts).
 *
 * Documents are stored in the `authorization-policies` Cosmos container with
 * `type: 'entra-group-role-mapping'` alongside PolicyRule / PolicyChangeAuditEntry.
 * NEVER create the container here — it must already exist (provisioned by Bicep).
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AuthorizedRequest } from '../middleware/authorization.middleware.js';
import { EntraGroupRoleMapping } from '../services/entra-group-sync.service.js';
import type { Role } from '../types/authorization.types.js';

const CONTAINER = 'authorization-policies';

export const createGroupRoleMappingRouter = (dbService: CosmosDbService): Router => {
  const router = Router();
  const logger = new Logger();

  // ── GET / ─────────────────────────────────────────────────────────────────
  /**
   * List all Entra group → role mappings for the caller's tenant.
   */
  router.get('/', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = req.userProfile?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const container = dbService.getContainer(CONTAINER);
      const { resources } = await container.items.query<EntraGroupRoleMapping>({
        query: `SELECT * FROM c
                WHERE c.type = 'entra-group-role-mapping'
                  AND c.tenantId = @tenantId
                ORDER BY c.priority DESC`,
        parameters: [{ name: '@tenantId', value: tenantId }],
      }).fetchAll();

      res.json({ success: true, data: resources });
    } catch (error) {
      logger.error('Failed to list group-role mappings', { error });
      res.status(500).json({ error: 'Failed to list group-role mappings', code: 'INTERNAL_ERROR' });
    }
  });

  // ── POST / ───────────────────────────────────────────────────────────────
  /**
   * Create a new Entra group → role mapping.
   *
   * Body: { groupObjectId: string, role: Role, priority?: number, description?: string }
   */
  router.post('/', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = req.userProfile?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const { groupObjectId, role, priority = 100, description } = req.body as {
        groupObjectId: string;
        role: Role;
        priority?: number;
        description?: string;
      };

      if (!groupObjectId) {
        return res.status(400).json({ error: 'groupObjectId is required', code: 'MISSING_GROUP_OID' });
      }
      if (!role) {
        return res.status(400).json({ error: 'role is required', code: 'MISSING_ROLE' });
      }

      // exactOptionalPropertyTypes — `description?: string` doesn't accept
      // `undefined` as a value, so spread it only when present.
      const mapping: EntraGroupRoleMapping = {
        id: uuidv4(),
        type: 'entra-group-role-mapping',
        tenantId,
        groupObjectId,
        role,
        priority,
        ...(description !== undefined ? { description } : {}),
      };

      const container = dbService.getContainer(CONTAINER);
      await container.items.create(mapping);

      logger.info('Entra group-role mapping created', {
        actorId: req.userProfile?.id,
        groupObjectId,
        role,
        tenantId,
      });

      res.status(201).json({ success: true, data: mapping });
    } catch (error) {
      logger.error('Failed to create group-role mapping', { error });
      res.status(500).json({ error: 'Failed to create group-role mapping', code: 'INTERNAL_ERROR' });
    }
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────
  /**
   * Delete a group → role mapping by id.
   */
  router.delete('/:id', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = req.userProfile?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Mapping id is required', code: 'MISSING_ID' });
      }

      const container = dbService.getContainer(CONTAINER);
      const { resource: existing } = await container.item(id, tenantId).read<EntraGroupRoleMapping>();

      if (!existing || existing.type !== 'entra-group-role-mapping') {
        return res.status(404).json({ error: 'Mapping not found', code: 'MAPPING_NOT_FOUND' });
      }
      if (existing.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Cross-tenant access denied', code: 'FORBIDDEN' });
      }

      await container.item(id, tenantId).delete();

      logger.info('Entra group-role mapping deleted', {
        actorId: req.userProfile?.id,
        mappingId: id,
        removedGroup: existing.groupObjectId,
        removedRole: existing.role,
        tenantId,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete group-role mapping', { error });
      res.status(500).json({ error: 'Failed to delete group-role mapping', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
