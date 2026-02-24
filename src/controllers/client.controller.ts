/**
 * Client Controller — G10
 *
 * REST endpoints for Lender / AMC / Broker client management.
 *
 * Routes:
 *   GET    /              → listClients
 *   POST   /              → createClient
 *   GET    /:clientId     → getClient
 *   PUT    /:clientId     → updateClient
 *   DELETE /:clientId     → deleteClient   (soft — sets status=INACTIVE)
 */

import { Router, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { CreateClientRequest, UpdateClientRequest } from '../types/index.js';

const logger = new Logger('ClientController');

export class ClientController {
  public router: Router;

  constructor(private dbService: CosmosDbService) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/', this.listClients.bind(this));

    this.router.post(
      '/',
      [
        body('clientName').notEmpty().withMessage('clientName is required'),
        body('clientType')
          .isIn(['LENDER', 'AMC', 'BROKER', 'CREDIT_UNION', 'OTHER'])
          .withMessage('Invalid clientType'),
        body('contactName').notEmpty().withMessage('contactName is required'),
        body('contactEmail').isEmail().withMessage('Valid contactEmail is required'),
      ],
      this.createClient.bind(this)
    );

    this.router.get(
      '/:clientId',
      [param('clientId').notEmpty()],
      this.getClient.bind(this)
    );

    this.router.put(
      '/:clientId',
      [
        param('clientId').notEmpty(),
        body('contactEmail').optional().isEmail().withMessage('contactEmail must be a valid email'),
        body('clientType')
          .optional()
          .isIn(['LENDER', 'AMC', 'BROKER', 'CREDIT_UNION', 'OTHER'])
          .withMessage('Invalid clientType'),
        body('status')
          .optional()
          .isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
          .withMessage('Invalid status'),
      ],
      this.updateClient.bind(this)
    );

    this.router.delete(
      '/:clientId',
      [param('clientId').notEmpty()],
      this.deleteClient.bind(this)
    );
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────

  public async listClients(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;

      const result = await this.dbService.findClients(tenantId, status);
      if (!result.success) {
        res.status(500).json({ error: 'Failed to retrieve clients', details: result.error });
        return;
      }
      res.json({ clients: result.data, count: result.data?.length ?? 0 });
    } catch (error) {
      logger.error('listClients failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async createClient(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const createdBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';
      const body = req.body as CreateClientRequest;

      const result = await this.dbService.createClient({ ...body, tenantId, createdBy });
      if (!result.success) {
        res.status(500).json({ error: 'Failed to create client', details: result.error });
        return;
      }
      res.status(201).json(result.data);
    } catch (error) {
      logger.error('createClient failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async getClient(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { clientId } = req.params as { clientId: string };

      const result = await this.dbService.findClientById(clientId, tenantId);
      if (!result.success) {
        res.status(500).json({ error: 'Failed to retrieve client' });
        return;
      }
      if (!result.data) {
        res.status(404).json({ error: 'CLIENT_NOT_FOUND', message: `Client ${clientId} not found` });
        return;
      }
      res.json(result.data);
    } catch (error) {
      logger.error('getClient failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async updateClient(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { clientId } = req.params as { clientId: string };
      const updates = req.body as UpdateClientRequest;

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No fields to update provided' });
        return;
      }

      const result = await this.dbService.updateClient(clientId, tenantId, updates);
      if (!result.success) {
        const isNotFound = (result.error as any)?.code === 'CLIENT_NOT_FOUND';
        res.status(isNotFound ? 404 : 500).json({ error: result.error });
        return;
      }
      res.json(result.data);
    } catch (error) {
      logger.error('updateClient failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async deleteClient(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }

    try {
      const tenantId = this.resolveTenantId(req);
      const { clientId } = req.params as { clientId: string };

      const result = await this.dbService.deleteClient(clientId, tenantId);
      if (!result.success) {
        const isNotFound = (result.error as any)?.code === 'CLIENT_NOT_FOUND';
        res.status(isNotFound ? 404 : 500).json({ error: result.error });
        return;
      }
      res.status(204).send();
    } catch (error) {
      logger.error('deleteClient failed', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private resolveTenantId(req: UnifiedAuthRequest): string {
    const tid =
      req.user?.tenantId ??
      (req.headers['x-tenant-id'] as string | undefined);
    if (!tid) {
      throw new Error('tenant ID is required but was not found in the auth token or x-tenant-id header');
    }
    return tid;
  }
}
