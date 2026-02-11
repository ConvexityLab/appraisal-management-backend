/**
 * Enhanced Property Intelligence V2 Controller
 * 
 * REST API endpoints for Google Places API (New) features:
 * - Comprehensive property analysis with address descriptors
 * - EV charging station finder
 * - Gas station with fuel prices
 * - Accessibility analysis
 * - Sustainability scoring
 * - Moved place tracking
 * - Text search with natural language
 * - Enhanced photo access
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import { EnhancedPropertyIntelligenceV2Service } from '../services/enhanced-property-intelligence-v2.service.js';
import { GooglePlacesNewService } from '../services/google-places-new.service.js';
import { Coordinates } from '../types/geospatial.js';

const router = Router();
const logger = new Logger();
const propertyIntelligenceService = new EnhancedPropertyIntelligenceV2Service();
const placesService = new GooglePlacesNewService();

// ===========================
// VALIDATION HELPERS
// ===========================

const validateCoordinates = () => [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

const handleValidationErrors = (req: Request, res: Response, next: Function): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array()
    });
    return;
  }
  next();
};

// ===========================
// COMPREHENSIVE PROPERTY ANALYSIS
// ===========================

/**
 * POST /api/property-intelligence-v2/analyze
 * 
 * Comprehensive property analysis using Places API (New)
 */
