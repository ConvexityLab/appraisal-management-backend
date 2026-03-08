/**
 * E-Signature Controller
 * REST routes for managing e-signature requests.
 * Mounted at /api/esignature by the API server.
 */

import { Router, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service';
import { ESignatureService } from '../services/esignature.service';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { CreateESignatureInput, UpdateESignatureStatusInput, ESignatureStatus } from '../types/esignature.types';

export class ESignatureController {
  public router: Router;
  private esignatureService: ESignatureService;

  constructor(private dbService: CosmosDbService) {
    this.router = Router();
    this.esignatureService = new ESignatureService(dbService);
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    /**
     * POST /requests
     * Create a new e-signature request
     */
    this.router.post('/requests', this.createSigningRequest.bind(this));

    /**
     * GET /requests
     * List signing requests (filter by orderId query param)
     */
    this.router.get('/requests', this.listSigningRequests.bind(this));

    /**
     * GET /requests/:id
     * Get a single signing request
     */
    this.router.get('/requests/:id', this.getSigningRequest.bind(this));

    /**
     * PUT /requests/:id/status
     * Update signing request status (e.g. from provider webhook)
     */
    this.router.put('/requests/:id/status', this.updateSigningStatus.bind(this));

    /**
     * DELETE /requests/:id
     * Cancel (void) a signing request
     */
    this.router.delete('/requests/:id', this.cancelSigningRequest.bind(this));
  }

  /**
   * POST /requests
   */
  private async createSigningRequest(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id || 'unknown';
      const userEmail = req.user?.email || '';
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved' } });
        return;
      }

      const input = req.body as CreateESignatureInput;
      if (!input.orderId || !input.documentId || !input.signers || input.signers.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'orderId, documentId, and at least one signer are required' },
        });
        return;
      }

      const result = await this.esignatureService.createSigningRequest(
        tenantId,
        input,
        userId,
        userEmail
      );

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Error in createSigningRequest:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create signing request' });
    }
  }

  /**
   * GET /requests?orderId=xxx
   */
  private async listSigningRequests(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved' } });
        return;
      }

      const orderId = req.query.orderId as string;
      if (!orderId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId query parameter is required' } });
        return;
      }

      const limit = parseInt(req.query.limit as string, 10) || 50;
      const result = await this.esignatureService.getSigningRequestsByOrder(orderId, tenantId, limit);

      res.json(result);
    } catch (error) {
      console.error('Error in listSigningRequests:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to list signing requests' });
    }
  }

  /**
   * GET /requests/:id
   */
  private async getSigningRequest(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved' } });
        return;
      }

      const id = req.params.id!;
      const result = await this.esignatureService.getSigningRequest(id, tenantId);

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error in getSigningRequest:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to get signing request' });
    }
  }

  /**
   * PUT /requests/:id/status
   */
  private async updateSigningStatus(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id || 'unknown';
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved' } });
        return;
      }

      const id = req.params.id!;
      const input = req.body as UpdateESignatureStatusInput;

      if (!input.status) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'status is required' } });
        return;
      }

      const result = await this.esignatureService.updateSigningStatus(id, tenantId, input, userId);

      if (!result.success) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404
          : result.error?.code === 'INVALID_TRANSITION' ? 409
          : 400;
        res.status(statusCode).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error in updateSigningStatus:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to update signing status' });
    }
  }

  /**
   * DELETE /requests/:id
   */
  private async cancelSigningRequest(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id || 'unknown';
      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved' } });
        return;
      }

      const id = req.params.id!;
      const reason = (req.body as { reason?: string })?.reason;

      const result = await this.esignatureService.cancelSigningRequest(id, tenantId, userId, reason);

      if (!result.success) {
        const statusCode = result.error?.code === 'NOT_FOUND' ? 404 : 400;
        res.status(statusCode).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      console.error('Error in cancelSigningRequest:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to cancel signing request' });
    }
  }
}
