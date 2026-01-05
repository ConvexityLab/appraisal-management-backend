/**
 * Enhanced Property Intelligence Routes
 * 
 * Express.js route definitions for comprehensive property intelligence API
 * Integrates multiple geospatial data providers with intelligent failover
 */

import { Router } from 'express';
import { EnhancedPropertyIntelligenceController } from '../controllers/enhanced-property-intelligence.controller';
import { validateCoordinates, validateAddress, validateBatchRequest } from '../middleware/validation.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { Logger } from '../utils/logger.js';

const router = Router();
const controller = new EnhancedPropertyIntelligenceController();
const logger = new Logger();

// Middleware for all property intelligence routes
router.use((req, res, next) => {
  logger.info('Property Intelligence API Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// ===========================
// ADDRESS SERVICES ROUTES
// ===========================

/**
 * POST /address/geocode
 * Multi-provider address geocoding with intelligent fallback
 * Rate limited to 100 requests per minute per IP
 */
router.post('/address/geocode', 
  rateLimiter(100), 
  validateAddress,
  controller.geocodeAddress
);

/**
 * POST /address/validate
 * Comprehensive address validation using SmartyStreets, USPS, Google
 * Rate limited to 50 requests per minute per IP
 */
router.post('/address/validate', 
  rateLimiter(50), 
  validateAddress,
  controller.validateAddress
);

/**
 * POST /address/reverse-geocode
 * Convert coordinates to address components
 * Rate limited to 100 requests per minute per IP
 */
router.post('/address/reverse-geocode', 
  rateLimiter(100),
  validateCoordinates,
  controller.reverseGeocode
);

/**
 * GET /address/suggest
 * Address autocomplete suggestions
 * Rate limited to 200 requests per minute per IP
 * Query parameters: q (required), limit (optional, default 5)
 */
router.get('/address/suggest', 
  rateLimiter(200),
  controller.suggestAddresses
);

// ===========================
// COMPREHENSIVE ANALYSIS ROUTES
// ===========================

/**
 * POST /analyze/comprehensive
 * Complete property intelligence analysis using all available providers
 * Rate limited to 20 requests per minute per IP (expensive operation)
 * Includes: location characteristics, view analysis, creative features, demographics
 */
router.post('/analyze/comprehensive', 
  rateLimiter(20),
  validateCoordinates,
  controller.comprehensiveAnalysis
);

/**
 * POST /analyze/creative-features
 * Creative property characteristics analysis
 * Rate limited to 30 requests per minute per IP
 * Includes: lifestyle scoring, instagrammability, coffee accessibility, unique features
 */
router.post('/analyze/creative-features', 
  rateLimiter(30),
  validateCoordinates,
  controller.creativeFeatureAnalysis
);

/**
 * POST /analyze/batch
 * Batch property analysis for multiple properties (up to 50 per request)
 * Rate limited to 5 requests per minute per IP (very expensive operation)
 */
router.post('/analyze/batch', 
  rateLimiter(5),
  validateBatchRequest,
  controller.batchAnalysis
);

// ===========================
// SPECIALIZED ANALYSIS ROUTES
// ===========================

/**
 * POST /analyze/views
 * Comprehensive view analysis using Google Maps Elevation API
 * Rate limited to 50 requests per minute per IP
 * Analyzes: water views, city views, mountain views, nature views
 */
router.post('/analyze/views', 
  rateLimiter(50),
  validateCoordinates,
  controller.viewAnalysis
);

/**
 * POST /analyze/transportation
 * Transportation and accessibility analysis using Azure Maps
 * Rate limited to 40 requests per minute per IP
 * Includes: route optimization, traffic analysis, public transport access
 */
router.post('/analyze/transportation', 
  rateLimiter(40),
  validateCoordinates,
  controller.transportationAnalysis
);

/**
 * POST /analyze/neighborhood
 * Neighborhood intelligence using multiple data sources
 * Rate limited to 30 requests per minute per IP
 * Combines: Azure Maps demographics, OpenStreetMap community data, transit analysis
 */
router.post('/analyze/neighborhood', 
  rateLimiter(30),
  validateCoordinates,
  controller.neighborhoodAnalysis
);

// ===========================
// UTILITY ROUTES
// ===========================

/**
 * GET /providers/status
 * Get status and capabilities of all data providers
 * Rate limited to 20 requests per minute per IP
 * Returns availability of Google, Azure, OpenStreetMap, SmartyStreets, USPS
 */
router.get('/providers/status', 
  rateLimiter(20),
  controller.getProviderStatus
);

/**
 * GET /health
 * Health check endpoint for monitoring
 * No rate limiting for monitoring systems
 */
router.get('/health', controller.healthCheck);

// Error handling middleware for property intelligence routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Property Intelligence API Error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body
  });

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    error: isDevelopment ? error.message : 'Internal server error',
    metadata: {
      processingTime: 0,
      dataSourcesUsed: [],
      lastUpdated: new Date(),
      cacheHit: false
    }
  });
});

// ===========================
// CENSUS INTELLIGENCE ROUTES
// ===========================

/**
 * POST /census/demographics
 * Get comprehensive demographic analysis using U.S. Census data
 * Rate limited to 30 requests per minute per IP
 */
router.post('/census/demographics',
  rateLimiter(30),
  validateCoordinates,
  controller.getCensusDemographics
);

/**
 * POST /census/economics  
 * Get economic vitality analysis using Census economic data
 * Rate limited to 30 requests per minute per IP
 */
router.post('/census/economics',
  rateLimiter(30),
  validateCoordinates,
  controller.getCensusEconomics
);

/**
 * POST /census/housing
 * Get housing market analysis using Census housing data
 * Rate limited to 30 requests per minute per IP
 */
router.post('/census/housing',
  rateLimiter(30),
  validateCoordinates,
  controller.getCensusHousing
);

/**
 * POST /census/comprehensive
 * Get comprehensive Census intelligence analysis combining demographics, economics, and housing
 * Rate limited to 20 requests per minute per IP (more intensive analysis)
 */
router.post('/census/comprehensive',
  rateLimiter(20),
  validateCoordinates,
  controller.getComprehensiveCensusIntelligence
);

export { router as enhancedPropertyIntelligenceRoutes };