/**
 * Reports Controller
 * Handles property valuation reports and comparable properties (comps)
 * 
 * Migrated from Function Apps:
 * - getReport.js
 * - upsertReport.js
 * - runInteractiveAvm.js
 * - getPdfReport.js
 * - uploadPdfReport.js
 * - addCustomComp.js
 * - getDataFromBlobStorage.js
 * - geocodeAddress.js
 */

import { Router, Request, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

export function createReportsRouter(dbService: CosmosDbService): Router {
  const router = Router();

  // ============================================
  // Report Endpoints
  // ============================================

  /**
   * GET /api/reports/:reportId
   * Get report by ID
   * Migrated from: getReport.js
   */
  router.get('/:reportId', async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        return res.status(400).json({ error: 'reportId is required' });
      }

      logger.info(`Fetching report: ${reportId}`);

      // Query Cosmos DB
      const container = dbService.getContainer('reporting');
      const querySpec = {
        query: 'SELECT * FROM f WHERE f.id = @reportId',
        parameters: [{ name: '@reportId', value: reportId }]
      };

      const { resources: results } = await container.items
        .query(querySpec)
        .fetchAll();

      if (!results || results.length === 0) {
        logger.warn(`Report not found: ${reportId}`);
        return res.status(404).json({ error: 'Report not found' });
      }

      const report = results[0];
      logger.info(`Report retrieved successfully: ${reportId}`);

      return res.status(200).json(report);

    } catch (error: any) {
      logger.error('Error fetching report:', error);
      return res.status(500).json({
        error: 'Failed to fetch report',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/reports/:reportId
   * Create or update report
   * Migrated from: upsertReport.js
   */
  router.put('/:reportId', async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const reportData = req.body;

      if (!reportId) {
        return res.status(400).json({ error: 'reportId is required' });
      }

      if (!reportData || typeof reportData !== 'object') {
        return res.status(400).json({ error: 'reportData is required and must be an object' });
      }

      logger.info(`Upserting report: ${reportId}`);

      // Ensure id matches route parameter
      reportData.id = reportId;

      // Ensure reportRecordId exists
      if (!reportData.reportRecordId) {
        reportData.reportRecordId = reportId;
      }

      // Add timestamps
      const now = new Date().toISOString();
      if (!reportData.createdAt) {
        reportData.createdAt = now;
      }
      reportData.updatedAt = now;

      // Upsert to Cosmos DB
      const container = dbService.getContainer('reporting');
      const { resource: upsertedReport } = await container.items.upsert(reportData);

      logger.info(`Report upserted successfully: ${reportId}`);

      return res.status(200).json(upsertedReport);

    } catch (error: any) {
      logger.error('Error upserting report:', error);
      return res.status(500).json({
        error: 'Failed to upsert report',
        message: error.message
      });
    }
  });

  /**
   * POST /api/reports/:reportId/valuation
   * Run Interactive AVM (Automated Valuation Model)
   * Migrated from: runInteractiveAvm.js
   * Uses actual computeValueEstimate logic from selectComps.js
   */
  router.post('/:reportId/valuation', async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const reportData = req.body;

      if (!reportId) {
        return res.status(400).json({ error: 'reportId is required' });
      }

      if (!reportData || !reportData.compsData || !reportData.propertyData) {
        return res.status(400).json({ error: 'reportData with compsData and propertyData is required' });
      }

      logger.info(`Running AVM for report: ${reportId}`);

      // Extract data needed for valuation calculation
      const subjectData = reportData.propertyData?.compAnalysis;
      const subjectGla = subjectData?.dataValues?.livingArea;
      const compsData = reportData.compsData;

      if (!subjectGla || !compsData) {
        return res.status(400).json({ error: 'Missing required data for valuation' });
      }

      // Initialize arrays for price calculations
      const compsPricePerSqft: number[] = [];
      const compsPricePerSqftMin: number[] = [];
      const compsPricePerSqftMax: number[] = [];
      const compsConfScore: number[] = [];

      // Process each comp - ONLY SOLD comps (not List comps, not Subject)
      compsData.forEach((comp: any) => {
        // Skip if not a sold comp
        if (
          !comp.selectedCompFlag ||
          comp.selectedCompFlag === '' ||
          comp.selectedCompFlag === 'Subject' ||
          comp.selectedCompFlag.startsWith('L')
        ) {
          return;
        }

        // Get comp data
        const compLivingArea = comp.compAnalysis?.dataValues?.livingArea;
        const compValuation = comp.valuation;

        if (!compValuation || !compLivingArea || isNaN(compLivingArea)) {
          return;
        }

        // Get Total Adjustment Value for this comp
        let totalAdj = 0;
        if (comp?.compAnalysis?.adjustments?.totalAdj) {
          totalAdj = Number(comp.compAnalysis.adjustments.totalAdj);
        }

        // Calculate price per sqft with adjustments
        // AVM value
        if (typeof compValuation.estimatedValue === 'number' && !isNaN(compValuation.estimatedValue)) {
          compsPricePerSqft.push(
            (compValuation.estimatedValue + totalAdj) / compLivingArea
          );
        }

        // Minimum AVM value
        if (typeof compValuation.priceRangeMin === 'number' && !isNaN(compValuation.priceRangeMin)) {
          compsPricePerSqftMin.push(
            (compValuation.priceRangeMin + totalAdj) / compLivingArea
          );
        }

        // Maximum AVM value
        if (typeof compValuation.priceRangeMax === 'number' && !isNaN(compValuation.priceRangeMax)) {
          compsPricePerSqftMax.push(
            (compValuation.priceRangeMax + totalAdj) / compLivingArea
          );
        }

        // Confidence score
        if (typeof compValuation.confidenceScore === 'number' && !isNaN(compValuation.confidenceScore)) {
          compsConfScore.push(compValuation.confidenceScore);
        }
      });

      // Calculate final valuation
      const finalValuation: any = {};

      // Estimated Value (average price per sqft * subject GLA)
      if (compsPricePerSqft.length > 0) {
        const avgPricePerSqft = compsPricePerSqft.reduce((a, b) => a + b, 0) / compsPricePerSqft.length;
        finalValuation.estimatedValue = (avgPricePerSqft * subjectGla).toFixed(2);
      } else {
        finalValuation.estimatedValue = null;
      }

      // Lower Bound
      if (compsPricePerSqftMin.length > 0) {
        const avgPricePerSqftMin = compsPricePerSqftMin.reduce((a, b) => a + b, 0) / compsPricePerSqftMin.length;
        finalValuation.lowerBound = (avgPricePerSqftMin * subjectGla).toFixed(2);
      } else {
        finalValuation.lowerBound = null;
      }

      // Upper Bound
      if (compsPricePerSqftMax.length > 0) {
        const avgPricePerSqftMax = compsPricePerSqftMax.reduce((a, b) => a + b, 0) / compsPricePerSqftMax.length;
        finalValuation.upperBound = (avgPricePerSqftMax * subjectGla).toFixed(2);
      } else {
        finalValuation.upperBound = null;
      }

      // Confidence Score
      if (compsConfScore.length > 0) {
        finalValuation.confidenceScore = (compsConfScore.reduce((a, b) => a + b, 0) / compsConfScore.length).toFixed(2);
      } else {
        finalValuation.confidenceScore = null;
      }

      // As-Repair value and rehab estimate
      finalValuation.repairEstimate = 55000; // Default value from original
      if (finalValuation.estimatedValue) {
        finalValuation.estimatedValueAsRepair = (
          (parseFloat(finalValuation.estimatedValue) + finalValuation.repairEstimate) * 1.15
        ).toFixed(2);
      } else {
        finalValuation.estimatedValueAsRepair = null;
      }

      // Marketing time and fair market monthly rent (TODO: make dynamic)
      finalValuation.marketingTime = 60;
      finalValuation.fairMarketMonthlyRent = 2800;

      // Valuation estimate date
      finalValuation.valuationEstimateDate = new Date().toISOString();

      // Update report with valuation results (keep selectedCompsIds if present)
      const selectedCompsIds = reportData.valuationEstimate?.selectedCompsIds 
        ? JSON.parse(JSON.stringify(reportData.valuationEstimate.selectedCompsIds))
        : undefined;

      reportData.valuationEstimate = finalValuation;
      if (selectedCompsIds) {
        reportData.valuationEstimate.selectedCompsIds = selectedCompsIds;
      }
      reportData.valuationEstimate.createdBy = '';
      reportData.updatedAt = new Date().toISOString();

      // Upsert to database
      const container = dbService.getContainer('reporting');
      await container.items.upsert(reportData);

      logger.info(`AVM completed for report: ${reportId}, estimated value: $${finalValuation.estimatedValue}`);

      return res.status(200).json(reportData);

    } catch (error: any) {
      logger.error('Error running AVM:', error);
      return res.status(500).json({
        error: 'Failed to run AVM',
        message: error.message
      });
    }
  });

  /**
   * GET /api/reports/:reportId/pdf
   * Get PDF report from blob storage
   * Migrated from: getPdfReport.js
   */
  router.get('/:reportId/pdf', async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const { clientId, orderId, reportFileName } = req.query;

      if (!clientId || !orderId || !reportFileName) {
        return res.status(400).json({ 
          error: 'clientId, orderId, and reportFileName are required query parameters' 
        });
      }

      logger.info(`Fetching PDF report: ${reportFileName} for order: ${orderId}`);

      // Construct blob path
      const blobPath = `${clientId}/${orderId}/${reportFileName}`;

      // Get blob service client
      const credential = new DefaultAzureCredential();
      const blobServiceClient = new BlobServiceClient(
        process.env.STORAGE_ACCOUNT_URL || '',
        credential
      );

      const containerClient = blobServiceClient.getContainerClient('reports');
      const blobClient = containerClient.getBlobClient(blobPath);

      // Check if blob exists
      const exists = await blobClient.exists();
      if (!exists) {
        logger.warn(`PDF not found: ${blobPath}`);
        return res.status(404).json({ error: 'PDF report not found' });
      }

      // Download blob
      const downloadResponse = await blobClient.download();
      const chunks: Buffer[] = [];
      
      if (downloadResponse.readableStreamBody) {
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.from(chunk));
        }
      }

      const pdfBuffer = Buffer.concat(chunks);
      const base64Pdf = pdfBuffer.toString('base64');

      logger.info(`PDF retrieved successfully: ${reportFileName}`);

      return res.status(200).json({ file: base64Pdf });

    } catch (error: any) {
      logger.error('Error fetching PDF report:', error);
      return res.status(500).json({
        error: 'Failed to fetch PDF report',
        message: error.message
      });
    }
  });

  /**
   * POST /api/reports/:reportId/pdf
   * Upload PDF report to blob storage
   * Migrated from: uploadPdfReport.js
   */
  router.post('/:reportId/pdf', async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const { clientId, orderId, reportFileName, pdfData } = req.body;

      if (!clientId || !orderId || !reportFileName || !pdfData) {
        return res.status(400).json({ 
          error: 'clientId, orderId, reportFileName, and pdfData are required' 
        });
      }

      logger.info(`Uploading PDF report: ${reportFileName} for order: ${orderId}`);

      // Construct blob path
      const blobPath = `${clientId}/${orderId}/${reportFileName}`;

      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(pdfData, 'base64');

      // Get blob service client
      const credential = new DefaultAzureCredential();
      const blobServiceClient = new BlobServiceClient(
        process.env.STORAGE_ACCOUNT_URL || '',
        credential
      );

      const containerClient = blobServiceClient.getContainerClient('reports');
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

      // Upload blob
      await blockBlobClient.upload(pdfBuffer, pdfBuffer.length, {
        blobHTTPHeaders: { blobContentType: 'application/pdf' }
      });

      logger.info(`PDF uploaded successfully: ${reportFileName}`);

      return res.status(200).json({ 
        success: true,
        message: 'PDF uploaded successfully',
        blobPath 
      });

    } catch (error: any) {
      logger.error('Error uploading PDF report:', error);
      return res.status(500).json({
        error: 'Failed to upload PDF report',
        message: error.message
      });
    }
  });

  // ============================================
  // Comps Endpoints
  // ============================================

  /**
   * POST /api/reports/:reportId/comps
   * Add custom comp to report
   * Migrated from: addCustomComp.js
   */
  router.post('/:reportId/comps', async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const { newComp } = req.body;

      if (!reportId || !newComp) {
        return res.status(400).json({ error: 'reportId and newComp are required' });
      }

      logger.info(`Adding custom comp to report: ${reportId}`);

      // Fetch existing report
      const container = dbService.getContainer('reporting');
      const querySpec = {
        query: 'SELECT * FROM f WHERE f.id = @reportId',
        parameters: [{ name: '@reportId', value: reportId }]
      };

      const { resources: results } = await container.items
        .query(querySpec)
        .fetchAll();

      if (!results || results.length === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const report = results[0];

      // Initialize compsData if it doesn't exist
      if (!report.compsData) {
        report.compsData = [];
      }

      // Add custom comp
      report.compsData.push(newComp);
      report.updatedAt = new Date().toISOString();

      // Update report
      const { resource: updatedReport } = await container.items.upsert(report);

      logger.info(`Custom comp added successfully to report: ${reportId}`);

      return res.status(200).json(updatedReport);

    } catch (error: any) {
      logger.error('Error adding custom comp:', error);
      return res.status(500).json({
        error: 'Failed to add custom comp',
        message: error.message
      });
    }
  });

  /**
   * POST /api/storage/blob
   * Get data from blob storage (comp templates, etc.)
   * Migrated from: getDataFromBlobStorage.js
   */
  router.post('/storage/blob', async (req: Request, res: Response) => {
    try {
      const { containerName, dataPath } = req.body;

      if (!containerName || !dataPath) {
        return res.status(400).json({ 
          error: 'containerName and dataPath are required' 
        });
      }

      logger.info(`Fetching blob: ${dataPath} from container: ${containerName}`);

      // Get blob service client
      const credential = new DefaultAzureCredential();
      const blobServiceClient = new BlobServiceClient(
        process.env.STORAGE_ACCOUNT_URL || '',
        credential
      );

      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(dataPath);

      // Check if blob exists
      const exists = await blobClient.exists();
      if (!exists) {
        logger.warn(`Blob not found: ${dataPath}`);
        return res.status(404).json({ error: 'Blob not found' });
      }

      // Download blob
      const downloadResponse = await blobClient.download();
      const chunks: Buffer[] = [];
      
      if (downloadResponse.readableStreamBody) {
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.from(chunk));
        }
      }

      const dataBuffer = Buffer.concat(chunks);
      const dataString = dataBuffer.toString('utf-8');
      
      // Parse as JSON if possible
      let data;
      try {
        data = JSON.parse(dataString);
      } catch {
        data = dataString;
      }

      logger.info(`Blob retrieved successfully: ${dataPath}`);

      return res.status(200).json(data);

    } catch (error: any) {
      logger.error('Error fetching blob:', error);
      return res.status(500).json({
        error: 'Failed to fetch blob',
        message: error.message
      });
    }
  });

  /**
   * POST /api/geocode
   * Geocode address to lat/lng coordinates
   * Migrated from: geocodeAddress.js
   * 
   * NOTE: Uses Azure Maps or Google Maps API
   */
  router.post('/geocode', async (req: Request, res: Response) => {
    try {
      const { address, subjectCoordinate } = req.body;

      if (!address) {
        return res.status(400).json({ error: 'address is required' });
      }

      logger.info(`Geocoding address: ${address}`);

      // Use Azure Maps API
      const azureMapsKey = process.env.AZURE_MAPS_SUBSCRIPTION_KEY;
      
      if (!azureMapsKey) {
        return res.status(500).json({ 
          error: 'Azure Maps API key not configured' 
        });
      }

      const encodedAddress = encodeURIComponent(address);
      const url = `https://atlas.microsoft.com/search/address/json?api-version=1.0&subscription-key=${azureMapsKey}&query=${encodedAddress}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        logger.warn(`Address not found: ${address}`);
        return res.status(404).json({ error: 'Address not found' });
      }

      const result = data.results[0];
      const { lat, lon } = result.position;

      logger.info(`Address geocoded successfully: ${address} -> (${lat}, ${lon})`);

      return res.status(200).json({
        latitude: lat,
        longitude: lon,
        formattedAddress: result.address?.freeformAddress || address
      });

    } catch (error: any) {
      logger.error('Error geocoding address:', error);
      return res.status(500).json({
        error: 'Failed to geocode address',
        message: error.message
      });
    }
  });

  return router;
}
