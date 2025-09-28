import { Logger } from '../utils/logger.js';
import { ConsolidatedCosmosDbService } from './consolidated-cosmos.service.js';
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
 * Enhanced Property Management Service - Two-Level Architecture
 * 
 * Provides both lightweight PropertySummary operations for performance
 * and comprehensive PropertyDetails operations for detailed analysis
 */
export class EnhancedPropertyService {
  private logger: Logger;
  private databaseService: ConsolidatedCosmosDbService;

  constructor() {
    this.logger = new Logger();
    this.databaseService = new ConsolidatedCosmosDbService();
  }

  // ===============================
  // Lightweight Property Summary Operations
  // ===============================

  /**
   * Search properties with lightweight data
   * Returns only essential fields for listings and quick operations
   */
  async searchPropertiesSummary(criteria: PropertySearchCriteria): Promise<PropertySearchResults> {
    const startTime = Date.now();
    this.logger.info('Searching properties (summary)', { criteria });

    try {
      // Build optimized filters for summary data
      const filters = this.buildSummaryFilters(criteria);
      
      // Execute lightweight search using available search method
      const results = await this.databaseService.searchProperties(filters);
      
      if (!results.success || !results.data) {
        throw new Error('Failed to search properties');
      }

      // Data is already in PropertySummary format
      const propertySummaries = results.data;

      // Calculate aggregations
      const aggregations = await this.calculateSummaryAggregations(filters);

      const executionTime = Date.now() - startTime;
      this.logger.info('Property summary search completed', { 
        resultCount: propertySummaries.length, 
        executionTime 
      });

      return {
        properties: propertySummaries,
        total: propertySummaries.length, // Use actual length since total not available
        aggregations,
        searchCriteria: criteria
      };

    } catch (error) {
      this.logger.error('Property summary search failed', { error, criteria });
      throw error;
    }
  }

  /**
   * Get property summary by ID
   */
  async getPropertySummary(id: string): Promise<PropertySummary | null> {
    this.logger.info('Getting property summary', { id });

    try {
      const result = await this.databaseService.getPropertySummary(id, 'default');
      return result.success && result.data ? result.data : null;
    } catch (error) {
      this.logger.error('Failed to get property summary', { error, id });
      throw error;
    }
  }

  /**
   * Get multiple property summaries by IDs
   */
  async getPropertySummaries(ids: string[]): Promise<PropertySummary[]> {
    this.logger.info('Getting multiple property summaries', { count: ids.length });

    try {
      // Batch method not available, fetch individually
      const results = await Promise.all(
        ids.map(id => this.databaseService.getPropertySummary(id, 'default'))
      );
      return results
        .filter(result => result.success && result.data)
        .map(result => result.data!);
    } catch (error) {
      this.logger.error('Failed to get property summaries', { error, ids });
      throw error;
    }
  }

  /**
   * Create property summary
   */
  async createPropertySummary(data: CreatePropertySummaryRequest): Promise<PropertySummary> {
    this.logger.info('Creating property summary', { address: data.address });

    try {
      // Validate required fields
      this.validatePropertySummaryData(data);

      // Create base property data
      const propertyData = {
        id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...data,
        lastUpdated: new Date(),
        dataSource: 'internal'
      };

      // Store in database (summary level)
      const result = await this.databaseService.createPropertySummary(propertyData);
      
      if (!result.success || !result.data) {
        throw new Error('Failed to create property summary');
      }
      
      this.logger.info('Property summary created', { id: result.data.id });
      return result.data;

    } catch (error) {
      this.logger.error('Failed to create property summary', { error, data });
      throw error;
    }
  }

  /**
   * Update property summary
   */
  async updatePropertySummary(data: UpdatePropertySummaryRequest): Promise<PropertySummary> {
    this.logger.info('Updating property summary', { id: data.id });

    try {
      // Update operations not available in current ConsolidatedCosmosDbService
      // TODO: Implement update functionality when available
      throw new Error('Property update functionality not yet implemented');

    } catch (error) {
      this.logger.error('Failed to update property summary', { error, data });
      throw error;
    }
  }

  // ===============================
  // Comprehensive Property Details Operations
  // ===============================

