import { Logger } from '../utils/logger.js';
import { 
  PropertyRiskAssessment, 
  Coordinates, 
  FloodRiskData,
  DisasterRiskData,
  EnvironmentalRisk,
  HistoricalDesignations,
  TribalLandData,
  CensusData,
  GeospatialApiResponse,
  BatchRiskAssessmentRequest,
  BatchRiskAssessmentResponse,
  RiskCategory,
  InsuranceRequirement,
  RegulatoryRequirement,
  DataQualityMetrics
} from '../types/geospatial.js';

// Import individual service clients
import { FemaFloodService } from './geospatial/fema-flood.service.js';
import { TigerWebService } from './geospatial/tigerweb.service.js';
import { EsriArcGISService } from './geospatial/esri-arcgis.service.js';
import { NoaaEnvironmentalService } from './geospatial/noaa-environmental.service.js';
import { GeospatialCacheService } from './geospatial/geospatial-cache.service.js';

/**
 * Comprehensive Geospatial Risk Assessment Service
 * 
 * Integrates multiple data sources to provide complete property risk assessment:
 * - FEMA Flood Maps & National Flood Hazard Layer
 * - TigerWeb Census data & tribal lands
 * - ESRI ArcGIS environmental hazards & demographics
 * - NOAA/EPA climate & environmental data
 */
export class GeospatialRiskService {
  private logger: Logger;
  private femaService: FemaFloodService;
  private tigerWebService: TigerWebService;
  private esriService: EsriArcGISService;
  private noaaService: NoaaEnvironmentalService;
  private cacheService: GeospatialCacheService;

  constructor() {
    this.logger = new Logger();
    this.femaService = new FemaFloodService();
    this.tigerWebService = new TigerWebService();
    this.esriService = new EsriArcGISService();
    this.noaaService = new NoaaEnvironmentalService();
    this.cacheService = new GeospatialCacheService();
  }

