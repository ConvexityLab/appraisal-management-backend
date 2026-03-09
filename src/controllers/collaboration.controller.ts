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
 *
 * Authorization (per-record): before issuing a token the handler checks that the
 * authenticated caller has read access to the underlying Cosmos record associated
 * with the containerId.  Global/queue containers require an internal UserProfile.
 */

import express, { Response, Router } from 'express';
import { query, validationResult } from 'express-validator';
import { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CollaborationService } from '../services/collaboration.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AuthorizationService } from '../services/authorization.service.js';
import { ResourceType } from '../types/authorization.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('CollaborationController');

// ─── Per-record authorization helpers ────────────────────────────────────────

/** Containers that represent shared queues — no per-record lookup but only employees may join. */
const QUEUE_CONTAINERS = new Set(['assignment-queue', 'acceptance-queue', 'arv-default']);

/** Maps the prefix of a containerId to the Cosmos container name and ResourceType. */
const PREFIX_MAP: Readonly<Record<string, { containerName: string; resourceType: ResourceType }>> = {
  order: { containerName: 'orders',       resourceType: 'order' },
  comp:  { containerName: 'orders',       resourceType: 'order' },
  qc:    { containerName: 'qc-reviews',   resourceType: 'qc_review' },
  rov:   { containerName: 'rov-requests', resourceType: 'rov_request' },
  arv:   { containerName: 'arv-analyses', resourceType: 'arv_analysis' },
};

// Module-level singletons — constructors are lightweight; actual I/O is deferred.
const dbService = new CosmosDbService();
const authzService = new AuthorizationService();

/**
 * Authorize a user's access to a Fluid collaboration container.
 *
 * Rules:
 *  - `undefined` containerId (creating a new container): always allowed.
 *  - Queue containers (assignment-queue, acceptance-queue, arv-default): internal
 *    employees only — requires a matching UserProfile in Cosmos.
 *  - Per-record containers (`order-{id}`, `comp-{id}`, `qc-{id}`, `rov-{id}`, `arv-{id}`):
 *      1. Load record; 404 → deny.
 *      2. If UserProfile found → delegate to AuthorizationService.canAccess().
 *      3. No UserProfile (external vendor/client) → allow if the user's AAD object ID
 *         matches `record.assignedVendorId`, `record.clientId`, or the equivalent
 *         fields inside `record.accessControl`.
 *  - Unknown pattern: allow (forward-compatible; do not block future containers).
 */
async function authorizeContainerAccess(
  containerId: string | undefined,
  user: { id: string; tenantId: string },
): Promise<{ allowed: boolean; reason?: string }> {
  // New container — no record to check.
  if (!containerId) {
    return { allowed: true };
  }

  // Global queue containers require an internal employee UserProfile.
  if (QUEUE_CONTAINERS.has(containerId)) {
    const profile = await authzService.getUserProfile(user.id, user.tenantId);
    return profile
      ? { allowed: true }
      : { allowed: false, reason: 'EMPLOYEE_ONLY_CONTAINER' };
  }

  // Per-record containers: parse the prefix and record ID.
  const match = /^(order|comp|qc|rov|arv)-(.+)$/.exec(containerId);
  if (!match) {
    // Unknown pattern — allow so future container types don't break.
    return { allowed: true };
  }

  const [, prefix, recordId] = match;
  // Regex guarantees both groups match, but TypeScript infers string|undefined — assert here.
  if (!prefix || !recordId) {
    return { allowed: true };
  }
  const mapped = PREFIX_MAP[prefix];
  // Regex captures only known prefixes, but the index type is string — guard just in case.
  if (!mapped) {
    return { allowed: true };
  }

  // Load the record from Cosmos.
  const record = await dbService.getDocument<any>(mapped.containerName, recordId, user.tenantId);
  if (!record) {
    return { allowed: false, reason: 'RECORD_NOT_FOUND' };
  }

  // Employee path: check via Casbin / ABAC policy.
  const userProfile = await authzService.getUserProfile(user.id, user.tenantId);
  if (userProfile) {
    const decision = await authzService.canAccess(
      userProfile,
      mapped.resourceType,
      recordId,
      'read',
      record.accessControl,
    );
    // exactOptionalPropertyTypes: omit reason key rather than setting it to undefined
    return decision.reason
      ? { allowed: decision.allowed, reason: decision.reason }
      : { allowed: decision.allowed };
  }

  // External user (vendor / client) — direct ID comparison only.
  const ac = record.accessControl as { vendorId?: string; clientId?: string } | undefined;
  const isVendor = record.assignedVendorId === user.id || ac?.vendorId === user.id;
  const isClient = record.clientId === user.id || ac?.clientId === user.id;
  if (isVendor || isClient) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'ACCESS_DENIED' };
}

// ─── Shared service singleton ─────────────────────────────────────────────────
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
        // Per-record authorization: verify the caller may access this container's record.
        const authzResult = await authorizeContainerAccess(
          req.query.containerId as string | undefined,
          { id: req.user.id, tenantId: req.user.tenantId },
        );

        if (!authzResult.allowed) {
          res.status(403).json({
            success: false,
            error: {
              code: 'COLLABORATION_ACCESS_DENIED',
              message: 'You do not have permission to join this collaboration session.',
              ...(authzResult.reason && { reason: authzResult.reason }),
            },
          });
          return;
        }

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
