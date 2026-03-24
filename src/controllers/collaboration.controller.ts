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

// authzService is created inside createCollaborationRouter so it shares the initialized dbService.

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
  user: { id: string; tenantId: string; role?: string; email?: string; name?: string },
  dbService: CosmosDbService,
  authzService: AuthorizationService,
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

  // No Cosmos UserProfile — user may be an authenticated Azure AD user whose profile
  // hasn't been seeded yet.  Fall back to the role from their JWT (set by Azure Entra
  // middleware) so that Casbin role-based policies still apply.
  if (user.role) {
    const syntheticProfile = {
      id: user.id,
      email: user.email ?? user.id,
      name: user.name ?? user.id,
      tenantId: user.tenantId,
      role: user.role,
      accessScope: { teamIds: [], departmentIds: [] },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const decision = await authzService.canAccess(
      syntheticProfile,
      mapped.resourceType,
      recordId,
      'read',
      record.accessControl,
    );
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

export const createCollaborationRouter = (dbService: CosmosDbService): Router => {
  // Create authzService sharing the injected (already-initialized) dbService.
  // Kick off Casbin policy-file initialization immediately — it reads local files, no DB needed.
  const authzService = new AuthorizationService(undefined, dbService);
  const authzReady = authzService.initialize(/* dbAlreadyInitialized= */ true);
  authzReady.catch((err) => logger.error('AuthorizationService initialization failed', { err }));

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

      // Per-record authorization: verify the caller may access this container's record.
      // Wrapped separately so a Cosmos/network error here doesn't become a generic 500.
      let authzResult: Awaited<ReturnType<typeof authorizeContainerAccess>>;
      try {
        authzResult = await authorizeContainerAccess(
          req.query.containerId as string | undefined,
          {
            id: req.user.id,
            tenantId: req.user.tenantId,
            ...(req.user.role !== undefined ? { role: req.user.role } : {}),
            email: req.user.email,
            name: req.user.name,
          },
          dbService,
          authzService,
        );
      } catch (authzErr) {
        logger.error('authorizeContainerAccess threw unexpectedly', { authzErr, userId: req.user.id });
        res.status(503).json({
          success: false,
          error: {
            code: 'AUTHORIZATION_UNAVAILABLE',
            message: 'Unable to verify access to this collaboration session. The data store may be unreachable.',
          },
        });
        return;
      }

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

      try {
        const result = await collaborationService.generateToken({
          tenantId,
          containerId: req.query.containerId as string | undefined,
          userId: req.user.id,
          userName: req.user.name ?? req.user.email ?? req.user.id,
        });

        res.json({ success: true, data: result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Key Vault unreachable or authorization failure (common in local dev).
        // Catches: CredentialUnavailableError, ENOTFOUND, Azure SDK 401/403 responses.
        const isKeyVaultError =
          msg.includes('Key Vault') ||
          msg.includes('keyvault') ||
          msg.includes('vault.azure.net') ||
          msg.includes('AuthenticationRequired') ||
          msg.includes('CredentialUnavailableError') ||
          msg.includes('CredentialUnavailable') ||
          msg.includes('No credential') ||
          msg.includes('Forbidden') ||
          msg.includes('Unauthorized') ||
          msg.includes('ENOTFOUND') ||
          msg.includes('ECONNREFUSED') ||
          msg.includes('fluid-relay-key') ||
          msg.includes('secret');
        if (isKeyVaultError) {
          logger.warn('Fluid Relay Key Vault unreachable — collaboration unavailable', { err, userId: req.user.id });
          res.status(503).json({
            success: false,
            error: {
              code: 'KEYVAULT_UNAVAILABLE',
              message:
                'Cannot reach Key Vault to fetch the Fluid Relay signing key. ' +
                'For local dev set AZURE_FLUID_RELAY_KEY in the backend .env to the ' +
                'primary key from the Azure Fluid Relay resource → Access keys.',
            },
          });
          return;
        }
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

  // ─── Container Registry ─────────────────────────────────────────────────────
  //
  // Maps logical container IDs (e.g. "comp-order-005") to service-assigned UUIDs
  // (Tinylicious or Azure Fluid Relay both assign their own IDs on createContainer).
  // Persisted to Cosmos DB (container: fluid-container-registry) so mappings
  // survive backend restarts and are shared across all instances.
  //
  // This is the rendezvous mechanism that lets two different browsers (with
  // separate localStorage) find the same Fluid document.

  const REGISTRY_CONTAINER = 'fluid-container-registry';

  /**
   * GET /container-registry/:logicalId
   * Returns the service-assigned container ID for a logical ID, or 404.
   */
  router.get(
    '/container-registry/:logicalId',
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
        return;
      }
      const logicalId = req.params['logicalId'];
      if (!logicalId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_LOGICAL_ID' } });
        return;
      }
      try {
        const doc = await dbService.getDocument<{ id: string; serviceId: string; tenantId: string }>(
          REGISTRY_CONTAINER,
          logicalId,
          req.user.tenantId,
        );
        if (!doc || !doc.serviceId) {
          res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
          return;
        }
        res.json({ success: true, data: { serviceId: doc.serviceId } });
      } catch (err) {
        logger.error('Container registry: lookup failed', { logicalId, err });
        res.status(500).json({ success: false, error: { code: 'REGISTRY_LOOKUP_FAILED' } });
      }
    },
  );

  /**
   * PUT /container-registry/:logicalId
   * Stores the service-assigned container ID for a logical ID.
   * Body: { serviceId: string }
   */
  router.put(
    '/container-registry/:logicalId',
    async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
        return;
      }
      const logicalId = req.params['logicalId'];
      if (!logicalId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_LOGICAL_ID' } });
        return;
      }
      const body = req.body as { serviceId?: unknown };
      const { serviceId } = body;
      if (!serviceId || typeof serviceId !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_SERVICE_ID', message: 'serviceId must be a non-empty string' },
        });
        return;
      }
      try {
        await dbService.upsertDocument(REGISTRY_CONTAINER, {
          id: logicalId,
          tenantId: req.user.tenantId,
          serviceId,
          registeredBy: req.user.id,
          registeredAt: new Date().toISOString(),
        });
        logger.info('Container registry: registered', { logicalId, serviceId, userId: req.user.id });
        res.json({ success: true, data: { serviceId } });
      } catch (err) {
        logger.error('Container registry: upsert failed', { logicalId, serviceId, err });
        res.status(500).json({ success: false, error: { code: 'REGISTRY_UPSERT_FAILED' } });
      }
    },
  );

  return router;
};
