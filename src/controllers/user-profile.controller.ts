/**
 * User Profile Management Controller
 * 
 * HTTP endpoints for user profile and access scope management
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { UserProfileService } from '../services/user-profile.service';
import { AuthorizedRequest } from '../middleware/authorization.middleware';

export const createUserProfileRouter = (): Router => {
  const router = Router();
  const logger = new Logger();
  const userProfileService = new UserProfileService();

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
   * GET /api/users/:userId
   * Get specific user profile (admin/manager only)
   */
  router.get('/:userId', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }
      
      const tenantId = req.userProfile?.tenantId || 'default';

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
      const tenantId = req.userProfile?.tenantId || 'default';
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
   * PUT /api/users/:userId/access-scope
   * Update user's access scope (admin only)
   */
  router.put('/:userId/access-scope', async (req: AuthorizedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required', code: 'INVALID_REQUEST' });
      }
      
      const tenantId = req.userProfile?.tenantId || 'default';
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
      
      const tenantId = req.userProfile?.tenantId || 'default';

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
      
      const tenantId = req.userProfile?.tenantId || 'default';

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
      const tenantId = req.userProfile?.tenantId || 'default';

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
      
      const tenantId = req.userProfile?.tenantId || 'default';

      const profile = await userProfileService.deactivateUser(userId, tenantId);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

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
      
      const tenantId = req.userProfile?.tenantId || 'default';

      const profile = await userProfileService.reactivateUser(userId, tenantId);

      if (!profile) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

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

  return router;
};
