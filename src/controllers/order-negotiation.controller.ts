import express, { Request, Response, Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { OrderNegotiationService } from '@/services/order-negotiation.service';
import { Logger } from '@/utils/logger';

const logger = new Logger();
const negotiationService = new OrderNegotiationService();

/**
 * Order Negotiation Controller
 * REST API endpoints for vendor acceptance, rejection, counter-offers, and AMC responses
 * Implements complete negotiation workflow with state tracking
 */
export const createOrderNegotiationRouter = (): Router => {
  const router = express.Router();

  /**
   * POST /api/negotiations/accept
   * Vendor accepts order assignment
   */
  router.post(
    '/accept',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('vendorId').notEmpty().withMessage('Vendor ID is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const { orderId, vendorId } = req.body;

        logger.info('Vendor accepting order', { orderId, vendorId });

        const updatedOrder = await negotiationService.acceptOrder(orderId, vendorId, tenantId);

        return res.json({
          success: true,
          data: {
            orderId: updatedOrder.id,
            status: updatedOrder.status,
            acceptedAt: updatedOrder.acceptedAt,
            acceptedBy: updatedOrder.acceptedBy
          }
        });

      } catch (error: any) {
        logger.error('Failed to accept order', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to accept order'
        });
      }
    }
  );

  /**
   * POST /api/negotiations/reject
   * Vendor rejects order assignment
   */
  router.post(
    '/reject',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('vendorId').notEmpty().withMessage('Vendor ID is required'),
      body('reason').notEmpty().withMessage('Rejection reason is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const { orderId, vendorId, reason } = req.body;

        logger.info('Vendor rejecting order', { orderId, vendorId, reason });

        await negotiationService.rejectOrder(orderId, vendorId, reason, tenantId);

        return res.json({
          success: true,
          message: 'Order rejected successfully'
        });

      } catch (error: any) {
        logger.error('Failed to reject order', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to reject order'
        });
      }
    }
  );

  /**
   * POST /api/negotiations/counter-offer
   * Vendor submits counter-offer with different fee/timeline
   */
  router.post(
    '/counter-offer',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('vendorId').notEmpty().withMessage('Vendor ID is required'),
      body('fee').isNumeric().withMessage('Fee must be a number'),
      body('dueDate').isISO8601().withMessage('Due date must be a valid date'),
      body('notes').optional().isString()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const { orderId, vendorId, fee, dueDate, notes } = req.body;

        logger.info('Vendor submitting counter-offer', { orderId, vendorId, fee, dueDate });

        const negotiation = await negotiationService.counterOffer(
          orderId,
          vendorId,
          { fee, dueDate: new Date(dueDate), notes },
          tenantId
        );

        return res.json({
          success: true,
          data: {
            negotiationId: negotiation.id,
            orderId: negotiation.orderId,
            status: negotiation.status,
            currentTerms: negotiation.currentTerms,
            roundNumber: negotiation.rounds.length
          }
        });

      } catch (error: any) {
        logger.error('Failed to submit counter-offer', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to submit counter-offer'
        });
      }
    }
  );

  /**
   * POST /api/negotiations/:negotiationId/accept-counter
   * AMC/Client accepts vendor's counter-offer
   */
  router.post(
    '/:negotiationId/accept-counter',
    [
      param('negotiationId').notEmpty().withMessage('Negotiation ID is required'),
      body('clientId').notEmpty().withMessage('Client ID is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const negotiationId = req.params.negotiationId as string;
        const { clientId } = req.body;

        logger.info('Client accepting counter-offer', { negotiationId, clientId });

        const updatedOrder = await negotiationService.acceptCounterOffer(
          negotiationId,
          clientId,
          tenantId
        );

        return res.json({
          success: true,
          data: {
            orderId: updatedOrder.id,
            status: updatedOrder.status,
            acceptedTerms: {
              fee: updatedOrder.fee,
              dueDate: updatedOrder.dueDate
            },
            acceptedAt: updatedOrder.acceptedAt
          }
        });

      } catch (error: any) {
        logger.error('Failed to accept counter-offer', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to accept counter-offer'
        });
      }
    }
  );

  /**
   * POST /api/negotiations/:negotiationId/reject-counter
   * AMC/Client rejects vendor's counter-offer
   */
  router.post(
    '/:negotiationId/reject-counter',
    [
      param('negotiationId').notEmpty().withMessage('Negotiation ID is required'),
      body('clientId').notEmpty().withMessage('Client ID is required'),
      body('reason').notEmpty().withMessage('Rejection reason is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const negotiationId = req.params.negotiationId as string;
        const { clientId, reason } = req.body;

        logger.info('Client rejecting counter-offer', { negotiationId, clientId, reason });

        await negotiationService.rejectCounterOffer(
          negotiationId,
          clientId,
          reason,
          tenantId
        );

        return res.json({
          success: true,
          message: 'Counter-offer rejected successfully'
        });

      } catch (error: any) {
        logger.error('Failed to reject counter-offer', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to reject counter-offer'
        });
      }
    }
  );

  /**
   * POST /api/negotiations/:negotiationId/client-counter
   * AMC/Client submits counter to vendor's counter-offer
   */
  router.post(
    '/:negotiationId/client-counter',
    [
      param('negotiationId').notEmpty().withMessage('Negotiation ID is required'),
      body('clientId').notEmpty().withMessage('Client ID is required'),
      body('fee').isNumeric().withMessage('Fee must be a number'),
      body('dueDate').isISO8601().withMessage('Due date must be a valid date'),
      body('notes').optional().isString()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const negotiationId = req.params.negotiationId as string;
        const { clientId, fee, dueDate, notes } = req.body;

        logger.info('Client countering vendor offer', { negotiationId, clientId, fee, dueDate });

        const negotiation = await negotiationService.counterVendorOffer(
          negotiationId,
          { fee, dueDate: new Date(dueDate), notes },
          clientId,
          tenantId
        );

        return res.json({
          success: true,
          data: {
            negotiationId: negotiation.id,
            orderId: negotiation.orderId,
            status: negotiation.status,
            currentTerms: negotiation.currentTerms,
            roundNumber: negotiation.rounds.length
          }
        });

      } catch (error: any) {
        logger.error('Failed to counter vendor offer', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to counter vendor offer'
        });
      }
    }
  );

  /**
   * GET /api/negotiations/order/:orderId
   * Get negotiation history for an order
   */
  router.get(
    '/order/:orderId',
    [
      param('orderId').notEmpty().withMessage('Order ID is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const orderId = req.params.orderId as string;

        logger.info('Getting negotiation history', { orderId });

        const history = await negotiationService.getNegotiationHistory(orderId, tenantId);

        return res.json({
          success: true,
          data: {
            orderId,
            negotiations: history,
            count: history.length
          }
        });

      } catch (error: any) {
        logger.error('Failed to get negotiation history', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to get negotiation history'
        });
      }
    }
  );

  /**
   * GET /api/negotiations/active/:orderId
   * Get active negotiation for an order
   */
  router.get(
    '/active/:orderId',
    [
      param('orderId').notEmpty().withMessage('Order ID is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const orderId = req.params.orderId as string;

        logger.info('Getting active negotiation', { orderId });

        const negotiation = await negotiationService.getActiveNegotiation(orderId, tenantId);

        if (!negotiation) {
          return res.status(404).json({
            success: false,
            error: 'No active negotiation found'
          });
        }

        return res.json({
          success: true,
          data: negotiation
        });

      } catch (error: any) {
        logger.error('Failed to get active negotiation', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to get active negotiation'
        });
      }
    }
  );

  /**
   * POST /api/negotiations/check-expired
   * Check and expire stale negotiations (admin/system endpoint)
   */
  router.post(
    '/check-expired',
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId as string || 'default';

        logger.info('Checking expired negotiations', { tenantId });

        const expiredCount = await negotiationService.checkExpiredNegotiations(tenantId);

        return res.json({
          success: true,
          data: {
            expiredCount,
            checkedAt: new Date().toISOString()
          }
        });

      } catch (error: any) {
        logger.error('Failed to check expired negotiations', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to check expired negotiations'
        });
      }
    }
  );

  return router;
};
