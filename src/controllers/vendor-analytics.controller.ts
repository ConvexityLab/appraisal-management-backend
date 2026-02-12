/**
 * Vendor Analytics Controller
 * REST API endpoints for performance dashboards, trends, and analytics
 */

import express, { Request, Response, Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import { VendorPerformanceCalculatorService } from '../services/vendor-performance-calculator.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { VendorTier, VendorPerformanceMetrics } from '../types/vendor-marketplace.types.js';

const logger = new Logger();
const performanceService = new VendorPerformanceCalculatorService();
const dbService = new CosmosDbService();

// Define tier values for validation
const VALID_TIERS: VendorTier[] = ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'PROBATION'];

export const createVendorAnalyticsRouter = (): Router => {
  const router = express.Router();

  /**
   * GET /api/vendor-analytics/dashboard/:vendorId
   * Get comprehensive performance dashboard for vendor
   */
  router.get(
    '/dashboard/:vendorId',
    [
      param('vendorId').notEmpty(),
      query('tenantId').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const { vendorId } = req.params;
        const tenantId = req.query.tenantId as string;

        // Get current metrics
        const metrics = await performanceService.calculateVendorMetrics(vendorId!, tenantId);

        // Get historical trend (last 6 months)
        const historicalData = await getHistoricalPerformance(vendorId!, tenantId, 6);

        // Calculate trends
        const trends = calculateTrends(historicalData);

        res.json({
          success: true,
          data: {
            currentMetrics: metrics,
            trends,
            historicalData,
            lastUpdated: new Date()
          }
        });

      } catch (error) {
        logger.error('Failed to get vendor dashboard', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve dashboard data'
        });
      }
    }
  );

  /**
   * GET /api/vendor-analytics/trends/:vendorId
   * Get performance trends over time
   */
  router.get(
    '/trends/:vendorId',
    [
      param('vendorId').notEmpty(),
      query('tenantId').notEmpty(),
      query('months').optional().isInt({ min: 1, max: 24 })
    ],
    async (req: Request, res: Response) => {
      try {
        const { vendorId } = req.params;
        const tenantId = req.query.tenantId as string;
        const months = parseInt(req.query.months as string) || 6;

        const historicalData = await getHistoricalPerformance(vendorId!, tenantId, months);

        // Extract time series data
        const qualityTrend = historicalData.map(h => ({
          date: h.date,
          value: h.metrics.qualityScore
        }));

        const speedTrend = historicalData.map(h => ({
          date: h.date,
          value: h.metrics.avgTurnaroundTime
        }));

        const volumeTrend = historicalData.map(h => ({
          date: h.date,
          value: h.metrics.totalOrdersCompleted
        }));

        const scoreTrend = historicalData.map(h => ({
          date: h.date,
          value: h.metrics.overallScore,
          tier: h.metrics.tier
        }));

        res.json({
          success: true,
          data: {
            quality: qualityTrend,
            speed: speedTrend,
            volume: volumeTrend,
            overallScore: scoreTrend
          },
          period: {
            months,
            startDate: historicalData[0]?.date,
            endDate: historicalData[historicalData.length - 1]?.date
          }
        });

      } catch (error) {
        logger.error('Failed to get vendor trends', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve trend data'
        });
      }
    }
  );

  /**
   * GET /api/vendor-analytics/rankings
   * Get vendor rankings by performance
   */
  router.get(
    '/rankings',
    [
      query('tenantId').notEmpty(),
      query('tier').optional().isIn(VALID_TIERS),
      query('limit').optional().isInt({ min: 1, max: 100 })
    ],
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.query.tenantId as string;
        const tier = req.query.tier as VendorTier | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        // Query vendor performance metrics
        let query = `
          SELECT * FROM c 
          WHERE c.tenantId = @tenantId 
          AND c.type = 'vendor-performance-metrics'
        `;

        const parameters: any[] = [{ name: '@tenantId', value: tenantId }];

        if (tier) {
          query += ` AND c.tier = @tier`;
          parameters.push({ name: '@tier', value: tier });
        }

        query += ` ORDER BY c.overallScore DESC`;

        const result = await dbService.queryItems('vendor-performance-metrics', query, parameters) as any;
        const metrics = (result.resources || []).slice(0, limit);

        // Add rankings
        const rankedMetrics = metrics.map((m: any, index: number) => ({
          ...m,
          rank: index + 1
        }));

        res.json({
          success: true,
          data: rankedMetrics,
          count: rankedMetrics.length,
          summary: {
            totalVendors: metrics.length,
            tierDistribution: calculateTierDistribution(metrics)
          }
        });

      } catch (error) {
        logger.error('Failed to get vendor rankings', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve rankings'
        });
      }
    }
  );

  /**
   * GET /api/vendor-analytics/comparative/:vendorId
   * Compare vendor performance against peers
   */
  router.get(
    '/comparative/:vendorId',
    [
      param('vendorId').notEmpty(),
      query('tenantId').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const { vendorId } = req.params;
        const tenantId = req.query.tenantId as string;

        // Get vendor metrics
        const vendorMetrics = await performanceService.calculateVendorMetrics(vendorId!, tenantId);

        // Get peer metrics (same tier)
        const peerQuery = `
          SELECT * FROM c 
          WHERE c.tenantId = @tenantId 
          AND c.type = 'vendor-performance-metrics'
          AND c.tier = @tier
          AND c.vendorId != @vendorId
        `;

        const peerResult = await dbService.queryItems('vendor-performance-metrics', peerQuery, [
          { name: '@tenantId', value: tenantId },
          { name: '@tier', value: vendorMetrics.tier },
          { name: '@vendorId', value: vendorId }
        ]) as any;

        const peerMetrics = peerResult.resources || [];

        // Calculate peer averages
        const peerAverages = {
          qualityScore: calculateAverage(peerMetrics, 'qualityScore'),
          avgTurnaroundTime: calculateAverage(peerMetrics, 'avgTurnaroundTime'),
          onTimeDeliveryRate: calculateAverage(peerMetrics, 'onTimeDeliveryRate'),
          completionRate: calculateAverage(peerMetrics, 'completionRate'),
          overallScore: calculateAverage(peerMetrics, 'overallScore')
        };

        // Calculate differences
        const comparison = {
          qualityScore: {
            vendor: vendorMetrics.qualityScore,
            peerAverage: peerAverages.qualityScore,
            difference: vendorMetrics.qualityScore - peerAverages.qualityScore,
            percentile: calculatePercentile(vendorMetrics.qualityScore, peerMetrics.map((p: VendorPerformanceMetrics) => p.qualityScore))
          },
          speed: {
            vendor: vendorMetrics.avgTurnaroundTime,
            peerAverage: peerAverages.avgTurnaroundTime,
            difference: peerAverages.avgTurnaroundTime - vendorMetrics.avgTurnaroundTime, // Lower is better
            percentile: calculatePercentile(vendorMetrics.avgTurnaroundTime, peerMetrics.map((p: VendorPerformanceMetrics) => p.avgTurnaroundTime), true)
          },
          reliability: {
            vendor: vendorMetrics.onTimeDeliveryRate,
            peerAverage: peerAverages.onTimeDeliveryRate,
            difference: vendorMetrics.onTimeDeliveryRate - peerAverages.onTimeDeliveryRate,
            percentile: calculatePercentile(vendorMetrics.onTimeDeliveryRate, peerMetrics.map((p: VendorPerformanceMetrics) => p.onTimeDeliveryRate))
          },
          overallScore: {
            vendor: vendorMetrics.overallScore,
            peerAverage: peerAverages.overallScore,
            difference: vendorMetrics.overallScore - peerAverages.overallScore,
            percentile: calculatePercentile(vendorMetrics.overallScore, peerMetrics.map((p: VendorPerformanceMetrics) => p.overallScore))
          }
        };

        res.json({
          success: true,
          data: {
            vendor: vendorMetrics,
            peerGroup: {
              tier: vendorMetrics.tier,
              count: peerMetrics.length,
              averages: peerAverages
            },
            comparison
          }
        });

      } catch (error) {
        logger.error('Failed to get comparative analytics', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve comparative data'
        });
      }
    }
  );

  /**
   * GET /api/vendor-analytics/tier-analysis
   * Get tier distribution and analysis across all vendors
   */
  router.get(
    '/tier-analysis',
    [query('tenantId').notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.query.tenantId as string;

        const query = `
          SELECT * FROM c 
          WHERE c.tenantId = @tenantId 
          AND c.type = 'vendor-performance-metrics'
        `;

        const result = await dbService.queryItems('vendor-performance-metrics', query, [
          { name: '@tenantId', value: tenantId }
        ]) as any;

        const allMetrics = result.resources || [];

        // Group by tier
        const tierGroups: Record<VendorTier, VendorPerformanceMetrics[]> = {
          'PLATINUM': [],
          'GOLD': [],
          'SILVER': [],
          'BRONZE': [],
          'PROBATION': []
        };

        allMetrics.forEach((m: VendorPerformanceMetrics) => {
          if (tierGroups[m.tier]) {
            tierGroups[m.tier].push(m);
          }
        });

        // Calculate tier statistics
        const tierAnalysis = Object.entries(tierGroups).map(([tier, vendors]) => ({
          tier,
          count: vendors.length,
          percentage: (vendors.length / allMetrics.length) * 100,
          averageScore: calculateAverage(vendors, 'overallScore'),
          averageQuality: calculateAverage(vendors, 'qualityScore'),
          averageSpeed: calculateAverage(vendors, 'avgTurnaroundTime'),
          totalOrders: vendors.reduce((sum, v) => sum + v.totalOrdersCompleted, 0)
        }));

        res.json({
          success: true,
          data: {
            tierAnalysis,
            totalVendors: allMetrics.length,
            summary: {
              highPerformers: tierGroups['PLATINUM'].length + tierGroups['GOLD'].length,
              needsImprovement: tierGroups['PROBATION'].length,
              averageOverallScore: calculateAverage(allMetrics, 'overallScore')
            }
          }
        });

      } catch (error) {
        logger.error('Failed to get tier analysis', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve tier analysis'
        });
      }
    }
  );

  return router;
};

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Get historical performance data for vendor
 */
