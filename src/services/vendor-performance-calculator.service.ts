/**
 * Vendor Performance Calculator Service
 * Calculates vendor performance metrics and scoring
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { 
  VendorPerformanceMetrics, 
  VendorTier,
  GeographicArea 
} from '../types/vendor-marketplace.types.js';
import { AppraisalOrder, OrderStatus } from '../types';

export class VendorPerformanceCalculatorService {
  private logger: Logger;
  private dbService: CosmosDbService;

  // Scoring weights (must sum to 1.0)
  private readonly WEIGHTS = {
    quality: 0.40,
    speed: 0.30,
    reliability: 0.20,
    communication: 0.10
  };

  // Tier thresholds
  private readonly TIER_THRESHOLDS = {
    PLATINUM: 90,
    GOLD: 80,
    SILVER: 70,
    BRONZE: 60,
    PROBATION: 0
  };

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Calculate comprehensive performance metrics for a vendor
   */
  async calculateVendorMetrics(
    vendorId: string,
    tenantId: string
  ): Promise<VendorPerformanceMetrics> {
    this.logger.info('Calculating vendor performance metrics', { vendorId, tenantId });

    try {
      // Fetch all completed orders for this vendor
      const orders = await this.getVendorOrders(vendorId, tenantId);

      if (orders.length === 0) {
        return this.getDefaultMetrics(vendorId, tenantId);
      }

      // Calculate individual metric categories
      const qualityMetrics = this.calculateQualityMetrics(orders);
      const speedMetrics = this.calculateSpeedMetrics(orders);
      const reliabilityMetrics = this.calculateReliabilityMetrics(orders);
      const communicationMetrics = this.calculateCommunicationMetrics(orders);
      const volumeMetrics = this.calculateVolumeMetrics(orders);
      const financialMetrics = this.calculateFinancialMetrics(orders);

      // Calculate overall weighted score
      const overallScore = this.calculateOverallScore({
        quality: qualityMetrics.qualityScore,
        speed: speedMetrics.avgTurnaroundTime,
        reliability: reliabilityMetrics.completionRate,
        communication: communicationMetrics.communicationScore
      });

      // Determine tier
      const tier = this.calculateTier(overallScore);

      // Get certifications and coverage areas
      const vendor = await this.getVendorProfile(vendorId, tenantId);

      const metrics: VendorPerformanceMetrics = {
        id: `metrics-${vendorId}-${Date.now()}`,
        vendorId,
        tenantId,
        
        // Quality
        qualityScore: qualityMetrics.qualityScore,
        revisionRate: qualityMetrics.revisionRate,
        complianceScore: qualityMetrics.complianceScore,
        accuracyScore: qualityMetrics.accuracyScore,
        
        // Speed
        avgTurnaroundTime: speedMetrics.avgTurnaroundTime,
        onTimeDeliveryRate: speedMetrics.onTimeDeliveryRate,
        acceptanceSpeed: speedMetrics.acceptanceSpeed,
        
        // Reliability
        completionRate: reliabilityMetrics.completionRate,
        cancellationRate: reliabilityMetrics.cancellationRate,
        communicationScore: communicationMetrics.communicationScore,
        
        // Volume
        totalOrdersCompleted: volumeMetrics.totalCompleted,
        ordersInProgress: volumeMetrics.inProgress,
        ordersLast30Days: volumeMetrics.last30Days,
        ordersLast90Days: volumeMetrics.last90Days,
        
        // Certifications
        certifications: (vendor as any).certifications || [],
        coverageAreas: (vendor as any).coverageAreas || [],
        propertyTypes: (vendor as any).propertyTypes || [],
        
        // Financial
        avgFeeQuoted: financialMetrics.avgFee,
        feeAcceptanceRate: financialMetrics.acceptanceRate,
        
        // Calculated
        overallScore,
        tier,
        
        // Metadata
        lastUpdated: new Date(),
        calculatedAt: new Date(),
        dataPointsCount: orders.length
      };

      // Save to database
      await this.saveMetrics(metrics);

      this.logger.info('Vendor metrics calculated successfully', { 
        vendorId, 
        overallScore, 
        tier 
      });

      return metrics;

    } catch (error) {
      this.logger.error('Failed to calculate vendor metrics', { error, vendorId });
      throw error;
    }
  }

  /**
   * Calculate quality metrics
   */
  private calculateQualityMetrics(orders: AppraisalOrder[]) {
    const completedOrders = orders.filter(o => 
      o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED
    );
    
    // Revision rate
    const ordersWithRevisions = completedOrders.filter(o => 
      (o as any).revisionCount > 0
    ).length;
    const revisionRate = (ordersWithRevisions / completedOrders.length) * 100;

    // Compliance score (based on review flags)
    const compliantOrders = completedOrders.filter(o => 
      !(o as any).complianceIssues || (o as any).complianceIssues.length === 0
    ).length;
    const complianceScore = (compliantOrders / completedOrders.length) * 100;

    // Accuracy score (placeholder - would compare to final values)
    const accuracyScore = 95; // TODO: Implement actual accuracy calculation

    // Overall quality score (lower revision rate = higher quality)
    const qualityScore = (
      (100 - revisionRate) * 0.4 +
      complianceScore * 0.4 +
      accuracyScore * 0.2
    );

    return {
      qualityScore: Math.round(qualityScore),
      revisionRate: Math.round(revisionRate * 10) / 10,
      complianceScore: Math.round(complianceScore),
      accuracyScore: Math.round(accuracyScore)
    };
  }

  /**
   * Calculate speed metrics
   */
  private calculateSpeedMetrics(orders: AppraisalOrder[]) {
    const completedOrders = orders.filter(o => 
      o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED
    );

    // Average turnaround time
    const turnaroundTimes = completedOrders.map(o => {
      const start = new Date((o as any).assignedAt || o.createdAt).getTime();
      const end = new Date((o as any).completedAt || o.updatedAt).getTime();
      return (end - start) / (1000 * 60 * 60); // hours
    });
    const avgTurnaroundTime = turnaroundTimes.length > 0
      ? turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length
      : 0;

    // On-time delivery rate
    const onTimeOrders = completedOrders.filter(o => {
      const completedAt = new Date((o as any).completedAt || o.updatedAt);
      const dueDate = new Date((o as any).dueDate);
      return completedAt <= dueDate;
    }).length;
    const onTimeDeliveryRate = (onTimeOrders / completedOrders.length) * 100;

    // Acceptance speed (time from assignment to acceptance)
    const acceptanceTimes = orders.map(o => {
      if (!(o as any).acceptedAt) return 0;
      const assigned = new Date((o as any).assignedAt || o.createdAt).getTime();
      const accepted = new Date((o as any).acceptedAt).getTime();
      return (accepted - assigned) / (1000 * 60 * 60); // hours
    }).filter(t => t > 0);
    const acceptanceSpeed = acceptanceTimes.length > 0
      ? acceptanceTimes.reduce((a, b) => a + b, 0) / acceptanceTimes.length
      : 0;

    return {
      avgTurnaroundTime: Math.round(avgTurnaroundTime * 10) / 10,
      onTimeDeliveryRate: Math.round(onTimeDeliveryRate),
      acceptanceSpeed: Math.round(acceptanceSpeed * 10) / 10
    };
  }

  /**
   * Calculate reliability metrics
   */
  private calculateReliabilityMetrics(orders: AppraisalOrder[]) {
    const acceptedOrders = orders.filter(o => 
      (o as any).acceptedAt !== undefined
    );

    // Completion rate
    const completedOrders = acceptedOrders.filter(o => 
      o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED
    ).length;
    const completionRate = acceptedOrders.length > 0
      ? (completedOrders / acceptedOrders.length) * 100
      : 0;

    // Cancellation rate
    const cancelledOrders = acceptedOrders.filter(o => 
      o.status === OrderStatus.CANCELLED && (o as any).cancelledBy === 'VENDOR'
    ).length;
    const cancellationRate = acceptedOrders.length > 0
      ? (cancelledOrders / acceptedOrders.length) * 100
      : 0;

    return {
      completionRate: Math.round(completionRate),
      cancellationRate: Math.round(cancellationRate * 10) / 10
    };
  }

  /**
   * Calculate communication metrics
   */
  private calculateCommunicationMetrics(orders: AppraisalOrder[]) {
    // Placeholder - would analyze message response times
    // For now, use a derived score based on other metrics
    const communicationScore = 85;

    return {
      communicationScore
    };
  }

  /**
   * Calculate volume metrics
   */
  private calculateVolumeMetrics(orders: AppraisalOrder[]) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    return {
      totalCompleted: orders.filter(o => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED).length,
      inProgress: orders.filter(o => o.status === OrderStatus.IN_PROGRESS || o.status === OrderStatus.ASSIGNED).length,
      last30Days: orders.filter(o => 
        new Date(o.createdAt) >= thirtyDaysAgo
      ).length,
      last90Days: orders.filter(o => 
        new Date(o.createdAt) >= ninetyDaysAgo
      ).length
    };
  }

  /**
   * Calculate financial metrics
   */
  private calculateFinancialMetrics(orders: AppraisalOrder[]) {
    const ordersWithFees = orders.filter(o => (o as any).vendorFee > 0);

    const avgFee = ordersWithFees.length > 0
      ? ordersWithFees.reduce((sum, o) => sum + ((o as any).vendorFee || 0), 0) / ordersWithFees.length
      : 0;

    // Fee acceptance rate (orders where initial fee was accepted)
    const acceptedAtInitialFee = ordersWithFees.filter(o => 
      !(o as any).feeNegotiated
    ).length;
    const acceptanceRate = ordersWithFees.length > 0
      ? (acceptedAtInitialFee / ordersWithFees.length) * 100
      : 0;

    return {
      avgFee: Math.round(avgFee),
      acceptanceRate: Math.round(acceptanceRate)
    };
  }

  /**
   * Calculate weighted overall score
   */
  private calculateOverallScore(metrics: {
    quality: number;
    speed: number;
    reliability: number;
    communication: number;
  }): number {
    // Normalize speed metric (lower is better, so invert)
    const normalizedSpeed = Math.max(0, 100 - (metrics.speed / 10)); // Assuming 1000hrs is 0 score

    const overallScore = (
      metrics.quality * this.WEIGHTS.quality +
      normalizedSpeed * this.WEIGHTS.speed +
      metrics.reliability * this.WEIGHTS.reliability +
      metrics.communication * this.WEIGHTS.communication
    );

    return Math.round(overallScore);
  }

  /**
   * Determine vendor tier based on score
   */
  private calculateTier(score: number): VendorTier {
    if (score >= this.TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
    if (score >= this.TIER_THRESHOLDS.GOLD) return 'GOLD';
    if (score >= this.TIER_THRESHOLDS.SILVER) return 'SILVER';
    if (score >= this.TIER_THRESHOLDS.BRONZE) return 'BRONZE';
    return 'PROBATION';
  }

  /**
   * Get vendor orders from database
   */
  private async getVendorOrders(
    vendorId: string,
    tenantId: string
  ): Promise<AppraisalOrder[]> {
    const query = `
      SELECT * FROM c 
      WHERE c.tenantId = @tenantId 
      AND c.vendorId = @vendorId
      AND c.type = 'order'
      ORDER BY c.createdAt DESC
    `;

    const result = await this.dbService.queryItems(
      'orders',
      query,
      [
        { name: '@tenantId', value: tenantId },
        { name: '@vendorId', value: vendorId }
      ]
    ) as any;

    return (result.resources || []) as AppraisalOrder[];
  }

  /**
   * Get vendor profile
   */
  private async getVendorProfile(vendorId: string, tenantId: string) {
    const vendor = await this.dbService.getItem('vendors', vendorId, tenantId);
    return vendor || {};
  }

  /**
   * Save metrics to database
   */
  private async saveMetrics(metrics: VendorPerformanceMetrics): Promise<void> {
    await this.dbService.createItem('vendor-performance-metrics', {
      ...metrics,
      type: 'vendor-performance-metrics'
    });
  }

  /**
   * Get default metrics for new vendors
   */
  private getDefaultMetrics(vendorId: string, tenantId: string): VendorPerformanceMetrics {
    return {
      id: `metrics-${vendorId}-${Date.now()}`,
      vendorId,
      tenantId,
      qualityScore: 0,
      revisionRate: 0,
      complianceScore: 0,
      accuracyScore: 0,
      avgTurnaroundTime: 0,
      onTimeDeliveryRate: 0,
      acceptanceSpeed: 0,
      completionRate: 0,
      cancellationRate: 0,
      communicationScore: 0,
      totalOrdersCompleted: 0,
      ordersInProgress: 0,
      ordersLast30Days: 0,
      ordersLast90Days: 0,
      certifications: [],
      coverageAreas: [],
      propertyTypes: [],
      avgFeeQuoted: 0,
      feeAcceptanceRate: 0,
      overallScore: 0,
      tier: 'PROBATION',
      lastUpdated: new Date(),
      calculatedAt: new Date(),
      dataPointsCount: 0
    };
  }

  /**
   * Batch calculate metrics for all vendors (nightly job)
   */
  async batchCalculateAllVendorMetrics(tenantId: string): Promise<void> {
    this.logger.info('Starting batch vendor metrics calculation', { tenantId });

    try {
      // Get all vendors
      const vendors = await this.getAllVendors(tenantId);
      
      this.logger.info(`Calculating metrics for ${vendors.length} vendors`);

      // Calculate metrics for each vendor
      const results = await Promise.allSettled(
        vendors.map(vendor => 
          this.calculateVendorMetrics(vendor.id, tenantId)
        )
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.logger.info('Batch calculation complete', { 
        total: vendors.length,
        successful,
        failed 
      });

    } catch (error) {
      this.logger.error('Batch calculation failed', { error, tenantId });
      throw error;
    }
  }

  /**
   * Get all vendors for a tenant
   */
  private async getAllVendors(tenantId: string) {
    const query = `
      SELECT c.id FROM c 
      WHERE c.tenantId = @tenantId 
      AND c.type = 'vendor'
    `;

    const result = await this.dbService.queryItems(
      'vendors',
      query,
      [{ name: '@tenantId', value: tenantId }]
    ) as any;

    return (result.resources || []) as { id: string }[];
  }
}
