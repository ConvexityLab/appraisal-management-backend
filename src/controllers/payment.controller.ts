/**
 * Payment Processing Controller
 * REST API endpoints for invoicing and vendor payments
 */

import express, { Request, Response, Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import { PaymentProcessingService } from '../services/payment-processing.service.js';
import { PaymentMethod, InvoiceStatus } from '../types/payment.types.js';

const logger = new Logger();
const paymentService = new PaymentProcessingService();

export const createPaymentRouter = (): Router => {
  const router = express.Router();

  /**
   * POST /api/payments/invoices
   * Create invoice for vendor
   */
  router.post(
    '/invoices',
    [
      body('vendorId').notEmpty().withMessage('Vendor ID is required'),
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required'),
      body('lineItems.*.description').notEmpty(),
      body('lineItems.*.quantity').isInt({ min: 1 }),
      body('lineItems.*.unitPrice').isFloat({ min: 0 }),
      body('lineItems.*.taxable').isBoolean(),
      body('createdBy').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ success: false, errors: errors.array() });
          return;
        }

        const invoice = await paymentService.createInvoice(req.body);

        res.status(201).json({
          success: true,
          data: invoice,
          message: 'Invoice created successfully'
        });

      } catch (error) {
        logger.error('Failed to create invoice', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to create invoice'
        });
      }
    }
  );

  /**
   * POST /api/payments/invoices/:invoiceId/send
   * Send invoice to vendor
   */
  router.post(
    '/invoices/:invoiceId/send',
    [
      param('invoiceId').notEmpty(),
      body('vendorId').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const { invoiceId } = req.params;
        const { vendorId } = req.body;

        const success = await paymentService.sendInvoice(invoiceId!, vendorId);

        if (success) {
          res.json({
            success: true,
            message: 'Invoice sent successfully'
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Failed to send invoice'
          });
        }

      } catch (error) {
        logger.error('Failed to send invoice', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to send invoice'
        });
      }
    }
  );

  /**
   * POST /api/payments/process
   * Process payment for invoice
   */
  router.post(
    '/process',
    [
      body('invoiceId').notEmpty().withMessage('Invoice ID is required'),
      body('vendorId').notEmpty().withMessage('Vendor ID is required'),
      body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
      body('paymentMethod').isIn(Object.values(PaymentMethod)).withMessage('Valid payment method is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ success: false, errors: errors.array() });
          return;
        }

        const result = await paymentService.processPayment(req.body);

        if (result.success) {
          res.json({
            success: true,
            data: result,
            message: 'Payment processed successfully'
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error || 'Payment processing failed',
            details: result
          });
        }

      } catch (error) {
        logger.error('Payment processing failed', { error });
        res.status(500).json({
          success: false,
          error: 'Payment processing failed'
        });
      }
    }
  );

  /**
   * POST /api/payments/bulk
   * Process bulk payments
   */
  router.post(
    '/bulk',
    [
      body('payments').isArray({ min: 1 }).withMessage('At least one payment is required'),
      body('payments.*.invoiceId').notEmpty(),
      body('payments.*.vendorId').notEmpty(),
      body('payments.*.amount').isFloat({ min: 0.01 }),
      body('paymentMethod').isIn(Object.values(PaymentMethod)),
      body('initiatedBy').optional()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ success: false, errors: errors.array() });
          return;
        }

        const result = await paymentService.processBulkPayments(req.body);

        res.json({
          success: result.success,
          data: result,
          message: `Bulk payment completed: ${result.successCount}/${result.totalRequested} successful`
        });

      } catch (error) {
        logger.error('Bulk payment processing failed', { error });
        res.status(500).json({
          success: false,
          error: 'Bulk payment processing failed'
        });
      }
    }
  );

  /**
   * GET /api/payments/vendor/:vendorId/payments
   * Get payment history for vendor
   */
  router.get(
    '/vendor/:vendorId/payments',
    [
      param('vendorId').notEmpty(),
      query('startDate').optional().isISO8601(),
      query('endDate').optional().isISO8601()
    ],
    async (req: Request, res: Response) => {
      try {
        const { vendorId } = req.params;
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

        const payments = await paymentService.getVendorPayments(vendorId!, startDate, endDate);

        res.json({
          success: true,
          data: payments,
          count: payments.length
        });

      } catch (error) {
        logger.error('Failed to get vendor payments', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve payment history'
        });
      }
    }
  );

  /**
   * GET /api/payments/vendor/:vendorId/summary
   * Get payment summary for vendor
   */
  router.get(
    '/vendor/:vendorId/summary',
    [
      param('vendorId').notEmpty(),
      query('startDate').isISO8601().withMessage('Valid start date is required'),
      query('endDate').isISO8601().withMessage('Valid end date is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ success: false, errors: errors.array() });
          return;
        }

        const { vendorId } = req.params;
        const startDate = new Date(req.query.startDate as string);
        const endDate = new Date(req.query.endDate as string);

        const summary = await paymentService.getPaymentSummary(vendorId!, startDate, endDate);

        res.json({
          success: true,
          data: summary
        });

      } catch (error) {
        logger.error('Failed to get payment summary', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve payment summary'
        });
      }
    }
  );

  return router;
};
