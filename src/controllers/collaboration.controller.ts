/**
 * Collaboration Controller — Fluid Relay token exchange
 *
 * GET /api/collaboration/fluid-token
 *   Query params:
 *     tenantId?    — override; defaults to AZURE_FLUID_RELAY_TENANT_ID env var
 *     containerId? — existing container ID; omit to create a new container
 *
 * Returns a signed Fluid Relay JWT the frontend passes to AzureFunctionTokenProvider.
 *
 * Auth: standard UnifiedAuth middleware (Azure AD + test tokens).
 */

import express, { Response, Router } from 'express';
import { query, validationResult } from 'express-validator';
import { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CollaborationService } from '../services/collaboration.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('CollaborationController');

// Shared service instance — constructor validates env at startup, which is intentional
// (fail fast rather than getting a 500 on first request).
let collaborationService: CollaborationService | null = null;
try {
  collaborationService = new CollaborationService();
} catch (err) {
  logger.warn('CollaborationService not available — collaboration endpoints will return 503', { err });
}

export const createCollaborationRouter = (): Router => {
  const router = express.Router();

  /**
   * GET /fluid-token
   * Issues a Fluid Relay user JWT for the authenticated caller.
   */
  router.get(
    '/fluid-token',
    [
      query('containerId')
        .optional()
        .isString()
        .withMessage('containerId must be a string'),
      query('tenantId')
        .optional()
        .isString()
        .withMessage('tenantId must be a string'),
    ],
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      if (!req.user || !req.user.id) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!collaborationService || !collaborationService.isConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: 'COLLABORATION_NOT_CONFIGURED',
            message:
              'Fluid Relay is not configured in this environment. ' +
              'Ensure AZURE_FLUID_RELAY_TENANT_ID and KEY_VAULT_URL are set and the ' +
              '"fluid-relay-key" secret exists in Key Vault.',
          },
        });
        return;
      }

      const tenantId =
        (req.query.tenantId as string | undefined) ||
        process.env.AZURE_FLUID_RELAY_TENANT_ID;

      if (!tenantId) {
        res.status(500).json({
          success: false,
          error: {
            code: 'TENANT_ID_MISSING',
            message:
              'AZURE_FLUID_RELAY_TENANT_ID is not set. Set it from the Fluid Relay frsTenantId Bicep output.',
          },
        });
        return;
      }

      try {
        const result = await collaborationService.generateToken({
          tenantId,
          containerId: req.query.containerId as string | undefined,
          userId: req.user.id,
          userName: req.user.name ?? req.user.email ?? req.user.id,
        });

        res.json({ success: true, data: result });
      } catch (err) {
        logger.error('Failed to generate Fluid Relay token', { err, userId: req.user.id });
        res.status(500).json({
          success: false,
          error: {
            code: 'TOKEN_GENERATION_FAILED',
            message: 'An internal error occurred while generating the collaboration token.',
          },
        });
      }
    }
  );

  return router;
};
