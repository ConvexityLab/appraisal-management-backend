import { Logger } from '../utils/logger.js';
import { DatabaseService } from './database.service.js';
import { 
  PropertyDetails, 
  PropertyAddress, 
  PropertyType, 
  PropertyCondition, 
  ViewType, 
  ConstructionType, 
  OccupancyType 
} from '../types/index.js';

/**
 * Property Management Service
 * Handles comprehensive CRUD operations for property-related entities
 */
export class PropertyManagementService {
  private logger: Logger;
  private databaseService: DatabaseService;

  constructor() {
    this.logger = new Logger();
    this.databaseService = new DatabaseService();
  }

  // ===============================
  // Property CRUD Operations
  // ===============================

  /**
   * Create new property record
   */
  async createProperty(propertyData: {
    address: PropertyAddress;
    details: PropertyDetails;
    metadata?: Record<string, any>;
  }): Promise<{ propertyId: string; address: PropertyAddress; details: PropertyDetails }> {
    this.logger.info('Creating new property', { 
      address: `${propertyData.address.streetAddress}, ${propertyData.address.city}`,
      propertyType: propertyData.details.propertyType 
    });

    try {
      // Generate unique property ID
      const propertyId = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Validate property data
      const validationErrors = this.validatePropertyData(propertyData.address, propertyData.details);
      if (validationErrors.length > 0) {
        throw new Error(`Property validation failed: ${validationErrors.join(', ')}`);
      }

      // Create comprehensive property record
      const propertyRecord = {
        id: propertyId,
        address: propertyData.address,
        details: propertyData.details,
        metadata: {
          ...propertyData.metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          dataSource: 'manual_entry',
          validationStatus: 'validated'
        },
        searchableFields: this.generateSearchableFields(propertyData.address, propertyData.details),
        coordinates: propertyData.address.coordinates || (await this.geocodeAddress(propertyData.address)) || { latitude: 0, longitude: 0 },
        marketData: await this.enrichWithMarketData(propertyData.address),
        riskFactors: await this.assessPropertyRisk(propertyData.details, propertyData.address),
        valuationHistory: [],
        auditTrail: [{
          action: 'created',
          timestamp: new Date(),
          userId: 'system',
          changes: 'Initial property creation'
        }]
      };

      // Store in database
      await this.databaseService.properties.create(propertyRecord);

      this.logger.info('Property created successfully', { propertyId });

      return {
        propertyId,
        address: propertyData.address,
        details: propertyData.details
      };

    } catch (error) {
      this.logger.error('Failed to create property', { error });
      throw error;
    }
  }

  /**
   * Get property by ID with comprehensive details
   */
  async getPropertyById(propertyId: string, includeHistory: boolean = false): Promise<any> {
    this.logger.info('Retrieving property by ID', { propertyId, includeHistory });

    try {
      const property = await this.databaseService.properties.findById(propertyId);
      
      if (!property) {
        throw new Error(`Property not found: ${propertyId}`);
      }

      // Base property data
      const response: any = {
        id: property.id,
        address: property.address,
        details: property.details,
        metadata: property.metadata,
        coordinates: property.coordinates,
        marketData: property.marketData,
        riskFactors: property.riskFactors
      };

      // Include historical data if requested
      if (includeHistory) {
        response.valuationHistory = property.valuationHistory || [];
        response.auditTrail = property.auditTrail || [];
        response.orderHistory = await this.getPropertyOrderHistory(propertyId);
      }

      this.logger.info('Property retrieved successfully', { propertyId });
      return response;

    } catch (error) {
      this.logger.error('Failed to retrieve property', { propertyId, error });
      throw error;
    }
  }

