/**
 * QC Workflow Controller
 * 
 * REST API endpoints for QC workflow automation:
 * - QC Review Queue Management
 * - Revision Management
 * - Escalation Workflow
 * - SLA Tracking
 */

import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { QCReviewQueueService } from '../services/qc-review-queue.service.js';
import { RevisionManagementService } from '../services/revision-management.service.js';
import { EscalationWorkflowService } from '../services/escalation-workflow.service.js';
import { SLATrackingService } from '../services/sla-tracking.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { RevisionSeverity, CreateRevisionRequest } from '../types/qc-workflow.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();
const logger = new Logger();

// Initialize services
const qcQueueService = new QCReviewQueueService();
const revisionService = new RevisionManagementService();
const escalationService = new EscalationWorkflowService();
const slaService = new SLATrackingService();
const dbService = new CosmosDbService();

/** Map a QC score to a RevisionSeverity for the revision request */
function mapScoreToSeverity(score?: number): RevisionSeverity {
  if (score == null) return RevisionSeverity.MODERATE;
  if (score < 30) return RevisionSeverity.CRITICAL;
  if (score < 50) return RevisionSeverity.MAJOR;
  if (score < 70) return RevisionSeverity.MODERATE;
  return RevisionSeverity.MINOR;
}

// Middleware to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: Function): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// ===========================
// QC REVIEW QUEUE ENDPOINTS
// ===========================

/**
 * GET /api/qc-workflow/queue
 * Get QC review queue with filters
 */
router.get(
  '/queue',
  [
    query('status').optional().isString(),
    query('priorityLevel').optional().isString(),
    query('assignedAnalystId').optional().isString(),
    query('slaBreached').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const criteria: any = {
        status: req.query.status ? [req.query.status] : undefined,
        priorityLevel: req.query.priorityLevel ? [req.query.priorityLevel] : undefined,
        assignedAnalystId: req.query.assignedAnalystId as string,
        slaBreached: req.query.slaBreached === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const queueItems = await qcQueueService.searchQueue(criteria);

      return res.json(queueItems);

    } catch (error) {
      logger.error('Failed to get queue', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve QC queue',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * GET /api/qc-workflow/queue/statistics
 * Get queue statistics
 */
router.get('/queue/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await qcQueueService.getQueueStatistics();

    return res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get queue statistics', { error });
    // Return empty stats instead of 500 error if container doesn't exist
    return res.json({
      success: true,
      data: {
        total: 0,
        pending: 0,
        inReview: 0,
        completed: 0,
        breached: 0,
        averageWaitTime: 0,
        longestWaitTime: 0,
        byPriority: {
          'CRITICAL': 0,
          'HIGH': 0,
          'MEDIUM': 0,
          'LOW': 0
        }
      }
    });
  }
});

/**
 * POST /api/qc-workflow/queue/assign
 * Assign review to analyst
 */
router.post(
  '/queue/assign',
  [
    body('queueItemId').notEmpty(),
    body('analystId').notEmpty(),
    body('notes').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const queueItem = await qcQueueService.assignReview(
        req.body.queueItemId,
        req.body.analystId,
        req.body.notes
      );

      return res.json({
        success: true,
        data: queueItem,
        message: 'Review assigned successfully'
      });

    } catch (error) {
      logger.error('Failed to assign review', { error });
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign review'
      });
    }
  }
);

/**
 * POST /api/qc-workflow/queue/auto-assign
 * Auto-assign reviews to balance workload
 */
router.post('/queue/auto-assign', async (req: Request, res: Response) => {
  try {
    const assignedCount = await qcQueueService.autoAssignReviews();

    return res.json({
      success: true,
      data: { assignedCount },
      message: `Auto-assigned ${assignedCount} reviews`
    });

  } catch (error) {
    logger.error('Failed to auto-assign reviews', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to auto-assign reviews'
    });
  }
});

/**
 * GET /api/qc-workflow/queue/next/:analystId
 * Get next review for analyst
 */
router.get(
  '/queue/next/:analystId',
  [param('analystId').notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const nextReview = await qcQueueService.getNextReview(req.params.analystId!);

      if (!nextReview) {
        return res.json({
          success: true,
          data: null,
          message: 'No pending reviews available'
        });
      }

      return res.json({
        success: true,
        data: nextReview
      });

    } catch (error) {
      logger.error('Failed to get next review', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to get next review'
      });
    }
  }
);

