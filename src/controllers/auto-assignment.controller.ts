/**
 * Auto-Assignment Controller
 * Handles automatic vendor assignment and order broadcasting
 */

import express, { Request, Response, NextFunction, Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import { VendorMatchingEngine } from '../services/vendor-matching-engine.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import {
  VendorMatchRequest,
  VendorMatchCriteria,
  VendorMatchResult
} from '../types/vendor-marketplace.types.js';

const logger = new Logger();
const matchingEngine = new VendorMatchingEngine();
const dbService = new CosmosDbService();

export const createAutoAssignmentRouter = (): Router => {
  const router = express.Router();

  /**
   * POST /api/auto-assignment/find-matches
   * Find matching vendors for an order
   */
  router.post(
    '/find-matches',
    [
      body('orderId').optional().isString(),
      body('propertyAddress').notEmpty().withMessage('Property address is required'),
      body('propertyType').notEmpty().withMessage('Property type is required'),
      body('dueDate').optional().isISO8601(),
      body('urgency').optional().isIn(['STANDARD', 'RUSH', 'SUPER_RUSH']),
      body('budget').optional().isNumeric(),
      body('topN').optional().isInt({ min: 1, max: 50 })
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const topN = req.body.topN || 10;

        const matchRequest: VendorMatchRequest = {
          orderId: req.body.orderId,
          tenantId,
          propertyAddress: req.body.propertyAddress,
          propertyType: req.body.propertyType,
          dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(),
          urgency: req.body.urgency,
          budget: req.body.budget,
          clientPreferences: req.body.clientPreferences
        };

        logger.info('Finding vendor matches', { 
          propertyAddress: matchRequest.propertyAddress,
          topN 
        });

        const matches = await matchingEngine.findMatchingVendors(matchRequest, topN);

        return res.json({
          success: true,
          data: {
            matches,
            count: matches.length,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error: any) {
        logger.error('Failed to find vendor matches', error);
        return next(error);
      }
    }
  );

  /**
   * POST /api/auto-assignment/assign
   * Auto-assign order to best matching vendor
   */
  router.post(
    '/assign',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('propertyAddress').notEmpty().withMessage('Property address is required'),
      body('propertyType').notEmpty().withMessage('Property type is required'),
      body('dueDate').optional().isISO8601(),
      body('urgency').optional().isIn(['STANDARD', 'RUSH', 'SUPER_RUSH']),
      body('budget').optional().isNumeric(),
      body('criteria').optional().isObject(),
      body('criteria.minMatchScore').optional().isInt({ min: 0, max: 100 }),
      body('criteria.maxDistance').optional().isNumeric(),
      body('criteria.requiredTier').optional().isIn(['PLATINUM', 'GOLD', 'SILVER', 'BRONZE']),
      body('criteria.requireAvailability').optional().isBoolean()
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const orderId = req.body.orderId;

        const matchRequest: VendorMatchRequest = {
          orderId,
          tenantId,
          propertyAddress: req.body.propertyAddress,
          propertyType: req.body.propertyType,
          dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(),
          urgency: req.body.urgency,
          budget: req.body.budget,
          clientPreferences: req.body.clientPreferences
        };

        const criteria: VendorMatchCriteria = {
          minMatchScore: req.body.criteria?.minMatchScore || 70,
          maxDistance: req.body.criteria?.maxDistance,
          requiredTier: req.body.criteria?.requiredTier,
          requireAvailability: req.body.criteria?.requireAvailability !== false,
          excludedVendors: req.body.criteria?.excludedVendors
        };

        logger.info('Auto-assigning order', { orderId, criteria });

        const selectedVendor = await matchingEngine.autoAssignOrder(matchRequest, criteria);

        if (!selectedVendor) {
          return res.status(404).json({
            success: false,
            error: 'No vendors found matching the criteria'
          });
        }

        // Update order with assigned vendor
        await updateOrderAssignment(orderId, tenantId, selectedVendor);

        // Send notification to vendor
        await notifyVendorOfAssignment(selectedVendor.vendorId, orderId);

        return res.json({
          success: true,
          data: {
            orderId,
            assignedVendor: selectedVendor,
            assignedAt: new Date().toISOString()
          }
        });

      } catch (error: any) {
        logger.error('Failed to auto-assign order', error);
        return next(error);
      }
    }
  );

  /**
   * POST /api/auto-assignment/broadcast
   * Broadcast order to multiple vendors (auction mode)
   */
  router.post(
    '/broadcast',
    [
      body('orderId').notEmpty().withMessage('Order ID is required'),
      body('propertyAddress').notEmpty().withMessage('Property address is required'),
      body('propertyType').notEmpty().withMessage('Property type is required'),
      body('dueDate').optional().isISO8601(),
      body('urgency').optional().isIn(['STANDARD', 'RUSH', 'SUPER_RUSH']),
      body('budget').optional().isNumeric(),
      body('vendorCount').optional().isInt({ min: 1, max: 20 }),
      body('expirationHours').optional().isInt({ min: 1, max: 72 })
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const orderId = req.body.orderId;
        const vendorCount = req.body.vendorCount || 5;
        const expirationHours = req.body.expirationHours || 24;

        const matchRequest: VendorMatchRequest = {
          orderId,
          tenantId,
          propertyAddress: req.body.propertyAddress,
          propertyType: req.body.propertyType,
          dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(),
          urgency: req.body.urgency,
          budget: req.body.budget,
          clientPreferences: req.body.clientPreferences
        };

        logger.info('Broadcasting order to vendors', { 
          orderId, 
          vendorCount,
          expirationHours 
        });

        const broadcastVendors = await matchingEngine.broadcastToVendors(
          matchRequest,
          vendorCount,
          expirationHours
        );

        // Update order status to "broadcast"
        await updateOrderBroadcastStatus(orderId, tenantId, broadcastVendors.length);

        // Send notifications to all vendors
        await Promise.all(
          broadcastVendors.map(vendor => 
            notifyVendorOfBroadcast(vendor.vendorId, orderId, expirationHours)
          )
        );

        return res.json({
          success: true,
          data: {
            orderId,
            broadcastTo: broadcastVendors,
            count: broadcastVendors.length,
            expiresAt: new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString(),
            broadcastAt: new Date().toISOString()
          }
        });

      } catch (error: any) {
        logger.error('Failed to broadcast order', error);
        return next(error);
      }
    }
  );

  /**
   * POST /api/auto-assignment/accept-bid
   * Accept a vendor's bid and assign the order
   */
  router.post(
    '/accept-bid',
    [
      param('bidId').notEmpty().withMessage('Bid ID is required')
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            errors: errors.array()
          });
        }

        const tenantId = (req as any).user?.tenantId as string || 'default';
        const bidId = req.body.bidId;

        logger.info('Accepting vendor bid', { bidId });

        // Get bid details
        const bid = await dbService.getItem('vendor-bids', bidId, bidId);
        if (!bid) {
          return res.status(404).json({
            success: false,
            error: 'Bid not found'
          });
        }

        // Update bid status
        await dbService.updateItem('vendor-bids', bidId, {
          ...bid,
          status: 'ACCEPTED',
          acceptedAt: new Date().toISOString()
        }, bidId);

        // Assign order to vendor
        const orderId = (bid as any).orderId;
        const vendorId = (bid as any).vendorId;

        await updateOrderAssignment(orderId, tenantId, {
          vendorId,
          matchScore: 0,
          scoreBreakdown: {
            performance: 0,
            availability: 0,
            proximity: 0,
            experience: 0,
            cost: 0
          },
          distance: null,
          estimatedTurnaround: (bid as any).proposedTurnaround,
          estimatedFee: (bid as any).proposedFee,
          matchReasons: [],
          vendor: {
            id: vendorId,
            name: (bid as any).vendorName,
            tier: 'SILVER',
            overallScore: 0
          }
        });

        // Notify vendor of acceptance
        await notifyVendorOfAcceptance(vendorId, orderId);

        // Reject other bids for this order
        await rejectOtherBids(orderId, bidId);

        return res.json({
          success: true,
          data: {
            bidId,
            orderId,
            vendorId,
            acceptedAt: new Date().toISOString()
          }
        });

      } catch (error: any) {
        logger.error('Failed to accept bid', error);
        return next(error);
      }
    }
  );

  /**
   * GET /api/auto-assignment/bids/:orderId
   * Get all bids for an order
   */
  router.get(
    '/bids/:orderId',
    [
      param('orderId').notEmpty().withMessage('Order ID is required')
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { orderId } = req.params;
        const tenantId = (req as any).user?.tenantId as string || 'default';

        const query = `
          SELECT * FROM c
          WHERE c.orderId = @orderId
          AND c.entityType = 'vendor-bid-invitation'
          ORDER BY c.matchScore DESC
        `;

        const result = await dbService.queryItems(
          'vendor-bids',
          query,
          [{ name: '@orderId', value: orderId }]
        ) as any;

        const bids = result.resources || [];

        return res.json({
          success: true,
          data: {
            orderId,
            bids,
            count: bids.length
          }
        });

      } catch (error: any) {
        logger.error('Failed to get order bids', error);
        return next(error);
      }
    }
  );

  return router;
};