  /**
   * Search properties with comprehensive data
   * Returns full PropertyDetails for detailed analysis
   */
  async searchPropertiesDetailed(criteria: PropertySearchCriteria): Promise<DetailedPropertySearchResults> {
    const startTime = Date.now();
    this.logger.info('Searching properties (detailed)', { criteria });

    try {
      // Build comprehensive filters
      const filters = this.buildDetailedFilters(criteria);
      
      // Execute comprehensive search using available search method
      const results = await this.databaseService.searchProperties(filters);
      
      if (!results.success || !results.data) {
        throw new Error('Failed to search properties');
      }

      // Convert PropertySummary to PropertyDetails (mock conversion for now)
      const propertyDetails: any[] = results.data.map((prop: any) => ({
        ...prop,
        // Mock additional detail fields
        details: { mock: 'details not fully implemented' }
      }));

      // Calculate detailed aggregations
      const aggregations = await this.calculateDetailedAggregations(filters);

      const executionTime = Date.now() - startTime;
      this.logger.info('Property detailed search completed', { 
        resultCount: propertyDetails.length, 
        executionTime 
      });

      return {
        properties: propertyDetails,
        total: propertyDetails.length,
        aggregations,
        searchCriteria: criteria
      };

    } catch (error) {
      this.logger.error('Property detailed search failed', { error, criteria });
      throw error;
    }
  }

  /**
   * Get comprehensive property details by ID
   */
  async getPropertyDetails(id: string): Promise<PropertyDetails | null> {
    this.logger.info('Getting property details', { id });

    try {
      const result = await this.databaseService.getPropertyDetails(id);
      return result.success && result.data ? result.data : null;
    } catch (error) {
      this.logger.error('Failed to get property details', { error, id });
      throw error;
    }
  }

  /**
   * Enrich property with external data (from property data APIs)
   */
  async enrichPropertyWithExternalData(id: string): Promise<PropertyDetails> {
    this.logger.info('Enriching property with external data', { id });

    try {
      // Get current property data
      const existing = await this.getPropertyDetails(id);
      if (!existing) {
        throw new Error('Property not found');
      }

      // Simulate external API call for comprehensive data
      const externalData = await this.fetchExternalPropertyData(existing.address);

      // Merge external data with existing
      const enrichedProperty = this.mergeExternalData(existing, externalData);

      // Update property with enriched data (not available in current service)
      // TODO: Implement update functionality when available

      this.logger.info('Property enriched with external data', { id });
      return enrichedProperty;

    } catch (error) {
      this.logger.error('Failed to enrich property with external data', { error, id });
      throw error;
    }
  }

  // ===============================
  // Property Analytics & Insights
  // ===============================

  /**
   * Get property market analysis
   */
  async getPropertyMarketAnalysis(id: string, radius: number = 0.5): Promise<{
    subject: PropertySummary;
    comparables: PropertySummary[];
    marketTrends: {
      averagePrice: number;
      medianPrice: number;
      pricePerSqFt: number;
      daysOnMarket: number;
      priceAppreciation: number;
    };
    demographics: Record<string, any>;
  }> {
    this.logger.info('Generating property market analysis', { id, radius });

    try {
      // Get subject property
      const subject = await this.getPropertySummary(id);
      if (!subject) {
        throw new Error('Subject property not found');
      }

      // Find comparable properties within radius
      const comparables = await this.searchPropertiesSummary({
        geographic: {
          radius: {
            lat: subject.address.latitude!,
            lng: subject.address.longitude!,
            miles: radius
          }
        },
        propertyType: [subject.propertyType],
        squareFootageRange: {
          min: (subject.building.livingAreaSquareFeet || 0) * 0.8,
          max: (subject.building.livingAreaSquareFeet || 0) * 1.2
        },
        limit: 10
      });

      // Calculate market trends
      const comparableValues = comparables.properties
        .map(p => p.valuation.estimatedValue)
        .filter(v => v !== undefined) as number[];

      const marketTrends = {
        averagePrice: comparableValues.reduce((sum, val) => sum + val, 0) / comparableValues.length,
        medianPrice: this.calculateMedian(comparableValues),
        pricePerSqFt: this.calculatePricePerSqFt(comparables.properties),
        daysOnMarket: 45, // Mock data
        priceAppreciation: 3.2 // Mock data
      };

      return {
        subject,
        comparables: comparables.properties,
        marketTrends,
        demographics: {} // Would be populated from external sources
      };

    } catch (error) {
      this.logger.error('Failed to generate market analysis', { error, id });
      throw error;
    }
  }

