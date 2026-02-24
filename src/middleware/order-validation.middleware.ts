/**
 * Order Validation Middleware
 *
 * Express-validator chains for order endpoints.
 * Extracted as standalone functions so they can be wired into OrderController's setupRoutes.
 *
 * Pattern follows existing controllers (qc-results, enhanced-property-intelligence).
 */

import { body, param, query } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// ─── Shared Error Handler ──────────────────────────────────────────────────

/**
 * Express middleware that checks for express-validator errors.
 * Returns 400 with structured error details if validation failed.
 */
export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array(),
    });
    return;
  }
  next();
}

// ─── POST / — Create Order ─────────────────────────────────────────────────

/**
 * Validates the body of POST /api/orders.
 *
 * Required fields: propertyAddress (object with city/state/zipCode),
 * clientId, orderType, productType, dueDate.
 * Optional: priority, specialInstructions, propertyDetails, assignedVendorId.
 */
export function validateCreateOrder() {
  return [
    body('propertyAddress')
      .isObject()
      .withMessage('propertyAddress is required and must be an object'),
    body('propertyAddress.city')
      .isString()
      .isLength({ min: 2 })
      .withMessage('propertyAddress.city is required (min 2 characters)'),
    body('propertyAddress.state')
      .isString()
      .isLength({ min: 2, max: 2 })
      .withMessage('propertyAddress.state must be a 2-letter code'),
    body('propertyAddress.zipCode')
      .matches(/^\d{5}(-\d{4})?$/)
      .withMessage('propertyAddress.zipCode must be a valid US ZIP code'),
    body('clientId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('clientId is required'),
    body('orderType')
      .isString()
      .isLength({ min: 1 })
      .withMessage('orderType is required'),
    body('productType')
      .isString()
      .isLength({ min: 1 })
      .withMessage('productType is required'),
    body('dueDate')
      .isISO8601()
      .withMessage('dueDate must be a valid ISO 8601 date'),
    body('priority')
      .optional()
      .isString(),
    body('specialInstructions')
      .optional()
      .isString(),
    body('engagementInstructions')
      .optional()
      .isString()
      .trim(),
    body('propertyDetails')
      .optional()
      .isObject(),
    body('assignedVendorId')
      .optional()
      .isString(),
    handleValidationErrors,
  ];
}

// ─── POST /:orderId/cancel ─────────────────────────────────────────────────

/**
 * Validates the body of POST /api/orders/:orderId/cancel.
 * Requires a reason string.
 */
export function validateCancelOrder() {
  return [
    param('orderId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('orderId is required'),
    body('reason')
      .isString()
      .isLength({ min: 1 })
      .withMessage('A cancellation reason is required'),
    handleValidationErrors,
  ];
}

// ─── POST /search ──────────────────────────────────────────────────────────

/**
 * Validates the body of POST /api/orders/search.
 * All fields are optional; at least one filter should typically be provided.
 */
export function validateSearchOrders() {
  return [
    body('textQuery')
      .optional()
      .isString(),
    body('status')
      .optional()
      .isArray()
      .withMessage('status must be an array'),
    body('priority')
      .optional()
      .isArray()
      .withMessage('priority must be an array'),
    body('orderType')
      .optional()
      .isArray()
      .withMessage('orderType must be an array'),
    body('productType')
      .optional()
      .isArray()
      .withMessage('productType must be an array'),
    body('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit must be 1–100'),
    body('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('offset must be >= 0'),
    handleValidationErrors,
  ];
}

// ─── POST /batch-status ────────────────────────────────────────────────────

/**
 * Validates the body of POST /api/orders/batch-status.
 * Requires orderIds array and target status.
 */
export function validateBatchStatusUpdate() {
  return [
    body('orderIds')
      .isArray({ min: 1 })
      .withMessage('orderIds must be a non-empty array'),
    body('orderIds.*')
      .isString()
      .withMessage('Each orderId must be a string'),
    body('status')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Target status is required'),
    body('reason')
      .optional()
      .isString(),
    handleValidationErrors,
  ];
}
