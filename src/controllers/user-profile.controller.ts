import type { SqlParameter } from '@azure/cosmos';

/**
 * User Profile Management Controller
 * 
 * HTTP endpoints for user profile and access scope management
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import {
  UserProfileService,
  UpdateAccessScopeRequest,
  CreateUserProfileRequest,
  UserLifecycleStatus,
} from '../services/user-profile.service.js';
import { AuthorizedRequest } from '../middleware/authorization.middleware.js';
import type { Role, UserProfile } from '../types/authorization.types.js';

export const createUserProfileRouter = (): Router => {
  const router = Router();
  const logger = new Logger();
  const userProfileService = new UserProfileService();
  const dbService = new CosmosDbService();

  const writeUserAdminAudit = async (
    req: AuthorizedRequest,
    params: {
      action: string;
      targetUserId: string;
      tenantId: string;
      before?: UserProfile | null;
      after?: UserProfile | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> => {
    await dbService.upsertDocument('audit-trail', {
      id: `user-admin-${params.action}-${params.targetUserId}-${Date.now()}`,
      orderId: 'system',
      type: 'user-admin-mutation',
      action: params.action,
      tenantId: params.tenantId,
      actorUserId: req.userProfile?.id,
      actorEmail: req.userProfile?.email,
      actorRole: req.userProfile?.role,
      targetUserId: params.targetUserId,
      ...(params.before ? { before: params.before } : {}),
      ...(params.after ? { after: params.after } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
      timestamp: new Date().toISOString(),
    });
  };

  const requireTenantId = (req: AuthorizedRequest, res: Response): string | null => {
    const tenantId = req.userProfile?.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      return null;
    }

    return tenantId;
  };

  /**
   * GET /api/users/profile
   * Get current user's profile
   */
  router.get('/profile', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      if (!req.userProfile) {
        return res.status(401).json({
          error: 'User profile not loaded',
          code: 'USER_PROFILE_REQUIRED'
        });
      }

      res.json({
        success: true,
        data: req.userProfile
      });
    } catch (error) {
      logger.error('Failed to get user profile', { error });
      res.status(500).json({
        error: 'Failed to get user profile',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * GET /api/users/audit
   * List recent user-admin mutation audit entries for the current tenant.
   */
  router.get('/audit', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }

      const targetUserId = typeof req.query.targetUserId === 'string' ? req.query.targetUserId.trim() : '';
      const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.trunc(limitRaw), 200) : 100;

      const query = [
        `SELECT TOP ${limit} * FROM c`,
        `WHERE c.type = 'user-admin-mutation'`,
        `  AND c.tenantId = @tenantId`,
        ...(targetUserId ? [`  AND c.targetUserId = @targetUserId`] : []),
        `ORDER BY c.timestamp DESC`,
      ].join('\n');

      const parameters: SqlParameter[] = [{ name: '@tenantId', value: tenantId }];
      if (targetUserId) {
        parameters.push({ name: '@targetUserId', value: targetUserId });
      }

      const container = dbService.getContainer('audit-trail');
      const { resources } = await container.items.query({ query, parameters }).fetchAll();

      return res.json({
        success: true,
        data: resources,
        count: resources.length,
      });
    } catch (error) {
      logger.error('Failed to list user admin audit entries', { error });
      return res.status(500).json({
        error: 'Failed to list user admin audit entries',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * GET /api/users/:userId
   * Get specific user profile (admin/manager only)
   */
  router.get('/:userId', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }
      
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }

      const profile = await userProfileService.getUserProfile(userId, tenantId);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      return res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error('Failed to get user', { error, userId: req.params.userId });
      return res.status(500).json({
        error: 'Failed to get user',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * GET /api/users
   * List users in tenant (admin/manager only)
   */
  router.get('/', async (req: AuthorizedRequest, res: Response) => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }
      const { role, isActive, teamId } = req.query;

      const filters: any = {};
      if (role) filters.role = role as string;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (teamId) filters.teamId = teamId as string;

      const users = await userProfileService.listUsers(tenantId, filters);

      return res.json({
        success: true,
        data: users,
        count: users.length
      });
    } catch (error) {
      logger.error('Failed to list users', { error });
      return res.status(500).json({
        error: 'Failed to list users',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * POST /api/users
   * Explicitly provision a user profile in the current tenant (admin only).
   * This creates an application UserProfile, not an Entra identity.
   */
  router.post('/', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }

      const {
        email,
        name,
        azureAdObjectId,
        role,
        portalDomain,
        boundEntityIds,
        isInternal,
        accessScope,
        clientId,
        subClientId,
      } = req.body as Omit<CreateUserProfileRequest, 'tenantId'>;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email is required', code: 'MISSING_EMAIL' });
      }

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'name is required', code: 'MISSING_NAME' });
      }

      if (!azureAdObjectId || typeof azureAdObjectId !== 'string') {
        return res.status(400).json({ error: 'azureAdObjectId is required', code: 'MISSING_AZURE_AD_OBJECT_ID' });
      }

      if (!role) {
        return res.status(400).json({ error: 'role is required', code: 'MISSING_ROLE' });
      }

      if (!portalDomain) {
        return res.status(400).json({ error: 'portalDomain is required', code: 'MISSING_PORTAL_DOMAIN' });
      }

      if (!Array.isArray(boundEntityIds)) {
        return res.status(400).json({ error: 'boundEntityIds must be an array', code: 'INVALID_BOUND_ENTITY_IDS' });
      }

      const created = await userProfileService.syncUserProfile({
        email,
        name,
        azureAdObjectId,
        role,
        portalDomain,
        boundEntityIds,
        ...(isInternal !== undefined ? { isInternal } : {}),
        ...(accessScope !== undefined ? { accessScope } : {}),
        ...(clientId !== undefined ? { clientId } : {}),
        ...(subClientId !== undefined ? { subClientId } : {}),
        tenantId,
      });

      logger.info('User profile provisioned via API', {
        actorId: req.userProfile?.id,
        tenantId,
        targetEmail: email,
        targetAzureAdObjectId: azureAdObjectId,
        role,
        portalDomain,
      });

      await writeUserAdminAudit(req, {
        action: 'user-profile.provisioned',
        targetUserId: created.id,
        tenantId,
        after: created,
        metadata: {
          targetEmail: created.email,
          targetAzureAdObjectId: azureAdObjectId,
          portalDomain,
        },
      });

      return res.status(201).json({ success: true, data: created });
    } catch (error) {
      logger.error('Failed to provision user profile', { error });
      return res.status(500).json({ error: 'Failed to provision user profile', code: 'INTERNAL_ERROR' });
    }
  });

  /**
   * PUT /api/users/:userId/access-scope
   * Update user's access scope (admin only)
   */
  router.put('/:userId/access-scope', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }
      
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }
      const updates = req.body;

      const profile = await userProfileService.updateAccessScope(userId, tenantId, updates);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      return res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      logger.error('Failed to update access scope', { error, userId: req.params.userId });
      return res.status(500).json({
        error: 'Failed to update access scope',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * POST /api/users/:userId/teams/:teamId
   * Add user to team (admin/manager only)
   */
  router.post('/:userId/teams/:teamId', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { userId, teamId } = req.params;
      
      if (!userId || !teamId) {
        return res.status(400).json({ error: 'User ID and Team ID are required', code: 'INVALID_REQUEST' });
      }
      
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }

      const profile = await userProfileService.addToTeam(userId, teamId, tenantId);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      return res.json({
        success: true,
        data: profile,
        message: `User added to team ${teamId}`
      });
    } catch (error) {
      logger.error('Failed to add user to team', { error, userId: req.params.userId, teamId: req.params.teamId });
      return res.status(500).json({
        error: 'Failed to add user to team',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * DELETE /api/users/:userId/teams/:teamId
   * Remove user from team (admin/manager only)
   */
  router.delete('/:userId/teams/:teamId', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { userId, teamId } = req.params;
      
      if (!userId || !teamId) {
        return res.status(400).json({ error: 'User ID and Team ID are required', code: 'INVALID_REQUEST' });
      }
      
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }

      const profile = await userProfileService.removeFromTeam(userId, teamId, tenantId);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      return res.json({
        success: true,
        data: profile,
        message: `User removed from team ${teamId}`
      });
    } catch (error) {
      logger.error('Failed to remove user from team', { error, userId: req.params.userId, teamId: req.params.teamId });
      return res.status(500).json({
        error: 'Failed to remove user from team',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * POST /api/users/:userId/client-management
   * Assign client management (admin only)
   */
  router.post('/:userId/client-management', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }
      
      const { clientIds } = req.body;
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }

      if (!Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({
          error: 'clientIds must be a non-empty array',
          code: 'INVALID_REQUEST'
        });
      }

      const profile = await userProfileService.assignClientManagement(userId, clientIds, tenantId);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      return res.json({
        success: true,
        data: profile,
        message: `Assigned ${clientIds.length} client(s) to user`
      });
    } catch (error) {
      logger.error('Failed to assign client management', { error, userId: req.params.userId });
      return res.status(500).json({
        error: 'Failed to assign client management',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * POST /api/users/:userId/deactivate
   * Deactivate user (admin only)
   */
  router.post('/:userId/deactivate', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }
      
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }

      const before = await userProfileService.getUserProfile(userId, tenantId);

      const profile = await userProfileService.deactivateUser(userId, tenantId);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      await writeUserAdminAudit(req, {
        action: 'user-profile.deactivated',
        targetUserId: userId,
        tenantId,
        before,
        after: profile,
      });

      return res.json({
        success: true,
        data: profile,
        message: 'User deactivated'
      });
    } catch (error) {
      logger.error('Failed to deactivate user', { error, userId: req.params.userId });
      return res.status(500).json({
        error: 'Failed to deactivate user',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * POST /api/users/:userId/reactivate
   * Reactivate user (admin only)
   */
  router.post('/:userId/reactivate', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }
      
      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }

      const before = await userProfileService.getUserProfile(userId, tenantId);

      const profile = await userProfileService.reactivateUser(userId, tenantId);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      await writeUserAdminAudit(req, {
        action: 'user-profile.reactivated',
        targetUserId: userId,
        tenantId,
        before,
        after: profile,
      });

      return res.json({
        success: true,
        data: profile,
        message: 'User reactivated'
      });
    } catch (error) {
      logger.error('Failed to reactivate user', { error, userId: req.params.userId });
      return res.status(500).json({
        error: 'Failed to reactivate user',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * PATCH /api/users/:userId/status
   * Normalize user lifecycle mutations behind one explicit status endpoint.
   */
  router.patch('/:userId/status', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }

      const tenantId = requireTenantId(req, res);
      if (!tenantId) {
        return;
      }

      const { status } = req.body as { status?: string };
      if (status !== 'active' && status !== 'inactive') {
        return res.status(400).json({
          error: `status must be "active" or "inactive". Received: ${String(status)}`,
          code: 'INVALID_STATUS',
        });
      }

      const before = await userProfileService.getUserProfile(userId, tenantId);
      const profile = await userProfileService.updateActiveStatus(userId, tenantId, status as UserLifecycleStatus);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      await writeUserAdminAudit(req, {
        action: 'user-profile.status-patched',
        targetUserId: userId,
        tenantId,
        before,
        after: profile,
        metadata: {
          previousStatus: before?.isActive ? 'active' : 'inactive',
          newStatus: status,
        },
      });

      return res.json({
        success: true,
        data: profile,
        message: `User status updated to ${status}`,
      });
    } catch (error) {
      logger.error('Failed to patch user status', { error, userId: req.params.userId });
      return res.status(500).json({
        error: 'Failed to update user status',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * PATCH /api/users/:userId/role
   * Update a user's role (admin only; enforced by the route guard in api-server.ts).
   */
  router.patch('/:userId/role', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }

      const { role } = req.body as { role: Role };
      if (!role) {
        return res.status(400).json({ error: 'role is required', code: 'MISSING_ROLE' });
      }

      const tenantId = req.userProfile?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const before = await userProfileService.getUserProfile(userId, tenantId);

      const updated = await userProfileService.updateRole(userId, tenantId, role);
      if (!updated) {
        return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      }

      logger.info('User role patched via API', {
        actorId: req.userProfile?.id,
        targetUserId: userId,
        newRole: role,
        tenantId,
      });

      await writeUserAdminAudit(req, {
        action: 'user-profile.role-patched',
        targetUserId: userId,
        tenantId,
        before,
        after: updated,
        metadata: {
          previousRole: before?.role,
          newRole: updated.role,
        },
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to patch user role', { error, userId: req.params.userId });
      return res.status(500).json({ error: 'Failed to update role', code: 'INTERNAL_ERROR' });
    }
  });

  /**
   * PATCH /api/users/:userId/access-scope
   * Update a user's access scope (admin or manager acting on own team).
   */
  router.patch('/:userId/access-scope', async (req: AuthorizedRequest, res: Response): Promise<any> => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }

      const tenantId = req.userProfile?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant context required', code: 'TENANT_REQUIRED' });
      }

      const updates = req.body as UpdateAccessScopeRequest;
      const before = await userProfileService.getUserProfile(userId, tenantId);

      const updated = await userProfileService.patchAccessScope(userId, tenantId, updates);
      if (!updated) {
        return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      }

      logger.info('User access scope patched via API', {
        actorId: req.userProfile?.id,
        targetUserId: userId,
        tenantId,
      });

      await writeUserAdminAudit(req, {
        action: 'user-profile.access-scope-patched',
        targetUserId: userId,
        tenantId,
        before,
        after: updated,
        metadata: { updates },
      });

      return res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to patch user access scope', { error, userId: req.params.userId });
      return res.status(500).json({ error: 'Failed to update access scope', code: 'INTERNAL_ERROR' });
    }
  });

  return router;
};
