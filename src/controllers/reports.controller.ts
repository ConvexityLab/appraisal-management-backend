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
import {
  SCHEMA_VERSION,
  type CanonicalReportDocument,
  type CanonicalComp,
  type CanonicalValuation,
} from '../types/canonical-schema.js';
import { normalizeReportDocument } from '../mappers/normalize-report.js';

const logger = new Logger();

export function createReportsRouter(dbService: CosmosDbService): Router {
  const router = Router();

  // ============================================
  // Report Endpoints
  // ============================================

  /**
   * GET /api/reports?orderId=X
   * Find a report by its associated order ID.
   * Returns the first match (reports are 1:1 with orders in the reporting container).
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { orderId } = req.query;

      if (!orderId || typeof orderId !== 'string') {
        return res.status(400).json({ error: 'orderId query parameter is required' });
      }

      logger.info(`Fetching report by orderId: ${orderId}`);

      const container = dbService.getContainer('reporting');
      const querySpec = {
        query: 'SELECT * FROM f WHERE f.orderId = @orderId',
        parameters: [{ name: '@orderId', value: orderId }],
      };

      const { resources: results } = await container.items.query(querySpec).fetchAll();

      if (!results || results.length === 0) {
        logger.warn(`No report found for orderId: ${orderId}`);
        return res.status(404).json({ error: 'Report not found for this order' });
      }

      const normalized = normalizeReportDocument(results[0]);
      logger.info(`Report found for orderId: ${orderId}, reportId: ${normalized.id}`);
      return res.status(200).json(normalized);

    } catch (error: any) {
      logger.error('Error fetching report by orderId:', error);
      return res.status(500).json({
        error: 'Failed to fetch report',
        message: error.message,
      });
    }
  });

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

      const report = normalizeReportDocument(results[0]);
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

      // Enforce canonical id
      reportData.id = reportId;

      // Stamp schema version if not already set
      if (!reportData.schemaVersion) {
        reportData.schemaVersion = SCHEMA_VERSION;
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

      // Write the reportId back to the linked order so it never needs a reverse lookup.
      // orderId must be present on the report document for this to work.
      const linkedOrderId: string | undefined = reportData.orderId;
      if (linkedOrderId) {
        const orderPatch = await dbService.updateOrder(linkedOrderId, { reportId });
        if (!orderPatch.success) {
          // Log but do not fail the request — the report was saved successfully.
          logger.warn(`Report upserted but failed to write reportId back to order ${linkedOrderId}: ${orderPatch.error}`);
        } else {
          logger.info(`Order ${linkedOrderId} updated with reportId: ${reportId}`);
        }
      }

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

      // Support both canonical (comps + subject) and legacy (compsData + propertyData)
      const isCanonical = reportData.schemaVersion != null && Array.isArray(reportData.comps);

      if (!isCanonical && (!reportData.compsData || !reportData.propertyData)) {
        return res.status(400).json({
          error: 'reportData must contain either canonical (comps + subject) or legacy (compsData + propertyData)',
        });
      }

      logger.info(`Running AVM for report: ${reportId} (schema: ${isCanonical ? 'canonical' : 'legacy'})`);

      const now = new Date().toISOString();

      if (isCanonical) {
        const doc = reportData as CanonicalReportDocument;
        const subjectGla: number = doc.subject?.grossLivingArea ?? 0;

        if (!subjectGla) {
          return res.status(400).json({ error: 'subject.grossLivingArea is required for AVM' });
        }

        // Selected sold comps only (slotIndex 1-3)
        const soldComps: CanonicalComp[] = (doc.comps ?? []).filter(
          (c) => c.selected && c.slotIndex != null && c.slotIndex <= 3 && c.salePrice != null,
        );

        if (soldComps.length === 0) {
          return res.status(400).json({ error: 'No selected sold comps found for AVM calculation' });
        }

        const adjustedPrices = soldComps.map((c) => {
          const netAdj = c.adjustments?.netAdjustmentTotal ?? 0;
          return (c.salePrice! + netAdj) / c.grossLivingArea;
        });

        const avgPsf = adjustedPrices.reduce((a, b) => a + b, 0) / adjustedPrices.length;
        const minPsf = Math.min(...adjustedPrices);
        const maxPsf = Math.max(...adjustedPrices);

        const valuation: CanonicalValuation = {
          estimatedValue: Math.round(avgPsf * subjectGla),
          lowerBound: Math.round(minPsf * subjectGla),
          upperBound: Math.round(maxPsf * subjectGla),
          confidenceScore: null,
          effectiveDate: now,
          reconciliationNotes: null,
          approachesUsed: ['sales_comparison'],
          avmProvider: 'internal',
          avmModelVersion: '1.0',
        };

        doc.valuation = valuation;
        doc.updatedAt = now;
        doc.schemaVersion = SCHEMA_VERSION;

        const container = dbService.getContainer('reporting');
        await container.items.upsert(doc as unknown as Record<string, unknown>);

        logger.info(`AVM completed for report: ${reportId}, estimated value: $${valuation.estimatedValue}`);
        return res.status(200).json(doc);
      }

      // ── Legacy path (kept for backward compat until all docs are migrated) ────
      const subjectGla = reportData.propertyData?.compAnalysis?.dataValues?.livingArea;
      const compsData = reportData.compsData;

      if (!subjectGla || !compsData) {
        return res.status(400).json({ error: 'Missing required data for valuation' });
      }

      const compsPsf: number[] = [];
      const compsPsfMin: number[] = [];
      const compsPsfMax: number[] = [];

      compsData.forEach((comp: Record<string, unknown>) => {
        const flag = String(comp['selectedCompFlag'] ?? '');
        if (!flag || flag === 'Subject' || flag.startsWith('L')) return;

        const compGla = Number(((comp['compAnalysis'] as Record<string, unknown>)?.['dataValues'] as Record<string, unknown>)?.['livingArea']);
        const compVal = comp['valuation'] as Record<string, unknown>;
        const totalAdj = Number(((comp['compAnalysis'] as Record<string, unknown>)?.['adjustments'] as Record<string, unknown>)?.['totalAdj'] ?? 0);

        if (!compVal || !compGla || isNaN(compGla)) return;

        if (typeof compVal['estimatedValue'] === 'number') {
          compsPsf.push((compVal['estimatedValue'] + totalAdj) / compGla);
        }
        if (typeof compVal['priceRangeMin'] === 'number') {
          compsPsfMin.push((compVal['priceRangeMin'] + totalAdj) / compGla);
        }
        if (typeof compVal['priceRangeMax'] === 'number') {
          compsPsfMax.push((compVal['priceRangeMax'] + totalAdj) / compGla);
        }
      });

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

      const legacyValuation: Record<string, unknown> = {
        estimatedValue: avg(compsPsf) != null ? (avg(compsPsf)! * subjectGla).toFixed(2) : null,
        lowerBound:     avg(compsPsfMin) != null ? (avg(compsPsfMin)! * subjectGla).toFixed(2) : null,
        upperBound:     avg(compsPsfMax) != null ? (avg(compsPsfMax)! * subjectGla).toFixed(2) : null,
        confidenceScore: null,
        valuationEstimateDate: now,
        createdBy: '',
      };

      reportData.valuationEstimate = legacyValuation;
      reportData.updatedAt = now;

      const container = dbService.getContainer('reporting');
      await container.items.upsert(reportData);

      logger.info(`AVM (legacy) completed for report: ${reportId}, estimated value: $${legacyValuation.estimatedValue}`);
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

      // Support canonical (comps[]) and legacy (compsData[])
      const isCanonical = report.schemaVersion != null && Array.isArray(report.comps);

      if (isCanonical) {
        report.comps = [...(report.comps as unknown[]), newComp];
      } else {
        if (!report.compsData) { report.compsData = []; }
        (report.compsData as unknown[]).push(newComp);
      }

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