/**
 * GET /api/qc-workflow/analysts/workload
 * Get all analysts with workload
 */
router.get('/analysts/workload', async (req: Request, res: Response) => {
  try {
    const workloads = await qcQueueService.getAllAnalystWorkloads();

    return res.json({
      success: true,
      data: workloads
    });

  } catch (error) {
    logger.error('Failed to get analyst workloads', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve analyst workloads'
    });
  }
});

// ===========================
// REVISION MANAGEMENT ENDPOINTS
// ===========================

/**
 * POST /api/qc-workflow/revisions
 * Create revision request
 */
router.post(
  '/revisions',
  [
    body('orderId').notEmpty(),
    body('appraisalId').notEmpty(),
    body('qcReportId').notEmpty(),
    body('severity').isIn(['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL']),
    body('dueDate').optional().isISO8601(),
    body('issues').isArray({ min: 1 }),
    body('requestNotes').notEmpty(),
    body('requestedBy').notEmpty()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const revision = await revisionService.createRevisionRequest({
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined
      });

      return res.status(201).json({
        success: true,
        data: revision,
        message: 'Revision request created successfully'
      });

    } catch (error) {
      logger.error('Failed to create revision', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to create revision request'
      });
    }
  }
);

/**
 * POST /api/qc-workflow/revisions/:revisionId/submit
 * Submit revised appraisal
 */
router.post(
  '/revisions/:revisionId/submit',
  [
    param('revisionId').notEmpty(),
    body('responseNotes').notEmpty(),
    body('submittedBy').notEmpty(),
    body('resolvedIssues').isArray()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const revision = await revisionService.submitRevision({
        revisionId: req.params.revisionId!,
        responseNotes: req.body.responseNotes,
        submittedBy: req.body.submittedBy,
        resolvedIssues: req.body.resolvedIssues
      });

      return res.json({
        success: true,
        data: revision,
        message: 'Revision submitted successfully - auto re-QC triggered'
      });

    } catch (error) {
      logger.error('Failed to submit revision', { error });
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit revision'
      });
    }
  }
);

/**
 * POST /api/qc-workflow/revisions/:revisionId/accept
 * Accept revision
 */
router.post(
  '/revisions/:revisionId/accept',
  [
    param('revisionId').notEmpty(),
    body('acceptedBy').notEmpty(),
    body('notes').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const revision = await revisionService.acceptRevision(
        req.params.revisionId!,
        req.body.acceptedBy,
        req.body.notes
      );

      return res.json({
        success: true,
        data: revision,
        message: 'Revision accepted'
      });

    } catch (error) {
      logger.error('Failed to accept revision', { error });
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to accept revision'
      });
    }
  }
);

/**
 * POST /api/qc-workflow/revisions/:revisionId/reject
 * Reject revision (needs more work)
 */
router.post(
  '/revisions/:revisionId/reject',
  [
    param('revisionId').notEmpty(),
    body('rejectedBy').notEmpty(),
    body('reason').notEmpty()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const revision = await revisionService.rejectRevision(
        req.params.revisionId!,
        req.body.rejectedBy,
        req.body.reason
      );

      return res.json({
        success: true,
        data: revision,
        message: 'Revision rejected - appraiser notified'
      });

    } catch (error) {
      logger.error('Failed to reject revision', { error });
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject revision'
      });
    }
  }
);

/**
 * GET /api/qc-workflow/revisions/order/:orderId/history
 * Get revision history for order
 */
router.get(
  '/revisions/order/:orderId/history',
  [param('orderId').notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const history = await revisionService.getRevisionHistory(req.params.orderId!);

      return res.json({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Failed to get revision history', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve revision history'
      });
    }
  }
);

/**
 * GET /api/qc-workflow/revisions/active
 * Get all active revisions
 */
router.get('/revisions/active', async (req: Request, res: Response) => {
  try {
    const revisions = await revisionService.getActiveRevisions();

    return res.json({
      success: true,
      data: revisions,
      count: revisions.length
    });

  } catch (error) {
    logger.error('Failed to get active revisions', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve active revisions'
    });
  }
});

/**
 * GET /api/qc-workflow/revisions/overdue
 * Get overdue revisions
 */