async function getHistoricalPerformance(
  vendorId: string,
  tenantId: string,
  months: number
): Promise<Array<{ date: Date; metrics: any }>> {
  try {
    // TODO: In production, query time-series metrics from dedicated container
    // For now, return mock historical data
    
    const historicalData: Array<{ date: Date; metrics: any }> = [];
    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(currentDate);
      date.setMonth(date.getMonth() - i);

      // Get metrics snapshot for that month
      // In production, this would query actual historical records
      const metrics = await performanceService.calculateVendorMetrics(vendorId, tenantId);

      historicalData.push({
        date,
        metrics
      });
    }

    return historicalData;

  } catch (error) {
    logger.error('Failed to get historical performance', { error });
    return [];
  }
}

/**
 * Calculate performance trends
 */
function calculateTrends(historicalData: Array<{ date: Date; metrics: any }>): any {
  if (historicalData.length < 2) {
    return {
      quality: { direction: 'stable', change: 0 },
      speed: { direction: 'stable', change: 0 },
      reliability: { direction: 'stable', change: 0 },
      overall: { direction: 'stable', change: 0 }
    };
  }

  if (!historicalData || historicalData.length === 0) {
    return {
      quality: 'stable',
      speed: 'stable',
      reliability: 'stable',
      overall: 'stable'
    };
  }

  const first = historicalData[0];
  const last = historicalData[historicalData.length - 1];

  if (!first || !last) {
    return {
      quality: 'stable',
      speed: 'stable',
      reliability: 'stable',
      overall: 'stable'
    };
  }

  return {
    quality: {
      direction: last.metrics.qualityScore > first.metrics.qualityScore ? 'improving' : 
                last.metrics.qualityScore < first.metrics.qualityScore ? 'declining' : 'stable',
      change: last.metrics.qualityScore - first.metrics.qualityScore,
      current: last.metrics.qualityScore,
      previous: first.metrics.qualityScore
    },
    speed: {
      direction: last.metrics.avgTurnaroundTime < first.metrics.avgTurnaroundTime ? 'improving' : 
                last.metrics.avgTurnaroundTime > first.metrics.avgTurnaroundTime ? 'declining' : 'stable',
      change: first.metrics.avgTurnaroundTime - last.metrics.avgTurnaroundTime, // Lower is better
      current: last.metrics.avgTurnaroundTime,
      previous: first.metrics.avgTurnaroundTime
    },
    reliability: {
      direction: last.metrics.onTimeDeliveryRate > first.metrics.onTimeDeliveryRate ? 'improving' : 
                last.metrics.onTimeDeliveryRate < first.metrics.onTimeDeliveryRate ? 'declining' : 'stable',
      change: last.metrics.onTimeDeliveryRate - first.metrics.onTimeDeliveryRate,
      current: last.metrics.onTimeDeliveryRate,
      previous: first.metrics.onTimeDeliveryRate
    },
    overall: {
      direction: last.metrics.overallScore > first.metrics.overallScore ? 'improving' : 
                last.metrics.overallScore < first.metrics.overallScore ? 'declining' : 'stable',
      change: last.metrics.overallScore - first.metrics.overallScore,
      current: last.metrics.overallScore,
      previous: first.metrics.overallScore
    }
  };
}

