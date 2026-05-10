/**
 * Appraiser Controller
 * REST API for appraiser management and assignments
 */

import { Response, Router, type NextFunction } from 'express';
import { AppraiserService } from '../services/appraiser.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware, AuthorizedRequest } from '../middleware/authorization.middleware.js';

export class AppraiserController {
  public router: Router;
  private appraiserService: AppraiserService;
  private dbService: CosmosDbService;
  private logger: Logger;


  constructor(cosmosService: CosmosDbService, authzMiddleware?: AuthorizationMiddleware) {
    this.router = Router();
    this.dbService = cosmosService;
    this.appraiserService = new AppraiserService(cosmosService);
    this.logger = new Logger('AppraiserController');
    this.initializeRoutes(authzMiddleware);
  }

  private initializeRoutes(authzMiddleware?: AuthorizationMiddleware): void {
    const readQuery = authzMiddleware
      ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorizeQuery('appraiser', 'read')]
      : [];
    const readResource = authzMiddleware
      ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorizeResource('appraiser', 'read', { resourceIdParam: 'id' })]
      : [];
    const create = authzMiddleware ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorize('appraiser', 'create')] : [];
    const updateResource = authzMiddleware
      ? [authzMiddleware.loadUserProfile(), authzMiddleware.authorizeResource('appraiser', 'update', { resourceIdParam: 'id' })]
      : [];
    const assignOrderAndAppraiser = authzMiddleware
      ? [
          authzMiddleware.loadUserProfile(),
          this.copyBodyFieldToParam('orderId', 'orderIdForAuth'),
          authzMiddleware.authorizeResource('order', 'update', { resourceIdParam: 'orderIdForAuth' }),
          authzMiddleware.authorizeResource('appraiser', 'update', { resourceIdParam: 'id' }),
        ]
      : [];
    const updateAssignmentWorkflow = authzMiddleware
      ? [
          authzMiddleware.loadUserProfile(),
          authzMiddleware.authorizeResource('appraiser', 'update', { resourceIdParam: 'id' }),
          this.loadAssignmentOrderParam(),
          authzMiddleware.authorizeResource('order', 'update', { resourceIdParam: 'orderIdForAuth' }),
        ]
      : [];

    this.router.get('/', ...readQuery, this.getAllAppraisers.bind(this));
    this.router.get('/available', ...readQuery, this.getAvailableAppraisers.bind(this));
    this.router.get('/:id', ...readResource, this.getAppraiser.bind(this));
    this.router.post('/', ...create, this.createAppraiser.bind(this));
    this.router.put('/:id', ...updateResource, this.updateAppraiser.bind(this));
    this.router.post('/:id/assign', ...assignOrderAndAppraiser, this.assignAppraiser.bind(this));
    this.router.get('/:id/conflicts', ...readResource, this.checkConflicts.bind(this));
    this.router.get('/:id/licenses/expiring', ...readResource, this.checkLicenseExpiration.bind(this));

    // Assignment acceptance workflow
    this.router.get('/:id/assignments/pending', ...readResource, this.getPendingAssignments.bind(this));
    this.router.post('/:id/assignments/:assignmentId/accept', ...updateAssignmentWorkflow, this.acceptAssignment.bind(this));
    this.router.post('/:id/assignments/:assignmentId/reject', ...updateAssignmentWorkflow, this.rejectAssignment.bind(this));
  }

  private copyBodyFieldToParam(sourceField: string, targetParam: string) {
    return (req: UnifiedAuthRequest, res: Response, next: NextFunction): void => {
      const value = req.body?.[sourceField];
      if (typeof value !== 'string' || value.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: `${sourceField} is required`,
        });
        return;
      }

      req.params[targetParam] = value;
      next();
    };
  }

  private loadAssignmentOrderParam() {
    return async (req: UnifiedAuthRequest, res: Response, next: NextFunction): Promise<void> => {
      const appraiserId = req.params.id;
      const assignmentId = req.params.assignmentId;
      const tenantId = req.user?.tenantId;

      if (!appraiserId || !assignmentId) {
        res.status(400).json({ success: false, error: 'ID and assignmentId parameters required' });
        return;
      }

      if (!tenantId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } });
        return;
      }

      try {
        const container = this.dbService.getContainer('orders');
        const { resource } = await container.item(assignmentId, tenantId).read<{
          id: string;
          type?: string;
          appraiserId?: string;
          orderId?: string;
        }>();

        if (!resource || resource.type !== 'appraiser_assignment' || resource.appraiserId !== appraiserId || !resource.orderId) {
          res.status(404).json({ success: false, error: 'Assignment not found' });
          return;
        }

        req.params.orderIdForAuth = resource.orderId;
        next();
      } catch (error) {
        this.logger.error('Error loading assignment for authorization', { error, assignmentId, appraiserId });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load assignment for authorization'
        });
      }
    };
  }

  /**
   * GET /api/appraisers
   * Get all appraisers
   */
  private async getAllAppraisers(req: AuthorizedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      const appraisers = await this.appraiserService.getAllAppraisers(tenantId, req.authorizationFilter);
      
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
  private async getAvailableAppraisers(req: AuthorizedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      const specialty = req.query.specialty as string | undefined;
      
      const appraisers = await this.appraiserService.getAvailableAppraisers(tenantId, specialty, req.authorizationFilter);
      
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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      
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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      
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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      const assignedBy = req.user!.id;

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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }

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
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      
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

  /**
   * GET /api/appraisers/:id/assignments/pending
   * Get pending assignments for an appraiser awaiting acceptance
   */
  private async getPendingAssignments(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ success: false, error: 'ID parameter required' });
        return;
      }
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      
      const assignments = await this.appraiserService.getPendingAssignments(id, tenantId);
      
      res.json({
        success: true,
        data: assignments,
        count: assignments.length
      });
    } catch (error) {
      this.logger.error('Error getting pending assignments', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get assignments'
      });
    }
  }

  /**
   * POST /api/appraisers/:id/assignments/:assignmentId/accept
   * Appraiser accepts an assignment
   */
  private async acceptAssignment(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { id, assignmentId } = req.params;
      if (!id || !assignmentId) {
        res.status(400).json({ success: false, error: 'ID and assignmentId parameters required' });
        return;
      }
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      const { notes } = req.body;
      
      const assignment = await this.appraiserService.acceptAssignment(
        assignmentId,
        id,
        tenantId,
        notes
      );
      
      res.json({
        success: true,
        data: assignment,
        message: 'Assignment accepted successfully'
      });
    } catch (error) {
      this.logger.error('Error accepting assignment', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to accept assignment'
      });
    }
  }

  /**
   * POST /api/appraisers/:id/assignments/:assignmentId/reject
   * Appraiser rejects an assignment
   */
  private async rejectAssignment(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { id, assignmentId } = req.params;
      const { reason } = req.body;
      
      if (!id || !assignmentId) {
        res.status(400).json({ success: false, error: 'ID and assignmentId parameters required' });
        return;
      }
      
      if (!reason) {
        res.status(400).json({ success: false, error: 'Rejection reason is required' });
        return;
      }
      
      const tenantId = req.user?.tenantId;
      if (!tenantId) { res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User tenant not resolved — authentication required' } }); return; }
      
      const assignment = await this.appraiserService.rejectAssignment(
        assignmentId,
        id,
        tenantId,
        reason
      );
      
      res.json({
        success: true,
        data: assignment,
        message: 'Assignment rejected successfully'
      });
    } catch (error) {
      this.logger.error('Error rejecting assignment', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject assignment'
      });
    }
  }
}
