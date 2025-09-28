import { Router, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { EnhancedPropertyService } from '../services/enhanced-property.service.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { 
  PropertySearchCriteria,
  CreatePropertySummaryRequest,
  UpdatePropertySummaryRequest,
  PropertyType,
  PropertyCondition
} from '../types/property-enhanced.js';

/**
 * Enhanced Property Controller - Two-Level Architecture
 * 
 * Provides both lightweight summary endpoints for performance
 * and comprehensive detail endpoints for thorough analysis
 */
export class EnhancedPropertyController {
  private router: Router;
  private logger: Logger;
  private propertyService: EnhancedPropertyService;

  constructor() {
    this.router = Router();
    this.logger = new Logger();
    this.propertyService = new EnhancedPropertyService();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // ===============================
    // Lightweight Summary Routes
    // ===============================
    
    // Property summary operations
    this.router.get('/summary', this.searchPropertiesSummary.bind(this));
    this.router.post('/summary/search', this.searchPropertiesSummary.bind(this));
    this.router.get('/summary/:id', this.getPropertySummary.bind(this));
    this.router.post('/summary', this.createPropertySummary.bind(this));
    this.router.put('/summary/:id', this.updatePropertySummary.bind(this));
    this.router.post('/summary/batch', this.getPropertySummariesBatch.bind(this));
    
    // ===============================
    // Comprehensive Detail Routes
    // ===============================
    
    // Property detail operations
    this.router.get('/detailed', this.searchPropertiesDetailed.bind(this));
    this.router.post('/detailed/search', this.searchPropertiesDetailed.bind(this));
    this.router.get('/detailed/:id', this.getPropertyDetails.bind(this));
    this.router.post('/detailed/:id/enrich', this.enrichPropertyWithExternalData.bind(this));
    
    // ===============================
    // Analytics & Market Analysis
    // ===============================
    
    this.router.get('/:id/market-analysis', this.getPropertyMarketAnalysis.bind(this));
    this.router.post('/valuations/batch-update', this.batchUpdatePropertyValuations.bind(this));
    
    // ===============================
    // Utility Routes
    // ===============================
    
    this.router.get('/schema/summary', this.getPropertySummarySchema.bind(this));
    this.router.get('/schema/detailed', this.getPropertyDetailedSchema.bind(this));
    this.router.get('/enums', this.getPropertyEnums.bind(this));
  }

  // ===============================
  // Lightweight Summary Operations
  // ===============================

  /**
   * Search properties with lightweight data
   * GET/POST /api/properties/summary or /api/properties/summary/search
   */
  private async searchPropertiesSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Extract criteria from query params or body
      const criteria: PropertySearchCriteria = req.method === 'GET' 
        ? this.parseQueryCriteria(req.query)
        : req.body;

      this.logger.info('Property summary search request', { 
        criteria, 
        userId: req.user?.id,
        method: req.method 
      });

      const results = await this.propertyService.searchPropertiesSummary(criteria);

