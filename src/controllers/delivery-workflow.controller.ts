/**
 * Delivery Workflow Controller
 * REST API endpoints for order progress tracking, milestones, and delivery workflows
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger';
import { OrderProgressService } from '../services/order-progress.service';
import { DeliveryWorkflowService } from '../services/delivery-workflow.service';
import {
  OrderStatus,
  MilestoneStatus,
  DocumentType,
  DocumentStatus
} from '../types/order-progress.types';

const logger = new Logger();
const progressService = new OrderProgressService();
const deliveryService = new DeliveryWorkflowService();

/**
 * Create router for delivery workflow endpoints
 */
export function createDeliveryWorkflowRouter(): Router {
  const router = Router();

  /**
   * Initialize milestones for order
   * POST /api/delivery/milestones/initialize
   */
  router.post(
    '/milestones/initialize',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('dueDate').isISO8601().withMessage('Valid due date is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { orderId, dueDate, customSequence } = req.body;
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await progressService.initializeOrderMilestones(
          orderId,
          tenantId,
          new Date(dueDate),
          customSequence
        );

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error initializing milestones', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize milestones',
          error: { code: 'INITIALIZATION_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Update milestone status
   * PUT /api/delivery/milestones/:milestoneId
   */
  router.put(
    '/milestones/:milestoneId',
    [
      param('milestoneId').notEmpty().withMessage('Milestone ID is required'),
      body('status').isIn(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED'])
        .withMessage('Valid status is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const milestoneId = req.params.milestoneId as string;
        const { status, notes } = req.body;
        const userId = (req as any).user?.id || 'system';
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await progressService.updateMilestone(
          milestoneId,
          status as MilestoneStatus,
          userId,
          tenantId,
          notes
        );

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error updating milestone', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to update milestone',
          error: { code: 'UPDATE_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Update order status
   * PUT /api/delivery/orders/:orderId/status
   */
  router.put(
    '/orders/:orderId/status',
    [
      param('orderId').notEmpty().withMessage('Order ID is required'),
      body('status').notEmpty().withMessage('Status is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const orderId = req.params.orderId as string;
        const { status, notes, metadata } = req.body;
        const userId = (req as any).user?.id || 'system';
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await progressService.updateOrderStatus(
          orderId,
          status as OrderStatus,
          userId,
          tenantId,
          notes,
          metadata
        );

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error updating order status', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to update order status',
          error: { code: 'UPDATE_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Get order milestones
   * GET /api/delivery/orders/:orderId/milestones
   */
  router.get(
    '/orders/:orderId/milestones',
    [param('orderId').notEmpty().withMessage('Order ID is required')],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const orderId = req.params.orderId as string;
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await progressService.getOrderMilestones(orderId, tenantId);

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error getting order milestones', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to get order milestones',
          error: { code: 'QUERY_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Get order timeline
   * GET /api/delivery/orders/:orderId/timeline
   */
  router.get(
    '/orders/:orderId/timeline',
    [param('orderId').notEmpty().withMessage('Order ID is required')],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const orderId = req.params.orderId as string;
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await progressService.getOrderTimeline(orderId, tenantId);

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error getting order timeline', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to get order timeline',
          error: { code: 'QUERY_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Get progress metrics
   * GET /api/delivery/orders/:orderId/metrics
   */
  router.get(
    '/orders/:orderId/metrics',
    [param('orderId').notEmpty().withMessage('Order ID is required')],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const orderId = req.params.orderId as string;
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await progressService.calculateProgressMetrics(orderId, tenantId);

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error calculating progress metrics', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to calculate progress metrics',
          error: { code: 'CALCULATION_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Upload document
   * POST /api/delivery/documents/upload
   */
  router.post(
    '/documents/upload',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('fileName').notEmpty().withMessage('File name is required'),
      body('fileSize').isNumeric().withMessage('File size is required'),
      body('mimeType').notEmpty().withMessage('MIME type is required'),
      body('documentType').notEmpty().withMessage('Document type is required'),
      body('blobUrl').notEmpty().withMessage('Blob URL is required'),
      body('blobContainer').notEmpty().withMessage('Blob container is required'),
      body('blobPath').notEmpty().withMessage('Blob path is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const {
          orderId,
          fileName,
          fileSize,
          mimeType,
          documentType,
          blobUrl,
          blobContainer,
          blobPath,
          isDraft,
          isFinal,
          description,
          tags
        } = req.body;

        const uploadedBy = (req as any).user?.id || 'system';
        const uploadedByRole = (req as any).user?.role || 'VENDOR';
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await deliveryService.uploadDocument(
          orderId,
          tenantId,
          uploadedBy,
          uploadedByRole,
          {
            fileName,
            fileSize,
            mimeType,
            documentType: documentType as DocumentType,
            blobUrl,
            blobContainer,
            blobPath,
            isDraft,
            isFinal,
            description,
            tags
          }
        );

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error uploading document', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to upload document',
          error: { code: 'UPLOAD_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Get order documents
   * GET /api/delivery/orders/:orderId/documents
   */
  router.get(
    '/orders/:orderId/documents',
    [param('orderId').notEmpty().withMessage('Order ID is required')],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const orderId = req.params.orderId as string;
        const tenantId = (req as any).user?.tenantId || 'default';
        
        const documentType = req.query.documentType as DocumentType | undefined;
        const status = req.query.status as DocumentStatus | undefined;
        const latestOnly = req.query.latestOnly === 'true';
        
        const filters: {
          documentType?: DocumentType;
          status?: DocumentStatus;
          latestOnly?: boolean;
        } = {};
        
        if (documentType) filters.documentType = documentType;
        if (status) filters.status = status;
        if (latestOnly) filters.latestOnly = latestOnly;

        const result = await deliveryService.getOrderDocuments(orderId, tenantId, filters);

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error getting order documents', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to get order documents',
          error: { code: 'QUERY_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Review document
   * POST /api/delivery/documents/:documentId/review
   */
  router.post(
    '/documents/:documentId/review',
    [
      param('documentId').notEmpty().withMessage('Document ID is required'),
      body('status').isIn(['UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'ARCHIVED'])
        .withMessage('Valid status is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const documentId = req.params.documentId as string;
        const { status, reviewNotes } = req.body;
        const reviewedBy = (req as any).user?.id || 'system';
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await deliveryService.reviewDocument(
          documentId,
          tenantId,
          reviewedBy,
          status as DocumentStatus,
          reviewNotes
        );

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error reviewing document', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to review document',
          error: { code: 'REVIEW_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Create delivery package
   * POST /api/delivery/packages
   */
  router.post(
    '/packages',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('packageType').isIn(['DRAFT', 'FINAL', 'REVISION', 'ADDENDUM'])
        .withMessage('Valid package type is required'),
      body('documentIds').isArray().withMessage('Document IDs must be an array'),
      body('deliveredTo').isArray().withMessage('Delivered to must be an array')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { orderId, packageType, documentIds, deliveredTo, submissionNotes } = req.body;
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await deliveryService.createDeliveryPackage(
          orderId,
          tenantId,
          packageType,
          documentIds,
          deliveredTo,
          submissionNotes
        );

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error creating delivery package', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to create delivery package',
          error: { code: 'CREATION_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Acknowledge delivery package
   * POST /api/delivery/packages/:packageId/acknowledge
   */
  router.post(
    '/packages/:packageId/acknowledge',
    [param('packageId').notEmpty().withMessage('Package ID is required')],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const packageId = req.params.packageId as string;
        const acknowledgedBy = (req as any).user?.id || 'system';
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await deliveryService.acknowledgeDeliveryPackage(
          packageId,
          tenantId,
          acknowledgedBy
        );

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error acknowledging delivery package', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to acknowledge delivery package',
          error: { code: 'ACKNOWLEDGE_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Get order delivery packages
   * GET /api/delivery/orders/:orderId/packages
   */
  router.get(
    '/orders/:orderId/packages',
    [param('orderId').notEmpty().withMessage('Order ID is required')],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const orderId = req.params.orderId as string;
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await deliveryService.getOrderDeliveryPackages(orderId, tenantId);

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error getting order delivery packages', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to get order delivery packages',
          error: { code: 'QUERY_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Create revision request
   * POST /api/delivery/revisions
   */
  router.post(
    '/revisions',
    [
      body('documentId').notEmpty().withMessage('Document ID is required'),
      body('description').notEmpty().withMessage('Description is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { documentId, description, requestedByRole, requestType, issueCategory, specificPages, severity, dueDate } = req.body;
        const requestedBy = (req as any).user?.id || 'system';
        const tenantId = (req as any).user?.tenantId || 'default';

        // Get document first
        const docResponse = await deliveryService.getOrderDocuments(
          documentId,
          tenantId,
          { latestOnly: false }
        );
        
        const document = (docResponse.data || []).find((d: any) => d.id === documentId);
        
        if (!document) {
          return res.status(404).json({
            success: false,
            message: 'Document not found',
            error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' }
          });
        }

        const result = await deliveryService.createRevisionRequest(
          document,
          requestedBy,
          description,
          tenantId,
          {
            requestedByRole,
            requestType,
            issueCategory,
            specificPages,
            severity,
            ...(dueDate && { dueDate: new Date(dueDate) })
          }
        );

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error creating revision request', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to create revision request',
          error: { code: 'CREATION_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Resolve revision request
   * POST /api/delivery/revisions/:revisionId/resolve
   */
  router.post(
    '/revisions/:revisionId/resolve',
    [param('revisionId').notEmpty().withMessage('Revision ID is required')],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const revisionId = req.params.revisionId as string;
        const { resolutionNotes } = req.body;
        const resolvedBy = (req as any).user?.id || 'system';
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await deliveryService.resolveRevisionRequest(
          revisionId,
          tenantId,
          resolvedBy,
          resolutionNotes
        );

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error resolving revision request', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to resolve revision request',
          error: { code: 'RESOLUTION_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Get order revision requests
   * GET /api/delivery/orders/:orderId/revisions
   */
  router.get(
    '/orders/:orderId/revisions',
    [param('orderId').notEmpty().withMessage('Order ID is required')],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const orderId = req.params.orderId as string;
        const status = req.query.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ACKNOWLEDGED' | 'DISPUTED' | undefined;
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await deliveryService.getOrderRevisionRequests(orderId, tenantId, status);

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error getting order revision requests', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to get order revision requests',
          error: { code: 'QUERY_ERROR', message: String(error) }
        });
      }
    }
  );

  /**
   * Complete order delivery
   * POST /api/delivery/orders/:orderId/complete
   */
  router.post(
    '/orders/:orderId/complete',
    [param('orderId').notEmpty().withMessage('Order ID is required')],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ success: false, errors: errors.array() });
        }

        const orderId = req.params.orderId as string;
        const completedBy = (req as any).user?.id || 'system';
        const tenantId = (req as any).user?.tenantId || 'default';

        const result = await deliveryService.completeOrderDelivery(orderId, tenantId, completedBy);

        return res.status(200).json(result);
      } catch (error) {
        logger.error('Error completing order delivery', { error });
        return res.status(500).json({
          success: false,
          message: 'Failed to complete order delivery',
          error: { code: 'COMPLETION_ERROR', message: String(error) }
        });
      }
    }
  );

  return router;
}