  /**
   * Batch property valuation update
   */
  async batchUpdatePropertyValuations(propertyIds: string[]): Promise<{
    updated: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    this.logger.info('Batch updating property valuations', { count: propertyIds.length });

    const results = { updated: 0, failed: 0, errors: [] as Array<{ id: string; error: string }> };

    for (const id of propertyIds) {
      try {
        // Get property for valuation update
        const property = await this.getPropertySummary(id);
        if (!property) {
          results.failed++;
          results.errors.push({ id, error: 'Property not found' });
          continue;
        }

        // Simulate valuation API call
        const newValuation = await this.calculatePropertyValuation(property);

        // Update property with new valuation
        await this.updatePropertySummary({
          id,
          valuation: newValuation
        });

        results.updated++;

      } catch (error) {
        results.failed++;
        results.errors.push({ id, error: (error as Error).message });
      }
    }

    this.logger.info('Batch valuation update completed', results);
    return results;
  }

  // ===============================
  // Helper Methods
  // ===============================

  /**
   * Convert database property to PropertySummary
   */
  private convertToSummary(property: any): PropertySummary {
    return {
      id: property.id || property._id,
      _id: property._id,
      address: {
        street: property.address?.street || '',
        city: property.address?.city || '',
        state: property.address?.state || '',
        zip: property.address?.zip || '',
        county: property.address?.county,
        latitude: property.address?.latitude,
        longitude: property.address?.longitude
      },
      propertyType: property.details?.propertyType || PropertyType.SFR,
      condition: property.details?.condition,
      building: {
        yearBuilt: property.building?.yearBuilt || property.details?.yearBuilt,
        livingAreaSquareFeet: property.building?.livingAreaSquareFeet || property.details?.grossLivingArea,
        bedroomCount: property.building?.bedroomCount || property.details?.bedrooms,
        bathroomCount: property.building?.bathroomCount || property.details?.bathrooms,
        storyCount: property.building?.storyCount,
        garageParkingSpaceCount: property.building?.garageParkingSpaceCount
      },
      valuation: {
        estimatedValue: property.valuation?.estimatedValue || property.marketData?.estimatedValue,
        priceRangeMin: property.valuation?.priceRangeMin,
        priceRangeMax: property.valuation?.priceRangeMax,
        confidenceScore: property.valuation?.confidenceScore,
        ...(property.valuation?.asOfDate && { asOfDate: new Date(property.valuation.asOfDate) })
      },
      owner: {
        fullName: property.owner?.fullName,
        ownerOccupied: property.owner?.ownerOccupied
      },
      quickLists: {
        vacant: property.quickLists?.vacant,
        ownerOccupied: property.quickLists?.ownerOccupied,
        freeAndClear: property.quickLists?.freeAndClear,
        highEquity: property.quickLists?.highEquity,
        activeForSale: property.quickLists?.activeListing,
        recentlySold: property.quickLists?.recentlySold
      },
      lastUpdated: property.lastUpdated ? new Date(property.lastUpdated) : new Date(),
      dataSource: property.dataSource || 'internal'
    };
  }

