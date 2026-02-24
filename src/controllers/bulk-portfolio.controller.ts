/**
 * Bulk Portfolio Controller
 *
 * Routes:
 *   POST  /api/bulk-portfolios/submit                            → submit bulk order batch or tape evaluation
 *   GET   /api/bulk-portfolios                                   → list jobs for tenant
 *   GET   /api/bulk-portfolios/:jobId                            → get single job with full item results
 *   GET   /api/bulk-portfolios/:jobId/review-results             → tape evaluation results for a job
 *   PATCH /api/bulk-portfolios/:jobId/review-results/:loanNumber → update reviewer notes / decision override
 *   GET   /api/bulk-portfolios/:jobId/extraction-progress        → poll async extraction job progress
 */

import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { BulkPortfolioService } from '../services/bulk-portfolio.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

const router = express.Router();
const logger = new Logger();

// Service is instantiated once during module load, after CosmosDbService is ready
let _service: BulkPortfolioService | null = null;

function getService(dbService: CosmosDbService): BulkPortfolioService {
  if (!_service) {
    _service = new BulkPortfolioService(dbService);
  }
  return _service;
}

function resolveTenantId(req: UnifiedAuthRequest): string {
  const tid =
    req.user?.tenantId ??
    (req.headers['x-tenant-id'] as string | undefined);
  if (!tid) {
    throw new Error(
      'Tenant ID is required but was not found in the auth token or x-tenant-id header',
    );
  }
  return tid;
}

// ─── POST /submit ─────────────────────────────────────────────────────────────

const validateSubmit = [
  body('clientId').isString().notEmpty().withMessage('clientId is required'),
  body('fileName').optional().isString(),
  body('processingMode')
    .optional()
    .isIn(['TAPE_EVALUATION', 'ORDER_CREATION', 'DOCUMENT_EXTRACTION'])
    .withMessage('processingMode must be TAPE_EVALUATION, ORDER_CREATION, or DOCUMENT_EXTRACTION'),
  // reviewProgramId required when processingMode is TAPE_EVALUATION
  body('reviewProgramId')
    .if(body('processingMode').equals('TAPE_EVALUATION'))
    .notEmpty()
    .withMessage('reviewProgramId is required for tape evaluation'),
  body('items').isArray({ min: 1, max: 500 }).withMessage('items must be an array of 1–500 rows'),
  // ORDER_CREATION-only validators — skipped entirely for tape evaluation
  body('items.*.analysisType')
    .if(body('processingMode').not().equals('TAPE_EVALUATION'))
    .isIn(['AVM', 'FRAUD', 'ANALYSIS_1033', 'QUICK_REVIEW', 'DVR', 'ROV'])
    .withMessage('Each item must have a valid analysisType'),
  body('items.*.propertyAddress')
    .if(body('processingMode').not().equals('TAPE_EVALUATION'))
    .isString()
    .notEmpty(),
  body('items.*.city')
    .if(body('processingMode').not().equals('TAPE_EVALUATION'))
    .isString()
    .notEmpty(),
  body('items.*.state')
    .if(body('processingMode').not().equals('TAPE_EVALUATION'))
    .isString()
    .isLength({ min: 2, max: 2 }),
  body('items.*.zipCode')
    .if(body('processingMode').not().equals('TAPE_EVALUATION'))
    .matches(/^\d{5}(-\d{4})?$/),
  body('items.*.borrowerFirstName')
    .if(body('processingMode').not().equals('TAPE_EVALUATION'))
    .isString()
    .notEmpty(),
  body('items.*.borrowerLastName')
    .if(body('processingMode').not().equals('TAPE_EVALUATION'))
    .isString()
    .notEmpty(),
];