  /**
   * Update property details
   */
  async updateProperty(
    propertyId: string, 
    updates: Partial<{
      address: Partial<PropertyAddress>;
      details: Partial<PropertyDetails>;
      metadata: Record<string, any>;
    }>,
    userId: string = 'system'
  ): Promise<any> {
    this.logger.info('Updating property', { propertyId, updateKeys: Object.keys(updates) });

    try {
      const existingProperty = await this.databaseService.properties.findById(propertyId);
      if (!existingProperty) {
        throw new Error(`Property not found: ${propertyId}`);
      }

      // Merge updates with existing data
      const updatedProperty = {
        ...existingProperty,
        address: updates.address ? { ...existingProperty.address, ...updates.address } : existingProperty.address,
        details: updates.details ? { ...existingProperty.details, ...updates.details } : existingProperty.details,
        metadata: {
          ...existingProperty.metadata,
          ...updates.metadata,
          updatedAt: new Date(),
          version: (existingProperty.metadata?.version || 1) + 1
        }
      };

      // Re-validate after updates
      const validationErrors = this.validatePropertyData(updatedProperty.address, updatedProperty.details);
      if (validationErrors.length > 0) {
        throw new Error(`Property validation failed: ${validationErrors.join(', ')}`);
      }

      // Update searchable fields
      updatedProperty.searchableFields = this.generateSearchableFields(updatedProperty.address, updatedProperty.details);

      // Update coordinates if address changed
      if (updates.address) {
        const newCoordinates = await this.geocodeAddress(updatedProperty.address);
        if (newCoordinates) {
          updatedProperty.coordinates = newCoordinates;
        }
        updatedProperty.marketData = await this.enrichWithMarketData(updatedProperty.address);
      }

      // Add audit trail entry
      updatedProperty.auditTrail = updatedProperty.auditTrail || [];
      updatedProperty.auditTrail.push({
        action: 'updated',
        timestamp: new Date(),
        userId,
        changes: this.generateChangeDescription(existingProperty, updates)
      });

      // Update in database
      await this.databaseService.properties.update(propertyId, updatedProperty);

      this.logger.info('Property updated successfully', { propertyId });
      return updatedProperty;

    } catch (error) {
      this.logger.error('Failed to update property', { propertyId, error });
      throw error;
    }
  }

  /**
   * Delete property (soft delete with archiving)
   */
  async deleteProperty(propertyId: string, userId: string = 'system'): Promise<boolean> {
    this.logger.info('Deleting property', { propertyId });

    try {
      const property = await this.databaseService.properties.findById(propertyId);
      if (!property) {
        throw new Error(`Property not found: ${propertyId}`);
      }

      // Check if property is referenced in any orders
      const orderReferences = await this.checkPropertyOrderReferences(propertyId);
      if (orderReferences.length > 0) {
        // Soft delete - mark as archived
        const archivedProperty = {
          ...property,
          status: 'archived',
          metadata: {
            ...property.metadata,
            archivedAt: new Date(),
            archivedBy: userId,
            version: (property.metadata?.version || 1) + 1
          }
        };

        archivedProperty.auditTrail = archivedProperty.auditTrail || [];
        archivedProperty.auditTrail.push({
          action: 'archived',
          timestamp: new Date(),
          userId,
          changes: `Property archived due to ${orderReferences.length} order references`
        });

        await this.databaseService.properties.update(propertyId, archivedProperty);
        this.logger.info('Property archived successfully', { propertyId, orderReferences: orderReferences.length });
        return true;
      } else {
        // Hard delete if no references
        await this.databaseService.properties.delete(propertyId);
        this.logger.info('Property deleted successfully', { propertyId });
        return true;
      }

    } catch (error) {
      this.logger.error('Failed to delete property', { propertyId, error });
      throw error;
    }
  }

