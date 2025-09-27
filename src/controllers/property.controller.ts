import express from 'express';
import { Logger } from '../utils/logger.js';
import { PropertyManagementService } from '../services/property-management.service.js';
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
 * Property Management Controller
 * Comprehensive REST API for property-related operations
 */
export class PropertyController {
  private logger: Logger;
  private propertyService: PropertyManagementService;

  constructor() {
    this.logger = new Logger();
    this.propertyService = new PropertyManagementService();
  }

  // ===============================
  // Property CRUD Endpoints
  // ===============================

  /**
   * POST /api/properties - Create new property
   */
  async createProperty(req: express.Request, res: express.Response): Promise<void> {
    this.logger.info('Creating new property', { body: req.body });

    try {
      const { address, details, metadata } = req.body;

      // Validate required fields
      if (!address || !details) {
        res.status(400).json({
          success: false,
          error: 'Address and property details are required'
        });
        return;
      }

      // Validate address fields
      if (!address.streetAddress || !address.city || !address.state || !address.zipCode) {
        res.status(400).json({
          success: false,
          error: 'Street address, city, state, and ZIP code are required'
        });
        return;
      }

      // Validate property details
      if (!details.propertyType || !Object.values(PropertyType).includes(details.propertyType)) {
        res.status(400).json({
          success: false,
          error: 'Valid property type is required'
        });
        return;
      }

      const result = await this.propertyService.createProperty({
        address,
        details,
        metadata
      });

      this.logger.info('Property created successfully', { propertyId: result.propertyId });

      res.status(201).json({
        success: true,
        data: result,
        message: 'Property created successfully'
      });

    } catch (error) {
      this.logger.error('Failed to create property', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create property'
      });
    }
  }

  /**
   * GET /api/properties/:id - Get property by ID
   */
  async getPropertyById(req: express.Request, res: express.Response): Promise<void> {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Property ID is required'
      });
      return;
    }

    const includeHistory = req.query.includeHistory === 'true';

    this.logger.info('Retrieving property by ID', { propertyId: id, includeHistory });

    try {
      const property = await this.propertyService.getPropertyById(id, includeHistory);

      res.json({
        success: true,
        data: property
      });

    } catch (error) {
      this.logger.error('Failed to retrieve property', { propertyId: id, error });
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: `Property not found: ${id}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve property'
        });
      }
    }
  }

  /**
   * PUT /api/properties/:id - Update property
   */
  async updateProperty(req: express.Request, res: express.Response): Promise<void> {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Property ID is required'
      });
      return;
    }

    const updates = req.body;
    const userId = req.headers['x-user-id'] as string || 'system';

    this.logger.info('Updating property', { propertyId: id, updates });

    try {
      // Validate updates
      if (!updates || Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          error: 'Update data is required'
        });
        return;
      }

      // Validate property type if being updated
      if (updates.details?.propertyType && !Object.values(PropertyType).includes(updates.details.propertyType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid property type'
        });
        return;
      }

      const updatedProperty = await this.propertyService.updateProperty(id, updates, userId);

      this.logger.info('Property updated successfully', { propertyId: id });

      res.json({
        success: true,
        data: updatedProperty,
        message: 'Property updated successfully'
      });

    } catch (error) {
      this.logger.error('Failed to update property', { propertyId: id, error });
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: `Property not found: ${id}`
        });
      } else if (error instanceof Error && error.message.includes('validation failed')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update property'
        });
      }
    }
  }

  /**
   * DELETE /api/properties/:id - Delete property
   */
  async deleteProperty(req: express.Request, res: express.Response): Promise<void> {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Property ID is required'
      });
      return;
    }

    const userId = req.headers['x-user-id'] as string || 'system';

    this.logger.info('Deleting property', { propertyId: id });

    try {
      const success = await this.propertyService.deleteProperty(id, userId);

      if (success) {
        this.logger.info('Property deleted successfully', { propertyId: id });
        res.json({
          success: true,
          message: 'Property deleted successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete property'
        });
      }

    } catch (error) {
      this.logger.error('Failed to delete property', { propertyId: id, error });
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: `Property not found: ${id}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete property'
        });
      }
    }
  }

  // ===============================
  // Property Search & List Endpoints
  // ===============================

  /**
   * GET /api/properties - Search and list properties
   */
  async listProperties(req: express.Request, res: express.Response): Promise<void> {
    this.logger.info('Listing properties', { query: req.query });

    try {
      const criteria: any = {};

      // Pagination
      if (req.query.limit) criteria.limit = parseInt(req.query.limit as string);
      if (req.query.offset) criteria.offset = parseInt(req.query.offset as string);

      // Sorting
      if (req.query.sortBy) criteria.sortBy = req.query.sortBy as string;
      if (req.query.sortOrder) criteria.sortOrder = req.query.sortOrder as 'asc' | 'desc';

      // Address filters
      if (req.query.city) criteria.address = { ...(criteria.address || {}), city: req.query.city as string };
      if (req.query.state) criteria.address = { ...(criteria.address || {}), state: req.query.state as string };
      if (req.query.zipCode) criteria.address = { ...(criteria.address || {}), zipCode: req.query.zipCode as string };

      // Property filters
      if (req.query.propertyType && Object.values(PropertyType).includes(req.query.propertyType as PropertyType)) {
        criteria.propertyType = req.query.propertyType as PropertyType;
      }
      
      if (req.query.condition && Object.values(PropertyCondition).includes(req.query.condition as PropertyCondition)) {
        criteria.condition = req.query.condition as PropertyCondition;
      }

      // Numeric range filters
      if (req.query.minYearBuilt || req.query.maxYearBuilt) {
        criteria.yearBuiltRange = {};
        if (req.query.minYearBuilt) criteria.yearBuiltRange.min = parseInt(req.query.minYearBuilt as string);
        if (req.query.maxYearBuilt) criteria.yearBuiltRange.max = parseInt(req.query.maxYearBuilt as string);
      }

      if (req.query.minSquareFootage || req.query.maxSquareFootage) {
        criteria.squareFootageRange = {};
        if (req.query.minSquareFootage) criteria.squareFootageRange.min = parseInt(req.query.minSquareFootage as string);
        if (req.query.maxSquareFootage) criteria.squareFootageRange.max = parseInt(req.query.maxSquareFootage as string);
      }

      if (req.query.minPrice || req.query.maxPrice) {
        criteria.priceRange = {};
        if (req.query.minPrice) criteria.priceRange.min = parseInt(req.query.minPrice as string);
        if (req.query.maxPrice) criteria.priceRange.max = parseInt(req.query.maxPrice as string);
      }

      // Room counts
      if (req.query.bedrooms) criteria.bedroomCount = parseInt(req.query.bedrooms as string);
      if (req.query.bathrooms) criteria.bathroomCount = parseInt(req.query.bathrooms as string);

      // Features
      if (req.query.features) {
        const featuresStr = req.query.features as string;
        criteria.features = featuresStr.split(',').map(f => f.trim());
      }

      // Geographic radius
      if (req.query.lat && req.query.lng) {
        criteria.radius = {
          lat: parseFloat(req.query.lat as string),
          lng: parseFloat(req.query.lng as string),
          miles: req.query.radius ? parseFloat(req.query.radius as string) : 5
        };
      }

      const result = await this.propertyService.searchProperties(criteria);

      res.json({
        success: true,
        data: result.properties,
        pagination: {
          total: result.total,
          limit: criteria.limit || 50,
          offset: criteria.offset || 0,
          hasMore: (criteria.offset || 0) + result.properties.length < result.total
        },
        filters: result.filters
      });

    } catch (error) {
      this.logger.error('Failed to list properties', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve properties'
      });
    }
  }

  /**
   * POST /api/properties/search - Advanced property search
   */
  async searchProperties(req: express.Request, res: express.Response): Promise<void> {
    this.logger.info('Advanced property search', { criteria: req.body });

    try {
      const criteria = req.body;

      // Validate search criteria
      if (criteria.propertyType && !Object.values(PropertyType).includes(criteria.propertyType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid property type'
        });
        return;
      }

      if (criteria.condition && !Object.values(PropertyCondition).includes(criteria.condition)) {
        res.status(400).json({
          success: false,
          error: 'Invalid property condition'
        });
        return;
      }

      const result = await this.propertyService.searchProperties(criteria);

      res.json({
        success: true,
        data: result.properties,
        pagination: {
          total: result.total,
          limit: criteria.limit || 50,
          offset: criteria.offset || 0,
          hasMore: (criteria.offset || 0) + result.properties.length < result.total
        },
        filters: result.filters
      });

    } catch (error) {
      this.logger.error('Advanced property search failed', { error, criteria: req.body });
      res.status(500).json({
        success: false,
        error: 'Property search failed'
      });
    }
  }

  // ===============================
  // Geographic Property Endpoints
  // ===============================

  /**
   * GET /api/properties/area - Get properties by geographic area
   */
  async getPropertiesByArea(req: express.Request, res: express.Response): Promise<void> {
    this.logger.info('Getting properties by area', { query: req.query });

    try {
      const area: any = {};

      // Bounding box
      if (req.query.north && req.query.south && req.query.east && req.query.west) {
        area.bounds = {
          north: parseFloat(req.query.north as string),
          south: parseFloat(req.query.south as string),
          east: parseFloat(req.query.east as string),
          west: parseFloat(req.query.west as string)
        };
      }

      // Center point with radius
      if (req.query.lat && req.query.lng) {
        area.center = {
          lat: parseFloat(req.query.lat as string),
          lng: parseFloat(req.query.lng as string),
          radius: req.query.radius ? parseFloat(req.query.radius as string) : 5
        };
      }

      // ZIP codes
      if (req.query.zipCodes) {
        area.zipCodes = (req.query.zipCodes as string).split(',').map(z => z.trim());
      }

      // City/State
      if (req.query.city) area.city = req.query.city as string;
      if (req.query.state) area.state = req.query.state as string;

      if (Object.keys(area).length === 0) {
        res.status(400).json({
          success: false,
          error: 'Geographic area criteria required (bounds, center+radius, zipCodes, or city/state)'
        });
        return;
      }

      const properties = await this.propertyService.getPropertiesByArea(area);

      res.json({
        success: true,
        data: properties,
        count: properties.length,
        area: area
      });

    } catch (error) {
      this.logger.error('Failed to get properties by area', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve properties by area'
      });
    }
  }

  // ===============================
  // Property Analytics Endpoints
  // ===============================

  /**
   * GET /api/properties/:id/analytics - Get comprehensive property analytics
   */
  async getPropertyAnalytics(req: express.Request, res: express.Response): Promise<void> {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Property ID is required'
      });
      return;
    }

    this.logger.info('Getting property analytics', { propertyId: id });

    try {
      const analytics = await this.propertyService.getPropertyAnalytics(id);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      this.logger.error('Failed to get property analytics', { propertyId: id, error });
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: `Property not found: ${id}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve property analytics'
        });
      }
    }
  }

  // ===============================
  // Property Validation Endpoints
  // ===============================

  /**
   * POST /api/properties/validate - Validate property data
   */
  async validatePropertyData(req: express.Request, res: express.Response): Promise<void> {
    this.logger.info('Validating property data', { body: req.body });

    try {
      const { address, details } = req.body;

      if (!address || !details) {
        res.status(400).json({
          success: false,
          error: 'Address and property details are required for validation'
        });
        return;
      }

      // Create a temporary property service instance to use validation method
      const validationErrors = (this.propertyService as any).validatePropertyData(address, details);

      if (validationErrors.length === 0) {
        res.json({
          success: true,
          valid: true,
          message: 'Property data is valid'
        });
      } else {
        res.status(400).json({
          success: false,
          valid: false,
          errors: validationErrors
        });
      }

    } catch (error) {
      this.logger.error('Property data validation failed', { error });
      res.status(500).json({
        success: false,
        error: 'Validation failed'
      });
    }
  }

  // ===============================
  // Utility Endpoints
  // ===============================

  /**
   * GET /api/properties/enums - Get property-related enums
   */
  async getPropertyEnums(req: express.Request, res: express.Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          propertyTypes: Object.values(PropertyType),
          occupancyTypes: Object.values(OccupancyType),
          propertyConditions: Object.values(PropertyCondition),
          viewTypes: Object.values(ViewType),
          constructionTypes: Object.values(ConstructionType)
        }
      });
    } catch (error) {
      this.logger.error('Failed to get property enums', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve property enums'
      });
    }
  }

  // ===============================
  // Express Route Setup
  // ===============================

  /**
   * Setup Express routes for property management
   */
  setupRoutes(app: express.Application): void {
    const router = express.Router();

    // CRUD routes
    router.post('/', this.createProperty.bind(this));
    router.get('/:id', this.getPropertyById.bind(this));
    router.put('/:id', this.updateProperty.bind(this));
    router.delete('/:id', this.deleteProperty.bind(this));

    // List and search routes
    router.get('/', this.listProperties.bind(this));
    router.post('/search', this.searchProperties.bind(this));

    // Geographic routes
    router.get('/area', this.getPropertiesByArea.bind(this));

    // Analytics routes
    router.get('/:id/analytics', this.getPropertyAnalytics.bind(this));

    // Utility routes
    router.post('/validate', this.validatePropertyData.bind(this));
    router.get('/meta/enums', this.getPropertyEnums.bind(this));

    // Mount the router
    app.use('/api/properties', router);

    this.logger.info('Property management routes configured');
  }
}

// Export for use in main application
export default PropertyController;