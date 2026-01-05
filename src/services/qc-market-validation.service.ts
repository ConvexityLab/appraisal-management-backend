/**
 * QC Market Validation Service
 * 
 * Validates appraisal market assumptions using Census intelligence and property data
 * Provides comprehensive market validation for quality control processes
 */

import { Logger } from '../utils/logger.js';
import { GenericCacheService } from './cache/generic-cache.service';
import { CensusIntelligenceService } from './census-intelligence.service';
import { MultiProviderPropertyIntelligenceService } from './multi-provider-intelligence.service';
import { Coordinates } from '../types/geospatial.js';
import {
  MarketValidationReport,
  IncomeValidationResult,
  DemographicValidationResult,
  HousingValidationResult,
  AppraisalData,
  AppraisalDemographics,
  AppraisalEconomicFactors,
  ValidationStatus,
  RiskLevel,
  MarketRiskFlag,
  RiskSeverity
} from '../types/qc-validation.js';
import {
  DemographicIntelligence,
  EconomicIntelligence,
  HousingIntelligence
} from '../types/property-intelligence.js';

export class QCMarketValidationService {
  private logger: Logger;
  private cache: GenericCacheService;
  private censusService: CensusIntelligenceService;
  private multiProviderService: MultiProviderPropertyIntelligenceService;

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
    this.censusService = new CensusIntelligenceService();
    this.multiProviderService = new MultiProviderPropertyIntelligenceService();
  }

  // ===========================
  // MAIN VALIDATION METHOD
  // ===========================

  /**
   * Comprehensive market validation using Census intelligence and property data
   */
  async validateAppraisalMarketData(
    appraisal: AppraisalData,
    propertyId?: string
  ): Promise<MarketValidationReport> {
    try {
      const startTime = Date.now();
      this.logger.info('Starting QC market validation', { 
        appraisalId: appraisal.id, 
        propertyId,
        propertyAddress: appraisal.property.address 
      });

      // Get comprehensive Census intelligence
      const censusData = await this.multiProviderService.getComprehensiveCensusIntelligence(
        appraisal.property.coordinates,
        propertyId
      );

      // Perform detailed validations
      const [incomeValidation, demographicValidation, housingValidation] = await Promise.all([
        this.validateIncomeAssumptions(appraisal.marketAnalysis, censusData.economics),
        this.validateDemographicAssumptions(appraisal.marketAnalysis, censusData.demographics),
        this.validateHousingAssumptions(appraisal, censusData.housing)
      ]);

      // Generate risk flags
      const riskFlags = this.generateMarketRiskFlags(
        incomeValidation,
        demographicValidation,
        housingValidation,
        censusData
      );

      // Calculate overall validation score
      const validationScore = this.calculateMarketValidationScore(
        incomeValidation,
        demographicValidation,
        housingValidation,
        riskFlags
      );

      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(censusData);

      const report: MarketValidationReport = {
        validationScore,
        censusValidation: {
          incomeValidation,
          demographicValidation,
          housingValidation
        },
        riskFlags,
        confidenceScore,
        dataSourcesUsed: [
          'U.S. Census Bureau ACS 2022',
          'U.S. Census Decennial 2020',
          'Multi-Provider Geographic Intelligence'
        ]
      };

      const processingTime = Date.now() - startTime;
      this.logger.info('QC market validation completed', {
        appraisalId: appraisal.id,
        validationScore: report.validationScore,
        riskFlagsCount: riskFlags.length,
        processingTime
      });

      return report;

    } catch (error) {
      this.logger.error('QC market validation failed', { error, appraisalId: appraisal.id });
      throw new Error('Market validation service unavailable');
    }
  }

  // ===========================
  // INCOME VALIDATION
  // ===========================

  /**
   * Validate appraiser income assumptions against Census data
   */
  private async validateIncomeAssumptions(
    marketAnalysis: AppraisalData['marketAnalysis'],
    censusEconomics: EconomicIntelligence
  ): Promise<IncomeValidationResult> {
    
    const appraisalIncomeAssumption = marketAnalysis.demographics.medianIncome || 0;
    const censusMedianIncome = censusEconomics.incomeMetrics.medianHouseholdIncome;
    
    const variancePercentage = appraisalIncomeAssumption > 0 
      ? Math.abs((appraisalIncomeAssumption - censusMedianIncome) / censusMedianIncome) * 100
      : 100;

    // Determine validation status and risk level
    let validationStatus: ValidationStatus;
    let riskLevel: RiskLevel;
    let explanation: string;

    if (variancePercentage <= 10) {
      validationStatus = ValidationStatus.PASSED;
      riskLevel = RiskLevel.LOW;
      explanation = `Income assumption closely aligns with Census data (${variancePercentage.toFixed(1)}% variance)`;
    } else if (variancePercentage <= 25) {
      validationStatus = ValidationStatus.WARNING;
      riskLevel = RiskLevel.MEDIUM;
      explanation = `Moderate income variance detected (${variancePercentage.toFixed(1)}%) - review recommended`;
    } else if (variancePercentage <= 50) {
      validationStatus = ValidationStatus.REQUIRES_REVIEW;
      riskLevel = RiskLevel.HIGH;
      explanation = `Significant income variance (${variancePercentage.toFixed(1)}%) requires justification`;
    } else {
      validationStatus = ValidationStatus.FAILED;
      riskLevel = RiskLevel.CRITICAL;
      explanation = `Critical income variance (${variancePercentage.toFixed(1)}%) - potential error in market analysis`;
    }

    return {
      appraisalIncomeAssumption,
      censusMedianIncome,
      variancePercentage,
      validationStatus,
      riskLevel,
      explanation
    };
  }

  // ===========================
  // DEMOGRAPHIC VALIDATION
  // ===========================

  /**
   * Validate demographic assumptions against Census data
   */
  private async validateDemographicAssumptions(
    marketAnalysis: AppraisalData['marketAnalysis'],
    censusDemographics: DemographicIntelligence
  ): Promise<DemographicValidationResult> {
    
    const appraisalDemo = marketAnalysis.demographics;
    const discrepancies: string[] = [];
    let consistencyScore = 100;

    // Validate household size
    if (appraisalDemo.householdSize && censusDemographics.householdComposition.averageHouseholdSize) {
      const variance = Math.abs(
        (appraisalDemo.householdSize - censusDemographics.householdComposition.averageHouseholdSize) /
        censusDemographics.householdComposition.averageHouseholdSize
      ) * 100;
      
      if (variance > 20) {
        discrepancies.push(`Household size variance: ${variance.toFixed(1)}%`);
        consistencyScore -= 20;
      }
    }

    // Validate ownership rate
    if (appraisalDemo.ownershipRate) {
      const censusOwnershipRate = censusDemographics.householdComposition.familyHouseholds;
      const variance = Math.abs((appraisalDemo.ownershipRate - censusOwnershipRate) / censusOwnershipRate) * 100;
      
      if (variance > 15) {
        discrepancies.push(`Ownership rate variance: ${variance.toFixed(1)}%`);
        consistencyScore -= 15;
      }
    }

    // Validate population density assumptions
    if (appraisalDemo.populationDensity && censusDemographics.populationCharacteristics.populationDensity) {
      const variance = Math.abs(
        (appraisalDemo.populationDensity - censusDemographics.populationCharacteristics.populationDensity) /
        censusDemographics.populationCharacteristics.populationDensity
      ) * 100;
      
      if (variance > 30) {
        discrepancies.push(`Population density variance: ${variance.toFixed(1)}%`);
        consistencyScore -= 25;
      }
    }

    // Determine overall validation status
    let validationStatus: ValidationStatus;
    if (consistencyScore >= 90) {
      validationStatus = ValidationStatus.PASSED;
    } else if (consistencyScore >= 75) {
      validationStatus = ValidationStatus.WARNING;
    } else if (consistencyScore >= 50) {
      validationStatus = ValidationStatus.REQUIRES_REVIEW;
    } else {
      validationStatus = ValidationStatus.FAILED;
    }

    return {
      appraisalDemographics: appraisalDemo,
      censusDemographics,
      consistencyScore,
      validationStatus,
      discrepancies
    };
  }

  // ===========================
  // HOUSING VALIDATION
  // ===========================

  /**
   * Validate housing market assumptions against Census housing data
   */
  private async validateHousingAssumptions(
    appraisal: AppraisalData,
    censusHousing: HousingIntelligence
  ): Promise<HousingValidationResult> {
    
    const appraisalValue = appraisal.valuation.finalValue;
    const censusMedianValue = censusHousing.housingAffordability.medianHomeValue;
    
    const valueVariancePercentage = censusMedianValue > 0
      ? Math.abs((appraisalValue - censusMedianValue) / censusMedianValue) * 100
      : 100;

    // Validate market conditions consistency
    const marketConditionConsistency = this.validateMarketConditions(
      appraisal.valuation.marketConditions,
      censusHousing
    );

    // Determine validation status
    let validationStatus: ValidationStatus;
    if (valueVariancePercentage <= 15 && marketConditionConsistency >= 80) {
      validationStatus = ValidationStatus.PASSED;
    } else if (valueVariancePercentage <= 30 && marketConditionConsistency >= 60) {
      validationStatus = ValidationStatus.WARNING;
    } else if (valueVariancePercentage <= 50 && marketConditionConsistency >= 40) {
      validationStatus = ValidationStatus.REQUIRES_REVIEW;
    } else {
      validationStatus = ValidationStatus.FAILED;
    }

    return {
      appraisalValue,
      censusMedianValue,
      valueVariancePercentage,
      marketConditionConsistency,
      validationStatus
    };
  }

  // ===========================
  // RISK FLAG GENERATION
  // ===========================

  /**
   * Generate market risk flags based on validation results
   */
  private generateMarketRiskFlags(
    incomeValidation: IncomeValidationResult,
    demographicValidation: DemographicValidationResult,
    housingValidation: HousingValidationResult,
    censusData: any
  ): MarketRiskFlag[] {
    
    const riskFlags: MarketRiskFlag[] = [];

    // Income variance risk flag
    if (incomeValidation.variancePercentage > 25) {
      riskFlags.push({
        type: 'INCOME_VARIANCE_HIGH',
        severity: incomeValidation.variancePercentage > 50 ? RiskSeverity.CRITICAL : RiskSeverity.HIGH,
        description: `Income assumption varies ${incomeValidation.variancePercentage.toFixed(1)}% from Census data`,
        value: incomeValidation.variancePercentage,
        threshold: 25
      });
    }

    // Demographic consistency risk flag
    if (demographicValidation.consistencyScore < 75) {
      riskFlags.push({
        type: 'DEMOGRAPHIC_INCONSISTENCY',
        severity: demographicValidation.consistencyScore < 50 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM,
        description: `Demographic assumptions inconsistent with Census data (${demographicValidation.consistencyScore}/100)`,
        value: demographicValidation.consistencyScore,
        threshold: 75
      });
    }

    // Housing value variance risk flag
    if (housingValidation.valueVariancePercentage > 30) {
      riskFlags.push({
        type: 'VALUE_VARIANCE_HIGH',
        severity: housingValidation.valueVariancePercentage > 50 ? RiskSeverity.CRITICAL : RiskSeverity.MEDIUM,
        description: `Appraised value varies ${housingValidation.valueVariancePercentage.toFixed(1)}% from Census median`,
        value: housingValidation.valueVariancePercentage,
        threshold: 30
      });
    }

    // Economic instability risk flag
    if (censusData.economics.economicVitalityScore < 60) {
      riskFlags.push({
        type: 'ECONOMIC_INSTABILITY',
        severity: RiskSeverity.MEDIUM,
        description: `Economic vitality score indicates potential market instability (${censusData.economics.economicVitalityScore}/100)`,
        value: censusData.economics.economicVitalityScore,
        threshold: 60
      });
    }

    return riskFlags;
  }

  // ===========================
  // SCORING METHODS
  // ===========================

  /**
   * Calculate overall market validation score
   */
  private calculateMarketValidationScore(
    incomeValidation: IncomeValidationResult,
    demographicValidation: DemographicValidationResult,
    housingValidation: HousingValidationResult,
    riskFlags: MarketRiskFlag[]
  ): number {
    
    // Base scores for each validation component
    const incomeScore = this.getValidationScore(incomeValidation.validationStatus);
    const demographicScore = demographicValidation.consistencyScore;
    const housingScore = this.getValidationScore(housingValidation.validationStatus);
    
    // Weighted average
    const baseScore = (incomeScore * 0.4 + demographicScore * 0.3 + housingScore * 0.3);
    
    // Penalty for risk flags
    const riskPenalty = riskFlags.reduce((penalty, flag) => {
      switch (flag.severity) {
        case RiskSeverity.CRITICAL: return penalty + 15;
        case RiskSeverity.HIGH: return penalty + 10;
        case RiskSeverity.MEDIUM: return penalty + 5;
        default: return penalty + 2;
      }
    }, 0);
    
    return Math.max(0, Math.round(baseScore - riskPenalty));
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidenceScore(censusData: any): number {
    let confidenceScore = 100;
    
    // Reduce confidence if Census community score is low
    if (censusData.overallCommunityScore < 50) {
      confidenceScore -= 20;
    }
    
    // Reduce confidence if economic vitality is low
    if (censusData.economics.economicVitalityScore < 60) {
      confidenceScore -= 15;
    }
    
    // Reduce confidence if housing market score is low
    if (censusData.housing.housingMarketScore < 60) {
      confidenceScore -= 10;
    }
    
    return Math.max(50, confidenceScore); // Minimum 50% confidence
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

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
   * Validate market conditions consistency with Census housing data
   */
  private validateMarketConditions(
    appraisalConditions: any,
    censusHousing: HousingIntelligence
  ): number {
    
    // This is a simplified validation - would be enhanced with more sophisticated logic
    let consistencyScore = 80; // Base score
    
    // Check housing market indicators
    if (censusHousing.housingStock.vacancyRate > 15) {
      consistencyScore -= 20; // High vacancy suggests weaker market
    }
    
    if (censusHousing.housingAffordability.housingCostBurden.over50percent > 25) {
      consistencyScore -= 15; // High cost burden suggests market stress
    }
    
    return Math.max(0, consistencyScore);
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