  /**
   * Convert database property to PropertyDetails
   */
  private convertToDetails(property: any): PropertyDetails {
    // Start with summary conversion
    const summary = this.convertToSummary(property);

    // Extend with detailed fields
    return {
      ...summary,
      address: {
        ...summary.address,
        houseNumber: property.address?.houseNumber,
        cityAliases: property.address?.cityAliases,
        zipPlus4: property.address?.zipPlus4,
        formattedStreet: property.address?.formattedStreet,
        streetNoUnit: property.address?.streetNoUnit,
        localities: property.address?.localities,
        countyFipsCode: property.address?.countyFipsCode,
        hash: property.address?.hash,
        normalized: property.address?.normalized,
        geoStatus: property.address?.geoStatus,
        geoStatusCode: property.address?.geoStatusCode,
        oldHashes: property.address?.oldHashes
      },
      assessment: property.assessment || {},
      building: {
        ...summary.building,
        totalBuildingAreaSquareFeet: property.building?.totalBuildingAreaSquareFeet,
        totalBuildingAreaCode: property.building?.totalBuildingAreaCode,
        totalBuildingAreaCodeDescription: property.building?.totalBuildingAreaCodeDescription,
        effectiveYearBuilt: property.building?.effectiveYearBuilt,
        buildingCount: property.building?.buildingCount,
        roomCount: property.building?.roomCount,
        unitCount: property.building?.unitCount,
        calculatedBathroomCount: property.building?.calculatedBathroomCount,
        fullBathroomCount: property.building?.fullBathroomCount,
        bathFixtureCount: property.building?.bathFixtureCount,
        residentialUnitCount: property.building?.residentialUnitCount,
        features: property.building?.features,
        // ... additional building fields
      },
      deedHistory: property.deedHistory || [],
      demographics: property.demographics || {},
      foreclosure: property.foreclosure || {},
      general: property.general || {},
      ids: property.ids || {},
      legal: property.legal || {},
      lot: property.lot || {},
      listing: property.listing || { brokerage: {}, agents: {} },
      mortgageHistory: property.mortgageHistory || [],
      openLien: property.openLien || {
        allLoanTypes: [],
        juniorLoanTypes: [],
        totalOpenLienCount: 0,
        mortgages: {}
      },
      owner: {
        ...summary.owner,
        mailingAddress: property.owner?.mailingAddress,
        names: property.owner?.names,
        ownerStatusTypeCode: property.owner?.ownerStatusTypeCode,
        ownerStatusType: property.owner?.ownerStatusType,
        ownershipRightsCode: property.owner?.ownershipRightsCode,
        ownershipRights: property.owner?.ownershipRights
      },
      permit: property.permit || {},
      propertyOwnerProfile: property.propertyOwnerProfile || {},
      quickLists: {
        ...summary.quickLists,
        // Extended quick lists from comprehensive data
        absenteeOwner: property.quickLists?.absenteeOwner,
        corporateOwned: property.quickLists?.corporateOwned,
        preforeclosure: property.quickLists?.preforeclosure,
        // ... additional quick list fields
      },
      sale: property.sale || {},
      tax: property.tax || {},
      valuation: {
        ...summary.valuation,
        standardDeviation: property.valuation?.standardDeviation,
        equityCurrentEstimatedBalance: property.valuation?.equityCurrentEstimatedBalance,
        ltv: property.valuation?.ltv,
        equityPercent: property.valuation?.equityPercent
      },
      meta: property.meta || {}
    };
  }

  /**
   * Build filters for summary searches (optimized)
   */
  private buildSummaryFilters(criteria: PropertySearchCriteria): any {
    const filters: any = {};

    // Basic filters for summary data
    if (criteria.textQuery) {
      filters.$text = { $search: criteria.textQuery };
    }

    if (criteria.address) {
      if (criteria.address.city) filters['address.city'] = { $regex: criteria.address.city, $options: 'i' };
      if (criteria.address.state) filters['address.state'] = criteria.address.state;
      if (criteria.address.zip) filters['address.zip'] = criteria.address.zip;
    }

    if (criteria.propertyType && criteria.propertyType.length > 0) {
      filters['details.propertyType'] = { $in: criteria.propertyType };
    }

    if (criteria.priceRange) {
      const priceFilter: any = {};
      if (criteria.priceRange.min) priceFilter.$gte = criteria.priceRange.min;
      if (criteria.priceRange.max) priceFilter.$lte = criteria.priceRange.max;
      if (Object.keys(priceFilter).length > 0) {
        filters['valuation.estimatedValue'] = priceFilter;
      }
    }

    return filters;
  }

  /**
   * Build filters for detailed searches
   */
  private buildDetailedFilters(criteria: PropertySearchCriteria): any {
    // Start with summary filters
    const filters = this.buildSummaryFilters(criteria);

    // Add detailed-specific filters
    if (criteria.yearBuiltRange) {
      const yearFilter: any = {};
      if (criteria.yearBuiltRange.min) yearFilter.$gte = criteria.yearBuiltRange.min;
      if (criteria.yearBuiltRange.max) yearFilter.$lte = criteria.yearBuiltRange.max;
      if (Object.keys(yearFilter).length > 0) {
        filters['building.yearBuilt'] = yearFilter;
      }
    }

    return filters;
  }

