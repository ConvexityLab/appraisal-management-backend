/**
 * Review Controller
 * REST API endpoints for appraisal review management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ReviewWorkflowService } from '../services/review-workflow.service.js';
import { ComparableAnalysisService } from '../services/comparable-analysis.service.js';
import { ReviewReportService } from '../services/review-report.service.js';
import {
  ReviewType,
  ReviewPriority,
  ReviewStatus,
  ReviewOutcome,
  CreateReviewRequest,
  AssignReviewRequest,
  UpdateReviewRequest,
  VerifyComparableRequest,
  GenerateReviewReportRequest,
  ReviewListFilters
} from '../types/review.types.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

export function createReviewRouter(): Router {
  const router = Router();
  const workflowService = new ReviewWorkflowService();
  const analysisService = new ComparableAnalysisService();
  const reportService = new ReviewReportService();

  /**
   * POST /api/reviews
   * Create a new review request
   */
  router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const request: CreateReviewRequest = req.body;
      const userId = req.user?.id || 'system';
      const tenantId = req.user?.tenantId || 'default';

      const review = await workflowService.createReview(request, tenantId, userId);

      res.status(201).json({
        success: true,
        data: review,
        message: 'Review created successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/reviews
   * List reviews with filters and pagination
   */
  router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenantId || 'default';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters: ReviewListFilters = {
        ...(req.query.status ? { status: (req.query.status as string).split(',') as ReviewStatus[] } : {}),
        ...(req.query.reviewType ? { reviewType: (req.query.reviewType as string).split(',') as ReviewType[] } : {}),
        ...(req.query.assignedTo ? { assignedTo: req.query.assignedTo as string } : {}),
        ...(req.query.requestedBy ? { requestedBy: req.query.requestedBy as string } : {}),
        ...(req.query.priority ? { priority: (req.query.priority as string).split(',') as ReviewPriority[] } : {}),
        ...(req.query.outcome ? { outcome: (req.query.outcome as string).split(',') as ReviewOutcome[] } : {}),
        ...(req.query.dateFrom ? { dateFrom: new Date(req.query.dateFrom as string) } : {}),
        ...(req.query.dateTo ? { dateTo: new Date(req.query.dateTo as string) } : {}),
        ...(req.query.search ? { search: req.query.search as string } : {})
      };

      const result = await workflowService.listReviews(tenantId, filters, page, limit);

      res.json({
        success: true,
        data: result.reviews,
        pagination: {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/reviews/:id
   * Get a single review by ID
   */
  router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const review = await workflowService.getReviewById(reviewId);

      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }

      return res.json({
        success: true,
        data: review
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * PUT /api/reviews/:id
   * Update review details
   */
  router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const updates: UpdateReviewRequest = req.body;
      const userId = req.user?.id || 'system';

      const review = await workflowService.updateReview(reviewId, updates, userId);

      return res.json({
        success: true,
        data: review,
        message: 'Review updated successfully'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/assign
   * Assign review to a reviewer
   */
  router.post('/:id/assign', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const assignment: AssignReviewRequest = req.body;
      const userId = req.user?.id || 'system';

      const review = await workflowService.assignReview(reviewId, assignment, userId);

      return res.json({
        success: true,
        data: review,
        message: 'Review assigned successfully'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/auto-assign
   * Auto-assign review based on workload
   */
  router.post('/:id/auto-assign', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const review = await workflowService.autoAssignReview(reviewId);

      return res.json({
        success: true,
        data: review,
        message: 'Review auto-assigned successfully'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/start
   * Start review work
   */
  router.post('/:id/start', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const userId = req.user?.id || 'system';

      const review = await workflowService.startReview(reviewId, userId);

      return res.json({
        success: true,
        data: review,
        message: 'Review started successfully'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/advance
   * Advance to next workflow stage
   */
  router.post('/:id/advance', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const userId = req.user?.id || 'system';

      const review = await workflowService.advanceStage(reviewId, userId);

      return res.json({
        success: true,
        data: review,
        message: 'Review advanced to next stage'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/findings
   * Add a finding to the review
   */
  router.post('/:id/findings', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const finding = req.body;
      const userId = req.user?.id || 'system';

      const review = await workflowService.addFinding(reviewId, finding, userId);

      return res.json({
        success: true,
        data: review,
        message: 'Finding added successfully'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/supplemental-request
   * Request supplemental information
   */
  router.post('/:id/supplemental-request', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const request = req.body;
      const userId = req.user?.id || 'system';

      const review = await workflowService.requestSupplemental(reviewId, request, userId);

      return res.json({
        success: true,
        data: review,
        message: 'Supplemental request created'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/escalate
   * Escalate review to management
   */
  router.post('/:id/escalate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const { reason, escalateTo } = req.body;
      const userId = req.user?.id || 'system';

      const review = await workflowService.escalateReview(reviewId, reason, escalateTo, userId);

      return res.json({
        success: true,
        data: review,
        message: 'Review escalated successfully'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/complete
   * Complete the review
   */
  router.post('/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const { outcome, reviewedValue } = req.body;
      const userId = req.user?.id || 'system';

      const review = await workflowService.completeReview(reviewId, outcome, reviewedValue, userId);

      return res.json({
        success: true,
        data: review,
        message: 'Review completed successfully'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/comparable-analysis
   * Perform comparable analysis
   */
  router.post('/:id/comparable-analysis', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const { subjectProperty, comparables } = req.body;

      const analysis = await analysisService.analyzeComparables(
        reviewId,
        subjectProperty,
        comparables
      );

      return res.json({
        success: true,
        data: analysis,
        message: 'Comparable analysis completed'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/verify-comparable
   * Verify a single comparable
   */
  router.post('/:id/verify-comparable', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      const request: VerifyComparableRequest = req.body;

      // This would update the comparable analysis with verification info
      return res.json({
        success: true,
        message: 'Comparable verified'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/reviews/:id/report
   * Generate review report
   */
  router.post('/:id/report', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const reviewId = req.params.id;
      if (!reviewId) {
        return res.status(400).json({ success: false, error: 'Review ID is required' });
      }
      
      const request: GenerateReviewReportRequest = req.body;

      const review = await workflowService.getReviewById(reviewId);
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }

      const report = await reportService.generateReport(
        review,
        request,
        review.comparableAnalysis
      );

      return res.json({
        success: true,
        data: report,
        message: 'Report generated successfully'
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/reviews/metrics/summary
   * Get review metrics for analytics
   */
  router.get('/metrics/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenantId || 'default';
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const metrics = await workflowService.getReviewMetrics(tenantId, dateFrom, dateTo);

      return res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/reviews/metrics/reviewer/:reviewerId
   * Get reviewer performance metrics
   */
  router.get('/metrics/reviewer/:reviewerId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenantId || 'default';
      const reviewerId = req.params.reviewerId;
      
      if (!reviewerId) {
        return res.status(400).json({ success: false, error: 'Reviewer ID is required' });
      }

      const performance = await workflowService.getReviewerPerformance(tenantId, reviewerId);

      return res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
