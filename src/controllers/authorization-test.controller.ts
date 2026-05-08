/**
 * Authorization Test Endpoint
 * 
 * Interactive endpoint to test authorization decisions
 */

import { Router, Request, Response } from 'express';
import { AuthorizationService } from '../services/authorization.service.js';
import { AccessGraphService } from '../services/access-graph.service.js';
import { UserProfile } from '../types/authorization.types.js';
import { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

export const createAuthorizationTestRouter = (): Router => {
  const router = Router();
  const authzService = new AuthorizationService();
  const graphService = new AccessGraphService();

  // Initialize
  authzService.initialize().catch(console.error);

  /**
   * GET /api/authz-test/profile
   * Show current user's profile and access scope
   */
  router.get('/profile', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const user = req.user;
      const userProfile = req.userProfile as UserProfile | undefined;
      
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      if (!userProfile) {
        res.status(500).json({ error: 'User profile not loaded', code: 'USER_PROFILE_REQUIRED' });
        return;
      }

      res.json({
        user: {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name,
          role: userProfile.role,
          accessScope: userProfile.accessScope,
          isTestUser: user.isTestUser
        },
        interpretation: {
          can_view_all: userProfile.accessScope?.canViewAllOrders || false,
          teams: userProfile.accessScope?.teamIds || [],
          clients: userProfile.accessScope?.managedClientIds || [],
          states: userProfile.accessScope?.statesCovered || []
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get profile', details: error });
    }
  });

  /**
   * POST /api/authz-test/check
   * Test if current user can perform an action
   */
  router.post('/check', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const { resourceType, resourceId, action, accessControl, portalDomain, boundEntityIds } = req.body;
      const user = req.user;
      const userProfile = req.userProfile as UserProfile | undefined;

      if (!user || !userProfile) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const evaluationProfile: UserProfile = {
        ...userProfile,
        portalDomain: portalDomain ?? req.body.portalDomain,
        boundEntityIds: boundEntityIds ?? req.body.boundEntityIds ?? [],
      };

      const decision = await authzService.canAccess(
        evaluationProfile,
        resourceType,
        resourceId || 'test-resource',
        action,
        accessControl,
        { checkGraph: true, auditLog: true }
      );

      res.json({
        decision: {
          allowed: decision.allowed,
          reason: decision.reason
        },
        user: {
          id: user.id,
          email: user.email
        },
        request: {
          resourceType,
          resourceId,
          action,
          accessControl
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Authorization check failed', details: error });
    }
  });

  /**
   * POST /api/authz-test/filter
   * Get query filter for current user
   */
  router.post('/filter', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const { resourceType, action } = req.body;
      const user = req.user;
      const userProfile = req.userProfile as UserProfile | undefined;

      if (!user || !userProfile) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const filterProfile: UserProfile = {
        ...userProfile,
        portalDomain: req.body.portalDomain,
        boundEntityIds: req.body.boundEntityIds ?? [],
      };

      const filter = await authzService.buildQueryFilter(
        filterProfile,
        resourceType,
        action || 'read'
      );

      res.json({
        filter,
        user: {
          id: user.id,
          email: user.email
        },
        interpretation: {
          message: 'Query filter for data access',
          sql: filter.sql,
          parameterCount: filter.parameters.length
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Filter generation failed', details: error });
    }
  });

  /**
   * POST /api/authz-test/grant
   * Test granting special access via graph
   */
  router.post('/grant', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      const { targetUserId, objectType, objectId, actions, reason } = req.body;
      const userProfile = req.userProfile as UserProfile | undefined;

      if (!userProfile) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Only admins can grant access
      if (userProfile.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can grant access' });
        return;
      }

      const relationship = await graphService.grantAccess({
        entityType: 'user',
        entityId: targetUserId,
        objectType,
        objectId,
        actions: actions || ['read'],
        grantedBy: userProfile.id,
        tenantId: userProfile.tenantId,
        reason: reason || 'Test grant'
      });

      res.json({
        message: 'Access granted',
        relationship,
        note: 'This creates an exception - user can access resource outside normal scope'
      });
    } catch (error) {
      res.status(500).json({ error: 'Grant failed', details: error });
    }
  });

  /**
   * GET /api/authz-test/scenarios
   * Get test scenarios to try
   */
  router.get('/scenarios', (req: Request, res: Response): void => {
    res.json({
      scenarios: [
        {
          name: 'Check if you can read an order',
          endpoint: 'POST /api/authz-test/check',
          body: {
            resourceType: 'order',
            resourceId: 'order-123',
            action: 'read'
          }
        },
        {
          name: 'Check if you can create orders',
          endpoint: 'POST /api/authz-test/check',
          body: {
            resourceType: 'order',
            action: 'create'
          }
        },
        {
          name: 'Get your query filter for orders',
          endpoint: 'POST /api/authz-test/filter',
          body: {
            resourceType: 'order',
            action: 'read'
          }
        },
        {
          name: 'Check access to team-specific order',
          endpoint: 'POST /api/authz-test/check',
          body: {
            resourceType: 'order',
            resourceId: 'order-456',
            action: 'read',
            accessControl: {
              teamId: 'team-1',
              clientId: 'client-1',
              ownerId: 'other-user',
              assignedUserIds: []
            }
          }
        },
        {
          name: 'Grant special access (admin only)',
          endpoint: 'POST /api/authz-test/grant',
          body: {
            targetUserId: 'test-appraiser',
            objectType: 'order',
            objectId: 'order-789',
            actions: ['read', 'update'],
            reason: 'Special project'
          }
        }
      ]
    });
  });

  return router;
};
