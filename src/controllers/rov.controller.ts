/**
 * ROV (Reconsideration of Value) API Controller
 * 
 * REST endpoints for managing appraisal challenges and disputes
 */

import express, { Request, Response, NextFunction } from 'express';
import { ROVManagementService } from '../services/rov-management.service.js';
import { Logger } from '../utils/logger.js';
import { WebPubSubService } from '../services/web-pubsub.service.js';
import { EventCategory, EventPriority } from '../types/events.js';
import {
  CreateROVRequestInput,
  UpdateROVResearchInput,
  SubmitROVResponseInput,
  ROVFilters,
  ROVStatus,
  ROVRequestorType,
  ROVChallengeReason,
  ROVDecision
} from '../types/rov.types.js';

export class ROVController {
  private rovService: ROVManagementService;
  private logger: Logger;
  private webPubSub: WebPubSubService | null = null;

  constructor() {
    this.rovService = new ROVManagementService();
    this.logger = new Logger();
    try {
      this.webPubSub = new WebPubSubService();
    } catch {
      this.logger.warn('WebPubSub unavailable — ROV notifications disabled');
    }
  }

  /**
   * Best-effort ROV lifecycle broadcast.
   */
  private async broadcastROVEvent(
    tenantId: string,
    eventType: string,
    title: string,
    message: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!this.webPubSub) return;
    try {
      await this.webPubSub.sendToGroup(`tenant:${tenantId}`, {
        id: `rov-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title,
        message,
        priority: EventPriority.HIGH,
        category: EventCategory.ROV,
        targets: [],
        data: { eventType, tenantId, ...data },
      });
    } catch (err) {
      this.logger.warn('WebPubSub ROV broadcast failed', { eventType, error: err instanceof Error ? err.message : String(err) });
    }
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
        ...(req.body.engagementId !== undefined && { engagementId: req.body.engagementId }),
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
        await this.broadcastROVEvent(tenantId, 'rov.created', 'ROV Request Created', `New ROV request submitted for order ${input.orderId}`, { rovId: result.data?.id, orderId: input.orderId });
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
      const tenantId = (req as any).user?.tenantId || 'default-tenant';

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
        await this.broadcastROVEvent(tenantId, 'rov.assigned', 'ROV Request Assigned', `ROV request ${id} assigned to ${assignedTo}`, { rovId: id, assignedTo, assignedToEmail });
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
      const tenantId = (req as any).user?.tenantId || 'default-tenant';

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
        await this.broadcastROVEvent(tenantId, 'rov.decision_issued', 'ROV Decision Issued', `ROV request ${id} decision: ${input.decision}`, { rovId: id, decision: input.decision, newValue: input.newValue });
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

  /**
   * POST /api/rov/requests/:id/triage
   * Manually trigger (or re-trigger) AI triage for an ROV request.
   * Triage is also triggered automatically on creation; this endpoint
   * allows coordinators to request a fresh analysis after evidence is updated.
   */
  triggerAITriage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      if (!id) {
        res.status(400).json({ success: false, error: 'ROV id is required' });
        return;
      }
      const requestedBy: string = (req as any).user?.email ?? (req as any).user?.id ?? 'coordinator';
      this.logger.info('Manual AI triage triggered', { rovId: id, requestedBy });

      const result = await this.rovService.performAITriage(id, requestedBy);

      if (result.success) {
        res.json({
          success: true,
          data: result.analysis,
          message: 'AI triage completed successfully',
        });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      this.logger.error('Error in triggerAITriage endpoint', { error, rovId: req.params.id });
      next(error);
    }
  };

  /**
   * POST /api/rov/requests/:id/withdraw
   * Requestor withdraws the reconsideration request.
   */
  withdrawROVRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, error: 'ROV ID is required' }); return; }

      const withdrawnBy = (req as any).user?.id || 'system';
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      const reason: string = req.body.reason || 'No reason provided';

      const result = await this.rovService.withdrawROVRequest(id, withdrawnBy, reason);
      if (result.success) {
        await this.broadcastROVEvent(tenantId, 'rov.withdrawn', 'ROV Request Withdrawn', `ROV request ${id} has been withdrawn`, { rovId: id, reason });
        res.json({ success: true, data: result.data, message: 'ROV request withdrawn' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      this.logger.error('Error in withdrawROVRequest endpoint', { error, rovId: req.params.id });
      next(error);
    }
  };

  /**
   * POST /api/rov/requests/:id/escalate
   * Escalate an ROV request to senior management or compliance.
   */
  escalateROVRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, error: 'ROV ID is required' }); return; }
      if (!req.body.reason) { res.status(400).json({ success: false, error: 'reason is required' }); return; }

      const escalatedBy = (req as any).user?.id || 'system';
      const tenantId = (req as any).user?.tenantId || 'default-tenant';

      const result = await this.rovService.escalateROVRequest(id, escalatedBy, req.body.reason as string);
      if (result.success) {
        await this.broadcastROVEvent(tenantId, 'rov.escalated', 'ROV Request Escalated', `ROV request ${id} escalated to senior management`, { rovId: id, reason: req.body.reason, escalatedBy });
        res.json({ success: true, data: result.data, message: 'ROV request escalated' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      this.logger.error('Error in escalateROVRequest endpoint', { error, rovId: req.params.id });
      next(error);
    }
  };

  /**
   * GET /api/rov/requests/:id/timeline
   * Return the ordered audit timeline for an ROV request.
   */
  getROVTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, error: 'ROV ID is required' }); return; }

      const result = await this.rovService.getROVById(id);
      if (!result.success || !result.data) {
        res.status(404).json({ success: false, error: 'ROV request not found' });
        return;
      }

      res.json({ success: true, data: result.data.timeline, total: result.data.timeline.length });
    } catch (error) {
      this.logger.error('Error in getROVTimeline endpoint', { error, rovId: req.params.id });
      next(error);
    }
  };

  /**
   * PATCH /api/rov/requests/:id/deadline
   * Update the SLA due date on an ROV (e.g. regulatory extension granted).
   * Body: { newDueDate: ISO string }
   */
  updateROVDeadline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, error: 'ROV ID is required' }); return; }
      if (!req.body.newDueDate) { res.status(400).json({ success: false, error: 'newDueDate is required (ISO string)' }); return; }

      const newDueDate = new Date(req.body.newDueDate as string);
      if (isNaN(newDueDate.getTime())) {
        res.status(400).json({ success: false, error: `Invalid newDueDate: ${req.body.newDueDate}` });
        return;
      }

      const updatedBy = (req as any).user?.id || 'system';
      const tenantId = (req as any).user?.tenantId || 'default-tenant';

      const result = await this.rovService.updateROVDeadline(id, newDueDate, updatedBy);
      if (result.success) {
        await this.broadcastROVEvent(tenantId, 'rov.deadline_updated', 'ROV Deadline Updated', `SLA deadline for ROV ${id} updated to ${newDueDate.toDateString()}`, { rovId: id, newDueDate: newDueDate.toISOString() });
        res.json({ success: true, data: result.data, message: 'ROV deadline updated' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      this.logger.error('Error in updateROVDeadline endpoint', { error, rovId: req.params.id });
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
  router.post('/requests/:id/triage', controller.triggerAITriage);
  router.post('/requests/:id/withdraw', controller.withdrawROVRequest);
  router.post('/requests/:id/escalate', controller.escalateROVRequest);
  router.get('/requests/:id/timeline', controller.getROVTimeline);
  router.patch('/requests/:id/deadline', controller.updateROVDeadline);

  // ROV analytics
  router.get('/metrics', controller.getROVMetrics);

  return router;
}
