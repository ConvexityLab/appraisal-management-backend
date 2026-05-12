/**
 * Policy Management Controller (Sprint 3)
 *
 * CRUD and dry-run evaluate endpoints for DB-backed ABAC policy rules.
 * All mutations write a `PolicyChangeAuditEntry` to the same Cosmos container.
 *
 * Routes (mounted at /api/policies):
 *   GET    /           — list policies for the caller's tenant
 *   POST   /           — create a policy rule
 *   PUT    /:id        — replace a policy rule
 *   DELETE /:id        — delete a policy rule
 *   POST   /evaluate   — dry-run: return the computed QueryFilter for given params
 *
 * Access: all routes require role 'admin' (enforced by the caller in api-server.ts).
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { PolicyEvaluatorService } from '../services/policy-evaluator.service.js';
import { AuthorizedRequest } from '../middleware/authorization.middleware.js';
import type { PolicyRule, PolicyChangeAuditEntry } from '../types/policy.types.js';

const CONTAINER = 'authorization-policies';

export const createPolicyManagementRouter = (dbService: CosmosDbService): Router => {
  const router = Router();
  const logger = new Logger();
  const policyEvaluator = new PolicyEvaluatorService(dbService);

  // ── GET / ─────────────────────────────────────────────────────────────────
  router.get('/', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = req.userProfile?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const container = dbService.getContainer(CONTAINER);
      const { resources } = await container.items.query<PolicyRule>({
        query: `SELECT * FROM c
                WHERE c.type = 'authorization-policy'
                  AND c.tenantId = @tenantId
                ORDER BY c.role, c.resourceType, c.priority DESC`,
        parameters: [{ name: '@tenantId', value: tenantId }],
      }).fetchAll();

      res.json({ success: true, data: resources });
    } catch (error) {
      logger.error('Failed to list policies', { error });
      res.status(500).json({ error: 'Failed to list policies', code: 'INTERNAL_ERROR' });
    }
  });

  // ── POST / ────────────────────────────────────────────────────────────────
  router.post('/', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = req.userProfile?.tenantId;
      const actorId = req.userProfile?.id;
      if (!tenantId || !actorId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const now = new Date().toISOString();
      const policy: PolicyRule = {
        ...req.body,
        id: uuidv4(),
        type: 'authorization-policy',
        tenantId,
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
      };

      const container = dbService.getContainer(CONTAINER);
      await container.items.create(policy);

      // Audit
      const audit: PolicyChangeAuditEntry = {
        id: uuidv4(),
        type: 'authorization-policy-audit',
        policyId: policy.id,
        tenantId,
        actorUserId: actorId,
        changeType: 'create',
        after: policy,
        timestamp: now,
      };
      await container.items.create(audit);

      policyEvaluator.invalidateCache(tenantId, policy.role, policy.resourceType);

      res.status(201).json({ success: true, data: policy });
    } catch (error) {
      logger.error('Failed to create policy', { error });
      res.status(500).json({ error: 'Failed to create policy', code: 'INTERNAL_ERROR' });
    }
  });

  // ── PUT /:id ──────────────────────────────────────────────────────────────
  router.put('/:id', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = req.userProfile?.tenantId;
      const actorId = req.userProfile?.id;
      if (!tenantId || !actorId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Policy id is required', code: 'MISSING_ID' });
      }
      const container = dbService.getContainer(CONTAINER);

      // Read existing for audit
      const { resource: existing } = await container.item(id, tenantId!).read<PolicyRule>();
      if (!existing || existing.type !== 'authorization-policy') {
        return res.status(404).json({ error: 'Policy not found', code: 'POLICY_NOT_FOUND' });
      }
      if (existing.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Cross-tenant access denied', code: 'FORBIDDEN' });
      }

      const now = new Date().toISOString();
      const updated: PolicyRule = {
        ...existing,
        ...req.body,
        id,
        type: 'authorization-policy',
        tenantId,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
        updatedAt: now,
      };

      await container.items.upsert(updated);

      const audit: PolicyChangeAuditEntry = {
        id: uuidv4(),
        type: 'authorization-policy-audit',
        policyId: id!,
        tenantId: tenantId!,
        actorUserId: actorId!,
        changeType: 'update',
        before: existing,
        after: updated,
        timestamp: now,
      };
      await container.items.create(audit);

      policyEvaluator.invalidateRuleChange(
        {
          tenantId: existing.tenantId,
          role: existing.role,
          resourceType: existing.resourceType,
        },
        {
          tenantId: updated.tenantId,
          role: updated.role,
          resourceType: updated.resourceType,
        },
      );

      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update policy', { error });
      res.status(500).json({ error: 'Failed to update policy', code: 'INTERNAL_ERROR' });
    }
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────
  router.delete('/:id', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = req.userProfile?.tenantId;
      const actorId = req.userProfile?.id;
      if (!tenantId || !actorId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Policy id is required', code: 'MISSING_ID' });
      }
      const container = dbService.getContainer(CONTAINER);

      const { resource: existing } = await container.item(id, tenantId!).read<PolicyRule>();
      if (!existing || existing.type !== 'authorization-policy') {
        return res.status(404).json({ error: 'Policy not found', code: 'POLICY_NOT_FOUND' });
      }
      if (existing.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Cross-tenant access denied', code: 'FORBIDDEN' });
      }

      await container.item(id, tenantId!).delete();

      const now = new Date().toISOString();
      const audit: PolicyChangeAuditEntry = {
        id: uuidv4(),
        type: 'authorization-policy-audit',
        policyId: id!,
        tenantId: tenantId!,
        actorUserId: actorId!,
        changeType: 'delete',
        before: existing,
        timestamp: now,
      };
      await container.items.create(audit);

      policyEvaluator.invalidateCache(tenantId, existing.role, existing.resourceType);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete policy', { error });
      res.status(500).json({ error: 'Failed to delete policy', code: 'INTERNAL_ERROR' });
    }
  });

  // ── GET /:id/history ─────────────────────────────────────────────────────
  /**
   * List all audit trail entries for a specific policy rule.
   * Returns entries in reverse-chronological order.
   */
  router.get('/:id/history', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = req.userProfile?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Policy id is required', code: 'MISSING_ID' });
      }

      const container = dbService.getContainer(CONTAINER);
      const { resources } = await container.items.query<PolicyChangeAuditEntry>({
        query: `SELECT * FROM c
                WHERE c.type = 'authorization-policy-audit'
                  AND c.policyId = @policyId
                  AND c.tenantId = @tenantId
                ORDER BY c.timestamp DESC`,
        parameters: [
          { name: '@policyId', value: id },
          { name: '@tenantId', value: tenantId },
        ],
      }).fetchAll();

      res.json({ success: true, data: resources });
    } catch (error) {
      logger.error('Failed to fetch policy history', { error });
      res.status(500).json({ error: 'Failed to fetch policy history', code: 'INTERNAL_ERROR' });
    }
  });

  // ── POST /evaluate ────────────────────────────────────────────────────────
  /**
   * Dry-run: given a userId, resourceType, and action, return the computed
   * QueryFilter the caller would get.  Requires a full UserProfile to be
   * loaded (guaranteed by loadUserProfile() middleware upstream).
   *
   * Body: { targetUserId?: string, resourceType: string, action?: string }
   * (defaults to the caller's own profile if targetUserId is omitted)
   */
  router.post('/evaluate', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      if (!req.userProfile) {
        return res.status(401).json({ error: 'User profile required', code: 'USER_PROFILE_REQUIRED' });
      }

      const { resourceType, action = 'read' } = req.body as { resourceType: string; action?: string };
      if (!resourceType) {
        return res.status(400).json({ error: 'resourceType is required', code: 'MISSING_RESOURCE_TYPE' });
      }

      const filter = await policyEvaluator.buildQueryFilter(
        req.userProfile.id,
        req.userProfile,
        resourceType,
        action,
      );

      res.json({ success: true, data: filter });
    } catch (error) {
      logger.error('Failed to evaluate policy', { error });
      res.status(500).json({ error: 'Failed to evaluate policy', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
