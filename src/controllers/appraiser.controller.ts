/**
 * Appraiser Controller
 * REST API for appraiser management and assignments
 */

import { Response, Router } from 'express';
import { AppraiserService } from '../services/appraiser.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

export class AppraiserController {
  public router: Router;
  private appraiserService: AppraiserService;
  private logger: Logger;

  constructor(cosmosService: CosmosDbService) {
    this.router = Router();
    this.appraiserService = new AppraiserService(cosmosService);
    this.logger = new Logger('AppraiserController');
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get('/', this.getAllAppraisers.bind(this));
    this.router.get('/available', this.getAvailableAppraisers.bind(this));
    this.router.get('/:id', this.getAppraiser.bind(this));
    this.router.post('/', this.createAppraiser.bind(this));
    this.router.put('/:id', this.updateAppraiser.bind(this));
    this.router.post('/:id/assign', this.assignAppraiser.bind(this));
    this.router.get('/:id/conflicts', this.checkConflicts.bind(this));
    this.router.get('/:id/licenses/expiring', this.checkLicenseExpiration.bind(this));
  }

  /**
   * GET /api/appraisers
   * Get all appraisers
   */
  private async getAllAppraisers(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'test-tenant-123';
      const appraisers = await this.appraiserService.getAllAppraisers(tenantId);
      
      res.json({
        success: true,
        data: appraisers,
        count: appraisers.length
      });
    } catch (error) {
      this.logger.error('Error getting appraisers', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        tenantId: req.user?.tenantId
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve appraisers'
      });
    }
  }

  /**
   * GET /api/appraisers/available?specialty=residential
   * Get available appraisers (with capacity)
   */
  private async getAvailableAppraisers(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'test-tenant-123';
      const specialty = req.query.specialty as string | undefined;
      
      const appraisers = await this.appraiserService.getAvailableAppraisers(tenantId, specialty);
      
      res.json({
        success: true,
        data: appraisers,
        count: appraisers.length,
        filters: { specialty }
      });
    } catch (error) {
      this.logger.error('Error getting available appraisers', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve available appraisers'
      });
    }
  }

  /**
   * GET /api/appraisers/:id
   * Get specific appraiser
   */
  private async getAppraiser(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'ID parameter required' });
        return;
      }
      const tenantId = req.user?.tenantId || 'test-tenant-123';
      
      const appraiser = await this.appraiserService.getAppraiserById(id, tenantId);
      
      if (!appraiser) {
        res.status(404).json({
          success: false,
          error: 'Appraiser not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: appraiser
      });
    } catch (error) {
      this.logger.error('Error getting appraiser', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve appraiser'
      });
    }
  }

  /**
   * POST /api/appraisers
   * Create new appraiser
   */
  private async createAppraiser(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId || 'test-tenant-123';
      const appraiserData = {
        ...req.body,
        tenantId,
        type: 'appraiser' as const
      };

      const appraiser = await this.appraiserService.createAppraiser(appraiserData);
      
      res.status(201).json({
        success: true,
        data: appraiser
      });
    } catch (error) {
      this.logger.error('Error creating appraiser', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create appraiser'
      });
    }
  }

  /**
   * PUT /api/appraisers/:id
   * Update appraiser
   */
  private async updateAppraiser(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'ID parameter required' });
        return;
      }
      const tenantId = req.user?.tenantId || 'test-tenant-123';
      
      const appraiser = await this.appraiserService.updateAppraiser(id, tenantId, req.body);
      
      res.json({
        success: true,
        data: appraiser
      });
    } catch (error) {
      this.logger.error('Error updating appraiser', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update appraiser'
      });
    }
  }

  /**
   * POST /api/appraisers/:id/assign
   * Assign appraiser to order
   */
  private async assignAppraiser(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'ID parameter required' });
        return;
      }
      const { orderId, propertyAddress, propertyLat, propertyLng } = req.body;
      const tenantId = req.user?.tenantId || 'test-tenant-123';
      const assignedBy = req.user?.id || 'system';

      if (!orderId || !propertyAddress) {
        res.status(400).json({
          success: false,
          error: 'orderId and propertyAddress are required'
        });
        return;
      }

      const assignment = await this.appraiserService.assignAppraiser(
        orderId,
        id,
        assignedBy,
        tenantId,
        propertyAddress
      );
      
      res.status(201).json({
        success: true,
        data: assignment
      });
    } catch (error) {
      this.logger.error('Error assigning appraiser', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign appraiser'
      });
    }
  }

  /**
   * GET /api/appraisers/:id/conflicts?propertyAddress=123 Main St&propertyLat=40.7128&propertyLng=-74.0060
   * Check for conflicts of interest
   */
  private async checkConflicts(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'ID parameter required' });
        return;
      }
      const { propertyAddress, propertyLat, propertyLng } = req.query;
      const tenantId = req.user?.tenantId || 'test-tenant-123';

      if (!propertyAddress) {
        res.status(400).json({
          success: false,
          error: 'propertyAddress is required'
        });
        return;
      }

      const lat = propertyLat ? parseFloat(propertyLat as string) : undefined;
      const lng = propertyLng ? parseFloat(propertyLng as string) : undefined;

      const result = await this.appraiserService.checkConflict(
        id,
        tenantId,
        propertyAddress as string,
        lat,
        lng
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Error checking conflicts', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check conflicts'
      });
    }
  }

  /**
   * GET /api/appraisers/:id/licenses/expiring
   * Check for expiring licenses (within 30 days)
   */
  private async checkLicenseExpiration(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'ID parameter required' });
        return;
      }
      const tenantId = req.user?.tenantId || 'test-tenant-123';
      
      const expiringLicenses = await this.appraiserService.checkLicenseExpiration(id, tenantId);
      
      res.json({
        success: true,
        data: expiringLicenses,
        count: expiringLicenses.length
      });
    } catch (error) {
      this.logger.error('Error checking license expiration', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check licenses'
      });
    }
  }
}
