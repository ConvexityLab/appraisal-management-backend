/**
 * Delivery Workflow Controller
 *
 * REST API endpoints for delivery packages, revision requests,
 * and order completion — wraps DeliveryWorkflowService.
 *
 * Routes (mounted at /api/delivery):
 *   POST   /packages                          – Create delivery package
 *   GET    /packages/order/:orderId           – List delivery packages for order
 *   POST   /packages/:packageId/acknowledge   – Acknowledge delivery
 *   POST   /orders/:orderId/complete           – Complete order delivery
 *   GET    /revisions/order/:orderId          – List revision requests
 *   POST   /revisions                          – Create revision request
 *   POST   /revisions/:revisionId/resolve     – Resolve revision request
 */

import { Request, Response, Router } from 'express';
import { DeliveryWorkflowService } from '../services/delivery-workflow.service';

const APP_TENANT_ID = 'test-tenant-123';

export class DeliveryController {
  private deliveryService: DeliveryWorkflowService;

  constructor(deliveryService?: DeliveryWorkflowService) {
    this.deliveryService = deliveryService || new DeliveryWorkflowService();
  }

  // ────────────────────────────────────────────────────────────────
  // Delivery Packages
  // ────────────────────────────────────────────────────────────────

  /**
   * POST /api/delivery/packages
   *
   * Body: {
   *   orderId: string,
   *   packageType: 'DRAFT' | 'FINAL' | 'REVISION' | 'ADDENDUM',
   *   documentIds: string[],
   *   deliveredTo: string[],
   *   submissionNotes?: string
   * }
   */
  createPackage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId, packageType, documentIds, deliveredTo, submissionNotes } = req.body;

      if (!orderId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId is required' } });
        return;
      }
      if (!packageType) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'packageType is required' } });
        return;
      }
      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'documentIds array is required and must be non-empty' } });
        return;
      }
      if (!deliveredTo || !Array.isArray(deliveredTo) || deliveredTo.length === 0) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'deliveredTo array is required and must be non-empty' } });
        return;
      }

      const result = await this.deliveryService.createDeliveryPackage(
        orderId,
        APP_TENANT_ID,
        packageType,
        documentIds,
        deliveredTo,
        submissionNotes
      );

      if (!result.success) {
        res.status(500).json({ success: false, error: result.error });
        return;
      }

      res.status(201).json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error creating delivery package:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create delivery package',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * GET /api/delivery/packages/order/:orderId
   */
  getPackagesByOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId parameter is required' } });
        return;
      }

      const result = await this.deliveryService.getOrderDeliveryPackages(orderId, APP_TENANT_ID);
      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error getting delivery packages:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve delivery packages',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * POST /api/delivery/packages/:packageId/acknowledge
   *
   * Body: { acknowledgedBy: string }
   */
  acknowledgePackage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { packageId } = req.params;
      const { acknowledgedBy } = req.body;

      if (!packageId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'packageId parameter is required' } });
        return;
      }
      if (!acknowledgedBy) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'acknowledgedBy is required' } });
        return;
      }

      const result = await this.deliveryService.acknowledgeDeliveryPackage(packageId, APP_TENANT_ID, acknowledgedBy);

      if (!result.success) {
        const status = result.error?.code === 'PACKAGE_NOT_FOUND' ? 404 : 500;
        res.status(status).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error acknowledging delivery package:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to acknowledge delivery package',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Order Completion
  // ────────────────────────────────────────────────────────────────

  /**
   * POST /api/delivery/orders/:orderId/complete
   *
   * Body: { completedBy: string }
   */
  completeOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { completedBy } = req.body;

      if (!orderId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId parameter is required' } });
        return;
      }
      if (!completedBy) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'completedBy is required' } });
        return;
      }

      const result = await this.deliveryService.completeOrderDelivery(orderId, APP_TENANT_ID, completedBy);

      if (!result.success) {
        const status = result.error?.code === 'ORDER_NOT_FOUND' ? 404 : 500;
        res.status(status).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error completing order delivery:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to complete order delivery',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Revision Requests
  // ────────────────────────────────────────────────────────────────

  /**
   * GET /api/delivery/revisions/order/:orderId?status=OPEN
   */
  getRevisionsByOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const status = req.query.status as string | undefined;

      if (!orderId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId parameter is required' } });
        return;
      }

      const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACKNOWLEDGED', 'DISPUTED'] as const;
      type RevisionStatus = typeof validStatuses[number];
      const typedStatus = status && validStatuses.includes(status as RevisionStatus) ? status as RevisionStatus : undefined;

      const result = await this.deliveryService.getOrderRevisionRequests(orderId, APP_TENANT_ID, typedStatus);
      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error getting revision requests:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve revision requests',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };

  /**
   * POST /api/delivery/revisions/:revisionId/resolve
   *
   * Body: { resolvedBy: string, resolutionNotes?: string }
   */
  resolveRevision = async (req: Request, res: Response): Promise<void> => {
    try {
      const { revisionId } = req.params;
      const { resolvedBy, resolutionNotes } = req.body;

      if (!revisionId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'revisionId parameter is required' } });
        return;
      }
      if (!resolvedBy) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'resolvedBy is required' } });
        return;
      }

      const result = await this.deliveryService.resolveRevisionRequest(revisionId, APP_TENANT_ID, resolvedBy, resolutionNotes);

      if (!result.success) {
        const status = result.error?.code === 'REVISION_NOT_FOUND' ? 404 : 500;
        res.status(status).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error resolving revision request:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to resolve revision request',
          details: error instanceof Error ? error.message : String(error)
        }
      });
    }
  };
}

/**
 * Create Express router for delivery endpoints.
 * Mount at /api/delivery in api-server.ts.
 */
export function createDeliveryRouter(): Router {
  const router = Router();
  const controller = new DeliveryController();

  // Delivery packages
  router.post('/packages', controller.createPackage);
  router.get('/packages/order/:orderId', controller.getPackagesByOrder);
  router.post('/packages/:packageId/acknowledge', controller.acknowledgePackage);

  // Order completion
  router.post('/orders/:orderId/complete', controller.completeOrder);

  // Revision requests
  router.get('/revisions/order/:orderId', controller.getRevisionsByOrder);
  router.post('/revisions/:revisionId/resolve', controller.resolveRevision);

  return router;
}