  /**
   * Search properties with advanced filtering
   */
  async searchProperties(criteria: {
    address?: Partial<PropertyAddress>;
    propertyType?: PropertyType;
    condition?: PropertyCondition;
    yearBuiltRange?: { min?: number; max?: number };
    squareFootageRange?: { min?: number; max?: number };
    priceRange?: { min?: number; max?: number };
    bedroomCount?: number;
    bathroomCount?: number;
    features?: string[];
    radius?: { lat: number; lng: number; miles: number };
    limit?: number;
    offset?: number;
    sortBy?: 'address' | 'yearBuilt' | 'squareFootage' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    properties: any[];
    total: number;
    filters: any;
  }> {
    this.logger.info('Searching properties', { criteria });

    try {
      // Build search filters
      const filters: any = {};

      // Address filters
      if (criteria.address?.city) {
        filters['address.city'] = { $regex: criteria.address.city, $options: 'i' };
      }
      if (criteria.address?.state) {
        filters['address.state'] = criteria.address.state;
      }
      if (criteria.address?.zipCode) {
        filters['address.zipCode'] = criteria.address.zipCode;
      }

      // Property type filter
      if (criteria.propertyType) {
        filters['details.propertyType'] = criteria.propertyType;
      }

      // Condition filter
      if (criteria.condition) {
        filters['details.condition'] = criteria.condition;
      }

      // Year built range
      if (criteria.yearBuiltRange) {
        const yearFilter: any = {};
        if (criteria.yearBuiltRange.min) yearFilter.$gte = criteria.yearBuiltRange.min;
        if (criteria.yearBuiltRange.max) yearFilter.$lte = criteria.yearBuiltRange.max;
        if (Object.keys(yearFilter).length > 0) {
          filters['details.yearBuilt'] = yearFilter;
        }
      }

      // Square footage range
      if (criteria.squareFootageRange) {
        const sqftFilter: any = {};
        if (criteria.squareFootageRange.min) sqftFilter.$gte = criteria.squareFootageRange.min;
        if (criteria.squareFootageRange.max) sqftFilter.$lte = criteria.squareFootageRange.max;
        if (Object.keys(sqftFilter).length > 0) {
          filters['details.grossLivingArea'] = sqftFilter;
        }
      }

      // Bedroom/bathroom counts
      if (criteria.bedroomCount) {
        filters['details.bedrooms'] = criteria.bedroomCount;
      }
      if (criteria.bathroomCount) {
        filters['details.bathrooms'] = criteria.bathroomCount;
      }

      // Features filter
      if (criteria.features && criteria.features.length > 0) {
        filters['details.features'] = { $in: criteria.features };
      }

      // Geographic radius filter
      if (criteria.radius) {
        filters.coordinates = this.buildGeographicFilter(criteria.radius);
      }

      // Exclude archived properties by default
      filters.status = { $ne: 'archived' };

      // Execute search with pagination and sorting
      const sortOptions: any = {};
      if (criteria.sortBy) {
        const sortField = criteria.sortBy === 'address' ? 'address.streetAddress' : 
                         criteria.sortBy === 'yearBuilt' ? 'details.yearBuilt' :
                         criteria.sortBy === 'squareFootage' ? 'details.grossLivingArea' :
                         'metadata.updatedAt';
        sortOptions[sortField] = criteria.sortOrder === 'desc' ? -1 : 1;
      } else {
        sortOptions['metadata.updatedAt'] = -1; // Default sort by most recent
      }

      const results = await this.databaseService.properties.findMany(
        filters,
        criteria.offset || 0,
        criteria.limit || 50
      );

      const total = await this.databaseService.properties.count(filters);

      this.logger.info('Property search completed', { 
        resultsCount: results.properties.length, 
        total,
        filtersApplied: Object.keys(filters).length 
      });

      return {
        properties: results.properties.map((p: any) => ({
          id: p.id,
          address: p.address,
          details: p.details,
          metadata: {
            createdAt: p.metadata?.createdAt,
            updatedAt: p.metadata?.updatedAt,
            version: p.metadata?.version
          },
          marketData: p.marketData ? {
            estimatedValue: p.marketData.estimatedValue,
            pricePerSqFt: p.marketData.pricePerSqFt,
            marketTrend: p.marketData.marketTrend
          } : null
        })),
        total,
        filters: criteria
      };

    } catch (error) {
      this.logger.error('Property search failed', { error, criteria });
      throw error;
    }
  }

  /**
   * Get properties by geographic area
   */
  async getPropertiesByArea(area: {
    bounds?: { north: number; south: number; east: number; west: number };
    center?: { lat: number; lng: number; radius: number };
    zipCodes?: string[];
    city?: string;
    state?: string;
  }): Promise<any[]> {
    this.logger.info('Getting properties by geographic area', { area });

    try {
      const filters: any = {};

      if (area.bounds) {
        filters.coordinates = {
          latitude: { $gte: area.bounds.south, $lte: area.bounds.north },
          longitude: { $gte: area.bounds.west, $lte: area.bounds.east }
        };
      } else if (area.center) {
        filters.coordinates = this.buildGeographicFilter(area.center);
      } else if (area.zipCodes) {
        filters['address.zipCode'] = { $in: area.zipCodes };
      } else if (area.city || area.state) {
        if (area.city) filters['address.city'] = { $regex: area.city, $options: 'i' };
        if (area.state) filters['address.state'] = area.state;
      }

      filters.status = { $ne: 'archived' };

      const results = await this.databaseService.properties.findMany(
        filters,
        0, // offset
        1000 // limit - Geographic queries can return many results
      );

      this.logger.info('Geographic property search completed', { 
        resultsCount: results.properties.length 
      });

      const properties = results.properties;

      return properties;

    } catch (error) {
      this.logger.error('Geographic property search failed', { error, area });
      throw error;
    }
  }

  // ===============================
  // Property Analysis & Insights
  // ===============================

  /**
   * Get comprehensive property analytics
   */
  async getPropertyAnalytics(propertyId: string): Promise<any> {
    this.logger.info('Generating property analytics', { propertyId });

    try {
      const property = await this.getPropertyById(propertyId, true);
      
      const analytics = {
        propertyOverview: {
          id: property.id,
          address: property.address,
          propertyType: property.details.propertyType,
          yearBuilt: property.details.yearBuilt,
          squareFootage: property.details.grossLivingArea,
          lotSize: property.details.lotSize
        },
        marketMetrics: property.marketData || {},
        riskAssessment: property.riskFactors || {},
        valuationInsights: await this.generateValuationInsights(property),
        comparableAnalysis: await this.findComparableProperties(property),
        orderHistory: property.orderHistory || [],
        performanceMetrics: {
          totalOrders: property.orderHistory?.length || 0,
          averageOrderValue: this.calculateAverageOrderValue(property.orderHistory),
          lastOrderDate: this.getLastOrderDate(property.orderHistory),
          trendAnalysis: await this.analyzePropertyTrends(property)
        }
      };

      this.logger.info('Property analytics generated', { propertyId });
      return analytics;

    } catch (error) {
      this.logger.error('Failed to generate property analytics', { propertyId, error });
      throw error;
    }
  }

  // ===============================
  // Helper Methods
  // ===============================

  /**
   * Validate property data
   */
  private validatePropertyData(address: PropertyAddress, details: PropertyDetails): string[] {
    const errors: string[] = [];

    // Address validation
    if (!address.streetAddress?.trim()) errors.push('Street address is required');
    if (!address.city?.trim()) errors.push('City is required');
    if (!address.state?.trim()) errors.push('State is required');
    if (!address.zipCode?.trim()) errors.push('ZIP code is required');

    // Property details validation
    if (!details.propertyType) errors.push('Property type is required');
    if (details.yearBuilt && (details.yearBuilt < 1800 || details.yearBuilt > new Date().getFullYear())) {
      errors.push('Year built must be between 1800 and current year');
    }
    if (details.grossLivingArea && details.grossLivingArea <= 0) {
      errors.push('Gross living area must be positive');
    }
    if (details.bedrooms && details.bedrooms < 0) errors.push('Bedrooms cannot be negative');
    if (details.bathrooms && details.bathrooms < 0) errors.push('Bathrooms cannot be negative');

    return errors;
  }

  /**
   * Generate searchable fields for property
   */
  private generateSearchableFields(address: PropertyAddress, details: PropertyDetails): string[] {
    const fields: string[] = [];
    
    fields.push(address.streetAddress.toLowerCase());
    fields.push(address.city.toLowerCase());
    fields.push(address.state.toLowerCase());
    fields.push(address.zipCode);
    if (address.county) fields.push(address.county.toLowerCase());
    
    fields.push(details.propertyType);
    if (details.condition) fields.push(details.condition);
    if (details.viewType) fields.push(details.viewType);
    if (details.constructionType) fields.push(details.constructionType);
    
    details.features.forEach(feature => fields.push(feature.toLowerCase()));

    return fields;
  }

  /**
   * Geocode address to coordinates
   */
  private async geocodeAddress(address: PropertyAddress): Promise<{ latitude: number; longitude: number } | undefined> {
    // Mock geocoding - in production, would use Google Maps API or similar
    const mockCoordinates = {
      latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
      longitude: -122.4194 + (Math.random() - 0.5) * 0.1
    };
    
    return mockCoordinates;
  }

  /**
   * Enrich property with market data
   */
  private async enrichWithMarketData(address: PropertyAddress): Promise<any> {
    // Mock market data enrichment
    return {
      estimatedValue: Math.floor(Math.random() * 1000000) + 500000,
      pricePerSqFt: Math.floor(Math.random() * 500) + 300,
      marketTrend: ['increasing', 'stable', 'declining'][Math.floor(Math.random() * 3)],
      daysOnMarket: Math.floor(Math.random() * 60) + 15,
      lastUpdated: new Date()
    };
  }

  /**
   * Assess property risk factors
   */
  private async assessPropertyRisk(details: PropertyDetails, address: PropertyAddress): Promise<any> {
    // Mock risk assessment
    return {
      overallRisk: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      factors: {
        age: details.yearBuilt && details.yearBuilt < 1980 ? 'high' : 'low',
        condition: details.condition === 'poor' ? 'high' : 'low',
        location: 'medium',
        market: 'low'
      },
      score: Math.floor(Math.random() * 100),
      lastAssessed: new Date()
    };
  }

  /**
   * Check if property is referenced in orders
   */
  private async checkPropertyOrderReferences(propertyId: string): Promise<string[]> {
    // Mock implementation - would query orders collection
    return [];
  }

  /**
   * Get property order history
   */
  private async getPropertyOrderHistory(propertyId: string): Promise<any[]> {
    // Mock implementation - would query orders collection
    return [];
  }

  /**
   * Generate change description for audit trail
   */
  private generateChangeDescription(original: any, updates: any): string {
    const changes: string[] = [];
    
    if (updates.address) {
      Object.keys(updates.address).forEach(key => {
        changes.push(`Address ${key} changed`);
      });
    }
    
    if (updates.details) {
      Object.keys(updates.details).forEach(key => {
        changes.push(`Property ${key} updated`);
      });
    }
    
    return changes.join(', ') || 'Property updated';
  }

  /**
   * Build geographic filter for coordinates
   */
  private buildGeographicFilter(area: { lat: number; lng: number; radius?: number; miles?: number }): any {
    const radius = area.radius || area.miles || 5;
    // Mock geographic filter - in production would use proper geospatial queries
    return {
      latitude: { $gte: area.lat - radius * 0.01, $lte: area.lat + radius * 0.01 },
      longitude: { $gte: area.lng - radius * 0.01, $lte: area.lng + radius * 0.01 }
    };
  }

  /**
   * Generate valuation insights
   */
  private async generateValuationInsights(property: any): Promise<any> {
    // Mock valuation insights
    return {
      estimatedRange: {
        low: 450000,
        high: 650000,
        confidence: 85
      },
      keyFactors: ['Location', 'Square footage', 'Year built', 'Condition'],
      lastValuation: property.valuationHistory?.[0]?.date || null
    };
  }

  /**
   * Find comparable properties
   */
  private async findComparableProperties(property: any): Promise<any[]> {
    // Mock comparable properties search
    return [];
  }

  /**
   * Calculate average order value
   */
  private calculateAverageOrderValue(orderHistory: any[]): number {
    if (!orderHistory || orderHistory.length === 0) return 0;
    const total = orderHistory.reduce((sum, order) => sum + (order.value || 0), 0);
    return total / orderHistory.length;
  }

  /**
   * Get last order date
   */
  private getLastOrderDate(orderHistory: any[]): Date | null {
    if (!orderHistory || orderHistory.length === 0) return null;
    return orderHistory[0]?.date || null;
  }

  /**
   * Analyze property trends
   */
  private async analyzePropertyTrends(property: any): Promise<any> {
    // Mock trend analysis
    return {
      valuationTrend: 'increasing',
      orderFrequency: 'stable',
      marketPosition: 'competitive'
    };
  }
}