router.get('/revisions/overdue', async (req: Request, res: Response) => {
  try {
    const revisions = await revisionService.getOverdueRevisions();

    return res.json({
      success: true,
      data: revisions,
      count: revisions.length
    });

  } catch (error) {
    logger.error('Failed to get overdue revisions', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve overdue revisions'
    });
  }
});

// ===========================
// ESCALATION WORKFLOW ENDPOINTS
// ===========================

/**
 * POST /api/qc-workflow/escalations
 * Create escalation
 */
router.post(
  '/escalations',
  [
    body('orderId').notEmpty(),
    body('escalationType').isIn([
      'QC_DISPUTE', 'SLA_BREACH', 'COMPLEX_CASE', 'REVISION_FAILURE',
      'FRAUD_SUSPECTED', 'COMPLIANCE_ISSUE', 'CLIENT_COMPLAINT'
    ]),
    body('priority').isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    body('title').notEmpty(),
    body('description').notEmpty(),
    body('raisedBy').notEmpty()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const escalation = await escalationService.createEscalation(req.body);

      return res.status(201).json({
        success: true,
        data: escalation,
        message: 'Escalation created and assigned'
      });

    } catch (error) {
      logger.error('Failed to create escalation', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to create escalation'
      });
    }
  }
);

/**
 * GET /api/qc-workflow/escalations/open
 * Get all open escalations
 */
router.get('/escalations/open', async (req: Request, res: Response) => {
  try {
    const escalations = await escalationService.getOpenEscalations();

    return res.json({
      success: true,
      data: escalations,
      count: escalations.length
    });

  } catch (error) {
    logger.error('Failed to get open escalations', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve open escalations'
    });
  }
});

/**
 * GET /api/qc-workflow/escalations/manager/:managerId
 * Get escalations assigned to manager
 */
router.get(
  '/escalations/manager/:managerId',
  [param('managerId').notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const escalations = await escalationService.getEscalationsByManager(req.params.managerId!);

      return res.json({
        success: true,
        data: escalations,
        count: escalations.length
      });

    } catch (error) {
      logger.error('Failed to get manager escalations', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve manager escalations'
      });
    }
  }
);

/**
 * POST /api/qc-workflow/escalations/:escalationId/comment
 * Add comment to escalation
 */
router.post(
  '/escalations/:escalationId/comment',
  [
    param('escalationId').notEmpty(),
    body('commentBy').notEmpty(),
    body('comment').notEmpty(),
    body('visibility').optional().isIn(['INTERNAL', 'VENDOR', 'CLIENT'])
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const escalation = await escalationService.addComment(
        req.params.escalationId!,
        req.body.commentBy,
        req.body.comment,
        req.body.visibility || 'INTERNAL'
      );

      return res.json({
        success: true,
        data: escalation,
        message: 'Comment added'
      });

    } catch (error) {
      logger.error('Failed to add comment', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to add comment'
      });
    }
  }
);

/**
 * POST /api/qc-workflow/escalations/:escalationId/resolve
 * Resolve escalation
 */
router.post(
  '/escalations/:escalationId/resolve',
  [
    param('escalationId').notEmpty(),
    body('resolution').notEmpty(),
    body('resolvedBy').notEmpty(),
    body('actions').isArray()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const escalation = await escalationService.resolveEscalation({
        escalationId: req.params.escalationId!,
        resolution: req.body.resolution,
        resolvedBy: req.body.resolvedBy,
        actions: req.body.actions
      });

      return res.json({
        success: true,
        data: escalation,
        message: 'Escalation resolved'
      });

    } catch (error) {
      logger.error('Failed to resolve escalation', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to resolve escalation'
      });
    }
  }
);

// ===========================
// SLA TRACKING ENDPOINTS
// ===========================

/**
 * POST /api/qc-workflow/sla/start
 * Start SLA tracking
 */
router.post(
  '/sla/start',
  [
    body('entityType').isIn(['QC_REVIEW', 'REVISION', 'ESCALATION']),
    body('entityId').notEmpty(),
    body('orderId').notEmpty(),
    body('orderNumber').notEmpty(),
    body('orderPriority').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const tracking = await slaService.startSLATracking(
        req.body.entityType,
        req.body.entityId,
        req.body.orderId,
        req.body.orderNumber,
        req.body.orderPriority
      );

      return res.status(201).json({
        success: true,
        data: tracking,
        message: 'SLA tracking started'
      });

    } catch (error) {
      logger.error('Failed to start SLA tracking', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to start SLA tracking'
      });
    }
  }
);

