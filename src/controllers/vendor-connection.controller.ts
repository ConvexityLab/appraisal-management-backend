import express, { type Response, type Router } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { Logger } from '../utils/logger.js';
import type { CosmosDbService } from '../services/cosmos-db.service.js';
import { VendorConnectionAdminService } from '../services/vendor-integrations/VendorConnectionAdminService.js';
import {
  VendorConnectionConflictError,
  VendorConnectionNotFoundError,
  VendorConnectionValidationError,
} from '../services/vendor-integrations/VendorIntegrationErrors.js';

const logger = new Logger('VendorConnectionController');

type VendorConnectionAdminPort = Pick<
  VendorConnectionAdminService,
  'listConnections' | 'getConnection' | 'createConnection' | 'updateConnection' | 'deactivateConnection'
>;

function respondError(res: Response, error: unknown): void {
  if (error instanceof VendorConnectionValidationError) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } });
    return;
  }

  if (error instanceof VendorConnectionConflictError) {
    res.status(409).json({ success: false, error: { code: 'CONFLICT', message: error.message } });
    return;
  }

  if (error instanceof VendorConnectionNotFoundError) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error('Vendor connection controller error', { error: message });
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message } });
}

export function createVendorConnectionAdminRouter(
  dbOrService?: CosmosDbService | VendorConnectionAdminPort,
): Router {
  const router = express.Router();
  const service = dbOrService instanceof VendorConnectionAdminService
    ? dbOrService
    : dbOrService && 'createConnection' in dbOrService
      ? dbOrService as VendorConnectionAdminPort
      : new VendorConnectionAdminService((dbOrService as CosmosDbService));

  router.get('/', async (req: UnifiedAuthRequest, res: Response) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthenticated' } });
      return;
    }

    try {
      const vendorType = typeof req.query['vendorType'] === 'string' ? req.query['vendorType'] : undefined;
      const activeOnly = String(req.query['activeOnly'] ?? 'false').toLowerCase() === 'true';
      const filters = {
        ...(vendorType ? { vendorType } : {}),
        activeOnly,
      };
      const connections = await service.listConnections(tenantId, filters);
      res.status(200).json({ success: true, data: connections, count: connections.length });
    } catch (error) {
      respondError(res, error);
    }
  });

  router.get('/:id', async (req: UnifiedAuthRequest, res: Response) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthenticated' } });
      return;
    }

    try {
      const connection = await service.getConnection(req.params['id'] ?? '', tenantId);
      if (!connection) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Vendor connection not found: id=${req.params['id']} tenantId=${tenantId}` } });
        return;
      }
      res.status(200).json({ success: true, data: connection });
    } catch (error) {
      respondError(res, error);
    }
  });

  router.post('/', async (req: UnifiedAuthRequest, res: Response) => {
    const tenantId = req.user?.tenantId;
    const actorId = req.user?.id ?? 'unknown';
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthenticated' } });
      return;
    }

    try {
      const connection = await service.createConnection(tenantId, req.body, actorId);
      res.status(201).json({ success: true, data: connection });
    } catch (error) {
      respondError(res, error);
    }
  });

  router.put('/:id', async (req: UnifiedAuthRequest, res: Response) => {
    const tenantId = req.user?.tenantId;
    const actorId = req.user?.id ?? 'unknown';
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthenticated' } });
      return;
    }

    try {
      const connection = await service.updateConnection(req.params['id'] ?? '', tenantId, req.body, actorId);
      res.status(200).json({ success: true, data: connection });
    } catch (error) {
      respondError(res, error);
    }
  });

  router.delete('/:id', async (req: UnifiedAuthRequest, res: Response) => {
    const tenantId = req.user?.tenantId;
    const actorId = req.user?.id ?? 'unknown';
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthenticated' } });
      return;
    }

    try {
      const connection = await service.deactivateConnection(req.params['id'] ?? '', tenantId, actorId);
      res.status(200).json({ success: true, data: connection });
    } catch (error) {
      respondError(res, error);
    }
  });

  return router;
}