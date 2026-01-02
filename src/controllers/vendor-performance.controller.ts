/**
 * Vendor Performance Controller
 * API endpoints for vendor scorecard and performance metrics
 */

import express, { Request, Response, NextFunction, Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger';
import { VendorPerformanceCalculatorService } from '../services/vendor-performance-calculator.service';
import { CosmosDbService } from '../services/cosmos-db.service';
import { 
  GetVendorPerformanceResponse,
  SearchVendorsRequest,
  SearchVendorsResponse,
  VendorScorecardSummary,
  VendorPerformanceHistory,
  VendorAvailability
} from '../types/vendor-marketplace.types';

const logger = new Logger();
const performanceService = new VendorPerformanceCalculatorService();
const dbService = new CosmosDbService();

export const createVendorPerformanceRouter = (): Router => {
  const router = express.Router();

  /**
   * GET /api/vendor-performance/:vendorId
   * Get comprehensive performance metrics for a vendor
   */
  router.get(
    '/:vendorId',
    [
      param('vendorId').notEmpty().withMessage('Vendor ID is required'),
      query('includeHistory').optional().isBoolean(),
      query('historyPeriod').optional().isIn(['DAILY', 'WEEKLY', 'MONTHLY']),
      query('historyDays').optional().isInt({ min: 1, max: 365 })
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

        const { vendorId } = req.params;
        const tenantId = (req as any).user?.tenantId as string || 'default';
        const includeHistory = req.query.includeHistory === 'true';

        if (!vendorId || !tenantId) {
          return res.status(400).json({ 
            success: false, 
            error: 'Vendor ID and tenant ID are required' 
          });
        }

        logger.info('Fetching vendor performance', { vendorId, tenantId });

        // Get or calculate current metrics
        let metrics = await getLatestMetrics(vendorId, tenantId);
        
        if (!metrics) {
          // Calculate if not exists
          metrics = await performanceService.calculateVendorMetrics(vendorId, tenantId);
        }

        // Get availability
        const availability = await getVendorAvailability(vendorId);

        // Get history if requested
        let history: VendorPerformanceHistory | undefined;
        if (includeHistory) {
          const period = (req.query.historyPeriod as any) || 'WEEKLY';
          const days = parseInt(req.query.historyDays as string) || 90;
          history = await getPerformanceHistory(vendorId, tenantId, period, days);
        }

        const response: GetVendorPerformanceResponse = {
          success: true,
          data: {
            metrics,
            availability: (availability || getDefaultAvailability(vendorId)) as VendorAvailability,
            ...(history && { history })
          }
        };

        return res.json(response);

      } catch (error) {
        logger.error('Failed to get vendor performance', { error });
        return next(error);
      }
    }
  );

  /**
   * POST /api/vendor-performance/:vendorId/recalculate
   * Force recalculation of vendor metrics
   */
  router.post(
    '/:vendorId/recalculate',
    [
      param('vendorId').notEmpty().withMessage('Vendor ID is required')
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

        const { vendorId } = req.params;
        const tenantId = (req as any).user?.tenantId as string || 'default';

        if (!vendorId || !tenantId) {
          return res.status(400).json({ 
            success: false, 
            error: 'Vendor ID and tenant ID are required' 
          });
        }

        logger.info('Recalculating vendor metrics', { vendorId, tenantId });

        const metrics = await performanceService.calculateVendorMetrics(vendorId, tenantId);

        return res.json({
          success: true,
          data: metrics,
          message: 'Metrics recalculated successfully'
        });

      } catch (error) {
        logger.error('Failed to recalculate metrics', { error });
        return next(error);
      }
    }
  );

  /**
   * GET /api/vendor-performance/leaderboard
   * Get top performing vendors
   */
  router.get(
    '/leaderboard',
    [
      query('region').optional().isString(),
      query('propertyType').optional().isString(),
      query('limit').optional().isInt({ min: 1, max: 100 })
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = (req as any).user?.tenantId || 'default';
        const limit = parseInt(req.query.limit as string) || 10;
        const region = req.query.region as string;
        const propertyType = req.query.propertyType as string;

        logger.info('Fetching vendor leaderboard', { tenantId, limit });

        const leaderboard = await getLeaderboard(tenantId, limit, region, propertyType);

        return res.json({
          success: true,
          data: leaderboard
        });

      } catch (error) {
        logger.error('Failed to get leaderboard', { error });
        return next(error);
      }
    }
  );

  /**
   * POST /api/vendor-performance/search
   * Search vendors with filters
   */
  router.post(
    '/search',
    [
      body('minScore').optional().isInt({ min: 0, max: 100 }),
      body('maxScore').optional().isInt({ min: 0, max: 100 }),
      body('tiers').optional().isArray(),
      body('status').optional().isArray(),
      body('limit').optional().isInt({ min: 1, max: 100 }),
      body('offset').optional().isInt({ min: 0 })
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

        const tenantId = (req as any).user?.tenantId || 'default';
        const searchRequest: SearchVendorsRequest = {
          tenantId,
          ...req.body,
          limit: req.body.limit || 20,
          offset: req.body.offset || 0
        };

        logger.info('Searching vendors', { searchRequest });

        const results = await searchVendors(searchRequest);

        const response: SearchVendorsResponse = {
          success: true,
          data: results
        };

        return res.json(response);

      } catch (error) {
        logger.error('Failed to search vendors', { error });
        return next(error);
      }
    }
  );

  /**
   * GET /api/vendor-performance/:vendorId/history
   * Get performance history for a vendor
   */
  router.get(
    '/:vendorId/history',
    [
      param('vendorId').notEmpty().withMessage('Vendor ID is required'),
      query('period').optional().isIn(['DAILY', 'WEEKLY', 'MONTHLY']),
      query('days').optional().isInt({ min: 1, max: 365 })
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { vendorId } = req.params;
        const tenantId = (req as any).user?.tenantId as string;
        const period = (req.query.period as 'DAILY' | 'WEEKLY' | 'MONTHLY') || 'DAILY';
        const days = parseInt(req.query.days as string) || 90;

        if (!vendorId || !tenantId) {
          return res.status(400).json({ error: 'Vendor ID and tenant ID are required' });
        }

        const history = await getPerformanceHistory(vendorId, tenantId, period, days);

        return res.json({
          success: true,
          data: history
        });

      } catch (error) {
        logger.error('Failed to get performance history', { error });
        return next(error);
      }
    }
  );

  return router;
};

