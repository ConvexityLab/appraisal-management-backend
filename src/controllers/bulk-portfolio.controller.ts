/**
 * Bulk Portfolio Controller
 *
 * Routes:
 *   POST  /api/bulk-portfolios/submit                            → submit bulk order batch or tape evaluation
 *   GET   /api/bulk-portfolios                                   → list jobs for tenant
 *   GET   /api/bulk-portfolios/:jobId                            → get single job with full item results
 *   GET   /api/bulk-portfolios/:jobId/review-results             → tape evaluation results for a job
 *   GET   /api/bulk-portfolios/:jobId/axiom-status               → per-order Axiom status map (ORDER_CREATION jobs)
 *   PATCH /api/bulk-portfolios/:jobId/review-results/:loanNumber → update reviewer notes / decision override
 *   POST  /api/bulk-portfolios/:jobId/create-orders              → convert eligible tape results into orders
 *   GET   /api/bulk-portfolios/:jobId/extraction-progress        → poll async extraction job progress
 */

import express, { Response } from 'express';
import multer from 'multer';
import { body, param, query, validationResult } from 'express-validator';
import { BulkPortfolioService } from '../services/bulk-portfolio.service.js';
import type { BulkJobAxiomStatusItem, AttachDocumentsResult } from '../services/bulk-portfolio.service.js';
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
  body('engagementId').optional().isString().notEmpty().withMessage('engagementId must be a non-empty string'),
  body('engagementGranularity')
    .optional()
    .isIn(['PER_BATCH', 'PER_LOAN'])
    .withMessage('engagementGranularity must be PER_BATCH or PER_LOAN'),
  body('engagementGranularity').custom((value, { req }) => {
    if (value == null) {
      return true;
    }

    const processingMode = req.body.processingMode ?? 'ORDER_CREATION';
    if (processingMode !== 'ORDER_CREATION') {
      throw new Error('engagementGranularity is only supported for ORDER_CREATION submissions');
    }

    if (req.body.engagementId && value === 'PER_LOAN') {
      throw new Error('engagementGranularity PER_LOAN cannot be used when engagementId is provided');
    }

    return true;
  }),
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
  // Multer for Scenario B / C document uploads — stored in memory, 50 MB cap
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      // Accept any file — callers should send PDFs but we don't reject other types
      cb(null, true);
    },
  });
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
   * POST /:jobId/create-orders
   *
   * Convert eligible ReviewTapeResult rows from a completed TAPE_EVALUATION job
   * into AppraisalOrders.  Eligible rows are those with computedDecision (or
   * overrideDecision) of 'Accept' or 'Conditional' that do not yet have an orderId.
   *
   * Idempotent: rows that already have an orderId are silently skipped.
   *
   * Returns:
   *   201 { created, skipped, failed, results[] }
   */
  router.post(
    '/:jobId/create-orders',
    param('jobId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const submittedBy = req.user?.id ?? 'unknown';
        const service = getService(dbService);

        const summary = await service.createOrdersFromResults(
          req.params['jobId']!,
          tenantId,
          submittedBy,
        );

        return res.status(201).json(summary);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('not found')) {
          return res.status(404).json({ error: msg });
        }
        if (msg.includes('not a tape evaluation') || msg.includes('status')) {
          return res.status(400).json({ error: msg });
        }
        logger.error('Bulk portfolio create-orders error', { error: err });
        return res.status(500).json({ error: 'Failed to create orders from results', message: msg });
      }
    },
  );

  /**
   * GET /:jobId/axiom-status
   *
   * Returns a map of orderId → { axiomStatus, axiomRiskScore?, axiomEvaluationId }
   * for all rows in an ORDER_CREATION job that have a CREATED status.
   * Intended to be polled by the UI at ~15 s intervals until all rows reach
   * a terminal evaluation state (completed | failed).
   */
  router.get(
    '/:jobId/axiom-status',
    param('jobId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const service = getService(dbService);
        const statusMap: Record<string, BulkJobAxiomStatusItem> =
          await service.getJobAxiomStatus(req.params['jobId']!, tenantId);
        return res.json(statusMap);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('not found')) {
          return res.status(404).json({ error: msg });
        }
        logger.error('Bulk portfolio axiom-status error', { error: err });
        return res.status(500).json({ error: 'Failed to retrieve Axiom status' });
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

  /**
   * POST /:jobId/attach-documents
   *
   * Scenarios B & C — attach one or more PDF files to orders in a completed
   * ORDER_CREATION job.  Each file must be named <loanNumber>.<ext> so the
   * backend can match it to the right order (e.g. "LN-12345.pdf").
   *
   * Multipart field: "files" (one or more).
   *
   * Returns 200 { uploaded, failed, noOrder, results[] }.
   */
  router.post(
    '/:jobId/attach-documents',
    param('jobId').isString().notEmpty(),
    upload.array('files', 200),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded — include at least one file under the "files" field' });
      }

      try {
        const tenantId = resolveTenantId(req);
        const uploadedBy = req.user?.id ?? 'unknown';
        const service = getService(dbService);

        const result: AttachDocumentsResult = await service.attachDocumentsToJob(
          req.params['jobId']!,
          tenantId,
          files.map((f) => ({
            buffer: f.buffer,
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size,
          })),
          uploadedBy,
        );

        return res.status(200).json(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('not found')) {
          return res.status(404).json({ error: msg });
        }
        if (msg.includes('ORDER_CREATION')) {
          return res.status(400).json({ error: msg });
        }
        logger.error('Bulk portfolio attach-documents error', { error: err });
        return res.status(500).json({ error: 'Failed to attach documents', message: msg });
      }
    },
  );

  return router;
}
