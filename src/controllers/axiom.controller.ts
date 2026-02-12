/**
 * Axiom AI Platform Controller
 * 
 * REST API endpoints for Axiom AI integration:
 * - Document notification (upload documents for analysis)
 * - Evaluation retrieval (get AI analysis results)
 * - Webhook handling (receive completion notifications)
 * - Document comparison (revision change detection)
 */

import { Request, Response, Router } from 'express';
import { AxiomService, AxiomDocumentNotification, AxiomWebhookPayload } from '../services/axiom.service';

export class AxiomController {
  private axiomService: AxiomService;

  constructor(axiomService?: AxiomService) {
    this.axiomService = axiomService || new AxiomService();
  }

  /**
   * Check if Axiom integration is enabled
   * GET /api/axiom/status
   */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const enabled = this.axiomService.isEnabled();

      res.json({
        success: true,
        data: {
          enabled,
          message: enabled 
            ? 'Axiom AI Platform integration is active'
            : 'Axiom AI Platform not configured - AI features disabled'
        }
      });
    } catch (error) {
      console.error('Error checking Axiom status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AXIOM_STATUS_ERROR',
          message: 'Failed to check Axiom status',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Notify Axiom of a new document upload
   * POST /api/axiom/documents
   * 
   * Body: {
   *   orderId: string,
   *   documentType: 'appraisal' | 'revision' | 'rov' | 'supporting',
   *   documentUrl: string, // Azure Blob Storage SAS URL
   *   metadata?: { ... }
   * }
   */
  notifyDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const notification: AxiomDocumentNotification = req.body;

      // Validate required fields
      if (!notification.orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId is required'
          }
        });
        return;
      }

      if (!notification.documentType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'documentType is required'
          }
        });
        return;
      }

      if (!notification.documentUrl) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'documentUrl is required (Azure Blob Storage SAS URL)'
          }
        });
        return;
      }

      // Notify Axiom
      const result = await this.axiomService.notifyDocumentUpload(notification);

      if (!result.success) {
        res.status(503).json({
          success: false,
          error: {
            code: 'AXIOM_API_ERROR',
            message: result.error || 'Failed to notify Axiom',
            details: 'Axiom API may be unavailable or misconfigured'
          }
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          evaluationId: result.evaluationId,
          orderId: notification.orderId,
          message: 'Document notification sent to Axiom - evaluation in progress'
        }
      });
    } catch (error) {
      console.error('Error notifying Axiom of document:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process document notification',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Retrieve evaluation results for an order
   * GET /api/axiom/evaluations/order/:orderId
   */
  getEvaluationByOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;

      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId parameter is required'
          }
        });
        return;
      }

      const evaluation = await this.axiomService.getEvaluation(orderId);

      if (!evaluation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `No Axiom evaluation found for order ${orderId}`,
            details: 'Document may not have been submitted to Axiom yet'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: evaluation
      });
    } catch (error) {
      console.error('Error retrieving Axiom evaluation:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve evaluation',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Retrieve evaluation results by evaluation ID
   * GET /api/axiom/evaluations/:evaluationId
   */
  getEvaluationById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { evaluationId } = req.params;

      if (!evaluationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'evaluationId parameter is required'
          }
        });
        return;
      }

      const evaluation = await this.axiomService.getEvaluationById(evaluationId);

      if (!evaluation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Evaluation ${evaluationId} not found`
          }
        });
        return;
      }

      res.json({
        success: true,
        data: evaluation
      });
    } catch (error) {
      console.error('Error retrieving Axiom evaluation by ID:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve evaluation',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Webhook endpoint for Axiom completion notifications
   * POST /api/axiom/webhook
   * 
   * Body: {
   *   evaluationId: string,
   *   orderId: string,
   *   status: 'completed' | 'failed',
   *   timestamp: string,
   *   error?: { code, message }
   * }
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload: AxiomWebhookPayload = req.body;

      // Validate required fields
      if (!payload.evaluationId || !payload.orderId || !payload.status) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'evaluationId, orderId, and status are required'
          }
        });
        return;
      }

      // Process webhook asynchronously
      this.axiomService.handleWebhook(payload)
        .catch(error => {
          console.error('Background webhook processing failed:', error);
        });

      // Respond immediately to webhook
      res.status(200).json({
        success: true,
        message: 'Webhook received and processing'
      });
    } catch (error) {
      console.error('Error handling Axiom webhook:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process webhook',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * Compare two document versions (for revision workflows)
   * POST /api/axiom/documents/compare
   * 
   * Body: {
   *   orderId: string,
   *   originalDocumentUrl: string,
   *   revisedDocumentUrl: string
   * }
   */
  compareDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId, originalDocumentUrl, revisedDocumentUrl } = req.body;

      // Validate required fields
      if (!orderId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId is required'
          }
        });
        return;
      }

      if (!originalDocumentUrl || !revisedDocumentUrl) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'originalDocumentUrl and revisedDocumentUrl are required'
          }
        });
        return;
      }

      // Initiate document comparison
      const result = await this.axiomService.compareDocuments(
        orderId,
        originalDocumentUrl,
        revisedDocumentUrl
      );

      if (!result.success) {
        res.status(503).json({
          success: false,
          error: {
            code: 'AXIOM_API_ERROR',
            message: result.error || 'Failed to compare documents',
            details: 'Axiom API may be unavailable or misconfigured'
          }
        });
        return;
      }

      res.status(202).json({
        success: true,
        data: {
          evaluationId: result.evaluationId,
          orderId,
          changes: result.changes,
          message: 'Document comparison initiated - results will be available shortly'
        }
      });
    } catch (error) {
      console.error('Error comparing documents via Axiom:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to compare documents',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };
}

/**
 * Create Axiom router with all endpoints
 */
export function createAxiomRouter(): Router {
  const router = Router();
  const controller = new AxiomController();

  // Status check
  router.get('/status', controller.getStatus);

  // Document notification
  router.post('/documents', controller.notifyDocument);

  // Evaluation retrieval
  router.get('/evaluations/order/:orderId', controller.getEvaluationByOrder);
  router.get('/evaluations/:evaluationId', controller.getEvaluationById);

  // Webhook
  router.post('/webhook', controller.handleWebhook);

  // Document comparison
  router.post('/documents/compare', controller.compareDocuments);

  return router;
}
