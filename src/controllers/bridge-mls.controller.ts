import { Request, Response, Router } from 'express';
import { BridgeInteractiveService } from '../services/bridge-interactive.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();
const bridgeService = new BridgeInteractiveService();

/**
 * Bridge Interactive MLS API Controller
 * Provides endpoints for MLS data, comparables, and market statistics
 */

export function createBridgeMlsRouter(): Router {
  const router = Router();

  /**
   * GET /api/bridge-mls/datasets
   * Get available MLS datasets for the authenticated application
   */
  router.get('/datasets', async (req: Request, res: Response) => {
    try {
      const datasets = await bridgeService.getAvailableDatasets();

      res.json({
        success: true,
        count: datasets.length,
        datasets,
      });
    } catch (error: any) {
      logger.error('Failed to get datasets', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve datasets',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/bridge-mls/active-listings
   * Get active listings near a location
   */
  router.post('/active-listings', async (req: Request, res: Response) => {
    try {
      const {
        latitude,
        longitude,
        radiusMiles,
        minPrice,
        maxPrice,
        propertyType,
        limit,
        datasetId,
      } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: latitude, longitude',
        });
      }

      const listings = await bridgeService.getActiveListings({
        latitude,
        longitude,
        radiusMiles,
        minPrice,
        maxPrice,
        propertyType,
        limit,
        datasetId,
      });

      return res.json({
        success: true,
        count: listings.length,
        listings,
      });
    } catch (error: any) {
      logger.error('Failed to get active listings', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve active listings',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/bridge-mls/sold-comps
   * Get sold comparables for property valuation
   */
  router.post('/sold-comps', async (req: Request, res: Response) => {
    try {
      const {
        latitude,
        longitude,
        radiusMiles,
        minPrice,
        maxPrice,
        minBeds,
        maxBeds,
        minBaths,
        maxBaths,
        minSqft,
        maxSqft,
        soldWithinDays,
        propertyType,
        limit,
        datasetId,
      } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: latitude, longitude',
        });
      }

      const comps = await bridgeService.getSoldComps({
        latitude,
        longitude,
        radiusMiles,
        minPrice,
        maxPrice,
        minBeds,
        maxBeds,
        minBaths,
        maxBaths,
        minSqft,
        maxSqft,
        soldWithinDays,
        propertyType,
        limit,
        datasetId,
      });

      return res.json({
        success: true,
        count: comps.length,
        comps,
      });
    } catch (error: any) {
      logger.error('Failed to get sold comps', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve sold comparables',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/bridge-mls/search-address
   * Search properties by address
   */
  router.post('/search-address', async (req: Request, res: Response) => {
    try {
      const { address, datasetId } = req.body;

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: address',
        });
      }

      const results = await bridgeService.searchByAddress({
        address,
        datasetId,
      });

      return res.json({
        success: true,
        count: results.length,
        properties: results,
      });
    } catch (error: any) {
      logger.error('Failed to search by address', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to search by address',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/bridge-mls/property/:listingKey
   * Get property details by ListingKey
   */
  router.get('/property/:listingKey', async (req: Request, res: Response) => {
    try {
      const { listingKey } = req.params;
      const { datasetId, includeMedia } = req.query;

      const property = await bridgeService.getPropertyByKey({
        listingKey: listingKey!,
        datasetId: datasetId as string,
        includeMedia: includeMedia !== 'false',
      });

      res.json({
        success: true,
        property,
      });
    } catch (error: any) {
      logger.error('Failed to get property', { error, listingKey: req.params.listingKey });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve property',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/bridge-mls/market-stats
   * Get market statistics for an area
   */
  router.post('/market-stats', async (req: Request, res: Response) => {
    try {
      const {
        latitude,
        longitude,
        radiusMiles,
        propertyType,
        datasetId,
      } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: latitude, longitude',
        });
      }

      const stats = await bridgeService.getMarketStats({
        latitude,
        longitude,
        radiusMiles,
        propertyType,
        datasetId,
      });

      return res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      logger.error('Failed to get market stats', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve market statistics',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/bridge-mls/member/:memberKey
   * Get listing agent/member information
   */
  router.get('/member/:memberKey', async (req: Request, res: Response) => {
    try {
      const { memberKey } = req.params;
      const { datasetId } = req.query;

      const member = await bridgeService.getMemberInfo({
        memberKey: memberKey!,
        datasetId: datasetId as string,
      });

      res.json({
        success: true,
        member,
      });
    } catch (error: any) {
      logger.error('Failed to get member info', { error, memberKey: req.params.memberKey });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve member information',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/bridge-mls/office/:officeKey
   * Get office information
   */
  router.get('/office/:officeKey', async (req: Request, res: Response) => {
    try {
      const { officeKey } = req.params;
      const { datasetId } = req.query;

      const office = await bridgeService.getOfficeInfo({
        officeKey: officeKey!,
        datasetId: datasetId as string,
      });

      res.json({
        success: true,
        office,
      });
    } catch (error: any) {
      logger.error('Failed to get office info', { error, officeKey: req.params.officeKey });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve office information',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/bridge-mls/metadata/:datasetId
   * Get metadata for a dataset (RESO fields and lookup values)
   */
  router.get('/metadata/:datasetId', async (req: Request, res: Response) => {
    try {
      const { datasetId } = req.params;

      const metadata = await bridgeService.getMetadata(datasetId);

      // Return XML metadata
      res.setHeader('Content-Type', 'application/xml');
      res.send(metadata);
    } catch (error: any) {
      logger.error('Failed to get metadata', { error, datasetId: req.params.datasetId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metadata',
        message: error.message,
      });
    }
  });

  // ==================================================================================
  // PUBLIC RECORDS ENDPOINTS
  // ==================================================================================

  /**
   * POST /api/bridge-mls/parcels/search
   * Search parcels by address or coordinates
   */
  router.post('/parcels/search', async (req: Request, res: Response) => {
    try {
      const { address, apn, zpid, latitude, longitude, limit } = req.body;

      const results = await bridgeService.searchParcels({
        address,
        apn,
        zpid,
        latitude,
        longitude,
        limit,
      });

      res.json({
        success: true,
        parcels: results,
      });
    } catch (error: any) {
      logger.error('Failed to search parcels', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to search parcels',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/bridge-mls/parcels/:parcelId
   * Get parcel details by ID
   */
  router.get('/parcels/:parcelId', async (req: Request, res: Response) => {
    try {
      const { parcelId } = req.params;
      const parcel = await bridgeService.getParcelById(parcelId!);

      res.json({
        success: true,
        parcel,
      });
    } catch (error: any) {
      logger.error('Failed to get parcel', { error, parcelId: req.params.parcelId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve parcel',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/bridge-mls/parcels/:parcelId/assessments
   * Get tax assessments for a parcel
   */
  router.get('/parcels/:parcelId/assessments', async (req: Request, res: Response) => {
    try {
      const { parcelId } = req.params;
      const assessments = await bridgeService.getParcelAssessments(parcelId!);

      res.json({
        success: true,
        assessments,
      });
    } catch (error: any) {
      logger.error('Failed to get assessments', { error, parcelId: req.params.parcelId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve assessments',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/bridge-mls/parcels/:parcelId/transactions
   * Get transaction history for a parcel
   */
  router.get('/parcels/:parcelId/transactions', async (req: Request, res: Response) => {
    try {
      const { parcelId } = req.params;
      const transactions = await bridgeService.getParcelTransactions(parcelId!);

      res.json({
        success: true,
        transactions,
      });
    } catch (error: any) {
      logger.error('Failed to get transactions', { error, parcelId: req.params.parcelId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transactions',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/bridge-mls/assessments/search
   * Search tax assessments
   */
  router.post('/assessments/search', async (req: Request, res: Response) => {
    try {
      const { address, zpid, year, minValue, maxValue, limit } = req.body;

      const results = await bridgeService.searchAssessments({
        address,
        zpid,
        year,
        minValue,
        maxValue,
        limit,
      });

      res.json({
        success: true,
        assessments: results,
      });
    } catch (error: any) {
      logger.error('Failed to search assessments', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to search assessments',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/bridge-mls/transactions/search
   * Search property transactions
   */
  router.post('/transactions/search', async (req: Request, res: Response) => {
    try {
      const { address, zpid, startDate, endDate, minPrice, maxPrice, limit } = req.body;

      const results = await bridgeService.searchTransactions({
        address,
        zpid,
        startDate,
        endDate,
        minPrice,
        maxPrice,
        limit,
      });

      res.json({
        success: true,
        transactions: results,
      });
    } catch (error: any) {
      logger.error('Failed to search transactions', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to search transactions',
        message: error.message,
      });
    }
  });

  // ==================================================================================
  // ZESTIMATES ENDPOINTS
  // ==================================================================================

  /**
   * POST /api/bridge-mls/zestimate
   * Get Zestimate by address or ZPID
   */
  router.post('/zestimate', async (req: Request, res: Response) => {
    try {
      const { address, zpid, zpids } = req.body;

      if (!address && !zpid && !zpids) {
        return res.status(400).json({
          success: false,
          error: 'Address, zpid, or zpids required',
        });
      }

      const results = await bridgeService.getZestimate({
        address,
        zpid,
        zpids,
      });

      return res.json({
        success: true,
        zestimates: results,
      });
    } catch (error: any) {
      logger.error('Failed to get Zestimate', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve Zestimate',
        message: error.message,
      });
    }
  });

  // ==================================================================================
  // MARKET DATA ENDPOINTS
  // ==================================================================================

  /**
   * POST /api/bridge-mls/market-report
   * Get Zillow Group market report
   */
  router.post('/market-report', async (req: Request, res: Response) => {
    try {
      const { stateCodeFIPS, regionId, metricType } = req.body;

      const results = await bridgeService.getMarketReport({
        stateCodeFIPS,
        regionId,
        metricType,
      });

      res.json({
        success: true,
        report: results,
      });
    } catch (error: any) {
      logger.error('Failed to get market report', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve market report',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/bridge-mls/region
   * Get region metadata
   */
  router.post('/region', async (req: Request, res: Response) => {
    try {
      const { stateCodeFIPS, regionId } = req.body;

      const results = await bridgeService.getRegion({
        stateCodeFIPS,
        regionId,
      });

      res.json({
        success: true,
        region: results,
      });
    } catch (error: any) {
      logger.error('Failed to get region', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve region',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/bridge-mls/metric-types
   * Get available metric types
   */
  router.get('/metric-types', async (req: Request, res: Response) => {
    try {
      const { key } = req.query;
      const results = await bridgeService.getMetricType(key as string);

      res.json({
        success: true,
        metricTypes: results,
      });
    } catch (error: any) {
      logger.error('Failed to get metric types', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metric types',
        message: error.message,
      });
    }
  });

  // ==================================================================================
  // AGENT REVIEWS ENDPOINTS
  // ==================================================================================

  /**
   * GET /api/bridge-mls/reviews
   * Get agent reviews
   */
  router.get('/reviews', async (req: Request, res: Response) => {
    try {
      const { revieweeKey, revieweeEmail, limit } = req.query;

      const limitNum = limit ? parseInt(limit as string) : undefined;
      const params: any = {
        revieweeKey: revieweeKey as string,
        revieweeEmail: revieweeEmail as string
      };
      if (limitNum !== undefined) params.limit = limitNum;
      const results = await bridgeService.getAgentReviews(params);

      res.json({
        success: true,
        count: results.length,
        reviews: results,
      });
    } catch (error: any) {
      logger.error('Failed to get reviews', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve reviews',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/bridge-mls/reviewees
   * Get agents with reviews
   */
  router.get('/reviewees', async (req: Request, res: Response) => {
    try {
      const { email, expandReviews, limit } = req.query;

      const limitNum = limit ? parseInt(limit as string) : undefined;
      const params: any = {
        email: email as string,
        expandReviews: expandReviews === 'true'
      };
      if (limitNum !== undefined) params.limit = limitNum;
      const results = await bridgeService.getReviewees(params);

      res.json({
        success: true,
        count: results.length,
        reviewees: results,
      });
    } catch (error: any) {
      logger.error('Failed to get reviewees', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve reviewees',
        message: error.message,
      });
    }
  });

  return router;
}
