import { Router, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { AdvancedSearchService } from '../services/advanced-search.service.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { 
  PropertyType, 
  PropertyCondition, 
  OrderStatus, 
  Priority, 
  ProductType, 
  OrderType, 
  VendorStatus 
} from '../types/index.js';

/**
 * Advanced Search Controller
 * Provides comprehensive search endpoints across all entities
 */
export class SearchController {
  private router: Router;
  private logger: Logger;
  private searchService: AdvancedSearchService;

  constructor() {
    this.router = Router();
    this.logger = new Logger();
    this.searchService = new AdvancedSearchService();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Universal search
    this.router.post('/universal', this.universalSearch.bind(this));
    
    // Advanced entity searches
    this.router.post('/properties/advanced', this.advancedPropertySearch.bind(this));
    this.router.post('/vendors/advanced', this.advancedVendorSearch.bind(this));
    this.router.post('/orders/advanced', this.advancedOrderSearch.bind(this));
    
    // Faceted search
    this.router.get('/facets/:entityType', this.facetedSearch.bind(this));
    
    // Additional endpoints can be added later
  }

  // ===============================
  // Universal Search
  // ===============================

  /**
   * Universal search across all entities
   * POST /api/search/universal
   */
  private async universalSearch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { query, options = {} } = req.body as any;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Query parameter is required and must be a string'
        });
        return;
      }

      this.logger.info('Universal search request', { query, options, userId: req.user?.id });

      const results = await this.searchService.universalSearch(query, options);

      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Universal search failed', { error, request: req.body });
      res.status(500).json({
        success: false,
        error: 'Search failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ===============================
  // Advanced Property Search
  // ===============================

  /**
   * Advanced property search with complex filters
   * POST /api/search/properties/advanced
   */
  private async advancedPropertySearch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const criteria = req.body as any;

      // Validate property types
      if (criteria.propertyType) {
        const validTypes = Object.values(PropertyType);
        const invalidTypes = criteria.propertyType.filter((type: string) => !validTypes.includes(type as PropertyType));
        if (invalidTypes.length > 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid property types',
            details: { invalidTypes, validTypes }
          });
          return;
        }
      }

      // Validate condition types
      if (criteria.condition) {
        const validConditions = Object.values(PropertyCondition);
        const invalidConditions = criteria.condition.filter((cond: string) => !validConditions.includes(cond as PropertyCondition));
        if (invalidConditions.length > 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid property conditions',
            details: { invalidConditions, validConditions }
          });
          return;
        }
      }

      this.logger.info('Advanced property search request', { criteria, userId: req.user?.id });

      const results = await this.searchService.advancedPropertySearch(criteria);

      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Advanced property search failed', { error, request: req.body });
      res.status(500).json({
        success: false,
        error: 'Property search failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ===============================
  // Advanced Vendor Search
  // ===============================

  /**
   * Advanced vendor search with complex filters
   * POST /api/search/vendors/advanced
   */
  private async advancedVendorSearch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const criteria = req.body as any;

      // Validate product types
      if (criteria.productTypes) {
        const validTypes = Object.values(ProductType);
        const invalidTypes = criteria.productTypes.filter((type: string) => !validTypes.includes(type as ProductType));
        if (invalidTypes.length > 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid product types',
            details: { invalidTypes, validTypes }
          });
          return;
        }
      }

      this.logger.info('Advanced vendor search request', { criteria, userId: req.user?.id });

      const results = await this.searchService.advancedVendorSearch(criteria);

      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Advanced vendor search failed', { error, request: req.body });
      res.status(500).json({
        success: false,
        error: 'Vendor search failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ===============================
  // Advanced Order Search
  // ===============================

  /**
   * Advanced order search with complex filters
   * POST /api/search/orders/advanced
   */
  private async advancedOrderSearch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const criteria = req.body as any;

      // Validate order statuses
      if (criteria.status) {
        const validStatuses = Object.values(OrderStatus);
        const invalidStatuses = criteria.status.filter((status: string) => !validStatuses.includes(status as OrderStatus));
        if (invalidStatuses.length > 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid order statuses',
            details: { invalidStatuses, validStatuses }
          });
          return;
        }
      }

      // Parse date ranges
      if (criteria.createdDateRange) {
        criteria.createdDateRange.start = new Date(criteria.createdDateRange.start);
        criteria.createdDateRange.end = new Date(criteria.createdDateRange.end);
      }

      this.logger.info('Advanced order search request', { criteria, userId: req.user?.id });

      const results = await this.searchService.advancedOrderSearch(criteria);

      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Advanced order search failed', { error, request: req.body });
      res.status(500).json({
        success: false,
        error: 'Order search failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // ===============================
  // Faceted Search
  // ===============================

  /**
   * Get faceted search results
   * GET /api/search/facets/:entityType
   */
  private async facetedSearch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { entityType } = req.params;
      const baseFilters = req.query.filters ? JSON.parse(req.query.filters as string) : undefined;

      if (!entityType || !['orders', 'vendors', 'properties'].includes(entityType)) {
        res.status(400).json({
          success: false,
          error: 'Invalid entity type',
          validTypes: ['orders', 'vendors', 'properties']
        });
        return;
      }

      this.logger.info('Faceted search request', { entityType, baseFilters, userId: req.user?.id });

      const results = await this.searchService.facetedSearch(
        entityType as 'orders' | 'vendors' | 'properties',
        baseFilters
      );

      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Faceted search failed', { error, entityType: req.params.entityType });
      res.status(500).json({
        success: false,
        error: 'Faceted search failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  // Additional methods would continue here...
  // For brevity, I'm including key methods. The full controller would have all methods.

  public getRouter(): Router {
    return this.router;
  }
}

export default SearchController;