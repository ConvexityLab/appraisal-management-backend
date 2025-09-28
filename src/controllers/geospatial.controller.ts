import express, { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
import { GeospatialRiskService } from '../services/geospatial-risk.service.js';
import { 
  Coordinates,
  PropertyRiskAssessment,
  BatchRiskAssessmentRequest,
  GeospatialApiResponse 
} from '../types/geospatial.js';

/**
 * Geospatial Risk Assessment API Controller
 * 
 * Comprehensive RESTful API for property risk assessment including:
 * - FEMA flood zone analysis
 * - Natural disaster risk evaluation
 * - Environmental hazard assessment
 * - Historical designation checks
 * - Tribal land identification
 * - Census and demographic data
 */
export class GeospatialController {
  private geospatialService: GeospatialRiskService;
  private logger: Logger;

  constructor() {
    this.geospatialService = new GeospatialRiskService();
    this.logger = new Logger();

    // Bind methods to preserve 'this' context
    this.assessPropertyRisk = this.assessPropertyRisk.bind(this);
    this.batchAssessRisk = this.batchAssessRisk.bind(this);
    this.getFloodZone = this.getFloodZone.bind(this);
    this.getTribalLandInfo = this.getTribalLandInfo.bind(this);
    this.getEnvironmentalRisk = this.getEnvironmentalRisk.bind(this);
    this.getCensusData = this.getCensusData.bind(this);
  }

  /**
   * POST /api/geospatial/risk-assessment - Comprehensive property risk assessment
   */
  async assessPropertyRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { coordinates, propertyId } = req.body;

      // Validate coordinates
      if (!coordinates || typeof coordinates.latitude !== 'number' || typeof coordinates.longitude !== 'number') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_COORDINATES',
            message: 'Valid latitude and longitude coordinates are required',
            timestamp: new Date()
          }
        });
        return;
      }

      // Validate coordinate ranges
      if (coordinates.latitude < -90 || coordinates.latitude > 90 ||
          coordinates.longitude < -180 || coordinates.longitude > 180) {
        res.status(400).json({
          success: false,
          error: {
            code: 'COORDINATES_OUT_OF_RANGE',
            message: 'Coordinates must be within valid geographic ranges',
            timestamp: new Date()
          }
        });
        return;
      }

      this.logger.info('Processing comprehensive risk assessment', { 
        coordinates, 
        propertyId,
        userAgent: req.get('User-Agent')
      });

      const result = await this.geospatialService.assessPropertyRisks(coordinates, propertyId);

      if (result.success && result.data) {
        this.logger.info('Risk assessment completed successfully', { 
          coordinates,
          overallRiskScore: result.data.overallRiskScore,
          processingTime: result.metadata?.processingTime
        });
        res.json(result);
      } else {
        this.logger.error('Risk assessment failed', { error: result.error, coordinates });
        res.status(500).json(result);
      }

    } catch (error) {
      this.logger.error('Error in risk assessment endpoint', { error, body: req.body });
      next(error);
    }
  }

  /**
   * POST /api/geospatial/batch-risk-assessment - Batch property risk assessment
   */
  async batchAssessRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const batchRequest: BatchRiskAssessmentRequest = req.body;

      // Validate batch request
      if (!batchRequest.properties || !Array.isArray(batchRequest.properties) || batchRequest.properties.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_BATCH_REQUEST',
            message: 'Properties array is required and cannot be empty',
            timestamp: new Date()
          }
        });
        return;
      }

      // Limit batch size
      if (batchRequest.properties.length > 100) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BATCH_SIZE_EXCEEDED',
            message: 'Maximum batch size is 100 properties',
            timestamp: new Date()
          }
        });
        return;
      }

      // Validate each property's coordinates
      for (let i = 0; i < batchRequest.properties.length; i++) {
        const property = batchRequest.properties[i];
        if (!property || !property.coordinates || 
            typeof property.coordinates.latitude !== 'number' || 
            typeof property.coordinates.longitude !== 'number') {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PROPERTY_COORDINATES',
              message: `Property at index ${i} has invalid coordinates`,
              timestamp: new Date()
            }
          });
          return;
        }
      }

      this.logger.info('Processing batch risk assessment', { 
        propertyCount: batchRequest.properties.length,
        includeDetails: batchRequest.includeDetails
      });

      const result = await this.geospatialService.batchAssessPropertyRisks(batchRequest);

      this.logger.info('Batch risk assessment completed', {
        total: result.summary.total,
        successful: result.summary.successful,
        failed: result.summary.failed,
        processingTime: result.summary.processingTime
      });

      res.json(result);

    } catch (error) {
      this.logger.error('Error in batch risk assessment endpoint', { error, body: req.body });
      next(error);
    }
  }

  /**
   * GET /api/geospatial/flood-zone?lat=...&lng=... - Get FEMA flood zone information
   */
  async getFloodZone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_COORDINATES',
            message: 'Both lat and lng query parameters are required',
            timestamp: new Date()
          }
        });
        return;
      }

      const coordinates: Coordinates = {
        latitude: parseFloat(lat as string),
        longitude: parseFloat(lng as string)
      };

      // Validate parsed coordinates
      if (isNaN(coordinates.latitude) || isNaN(coordinates.longitude)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_COORDINATE_FORMAT',
            message: 'Coordinates must be valid numbers',
            timestamp: new Date()
          }
        });
        return;
      }

      this.logger.info('Fetching flood zone data', { coordinates });

      const result = await this.geospatialService.assessPropertyRisks(coordinates);

      if (result.success && result.data) {
        // Extract only flood-related data
        const floodData = {
          coordinates,
          floodRisk: result.data.floodRisk,
          overallRiskScore: result.data.overallRiskScore,
          insuranceRequirements: result.data.insuranceRequirements.filter(req => req.type === 'flood'),
          lastAssessed: result.data.lastAssessed
        };

        res.json({
          success: true,
          data: floodData,
          metadata: result.metadata
        });
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      this.logger.error('Error in flood zone endpoint', { error, query: req.query });
      next(error);
    }
  }

  /**
   * GET /api/geospatial/tribal-land?lat=...&lng=... - Get tribal land information
   */
  async getTribalLandInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_COORDINATES',
            message: 'Both lat and lng query parameters are required',
            timestamp: new Date()
          }
        });
        return;
      }

      const coordinates: Coordinates = {
        latitude: parseFloat(lat as string),
        longitude: parseFloat(lng as string)
      };

      if (isNaN(coordinates.latitude) || isNaN(coordinates.longitude)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_COORDINATE_FORMAT',
            message: 'Coordinates must be valid numbers',
            timestamp: new Date()
          }
        });
        return;
      }

      this.logger.info('Fetching tribal land data', { coordinates });

      const result = await this.geospatialService.assessPropertyRisks(coordinates);

      if (result.success && result.data) {
        const tribalData = {
          coordinates,
          tribalLandData: result.data.tribalLandData,
          regulatoryCompliance: result.data.regulatoryCompliance.filter(req => 
            req.authority.toLowerCase().includes('tribal')
          ),
          lastAssessed: result.data.lastAssessed
        };

        res.json({
          success: true,
          data: tribalData,
          metadata: result.metadata
        });
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      this.logger.error('Error in tribal land endpoint', { error, query: req.query });
      next(error);
    }
  }

  /**
   * GET /api/geospatial/environmental-risk?lat=...&lng=... - Get environmental risk assessment
   */
  async getEnvironmentalRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_COORDINATES',
            message: 'Both lat and lng query parameters are required',
            timestamp: new Date()
          }
        });
        return;
      }

      const coordinates: Coordinates = {
        latitude: parseFloat(lat as string),
        longitude: parseFloat(lng as string)
      };

      if (isNaN(coordinates.latitude) || isNaN(coordinates.longitude)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_COORDINATE_FORMAT',
            message: 'Coordinates must be valid numbers',
            timestamp: new Date()
          }
        });
        return;
      }

      this.logger.info('Fetching environmental risk data', { coordinates });

      const result = await this.geospatialService.assessPropertyRisks(coordinates);

      if (result.success && result.data) {
        const environmentalData = {
          coordinates,
          environmentalRisk: result.data.environmentalRisk,
          disasterRisk: result.data.disasterRisk,
          riskCategories: result.data.riskCategories.filter(cat => 
            cat.category === 'environmental' || cat.category === 'disaster'
          ),
          lastAssessed: result.data.lastAssessed
        };

        res.json({
          success: true,
          data: environmentalData,
          metadata: result.metadata
        });
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      this.logger.error('Error in environmental risk endpoint', { error, query: req.query });
      next(error);
    }
  }

  /**
   * GET /api/geospatial/census-data?lat=...&lng=... - Get census and demographic data
   */
  async getCensusData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_COORDINATES',
            message: 'Both lat and lng query parameters are required',
            timestamp: new Date()
          }
        });
        return;
      }

      const coordinates: Coordinates = {
        latitude: parseFloat(lat as string),
        longitude: parseFloat(lng as string)
      };

      if (isNaN(coordinates.latitude) || isNaN(coordinates.longitude)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_COORDINATE_FORMAT',
            message: 'Coordinates must be valid numbers',
            timestamp: new Date()
          }
        });
        return;
      }

      this.logger.info('Fetching census data', { coordinates });

      const result = await this.geospatialService.assessPropertyRisks(coordinates);

      if (result.success && result.data) {
        const censusData = {
          coordinates,
          censusData: result.data.censusData,
          lastAssessed: result.data.lastAssessed
        };

        res.json({
          success: true,
          data: censusData,
          metadata: result.metadata
        });
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      this.logger.error('Error in census data endpoint', { error, query: req.query });
      next(error);
    }
  }
}

/**
 * Create Express router with geospatial risk assessment endpoints
 */
export function createGeospatialRouter(): express.Router {
  const router = express.Router();
  const controller = new GeospatialController();

  // Comprehensive risk assessment endpoints
  router.post('/risk-assessment', controller.assessPropertyRisk);
  router.post('/batch-risk-assessment', controller.batchAssessRisk);

  // Specific risk component endpoints
  router.get('/flood-zone', controller.getFloodZone);
  router.get('/tribal-land', controller.getTribalLandInfo);
  router.get('/environmental-risk', controller.getEnvironmentalRisk);
  router.get('/census-data', controller.getCensusData);

  return router;
}