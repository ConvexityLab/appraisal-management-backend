/**
 * Delivery Workflow Controller
 *
 * REST API endpoints for delivery packages, revision requests,
 * and order completion — wraps DeliveryWorkflowService.
 *
 * Routes (mounted at /api/delivery):
 *   POST   /packages                          – Create delivery package
 *   GET    /orders/:orderId/packages           – List delivery packages for order
 *   GET    /orders/:orderId/packages/:packageId/download – Download package as ZIP
 *   POST   /packages/:packageId/acknowledge   – Acknowledge delivery
 *   GET    /packages/:packageId/ack-url        – Get client acknowledgement URL
 *   POST   /packages/:packageId/client-acknowledge – Client acknowledges via signed token
 *   GET    /orders/:orderId/timeline           – Delivery audit timeline
 *   POST   /orders/:orderId/complete           – Complete order delivery
 *   GET    /orders/:orderId/revisions          – List revision requests
 *   POST   /revisions/:revisionId/resolve     – Resolve revision request
 */

import { Request, Response, Router } from 'express';
import archiver from 'archiver';
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

  /**
   * GET /api/delivery/orders/:orderId/packages/:packageId/download
   *
   * Streams a ZIP archive of all documents in the delivery package.
   */
  downloadPackage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId, packageId } = req.params;

      if (!orderId || !packageId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'orderId and packageId parameters are required' },
        });
        return;
      }

      const result = await this.deliveryService.getDeliveryPackage(packageId, APP_TENANT_ID);
      if (!result.success || !result.data) {
        const status = result.error?.code === 'PACKAGE_NOT_FOUND' ? 404 : 500;
        res.status(status).json({ success: false, error: result.error });
        return;
      }

      const pkg = result.data;
      if (pkg.orderId !== orderId) {
        res.status(404).json({
          success: false,
          error: { code: 'PACKAGE_NOT_FOUND', message: 'Delivery package not found for this order' },
        });
        return;
      }

      const manifest = (pkg as any).manifest;
      if (!manifest || !Array.isArray(manifest) || manifest.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'EMPTY_PACKAGE', message: 'Delivery package has no manifest entries' },
        });
        return;
      }

      // Set ZIP response headers
      const zipName = `delivery-${orderId}-v${pkg.version}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

      // Create ZIP archive and pipe to response
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: { code: 'ARCHIVE_ERROR', message: 'Failed to create ZIP archive' },
          });
        }
      });
      archive.pipe(res);

      // Stream each document into the archive
      for await (const entry of this.deliveryService.streamPackageDocuments(manifest)) {
        archive.append(entry.stream as any, { name: entry.fileName });
      }

      await archive.finalize();
    } catch (error) {
      console.error('Error downloading delivery package:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to download delivery package',
            details: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Client Acknowledgement
  // ────────────────────────────────────────────────────────────────

  /**
   * GET /api/delivery/packages/:packageId/ack-url
   *
   * Returns the signed client acknowledgement URL for a package.
   * Internal use — generates a new token if the stored one is expired.
   */
  getAcknowledgementUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { packageId } = req.params;
      if (!packageId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'packageId parameter is required' } });
        return;
      }

      const pkgResult = await this.deliveryService.getDeliveryPackage(packageId, APP_TENANT_ID);
      if (!pkgResult.success || !pkgResult.data) {
        const status = pkgResult.error?.code === 'PACKAGE_NOT_FOUND' ? 404 : 500;
        res.status(status).json({ success: false, error: pkgResult.error });
        return;
      }

      const pkg = pkgResult.data as any;
      let token = pkg.clientAckToken as string | undefined;
      let expiresAt = pkg.clientAckExpiresAt ? new Date(pkg.clientAckExpiresAt) : undefined;

      // Regenerate if missing or expired
      if (!token || !expiresAt || expiresAt.getTime() < Date.now()) {
        const fresh = this.deliveryService.generateClientAcknowledgementToken(packageId);
        token = fresh.token;
        expiresAt = fresh.expiresAt;
      }

      const baseUrl = process.env.CLIENT_PORTAL_BASE_URL || req.protocol + '://' + req.get('host');
      const url = `${baseUrl}/delivery/acknowledge?packageId=${packageId}&token=${encodeURIComponent(token)}`;

      res.json({ success: true, data: { url, token, expiresAt } });
    } catch (error) {
      console.error('Error generating acknowledgement URL:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate acknowledgement URL',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  /**
   * POST /api/delivery/packages/:packageId/client-acknowledge
   *
   * Public endpoint for clients to acknowledge delivery using a signed token.
   * Body: { token: string, clientName: string, feedback?: string }
   */
  clientAcknowledge = async (req: Request, res: Response): Promise<void> => {
    try {
      const { packageId } = req.params;
      const { token, clientName, feedback } = req.body;

      if (!packageId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'packageId parameter is required' } });
        return;
      }
      if (!token) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'token is required' } });
        return;
      }
      if (!clientName) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'clientName is required' } });
        return;
      }

      const result = await this.deliveryService.clientAcknowledgeDeliveryPackage(
        packageId,
        APP_TENANT_ID,
        token,
        clientName,
        feedback,
      );

      if (!result.success) {
        const status = result.error?.code === 'INVALID_TOKEN' ? 403 : result.error?.code === 'PACKAGE_NOT_FOUND' ? 404 : 500;
        res.status(status).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error in client acknowledgement:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process client acknowledgement',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Order Completion
  // ────────────────────────────────────────────────────────────────

  /**
   * GET /api/delivery/orders/:orderId/timeline
   *
   * Returns a chronological audit trail of delivery events.
   */
  getTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId parameter is required' } });
        return;
      }

      const result = await this.deliveryService.getOrderDeliveryTimeline(orderId, APP_TENANT_ID);
      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error getting delivery timeline:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve delivery timeline',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

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
  router.get('/orders/:orderId/packages', controller.getPackagesByOrder);
  router.get('/orders/:orderId/packages/:packageId/download', controller.downloadPackage);
  router.post('/packages/:packageId/acknowledge', controller.acknowledgePackage);

  // Client acknowledgement
  router.get('/packages/:packageId/ack-url', controller.getAcknowledgementUrl);
  router.post('/packages/:packageId/client-acknowledge', controller.clientAcknowledge);

  // Timeline
  router.get('/orders/:orderId/timeline', controller.getTimeline);

  // Order completion
  router.post('/orders/:orderId/complete', controller.completeOrder);

  // Revision requests
  router.get('/orders/:orderId/revisions', controller.getRevisionsByOrder);
  router.post('/revisions/:revisionId/resolve', controller.resolveRevision);

  return router;
}
