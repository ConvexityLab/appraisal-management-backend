/**
 * QC Comparable Validation Service
 * 
 * Validates comparable properties using multi-provider geographic intelligence
 * Provides comprehensive comparable analysis for quality control processes
 */

import { Logger } from '../utils/logger';
import { GenericCacheService } from './cache/generic-cache.service';
import { MultiProviderPropertyIntelligenceService } from './multi-provider-intelligence.service';
import { CensusIntelligenceService } from './census-intelligence.service';
import { AddressService } from './address.service';
import { CreativePropertyIntelligenceService } from './creative-property-intelligence.service';
import { Coordinates } from '../types/geospatial';
import {
  ComparableValidationReport,
  ComparableAnalysis,
  LocationConsistencyAnalysis,
  AdjustmentValidationResult,
  AppraisalData,
  Comparable,
  SimilarityScore,
  ComparableRiskFlag,
  ValidationStatus,
  RiskLevel,
  RiskSeverity,
  AdjustmentType
} from '../types/qc-validation';
import {
  PropertyIntelligence,
  DemographicIntelligence
} from '../types/property-intelligence';

export class QCComparableValidationService {
  private logger: Logger;
  private cache: GenericCacheService;
  private multiProviderService: MultiProviderPropertyIntelligenceService;
  private censusService: CensusIntelligenceService;
  private addressService: AddressService;
  private creativeService: CreativePropertyIntelligenceService;

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
    this.multiProviderService = new MultiProviderPropertyIntelligenceService();
    this.censusService = new CensusIntelligenceService();
    this.addressService = new AddressService();
    this.creativeService = new CreativePropertyIntelligenceService();
  }

  // ===========================
  // MAIN VALIDATION METHOD
  // ===========================

  /**
   * Comprehensive comparable validation using multi-provider intelligence
   */
  async validateComparables(
    appraisal: AppraisalData,
    propertyId?: string
  ): Promise<ComparableValidationReport> {
    try {
      const startTime = Date.now();
      this.logger.info('Starting QC comparable validation', { 
        appraisalId: appraisal.id, 
        propertyId,
        comparablesCount: appraisal.comparables.length 
      });

      // Validate all comparable addresses first
      const addressValidations = await this.validateComparableAddresses(appraisal.comparables);

      // Analyze each comparable using our property intelligence
      const comparableAnalyses = await this.analyzeComparables(
        appraisal.property, 
        appraisal.comparables,
        propertyId
      );

      // Analyze location consistency
      const locationConsistency = this.analyzeLocationConsistency(
        appraisal.property.coordinates,
        comparableAnalyses
      );

      // Validate adjustments
      const adjustmentValidation = await this.validateAdjustments(
        appraisal.adjustments,
        comparableAnalyses
      );

      // Generate risk flags
      const riskFlags = this.generateComparableRiskFlags(
        comparableAnalyses,
        locationConsistency,
        adjustmentValidation
      );

      // Calculate overall validation score
      const validationScore = this.calculateComparableValidationScore(
        comparableAnalyses,
        locationConsistency,
        adjustmentValidation,
        riskFlags
      );

      // Calculate overall consistency
      const overallConsistency = this.calculateOverallConsistency(
        comparableAnalyses,
        locationConsistency
      );

      const report: ComparableValidationReport = {
        validationScore,
        comparableAnalyses,
        locationConsistency,
        adjustmentValidation,
        riskFlags,
        overallConsistency
      };

      const processingTime = Date.now() - startTime;
      this.logger.info('QC comparable validation completed', {
        appraisalId: appraisal.id,
        validationScore: report.validationScore,
        riskFlagsCount: riskFlags.length,
        processingTime
      });

      return report;

    } catch (error) {
      this.logger.error('QC comparable validation failed', { error, appraisalId: appraisal.id });
      throw new Error('Comparable validation service unavailable');
    }
  }

  // ===========================
  // ADDRESS VALIDATION
  // ===========================

  /**
   * Validate all comparable addresses using multi-provider address services
   */
  private async validateComparableAddresses(
    comparables: Comparable[]
  ): Promise<AddressValidationResult[]> {
    
    return Promise.all(
      comparables.map(async (comparable) => {
        try {
          return await this.addressService.validateAndEnrich(comparable.address);
        } catch (error) {
          this.logger.warn('Address validation failed for comparable', { 
            address: comparable.address,
            error: error.message 
          });
          
          // Return basic validation result if service fails
          return {
            isValid: false,
            standardizedAddress: comparable.address,
            validationScore: 0,
            components: {},
            suggestions: [],
            confidence: 0
          } as AddressValidationResult;
        }
      })
    );
  }

  // ===========================
  // COMPARABLE ANALYSIS
  // ===========================

  /**
   * Analyze each comparable using comprehensive property intelligence
   */
  private async analyzeComparables(
    subjectProperty: AppraisalData['property'],
    comparables: Comparable[],
    propertyId?: string
  ): Promise<ComparableAnalysis[]> {
    
    // Get subject property intelligence for comparison
    const subjectIntelligence = await this.multiProviderService.analyzeWithOptimalProvider(
      subjectProperty.coordinates,
      'quality_first'
    );
    
    const subjectDemographics = await this.censusService.analyzeDemographics(
      subjectProperty.coordinates,
      propertyId
    );

    // Analyze each comparable
    return Promise.all(
      comparables.map(async (comparable) => 
        this.analyzeComparable(comparable, subjectProperty, subjectIntelligence, subjectDemographics)
      )
    );
  }

  /**
   * Analyze individual comparable property
   */
  private async analyzeComparable(
    comparable: Comparable,
    subjectProperty: AppraisalData['property'],
    subjectIntelligence: PropertyIntelligence,
    subjectDemographics: DemographicIntelligence
  ): Promise<ComparableAnalysis> {
    
    try {
      // Get comprehensive intelligence for the comparable
      const [propertyIntelligence, censusData] = await Promise.all([
        this.multiProviderService.analyzeWithOptimalProvider(comparable.coordinates, 'quality_first'),
        this.censusService.analyzeDemographics(comparable.coordinates)
      ]);

      // Calculate similarity to subject
      const similarityToSubject = this.calculateSimilarityScore(
        propertyIntelligence,
        censusData,
        subjectIntelligence,
        subjectDemographics
      );

      // Identify risk factors
      const riskFactors = this.identifyComparableRiskFactors(
        comparable,
        propertyIntelligence,
        censusData,
        similarityToSubject
      );

      return {
        comparable,
        propertyIntelligence,
        censusData,
        similarityToSubject,
        riskFactors
      };

    } catch (error) {
      this.logger.error('Comparable analysis failed', { 
        comparableAddress: comparable.address,
        error: error.message 
      });
      
      // Return minimal analysis if intelligence gathering fails
      return {
        comparable,
        propertyIntelligence: {} as PropertyIntelligence,
        censusData: {} as DemographicIntelligence,
        similarityToSubject: {
          overallSimilarity: 0,
          demographicSimilarity: 0,
          economicSimilarity: 0,
          geographicSimilarity: 0
        },
        riskFactors: ['Intelligence gathering failed - manual review required']
      };
    }
  }

  // ===========================
  // LOCATION CONSISTENCY ANALYSIS
  // ===========================

  /**
   * Analyze geographic consistency of comparables
   */
  private analyzeLocationConsistency(
    subjectCoordinates: Coordinates,
    comparableAnalyses: ComparableAnalysis[]
  ): LocationConsistencyAnalysis {
    
    const distances = comparableAnalyses.map(analysis => 
      analysis.comparable.distanceFromSubject
    );

    const averageDistance = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
    
    const distanceVariance = distances.reduce((sum, distance) => {
      return sum + Math.pow(distance - averageDistance, 2);
    }, 0) / distances.length;

    // Calculate consistency score (0-100)
    let consistencyScore = 100;
    
    // Penalize if average distance is too high
    if (averageDistance > 1.0) consistencyScore -= 20;
    if (averageDistance > 2.0) consistencyScore -= 30;
    
    // Penalize high variance in distances
    if (distanceVariance > 1.0) consistencyScore -= 15;
    if (distanceVariance > 2.0) consistencyScore -= 25;
    
    // Penalize if any comparable is too far
    const maxDistance = Math.max(...distances);
    if (maxDistance > 3.0) consistencyScore -= 30;

    return {
      averageDistance,
      distanceVariance,
      consistencyScore: Math.max(0, consistencyScore)
    };
  }

  // ===========================
  // ADJUSTMENT VALIDATION
  // ===========================

  /**
   * Validate adjustments using property intelligence data
   */
  private async validateAdjustments(
    adjustments: AppraisalData['adjustments'],
    comparableAnalyses: ComparableAnalysis[]
  ): Promise<AdjustmentValidationResult[]> {
    
    return adjustments.map(adjustment => {
      const comparable = comparableAnalyses.find(
        analysis => analysis.comparable.address === adjustment.comparableId ||
                   analysis.comparable.coordinates.latitude.toString().includes(adjustment.comparableId)
      );

      if (!comparable) {
        return {
          adjustmentType: adjustment.adjustmentType,
          appraisalAmount: adjustment.amount,
          recommendedAmount: 0,
          variance: 100,
          validationStatus: ValidationStatus.FAILED,
          riskLevel: RiskLevel.HIGH
        };
      }

      // Calculate recommended adjustment based on property intelligence
      const recommendedAmount = this.calculateRecommendedAdjustment(
        adjustment.adjustmentType,
        comparable
      );

      const variance = Math.abs(adjustment.amount - recommendedAmount) / 
        Math.max(Math.abs(adjustment.amount), Math.abs(recommendedAmount), 1) * 100;

      // Determine validation status
      let validationStatus: ValidationStatus;
      let riskLevel: RiskLevel;

      if (variance <= 15) {
        validationStatus = ValidationStatus.PASSED;
        riskLevel = RiskLevel.LOW;
      } else if (variance <= 30) {
        validationStatus = ValidationStatus.WARNING;
        riskLevel = RiskLevel.MEDIUM;
      } else if (variance <= 50) {
        validationStatus = ValidationStatus.REQUIRES_REVIEW;
        riskLevel = RiskLevel.HIGH;
      } else {
        validationStatus = ValidationStatus.FAILED;
        riskLevel = RiskLevel.CRITICAL;
      }

      return {
        adjustmentType: adjustment.adjustmentType,
        appraisalAmount: adjustment.amount,
        recommendedAmount,
        variance,
        validationStatus,
        riskLevel
      };
    });
  }

  // ===========================
  // SIMILARITY SCORING
  // ===========================

  /**
   * Calculate similarity score between comparable and subject
   */
  private calculateSimilarityScore(
    comparableIntelligence: PropertyIntelligence,
    comparableDemographics: DemographicIntelligence,
    subjectIntelligence: PropertyIntelligence,
    subjectDemographics: DemographicIntelligence
  ): SimilarityScore {
    
    // Demographic similarity (using Census data)
    const demographicSimilarity = this.calculateDemographicSimilarity(
      comparableDemographics,
      subjectDemographics
    );

    // Economic similarity
    const economicSimilarity = this.calculateEconomicSimilarity(
      comparableDemographics,
      subjectDemographics
    );

    // Geographic similarity (using proximity analysis)
    const geographicSimilarity = this.calculateGeographicSimilarity(
      comparableIntelligence,
      subjectIntelligence
    );

    // Overall similarity (weighted average)
    const overallSimilarity = Math.round(
      demographicSimilarity * 0.3 +
      economicSimilarity * 0.3 +
      geographicSimilarity * 0.4
    );

    return {
      overallSimilarity,
      demographicSimilarity,
      economicSimilarity,
      geographicSimilarity
    };
  }

  /**
   * Calculate demographic similarity using Census data
   */
  private calculateDemographicSimilarity(
    comparable: DemographicIntelligence,
    subject: DemographicIntelligence
  ): number {
    
    let similarity = 100;

    // Compare median age (if available)
    if (comparable.populationCharacteristics?.ageDistribution && 
        subject.populationCharacteristics?.ageDistribution) {
      
      const compAgeDistrib = comparable.populationCharacteristics.ageDistribution;
      const subjAgeDistrib = subject.populationCharacteristics.ageDistribution;
      
      // Calculate age distribution similarity
      const ageDiff = Math.abs(compAgeDistrib.age25to54 - subjAgeDistrib.age25to54);
      similarity -= ageDiff * 0.5; // Penalize age differences
    }

    // Compare household composition
    if (comparable.householdComposition?.averageHouseholdSize && 
        subject.householdComposition?.averageHouseholdSize) {
      
      const householdDiff = Math.abs(
        comparable.householdComposition.averageHouseholdSize - 
        subject.householdComposition.averageHouseholdSize
      );
      similarity -= householdDiff * 10; // Penalize household size differences
    }

    return Math.max(0, Math.round(similarity));
  }

  /**
   * Calculate economic similarity
   */
  private calculateEconomicSimilarity(
    comparable: DemographicIntelligence,
    subject: DemographicIntelligence
  ): number {
    
    // This would be enhanced with economic intelligence data
    // For now, use demographic compatibility scores as a proxy
    const compScore = comparable.demographicCompatibilityScore || 50;
    const subjScore = subject.demographicCompatibilityScore || 50;
    
    const scoreDiff = Math.abs(compScore - subjScore);
    return Math.max(0, 100 - scoreDiff * 2);
  }

  /**
   * Calculate geographic similarity using proximity analysis
   */
  private calculateGeographicSimilarity(
    comparable: PropertyIntelligence,
    subject: PropertyIntelligence
  ): number {
    
    // This would be enhanced with detailed proximity analysis
    // For now, return a baseline score
    return 75; // Placeholder - would use actual proximity data
  }

  // ===========================
  // RISK ASSESSMENT
  // ===========================

  /**
   * Identify risk factors for individual comparable
   */
  private identifyComparableRiskFactors(
    comparable: Comparable,
    intelligence: PropertyIntelligence,
    demographics: DemographicIntelligence,
    similarity: SimilarityScore
  ): string[] {
    
    const riskFactors: string[] = [];

    // Distance risk
    if (comparable.distanceFromSubject > 2.0) {
      riskFactors.push(`Comparable distance exceeds 2 miles (${comparable.distanceFromSubject.toFixed(1)} miles)`);
    }

    // Similarity risk
    if (similarity.overallSimilarity < 60) {
      riskFactors.push(`Low similarity to subject property (${similarity.overallSimilarity}/100)`);
    }

    // Demographic risk
    if (similarity.demographicSimilarity < 50) {
      riskFactors.push(`Significant demographic differences from subject area`);
    }

    // Age of sale risk
    const saleAge = (Date.now() - comparable.saleDate.getTime()) / (1000 * 60 * 60 * 24);
    if (saleAge > 180) {
      riskFactors.push(`Sale date older than 6 months (${Math.round(saleAge)} days)`);
    }

    return riskFactors;
  }

  /**
   * Generate comparable risk flags
   */
  private generateComparableRiskFlags(
    comparableAnalyses: ComparableAnalysis[],
    locationConsistency: LocationConsistencyAnalysis,
    adjustmentValidation: AdjustmentValidationResult[]
  ): ComparableRiskFlag[] {
    
    const riskFlags: ComparableRiskFlag[] = [];

    // Location consistency flags
    if (locationConsistency.averageDistance > 2.0) {
      riskFlags.push({
        type: 'EXCESSIVE_DISTANCE',
        severity: RiskSeverity.HIGH,
        description: `Average comparable distance exceeds 2 miles (${locationConsistency.averageDistance.toFixed(1)} miles)`,
        comparableId: 'ALL'
      });
    }

    // Individual comparable flags
    comparableAnalyses.forEach(analysis => {
      if (analysis.similarityToSubject.overallSimilarity < 50) {
        riskFlags.push({
          type: 'LOW_SIMILARITY',
          severity: RiskSeverity.MEDIUM,
          description: `Comparable has low similarity to subject (${analysis.similarityToSubject.overallSimilarity}/100)`,
          comparableId: analysis.comparable.address
        });
      }

      if (analysis.riskFactors.length > 2) {
        riskFlags.push({
          type: 'MULTIPLE_RISK_FACTORS',
          severity: RiskSeverity.MEDIUM,
          description: `Comparable has ${analysis.riskFactors.length} risk factors`,
          comparableId: analysis.comparable.address
        });
      }
    });

    // Adjustment validation flags
    const criticalAdjustments = adjustmentValidation.filter(adj => adj.riskLevel === RiskLevel.CRITICAL);
    if (criticalAdjustments.length > 0) {
      riskFlags.push({
        type: 'CRITICAL_ADJUSTMENT_VARIANCE',
        severity: RiskSeverity.CRITICAL,
        description: `${criticalAdjustments.length} adjustments have critical variances`,
        comparableId: 'ADJUSTMENTS'
      });
    }

    return riskFlags;
  }

  // ===========================
  // SCORING METHODS
  // ===========================

  /**
   * Calculate overall comparable validation score
   */
  private calculateComparableValidationScore(
    comparableAnalyses: ComparableAnalysis[],
    locationConsistency: LocationConsistencyAnalysis,
    adjustmentValidation: AdjustmentValidationResult[],
    riskFlags: ComparableRiskFlag[]
  ): number {
    
    // Average similarity score
    const avgSimilarity = comparableAnalyses.reduce((sum, analysis) => 
      sum + analysis.similarityToSubject.overallSimilarity, 0
    ) / comparableAnalyses.length;

    // Average adjustment validation score
    const avgAdjustmentScore = adjustmentValidation.reduce((sum, adj) => {
      return sum + this.getValidationScore(adj.validationStatus);
    }, 0) / Math.max(adjustmentValidation.length, 1);

    // Base score calculation
    const baseScore = (
      avgSimilarity * 0.4 +
      locationConsistency.consistencyScore * 0.3 +
      avgAdjustmentScore * 0.3
    );

    // Risk penalty
    const riskPenalty = riskFlags.reduce((penalty, flag) => {
      switch (flag.severity) {
        case RiskSeverity.CRITICAL: return penalty + 20;
        case RiskSeverity.HIGH: return penalty + 15;
        case RiskSeverity.MEDIUM: return penalty + 10;
        default: return penalty + 5;
      }
    }, 0);

    return Math.max(0, Math.round(baseScore - riskPenalty));
  }

  /**
   * Calculate overall consistency score
   */
  private calculateOverallConsistency(
    comparableAnalyses: ComparableAnalysis[],
    locationConsistency: LocationConsistencyAnalysis
  ): number {
    
    const similarityConsistency = comparableAnalyses.reduce((sum, analysis) => 
      sum + analysis.similarityToSubject.overallSimilarity, 0
    ) / comparableAnalyses.length;

    return Math.round((similarityConsistency + locationConsistency.consistencyScore) / 2);
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  /**
   * Calculate recommended adjustment amount based on property intelligence
   */
  private calculateRecommendedAdjustment(
    adjustmentType: AdjustmentType,
    comparable: ComparableAnalysis
  ): number {
    
    // This would be enhanced with sophisticated adjustment algorithms
    // For now, return simplified recommendations
    
    switch (adjustmentType) {
      case AdjustmentType.LOCATION:
        return this.calculateLocationAdjustment(comparable);
      case AdjustmentType.VIEW:
        return this.calculateViewAdjustment(comparable);
      case AdjustmentType.TRANSPORTATION:
        return this.calculateTransportationAdjustment(comparable);
      default:
        return 0; // No recommendation for other types yet
    }
  }

  private calculateLocationAdjustment(comparable: ComparableAnalysis): number {
    // Use demographic compatibility score difference as basis
    const scoreDiff = comparable.censusData.demographicCompatibilityScore || 0;
    return scoreDiff > 75 ? 5000 : scoreDiff > 50 ? 0 : -5000;
  }

  private calculateViewAdjustment(comparable: ComparableAnalysis): number {
    // Placeholder - would use actual view analysis data
    return 0;
  }

  private calculateTransportationAdjustment(comparable: ComparableAnalysis): number {
    // Placeholder - would use actual transportation analysis data
    return 0;
  }

  /**
   * Convert validation status to numeric score
   */
  private getValidationScore(status: ValidationStatus): number {
    switch (status) {
      case ValidationStatus.PASSED: return 100;
      case ValidationStatus.WARNING: return 75;
      case ValidationStatus.REQUIRES_REVIEW: return 50;
      case ValidationStatus.FAILED: return 25;
      default: return 0;
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: string; lastUpdate: Date }> {
    return {
      status: 'operational',
      lastUpdate: new Date()
    };
  }
}