/**
 * QC Risk Assessment Service
 * 
 * Combines all intelligence sources for comprehensive risk scoring and fraud detection
 * The final component of our QC validation suite
 */

import { Logger } from '../utils/logger';
import { GenericCacheService } from './cache/generic-cache.service';
import {
  RiskAssessmentReport,
  RiskFactor,
  FraudIndicator,
  MarketAnomaly,
  RiskRecommendation,
  MarketValidationReport,
  ComparableValidationReport,
  AppraisalData,
  RiskFactorType,
  RiskSeverity,
  FraudIndicatorType,
  FraudSeverity,
  AnomalyType,
  AnomalySeverity,
  ActionPriority,
  ConfidenceLevel
} from '../types/qc-validation';

export class QCRiskAssessmentService {
  private logger: Logger;
  private cache: GenericCacheService;

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
  }

  // ===========================
  // MAIN RISK ASSESSMENT METHOD
  // ===========================

  /**
   * Comprehensive risk assessment combining all validation sources
   */
  async assessAppraisalRisk(
    appraisal: AppraisalData,
    marketValidation: MarketValidationReport,
    comparableValidation: ComparableValidationReport,
    propertyId?: string
  ): Promise<RiskAssessmentReport> {
    try {
      const startTime = Date.now();
      this.logger.info('Starting QC risk assessment', { 
        appraisalId: appraisal.id, 
        propertyId 
      });

      // Generate risk factors from all validation sources
      const riskFactors = this.generateRiskFactors(
        appraisal,
        marketValidation,
        comparableValidation
      );

      // Detect potential fraud indicators
      const fraudIndicators = this.detectFraudIndicators(
        appraisal,
        marketValidation,
        comparableValidation
      );

      // Identify market anomalies
      const marketAnomalies = this.identifyMarketAnomalies(
        appraisal,
        marketValidation
      );

      // Generate recommended actions
      const recommendedActions = this.generateRiskRecommendations(
        riskFactors,
        fraudIndicators,
        marketAnomalies
      );

      // Calculate overall risk score
      const overallRiskScore = this.calculateOverallRiskScore(
        riskFactors,
        fraudIndicators,
        marketAnomalies
      );

      // Determine confidence level
      const confidenceLevel = this.determineConfidenceLevel(
        marketValidation,
        comparableValidation,
        riskFactors
      );

      const report: RiskAssessmentReport = {
        overallRiskScore,
        riskFactors,
        fraudIndicators,
        marketAnomalies,
        recommendedActions,
        confidenceLevel
      };

      const processingTime = Date.now() - startTime;
      this.logger.info('QC risk assessment completed', {
        appraisalId: appraisal.id,
        overallRiskScore: report.overallRiskScore,
        riskFactorsCount: riskFactors.length,
        fraudIndicatorsCount: fraudIndicators.length,
        processingTime
      });

      return report;

    } catch (error) {
      this.logger.error('QC risk assessment failed', { error, appraisalId: appraisal.id });
      throw new Error('Risk assessment service unavailable');
    }
  }

  // ===========================
  // RISK FACTOR GENERATION
  // ===========================

  /**
   * Generate comprehensive risk factors from all validation sources
   */
  private generateRiskFactors(
    appraisal: AppraisalData,
    marketValidation: MarketValidationReport,
    comparableValidation: ComparableValidationReport
  ): RiskFactor[] {
    
    const riskFactors: RiskFactor[] = [];

    // Market validation risk factors
    riskFactors.push(...this.generateMarketRiskFactors(marketValidation));

    // Comparable validation risk factors
    riskFactors.push(...this.generateComparableRiskFactors(comparableValidation));

    // Value analysis risk factors
    riskFactors.push(...this.generateValueRiskFactors(appraisal, marketValidation));

    // Adjustment risk factors
    riskFactors.push(...this.generateAdjustmentRiskFactors(appraisal, comparableValidation));

    return riskFactors;
  }

  /**
   * Generate market-based risk factors
   */
  private generateMarketRiskFactors(marketValidation: MarketValidationReport): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // Income variance risk
    const incomeValidation = marketValidation.censusValidation.incomeValidation;
    if (incomeValidation.variancePercentage > 25) {
      riskFactors.push({
        type: RiskFactorType.MARKET_VARIANCE,
        severity: incomeValidation.variancePercentage > 50 ? RiskSeverity.CRITICAL : RiskSeverity.HIGH,
        description: `Income assumption varies ${incomeValidation.variancePercentage.toFixed(1)}% from Census data`,
        impactOnValue: this.calculateValueImpact(incomeValidation.variancePercentage),
        dataSource: 'U.S. Census Bureau ACS 2022',
        recommendation: 'Review and justify income assumptions against local market data'
      });
    }

    // Demographic inconsistency risk
    const demographicValidation = marketValidation.censusValidation.demographicValidation;
    if (demographicValidation.consistencyScore < 70) {
      riskFactors.push({
        type: RiskFactorType.DEMOGRAPHIC_MISMATCH,
        severity: demographicValidation.consistencyScore < 50 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM,
        description: `Demographic assumptions inconsistent with Census data (${demographicValidation.consistencyScore}/100)`,
        impactOnValue: (100 - demographicValidation.consistencyScore) * 0.1,
        dataSource: 'U.S. Census Bureau Demographic Intelligence',
        recommendation: 'Verify neighborhood demographic characteristics and adjust market analysis'
      });
    }

    // Housing market risk
    const housingValidation = marketValidation.censusValidation.housingValidation;
    if (housingValidation.valueVariancePercentage > 30) {
      riskFactors.push({
        type: RiskFactorType.VALUE_ANOMALY,
        severity: housingValidation.valueVariancePercentage > 50 ? RiskSeverity.CRITICAL : RiskSeverity.MEDIUM,
        description: `Appraised value varies ${housingValidation.valueVariancePercentage.toFixed(1)}% from Census median`,
        impactOnValue: housingValidation.valueVariancePercentage * 0.2,
        dataSource: 'U.S. Census Bureau Housing Intelligence',
        recommendation: 'Validate value conclusion against broader housing market data'
      });
    }

    return riskFactors;
  }

  /**
   * Generate comparable-based risk factors
   */
  private generateComparableRiskFactors(comparableValidation: ComparableValidationReport): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // Distance risk
    if (comparableValidation.locationConsistency.averageDistance > 2.0) {
      riskFactors.push({
        type: RiskFactorType.COMPARABLE_DISTANCE,
        severity: comparableValidation.locationConsistency.averageDistance > 3.0 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM,
        description: `Average comparable distance exceeds guidelines (${comparableValidation.locationConsistency.averageDistance.toFixed(1)} miles)`,
        impactOnValue: comparableValidation.locationConsistency.averageDistance * 2,
        dataSource: 'Multi-Provider Geographic Intelligence',
        recommendation: 'Consider closer comparables or provide additional justification for distance'
      });
    }

    // Consistency risk
    if (comparableValidation.overallConsistency < 70) {
      riskFactors.push({
        type: RiskFactorType.COMPARABLE_DISTANCE,
        severity: comparableValidation.overallConsistency < 50 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM,
        description: `Comparable consistency below acceptable threshold (${comparableValidation.overallConsistency}/100)`,
        impactOnValue: (100 - comparableValidation.overallConsistency) * 0.15,
        dataSource: 'Comprehensive Property Intelligence Analysis',
        recommendation: 'Review comparable selection criteria and similarity metrics'
      });
    }

    // Adjustment outliers
    const outlierAdjustments = comparableValidation.adjustmentValidation.filter(adj => adj.variance > 50);
    if (outlierAdjustments.length > 0) {
      riskFactors.push({
        type: RiskFactorType.ADJUSTMENT_OUTLIER,
        severity: outlierAdjustments.length > 2 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM,
        description: `${outlierAdjustments.length} adjustments exceed variance thresholds`,
        impactOnValue: outlierAdjustments.reduce((sum, adj) => sum + adj.variance, 0) * 0.1,
        dataSource: 'Property Intelligence Adjustment Analysis',
        recommendation: 'Validate adjustment calculations and provide supporting market evidence'
      });
    }

    return riskFactors;
  }

  /**
   * Generate value-specific risk factors
   */
  private generateValueRiskFactors(
    appraisal: AppraisalData,
    marketValidation: MarketValidationReport
  ): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // Value range analysis
    const valueRange = appraisal.valuation.valueRange;
    const finalValue = appraisal.valuation.finalValue;
    const rangeSpread = ((valueRange.high - valueRange.low) / finalValue) * 100;

    if (rangeSpread > 20) {
      riskFactors.push({
        type: RiskFactorType.VALUE_ANOMALY,
        severity: rangeSpread > 35 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM,
        description: `Wide value range indicates uncertainty (${rangeSpread.toFixed(1)}% spread)`,
        impactOnValue: rangeSpread * 0.5,
        dataSource: 'Appraisal Value Analysis',
        recommendation: 'Narrow value range through additional market research or comparable refinement'
      });
    }

    return riskFactors;
  }

  /**
   * Generate adjustment-specific risk factors
   */
  private generateAdjustmentRiskFactors(
    appraisal: AppraisalData,
    comparableValidation: ComparableValidationReport
  ): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // Total adjustment analysis
    const totalAdjustments = appraisal.adjustments.reduce((sum, adj) => sum + Math.abs(adj.amount), 0);
    const averagePrice = appraisal.comparables.reduce((sum, comp) => sum + comp.salePrice, 0) / appraisal.comparables.length;
    const adjustmentPercentage = (totalAdjustments / averagePrice) * 100;

    if (adjustmentPercentage > 25) {
      riskFactors.push({
        type: RiskFactorType.ADJUSTMENT_OUTLIER,
        severity: adjustmentPercentage > 40 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM,
        description: `Total adjustments exceed guidelines (${adjustmentPercentage.toFixed(1)}% of sale price)`,
        impactOnValue: adjustmentPercentage * 0.3,
        dataSource: 'Adjustment Analysis',
        recommendation: 'Consider more similar comparables to reduce adjustment requirements'
      });
    }

    return riskFactors;
  }

  // ===========================
  // FRAUD DETECTION
  // ===========================

  /**
   * Detect potential fraud indicators
   */
  private detectFraudIndicators(
    appraisal: AppraisalData,
    marketValidation: MarketValidationReport,
    comparableValidation: ComparableValidationReport
  ): FraudIndicator[] {
    
    const fraudIndicators: FraudIndicator[] = [];

    // Value inflation indicators
    const valueInflationIndicator = this.detectValueInflation(appraisal, marketValidation);
    if (valueInflationIndicator) {
      fraudIndicators.push(valueInflationIndicator);
    }

    // Comparable manipulation indicators
    const comparableManipulationIndicator = this.detectComparableManipulation(comparableValidation);
    if (comparableManipulationIndicator) {
      fraudIndicators.push(comparableManipulationIndicator);
    }

    // Adjustment manipulation indicators
    const adjustmentManipulationIndicator = this.detectAdjustmentManipulation(appraisal, comparableValidation);
    if (adjustmentManipulationIndicator) {
      fraudIndicators.push(adjustmentManipulationIndicator);
    }

    return fraudIndicators;
  }

  /**
   * Detect value inflation patterns
   */
  private detectValueInflation(
    appraisal: AppraisalData,
    marketValidation: MarketValidationReport
  ): FraudIndicator | null {
    
    const housingValidation = marketValidation.censusValidation.housingValidation;
    const valueVariance = housingValidation.valueVariancePercentage;
    
    // Significant overvaluation compared to market
    if (valueVariance > 40 && appraisal.valuation.finalValue > housingValidation.censusMedianValue) {
      return {
        type: FraudIndicatorType.VALUE_INFLATION,
        severity: valueVariance > 60 ? FraudSeverity.HIGH : FraudSeverity.MEDIUM,
        description: `Appraised value significantly exceeds market median (${valueVariance.toFixed(1)}% above Census data)`,
        confidence: Math.min(90, valueVariance * 1.5)
      };
    }

    return null;
  }

  /**
   * Detect comparable manipulation patterns
   */
  private detectComparableManipulation(
    comparableValidation: ComparableValidationReport
  ): FraudIndicator | null {
    
    // Check for unusually high similarity scores (potentially cherry-picked)
    const highSimilarityCount = comparableValidation.comparableAnalyses.filter(
      analysis => analysis.similarityToSubject.overallSimilarity > 95
    ).length;

    // Check for excessive distance combined with high adjustments
    const distantComparables = comparableValidation.comparableAnalyses.filter(
      analysis => analysis.comparable.distanceFromSubject > 2.5
    );

    if (highSimilarityCount > 2 || (distantComparables.length > 1 && comparableValidation.locationConsistency.averageDistance > 3.0)) {
      return {
        type: FraudIndicatorType.COMPARABLE_MANIPULATION,
        severity: FraudSeverity.MEDIUM,
        description: 'Potential comparable selection bias detected',
        confidence: 70
      };
    }

    return null;
  }

  /**
   * Detect adjustment manipulation patterns
   */
  private detectAdjustmentManipulation(
    appraisal: AppraisalData,
    comparableValidation: ComparableValidationReport
  ): FraudIndicator | null {
    
    // Check for consistently biased adjustments
    const positiveAdjustments = appraisal.adjustments.filter(adj => adj.amount > 0);
    const negativeAdjustments = appraisal.adjustments.filter(adj => adj.amount < 0);
    
    const positiveTotal = positiveAdjustments.reduce((sum, adj) => sum + adj.amount, 0);
    const negativeTotal = Math.abs(negativeAdjustments.reduce((sum, adj) => sum + adj.amount, 0));
    
    const adjustmentBias = positiveTotal / (positiveTotal + negativeTotal) * 100;
    
    // Check for high variance in adjustment validation
    const highVarianceAdjustments = comparableValidation.adjustmentValidation.filter(adj => adj.variance > 75);
    
    if (adjustmentBias > 80 && highVarianceAdjustments.length > 2) {
      return {
        type: FraudIndicatorType.ADJUSTMENT_MANIPULATION,
        severity: FraudSeverity.MEDIUM,
        description: 'Potentially biased adjustment patterns detected',
        confidence: 65
      };
    }

    return null;
  }

  // ===========================
  // MARKET ANOMALY DETECTION
  // ===========================

  /**
   * Identify market anomalies
   */
  private identifyMarketAnomalies(
    appraisal: AppraisalData,
    marketValidation: MarketValidationReport
  ): MarketAnomaly[] {
    
    const anomalies: MarketAnomaly[] = [];

    // Price per square foot anomaly
    const pricePerSqFt = appraisal.valuation.finalValue / (appraisal.property.squareFootage || 1);
    const marketPricePerSqFt = marketValidation.censusValidation.housingValidation.censusMedianValue / 2000; // Assume 2000 sq ft average
    
    if (Math.abs(pricePerSqFt - marketPricePerSqFt) / marketPricePerSqFt > 0.5) {
      anomalies.push({
        type: AnomalyType.PRICE_OUTLIER,
        description: 'Price per square foot significantly deviates from market norm',
        severity: AnomalySeverity.SIGNIFICANT,
        detectedValue: pricePerSqFt,
        expectedRange: { 
          min: marketPricePerSqFt * 0.7, 
          max: marketPricePerSqFt * 1.3 
        }
      });
    }

    // Market time anomaly
    if (appraisal.marketAnalysis.daysOnMarket > 180 || appraisal.marketAnalysis.daysOnMarket < 10) {
      anomalies.push({
        type: AnomalyType.MARKET_TIME_ANOMALY,
        description: 'Unusual marketing time reported',
        severity: AnomalySeverity.MODERATE,
        detectedValue: appraisal.marketAnalysis.daysOnMarket,
        expectedRange: { min: 30, max: 120 }
      });
    }

    return anomalies;
  }

  // ===========================
  // RECOMMENDATIONS
  // ===========================

  /**
   * Generate risk-based recommendations
   */
  private generateRiskRecommendations(
    riskFactors: RiskFactor[],
    fraudIndicators: FraudIndicator[],
    marketAnomalies: MarketAnomaly[]
  ): RiskRecommendation[] {
    
    const recommendations: RiskRecommendation[] = [];

    // Critical risk factors
    const criticalRisks = riskFactors.filter(rf => rf.severity === RiskSeverity.CRITICAL);
    if (criticalRisks.length > 0) {
      recommendations.push({
        priority: ActionPriority.CRITICAL,
        description: `Address ${criticalRisks.length} critical risk factor(s)`,
        action: 'Immediate review and revision required before delivery',
        estimatedImpact: criticalRisks.reduce((sum, rf) => sum + rf.impactOnValue, 0)
      });
    }

    // High fraud risk
    const highFraudRisks = fraudIndicators.filter(fi => fi.severity === FraudSeverity.HIGH);
    if (highFraudRisks.length > 0) {
      recommendations.push({
        priority: ActionPriority.CRITICAL,
        description: 'Potential fraud indicators detected',
        action: 'Escalate to compliance team for detailed investigation',
        estimatedImpact: 50
      });
    }

    // Market anomalies
    const significantAnomalies = marketAnomalies.filter(ma => ma.severity === AnomalySeverity.SIGNIFICANT);
    if (significantAnomalies.length > 0) {
      recommendations.push({
        priority: ActionPriority.HIGH,
        description: `${significantAnomalies.length} significant market anomaly(ies) identified`,
        action: 'Validate market assumptions and provide additional supporting evidence',
        estimatedImpact: 25
      });
    }

    // General recommendations based on overall risk profile
    const totalRiskScore = this.calculateOverallRiskScore(riskFactors, fraudIndicators, marketAnomalies);
    if (totalRiskScore > 70) {
      recommendations.push({
        priority: ActionPriority.MEDIUM,
        description: 'Multiple moderate risk factors present',
        action: 'Comprehensive review recommended before final approval',
        estimatedImpact: 15
      });
    }

    return recommendations;
  }

  // ===========================
  // SCORING METHODS
  // ===========================

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(
    riskFactors: RiskFactor[],
    fraudIndicators: FraudIndicator[],
    marketAnomalies: MarketAnomaly[]
  ): number {
    
    // Risk factor scoring
    const riskScore = riskFactors.reduce((score, factor) => {
      switch (factor.severity) {
        case RiskSeverity.CRITICAL: return score + 25;
        case RiskSeverity.HIGH: return score + 15;
        case RiskSeverity.MEDIUM: return score + 10;
        default: return score + 5;
      }
    }, 0);

    // Fraud indicator scoring
    const fraudScore = fraudIndicators.reduce((score, indicator) => {
      switch (indicator.severity) {
        case FraudSeverity.CRITICAL: return score + 30;
        case FraudSeverity.HIGH: return score + 20;
        case FraudSeverity.MEDIUM: return score + 15;
        default: return score + 10;
      }
    }, 0);

    // Market anomaly scoring
    const anomalyScore = marketAnomalies.reduce((score, anomaly) => {
      switch (anomaly.severity) {
        case AnomalySeverity.SEVERE: return score + 20;
        case AnomalySeverity.SIGNIFICANT: return score + 15;
        case AnomalySeverity.MODERATE: return score + 10;
        default: return score + 5;
      }
    }, 0);

    return Math.min(100, riskScore + fraudScore + anomalyScore);
  }

  /**
   * Determine confidence level based on validation results
   */
  private determineConfidenceLevel(
    marketValidation: MarketValidationReport,
    comparableValidation: ComparableValidationReport,
    riskFactors: RiskFactor[]
  ): ConfidenceLevel {
    
    const avgValidationScore = (marketValidation.validationScore + comparableValidation.validationScore) / 2;
    const criticalRiskCount = riskFactors.filter(rf => rf.severity === RiskSeverity.CRITICAL).length;
    
    if (avgValidationScore >= 85 && criticalRiskCount === 0) {
      return ConfidenceLevel.VERY_HIGH;
    } else if (avgValidationScore >= 70 && criticalRiskCount <= 1) {
      return ConfidenceLevel.HIGH;
    } else if (avgValidationScore >= 55 && criticalRiskCount <= 2) {
      return ConfidenceLevel.MEDIUM;
    } else {
      return ConfidenceLevel.LOW;
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  /**
   * Calculate value impact percentage from variance
   */
  private calculateValueImpact(variance: number): number {
    return Math.min(variance * 0.3, 50); // Cap at 50% impact
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