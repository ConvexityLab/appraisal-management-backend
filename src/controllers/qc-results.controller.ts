/**
 * QC Results Controller
 * REST API endpoints for QC execution results
 */

import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { createApiError, createApiResponse } from '../utils/api-response.util.js';

const router = Router();
const logger = new Logger();

// Cosmos DB setup
const COSMOS_ENDPOINT = process.env['AZURE_COSMOS_ENDPOINT'];
if (!COSMOS_ENDPOINT) {
  throw new Error(
    'Required environment variable AZURE_COSMOS_ENDPOINT is not set. ' +
    'Set it to your Cosmos DB endpoint URL (e.g. https://<account>.documents.azure.com:443/).'
  );
}
const DATABASE_ID = 'appraisal-management';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, aadCredentials: credential });
const database = client.database(DATABASE_ID);

// Middleware to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: Function): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

/**
 * Merge all qc-review documents for an order into a single consolidated report.
 * Findings/categoriesResults from every document are combined so no data is lost
 * when multiple review passes exist for the same order.
 */
function mergeQcReviewDocs(docs: any[]): any {
  if (docs.length === 0) return null;

  // Count top-level questions in categoriesResults[] — this is the richest Shape 1 data.
  const topLevelQuestionCount = (d: any): number =>
    (d.categoriesResults ?? []).flatMap((c: any) => c.questions ?? []).length;

  // Sort: Shape 1 docs (top-level categoriesResults with questions) always win as base.
  // Within the same shape, prefer the doc with the most total data.
  const sorted = [...docs].sort((a, b) => {
    const shapeA = topLevelQuestionCount(a) > 0 ? 1 : 0;
    const shapeB = topLevelQuestionCount(b) > 0 ? 1 : 0;
    if (shapeB !== shapeA) return shapeB - shapeA; // Shape 1 first

    const countA =
      topLevelQuestionCount(a) * 10 + // heavy weight for proper questions
      (a.findings?.length ?? 0) +
      (a.results?.findings?.length ?? 0) +
      (a.results?.categoriesResults?.length ?? 0);
    const countB =
      topLevelQuestionCount(b) * 10 +
      (b.findings?.length ?? 0) +
      (b.results?.findings?.length ?? 0) +
      (b.results?.categoriesResults?.length ?? 0);
    return countB - countA;
  });

  const base = { ...sorted[0] };

  // Merge top-level categoriesResults[] (Shape 1 rich data) across all docs.
  // Prefer category entries that have questions[] over summary-only entries.
  const baseCatMap = new Map<string, any>(
    (base.categoriesResults ?? []).map((c: any) => [c.categoryId ?? c.categoryCode, c])
  );
  for (const doc of sorted.slice(1)) {
    for (const c of (doc.categoriesResults ?? [])) {
      const key = c.categoryId ?? c.categoryCode;
      if (!key) continue;
      const existing = baseCatMap.get(key);
      // Replace only if the incoming entry has questions and existing does not.
      if (!existing || (!existing.questions?.length && c.questions?.length)) {
        baseCatMap.set(key, c);
      }
    }
  }
  if (baseCatMap.size > 0) base.categoriesResults = Array.from(baseCatMap.values());

  // Merge flat findings[] from all other docs (deduplicate by questionId / findingId).
  const seenFindingIds = new Set<string>(
    (base.findings ?? []).map((f: any) => f.questionId ?? f.findingId).filter(Boolean)
  );
  const mergedFindings: any[] = [...(base.findings ?? [])];

  for (const doc of sorted.slice(1)) {
    for (const f of doc.findings ?? []) {
      const key = f.questionId ?? f.findingId;
      if (!key || seenFindingIds.has(key)) continue;
      seenFindingIds.add(key);
      mergedFindings.push(f);
    }
  }
  if (mergedFindings.length > 0) base.findings = mergedFindings;

  // Merge results.findings[] similarly.
  if (!base.results) base.results = {};
  const seenResultFindingIds = new Set<string>(
    (base.results.findings ?? []).map((f: any) => f.findingId ?? f.questionId).filter(Boolean)
  );
  const mergedResultFindings: any[] = [...(base.results.findings ?? [])];

  for (const doc of sorted.slice(1)) {
    for (const f of (doc.results?.findings ?? [])) {
      const key = f.findingId ?? f.questionId;
      if (!key || seenResultFindingIds.has(key)) continue;
      seenResultFindingIds.add(key);
      mergedResultFindings.push(f);
    }
  }
  if (mergedResultFindings.length > 0) base.results.findings = mergedResultFindings;

  // Merge results.categoriesResults (deduplicate by categoryId).
  const seenCatIds = new Set<string>(
    (base.results.categoriesResults ?? []).map((c: any) => c.categoryId).filter(Boolean)
  );
  const mergedCatResults: any[] = [...(base.results.categoriesResults ?? [])];

  for (const doc of sorted.slice(1)) {
    for (const c of (doc.results?.categoriesResults ?? [])) {
      if (!c.categoryId || seenCatIds.has(c.categoryId)) continue;
      seenCatIds.add(c.categoryId);
      mergedCatResults.push(c);
    }
  }
  if (mergedCatResults.length > 0) base.results.categoriesResults = mergedCatResults;

  return base;
}

