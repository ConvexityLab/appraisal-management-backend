/**
 * Vendor Performance Calculator Service
 * Calculates vendor performance metrics and scoring
 */

import type { VendorOrder as Order } from "../types/vendor-order.types.js";
import type { VendorOrderScorecardEntry } from '../types/vendor-order.types.js';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { ScorecardRollupProfileService } from './scorecard-rollup-profile.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import {
  VendorPerformanceMetrics,
  VendorTier,
  GeographicArea
} from '../types/vendor-marketplace.types.js';
import { OrderStatus } from '../types';

/**
 * Per Doug's meeting note: rate vendors on a TRAILING window of recent
 * deliveries rather than all-time. 25 is the agreed default. NOW SUPERSEDED
 * by ScorecardRollupProfile.window.size when a profile is in force; kept as
 * the unprofiled-tenant fallback so behaviour is unchanged for clients that
 * haven't authored a profile yet.
 */
const SCORECARD_WINDOW_SIZE = 25;

/**
 * Scorecard contribution to the blended overallScore (0..1). 0.5 = 50/50.
 * Also superseded by ScorecardRollupProfile.derivedSignalBlendWeight when
 * resolved at compute time.
 */
const SCORECARD_BLEND_WEIGHT = 0.5;

export class VendorPerformanceCalculatorService {
  private logger: Logger;
  private dbService: CosmosDbService;
  /**
   * Rollup-profile service. calculateVendorMetrics resolves the active
   * per-tenant profile through this and uses its category weights, window,
   * blend ratio, gates, penalties, and tier thresholds. Default-constructed
   * so every call site picks up David's algorithm automatically; tests can
   * substitute via setRollupProfileService.
   *
   * For unprofiled tenants the resolver returns DEFAULT_BASE_PROFILE — the
   * legacy hard-coded constants (SCORECARD_WINDOW_SIZE / SCORECARD_BLEND_WEIGHT
   * / TIER_THRESHOLDS) are retained below only as a paranoia fallback for the
   * narrow case where resolve itself throws.
   */
  private rollupProfileService: ScorecardRollupProfileService;

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
    this.rollupProfileService = new ScorecardRollupProfileService(
      this.dbService,
      new AuditTrailService(this.dbService),
    );
  }

  /**
   * Override the rollup profile service — used by tests to substitute a stub.
   * Production code should rely on the default-constructed instance.
   */
  public setRollupProfileService(svc: ScorecardRollupProfileService): void {
    this.rollupProfileService = svc;
  }

  /**
   * Calculate comprehensive performance metrics for a vendor
   */
  async calculateVendorMetrics(
    vendorId: string,
    tenantId: string,
    /**
     * Optional resolution context — when the calculator is invoked for a
     * specific order (or product/client), pass these so the rollup-profile
     * resolver can pick the right overlay. Without them the resolver returns
     * the BASE profile (tenant-wide default).
     */
    profileInput?: { clientId?: string; productType?: string; phase?: 'ORIGINAL' | 'REVIEW' },
  ): Promise<VendorPerformanceMetrics> {
    this.logger.info('Calculating vendor performance metrics', { vendorId, tenantId });

    try {
      // Resolve David's rollup profile. resolveProfile always returns at
      // least the in-memory DEFAULT_BASE_PROFILE — undefined only when the
      // resolve call itself throws (Cosmos outage etc.), in which case we
      // fall back to the legacy hard-coded constants further down.
      const profile = await this.rollupProfileService
        .resolveProfile({
          tenantId,
          ...(profileInput?.clientId ? { clientId: profileInput.clientId } : {}),
          ...(profileInput?.productType ? { productType: profileInput.productType } : {}),
          ...(profileInput?.phase ? { phase: profileInput.phase } : {}),
        })
        .catch((err) => {
          this.logger.warn('Rollup profile resolve failed; using defaults', {
            vendorId,
            error: err instanceof Error ? err.message : String(err),
          });
          return undefined;
        });

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

      // Calculate overall weighted score from derived signals
      const derivedOverallScore = this.calculateOverallScore({
        quality: qualityMetrics.qualityScore,
        speed: speedMetrics.avgTurnaroundTime,
        reliability: reliabilityMetrics.completionRate,
        communication: communicationMetrics.communicationScore
      });

      // Scorecard blend — uses the profile's category weights + window size
      // when a profile is in force; falls back to equal-weight + 25-window
      // when not. Returns null when no scorecards exist yet.
      const scorecardBlend = this.computeScorecardBlend(orders, profile);
      const blendWeight = profile?.derivedSignalBlendWeight ?? SCORECARD_BLEND_WEIGHT;
      let overallScore = scorecardBlend
        ? Math.round(
            derivedOverallScore * (1 - blendWeight) +
              scorecardBlend.overallOnHundredScale * blendWeight,
          )
        : derivedOverallScore;

      // Apply penalties from the profile (revisions, late deliveries, reassignments).
      // Each penalty shaves perUnit × signal-count, capped at penalty.cap.
      if (profile?.penalties && profile.penalties.length > 0 && scorecardBlend) {
        for (const penalty of profile.penalties) {
          const signalValue = this.measurePenaltySignal(penalty.signal, orders);
          const deduction = penalty.cap !== undefined
            ? Math.min(penalty.perUnit * signalValue, penalty.cap)
            : penalty.perUnit * signalValue;
          overallScore = Math.max(0, overallScore - deduction);
        }
      }

      // Determine tier via the profile's thresholds (falls back to hard-coded
      // defaults). Gates evaluated separately — they can CLAMP the tier down
      // if a critical category score is too low.
      let tier = this.calculateTier(overallScore, profile?.tierThresholds);
      if (profile?.gates && profile.gates.length > 0 && scorecardBlend) {
        tier = this.applyGates(tier, profile.gates, scorecardBlend.categoryAverages);
      }

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
  private calculateQualityMetrics(orders: Order[]) {
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

    // Accuracy score — computed from QC review AVM/appraisal variance
    const accuracyScore = this.calculateAccuracyScore(completedOrders);

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
  private calculateSpeedMetrics(orders: Order[]) {
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
  private calculateReliabilityMetrics(orders: Order[]) {
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
   * Calculate communication metrics from real response-time data.
   */
  private calculateCommunicationMetrics(orders: Order[]) {
    // Measure average response time to status-change requests
    const responseTimes = orders
      .filter(o => (o as any).lastResponseTimeHours !== undefined)
      .map(o => (o as any).lastResponseTimeHours as number);

    // Measure borrower-contact attempt compliance (inspection scheduling)
    const inspectionOrders = orders.filter(o => (o as any).inspectionContactAttempts !== undefined);
    const contactCompliance = inspectionOrders.length > 0
      ? inspectionOrders.filter(o => ((o as any).inspectionContactAttempts ?? 0) >= 1).length / inspectionOrders.length
      : 1; // No inspection orders → no penalty

    // If we have real response-time data, score it (target: < 4 hours)
    let responseScore = 85; // default when no data
    if (responseTimes.length > 0) {
      const avgResponseHours = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      // 0 hrs → 100, 4 hrs → 80, 8+ hrs → 60
      responseScore = Math.max(60, Math.min(100, 100 - (avgResponseHours * 5)));
    }

    const communicationScore = Math.round(responseScore * 0.6 + contactCompliance * 100 * 0.4);

    return {
      communicationScore: Math.min(100, Math.max(0, communicationScore))
    };
  }

  /**
   * Calculate volume metrics
   */
  private calculateVolumeMetrics(orders: Order[]) {
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
  private calculateFinancialMetrics(orders: Order[]) {
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
   * Determine vendor tier based on score. Accepts an optional override from
   * the resolved rollup profile; falls back to the hard-coded defaults for
   * unprofiled tenants.
   */
  private calculateTier(
    score: number,
    overrideThresholds?: { PLATINUM: number; GOLD: number; SILVER: number; BRONZE: number },
  ): VendorTier {
    const t = overrideThresholds ?? this.TIER_THRESHOLDS;
    if (score >= t.PLATINUM) return 'PLATINUM';
    if (score >= t.GOLD) return 'GOLD';
    if (score >= t.SILVER) return 'SILVER';
    if (score >= t.BRONZE) return 'BRONZE';
    return 'PROBATION';
  }

  /**
   * Apply HARD-GATE constraints from the resolved profile. Each gate says
   * "if the vendor's avg in category X is below minScore, clamp their tier
   * to at most clampToTier." Used for things like "fail PLATINUM if Quality
   * < 4" — prevents a vendor with one good aspect from masking a critical
   * weakness.
   */
  private applyGates(
    currentTier: VendorTier,
    gates: Array<{
      type: 'min_in_category';
      category: import('../types/vendor-marketplace.types.js').ScorecardCategoryKey;
      minScore: number;
      clampToTier: VendorTier;
    }>,
    categoryAverages: Record<string, number | null>,
  ): VendorTier {
    const tierOrder: Record<VendorTier, number> = {
      PROBATION: 0,
      BRONZE: 1,
      SILVER: 2,
      GOLD: 3,
      PLATINUM: 4,
    };
    let resolved = currentTier;
    for (const gate of gates) {
      if (gate.type !== 'min_in_category') continue;
      const avg = categoryAverages[gate.category];
      if (typeof avg !== 'number') continue; // no signal yet — skip
      if (avg < gate.minScore) {
        // Clamp DOWN only, never up.
        if (tierOrder[gate.clampToTier] < tierOrder[resolved]) {
          resolved = gate.clampToTier;
        }
      }
    }
    return resolved;
  }

  /**
   * Measure a single penalty signal across the order list. Returns the
   * count or magnitude the penalty should multiply against.
   */
  private measurePenaltySignal(
    signal: 'revision_count' | 'late_delivery_days' | 'reassignment_count',
    orders: Order[],
  ): number {
    if (signal === 'revision_count') {
      return orders.reduce(
        (sum, o) => sum + ((o as { revisionCount?: number }).revisionCount ?? 0),
        0,
      );
    }
    if (signal === 'late_delivery_days') {
      let total = 0;
      for (const o of orders) {
        const due = (o as { dueDate?: string | Date }).dueDate;
        const delivered = (o as { deliveredDate?: string | Date }).deliveredDate;
        if (!due || !delivered) continue;
        const dueMs = typeof due === 'string' ? new Date(due).getTime() : due.getTime();
        const delMs =
          typeof delivered === 'string' ? new Date(delivered).getTime() : delivered.getTime();
        const days = (delMs - dueMs) / (1000 * 60 * 60 * 24);
        if (days > 0) total += days;
      }
      return Math.round(total);
    }
    // reassignment_count
    return orders.reduce(
      (sum, o) => sum + ((o as { reassignmentCount?: number }).reassignmentCount ?? 0),
      0,
    );
  }

  /**
   * Get vendor orders from database
   */
  private async getVendorOrders(
    vendorId: string,
    tenantId: string
  ): Promise<Order[]> {
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

    return (result.resources || []) as Order[];
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
   * Calculate accuracy score from QC review data.
   * Uses CU risk score from UCDP submissions + AVM variance when available.
   */
  private calculateAccuracyScore(completedOrders: Order[]): number {
    let totalScore = 0;
    let dataPoints = 0;

    for (const o of completedOrders) {
      const order = o as any;

      // 1. CU risk score from GSE/UCDP submission (0-5 scale, lower = better)
      const cuScore = order.cuRiskScore ?? order.ucdpCuScore ?? order.gseSubmission?.cuRiskScore;
      if (typeof cuScore === 'number' && cuScore >= 0) {
        // Map CU 0-5 → accuracy 100-50: score 0 = 100, score 5 = 50
        const cuAccuracy = Math.max(50, 100 - (cuScore * 10));
        totalScore += cuAccuracy;
        dataPoints++;
      }

      // 2. SSR severity penalty — hard stops significantly lower accuracy
      const ssrHardStops = order.ssrHardStopCount ?? order.gseSubmission?.hardStopCount ?? 0;
      const ssrWarnings = order.ssrWarningCount ?? order.gseSubmission?.warningCount ?? 0;
      if (ssrHardStops > 0 || ssrWarnings > 0) {
        // Each hard stop = -15 from 100, each warning = -5
        const ssrAccuracy = Math.max(40, 100 - (ssrHardStops * 15) - (ssrWarnings * 5));
        totalScore += ssrAccuracy;
        dataPoints++;
      }

      // 3. QC review score from internal review engine
      const qc = order.qcResult || order.qcReview;
      if (qc && typeof qc.score === 'number') {
        totalScore += Math.min(100, Math.max(0, qc.score));
        dataPoints++;
      }

      // 4. AVM/Axiom risk score fallback
      if (typeof order.axiomRiskScore === 'number' && !cuScore) {
        // Low axiom risk score = high accuracy
        const avmAccuracy = Math.max(60, 100 - order.axiomRiskScore);
        totalScore += avmAccuracy;
        dataPoints++;
      }
    }

    if (dataPoints === 0) return 80; // New vendor, no data

    return Math.round(totalScore / dataPoints);
  }

  /**
   * Check if vendor should be auto-suspended based on performance.
   * Triggers when vendor drops to PROBATION tier.
   */
  async checkAutoSuspension(vendorId: string, tenantId: string, metrics: VendorPerformanceMetrics): Promise<{
    shouldSuspend: boolean;
    reason?: string;
  }> {
    if (metrics.tier !== 'PROBATION') {
      return { shouldSuspend: false };
    }

    // Only suspend if vendor has enough data points to judge
    if (metrics.dataPointsCount < 5) {
      return { shouldSuspend: false };
    }

    const reasons: string[] = [];
    if (metrics.revisionRate > 50) reasons.push(`High revision rate: ${metrics.revisionRate}%`);
    if (metrics.onTimeDeliveryRate < 50) reasons.push(`Low on-time delivery: ${metrics.onTimeDeliveryRate}%`);
    if (metrics.completionRate < 60) reasons.push(`Low completion rate: ${metrics.completionRate}%`);
    if (metrics.cancellationRate > 30) reasons.push(`High cancellation rate: ${metrics.cancellationRate}%`);

    if (reasons.length >= 2) {
      this.logger.warn('Auto-suspension triggered for vendor', {
        vendorId,
        tier: metrics.tier,
        overallScore: metrics.overallScore,
        reasons,
      });
      return {
        shouldSuspend: true,
        reason: `Performance dropped to PROBATION tier with ${reasons.length} critical issues: ${reasons.join('; ')}`,
      };
    }

    return { shouldSuspend: false };
  }

  /**
   * Generate a coaching/defect-pattern report for a vendor.
   * Summarizes recurring issues for quarterly scorecard delivery.
   */
  async generateCoachingReport(vendorId: string, tenantId: string): Promise<{
    vendorId: string;
    period: string;
    strengths: string[];
    improvements: string[];
    tier: string;
    overallScore: number;
    recommendations: string[];
  }> {
    const metrics = await this.calculateVendorMetrics(vendorId, tenantId);

    const strengths: string[] = [];
    const improvements: string[] = [];
    const recommendations: string[] = [];

    // Quality
    if (metrics.revisionRate <= 10) strengths.push('Excellent revision rate — rarely needs corrections');
    else if (metrics.revisionRate > 30) improvements.push(`High revision rate (${metrics.revisionRate}%) — review common QC findings`);

    // Speed
    if (metrics.onTimeDeliveryRate >= 95) strengths.push('Outstanding on-time delivery');
    else if (metrics.onTimeDeliveryRate < 80) improvements.push(`On-time delivery at ${metrics.onTimeDeliveryRate}% — target is 95%`);

    // Reliability
    if (metrics.completionRate >= 98) strengths.push('Exceptional completion rate');
    else if (metrics.completionRate < 90) improvements.push(`Completion rate at ${metrics.completionRate}% — investigate declined/cancelled orders`);

    // Compliance
    if (metrics.complianceScore >= 95) strengths.push('Strong compliance track record');
    else if (metrics.complianceScore < 80) improvements.push(`Compliance score at ${metrics.complianceScore}% — review USPAP and AIR requirements`);

    // Recommendations
    if (metrics.tier === 'PLATINUM' || metrics.tier === 'GOLD') {
      recommendations.push('Consider expanding geographic coverage — eligible for priority assignments');
      recommendations.push('Eligible for complex property and high-value order routing');
    }
    if (metrics.tier === 'BRONZE' || metrics.tier === 'PROBATION') {
      recommendations.push('Attend refresher training on common QC findings');
      recommendations.push('Focus on accepting only orders within capacity to improve completion rate');
    }

    return {
      vendorId,
      period: `${new Date().toISOString().slice(0, 7)} Quarterly Report`,
      strengths,
      improvements,
      tier: metrics.tier,
      overallScore: metrics.overallScore,
      recommendations,
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

  /**
   * Blend the human reviewer scorecards into a single 0-100 signal.
   *
   * Honours the resolved rollup profile when provided:
   *   - window.size sets the trailing order count (falls back to 25)
   *   - window.minSampleSize gates whether enough data exists to score
   *   - categoryWeights re-weight the five category averages (falls back to
   *     equal weight = mean of overallScore)
   *   - timeDecay (when enabled) weights each scorecard by
   *     0.5 ^ (age_days / halfLifeDays)
   *
   * Returns `null` when:
   *   - no qualifying scorecards exist, OR
   *   - sampleCount < window.minSampleSize (caller falls back to derived score)
   */
  private computeScorecardBlend(
    orders: Order[],
    profile?: import('../types/vendor-marketplace.types.js').ResolvedScorecardRollupProfile,
  ): {
    overallOnHundredScale: number;
    sampleCount: number;
    categoryAverages: Record<string, number | null>;
  } | null {
    const windowSize = profile?.window.size ?? SCORECARD_WINDOW_SIZE;
    const minSampleSize = profile?.window.minSampleSize ?? 1;

    const completed = orders
      .filter((o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED)
      .sort((a, b) => {
        const aTime = new Date(
          (a as any).completedAt ?? (a as any).deliveredAt ?? a.updatedAt ?? a.createdAt,
        ).getTime();
        const bTime = new Date(
          (b as any).completedAt ?? (b as any).deliveredAt ?? b.updatedAt ?? b.createdAt,
        ).getTime();
        return bTime - aTime; // newest first
      })
      .slice(0, windowSize);

    // Collect each order's active scorecard with its age in days.
    const samples: Array<{ entry: VendorOrderScorecardEntry; ageDays: number }> = [];
    const now = Date.now();
    for (const order of completed) {
      const scorecards = (order.scorecards ?? []) as VendorOrderScorecardEntry[];
      if (scorecards.length === 0) continue;
      let active: VendorOrderScorecardEntry | null = null;
      for (let i = scorecards.length - 1; i >= 0; i--) {
        const entry = scorecards[i];
        if (entry && !entry.supersededBy) {
          active = entry;
          break;
        }
      }
      if (!active) continue;
      const ageMs = now - new Date(active.reviewedAt).getTime();
      samples.push({ entry: active, ageDays: Math.max(0, ageMs / (1000 * 60 * 60 * 24)) });
    }

    if (samples.length < minSampleSize) return null;

    // Per-sample weight = 1 (or time-decayed when enabled).
    const decayEnabled = !!profile?.timeDecay.enabled;
    const halfLifeDays = profile?.timeDecay.halfLifeDays ?? 180;
    const sampleWeight = (ageDays: number): number =>
      decayEnabled ? Math.pow(0.5, ageDays / halfLifeDays) : 1;

    // Per-category weighted means (0-5 scale).
    const cats = ['report', 'quality', 'communication', 'turnTime', 'professionalism'] as const;
    const categoryAverages: Record<string, number | null> = {};
    const perCategory0to5: Record<(typeof cats)[number], number> = {
      report: 0,
      quality: 0,
      communication: 0,
      turnTime: 0,
      professionalism: 0,
    };
    let totalWeight = 0;
    for (const { entry, ageDays } of samples) totalWeight += sampleWeight(ageDays);
    if (totalWeight <= 0) totalWeight = samples.length;

    for (const cat of cats) {
      let sum = 0;
      let n = 0;
      for (const { entry, ageDays } of samples) {
        const v = entry.scores?.[cat]?.value;
        if (typeof v !== 'number') continue;
        const w = sampleWeight(ageDays);
        sum += v * w;
        n += w;
      }
      const avg = n > 0 ? sum / n : null;
      perCategory0to5[cat] = avg ?? 0;
      categoryAverages[cat] = avg;
    }

    // Apply category weights from the resolved profile (or equal weight as fallback).
    const weights = profile?.categoryWeights ?? {
      report: 0.2,
      quality: 0.2,
      communication: 0.2,
      turnTime: 0.2,
      professionalism: 0.2,
    };
    const weighted0to5 =
      perCategory0to5.report * weights.report +
      perCategory0to5.quality * weights.quality +
      perCategory0to5.communication * weights.communication +
      perCategory0to5.turnTime * weights.turnTime +
      perCategory0to5.professionalism * weights.professionalism;

    return {
      overallOnHundredScale: Math.round(weighted0to5 * 20),
      sampleCount: samples.length,
      categoryAverages,
    };
  }
}
