/**
 * Negotiation Controller
 * Routes for vendor order acceptance, rejection, counter-offers, and AMC responses.
 * 
 * Frontend expects:
 *   POST /api/negotiations/accept         — vendor accepts assignment
 *   POST /api/negotiations/reject         — vendor rejects assignment
 *   POST /api/negotiations/counter-offer  — vendor submits counter-offer
 *   POST /api/negotiations/respond-counter — client responds (accept/reject) to counter
 *   GET  /api/negotiations/history/:orderId — negotiation history for order
 *   GET  /api/negotiations/active/:orderId  — active negotiation for order
 *   POST /api/negotiations/check-expired    — expire stale negotiations (admin/system)
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { OrderNegotiationService } from '../services/order-negotiation.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('NegotiationController');

export function createNegotiationRouter(): Router {
  const router = Router();
  const negotiationService = new OrderNegotiationService();

  // -------------------------------------------------------------------------
  // POST /accept — Vendor accepts order assignment
  // -------------------------------------------------------------------------
  router.post(
    '/accept',
    [
      body('orderId').isString().notEmpty().withMessage('orderId is required'),
      body('vendorId').isString().notEmpty().withMessage('vendorId is required'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const { orderId, vendorId } = req.body;

        const result = await negotiationService.acceptOrder(orderId, vendorId, tenantId);

        return res.json({
          success: true,
          data: {
            orderId,
            status: 'ACCEPTED',
            acceptedAt: result?.data?.acceptedAt || new Date().toISOString(),
            acceptedBy: vendorId
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

  // -------------------------------------------------------------------------
  // POST /reject — Vendor rejects order assignment
  // -------------------------------------------------------------------------
  router.post(
    '/reject',
    [
      body('orderId').isString().notEmpty().withMessage('orderId is required'),
      body('vendorId').isString().notEmpty().withMessage('vendorId is required'),
      body('reason').isString().notEmpty().withMessage('reason is required'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const { orderId, vendorId, reason } = req.body;

        await negotiationService.rejectOrder(orderId, vendorId, reason, tenantId);

        return res.json({
          success: true,
          data: {
            orderId,
            status: 'VENDOR_REJECTED',
            rejectedAt: new Date().toISOString(),
            rejectedBy: vendorId,
            rejectionReason: reason
          }
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

  // -------------------------------------------------------------------------
  // POST /counter-offer — Vendor submits counter-offer
  // -------------------------------------------------------------------------
  router.post(
    '/counter-offer',
    [
      body('orderId').isString().notEmpty().withMessage('orderId is required'),
      body('vendorId').isString().notEmpty().withMessage('vendorId is required'),
      body('proposedFee').isNumeric().withMessage('proposedFee must be a number'),
      body('proposedDueDate').isString().notEmpty().withMessage('proposedDueDate is required'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const { orderId, vendorId, proposedFee, proposedDueDate, notes } = req.body;

        const negotiation = await negotiationService.counterOffer(
          orderId,
          vendorId,
          {
            fee: proposedFee,
            dueDate: new Date(proposedDueDate),
            notes
          },
          tenantId
        );

        // Try auto-accept if within threshold
        const autoResult = await negotiationService.autoAcceptIfThresholdMet(
          negotiation.id,
          tenantId
        );

        if (autoResult) {
          return res.json({
            success: true,
            data: {
              id: negotiation.id,
              orderId,
              vendorId,
              proposedFee,
              proposedDueDate,
              notes,
              status: 'accepted',
              createdAt: negotiation.createdAt
            }
          });
        }

        return res.json({
          success: true,
          data: {
            id: negotiation.id,
            orderId,
            vendorId,
            proposedFee,
            proposedDueDate,
            notes,
            status: 'pending',
            createdAt: negotiation.createdAt
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

  // -------------------------------------------------------------------------
  // POST /respond-counter — Client responds (accept/reject) to counter-offer
  // Matches frontend: { orderId, counterOfferId, response: 'accept'|'reject', notes? }
  // -------------------------------------------------------------------------
  router.post(
    '/respond-counter',
    [
      body('orderId').isString().notEmpty().withMessage('orderId is required'),
      body('counterOfferId').isString().notEmpty().withMessage('counterOfferId is required'),
      body('response').isIn(['accept', 'reject']).withMessage('response must be accept or reject'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const clientId = (req as any).user?.userId || (req as any).user?.sub || 'system';
        const { orderId, counterOfferId, response, notes } = req.body;

        if (response === 'accept') {
          const result = await negotiationService.acceptCounterOffer(
            counterOfferId,
            clientId,
            tenantId
          );

          return res.json({
            success: true,
            data: {
              orderId,
              status: 'ACCEPTED',
              acceptedAt: new Date().toISOString(),
              acceptedBy: clientId
            }
          });
        } else {
          await negotiationService.rejectCounterOffer(
            counterOfferId,
            clientId,
            notes || 'Counter-offer rejected',
            tenantId
          );

          return res.json({
            success: true,
            data: {
              orderId,
              status: 'NEGOTIATION_FAILED',
              rejectedAt: new Date().toISOString(),
              rejectedBy: clientId,
              rejectionReason: notes || 'Counter-offer rejected'
            }
          });
        }
      } catch (error: any) {
        logger.error('Failed to respond to counter-offer', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to respond to counter-offer'
        });
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /pending-counter-offers — All negotiations awaiting AMC response
  // -------------------------------------------------------------------------
  router.get(
    '/pending-counter-offers',
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';

        const pendingOffers = await negotiationService.getPendingCounterOffers(tenantId);

        return res.json({
          success: true,
          data: pendingOffers,
          count: pendingOffers.length
        });
      } catch (error: any) {
        logger.error('Failed to get pending counter-offers', { error: error.message });
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to get pending counter-offers'
        });
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /history/:orderId — Negotiation history for order
  // -------------------------------------------------------------------------
  router.get(
    '/history/:orderId',
    [param('orderId').notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const { orderId } = req.params;

        const history = await negotiationService.getNegotiationHistory(orderId!, tenantId);

        return res.json({
          success: true,
          data: history,
          count: history.length
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

  // -------------------------------------------------------------------------
  // GET /active/:orderId — Active negotiation for order
  // -------------------------------------------------------------------------
  router.get(
    '/active/:orderId',
    [param('orderId').notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const { orderId } = req.params;

        const active = await negotiationService.getActiveNegotiation(orderId!, tenantId);

        return res.json({
          success: true,
          data: active
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

  // -------------------------------------------------------------------------
  // POST /check-expired — Expire stale negotiations (admin/cron endpoint)
  // -------------------------------------------------------------------------
  router.post(
    '/check-expired',
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';

        const expiredCount = await negotiationService.checkExpiredNegotiations(tenantId);

        return res.json({
          success: true,
          data: { expiredCount }
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
}