/**
 * GET /api/qc/results/order/:orderId
 * Fetch and merge ALL qc-review documents for an order.
 * This is the primary endpoint used by the frontend.
 */
router.get(
  '/order/:orderId',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      logger.info('Fetching merged QC results by order', { orderId });

      const container = database.container('qc-reviews');

      const query = {
        query: 'SELECT * FROM c WHERE c.orderId = @orderId',
        parameters: [{ name: '@orderId', value: orderId as string }]
      };

      const { resources } = await container.items.query(query).fetchAll();

      if (resources.length === 0) {
        logger.warn('QC results not found', { orderId });
        return res.status(404).json({
          success: false,
          error: createApiError('QC_RESULTS_NOT_FOUND', `QC results not found for order: ${orderId}`)
        });
      }

      logger.info(`Found ${resources.length} qc-review doc(s) for order, merging`, { orderId });
      const qcReview = resources.length === 1 ? resources[0] : mergeQcReviewDocs(resources);

      const qcValidationReport = {
        id: qcReview.id,
        sessionId: qcReview.sessionId || 'session-001',
        orderId: qcReview.orderId,
        orderNumber: qcReview.orderNumber,
        checklistId: qcReview.checklistId,
        checklistName: qcReview.checklistName,
        checklistVersion: qcReview.checklistVersion,
        propertyAddress: qcReview.propertyAddress,
        appraisedValue: qcReview.appraisedValue,
        status: qcReview.status,
        overallScore: qcReview.overallScore,
        passFailStatus: qcReview.passFailStatus,
        summary: qcReview.summary,
        categoriesResults: qcReview.categoriesResults || [],
        criticalIssues: qcReview.criticalIssues || [],
        startedAt: qcReview.startedAt,
        completedAt: qcReview.completedAt,
        reviewedBy: qcReview.reviewedBy,
        reviewedByName: qcReview.reviewedByName,
        createdAt: qcReview.createdAt,
        updatedAt: qcReview.updatedAt,
        // Pass through non-standard fields the frontend adapter needs
        findings: qcReview.findings,
        results: qcReview.results,
      };

      logger.info('Merged QC results retrieved successfully', {
        orderId,
        totalFindings: (qcReview.findings?.length ?? 0) + (qcReview.results?.findings?.length ?? 0),
      });

      return res.json(createApiResponse(qcValidationReport, 'QC results retrieved successfully'));

    } catch (error) {
      logger.error('Failed to get QC results by order', {
        error: error instanceof Error ? error.message : String(error),
        orderId: req.params['orderId']
      });

      return res.status(500).json({
        success: false,
        error: createApiError('QC_RESULTS_GET_FAILED', 'Failed to retrieve QC results')
      });
    }
  }
);

/**
 * GET /api/qc/results/:orderId
 * Legacy: Get QC review results for an order (returns first match only).
 * Prefer GET /order/:orderId for new callers.
 */