// Helper Functions

async function updateOrderAssignment(
  orderId: string,
  tenantId: string,
  vendor: VendorMatchResult
): Promise<void> {
  try {
    const order = await dbService.getItem('orders', orderId, tenantId);
    if (!order) {
      throw new Error('Order not found');
    }

    await dbService.updateItem('orders', orderId, {
      ...order,
      status: 'ASSIGNED',
      assignedVendorId: vendor.vendorId,
      assignedVendorName: vendor.vendor.name,
      assignedAt: new Date().toISOString(),
      matchScore: vendor.matchScore,
      estimatedTurnaround: vendor.estimatedTurnaround,
      estimatedFee: vendor.estimatedFee,
      updatedAt: new Date().toISOString()
    }, tenantId);

    logger.info('Order assignment updated', { orderId, vendorId: vendor.vendorId });

  } catch (error: any) {
    logger.error('Failed to update order assignment', error);
    throw error;
  }
}

async function updateOrderBroadcastStatus(
  orderId: string,
  tenantId: string,
  vendorCount: number
): Promise<void> {
  try {
    const order = await dbService.getItem('orders', orderId, tenantId);
    if (!order) {
      throw new Error('Order not found');
    }

    await dbService.updateItem('orders', orderId, {
      ...order,
      status: 'BROADCAST',
      broadcastAt: new Date().toISOString(),
      broadcastVendorCount: vendorCount,
      updatedAt: new Date().toISOString()
    }, tenantId);

    logger.info('Order broadcast status updated', { orderId, vendorCount });

  } catch (error: any) {
    logger.error('Failed to update order broadcast status', error);
    throw error;
  }
}

