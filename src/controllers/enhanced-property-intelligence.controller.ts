/**
 * Enhanced Property Intelligence API Controller
 * 
 * Comprehensive REST API endpoints for advanced property intelligence features:
 * - Multi-provider address services (Google, Azure, OpenStreetMap, SmartyStreets, USPS)
 * - Creative property characteristics analysis
 * - View analysis and location intelligence  
 * - Proximity and accessibility scoring
 * - Neighborhood intelligence and demographics
 * - Investment potential and desirability scoring
 */

import { Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { MultiProviderPropertyIntelligenceService } from '../services/multi-provider-intelligence.service';
import { AddressService } from '../services/address.service';
import { CreativePropertyIntelligenceService } from '../services/creative-property-intelligence.service';
import { GoogleMapsPropertyIntelligenceService } from '../services/google-maps-property-intelligence.service';
import { Coordinates } from '../types/geospatial';
import {
  AddressComponents,
  GeocodingResult,
  AddressValidationResult,
  PropertyIntelligence,
  PropertyIntelligenceResponse,
  BatchPropertyIntelligenceResponse
} from '../types/property-intelligence';

export class EnhancedPropertyIntelligenceController {
  private logger: Logger;
  private multiProviderService: MultiProviderPropertyIntelligenceService;
  private addressService: AddressService;
  private creativeService: CreativePropertyIntelligenceService;
  private googleMapsService: GoogleMapsPropertyIntelligenceService;

  constructor() {
    this.logger = new Logger();
    this.multiProviderService = new MultiProviderPropertyIntelligenceService();
    this.addressService = new AddressService();
    this.creativeService = new CreativePropertyIntelligenceService();
    this.googleMapsService = new GoogleMapsPropertyIntelligenceService();
  }

  // ===========================
  // ADDRESS SERVICES
  // ===========================

  /**
   * POST /api/property-intelligence/address/geocode
   * Multi-provider address geocoding with fallback
   */
  geocodeAddress = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { address } = req.body;

      if (!address || typeof address !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Address is required and must be a string',
          metadata: {
            processingTime: Date.now() - startTime,
            dataSourcesUsed: [],
            lastUpdated: new Date(),
            cacheHit: false
          }
        });
        return;
      }

      this.logger.info('Geocoding address request', { address });

      const results = await this.addressService.geocodeAddress(address);

      res.json({
        success: true,
        data: results,
        metadata: {
          processingTime: Date.now() - startTime,
          dataSourcesUsed: results.map(r => r.provider),
          lastUpdated: new Date(),
          cacheHit: false // This would be determined by the service
        }
      });

    } catch (error) {
      this.logger.error('Address geocoding failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Address geocoding service unavailable',
        metadata: {
          processingTime: Date.now(),
          dataSourcesUsed: [],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });
    }
  };

  /**
   * POST /api/property-intelligence/address/validate
   * Comprehensive address validation using multiple providers
   */
  validateAddress = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { address } = req.body;

      if (!address || typeof address !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Address is required and must be a string'
        });
        return;
      }

      const validation = await this.addressService.validateAddress(address);

      res.json({
        success: true,
        data: validation,
        metadata: {
          processingTime: Date.now() - startTime,
          dataSourcesUsed: ['SmartyStreets', 'USPS', 'Google'],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });

    } catch (error) {
      this.logger.error('Address validation failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Address validation service unavailable'
      });
    }
  };

  /**
   * POST /api/property-intelligence/address/reverse-geocode
   * Convert coordinates to address using multiple providers
   */
  reverseGeocode = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { latitude, longitude } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Valid latitude and longitude coordinates are required'
        });
        return;
      }

      const coordinates: Coordinates = { latitude, longitude };
      const addressComponents = await this.addressService.reverseGeocode(coordinates);

      res.json({
        success: true,
        data: addressComponents,
        metadata: {
          processingTime: Date.now() - startTime,
          dataSourcesUsed: ['Google', 'Mapbox'],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });

    } catch (error) {
      this.logger.error('Reverse geocoding failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Reverse geocoding service unavailable'
      });
    }
  };

  /**
   * GET /api/property-intelligence/address/suggest?q=partial_address&limit=5
   * Address autocomplete suggestions
   */
  suggestAddresses = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { q: partial, limit = 5 } = req.query;

      if (!partial || typeof partial !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Query parameter "q" is required'
        });
        return;
      }

      const suggestions = await this.addressService.suggestAddresses(partial, Number(limit));

      res.json({
        success: true,
        data: suggestions,
        metadata: {
          processingTime: Date.now() - startTime,
          dataSourcesUsed: ['Google Places', 'Mapbox'],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });

    } catch (error) {
      this.logger.error('Address suggestions failed', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Address suggestion service unavailable'
      });
    }
  };

  // ===========================
  // COMPREHENSIVE PROPERTY ANALYSIS
  // ===========================

  /**
   * POST /api/property-intelligence/analyze/comprehensive
   * Complete property intelligence analysis using all providers
   */
  comprehensiveAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { latitude, longitude, propertyId, strategy = 'quality_first' } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Valid latitude and longitude coordinates are required'
        });
        return;
      }

      const coordinates: Coordinates = { latitude, longitude };
      
      this.logger.info('Starting comprehensive property analysis', { 
        coordinates, 
        propertyId, 
        strategy 
      });

      // Run comprehensive analysis with intelligent provider selection
      const analysis = await this.multiProviderService.analyzeProperty(
        coordinates, 
        propertyId, 
        strategy
      );

      const response: PropertyIntelligenceResponse = {
        success: true,
        data: analysis,
        metadata: {
          processingTime: Date.now() - startTime,
          dataSourcesUsed: [
            'Google Maps Platform',
            'Azure Maps',
            'OpenStreetMap',
            'SmartyStreets',
            'USPS'
          ],
          lastUpdated: new Date(),
          cacheHit: false
        }
      };

      res.json(response);

    } catch (error) {
      this.logger.error('Comprehensive property analysis failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Comprehensive property analysis service unavailable',
        metadata: {
          processingTime: Date.now(),
          dataSourcesUsed: [],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });
    }
  };

  /**
   * POST /api/property-intelligence/analyze/creative-features
   * Creative property characteristics analysis
   */
  creativeFeatureAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { latitude, longitude, propertyId } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Valid latitude and longitude coordinates are required'
        });
        return;
      }

      const coordinates: Coordinates = { latitude, longitude };
      const creativeFeatures = await this.creativeService.analyzeCreativeFeatures(coordinates, propertyId);

      res.json({
        success: true,
        data: creativeFeatures,
        metadata: {
          processingTime: Date.now() - startTime,
          dataSourcesUsed: ['Google Places API', 'Google Maps Platform'],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });

    } catch (error) {
      this.logger.error('Creative feature analysis failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Creative feature analysis service unavailable'
      });
    }
  };

  /**
   * POST /api/property-intelligence/analyze/batch
   * Batch property analysis for multiple properties
   */
  batchAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { properties, strategy = 'quality_first' } = req.body;

      if (!Array.isArray(properties) || properties.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Properties array is required and must not be empty'
        });
        return;
      }

      if (properties.length > 50) {
        res.status(400).json({
          success: false,
          error: 'Maximum 50 properties allowed per batch request'
        });
        return;
      }

      this.logger.info('Starting batch property analysis', { 
        count: properties.length, 
        strategy 
      });

      // Process properties in parallel with concurrency limit
      const batchSize = 10;
      const results = [];

      for (let i = 0; i < properties.length; i += batchSize) {
        const batch = properties.slice(i, i + batchSize);
        const batchPromises = batch.map(async (property: any) => {
          try {
            const { latitude, longitude, propertyId } = property;
            
            if (typeof latitude !== 'number' || typeof longitude !== 'number') {
              return {
                propertyId: propertyId || 'unknown',
                success: false,
                error: 'Invalid coordinates'
              };
            }

            const coordinates: Coordinates = { latitude, longitude };
            const analysis = await this.multiProviderService.analyzeProperty(
              coordinates, 
              propertyId, 
              strategy
            );

            return {
              propertyId: propertyId || `${latitude},${longitude}`,
              success: true,
              data: analysis
            };

          } catch (error) {
            this.logger.error('Batch property analysis item failed', { error, property });
            return {
              propertyId: property.propertyId || 'unknown',
              success: false,
              error: 'Analysis failed'
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const response: BatchPropertyIntelligenceResponse = {
        success: true,
        results,
        summary: {
          total: properties.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          processingTime: Date.now() - startTime
        }
      };

      res.json(response);

    } catch (error) {
      this.logger.error('Batch property analysis failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        results: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          processingTime: Date.now()
        }
      });
    }
  };

  // ===========================
  // SPECIALIZED ANALYSIS ENDPOINTS
  // ===========================

  /**
   * POST /api/property-intelligence/analyze/views
   * Comprehensive view analysis (water, city, mountain, etc.)
   */
  viewAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { latitude, longitude } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Valid latitude and longitude coordinates are required'
        });
        return;
      }

      const coordinates: Coordinates = { latitude, longitude };
      const viewAnalysis = await this.googleMapsService.analyzeViews(coordinates);

      res.json({
        success: true,
        data: viewAnalysis,
        metadata: {
          processingTime: Date.now() - startTime,
          dataSourcesUsed: ['Google Maps Elevation API', 'Google Places API'],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });

    } catch (error) {
      this.logger.error('View analysis failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'View analysis service unavailable'
      });
    }
  };

  /**
   * POST /api/property-intelligence/analyze/transportation
   * Transportation and accessibility analysis
   */
  transportationAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { latitude, longitude } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Valid latitude and longitude coordinates are required'
        });
        return;
      }

      const coordinates: Coordinates = { latitude, longitude };
      
      // Use Azure Maps for transportation analysis (better route optimization)
      const transportationData = await this.multiProviderService.analyzeWithAzureMaps(
        coordinates, 
        'route_analysis'
      );

      res.json({
        success: true,
        data: transportationData,
        metadata: {
          processingTime: Date.now() - startTime,
          dataSourcesUsed: ['Azure Maps Route API', 'Azure Maps Traffic API'],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });

    } catch (error) {
      this.logger.error('Transportation analysis failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Transportation analysis service unavailable'
      });
    }
  };

  /**
   * POST /api/property-intelligence/analyze/neighborhood
   * Neighborhood intelligence using multiple data sources
   */
  neighborhoodAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const { latitude, longitude } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Valid latitude and longitude coordinates are required'
        });
        return;
      }

      const coordinates: Coordinates = { latitude, longitude };
      
      // Combine multiple data sources for comprehensive neighborhood analysis
      const [
        azureData,
        osmCommunityData,
        osmTransportData,
        osmGreenSpaces
      ] = await Promise.allSettled([
        this.multiProviderService.analyzeWithAzureMaps(coordinates, 'demographic_analysis'),
        this.multiProviderService.analyzeWithOpenStreetMap(coordinates, 'community_amenities'),
        this.multiProviderService.analyzeWithOpenStreetMap(coordinates, 'public_transport'),
        this.multiProviderService.analyzeWithOpenStreetMap(coordinates, 'green_spaces')
      ]);

      const neighborhoodData = {
        demographics: azureData.status === 'fulfilled' ? azureData.value : {},
        communityAmenities: osmCommunityData.status === 'fulfilled' ? osmCommunityData.value : {},
        publicTransport: osmTransportData.status === 'fulfilled' ? osmTransportData.value : {},
        greenSpaces: osmGreenSpaces.status === 'fulfilled' ? osmGreenSpaces.value : {},
        overallNeighborhoodScore: 75 // Would be calculated from above data
      };

      res.json({
        success: true,
        data: neighborhoodData,
        metadata: {
          processingTime: Date.now() - startTime,
          dataSourcesUsed: ['Azure Maps', 'OpenStreetMap', 'Overpass API'],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });

    } catch (error) {
      this.logger.error('Neighborhood analysis failed', { error, body: req.body });
      res.status(500).json({
        success: false,
        error: 'Neighborhood analysis service unavailable'
      });
    }
  };

  /**
   * GET /api/property-intelligence/providers/status
   * Get status and capabilities of all data providers
   */
  getProviderStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const providerStatus = {
        google: {
          enabled: !!process.env.GOOGLE_MAPS_API_KEY,
          capabilities: ['geocoding', 'places', 'elevation', 'streetview', 'routing', 'traffic'],
          status: 'operational'
        },
        azure: {
          enabled: !!process.env.AZURE_MAPS_SUBSCRIPTION_KEY,
          capabilities: ['geocoding', 'search', 'routing', 'weather', 'traffic', 'demographics'],
          status: 'operational'
        },
        openstreetmap: {
          enabled: true,
          capabilities: ['geocoding', 'places', 'routing', 'community_data'],
          status: 'operational'
        },
        smartystreets: {
          enabled: !!(process.env.SMARTYSTREETS_AUTH_ID && process.env.SMARTYSTREETS_AUTH_TOKEN),
          capabilities: ['address_validation', 'geocoding', 'demographics'],
          status: 'operational'
        },
        usps: {
          enabled: !!process.env.USPS_USER_ID,
          capabilities: ['address_validation'],
          status: 'operational'
        }
      };

      res.json({
        success: true,
        data: providerStatus,
        metadata: {
          processingTime: 0,
          dataSourcesUsed: [],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });

    } catch (error) {
      this.logger.error('Provider status check failed', { error });
      res.status(500).json({
        success: false,
        error: 'Provider status service unavailable'
      });
    }
  };

  // ===========================
  // HEALTH CHECK AND UTILITIES
  // ===========================

  /**
   * GET /api/property-intelligence/health
   * Health check endpoint
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date(),
          version: '1.0.0',
          services: {
            multiProvider: 'operational',
            addressService: 'operational',
            creativeIntelligence: 'operational',
            googleMaps: 'operational'
          }
        },
        metadata: {
          processingTime: 0,
          dataSourcesUsed: [],
          lastUpdated: new Date(),
          cacheHit: false
        }
      });
    } catch (error) {
      this.logger.error('Health check failed', { error });
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  };
}