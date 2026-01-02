/**
 * Authorization Test Endpoint
 * 
 * Interactive endpoint to test authorization decisions
 */

import { Router, Request, Response } from 'express';
import { AuthorizationService } from '../services/authorization.service';
import { AccessGraphService } from '../services/access-graph.service';
import { UserProfile } from '../types/authorization.types';
import { UnifiedAuthRequest } from '../middleware/unified-auth.middleware';

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
      
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          accessScope: user.accessScope,
          isTestUser: user.isTestUser
        },
        interpretation: {
          can_view_all: user.accessScope?.canViewAllOrders || false,
          teams: user.accessScope?.teamIds || [],
          clients: user.accessScope?.managedClientIds || [],
          states: user.accessScope?.statesCovered || []
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
      const { resourceType, resourceId, action, accessControl } = req.body;
      const user = req.user;

      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const userProfile: UserProfile = {
        id: user.id!,
        email: user.email!,
        name: user.name || '',
        ...(user.azureAdObjectId ? { azureAdObjectId: user.azureAdObjectId } : {}),
        role: user.role!,
        tenantId: user.tenantId!,
        accessScope: user.accessScope!,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const decision = await authzService.canAccess(
        userProfile,
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
          email: user.email,
          role: user.role
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

      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const userProfile: UserProfile = {
        id: user.id!,
        email: user.email!,
        name: user.name || '',
        ...(user.azureAdObjectId ? { azureAdObjectId: user.azureAdObjectId } : {}),
        role: user.role!,
        tenantId: user.tenantId!,
        accessScope: user.accessScope!,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const filter = await authzService.buildQueryFilter(
        userProfile,
        resourceType,
        action || 'read'
      );

      res.json({
        filter,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
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
      const user = req.user;

      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Only admins can grant access
      if (user.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can grant access' });
        return;
      }

      const relationship = await graphService.grantAccess({
        entityType: 'user',
        entityId: targetUserId,
        objectType,
        objectId,
        actions: actions || ['read'],
        grantedBy: user.id!,
        tenantId: user.tenantId!,
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