// Helper Functions

async function getLatestMetrics(vendorId: string, tenantId: string) {
  const query = `
    SELECT TOP 1 * FROM c
    WHERE c.vendorId = @vendorId
    AND c.tenantId = @tenantId
    AND c.type = 'vendor-performance-metrics'
    ORDER BY c.calculatedAt DESC
  `;

  const result = await dbService.queryItems(
    'vendor-performance-metrics',
    query,
    [
      { name: '@vendorId', value: vendorId },
      { name: '@tenantId', value: tenantId }
    ]
  ) as any;

  return result.resources?.[0] || null;
}

async function getVendorAvailability(vendorId: string) {
  try {
    const availability = await dbService.getItem('vendor-availability', vendorId, vendorId);
    return availability;
  } catch {
    return null;
  }
}

function getDefaultAvailability(vendorId: string) {
  return {
    id: `availability-${vendorId}`,
    vendorId,
    currentCapacity: 10,
    currentLoad: 0,
    availableSlots: 10,
    availability: [],
    blackoutDates: [],
    serviceAreas: {
      zipCodes: [],
      counties: [],
      radius: 50,
      homeBase: { lat: 0, lng: 0 }
    },
    currentStatus: 'AVAILABLE' as const,
    statusUpdatedAt: new Date(),
    autoAcceptEnabled: false
  };
}

async function getPerformanceHistory(
  vendorId: string,
  tenantId: string,
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  days: number
): Promise<VendorPerformanceHistory> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const query = `
    SELECT * FROM c
    WHERE c.vendorId = @vendorId
    AND c.tenantId = @tenantId
    AND c.type = 'vendor-performance-metrics'
    AND c.calculatedAt >= @cutoffDate
    ORDER BY c.calculatedAt DESC
  `;

  const result = await dbService.queryItems(
    'vendor-performance-metrics',
    query,
    [
      { name: '@vendorId', value: vendorId },
      { name: '@tenantId', value: tenantId },
      { name: '@cutoffDate', value: cutoffDate.toISOString() }
    ]
  ) as any;

  return {
    vendorId,
    period,
    dataPoints: (result.resources || []).map((m: any) => ({
      date: new Date(m.calculatedAt),
      overallScore: m.overallScore,
      ordersCompleted: m.totalOrdersCompleted,
      avgTurnaround: m.avgTurnaroundTime,
      qualityScore: m.qualityScore
    }))
  };
}