      res.json({
        success: true,
        data: results,
        dataLevel: 'summary',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Property summary search failed', { error, request: req.body });
      res.status(500).json({
        success: false,
        error: 'Property summary search failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Get property summary by ID
   * GET /api/properties/summary/:id
   */
  private async getPropertySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Property ID is required'
        });
        return;
      }

      this.logger.info('Get property summary request', { id, userId: req.user?.id });

      const property = await this.propertyService.getPropertySummary(id);

      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      res.json({
        success: true,
        data: property,
        dataLevel: 'summary',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Get property summary failed', { error, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get property summary',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Create property summary
   * POST /api/properties/summary
   */
  private async createPropertySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreatePropertySummaryRequest = req.body;

      this.logger.info('Create property summary request', { 
        address: data.address,
        userId: req.user?.id 
      });

      const property = await this.propertyService.createPropertySummary(data);

      res.status(201).json({
        success: true,
        data: property,
        dataLevel: 'summary',
        message: 'Property summary created successfully'
      });

    } catch (error) {
      this.logger.error('Create property summary failed', { error, request: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to create property summary',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Update property summary
   * PUT /api/properties/summary/:id
   */
  private async updatePropertySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdatePropertySummaryRequest = { ...req.body, id };

      this.logger.info('Update property summary request', { id, userId: req.user?.id });

      const property = await this.propertyService.updatePropertySummary(updateData);

      res.json({
        success: true,
        data: property,
        dataLevel: 'summary',
        message: 'Property summary updated successfully'
      });

    } catch (error) {
      this.logger.error('Update property summary failed', { error, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to update property summary',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Get multiple property summaries by IDs
   * POST /api/properties/summary/batch
   */
  private async getPropertySummariesBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
          success: false,
          error: 'IDs array is required and must not be empty'
        });
        return;
      }

      this.logger.info('Batch property summaries request', { 
        count: ids.length, 
        userId: req.user?.id 
      });

      const properties = await this.propertyService.getPropertySummaries(ids);

      res.json({
        success: true,
        data: {
          properties,
          requested: ids.length,
          found: properties.length
        },
        dataLevel: 'summary',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Batch property summaries failed', { error, request: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to get property summaries',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ===============================
  // Comprehensive Detail Operations
  // ===============================

  /**
   * Search properties with comprehensive data
   * GET/POST /api/properties/detailed or /api/properties/detailed/search
   */
  private async searchPropertiesDetailed(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Extract criteria from query params or body
      const criteria: PropertySearchCriteria = req.method === 'GET' 
        ? this.parseQueryCriteria(req.query)
        : req.body;

      // Set lower default limit for detailed searches
      if (!criteria.limit) {
        criteria.limit = 25;
      }

      this.logger.info('Property detailed search request', { 
        criteria, 
        userId: req.user?.id,
        method: req.method 
      });

      const results = await this.propertyService.searchPropertiesDetailed(criteria);

      res.json({
        success: true,
        data: results,
        dataLevel: 'detailed',
        timestamp: new Date().toISOString(),
        warning: results.properties.length > 25 ? 'Large detailed dataset returned. Consider using summary endpoint for better performance.' : undefined
      });

    } catch (error) {
      this.logger.error('Property detailed search failed', { error, request: req.body });
      res.status(500).json({
        success: false,
        error: 'Property detailed search failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Get comprehensive property details by ID
   * GET /api/properties/detailed/:id
   */
  private async getPropertyDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Property ID is required'
        });
        return;
      }

      this.logger.info('Get property details request', { id, userId: req.user?.id });

      const property = await this.propertyService.getPropertyDetails(id);

      if (!property) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      res.json({
        success: true,
        data: property,
        dataLevel: 'detailed',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Get property details failed', { error, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get property details',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Enrich property with external data
   * POST /api/properties/detailed/:id/enrich
   */
  private async enrichPropertyWithExternalData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Property ID is required'
        });
        return;
      }

      this.logger.info('Enrich property request', { id, userId: req.user?.id });

      const enrichedProperty = await this.propertyService.enrichPropertyWithExternalData(id);

      res.json({
        success: true,
        data: enrichedProperty,
        dataLevel: 'detailed',
        message: 'Property enriched with external data successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Property enrichment failed', { error, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to enrich property with external data',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ===============================
  // Analytics & Market Analysis
  // ===============================

  /**
   * Get property market analysis
   * GET /api/properties/:id/market-analysis?radius=0.5
   */
  private async getPropertyMarketAnalysis(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Property ID is required'
        });
        return;
      }

      const radius = parseFloat(req.query.radius as string) || 0.5;

      this.logger.info('Property market analysis request', { 
        id, 
        radius, 
        userId: req.user?.id 
      });

      const analysis = await this.propertyService.getPropertyMarketAnalysis(id, radius);

      res.json({
        success: true,
        data: analysis,
        parameters: { radius },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Property market analysis failed', { error, id: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to generate property market analysis',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Batch update property valuations
   * POST /api/properties/valuations/batch-update
   */
  private async batchUpdatePropertyValuations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { propertyIds } = req.body;

      if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Property IDs array is required and must not be empty'
        });
        return;
      }

      this.logger.info('Batch valuation update request', { 
        count: propertyIds.length, 
        userId: req.user?.id 
      });

      const results = await this.propertyService.batchUpdatePropertyValuations(propertyIds);

      res.json({
        success: true,
        data: results,
        message: `Valuation update completed: ${results.updated} updated, ${results.failed} failed`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Batch valuation update failed', { error, request: req.body });
      res.status(500).json({
        success: false,
        error: 'Failed to update property valuations',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ===============================
  // Utility Operations
  // ===============================

  /**
   * Get property summary schema
   * GET /api/properties/schema/summary
   */
  private async getPropertySummarySchema(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schema = {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Property identifier' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              zip: { type: 'string' },
              county: { type: 'string', optional: true },
              latitude: { type: 'number', optional: true },
              longitude: { type: 'number', optional: true }
            },
            required: ['street', 'city', 'state', 'zip']
          },
          propertyType: { 
            type: 'string', 
            enum: Object.values(PropertyType),
            description: 'Type of property'
          },
          condition: { 
            type: 'string', 
            enum: Object.values(PropertyCondition),
            optional: true 
          },
          building: {
            type: 'object',
            properties: {
              yearBuilt: { type: 'number', optional: true },
              livingAreaSquareFeet: { type: 'number', optional: true },
              bedroomCount: { type: 'number', optional: true },
              bathroomCount: { type: 'number', optional: true }
            }
          },
          valuation: {
            type: 'object',
            properties: {
              estimatedValue: { type: 'number', optional: true },
              priceRangeMin: { type: 'number', optional: true },
              priceRangeMax: { type: 'number', optional: true },
              confidenceScore: { type: 'number', optional: true }
            }
          }
        },
        required: ['address', 'propertyType']
      };

      res.json({
        success: true,
        data: schema,
        schemaType: 'PropertySummary',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Get property summary schema failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get property summary schema'
      });
    }
  }

  /**
   * Get property detailed schema info
   * GET /api/properties/schema/detailed
   */
  private async getPropertyDetailedSchema(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const schemaInfo = {
        message: 'PropertyDetails extends PropertySummary with comprehensive data',
        additionalSections: [
          'assessment', 'deedHistory', 'demographics', 'foreclosure',
          'general', 'ids', 'legal', 'lot', 'listing', 'mortgageHistory',
          'openLien', 'permit', 'propertyOwnerProfile', 'sale', 'tax', 'meta'
        ],
        dataSize: 'Typically 50-100KB per property',
        recommendation: 'Use PropertySummary for listings and searches, PropertyDetails for analysis'
      };

      res.json({
        success: true,
        data: schemaInfo,
        schemaType: 'PropertyDetails',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Get property detailed schema failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get property detailed schema'
      });
    }
  }

  /**
   * Get property enums
   * GET /api/properties/enums
   */
  private async getPropertyEnums(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const enums = {
        PropertyType: Object.values(PropertyType),
        PropertyCondition: Object.values(PropertyCondition)
      };

      res.json({
        success: true,
        data: enums,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Get property enums failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to get property enums'
      });
    }
  }

  // ===============================
  // Helper Methods
  // ===============================

  /**
   * Parse query parameters into search criteria
   */
  private parseQueryCriteria(query: any): PropertySearchCriteria {
    const criteria: PropertySearchCriteria = {};

    // Basic filters
    if (query.textQuery) criteria.textQuery = query.textQuery;
    if (query.city) criteria.address = { ...criteria.address, city: query.city };
    if (query.state) criteria.address = { ...criteria.address, state: query.state };
    if (query.zip) criteria.address = { ...criteria.address, zip: query.zip };

    // Property type
    if (query.propertyType) {
      criteria.propertyType = Array.isArray(query.propertyType) 
        ? query.propertyType 
        : [query.propertyType];
    }

    // Price range
    if (query.minPrice || query.maxPrice) {
      criteria.priceRange = {};
      if (query.minPrice) criteria.priceRange.min = parseInt(query.minPrice);
      if (query.maxPrice) criteria.priceRange.max = parseInt(query.maxPrice);
    }

    // Pagination
    if (query.limit) criteria.limit = parseInt(query.limit);
    if (query.offset) criteria.offset = parseInt(query.offset);
    if (query.sortBy) criteria.sortBy = query.sortBy;
    if (query.sortOrder) criteria.sortOrder = query.sortOrder;

    return criteria;
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default EnhancedPropertyController;