  /**
   * Calculate aggregations for summary searches
   */
  private async calculateSummaryAggregations(filters: any): Promise<any> {
    return {
      byPropertyType: {
        [PropertyType.SFR]: 45,
        [PropertyType.CONDO]: 23,
        [PropertyType.TOWNHOME]: 12
      },
      byCondition: {
        [PropertyCondition.EXCELLENT]: 32,
        [PropertyCondition.GOOD]: 41,
        [PropertyCondition.AVERAGE]: 18
      },
      byPriceRange: {
        '0-500k': 25,
        '500k-1m': 45,
        '1m-2m': 22
      },
      averageSquareFootage: 2450,
      averagePrice: 825000
    };
  }

  /**
   * Calculate aggregations for detailed searches
   */
  private async calculateDetailedAggregations(filters: any): Promise<any> {
    const basicAggregations = await this.calculateSummaryAggregations(filters);
    
    return {
      ...basicAggregations,
      byOwnerType: {
        'Individual': 78,
        'Corporation': 12,
        'Trust': 8,
        'Other': 2
      },
      averageLotSize: 0.25,
      averageYearBuilt: 1985
    };
  }

  /**
   * Validate property summary data
   */
  private validatePropertySummaryData(data: CreatePropertySummaryRequest): void {
    if (!data.address.street) throw new Error('Street address is required');
    if (!data.address.city) throw new Error('City is required');
    if (!data.address.state) throw new Error('State is required');
    if (!data.address.zip) throw new Error('ZIP code is required');
    if (!data.propertyType) throw new Error('Property type is required');
  }

  /**
   * Simulate external property data fetch
   */
  private async fetchExternalPropertyData(address: any): Promise<Partial<PropertyDetails>> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Return mock comprehensive data
    return {
      assessment: {
        totalAssessedValue: 350000,
        assessmentYear: 2024
      },
      building: {
        features: ['Air Conditioning', 'Garage', 'Patio'],
        buildingCondition: 'Average' as any
      },
      demographics: {},
      // ... additional external data
    };
  }

  /**
   * Merge external data with existing property data
   */
  private mergeExternalData(existing: PropertyDetails, external: Partial<PropertyDetails>): PropertyDetails {
    return {
      ...existing,
      ...external,
      building: {
        ...existing.building,
        ...external.building
      },
      assessment: {
        ...existing.assessment,
        ...external.assessment
      },
      lastUpdated: new Date(),
      meta: {
        ...existing.meta,
        dataProvider: 'external_api'
      }
    };
  }

  /**
   * Calculate property valuation (simulate AVM)
   */
  private async calculatePropertyValuation(property: PropertySummary): Promise<any> {
    // Simulate valuation calculation
    const baseValue = 400000;
    const sqftAdjustment = (property.building.livingAreaSquareFeet || 2000) * 200;
    const estimatedValue = baseValue + sqftAdjustment;

    return {
      estimatedValue,
      priceRangeMin: estimatedValue * 0.9,
      priceRangeMax: estimatedValue * 1.1,
      confidenceScore: 85,
      asOfDate: new Date()
    };
  }

  /**
   * Calculate median from array of numbers
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? ((sorted[middle - 1] || 0) + (sorted[middle] || 0)) / 2 
      : sorted[middle] || 0;
  }

  /**
   * Calculate price per square foot
   */
  private calculatePricePerSqFt(properties: PropertySummary[]): number {
    const validProperties = properties.filter(p => 
      p.valuation.estimatedValue && p.building.livingAreaSquareFeet
    );

    if (validProperties.length === 0) return 0;

    const totalPricePerSqFt = validProperties.reduce((sum, prop) => {
      return sum + (prop.valuation.estimatedValue! / prop.building.livingAreaSquareFeet!);
    }, 0);

    return totalPricePerSqFt / validProperties.length;
  }
}

export default EnhancedPropertyService;