async function getLeaderboard(
  tenantId: string,
  limit: number,
  region?: string,
  propertyType?: string
) {
  let query = `
    SELECT TOP @limit
      c.vendorId,
      c.overallScore,
      c.tier,
      c.totalOrdersCompleted,
      c.avgTurnaroundTime,
      c.onTimeDeliveryRate,
      c.qualityScore
    FROM c
    WHERE c.tenantId = @tenantId
    AND c.type = 'vendor-performance-metrics'
  `;

  const parameters: any[] = [
    { name: '@tenantId', value: tenantId },
    { name: '@limit', value: limit }
  ];

  if (propertyType) {
    query += ` AND ARRAY_CONTAINS(c.propertyTypes, @propertyType)`;
    parameters.push({ name: '@propertyType', value: propertyType });
  }

  query += ` ORDER BY c.overallScore DESC`;

  const result = await dbService.queryItems(
    'vendor-performance-metrics',
    query,
    parameters
  ) as any;

  return (result.resources || []).map((m: any, index: number) => ({
    rank: index + 1,
    vendorId: m.vendorId,
    overallScore: m.overallScore,
    tier: m.tier,
    ordersCompleted: m.totalOrdersCompleted,
    avgTurnaround: m.avgTurnaroundTime,
    onTimeRate: m.onTimeDeliveryRate,
    qualityScore: m.qualityScore
  }));
}

async function searchVendors(request: SearchVendorsRequest) {
  let query = `
    SELECT 
      c.vendorId,
      c.overallScore,
      c.tier,
      c.totalOrdersCompleted,
      c.avgTurnaroundTime,
      c.onTimeDeliveryRate,
      c.qualityScore
    FROM c
    WHERE c.tenantId = @tenantId
    AND c.type = 'vendor-performance-metrics'
  `;

  const parameters: any[] = [
    { name: '@tenantId', value: request.tenantId }
  ];

  // Apply filters
  if (request.minScore !== undefined) {
    query += ` AND c.overallScore >= @minScore`;
    parameters.push({ name: '@minScore', value: request.minScore });
  }

  if (request.maxScore !== undefined) {
    query += ` AND c.overallScore <= @maxScore`;
    parameters.push({ name: '@maxScore', value: request.maxScore });
  }

  if (request.tiers && request.tiers.length > 0) {
    query += ` AND c.tier IN (${request.tiers.map((_, i) => `@tier${i}`).join(', ')})`;
    request.tiers.forEach((tier, i) => {
      parameters.push({ name: `@tier${i}`, value: tier });
    });
  }

  // Sorting
  const sortBy = request.sortBy || 'score';
  const sortOrder = request.sortOrder || 'desc';
  const sortField = sortBy === 'score' ? 'c.overallScore' : 
                    sortBy === 'ordersCompleted' ? 'c.totalOrdersCompleted' :
                    sortBy === 'turnaroundTime' ? 'c.avgTurnaroundTime' : 'c.overallScore';
  
  query += ` ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;

  // Pagination
  query += ` OFFSET @offset LIMIT @limit`;
  parameters.push(
    { name: '@offset', value: request.offset || 0 },
    { name: '@limit', value: request.limit || 20 }
  );

  const result = await dbService.queryItems(
    'vendor-performance-metrics',
    query,
    parameters
  ) as any;

  // Get total count
  const countQuery = query.replace(/SELECT.*FROM/, 'SELECT VALUE COUNT(1) FROM').split('ORDER BY')[0] as string;
  const countResult = await dbService.queryItems(
    'vendor-performance-metrics',
    countQuery,
    parameters.filter(p => p.name !== '@offset' && p.name !== '@limit')
  ) as any;
  const total = countResult.resources?.[0] || 0;

  const vendors: VendorScorecardSummary[] = (result.resources || []).map((m: any) => ({
    vendorId: m.vendorId,
    vendorName: m.vendorId, // TODO: Get actual vendor name
    overallScore: m.overallScore,
    tier: m.tier,
    ordersCompleted: m.totalOrdersCompleted,
    avgTurnaroundTime: m.avgTurnaroundTime,
    onTimeRate: m.onTimeDeliveryRate,
    qualityScore: m.qualityScore,
    currentStatus: 'AVAILABLE',
    availableSlots: 0
  }));

  return {
    vendors,
    total,
    offset: request.offset || 0,
    limit: request.limit || 20
  };
}