router.post(
  '/analyze',
  [
    ...validateCoordinates(),
    body('propertyAddress').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, propertyAddress } = req.body;
      const coordinates: Coordinates = { latitude, longitude };

      logger.info('Starting property intelligence analysis V2', { coordinates });

      const analysis = await propertyIntelligenceService.analyzeProperty(
        coordinates,
        propertyAddress
      );

      // Flatten amenities for frontend compatibility
      const allNearbyPlaces = [
        ...analysis.amenitiesAnalysis.essential.groceryStores,
        ...analysis.amenitiesAnalysis.essential.schools,
        ...analysis.amenitiesAnalysis.essential.hospitals,
        ...analysis.amenitiesAnalysis.essential.pharmacies,
        ...analysis.amenitiesAnalysis.convenience.restaurants,
        ...analysis.amenitiesAnalysis.convenience.cafes,
        ...analysis.amenitiesAnalysis.convenience.banks,
        ...analysis.amenitiesAnalysis.recreation.parks,
        ...analysis.amenitiesAnalysis.recreation.gyms,
        ...analysis.amenitiesAnalysis.recreation.entertainment,
        ...analysis.amenitiesAnalysis.transportation.transitStations
      ];

      res.json({
        success: true,
        data: {
          ...analysis,
          // Add flattened fields for frontend compatibility
          nearbyPlaces: allNearbyPlaces,
          evCharging: analysis.amenitiesAnalysis.transportation.evChargingStations,
          gasStations: analysis.amenitiesAnalysis.convenience.gasStations
        },
        metadata: {
          analyzedAt: new Date().toISOString(),
          apiVersion: 'v2',
          features: [
            'addressDescriptors',
            'landmarkContext',
            'accessibilityScoring',
            'sustainabilityAnalysis',
            'evChargingInfrastructure',
            'movedPlaceTracking',
            'richMetadata',
            'neighborhoodSummary'
          ]
        }
      });

    } catch (error) {
      logger.error('Property intelligence analysis V2 failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze property',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// ===========================
// PLACE DETAILS
// ===========================

/**
 * GET /api/property-intelligence-v2/place/:placeId
 * 
 * Get detailed information about a specific place
 */
router.get(
  '/place/:placeId',
  [
    query('fields').optional().isString(),
    query('languageCode').optional().isString(),
    query('regionCode').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { placeId } = req.params;
      if (!placeId) {
        return res.status(400).json({
          success: false,
          error: 'Place ID is required'
        });
      }

      const { fields, languageCode, regionCode } = req.query;

      // Parse field mask
      const fieldMask = fields ? parseFieldMask(fields as string) : {
        essentials: true,
        pro: true,
        enterprise: true,
        atmosphere: true
      };

      const placeDetails = await placesService.getPlaceDetails(
        placeId,
        fieldMask,
        {
          languageCode: languageCode as string,
          regionCode: regionCode as string
        }
      );

      if (!placeDetails) {
        return res.status(404).json({
          success: false,
          error: 'Place not found'
        });
      }

      return res.json({
        success: true,
        data: placeDetails
      });

    } catch (error) {
      logger.error('Failed to get place details', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to get place details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/property-intelligence-v2/place/:placeId/moved
 * 
 * Follow moved place chain to get current location
 */
router.get(
  '/place/:placeId/moved',
  async (req: Request, res: Response) => {
    try {
      const { placeId } = req.params;
      if (!placeId) {
        return res.status(400).json({
          success: false,
          error: 'Place ID is required'
        });
      }

      const currentLocation = await placesService.getMovedPlaceDetails(placeId);

      if (!currentLocation) {
        return res.status(404).json({
          success: false,
          error: 'Could not find current location for moved place'
        });
      }

      return res.json({
        success: true,
        data: currentLocation,
        metadata: {
          originalPlaceId: placeId,
          currentPlaceId: currentLocation.id,
          hasMoved: placeId !== currentLocation.id
        }
      });

    } catch (error) {
      logger.error('Failed to track moved place', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to track moved place',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// ===========================
// SEARCH ENDPOINTS
// ===========================

/**
 * POST /api/property-intelligence-v2/search/nearby
 * 
 * Search for places near a location
 */
router.post(
  '/search/nearby',
  [
    ...validateCoordinates(),
    body('includedTypes').optional().isArray(),
    body('excludedTypes').optional().isArray(),
    body('maxResultCount').optional().isInt({ min: 1, max: 20 }),
    body('radiusMeters').optional().isInt({ min: 1, max: 50000 }),
    body('rankPreference').optional().isIn(['DISTANCE', 'POPULARITY'])
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        latitude,
        longitude,
        includedTypes,
        excludedTypes,
        maxResultCount,
        radiusMeters = 5000,
        rankPreference,
        fields
      } = req.body;

      const coordinates: Coordinates = { latitude, longitude };

      const fieldMask = fields ? parseFieldMask(fields) : {
        essentials: true,
        pro: true,
        enterprise: true
      };

      const places = await placesService.searchNearby(
        coordinates,
        {
          includedTypes,
          excludedTypes,
          maxResultCount,
          rankPreference,
          locationRestriction: {
            circle: {
              center: coordinates,
              radius: radiusMeters
            }
          }
        },
        fieldMask
      );

      res.json({
        success: true,
        data: places,
        metadata: {
          resultCount: places.length,
          searchCenter: coordinates,
          radiusMeters
        }
      });

    } catch (error) {
      logger.error('Nearby search failed', { error });
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/property-intelligence-v2/search/text (query params version)
 * 
 * Search for places using natural language query via GET with query parameters
 */
router.get(
  '/search/text',
  [
    query('textQuery').isString().notEmpty(),
    query('latitude').optional().isFloat({ min: -90, max: 90 }),
    query('longitude').optional().isFloat({ min: -180, max: 180 }),
    query('radiusMeters').optional().isInt({ min: 1, max: 50000 }),
    query('maxResultCount').optional().isInt({ min: 1, max: 20 }),
    query('minRating').optional().isFloat({ min: 0, max: 5 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        textQuery,
        latitude,
        longitude,
        radiusMeters,
        maxResultCount,
        minRating,
        openNow,
        priceLevels,
        includedType,
        fields
      } = req.query;

      const fieldMask = fields ? parseFieldMask(fields as string) : {
        essentials: true,
        pro: true,
        enterprise: true
      };

      const searchRequest: any = {
        textQuery,
        maxResultCount: maxResultCount ? Number(maxResultCount) : undefined,
        minRating: minRating ? Number(minRating) : undefined,
        openNow: openNow === 'true',
        priceLevels: priceLevels ? String(priceLevels).split(',') : undefined,
        includedType
      };

      if (latitude && longitude) {
        searchRequest.locationBias = {
          circle: {
            center: { 
              latitude: Number(latitude), 
              longitude: Number(longitude) 
            },
            radius: radiusMeters ? Number(radiusMeters) : 5000
          }
        };
      }

      const places = await placesService.searchText(searchRequest, fieldMask);

      res.json({
        success: true,
        data: places,
        metadata: {
          resultCount: places.length,
          query: textQuery
        }
      });

    } catch (error) {
      logger.error('Text search (GET) failed', { error });
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/property-intelligence-v2/search/text
 * 
 * Search for places using natural language query
 */
router.post(
  '/search/text',
  [
    body('textQuery').isString().notEmpty(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('radiusMeters').optional().isInt({ min: 1, max: 50000 }),
    body('maxResultCount').optional().isInt({ min: 1, max: 20 }),
    body('minRating').optional().isFloat({ min: 0, max: 5 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        textQuery,
        latitude,
        longitude,
        radiusMeters,
        maxResultCount,
        minRating,
        openNow,
        priceLevels,
        includedType,
        fields
      } = req.body;

      const fieldMask = fields ? parseFieldMask(fields) : {
        essentials: true,
        pro: true,
        enterprise: true
      };

      const searchRequest: any = {
        textQuery,
        maxResultCount,
        minRating,
        openNow,
        priceLevels,
        includedType
      };

      if (latitude && longitude) {
        searchRequest.locationBias = {
          circle: {
            center: { latitude, longitude },
            radius: radiusMeters || 5000
          }
        };
      }

      const places = await placesService.searchText(searchRequest, fieldMask);

      res.json({
        success: true,
        data: places,
        metadata: {
          resultCount: places.length,
          query: textQuery
        }
      });

    } catch (error) {
      logger.error('Text search failed', { error });
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/property-intelligence-v2/autocomplete
 * 
 * Get place autocomplete suggestions
 */
router.post(
  '/autocomplete',
  [
    body('input').isString().notEmpty(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('sessionToken').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        input,
        latitude,
        longitude,
        radiusMeters,
        includedPrimaryTypes,
        sessionToken,
        languageCode,
        regionCode
      } = req.body;

      const options: any = {
        languageCode,
        regionCode,
        sessionToken,
        includedPrimaryTypes
      };

      if (latitude && longitude) {
        options.locationBias = {
          circle: {
            center: { latitude, longitude },
            radius: radiusMeters || 50000
          }
        };
      }

      const suggestions = await placesService.autocomplete(input, options);

      res.json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      logger.error('Autocomplete failed', { error });
      res.status(500).json({
        success: false,
        error: 'Autocomplete failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// ===========================
// SPECIALIZED SEARCHES
// ===========================

/**
 * POST /api/property-intelligence-v2/ev-charging
 * 
 * Find EV charging stations near location
 */
router.post(
  '/ev-charging',
  [
    ...validateCoordinates(),
    body('radiusMeters').optional().isInt({ min: 1, max: 50000 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, radiusMeters = 5000 } = req.body;
      const coordinates: Coordinates = { latitude, longitude };

      const stations = await placesService.findEVChargingStations(
        coordinates,
        radiusMeters
      );

      // Calculate statistics
      const totalConnectors = stations.reduce(
        (sum, s) => sum + (s.evChargeOptions?.connectorCount || 0),
        0
      );

      const connectorTypes = new Set(
        stations.flatMap(s => 
          s.evChargeOptions?.connectorAggregation.map(c => c.type) || []
        )
      );

      res.json({
        success: true,
        data: stations,
        metadata: {
          totalStations: stations.length,
          totalConnectors,
          connectorTypes: Array.from(connectorTypes),
          searchRadiusMeters: radiusMeters
        }
      });

    } catch (error) {
      logger.error('EV charging search failed', { error });
      res.status(500).json({
        success: false,
        error: 'EV charging search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/property-intelligence-v2/gas-stations
 * 
 * Find gas stations with fuel prices near location
 */
router.post(
  '/gas-stations',
  [
    ...validateCoordinates(),
    body('radiusMeters').optional().isInt({ min: 1, max: 50000 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, radiusMeters = 5000 } = req.body;
      const coordinates: Coordinates = { latitude, longitude };

      const stations = await placesService.findGasStations(
        coordinates,
        radiusMeters
      );

      // Find cheapest fuel prices
      const allPrices = stations
        .flatMap(s => s.fuelOptions?.fuelPrices || [])
        .filter(p => p.price);

      const cheapestByType: Record<string, any> = {};
      allPrices.forEach(price => {
        if (!cheapestByType[price.type] || 
            parseFloat(price.price.units) < parseFloat(cheapestByType[price.type].price.units)) {
          cheapestByType[price.type] = price;
        }
      });

      res.json({
        success: true,
        data: stations,
        metadata: {
          totalStations: stations.length,
          cheapestPricesByFuelType: cheapestByType,
          searchRadiusMeters: radiusMeters
        }
      });

    } catch (error) {
      logger.error('Gas station search failed', { error });
      res.status(500).json({
        success: false,
        error: 'Gas station search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/property-intelligence-v2/accessible-places
 * 
 * Find wheelchair-accessible places near location
 */
router.post(
  '/accessible-places',
  [
    ...validateCoordinates(),
    body('placeTypes').optional().isArray(),
    body('radiusMeters').optional().isInt({ min: 1, max: 50000 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        latitude,
        longitude,
        placeTypes = ['restaurant', 'grocery_store', 'pharmacy', 'hospital'],
        radiusMeters = 2000
      } = req.body;
      const coordinates: Coordinates = { latitude, longitude };

      const places = await placesService.findAccessiblePlaces(
        coordinates,
        placeTypes,
        radiusMeters
      );

      const accessibilityStats = {
        wheelchairAccessibleEntrance: places.filter(p => 
          p.accessibilityOptions?.wheelchairAccessibleEntrance
        ).length,
        wheelchairAccessibleParking: places.filter(p => 
          p.accessibilityOptions?.wheelchairAccessibleParking
        ).length,
        wheelchairAccessibleRestroom: places.filter(p => 
          p.accessibilityOptions?.wheelchairAccessibleRestroom
        ).length,
        wheelchairAccessibleSeating: places.filter(p => 
          p.accessibilityOptions?.wheelchairAccessibleSeating
        ).length
      };

      res.json({
        success: true,
        data: places,
        metadata: {
          totalAccessiblePlaces: places.length,
          accessibilityStats,
          searchRadiusMeters: radiusMeters
        }
      });

    } catch (error) {
      logger.error('Accessible places search failed', { error });
      res.status(500).json({
        success: false,
        error: 'Accessible places search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// ===========================
// PHOTO ENDPOINTS
// ===========================

/**
 * GET /api/property-intelligence-v2/photo/:photoName
 * 
 * Get place photo URL
 */
router.get(
  '/photo/:photoName(*)',
  [
    query('maxWidthPx').optional().isInt({ min: 1, max: 4800 }),
    query('maxHeightPx').optional().isInt({ min: 1, max: 4800 })
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const photoName = req.params.photoName;
      if (!photoName) {
        return res.status(400).json({
          success: false,
          error: 'Photo name is required'
        });
      }

      const { maxWidthPx, maxHeightPx, skipHttpRedirect } = req.query;

      const options: {
        maxWidthPx?: number;
        maxHeightPx?: number;
        skipHttpRedirect?: boolean;
      } = {};

      if (maxWidthPx) options.maxWidthPx = parseInt(maxWidthPx as string);
      if (maxHeightPx) options.maxHeightPx = parseInt(maxHeightPx as string);
      if (skipHttpRedirect === 'true') options.skipHttpRedirect = true;

      const photoUrl = placesService.getPhotoUrl(photoName, options);

      return res.json({
        success: true,
        data: {
          photoUrl,
          photoName
        }
      });

    } catch (error) {
      logger.error('Failed to get photo URL', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to get photo URL',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// ===========================
// LOCATION ANALYSIS
// ===========================

/**
 * POST /api/property-intelligence-v2/location-context
 * 
 * Get address descriptors and location context
 */
router.post(
  '/location-context',
  [
    ...validateCoordinates(),
    body('propertyAddress').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, propertyAddress } = req.body;
      const coordinates: Coordinates = { latitude, longitude };

      const locationData = await placesService.analyzePropertyLocation(
        coordinates,
        propertyAddress
      );

      res.json({
        success: true,
        data: locationData,
        metadata: {
          landmarkCount: locationData.nearbyLandmarks.length,
          containingAreaCount: locationData.containingAreas.length,
          hasAddressDescriptor: !!locationData.addressDescriptor
        }
      });

    } catch (error) {
      logger.error('Location context analysis failed', { error });
      res.status(500).json({
        success: false,
        error: 'Location context analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// ===========================
// HELPER FUNCTIONS
// ===========================

function parseFieldMask(fields: string): any {
  const fieldMask: any = {};
  
  if (fields.includes('basic')) fieldMask.basic = true;
  if (fields.includes('essentials')) fieldMask.essentials = true;
  if (fields.includes('pro')) fieldMask.pro = true;
  if (fields.includes('enterprise')) fieldMask.enterprise = true;
  if (fields.includes('atmosphere')) fieldMask.atmosphere = true;
  
  // Custom fields
  const customFieldsMatch = fields.match(/custom\[(.*?)\]/);
  if (customFieldsMatch && customFieldsMatch[1]) {
    fieldMask.customFields = customFieldsMatch[1].split(',').map(f => f.trim());
  }
  
  return fieldMask;
}

export default router;
