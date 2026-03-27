/**
 * Substantive Review Controller
 *
 * REST API endpoints for Phase 2 substantive review services:
 * - Run all 12 review services on an order
 * - Run a single review service
 * - Get review results
 */

import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { SubstantiveReviewEngine, type ReviewType } from '../services/substantive-review-engine.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();
const logger = new Logger();

const engine = new SubstantiveReviewEngine();
const dbService = new CosmosDbService();

/** Lazy-init: resolved once, shared across all route handlers */
let dbInitPromise: Promise<void> | null = null;
function ensureDb(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = dbService.initialize();
  }
  return dbInitPromise;
}

/** Cosmos container for substantive review results */
const CONTAINER = 'review-results';

const VALID_REVIEW_TYPES: ReviewType[] = [
  'bias-screening',
  'scope-lock',
  'contract-review',
  'market-analytics',
  'zoning-site',
  'improvements',
  'cost-approach',
  'income-approach',
  'reconciliation',
  'math-integrity',
  'enhanced-fraud',
  'report-compliance',
];

// Middleware to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: Function): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }
  next();
};

// ===========================
// RUN ALL REVIEWS
// ===========================

/**
 * POST /api/substantive-review/:orderId/run-all
 * Run all 12 Phase 2 review services against the order's report data
 */
router.post(
  '/:orderId/run-all',
  [
    param('orderId').isString().notEmpty().withMessage('orderId is required'),
    body('reportData').isObject().withMessage('reportData object is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const orderId = req.params.orderId as string;
    const { reportData } = req.body;

    try {
      await ensureDb();
      logger.info('Running full substantive review', { orderId });

      const result = await engine.performFullReview(orderId, reportData);

      // Persist to Cosmos DB
      // jobId = orderId so the /jobId partition key on review-results is satisfied
      const document = {
        ...result,
        id: `${orderId}-full`,
        jobId: orderId,
        type: 'substantive-review-full' as const,
      };
      await dbService.upsertDocument(CONTAINER, document);
      logger.info('Persisted full substantive review result', { orderId });

      res.json({
        success: true,
        data: result,
        message: `Substantive review completed: ${result.overallStatus} (score: ${result.overallScore})`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Full substantive review failed', { orderId, error: message });
      res.status(500).json({
        success: false,
        message: `Substantive review failed: ${message}`,
      });
    }
  }
);

// ===========================
// RUN SINGLE REVIEW
// ===========================

/**
 * POST /api/substantive-review/:orderId/:reviewType
 * Run a single Phase 2 review service
 */
router.post(
  '/:orderId/:reviewType',
  [
    param('orderId').isString().notEmpty().withMessage('orderId is required'),
    param('reviewType')
      .isString()
      .isIn(VALID_REVIEW_TYPES)
      .withMessage(`reviewType must be one of: ${VALID_REVIEW_TYPES.join(', ')}`),
    body('reportData').isObject().withMessage('reportData object is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const orderId = req.params.orderId as string;
    const reviewType = req.params.reviewType as string;
    const { reportData } = req.body;

    try {
      await ensureDb();
      logger.info('Running single substantive review', { orderId, reviewType });

      const result = await engine.performSingleReview(
        orderId,
        reviewType as ReviewType,
        reportData
      );

      // Persist to Cosmos DB
      // jobId = orderId so the /jobId partition key on review-results is satisfied
      const document = {
        ...result,
        id: `${orderId}-${reviewType}`,
        orderId,
        jobId: orderId,
        type: 'substantive-review-single' as const,
        timestamp: new Date().toISOString(),
      };
      await dbService.upsertDocument(CONTAINER, document);
      logger.info('Persisted single substantive review result', { orderId, reviewType });

      res.json({
        success: true,
        data: result,
        message: `Review "${reviewType}" completed: ${result.status}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Single substantive review failed', { orderId, reviewType, error: message });
      res.status(500).json({
        success: false,
        message: `Review "${reviewType}" failed: ${message}`,
      });
    }
  }
);

// ===========================
// LIST AVAILABLE REVIEW TYPES
// ===========================

/**
 * GET /api/substantive-review/types
 * Return all available Phase 2 review types
 */
router.get(
  '/types',
  (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: VALID_REVIEW_TYPES,
    });
  }
);

// ===========================
// GET REVIEW RESULTS
// ===========================

/**
 * GET /api/substantive-review/:orderId/results
 * Retrieve persisted substantive review results for an order.
 * Optional query param `type` filters by document type:
 *   - 'full' → substantive-review-full
 *   - 'single' → substantive-review-single
 *   - omit → all results for the order
 */
router.get(
  '/:orderId/results',
  [
    param('orderId').isString().notEmpty().withMessage('orderId is required'),
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const orderId = req.params.orderId as string;
    const typeFilter = req.query.type as string | undefined;

    try {
      await ensureDb();
      logger.info('Fetching substantive review results', { orderId, typeFilter });

      let queryStr = 'SELECT * FROM c WHERE c.orderId = @orderId';
      const params: { name: string; value: string }[] = [
        { name: '@orderId', value: orderId },
      ];

      if (typeFilter === 'full') {
        queryStr += ' AND c.type = @type';
        params.push({ name: '@type', value: 'substantive-review-full' });
      } else if (typeFilter === 'single') {
        queryStr += ' AND c.type = @type';
        params.push({ name: '@type', value: 'substantive-review-single' });
      }

      queryStr += ' ORDER BY c.timestamp DESC';

      const results = await dbService.queryDocuments(CONTAINER, queryStr, params);

      res.json({
        success: true,
        data: results,
        message: `Found ${results.length} result(s) for order ${orderId}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch substantive review results', { orderId, error: message });
      res.status(500).json({
        success: false,
        message: `Failed to fetch results: ${message}`,
      });
    }
  }
);

export default router;