router.get(
  '/:orderId',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      logger.info('Fetching QC results', { orderId });

      // Search for QC review by orderId in qc-reviews container
      const container = database.container('qc-reviews');
      
      const query = {
        query: 'SELECT * FROM c WHERE c.orderId = @orderId',
        parameters: [{ name: '@orderId', value: orderId as string }]
      };

      const { resources } = await container.items.query(query).fetchAll();

      if (resources.length === 0) {
        logger.warn('QC results not found', { orderId });
        return res.status(404).json({
          success: false,
          error: createApiError('QC_RESULTS_NOT_FOUND', `QC results not found for order: ${orderId}`)
        });
      }

      const qcReview = resources[0];

      // Ensure we have the expected structure for the frontend
      const qcValidationReport = {
        id: qcReview.id,
        sessionId: qcReview.sessionId || 'session-001',
        orderId: qcReview.orderId,
        orderNumber: qcReview.orderNumber,
        checklistId: qcReview.checklistId,
        checklistName: qcReview.checklistName,
        checklistVersion: qcReview.checklistVersion,
        
        // Property information
        propertyAddress: qcReview.propertyAddress,
        appraisedValue: qcReview.appraisedValue,
        
        // Overall results
        status: qcReview.status,
        overallScore: qcReview.overallScore,
        passFailStatus: qcReview.passFailStatus,
        
        // Summary
        summary: qcReview.summary,
        
        // Category results - this is what the frontend needs!
        categoriesResults: qcReview.categoriesResults || [],
        
        // Critical issues
        criticalIssues: qcReview.criticalIssues || [],
        
        // Timeline
        startedAt: qcReview.startedAt,
        completedAt: qcReview.completedAt,
        reviewedBy: qcReview.reviewedBy,
        reviewedByName: qcReview.reviewedByName,
        
        // Metadata
        createdAt: qcReview.createdAt,
        updatedAt: qcReview.updatedAt
      };

      logger.info('QC results retrieved successfully', { 
        orderId, 
        categories: qcValidationReport.categoriesResults.length,
        questions: qcValidationReport.categoriesResults.reduce((sum: number, cat: { questions?: unknown[] }) => sum + (cat.questions?.length || 0), 0)
      });

      return res.json(createApiResponse(qcValidationReport, 'QC results retrieved successfully'));

    } catch (error) {
      logger.error('Failed to get QC results', { 
        error: error instanceof Error ? error.message : String(error),
        orderId: req.params.orderId
      });
      
      return res.status(500).json({
        success: false,
        error: createApiError('QC_RESULTS_GET_FAILED', 'Failed to retrieve QC results')
      });
    }
  }
);

/**
 * PATCH /api/qc/results/:resultId/items/:itemId/verification
 * Update verification status for a specific question
 */
router.patch(
  '/:resultId/items/:itemId/verification',
  [
    param('resultId').notEmpty().withMessage('Result ID is required'),
    param('itemId').notEmpty().withMessage('Item ID is required')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { resultId, itemId } = req.params;
      const { verificationStatus, notes, verifiedBy } = req.body;

      logger.info('Updating verification status', { resultId, itemId, verificationStatus });

      // Get the QC review document
      const container = database.container('qc-reviews');
      const { resource: qcReview } = await container.item(resultId as string).read();

      if (!qcReview) {
        return res.status(404).json({
          success: false,
          error: createApiError('QC_REVIEW_NOT_FOUND', `QC review not found: ${resultId}`)
        });
      }

      // Find and update the question
      let questionUpdated = false;

      if (qcReview.categoriesResults) {
        for (const category of qcReview.categoriesResults) {
          if (category.questions) {
            const question = category.questions.find((q: any) => q.questionId === itemId);
            if (question) {
              question.verificationStatus = verificationStatus;
              if (notes) question.verificationNotes = notes;
              if (verifiedBy) question.verifiedBy = verifiedBy;
              question.verifiedAt = new Date().toISOString();
              questionUpdated = true;
              break;
            }
          }
        }
      }

      // Update critical issues if applicable
      if (qcReview.criticalIssues) {
        const criticalIssue = qcReview.criticalIssues.find((issue: any) => issue.questionId === itemId);
        if (criticalIssue) {
          criticalIssue.verificationStatus = verificationStatus;
          if (notes) criticalIssue.verificationNotes = notes;
          if (verifiedBy) criticalIssue.verifiedBy = verifiedBy;
          criticalIssue.verifiedAt = new Date().toISOString();
        }
      }

      if (!questionUpdated) {
        return res.status(404).json({
          success: false,
          error: createApiError('QUESTION_NOT_FOUND', `Question not found: ${itemId}`)
        });
      }

      // Save the updated document
      qcReview.updatedAt = new Date().toISOString();
      await container.items.upsert(qcReview);

      logger.info('Verification status updated successfully', { resultId, itemId, verificationStatus });

      return res.json(createApiResponse(
        { success: true, message: 'Verification status updated' },
        'Verification status updated successfully'
      ));

    } catch (error) {
      logger.error('Failed to update verification status', { 
        error: error instanceof Error ? error.message : String(error),
        resultId: req.params.resultId,
        itemId: req.params.itemId
      });
      
      return res.status(500).json({
        success: false,
        error: createApiError('VERIFICATION_UPDATE_FAILED', 'Failed to update verification status')
      });
    }
  }
);

export { router as qcResultsRouter };