/**
 * GET /api/qc-workflow/sla/metrics
 * Get SLA metrics — must be registered BEFORE /sla/:trackingId
 */
router.get(
  '/sla/metrics',
  [
    query('period').optional().isIn(['TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR']),
    query('entityType').optional().isIn(['QC_REVIEW', 'REVISION', 'ESCALATION'])
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as string) || 'MONTH';
      const metrics = await slaService.getSLAMetrics(
        period as any,
        req.query.entityType as any
      );

      // Normalize shape for frontend: add complianceRate alias and byType mapping
      const toTypeEntry = (raw: any) => {
        const total = raw?.total ?? 0;
        const breached = raw?.breached ?? 0;
        const complianceRate = total > 0 ? ((total - breached) / total) * 100 : 100;
        return { total, breached, complianceRate };
      };

      const normalized = {
        ...metrics,
        complianceRate: metrics.onTimePercentage ?? 100,
        byType: {
          qcReview: toTypeEntry(metrics.byEntityType?.['QC_REVIEW']),
          revision: toTypeEntry(metrics.byEntityType?.['REVISION']),
          escalation: toTypeEntry(metrics.byEntityType?.['ESCALATION']),
        },
        // Convert averageCompletionTime from minutes to hours
        averageCompletionTime: (metrics.averageCompletionTime ?? 0) / 60,
      };

      return res.json({
        success: true,
        data: normalized
      });

    } catch (error: any) {
      // No sla-tracking container or no data yet — return empty metrics
      // so the dashboard renders gracefully with zeros
      logger.warn('SLA metrics unavailable (container may not exist yet), returning empty metrics', {
        errorCode: error?.code,
        statusCode: error?.statusCode,
        message: error?.message?.substring(0, 200)
      });
      const period = (req.query.period as string) || 'MONTH';
      return res.json({
        success: true,
        data: {
          period,
          totalTracked: 0,
          onTrack: 0,
          atRisk: 0,
          breached: 0,
          waived: 0,
          complianceRate: 100,
          averageCompletionTime: 0,
          onTimePercentage: 100,
          breachRate: 0,
          byType: {
            qcReview: { total: 0, breached: 0, complianceRate: 100 },
            revision: { total: 0, breached: 0, complianceRate: 100 },
            escalation: { total: 0, breached: 0, complianceRate: 100 },
          },
          byEntityType: {},
          byPriority: {}
        }
      });
    }
  }
);

/**
 * GET /api/qc-workflow/sla/:trackingId
 * Get SLA tracking status
 */
router.get(
  '/sla/:trackingId',
  [param('trackingId').notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const tracking = await slaService.updateSLAStatus(req.params.trackingId!);

      return res.json({
        success: true,
        data: tracking
      });

    } catch (error) {
      logger.error('Failed to get SLA status', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve SLA status'
      });
    }
  }
);

/**
 * POST /api/qc-workflow/sla/:trackingId/extend
 * Extend SLA deadline
 */
router.post(
  '/sla/:trackingId/extend',
  [
    param('trackingId').notEmpty(),
    body('extensionMinutes').isInt({ min: 1 }),
    body('reason').notEmpty(),
    body('extendedBy').notEmpty()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const tracking = await slaService.extendSLA({
        slaTrackingId: req.params.trackingId!,
        extensionMinutes: req.body.extensionMinutes,
        reason: req.body.reason,
        extendedBy: req.body.extendedBy
      });

      return res.json({
        success: true,
        data: tracking,
        message: `SLA extended by ${req.body.extensionMinutes} minutes`
      });

    } catch (error) {
      logger.error('Failed to extend SLA', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to extend SLA'
      });
    }
  }
);

/**
 * POST /api/qc-workflow/sla/:trackingId/waive
 * Waive SLA
 */
