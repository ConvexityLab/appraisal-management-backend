import { Logger } from '../utils/logger.js';
import { AppraisalOrder, PropertyDetails, PropertyAddress } from '../types/index.js';

/**
 * Advanced Valuation Engine with ML Models
 * Implements AVM, comparative analysis, and risk assessment using Azure ML and statistical models
 */
export class ValuationEngine {
  private logger: Logger;
  private azureMLEndpoint: string;
  private apiKey: string;

  constructor() {
    this.logger = new Logger();
    this.azureMLEndpoint = process.env.AZURE_ML_ENDPOINT || '';
    this.apiKey = process.env.AZURE_ML_API_KEY || '';
  }

  /**
   * Comprehensive property valuation using multiple models
   */
  async performValuation(order: AppraisalOrder): Promise<ValuationResult> {
    this.logger.info('Starting comprehensive valuation', { orderId: order.id });

    try {
      // Run multiple valuation approaches in parallel
      const [
        avmResult,
        comparativeAnalysis,
        riskAssessment,
        marketTrends,
        confidenceMetrics
      ] = await Promise.all([
        this.runAVMModel(order.propertyDetails, order.propertyAddress),
        this.performComparativeMarketAnalysis(order.propertyAddress),
        this.assessPropertyRisk(order.propertyDetails, order.propertyAddress),
        this.analyzeMarketTrends(order.propertyAddress),
        this.calculateConfidenceMetrics(order)
      ]);

      // Ensemble model combining all approaches
      const finalValuation = this.combineValuationResults({
        avm: avmResult,
        cma: comparativeAnalysis,
        risk: riskAssessment,
        market: marketTrends,
        confidence: confidenceMetrics
      });

      this.logger.info('Valuation completed', {
        orderId: order.id,
        estimatedValue: finalValuation.estimatedValue,
        confidenceScore: finalValuation.confidenceScore
      });

      return finalValuation;

    } catch (error) {
      this.logger.error('Valuation failed', { orderId: order.id, error });
      throw new Error(`Valuation failed: ${error}`);
    }
  }

