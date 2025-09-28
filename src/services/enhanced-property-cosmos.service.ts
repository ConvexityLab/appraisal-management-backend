import { Logger } from '../utils/logger.js';
import CosmosDbDatabaseService from './cosmos-database.service.js';
import { 
  PropertySummary, 
  PropertyDetails, 
  PropertySearchCriteria, 
  PropertySearchResults, 
  DetailedPropertySearchResults,
  CreatePropertySummaryRequest,
  UpdatePropertySummaryRequest,
  PropertyType,
  PropertyCondition
} from '../types/property-enhanced.js';

/**
 * Enhanced Property Management Service - Two-Level Architecture (Cosmos DB)
 * 
 * Provides both lightweight PropertySummary operations for performance
 * and comprehensive PropertyDetails operations for detailed analysis
 */
export class EnhancedPropertyService {
  private logger: Logger;
  private databaseService: CosmosDbDatabaseService;

  constructor() {
    this.logger = new Logger();
    this.databaseService = new CosmosDbDatabaseService();
  }

  /**
   * Initialize the service (connect to database)
   */
  async initialize(): Promise<void> {
    await this.databaseService.connect();
  }

  // ===============================
  // PropertySummary Operations (Lightweight)
  // ===============================

  /**
   * Search property summaries with lightweight data
   */
  async searchPropertiesSummary(criteria: PropertySearchCriteria): Promise<PropertySearchResults> {
    try {
      this.logger.info('Searching property summaries', { criteria });

      const searchCriteria = this.buildSearchCriteria(criteria);
      const results = await this.databaseService.searchPropertySummaries(
        searchCriteria,
        0,
        criteria.limit || 50
      );

      return {
        properties: results.properties,
        total: results.total,
        aggregations: await this.buildAggregations(criteria),
        searchCriteria: criteria,
        // executionTime: Date.now() - Date.now() // TODO: implement proper timing - property doesn't exist
      };

    } catch (error) {
      this.logger.error('Failed to search property summaries', { error, criteria });
      throw new Error(`Property search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a single property summary by ID
   */
  async getPropertySummary(id: string): Promise<PropertySummary | null> {
    try {
      this.logger.info('Getting property summary', { id });

      const property = await this.databaseService.findPropertySummaryById(id);
      return property;

    } catch (error) {
      this.logger.error('Failed to get property summary', { error, id });
      throw new Error(`Failed to get property: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get multiple property summaries by IDs
   */
  async getPropertySummaries(ids: string[]): Promise<PropertySummary[]> {
    try {
      this.logger.info('Getting property summaries', { count: ids.length });

      const properties = await Promise.all(
        ids.map(id => this.databaseService.findPropertySummaryById(id))
      );

      return properties.filter((p): p is PropertySummary => p !== null);

    } catch (error) {
      this.logger.error('Failed to get property summaries', { error, ids });
      throw new Error(`Failed to get properties: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new property summary
   */
  async createPropertySummary(property: CreatePropertySummaryRequest): Promise<PropertySummary> {
    try {
      this.logger.info('Creating property summary', { address: property.address.street });

      const createdProperty = await this.databaseService.createPropertySummary(property);
      
      this.logger.info('Property summary created successfully', { id: createdProperty.id });
      return createdProperty;

    } catch (error) {
      this.logger.error('Failed to create property summary', { error, property });
      throw new Error(`Failed to create property: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing property summary
   */
  async updatePropertySummary(data: UpdatePropertySummaryRequest): Promise<PropertySummary> {
    try {
      this.logger.info('Updating property summary', { id: data.id });

      const existing = await this.databaseService.findPropertySummaryById(data.id);
      if (!existing) {
        throw new Error(`Property not found: ${data.id}`);
      }

      const updateData = {
        ...existing,
        ...data,
        lastUpdated: new Date()
      };

      // Note: For Cosmos DB, we need to replace the entire document
      // This is a simplified version - in production, you'd use the Cosmos update methods
      const updatedProperty = await this.databaseService.createPropertySummary(updateData);
      
      this.logger.info('Property summary updated successfully', { id: data.id });
      return updatedProperty;

    } catch (error) {
      this.logger.error('Failed to update property summary', { error, data });
      throw new Error(`Failed to update property: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===============================
  // PropertyDetails Operations (Comprehensive)
  // ===============================

  /**
   * Search property details with comprehensive data
   */
  async searchPropertiesDetailed(criteria: PropertySearchCriteria): Promise<DetailedPropertySearchResults> {
    try {
      this.logger.info('Searching property details', { criteria });

      // For now, we'll use the summary search and then enrich the data
      // In production, you'd have a separate detailed search
      const summaryResults = await this.searchPropertiesSummary(criteria);
      
      const enrichedProperties: PropertyDetails[] = await Promise.all(
        summaryResults.properties.map(async (summary) => {
          const details = await this.convertSummaryToDetails(summary);
          return details;
        })
      );

      return {
        properties: enrichedProperties,
        total: summaryResults.total,
        aggregations: {
          byPropertyType: summaryResults.aggregations?.byPropertyType || {},
          byCondition: summaryResults.aggregations?.byCondition || {},
          byPriceRange: summaryResults.aggregations?.byPriceRange || {},
          byOwnerType: await this.aggregateByOwnerType(enrichedProperties),
          averageSquareFootage: summaryResults.aggregations?.averageSquareFootage || 0,
          averagePrice: summaryResults.aggregations?.averagePrice || 0,
          averageLotSize: 0, // Default value since not available in source
          averageYearBuilt: 0, // Default value since not available in source
          // byAssessment: await this.aggregateByAssessment(enrichedProperties) // TODO: Property doesn't exist in type
        },
        searchCriteria: criteria
        // executionTime: summaryResults.executionTime // Property doesn't exist
      };

    } catch (error) {
      this.logger.error('Failed to search property details', { error, criteria });
      throw new Error(`Detailed property search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get comprehensive property details by ID
   */
  async getPropertyDetails(id: string): Promise<PropertyDetails | null> {
    try {
      this.logger.info('Getting property details', { id });

      const summary = await this.databaseService.findPropertySummaryById(id);
      if (!summary) {
        return null;
      }

      const details = await this.convertSummaryToDetails(summary);
      return details;

    } catch (error) {
      this.logger.error('Failed to get property details', { error, id });
      throw new Error(`Failed to get property details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enrich property with external data sources
   */
  async enrichPropertyWithExternalData(id: string): Promise<PropertyDetails> {
    try {
      this.logger.info('Enriching property with external data', { id });

      const summary = await this.databaseService.findPropertySummaryById(id);
      if (!summary) {
        throw new Error(`Property not found: ${id}`);
      }

      // Simulate external data enrichment
      const externalData = await this.fetchExternalPropertyData(summary.address);
      const enrichedDetails = await this.mergeExternalData(summary, externalData);

      this.logger.info('Property enriched successfully', { id, externalDataSources: Object.keys(externalData) });
      return enrichedDetails;

    } catch (error) {
      this.logger.error('Failed to enrich property', { error, id });
      throw new Error(`Failed to enrich property: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get market analysis for a property
   */
  async getPropertyMarketAnalysis(id: string, radius: number = 1.0): Promise<any> {
    try {
      this.logger.info('Getting property market analysis', { id, radius });

      const subject = await this.getPropertyDetails(id);
      if (!subject) {
        throw new Error(`Property not found: ${id}`);
      }

      // Find comparable properties
      const comparables = await this.findComparableProperties(subject, radius);
      
      // Calculate market trends
      const marketTrends = await this.calculateMarketTrends(subject, comparables);

      return {
        subject,
        comparables,
        marketTrends,
        analysis: {
          pricePerSqFt: this.calculatePricePerSqFt(subject),
          marketPosition: this.assessMarketPosition(subject, comparables),
          recommendations: this.generateRecommendations(subject, marketTrends)
        }
      };

    } catch (error) {
      this.logger.error('Failed to get market analysis', { error, id });
      throw new Error(`Market analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch update property valuations
   */
  async batchUpdatePropertyValuations(ids: string[]): Promise<any> {
    try {
      this.logger.info('Batch updating property valuations', { count: ids.length });

      const results = {
        updated: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const id of ids) {
        try {
          const property = await this.databaseService.findPropertySummaryById(id);
          if (property) {
            // Simulate valuation update
            const newValuation = await this.calculateUpdatedValuation(property);
            property.valuation = { ...property.valuation, ...newValuation };
            
            await this.databaseService.createPropertySummary(property); // Replace document
            results.updated++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      this.logger.info('Batch valuation update completed', results);
      return results;

    } catch (error) {
      this.logger.error('Failed to batch update valuations', { error, ids });
      throw new Error(`Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ===============================
  // Private Helper Methods
  // ===============================

  private buildSearchCriteria(criteria: PropertySearchCriteria): any {
    const searchCriteria: any = {};

    if (criteria.propertyType) {
      searchCriteria.propertyType = Array.isArray(criteria.propertyType) 
        ? criteria.propertyType 
        : [criteria.propertyType];
    }

    if (criteria.address) {
      searchCriteria.address = criteria.address;
    }

    if (criteria.priceRange) {
      searchCriteria.priceRange = criteria.priceRange;
    }

    if (criteria.yearBuiltRange) {
      searchCriteria.yearBuiltRange = criteria.yearBuiltRange;
    }

    if (criteria.squareFootageRange) {
      searchCriteria.squareFootageRange = criteria.squareFootageRange;
    }

    return searchCriteria;
  }

  private async buildAggregations(criteria: PropertySearchCriteria): Promise<any> {
    // Simplified aggregations - in production, these would be calculated from the database
    return {
      byPropertyType: {
        [PropertyType.SFR]: 45,
        [PropertyType.CONDO]: 23,
        [PropertyType.TOWNHOME]: 18,
        [PropertyType.MULTI_FAMILY]: 14
      },
      byPriceRange: {
        'under_500k': 12,
        '500k_1m': 28,
        '1m_2m': 35,
        'over_2m': 25
      },
      byCondition: {
        [PropertyCondition.EXCELLENT]: 18,
        [PropertyCondition.GOOD]: 42,
        [PropertyCondition.FAIR]: 28,
        [PropertyCondition.POOR]: 8,
        // [PropertyCondition.NEEDS_REPAIR]: 4 // TODO: Check if this enum value exists
      }
    };
  }

  private async convertSummaryToDetails(summary: PropertySummary): Promise<PropertyDetails> {
    // Convert PropertySummary to PropertyDetails with enriched data
    const details: PropertyDetails = {
      ...summary,
      assessment: {
        totalAssessedValue: summary.valuation.estimatedValue || 0,
        assessmentYear: new Date().getFullYear(),
        totalMarketValue: summary.valuation.estimatedValue || 0
      },
      deedHistory: [],
      demographics: {},
      foreclosure: {},
      general: {},
      ids: {},
      legal: {},
      lot: {},
      listing: { brokerage: {}, agents: {} },
      mortgageHistory: [],
      openLien: {
        allLoanTypes: [],
        juniorLoanTypes: [],
        totalOpenLienCount: 0,
        mortgages: {}
      },
      permit: {},
      propertyOwnerProfile: {},
      sale: {},
      tax: {},
      meta: {
        propertyDateModified: new Date(),
        apiVersion: '1.0',
        dataProvider: 'internal'
      }
    };

    return details;
  }

  private async fetchExternalPropertyData(address: any): Promise<any> {
    // Simulate external API calls
    return {
      assessment: { totalAssessedValue: 450000, assessmentYear: 2024 },
      demographics: { medianIncome: 75000, populationDensity: 2500 },
      marketData: { avgSalePrice: 485000, daysOnMarket: 28 }
    };
  }

  private async mergeExternalData(summary: PropertySummary, externalData: any): Promise<PropertyDetails> {
    const details = await this.convertSummaryToDetails(summary);
    
    // Merge external data
    if (externalData.assessment) {
      details.assessment = { ...details.assessment, ...externalData.assessment };
    }
    
    if (externalData.demographics) {
      details.demographics = externalData.demographics;
    }

    return details;
  }

  private async findComparableProperties(subject: PropertyDetails, radius: number): Promise<PropertySummary[]> {
    // Simplified comparable search
    const criteria: PropertySearchCriteria = {
      propertyType: [subject.propertyType],
      address: { state: subject.address.state },
      limit: 10
    };

    const results = await this.searchPropertiesSummary(criteria);
    return results.properties.slice(0, 5); // Return top 5 comparables
  }

  private async calculateMarketTrends(subject: PropertyDetails, comparables: PropertySummary[]): Promise<any> {
    const avgPrice = comparables.reduce((sum, comp) => 
      sum + (comp.valuation.estimatedValue || 0), 0) / comparables.length;
    
    const avgSqFt = comparables.reduce((sum, comp) => 
      sum + (comp.building.livingAreaSquareFeet || 0), 0) / comparables.length;

    return {
      averagePrice: avgPrice,
      pricePerSqFt: avgPrice / avgSqFt,
      priceAppreciation: 0.05, // 5% annual appreciation
      marketVelocity: 30, // Days on market
      inventoryLevel: 'balanced'
    };
  }

  private calculatePricePerSqFt(property: PropertyDetails): number {
    const price = property.valuation.estimatedValue || 0;
    const sqft = property.building.livingAreaSquareFeet || 1;
    return price / sqft;
  }

  private assessMarketPosition(subject: PropertyDetails, comparables: PropertySummary[]): string {
    const subjectPrice = subject.valuation.estimatedValue || 0;
    const avgPrice = comparables.reduce((sum, comp) => 
      sum + (comp.valuation.estimatedValue || 0), 0) / comparables.length;

    if (subjectPrice > avgPrice * 1.1) return 'above_market';
    if (subjectPrice < avgPrice * 0.9) return 'below_market';
    return 'at_market';
  }

  private generateRecommendations(subject: PropertyDetails, trends: any): string[] {
    const recommendations: string[] = [];
    
    if (trends.priceAppreciation > 0.03) {
      recommendations.push('Strong market appreciation expected');
    }
    
    if (trends.marketVelocity < 30) {
      recommendations.push('Fast-moving market conditions');
    }
    
    recommendations.push('Consider market timing for optimal valuation');
    
    return recommendations;
  }

  private async calculateUpdatedValuation(property: PropertySummary): Promise<any> {
    // Simulate AVM calculation
    const currentValue = property.valuation.estimatedValue || 0;
    const appreciationRate = 0.05; // 5% annual
    const updatedValue = currentValue * (1 + appreciationRate);

    return {
      estimatedValue: Math.round(updatedValue),
      confidenceScore: 85,
      asOfDate: new Date(),
      valuationMethod: 'AVM'
    };
  }

  private async aggregateByOwnerType(properties: PropertyDetails[]): Promise<any> {
    return {
      ownerOccupied: properties.filter(p => p.owner.ownerOccupied).length,
      investor: properties.filter(p => !p.owner.ownerOccupied).length
    };
  }

  private async aggregateByAssessment(properties: PropertyDetails[]): Promise<any> {
    const ranges = {
      under_200k: 0,
      '200k_500k': 0,
      '500k_1m': 0,
      'over_1m': 0
    };

    properties.forEach(p => {
      const value = p.assessment?.totalAssessedValue || 0;
      if (value < 200000) ranges.under_200k++;
      else if (value < 500000) ranges['200k_500k']++;
      else if (value < 1000000) ranges['500k_1m']++;
      else ranges.over_1m++;
    });

    return ranges;
  }
}

export default EnhancedPropertyService;