/**
 * Calculate average of a metric across vendors
 */
function calculateAverage(vendors: any[], metric: string): number {
  if (vendors.length === 0) return 0;
  const sum = vendors.reduce((acc, v) => acc + (v[metric] || 0), 0);
  return sum / vendors.length;
}

/**
 * Calculate percentile rank
 */
function calculatePercentile(value: number, dataset: number[], lowerIsBetter: boolean = false): number {
  if (dataset.length === 0) return 50;
  
  const sorted = [...dataset].sort((a, b) => a - b);
  let lessThan = 0;

  for (const v of sorted) {
    if (lowerIsBetter) {
      if (v > value) lessThan++;
    } else {
      if (v < value) lessThan++;
    }
  }

  return (lessThan / sorted.length) * 100;
}

/**
 * Calculate tier distribution
 */
function calculateTierDistribution(metrics: VendorPerformanceMetrics[]): Record<VendorTier, number> {
  const distribution: Record<VendorTier, number> = {
    'PLATINUM': 0,
    'GOLD': 0,
    'SILVER': 0,
    'BRONZE': 0,
    'PROBATION': 0
  };

  metrics.forEach((m: VendorPerformanceMetrics) => {
    if (distribution[m.tier] !== undefined) {
      distribution[m.tier]++;
    }
  });

  return distribution;
}