  /**
   * Automated Valuation Model (AVM) using Azure ML
   */
  private async runAVMModel(property: PropertyDetails, address: PropertyAddress): Promise<AVMResult> {
    // Feature engineering for ML model
    const features = this.extractMLFeatures(property, address);

    if (this.azureMLEndpoint && this.apiKey) {
      try {
        // Call Azure ML endpoint
        const response = await fetch(this.azureMLEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'azureml-model-deployment': 'property-valuation-v1'
          },
          body: JSON.stringify({
            data: [features]
          })
        });

        const result = await response.json();
        
        return {
          estimatedValue: result.result[0],
          confidence: result.confidence || 0.85,
          modelVersion: 'azure-ml-v1.2',
          features: features,
          explanation: this.generateModelExplanation(features, result.result[0])
        };
      } catch (error) {
        this.logger.warn('Azure ML endpoint failed, using fallback model', { error });
      }
    }

    // Fallback local model using statistical regression
    return this.fallbackAVMModel(features);
  }

  /**
   * Comparative Market Analysis using recent sales data
   */
  private async performComparativeMarketAnalysis(address: PropertyAddress): Promise<CMAResult> {
    // Mock implementation - in production would query MLS/public records
    const comparables = await this.findComparableProperties(address);
    
    const adjustedComps = comparables.map(comp => ({
      ...comp,
      adjustedValue: this.applyComparabilityAdjustments(comp, address)
    }));

    const averageValue = adjustedComps.reduce((sum, comp) => sum + comp.adjustedValue, 0) / adjustedComps.length;
    
    return {
      estimatedValue: averageValue,
      comparables: adjustedComps,
      adjustments: this.calculateAdjustmentSummary(adjustedComps),
      dataQuality: this.assessComparableDataQuality(adjustedComps),
      marketConditions: await this.assessMarketConditions(address)
    };
  }

  /**
   * Property risk assessment using ML classification
   */
  private async assessPropertyRisk(property: PropertyDetails, address: PropertyAddress): Promise<RiskAssessment> {
    const riskFactors = {
      structuralRisk: this.assessStructuralRisk(property),
      locationRisk: this.assessLocationRisk(address),
      marketRisk: this.assessMarketRisk(address),
      environmentalRisk: await this.assessEnvironmentalRisk(address),
      economicRisk: this.assessEconomicRisk(address)
    };

    const overallRiskScore = this.calculateOverallRisk(riskFactors);
    const riskCategory = this.categorizeRisk(overallRiskScore);

    return {
      overallScore: overallRiskScore,
      category: riskCategory,
      factors: riskFactors,
      mitigationStrategies: this.generateMitigationStrategies(riskFactors),
      impactOnValue: this.calculateRiskValueImpact(overallRiskScore)
    };
  }

  /**
   * Market trend analysis using time series data
   */
  private async analyzeMarketTrends(address: PropertyAddress): Promise<MarketTrendAnalysis> {
    // Mock implementation - would use real market data APIs
    const historicalData = await this.getHistoricalMarketData(address);
    
    return {
      priceAppreciation: this.calculatePriceAppreciation(historicalData),
      marketVelocity: this.calculateMarketVelocity(historicalData),
      seasonalAdjustments: this.calculateSeasonalAdjustments(historicalData),
      forecastTrend: this.forecastMarketTrend(historicalData),
      marketSegment: this.identifyMarketSegment(address)
    };
  }

  /**
   * Extract machine learning features from property data
   */
  private extractMLFeatures(property: PropertyDetails, address: PropertyAddress): MLFeatures {
    return {
      // Property characteristics
      squareFootage: (property as any).squareFootage || 0, // TODO: Check correct property name
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      yearBuilt: property.yearBuilt || 1950,
      lotSize: property.lotSize || 0,
      
      // Location features
      zipCode: parseInt(address.zipCode) || 0,
      latitude: address.coordinates?.latitude || 0,
      longitude: address.coordinates?.longitude || 0,
      
      // Derived features
      ageOfHome: new Date().getFullYear() - (property.yearBuilt || 1950),
      pricePerSqFt: 0, // Will be calculated
      bedroomToBathroomRatio: (property.bedrooms || 1) / (property.bathrooms || 1),
      
      // Market features (would be populated from external data)
      schoolDistrict: 0,
      crimeRate: 0,
      walkScore: 0,
      medianIncomeArea: 0
    };
  }

  /**
   * Fallback AVM model using statistical regression
   */
  private fallbackAVMModel(features: MLFeatures): AVMResult {
    // Simplified statistical model for demonstration
    // In production, this would be a trained regression model
    
    const baseValue = features.squareFootage * 150; // Base price per sq ft
    const ageAdjustment = Math.max(0, 1 - (features.ageOfHome * 0.005)); // Age depreciation
    const locationMultiplier = 1 + (features.zipCode % 100) * 0.001; // Crude location adjustment
    
    const estimatedValue = baseValue * ageAdjustment * locationMultiplier;
    
    return {
      estimatedValue: Math.round(estimatedValue),
      confidence: 0.75, // Lower confidence for fallback model
      modelVersion: 'fallback-v1.0',
      features: features,
      explanation: `Based on ${features.squareFootage} sq ft property built in ${features.yearBuilt - features.ageOfHome}`
    };
  }

  /**
   * Combine multiple valuation approaches using ensemble method
   */
  private combineValuationResults(results: ValuationInputs): ValuationResult {
    // Weighted ensemble based on confidence scores
    const weights = {
      avm: results.avm.confidence * 0.4,
      cma: results.cma.dataQuality * 0.4,
      risk: 0.2
    };
    
    const totalWeight = weights.avm + weights.cma + weights.risk;
    
    const weightedValue = (
      (results.avm.estimatedValue * weights.avm) +
      (results.cma.estimatedValue * weights.cma) +
      (results.avm.estimatedValue * (1 - results.risk.impactOnValue) * weights.risk)
    ) / totalWeight;

    return {
      estimatedValue: Math.round(weightedValue),
      confidenceScore: results.confidence.overall,
      valuationRange: {
        low: Math.round(weightedValue * 0.9),
        high: Math.round(weightedValue * 1.1)
      },
      methodology: 'ensemble',
      components: {
        avm: results.avm,
        cma: results.cma,
        risk: results.risk,
        market: results.market
      },
      qualityMetrics: results.confidence,
      recommendations: this.generateValuationRecommendations(results),
      timestamp: new Date()
    };
  }

  /**
   * Suggest ranked comparable properties for a subject.
   * Backed by ValuationEngine CMA — no Bridge API dependency.
   * Returns mocked data today; swap findComparableProperties() for a real
   * Cosmos / MLS query when the data pipeline is ready.
   */
  async suggestComparables(
    address: PropertyAddress,
    subject: SubjectFeatures
  ): Promise<CompSuggestion[]> {
    const comps = await this.findComparableProperties(address);

    return comps.map((comp, i): CompSuggestion => {
      const sizeAdj = (subject.squareFootage - comp.squareFootage) * 75; // $75/sqft
      const bedAdj  = (subject.bedrooms    - comp.bedrooms)    * 2_500;
      const bathAdj = (subject.bathrooms   - comp.bathrooms)   * 1_500;
      const totalAdj = sizeAdj + bedAdj + bathAdj;
      const adjustedValue = comp.salePrice + totalAdj;

      // Crude similarity: penalise distance, size diff, age diff
      const sizeDiffPct  = Math.abs(comp.squareFootage - subject.squareFootage) / (subject.squareFootage || 1);
      const distancePenalty = comp.distance * 0.05;
      const similarityScore = Math.max(0, 1 - sizeDiffPct * 0.5 - distancePenalty);

      const reasons: string[] = [];
      if (sizeDiffPct < 0.1) reasons.push('Very similar square footage');
      if (comp.bedrooms === subject.bedrooms) reasons.push('Same bedroom count');
      if (comp.distance < 0.5) reasons.push('Within 0.5 mi of subject');
      if (reasons.length === 0) reasons.push('Nearest available comparable');

      return {
        id: `ve-mock-${i + 1}`,
        address: {
          street: comp.address,
          city: address.city || '',
          state: address.state || '',
          zip: address.zipCode,
        },
        salePrice: comp.salePrice,
        saleDate: comp.saleDate.toISOString().slice(0, 10),
        squareFootage: comp.squareFootage,
        bedrooms: comp.bedrooms,
        bathrooms: comp.bathrooms,
        distance: comp.distance,
        similarityScore: parseFloat(similarityScore.toFixed(3)),
        reasoning: reasons.join('; '),
        adjustments: {
          size: Math.round(sizeAdj),
          bedrooms: Math.round(bedAdj),
          bathrooms: Math.round(bathAdj),
          total: Math.round(totalAdj),
        },
        adjustedValue: Math.round(adjustedValue),
        recommendationStrength:
          similarityScore > 0.85 ? 'strong' :
          similarityScore > 0.65 ? 'moderate' : 'weak',
        source: 'valuation-engine' as const,
      };
    }).sort((a, b) => b.similarityScore - a.similarityScore);
  }

  // Helper methods (simplified implementations for demonstration)
  private async findComparableProperties(address: PropertyAddress): Promise<ComparableProperty[]> {
    // Mock comparable properties
    return [
      {
        address: '125 Main Street',
        salePrice: 750000,
        saleDate: new Date('2025-08-15'),
        squareFootage: 2400,
        bedrooms: 4,
        bathrooms: 2.5,
        distance: 0.2
      },
      {
        address: '130 Oak Street',
        salePrice: 780000,
        saleDate: new Date('2025-09-01'),
        squareFootage: 2600,
        bedrooms: 4,
        bathrooms: 3,
        distance: 0.4
      }
    ];
  }

  private applyComparabilityAdjustments(comp: ComparableProperty, subject: PropertyAddress): number {
    // Simplified adjustment logic
    let adjustedValue = comp.salePrice;
    
    // Time adjustment (2% per month)
    const monthsDiff = (new Date().getTime() - comp.saleDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    adjustedValue *= (1 + (monthsDiff * 0.02));
    
    return adjustedValue;
  }

  private calculateAdjustmentSummary(comps: any[]): AdjustmentSummary {
    return {
      timeAdjustments: comps.length * 5000, // Average time adjustment
      sizeAdjustments: 0,
      conditionAdjustments: 0,
      locationAdjustments: 0,
      totalAdjustments: comps.length * 5000
    };
  }

  private assessComparableDataQuality(comps: any[]): number {
    // Quality score based on recency, proximity, and similarity
    return Math.min(comps.length / 3, 1) * 0.9; // Max 0.9 quality score
  }

  private async assessMarketConditions(address: PropertyAddress): Promise<MarketConditions> {
    return {
      marketTrend: 'stable',
      inventoryLevels: 'normal',
      priceMovement: 'increasing',
      marketTime: 45 // days on market
    };
  }

  private assessStructuralRisk(property: PropertyDetails): number {
    const age = new Date().getFullYear() - (property.yearBuilt || 1950);
    return Math.min(age / 100, 0.5); // Age-based structural risk
  }

  private assessLocationRisk(address: PropertyAddress): number {
    // Mock location risk based on ZIP code
    return (parseInt(address.zipCode) % 10) / 20; // 0-0.45 range
  }

  private assessMarketRisk(address: PropertyAddress): number {
    return 0.1; // Low market risk
  }

  private async assessEnvironmentalRisk(address: PropertyAddress): Promise<number> {
    return 0.05; // Low environmental risk
  }

  private assessEconomicRisk(address: PropertyAddress): number {
    return 0.08; // Low economic risk
  }

  private calculateOverallRisk(factors: any): number {
    const weights = { structural: 0.3, location: 0.25, market: 0.2, environmental: 0.15, economic: 0.1 };
    return Object.entries(factors).reduce((sum, [key, value]) => {
      return sum + (value as number) * (weights[key as keyof typeof weights] || 0);
    }, 0);
  }

  private categorizeRisk(score: number): string {
    if (score < 0.1) return 'low';
    if (score < 0.3) return 'moderate';
    if (score < 0.5) return 'high';
    return 'very-high';
  }

  private generateMitigationStrategies(factors: any): string[] {
    const strategies = [];
    if (factors.structural > 0.2) strategies.push('Recommend structural inspection');
    if (factors.environmental > 0.1) strategies.push('Environmental assessment recommended');
    return strategies;
  }

  private calculateRiskValueImpact(risk: number): number {
    return Math.min(risk * 0.2, 0.1); // Max 10% value impact
  }

  private async getHistoricalMarketData(address: PropertyAddress): Promise<any[]> {
    // Mock historical data
    return [
      { date: '2024-01', medianPrice: 720000 },
      { date: '2024-06', medianPrice: 735000 },
      { date: '2025-01', medianPrice: 750000 },
      { date: '2025-06', medianPrice: 765000 }
    ];
  }

  private calculatePriceAppreciation(data: any[]): number {
    if (data.length < 2) return 0;
    const oldest = data[0].medianPrice;
    const newest = data[data.length - 1].medianPrice;
    return ((newest - oldest) / oldest) * 100; // Percentage appreciation
  }

  private calculateMarketVelocity(data: any[]): number {
    return 45; // Average days on market
  }

  private calculateSeasonalAdjustments(data: any[]): SeasonalAdjustments {
    return {
      spring: 1.02,
      summer: 1.05,
      fall: 0.98,
      winter: 0.95
    };
  }

  private forecastMarketTrend(data: any[]): MarketForecast {
    return {
      nextQuarter: 'stable',
      nextYear: 'moderate-growth',
      confidence: 0.75
    };
  }

  private identifyMarketSegment(address: PropertyAddress): string {
    return 'luxury-residential'; // Based on property characteristics
  }

  private async calculateConfidenceMetrics(order: AppraisalOrder): Promise<ConfidenceMetrics> {
    return {
      overall: 0.85,
      dataQuality: 0.9,
      modelReliability: 0.8,
      marketStability: 0.85,
      propertyComplexity: 0.9
    };
  }

  private generateModelExplanation(features: MLFeatures, value: number): string {
    return `Valuation based on ${features.squareFootage} sq ft property with ${features.bedrooms} bedrooms, built in ${new Date().getFullYear() - features.ageOfHome}`;
  }

  private generateValuationRecommendations(results: ValuationInputs): string[] {
    const recommendations = [];
    
    if (results.confidence.overall < 0.7) {
      recommendations.push('Consider additional market research due to lower confidence score');
    }
    
    if (results.risk.overallScore > 0.3) {
      recommendations.push('High risk factors identified - recommend additional due diligence');
    }
    
    if (results.cma.dataQuality < 0.6) {
      recommendations.push('Limited comparable sales data - consider expanding search radius');
    }
    
    return recommendations;
  }
}

