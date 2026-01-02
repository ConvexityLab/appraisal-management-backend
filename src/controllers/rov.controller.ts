/**
 * ROV (Reconsideration of Value) API Controller
 * 
 * REST endpoints for managing appraisal challenges and disputes
 */

import express, { Request, Response, NextFunction } from 'express';
import { ROVManagementService } from '../services/rov-management.service';
import { Logger } from '../utils/logger';
import {
  CreateROVRequestInput,
  UpdateROVResearchInput,
  SubmitROVResponseInput,
  ROVFilters,
  ROVStatus,
  ROVRequestorType,
  ROVChallengeReason,
  ROVDecision
} from '../types/rov.types';

export class ROVController {
  private rovService: ROVManagementService;
  private logger: Logger;

  constructor() {
    this.rovService = new ROVManagementService();
    this.logger = new Logger();
  }

  /**
   * POST /api/rov/requests
   * Create a new ROV request
   */
  createROVRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id || 'system';
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      
      this.logger.info('Creating ROV request', { userId, orderId: req.body.orderId });

      const input: CreateROVRequestInput = {
        orderId: req.body.orderId,
        requestorType: req.body.requestorType,
        requestorName: req.body.requestorName,
        requestorEmail: req.body.requestorEmail,
        requestorPhone: req.body.requestorPhone,
        challengeReason: req.body.challengeReason,
        challengeDescription: req.body.challengeDescription,
        originalAppraisalValue: req.body.originalAppraisalValue,
        requestedValue: req.body.requestedValue,
        supportingEvidence: req.body.supportingEvidence,
        priority: req.body.priority
      };

      const result = await this.rovService.createROVRequest(input, userId, tenantId);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: result.data,
          message: 'ROV request created successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in createROVRequest endpoint', { error });
      next(error);
    }
  };

  /**
   * GET /api/rov/requests
   * List ROV requests with filtering
   */
  listROVRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: ROVFilters = {};
      
      if (req.query.status) {
        filters.status = (req.query.status as string).split(',') as ROVStatus[];
      }
      if (req.query.requestorType) {
        filters.requestorType = (req.query.requestorType as string).split(',') as ROVRequestorType[];
      }
      if (req.query.challengeReason) {
        filters.challengeReason = (req.query.challengeReason as string).split(',') as ROVChallengeReason[];
      }
      if (req.query.decision) {
        filters.decision = (req.query.decision as string).split(',') as ROVDecision[];
      }
      if (req.query.priority) {
        filters.priority = (req.query.priority as string).split(',') as ('NORMAL' | 'HIGH' | 'URGENT')[];
      }
      if (req.query.assignedTo) {
        filters.assignedTo = req.query.assignedTo as string;
      }
      if (req.query.orderId) {
        filters.orderId = req.query.orderId as string;
      }
      if (req.query.isOverdue === 'true') {
        filters.isOverdue = true;
      }
      if (req.query.hasComplianceFlags === 'true') {
        filters.hasComplianceFlags = true;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      this.logger.info('Listing ROV requests', { filters, page, limit });

      const result = await this.rovService.listROVRequests(filters, page, limit);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      this.logger.error('Error in listROVRequests endpoint', { error });
      next(error);
    }
  };

  /**
   * GET /api/rov/requests/:id
   * Get ROV request by ID
   */
  getROVRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ROV ID is required'
        });
        return;
      }

      this.logger.info('Fetching ROV request', { rovId: id });

      const result = await this.rovService.getROVById(id);

      if (result.success && result.data) {
        res.json({
          success: true,
          data: result.data
        });
      } else if (!result.data) {
        res.status(404).json({
          success: false,
          error: 'ROV request not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in getROVRequest endpoint', { error, rovId: req.params.id });
      next(error);
    }
  };

  /**
   * POST /api/rov/requests/:id/assign
   * Assign ROV request to a team member
   */
  assignROVRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { assignedTo, assignedToEmail } = req.body;
      const userId = (req as any).user?.id || 'system';

      if (!id || !assignedTo || !assignedToEmail) {
        res.status(400).json({
          success: false,
          error: 'ROV ID, assignedTo, and assignedToEmail are required'
        });
        return;
      }

      this.logger.info('Assigning ROV request', { rovId: id, assignedTo, assignedBy: userId });

      const result = await this.rovService.assignROVRequest(id, assignedTo, assignedToEmail, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: 'ROV request assigned successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in assignROVRequest endpoint', { error, rovId: req.params.id });
      next(error);
    }
  };

  /**
   * PUT /api/rov/requests/:id/research
   * Update ROV research data
   */
  updateROVResearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'system';

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ROV ID is required'
        });
        return;
      }

      this.logger.info('Updating ROV research', { rovId: id, userId });

      const input: UpdateROVResearchInput = {
        rovId: id,
        research: req.body.research,
        internalNotes: req.body.internalNotes
      };

      const result = await this.rovService.updateROVResearch(input, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: 'ROV research updated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in updateROVResearch endpoint', { error, rovId: req.params.id });
      next(error);
    }
  };

  /**
   * POST /api/rov/requests/:id/response
   * Submit ROV response
   */
  submitROVResponse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'system';
      const userEmail = (req as any).user?.email || 'system@example.com';

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ROV ID is required'
        });
        return;
      }

      this.logger.info('Submitting ROV response', { rovId: id, userId, decision: req.body.decision });

      const input: SubmitROVResponseInput = {
        rovId: id,
        decision: req.body.decision,
        newValue: req.body.newValue,
        explanation: req.body.explanation,
        supportingRationale: req.body.supportingRationale || [],
        comparablesUsed: req.body.comparablesUsed || [],
        deliveryMethod: req.body.deliveryMethod || 'EMAIL',
        responseTemplateId: req.body.responseTemplateId
      };

      const result = await this.rovService.submitROVResponse(input, userId, userEmail);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: 'ROV response submitted successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in submitROVResponse endpoint', { error, rovId: req.params.id });
      next(error);
    }
  };

  /**
   * GET /api/rov/metrics
   * Get ROV metrics for reporting
   */
  getROVMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const filters: Partial<ROVFilters> = {};
      if (req.query.status) {
        filters.status = (req.query.status as string).split(',') as ROVStatus[];
      }

      this.logger.info('Fetching ROV metrics', { startDate, endDate });

      const metrics = await this.rovService.getROVMetrics(startDate, endDate, filters);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      this.logger.error('Error in getROVMetrics endpoint', { error });
      next(error);
    }
  };
}

/**
 * Create Express router with ROV endpoints
 */
export function createROVRouter(): express.Router {
  const router = express.Router();
  const controller = new ROVController();

  // ROV CRUD operations
  router.post('/requests', controller.createROVRequest);
  router.get('/requests', controller.listROVRequests);
  router.get('/requests/:id', controller.getROVRequest);

  // ROV workflow operations
  router.post('/requests/:id/assign', controller.assignROVRequest);
  router.put('/requests/:id/research', controller.updateROVResearch);
  router.post('/requests/:id/response', controller.submitROVResponse);

  // ROV analytics
  router.get('/metrics', controller.getROVMetrics);

  return router;
}
