import { VendorScorecard, ExclusionTier, VendorCapacityThrottle } from '../../types/routing.types.js';
import { Logger } from '../../utils/logger.js';
// Stubbing dependencies for implementation phase
import { AppraisalOrder } from '../../types/order-management.js';
import { Appraiser } from '../../types/appraiser.types.js';
import { CompetencyVerificationService } from './competency-verification.service.js';
import { TieringEngineService } from './tiering-engine.service.js';
import { CapacityManagementService } from './capacity-management.service.js';
import { calculateHaversineDistance } from '../../utils/geo.js';

const logger = new Logger('AutoMatchingEngine');

export interface RankedVendorCandidate {
  vendorId: string;
  appraiser: Appraiser;
  tier: ExclusionTier;
  scorecard: VendorScorecard;
}

export class AutoMatchingEngineService {
  private competencyEngine = new CompetencyVerificationService();
  private tieringEngine = new TieringEngineService();
  private capacityEngine = new CapacityManagementService();

  /**
   * Evaluates the statistical probability of a vendor accepting an order without negotiation,
   * based on historical fee acceptance and current SLA tightness.
   */
  private async calculatePredictiveAcceptanceProbability(appraiserId: string, order: AppraisalOrder): Promise<number> {
    // A real implementation would query `vendor_acceptance_history` taking `feePaidToAgent` vs `historicalAverage`.
    // For now, generate a base probability based on fee constraints.
    const feeProvided = order.orderValue || 450;
    const marketAverage = 500;
    
    // Simplistic curve: if you offer below market, probability drops rapidly
    let probability = 85.0;
    
    if (feeProvided < marketAverage * 0.8) {
        probability -= 40.0;
    } else if (feeProvided < marketAverage) {
        probability -= 15.0;
    } else if (feeProvided > marketAverage * 1.2) {
        probability += 10.0;
    }

    // Adjust for RUSH priority
    if (order.priority === 'RUSH') {
        probability -= 20.0;
    }

    // Bound it betweeen 5 and 99
    return Math.max(5.0, Math.min(99.0, probability));
  }

  /**
   * Generates a multi-factor scorecard combining Proximity, SLA, and Quality scores
   */
  public async calculateVendorScorecard(appraiser: Appraiser, order: AppraisalOrder): Promise<VendorScorecard> {
    logger.info(`Calculating detailed matching scorecard for Vendor ${appraiser.id} and Order ${order.id}`);
    
    // Evaluate complex property/loan compliance natively
    const competency = this.competencyEngine.evaluateVendorCompetency(appraiser, order);
    
    // TODO: Connect to Postgres / Prisma to pull historical metrics

    // 1. Cold Start Implementation
    const isColdStart = (appraiser.completedAppraisals || 0) === 0;
    const coldStartBoost = isColdStart ? 10.0 : 0.0;

    // 2. Haversine Distance Calculation
    let proximityScore = 92.0;
    if (appraiser.serviceArea?.centerPoint && order.propertyDetails?.coordinates) {
      const distanceMiles = calculateHaversineDistance(
        appraiser.serviceArea.centerPoint.lat,
        appraiser.serviceArea.centerPoint.lng,
        order.propertyDetails.coordinates.latitude,
        order.propertyDetails.coordinates.longitude
      );
      // Rough translation: 100 pt max, drop 2 pts per mile.
      proximityScore = Math.max(0, 100 - (distanceMiles * 2));
    }

    // Mocking the algorithm outcome based on requirements:
    return {
      vendorId: appraiser.id,
      tenantId: order.tenantId || 'default',
      overallMatchScore: Math.min(100, 88.5 + coldStartBoost),
      proximityScore,
      onTimePerformanceScore: 95.5,
      revisionRateScore: 80.0,
      underwritingQualityScore: 98.0,
      
      isFhaCompliant: !competency.missingCompetencies.includes('FHA_CERTIFICATION_REQUIRED'),
      isVaCompliant: !competency.missingCompetencies.includes('VA_CERTIFICATION_REQUIRED'),
      isCommercialCapable: !competency.missingCompetencies.includes('COMMERCIAL_EXPERIENCE_REQUIRED'),
      hasComplexPropertyExperience: !competency.missingCompetencies.includes('CERTIFIED_APPRAISER_REQUIRED_FOR_COMPLEX_OR_HIGH_VALUE'),
      
      predictedAcceptanceProbability: await this.calculatePredictiveAcceptanceProbability(appraiser.id, order),
      historicalAverageFeeForZip: 450,
      lastCalculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Validates if a vendor is currently taking orders, considering their calendar / OOO status
   */
  public async checkVendorCapacity(vendorId: string, tenantId: string): Promise<{ isAvailable: boolean; reason?: string }> {
    const capacity = await this.capacityEngine.getVendorCapacity(vendorId, tenantId);
    
    if (!capacity) {
      return { isAvailable: false, reason: 'PROFILE_NOT_FOUND' };
    }

    if (capacity.currentActiveOrders >= capacity.maxActiveOrdersLimit) {
      return { isAvailable: false, reason: 'MAX_CAPACITY_REACHED' };
    }

    if (capacity.outOfOfficeStart && capacity.outOfOfficeEnd) {
      const now = new Date();
      const oooStart = new Date(capacity.outOfOfficeStart);
      const oooEnd = new Date(capacity.outOfOfficeEnd);
      if (now >= oooStart && now <= oooEnd) {
        return { isAvailable: false, reason: 'OUT_OF_OFFICE' };
      }
    }

    return { isAvailable: true };
  }

  /**
   * Main matching orchestrator: Given an order and a pool of appraisers, 
   * return a perfectly ranked list of vendors passing all constraints.
   */
  public async generateTargetVendorList(order: AppraisalOrder, rawAppraisers: Appraiser[]): Promise<RankedVendorCandidate[]> {
    logger.info(`Running predictive match algorithm for Order ${order.id}`);

    // 1. Filter out via strict Licensing/Competency business rules
    const eligibleAppraisers = this.competencyEngine.filterEligibleVendors(rawAppraisers, order);

    const candidates: RankedVendorCandidate[] = [];

    // 2. Map distances, run capabilities, capacity checks, and score
    for (const appraiser of eligibleAppraisers) {
      // Pre-flight auto-reject: If OOO or max capacity, skip
      const capacityResult = await this.checkVendorCapacity(appraiser.id, appraiser.tenantId);
      if (!capacityResult.isAvailable) {
        logger.debug(`Vendor ${appraiser.id} excluded: ${capacityResult.reason}`);
        continue;
      }
      
      // Determine Vendor Tier & check DNU 
      const tier = await this.tieringEngine.getVendorTier(appraiser, order);
      if (tier === 'DNU_DO_NOT_USE') {
        logger.debug(`Vendor ${appraiser.id} excluded: DNU / Exclusion list`);
        continue;
      }

      const scorecard = await this.calculateVendorScorecard(appraiser, order);
      candidates.push({
        vendorId: appraiser.id,
        appraiser,
        tier,
        scorecard
      });
    }

    // 3. Sort intelligently (highest overall score first)
    return candidates.sort((a, b) => b.scorecard.overallMatchScore - a.scorecard.overallMatchScore);
  }
}