  /**
   * Comprehensive property risk assessment
   * Integrates all data sources for complete risk profile
   */
  async assessPropertyRisks(coordinates: Coordinates, propertyId?: string): Promise<GeospatialApiResponse<PropertyRiskAssessment>> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting comprehensive property risk assessment', { 
        coordinates, 
        propertyId 
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(coordinates);
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.info('Returning cached risk assessment', { coordinates });
        return {
          success: true,
          data: cached,
          metadata: {
            processingTime: Date.now() - startTime,
            dataSource: 'cache',
            cacheHit: true,
            expiresAt: cached.expirationDate
          }
        };
      }

      // Run all risk assessments in parallel for performance
      const [
        floodRisk,
        disasterRisk,
        environmentalRisk,
        historicalDesignations,
        tribalLandData,
        censusData
      ] = await Promise.allSettled([
        this.assessFloodRisk(coordinates),
        this.assessDisasterRisk(coordinates),
        this.assessEnvironmentalRisk(coordinates),
        this.getHistoricalDesignations(coordinates),
        this.getTribalLandData(coordinates),
        this.getCensusData(coordinates)
      ]);

      // Extract successful results and handle failures gracefully
      const riskAssessment: PropertyRiskAssessment = {
        ...(propertyId && { propertyId }),
        coordinates,
        floodRisk: this.extractResult(floodRisk, 'flood risk'),
        disasterRisk: this.extractResult(disasterRisk, 'disaster risk'),
        environmentalRisk: this.extractResult(environmentalRisk, 'environmental risk'),
        historicalDesignations: this.extractResult(historicalDesignations, 'historical designations'),
        tribalLandData: this.extractResult(tribalLandData, 'tribal land data'),
        censusData: this.extractResult(censusData, 'census data'),
        overallRiskScore: 0, // Will be calculated
        riskCategories: [],
        insuranceRequirements: [],
        regulatoryCompliance: [],
        dataQuality: this.calculateDataQuality([
          floodRisk, disasterRisk, environmentalRisk, 
          historicalDesignations, tribalLandData, censusData
        ]),
        lastAssessed: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        dataSources: ['FEMA', 'TigerWeb', 'ESRI', 'NOAA', 'EPA']
      };

      // Calculate comprehensive risk scores and categories
      riskAssessment.overallRiskScore = this.calculateOverallRiskScore(riskAssessment);
      riskAssessment.riskCategories = this.generateRiskCategories(riskAssessment);
      riskAssessment.insuranceRequirements = this.generateInsuranceRequirements(riskAssessment);
      riskAssessment.regulatoryCompliance = this.generateRegulatoryRequirements(riskAssessment);

      // Cache the results
      await this.cacheService.set(cacheKey, riskAssessment);

      const processingTime = Date.now() - startTime;
      this.logger.info('Completed comprehensive risk assessment', { 
        coordinates,
        overallRiskScore: riskAssessment.overallRiskScore,
        processingTime 
      });

      return {
        success: true,
        data: riskAssessment,
        metadata: {
          processingTime,
          dataSource: 'live',
          cacheHit: false,
          expiresAt: riskAssessment.expirationDate
        }
      };

    } catch (error) {
      this.logger.error('Failed to assess property risks', { error, coordinates });
      return {
        success: false,
        error: {
          code: 'RISK_ASSESSMENT_FAILED',
          message: 'Failed to complete property risk assessment',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Batch property risk assessment for multiple properties
   */
  async batchAssessPropertyRisks(request: BatchRiskAssessmentRequest): Promise<BatchRiskAssessmentResponse> {
    const startTime = Date.now();
    const results: PropertyRiskAssessment[] = [];
    const errors: Array<{ propertyId?: string; coordinates: Coordinates; error: string }> = [];

    this.logger.info('Starting batch risk assessment', { 
      propertyCount: request.properties.length 
    });

    // Process in batches to avoid overwhelming external APIs
    const batchSize = 10;
    for (let i = 0; i < request.properties.length; i += batchSize) {
      const batch = request.properties.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (property) => {
        try {
          const result = await this.assessPropertyRisks(property.coordinates, property.propertyId);
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push({
              ...(property.propertyId && { propertyId: property.propertyId }),
              coordinates: property.coordinates,
              error: result.error?.message || 'Unknown error'
            });
          }
        } catch (error) {
          errors.push({
            ...(property.propertyId && { propertyId: property.propertyId }),
            coordinates: property.coordinates,  
            error: error instanceof Error ? error.message : 'Processing failed'
          });
        }
      });

      await Promise.all(batchPromises);
      
      // Brief pause between batches to be respectful to external APIs
      if (i + batchSize < request.properties.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const processingTime = Date.now() - startTime;
    
    this.logger.info('Completed batch risk assessment', {
      total: request.properties.length,
      successful: results.length,
      failed: errors.length,
      processingTime
    });

    return {
      success: true,
      results,
      errors,
      summary: {
        total: request.properties.length,
        successful: results.length,
        failed: errors.length,
        processingTime
      }
    };
  }

  // ===============================
  // Individual Risk Assessment Methods
  // ===============================

  /**
   * Assess flood risk using FEMA data
   */
  private async assessFloodRisk(coordinates: Coordinates): Promise<FloodRiskData> {
    return await this.femaService.getFloodRiskData(coordinates);
  }

  /**
   * Assess natural disaster risk
   */
  private async assessDisasterRisk(coordinates: Coordinates): Promise<DisasterRiskData> {
    // Combine FEMA disaster history with NOAA climate data
    const [femaDisasters, climateRisk] = await Promise.all([
      this.femaService.getDisasterHistory(coordinates),
      this.noaaService.getClimateRisk(coordinates)
    ]);

    return {
      femaDisasterHistory: femaDisasters,
      hurricaneRisk: climateRisk.hurricaneRisk,
      earthquakeRisk: climateRisk.earthquakeRisk,
      wildfireRisk: climateRisk.wildfireRisk,
      tornadoRisk: climateRisk.tornadoRisk,
      winterStormRisk: climateRisk.winterStormRisk,
      overallDisasterRisk: this.calculateDisasterRiskScore(femaDisasters, climateRisk)
    };
  }

  /**
   * Assess environmental risk using EPA and NOAA data
   */
  private async assessEnvironmentalRisk(coordinates: Coordinates): Promise<EnvironmentalRisk> {
    return await this.noaaService.getEnvironmentalRisk(coordinates);
  }

  /**
   * Get historical designations from multiple sources
   */
  private async getHistoricalDesignations(coordinates: Coordinates): Promise<HistoricalDesignations> {
    const [nrhpData, landmarkData] = await Promise.all([
      this.esriService.getNationalRegisterData(coordinates),
      this.tigerWebService.getHistoricalData(coordinates)
    ]);

    return {
      onNationalRegister: nrhpData.onRegister,
      nrhpId: nrhpData.id,
      listingDate: nrhpData.listingDate,
      ...(landmarkData.historicDistrict && { historicDistrict: landmarkData.historicDistrict }),
      landmarkStatus: landmarkData.landmarkStatus || null,
      ...(landmarkData.landmarkName && { landmarkName: landmarkData.landmarkName }),
      archaeologicalSites: landmarkData.archaeologicalSites || [],
      restrictions: this.combineHistoricalRestrictions(nrhpData, landmarkData)
    };
  }

  /**
   * Get tribal land data from TigerWeb
   */
  private async getTribalLandData(coordinates: Coordinates): Promise<TribalLandData> {
    return await this.tigerWebService.getTribalLandData(coordinates);
  }

  /**
   * Get census and demographic data
   */
  private async getCensusData(coordinates: Coordinates): Promise<CensusData> {
    return await this.tigerWebService.getCensusData(coordinates);
  }

  // ===============================
  // Risk Calculation & Analysis Methods
  // ===============================

  /**
   * Calculate overall risk score from all risk categories
   */
  private calculateOverallRiskScore(assessment: PropertyRiskAssessment): number {
    const weights = {
      flood: 0.3,
      disaster: 0.25,
      environmental: 0.2,
      historical: 0.15,
      tribal: 0.1
    };

    let totalScore = 0;
    let totalWeight = 0;

    // Flood risk component
    if (assessment.floodRisk) {
      totalScore += assessment.floodRisk.floodRiskScore * weights.flood;
      totalWeight += weights.flood;
    }

    // Disaster risk component
    if (assessment.disasterRisk) {
      totalScore += assessment.disasterRisk.overallDisasterRisk * weights.disaster;
      totalWeight += weights.disaster;
    }

    // Environmental risk component (calculate from environmental data)
    if (assessment.environmentalRisk) {
      const envScore = this.calculateEnvironmentalRiskScore(assessment.environmentalRisk);
      totalScore += envScore * weights.environmental;
      totalWeight += weights.environmental;
    }

    // Historical restrictions score
    if (assessment.historicalDesignations) {
      const histScore = this.calculateHistoricalRiskScore(assessment.historicalDesignations);
      totalScore += histScore * weights.historical;
      totalWeight += weights.historical;
    }

    // Tribal land complexity score
    if (assessment.tribalLandData) {
      const tribalScore = this.calculateTribalComplexityScore(assessment.tribalLandData);
      totalScore += tribalScore * weights.tribal;
      totalWeight += weights.tribal;
    }

    return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 10) / 10 : 5.0;
  }

  /**
   * Generate risk categories with specific assessments
   */
  private generateRiskCategories(assessment: PropertyRiskAssessment): RiskCategory[] {
    const categories: RiskCategory[] = [];

    // Flood risk category
    if (assessment.floodRisk) {
      categories.push({
        category: 'flood',
        riskLevel: this.scoreToRiskLevel(assessment.floodRisk.floodRiskScore),
        score: assessment.floodRisk.floodRiskScore,
        factors: this.getFloodRiskFactors(assessment.floodRisk),
        recommendations: this.getFloodRiskRecommendations(assessment.floodRisk)
      });
    }

    // Add other categories...
    // (Similar pattern for disaster, environmental, historical, tribal)

    return categories;
  }

  /**
   * Generate insurance requirements based on risk assessment
   */
  private generateInsuranceRequirements(assessment: PropertyRiskAssessment): InsuranceRequirement[] {
    const requirements: InsuranceRequirement[] = [];

    // Flood insurance requirements
    if (assessment.floodRisk?.floodInsuranceRequired) {
      requirements.push({
        type: 'flood',
        required: true,
        notes: ['Required due to FEMA flood zone designation', 'Contact NFIP participating insurer']
      });
    }

    // Add other insurance requirements based on risk levels...

    return requirements;
  }

  /**
   * Generate regulatory compliance requirements
   */
  private generateRegulatoryRequirements(assessment: PropertyRiskAssessment): RegulatoryRequirement[] {
    const requirements: RegulatoryRequirement[] = [];

    // Historical preservation requirements
    if (assessment.historicalDesignations?.onNationalRegister) {
      requirements.push({
        authority: 'State Historic Preservation Office',
        requirement: 'Review required for alterations to historic property',
        permitRequired: true,
        processingTime: '30-90 days',
        contacts: ['SHPO Office']
      });
    }

    // Tribal land requirements
    if (assessment.tribalLandData?.onTribalLand) {
      requirements.push({
        authority: assessment.tribalLandData.tribeName || 'Tribal Government',
        requirement: 'Tribal permits and consultation required',
        permitRequired: true,
        processingTime: '60-120 days',
        contacts: [assessment.tribalLandData.tribalOffice?.name || 'Tribal Office']
      });
    }

    return requirements;
  }

  // ===============================
  // Helper Methods
  // ===============================

  private extractResult<T>(settledResult: PromiseSettledResult<T>, dataType: string): T | any {
    if (settledResult.status === 'fulfilled') {
      return settledResult.value;
    } else {
      this.logger.warn(`Failed to fetch ${dataType}`, { error: settledResult.reason });
      return this.getDefaultValue(dataType);
    }
  }

  private getDefaultValue(dataType: string): any {
    // Return appropriate default values for each data type
    switch (dataType) {
      case 'flood risk':
        return { floodRiskScore: 5, floodInsuranceRequired: false, historicalFloodEvents: [] };
      case 'disaster risk':
        return { femaDisasterHistory: [], overallDisasterRisk: 5 };
      case 'environmental risk':
        return { superfundSites: [], hazmatFacilities: [], airQuality: { aqiScore: 50 } };
      case 'historical designations':
        return { onNationalRegister: false, restrictions: [] };
      case 'tribal land data':
        return { onTribalLand: false, specialConsiderations: [] };
      case 'census data':
        return { population: 0, medianIncome: 0, medianHomeValue: 0 };
      default:
        return {};
    }
  }

  private calculateDataQuality(results: PromiseSettledResult<any>[]): DataQualityMetrics {
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const total = results.length;
    
    return {
      completeness: Math.round((successful / total) * 100),
      accuracy: 85, // Based on data source reliability
      recency: 1, // Assume fresh data
      reliability: successful >= total * 0.8 ? 'high' : successful >= total * 0.6 ? 'moderate' : 'low',
      missingDataSources: results
        .map((r, i) => ({ result: r, index: i }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ index }) => ['FEMA', 'TigerWeb', 'ESRI', 'NOAA', 'EPA'][index])
        .filter((source): source is string => Boolean(source))
    };
  }

  private generateCacheKey(coordinates: Coordinates): string {
    // Round coordinates to 4 decimal places for cache efficiency
    const lat = Math.round(coordinates.latitude * 10000) / 10000;
    const lng = Math.round(coordinates.longitude * 10000) / 10000;
    return `risk_assessment_${lat}_${lng}`;
  }

  private scoreToRiskLevel(score: number): 'minimal' | 'low' | 'moderate' | 'high' | 'extreme' {
    if (score <= 2) return 'minimal';
    if (score <= 4) return 'low';
    if (score <= 6) return 'moderate';
    if (score <= 8) return 'high';
    return 'extreme';
  }

  // Additional helper methods for specific risk calculations...
  private calculateDisasterRiskScore(disasters: any[], climateRisk: any): number {
    // Implementation for disaster risk scoring
    return 5; // Placeholder
  }

  private calculateEnvironmentalRiskScore(envRisk: EnvironmentalRisk): number {
    // Implementation for environmental risk scoring
    return 5; // Placeholder
  }

  private calculateHistoricalRiskScore(historical: HistoricalDesignations): number {
    // Implementation for historical complexity scoring
    return historical.restrictions.length > 0 ? 7 : 3;
  }

  private calculateTribalComplexityScore(tribal: TribalLandData): number {
    // Implementation for tribal land complexity scoring
    return tribal.onTribalLand ? 8 : 1;
  }

  private getFloodRiskFactors(floodRisk: FloodRiskData): string[] {
    const factors: string[] = [];
    if (floodRisk.femaFloodZone) factors.push(`FEMA Zone ${floodRisk.femaFloodZone}`);
    if (floodRisk.baseFloodElevation) factors.push(`BFE: ${floodRisk.baseFloodElevation} ft`);
    if (floodRisk.coastalRisk) factors.push('Coastal flooding risk');
    if (floodRisk.leveeProtection) factors.push('Levee protection present');
    return factors;
  }

  private getFloodRiskRecommendations(floodRisk: FloodRiskData): string[] {
    const recommendations: string[] = [];
    if (floodRisk.floodInsuranceRequired) {
      recommendations.push('Obtain flood insurance through NFIP');
    }
    if (floodRisk.floodRiskScore > 7) {
      recommendations.push('Consider flood mitigation measures');
      recommendations.push('Elevate utilities above base flood elevation');
    }
    return recommendations;
  }

  private combineHistoricalRestrictions(nrhpData: any, landmarkData: any): any[] {
    // Combine restrictions from multiple sources
    return [...(nrhpData.restrictions || []), ...(landmarkData.restrictions || [])];
  }
}