// Type definitions for valuation components
export interface ValuationResult {
  estimatedValue: number;
  confidenceScore: number;
  valuationRange: {
    low: number;
    high: number;
  };
  methodology: string;
  components: {
    avm: AVMResult;
    cma: CMAResult;
    risk: RiskAssessment;
    market: MarketTrendAnalysis;
  };
  qualityMetrics: ConfidenceMetrics;
  recommendations: string[];
  timestamp: Date;
}

export interface AVMResult {
  estimatedValue: number;
  confidence: number;
  modelVersion: string;
  features: MLFeatures;
  explanation: string;
}

export interface CMAResult {
  estimatedValue: number;
  comparables: ComparableProperty[];
  adjustments: AdjustmentSummary;
  dataQuality: number;
  marketConditions: MarketConditions;
}

export interface RiskAssessment {
  overallScore: number;
  category: string;
  factors: {
    structuralRisk: number;
    locationRisk: number;
    marketRisk: number;
    environmentalRisk: number;
    economicRisk: number;
  };
  mitigationStrategies: string[];
  impactOnValue: number;
}

export interface MarketTrendAnalysis {
  priceAppreciation: number;
  marketVelocity: number;
  seasonalAdjustments: SeasonalAdjustments;
  forecastTrend: MarketForecast;
  marketSegment: string;
}