export function createBulkPortfolioRouter(dbService: CosmosDbService) {
  /**
   * POST /submit
   * Body: BulkSubmitRequest
   */
  router.post(
    '/submit',
    ...validateSubmit,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const submittedBy = req.user?.id ?? 'unknown';
        const service = getService(dbService);

        const job = await service.submit(req.body, submittedBy, tenantId);

        return res.status(201).json({
          job,
          message: `Batch submitted: ${job.successCount} created, ${job.failCount} failed, ${job.skippedCount} skipped`,
        });
      } catch (err) {
        logger.error('Bulk portfolio submit error', { error: err });
        return res.status(500).json({
          error: 'Bulk submission failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * GET /
   * Query params: clientId (optional)
   * Returns the 50 most recent jobs for the authenticated tenant.
   */
  router.get(
    '/',
    query('clientId').optional().isString(),
    async (req: UnifiedAuthRequest, res: Response) => {
      try {
        const tenantId = resolveTenantId(req);
        const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
        const service = getService(dbService);

        const jobs = await service.getJobs(tenantId, clientId);

        // Strip the items array from the list view to keep response lean
        const summaries = jobs.map(({ items: _items, ...rest }) => rest);
        return res.json(summaries);
      } catch (err) {
        logger.error('Bulk portfolio list error', { error: err });
        return res.status(500).json({ error: 'Failed to retrieve jobs' });
      }
    },
  );

  /**
   * GET /:jobId
   * Returns full job including per-row results.
   */
  router.get(
    '/:jobId',
    param('jobId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const service = getService(dbService);

        const job = await service.getJob(req.params['jobId']!, tenantId);
        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        return res.json(job);
      } catch (err) {
        logger.error('Bulk portfolio get job error', { error: err });
        return res.status(500).json({ error: 'Failed to retrieve job' });
      }
    },
  );

  /**
   * GET /:jobId/review-results
   * Returns the tape evaluation results for a TAPE_EVALUATION job.
   * The items array contains ReviewTapeResult[] including per-loan flag
   * breakdown and risk scores.
   */
  router.get(
    '/:jobId/review-results',
    param('jobId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const service = getService(dbService);

        const job = await service.getJob(req.params['jobId']!, tenantId);
        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        if (job.processingMode !== 'TAPE_EVALUATION') {
          return res.status(400).json({
            error: 'This job is not a tape evaluation job',
            processingMode: job.processingMode ?? 'ORDER_CREATION',
          });
        }

        return res.json({
          jobId: job.id,
          programId: job.reviewProgramId,
          programVersion: job.reviewProgramVersion,
          summary: job.reviewSummary,
          results: job.items,
        });
      } catch (err) {
        logger.error('Bulk portfolio review-results error', { error: err });
        return res.status(500).json({ error: 'Failed to retrieve review results' });
      }
    },
  );

  /**
   * PATCH /:jobId/review-results/:loanNumber
   * Update reviewer notes and/or override decision for a single tape result.
   * Body: { reviewerNotes?: string; overrideDecision?: 'Accept'|'Conditional'|'Reject'|null; overrideReason?: string }
   */
  router.patch(
    '/:jobId/review-results/:loanNumber',
    param('jobId').isString().notEmpty(),
    param('loanNumber').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { overrideDecision, overrideReason } = req.body as {
        reviewerNotes?: string;
        overrideDecision?: string | null;
        overrideReason?: string;
      };

      // Validate overrideDecision value when present and non-null
      if (overrideDecision != null && !['Accept', 'Conditional', 'Reject'].includes(overrideDecision)) {
        return res.status(400).json({
          error: `overrideDecision must be 'Accept', 'Conditional', 'Reject', or null — got '${overrideDecision}'`,
        });
      }

      // overrideReason is required whenever a (non-null) decision override is being set
      if (overrideDecision != null && (!overrideReason || !overrideReason.trim())) {
        return res.status(400).json({
          error: 'overrideReason is required and must be non-empty when overrideDecision is set',
        });
      }

      try {
        const tenantId = resolveTenantId(req);
        const patchedBy = req.user?.id ?? 'unknown';
        const service = getService(dbService);

        const updated = await service.patchReviewResult(
          req.params['jobId']!,
          decodeURIComponent(req.params['loanNumber']!),
          {
            ...(req.body.reviewerNotes !== undefined && { reviewerNotes: req.body.reviewerNotes as string }),
            ...(overrideDecision !== undefined && { overrideDecision: overrideDecision as ('Accept' | 'Conditional' | 'Reject' | null) }),
            ...(req.body.overrideReason !== undefined && { overrideReason: req.body.overrideReason as string }),
          },
          tenantId,
          patchedBy,
        );

        return res.json(updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('not found')) {
          return res.status(404).json({ error: msg });
        }
        logger.error('Bulk portfolio patch review result error', { error: err });
        return res.status(500).json({ error: 'Failed to update review result' });
      }
    },
  );

  /**
   * GET /:jobId/extraction-progress
   *
   * Polls Axiom's aiInsights Cosmos cache for completed TAPE_EXTRACTION records
   * and processes any that have finished since the last call.  Use this endpoint
   * in mock/dev mode (no real Axiom webhook) to drive a DOCUMENT_EXTRACTION job
   * forward.  In production Axiom posts directly to /api/axiom/webhook/extraction.
   *
   * Returns the latest job state (same shape as GET /:jobId).
   */
  router.get(
    '/:jobId/extraction-progress',
    param('jobId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const service = getService(dbService);
        const job = await service.checkExtractionProgress(req.params['jobId']!);
        return res.json(job);
      } catch (err) {
        logger.error('Bulk portfolio extraction-progress error', { error: err });
        return res
          .status(500)
          .json({ error: 'Failed to check extraction progress' });
      }
    },
  );

  return router;
}