async function notifyVendorOfAssignment(vendorId: string, orderId: string): Promise<void> {
  // TODO: Implement vendor notification (email, SMS, push notification)
  logger.info('Vendor notification sent (assignment)', { vendorId, orderId });
}

async function notifyVendorOfBroadcast(
  vendorId: string,
  orderId: string,
  expirationHours: number
): Promise<void> {
  // TODO: Implement vendor notification (email, SMS, push notification)
  logger.info('Vendor notification sent (broadcast)', { vendorId, orderId, expirationHours });
}

async function notifyVendorOfAcceptance(vendorId: string, orderId: string): Promise<void> {
  // TODO: Implement vendor notification (email, SMS, push notification)
  logger.info('Vendor notification sent (acceptance)', { vendorId, orderId });
}

async function rejectOtherBids(orderId: string, acceptedBidId: string): Promise<void> {
  try {
    const query = `
      SELECT * FROM c
      WHERE c.orderId = @orderId
      AND c.id != @acceptedBidId
      AND c.status = 'PENDING'
    `;

    const result = await dbService.queryItems(
      'vendor-bids',
      query,
      [
        { name: '@orderId', value: orderId },
        { name: '@acceptedBidId', value: acceptedBidId }
      ]
    ) as any;

    const bids = result.resources || [];

    // Update all other bids to REJECTED
    for (const bid of bids) {
      await dbService.updateItem('vendor-bids', bid.id, {
        ...bid,
        status: 'REJECTED',
        rejectedAt: new Date().toISOString(),
        rejectionReason: 'Another vendor was selected'
      }, bid.id);
    }

    logger.info(`Rejected ${bids.length} other bids for order ${orderId}`);

  } catch (error: any) {
    logger.error('Failed to reject other bids', error);
  }
}