export interface MLFeatures {
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  lotSize: number;
  zipCode: number;
  latitude: number;
  longitude: number;
  ageOfHome: number;
  pricePerSqFt: number;
  bedroomToBathroomRatio: number;
  schoolDistrict: number;
  crimeRate: number;
  walkScore: number;
  medianIncomeArea: number;
}

export interface ComparableProperty {
  address: string;
  salePrice: number;
  saleDate: Date;
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  distance: number;
  adjustedValue?: number;
}

export interface AdjustmentSummary {
  timeAdjustments: number;
  sizeAdjustments: number;
  conditionAdjustments: number;
  locationAdjustments: number;
  totalAdjustments: number;
}

export interface MarketConditions {
  marketTrend: string;
  inventoryLevels: string;
  priceMovement: string;
  marketTime: number;
}

export interface SeasonalAdjustments {
  spring: number;
  summer: number;
  fall: number;
  winter: number;
}

export interface MarketForecast {
  nextQuarter: string;
  nextYear: string;
  confidence: number;
}

export interface ConfidenceMetrics {
  overall: number;
  dataQuality: number;
  modelReliability: number;
  marketStability: number;
  propertyComplexity: number;
}

export interface ValuationInputs {
  avm: AVMResult;
  cma: CMAResult;
  risk: RiskAssessment;
  market: MarketTrendAnalysis;
  confidence: ConfidenceMetrics;
}

// ─── Comp Search / Suggest types ─────────────────────────────────────────────

/** Subset of subject property features needed for comp matching. */
export interface SubjectFeatures {
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt?: number;
  lotSize?: number;
}

/** A single comparable property suggestion returned by suggestComparables(). */
export interface CompSuggestion {
  id: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  salePrice: number;
  saleDate: string;          // ISO date "YYYY-MM-DD"
  squareFootage: number;
  bedrooms: number;
  bathrooms: number;
  distance: number;          // miles from subject
  similarityScore: number;   // 0–1
  reasoning: string;
  adjustments: {
    size: number;
    bedrooms: number;
    bathrooms: number;
    total: number;
  };
  adjustedValue: number;
  recommendationStrength: 'strong' | 'moderate' | 'weak';
  source: 'valuation-engine';
}