router.post(
  '/sla/:trackingId/waive',
  [
    param('trackingId').notEmpty(),
    body('reason').notEmpty(),
    body('waivedBy').notEmpty()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const tracking = await slaService.waiveSLA({
        slaTrackingId: req.params.trackingId!,
        reason: req.body.reason,
        waivedBy: req.body.waivedBy
      });

      return res.json({
        success: true,
        data: tracking,
        message: 'SLA waived'
      });

    } catch (error) {
      logger.error('Failed to waive SLA', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to waive SLA'
      });
    }
  }
);

// Note: export default router is at the bottom of file

// ===========================
// QUEUE RETURN & FINAL DECISION ENDPOINTS
// Phase 5.6, 5.7
// ===========================

/**
 * POST /api/qc-workflow/queue/:queueItemId/return
 * Return a review to the queue (unassign analyst)
 */
router.post(
  '/queue/:queueItemId/return',
  [
    param('queueItemId').notEmpty().withMessage('queueItemId is required'),
    body('reason').isString().notEmpty().withMessage('reason is required'),
    body('returnedBy').isString().notEmpty().withMessage('returnedBy is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const result = await qcQueueService.returnToQueue(
        req.params.queueItemId!,
        req.body.reason,
        req.body.returnedBy
      );

      return res.json({
        success: true,
        data: result,
        message: 'Review returned to queue',
      });
    } catch (error) {
      logger.error('Failed to return review to queue', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to return review to queue',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * POST /api/qc-workflow/queue/:queueItemId/decision
 * Record final review decision (approve / reject / conditional)
 */
router.post(
  '/queue/:queueItemId/decision',
  [
    param('queueItemId').notEmpty().withMessage('queueItemId is required'),
    body('outcome').isIn(['APPROVED', 'REJECTED', 'CONDITIONAL']).withMessage('outcome must be APPROVED, REJECTED, or CONDITIONAL'),
    body('reviewedBy').isString().notEmpty().withMessage('reviewedBy is required'),
    body('notes').optional().isString(),
    body('conditions').optional().isArray(),
    body('score').optional().isNumeric(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const result = await qcQueueService.completeWithDecision(
        req.params.queueItemId!,
        {
          outcome: req.body.outcome,
          reviewedBy: req.body.reviewedBy,
          notes: req.body.notes,
          conditions: req.body.conditions,
          score: req.body.score,
        }
      );

      // ── Downstream effects based on outcome ────────────────────────
      const { outcome, reviewedBy, notes, conditions, score } = req.body;

      if (outcome === 'REJECTED') {
        // 1. Transition order → REVISION_REQUESTED
        await dbService.updateOrder(result.orderId, {
          status: 'REVISION_REQUESTED' as any,
        });
        logger.info('Order transitioned to REVISION_REQUESTED', { orderId: result.orderId });

        // 2. Auto-create revision request with issues derived from the decision
        const issues: CreateRevisionRequest['issues'] = (conditions || []).map((c: string, i: number) => ({
          category: 'general',
          issueType: 'qc_finding',
          severity: mapScoreToSeverity(score),
          description: c,
          fieldName: undefined,
        }));
        // Ensure at least one issue exists (from notes if no conditions)
        if (issues.length === 0 && notes) {
          issues.push({
            category: 'general',
            issueType: 'qc_finding',
            severity: mapScoreToSeverity(score),
            description: notes,
          });
        }

        try {
          const revision = await revisionService.createRevisionRequest({
            orderId: result.orderId,
            appraisalId: result.appraisalId,
            qcReportId: result.id,
            severity: mapScoreToSeverity(score),
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days default
            issues,
            requestNotes: notes || 'QC review failed — revision required',
            requestedBy: reviewedBy,
          });
          logger.info('Auto-created revision request from QC rejection', {
            orderId: result.orderId,
            revisionId: revision.id,
          });
        } catch (revErr) {
          // Log but don't fail the decision — the order status was already updated
          logger.error('Failed to auto-create revision from QC rejection', {
            orderId: result.orderId,
            error: revErr,
          });
        }
      }

      if (outcome === 'APPROVED') {
        // Transition order → COMPLETED
        await dbService.updateOrder(result.orderId, {
          status: 'COMPLETED' as any,
        });
        logger.info('Order transitioned to COMPLETED after QC approval', { orderId: result.orderId });
      }

      return res.json({
        success: true,
        data: result,
        message: `Review ${outcome.toLowerCase()}`,
      });
    } catch (error) {
      logger.error('Failed to record review decision', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to record review decision',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

export default router;
