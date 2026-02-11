/**
 * ACS Token Controller - Token Exchange API for Chat Authentication
 * 
 * Provides REST endpoints for clients to exchange Azure AD tokens
 * for ACS Chat tokens with proper authentication and authorization.
 */

import express, { Response, Router } from 'express';
import { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AcsIdentityService } from '../services/acs-identity.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();
const identityService = new AcsIdentityService();

export const createAcsTokenRouter = (): Router => {
  const router = express.Router();

  /**
   * GET /api/acs/token
   * Exchange Azure AD authentication for ACS Chat token
   * 
   * Headers:
   *   Authorization: Bearer <azure-ad-token>
   *   x-tenant-id: <tenant-id>
   * 
   * Response:
   *   {
   *     success: true,
   *     data: {
   *       acsUserId: "8:acs:...",
   *       token: "eyJ0eXAi...",
   *       expiresOn: "2026-01-04T12:00:00.000Z"
   *     }
   *   }
   */
  router.get('/token', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      // Check authentication (middleware should have validated JWT)
      if (!req.user || !req.user.id) {
        res.status(401).json({ 
          success: false,
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required', 
            timestamp: new Date() 
          } 
        });
        return;
      }

      const userId = req.user.id;
      
      // Accept tenant ID from header OR query parameter for flexibility
      const tenantIdFromHeader = req.headers['x-tenant-id'];
      const tenantIdFromQuery = req.query.tenantId;
      const tenantIdParam = tenantIdFromHeader || tenantIdFromQuery;

      if (!tenantIdParam || typeof tenantIdParam !== 'string') {
        res.status(400).json({ 
          success: false,
          error: { 
            code: 'TENANT_ID_REQUIRED', 
            message: 'Tenant ID required (provide x-tenant-id header or tenantId query parameter)', 
            timestamp: new Date() 
          } 
        });
        return;
      }

      const tenantId = String(tenantIdParam);

      // Check if ACS is configured
      if (!identityService.isConfigured()) {
        res.status(503).json({ 
          success: false,
          error: { 
            code: 'ACS_NOT_CONFIGURED', 
            message: 'Azure Communication Services not configured', 
            timestamp: new Date() 
          } 
        });
        return;
      }

      logger.info('Generating ACS token', { userId, tenantId });

      // Exchange Azure AD user → ACS token
      const result = await identityService.exchangeUserToken(userId, tenantId);

      if (!result.success || !result.data) {
        logger.error('ACS token generation failed', { 
          userId, 
          tenantId, 
          error: result.error 
        });
        res.status(500).json({ 
          success: false,
          error: result.error || { 
            code: 'TOKEN_GENERATION_FAILED', 
            message: 'Failed to generate ACS token', 
            timestamp: new Date() 
          } 
        });
        return;
      }

      logger.info('ACS token generated successfully', { 
        userId, 
        acsUserId: result.data.acsUserId,
        expiresOn: result.data.expiresOn
      });

      res.json(result);
      return;
    } catch (error) {
      logger.error('Error in token endpoint', { 
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ 
        success: false,
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to generate token', 
          timestamp: new Date() 
        } 
      });
      return;
    }
  });

  /**
   * POST /api/acs/revoke
   * Revoke user's ACS identity and tokens (cleanup on account deletion)
   */
  router.post('/revoke', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ 
          success: false,
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required', 
            timestamp: new Date() 
          } 
        });
        return;
      }

      const userId = req.user.id;
      const tenantIdParam = req.headers['x-tenant-id'];

      if (!tenantIdParam || typeof tenantIdParam !== 'string') {
        res.status(400).json({ 
          success: false,
          error: { 
            code: 'TENANT_ID_REQUIRED', 
            message: 'x-tenant-id header is required', 
            timestamp: new Date() 
          } 
        });
        return;
      }

      const tenantId = String(tenantIdParam);

      logger.info('Revoking ACS identity', { userId, tenantId });

      const result = await identityService.revokeUserIdentity(userId, tenantId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      logger.info('ACS identity revoked successfully', { userId });

      res.json({ success: true, message: 'Identity revoked successfully' });
      return;
    } catch (error) {
      logger.error('Error revoking identity', { error });
      res.status(500).json({ 
        success: false,
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to revoke identity', 
          timestamp: new Date() 
        } 
      });
      return;
    }
  });

  /**
   * GET /api/acs/user-id
   * Get ACS user ID without generating new token (for lookups)
   */
  router.get('/user-id', async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({ 
          success: false,
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required', 
            timestamp: new Date() 
          } 
        });
        return;
      }

      const userId = req.user.id;
      const tenantIdParam = req.headers['x-tenant-id'];

      if (!tenantIdParam || typeof tenantIdParam !== 'string') {
        res.status(400).json({ 
          success: false,
          error: { 
            code: 'TENANT_ID_REQUIRED', 
            message: 'x-tenant-id header is required', 
            timestamp: new Date() 
          } 
        });
        return;
      }

      const tenantId = String(tenantIdParam);

      const acsUserId = await identityService.getAcsUserId(userId, tenantId);

      if (!acsUserId) {
        res.status(404).json({ 
          success: false,
          error: { 
            code: 'ACS_USER_NOT_FOUND', 
            message: 'ACS user mapping not found', 
            timestamp: new Date() 
          } 
        });
        return;
      }

      res.json({ success: true, data: { acsUserId } });
      return;
    } catch (error) {
      logger.error('Error getting ACS user ID', { error });
      res.status(500).json({ 
        success: false,
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to get ACS user ID', 
          timestamp: new Date() 
        } 
      });
      return;
    }
  });

  return router;
};
