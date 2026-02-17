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
const COSMOS_ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/';
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
 * GET /api/qc/results/:orderId
 * Get QC review results for an order
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