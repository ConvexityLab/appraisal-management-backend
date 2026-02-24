/**
 * Final Reports Controller
 *
 * Routes:
 *   GET  /api/final-reports/templates               — list active PDF templates
 *   GET  /api/final-reports/orders/:orderId         — get current report record for an order
 *   POST /api/final-reports/orders/:orderId/generate — trigger generation (returns 202 + stub record)
 *   GET  /api/final-reports/orders/:orderId/download — stream filled PDF to client
 */

import { Router, Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { FinalReportService } from '../services/final-report.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('FinalReportsController');

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

function handleValidation(req: Request, res: Response, next: Function): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------

export function createFinalReportsRouter(dbService: CosmosDbService): Router {
  const router = Router();
  const service = new FinalReportService(dbService);

  // ==========================================================================
  // GET /templates
  // Returns all active ReportTemplate records available for generation.
  // ==========================================================================
  router.get('/templates', async (_req: Request, res: Response) => {
    try {
      const templates = await service.listTemplates();
      res.status(200).json(templates);
    } catch (error: any) {
      logger.error('Failed to list templates', { error: error.message });
      res.status(500).json({ error: 'Failed to retrieve templates', message: error.message });
    }
  });

  // ==========================================================================
  // GET /orders/:orderId
  // Returns all FinalReport records for the order, newest first.
  // Returns an empty array (200) if no reports have been generated yet.
  // ==========================================================================
  router.get(
    '/orders/:orderId',
    [param('orderId').notEmpty().withMessage('orderId is required')],
    handleValidation,
    async (req: Request, res: Response) => {
      const orderId = req.params['orderId']!;
      try {
        const reports = await service.getReports(orderId);
        res.status(200).json(reports);
      } catch (error: any) {
        logger.error('Failed to get final reports', { orderId, error: error.message });
        res.status(500).json({ error: 'Failed to retrieve final reports', message: error.message });
      }
    }
  );

  // ==========================================================================
  // POST /orders/:orderId/generate
  // Starts PDF generation. Returns 202 with the in-progress FinalReport record.
  // Precondition failures (no QC review, wrong decision) → 422.
  // ==========================================================================
  router.post(
    '/orders/:orderId/generate',
    [
      param('orderId').notEmpty().withMessage('orderId is required'),
      body('templateId').notEmpty().withMessage('templateId is required'),
      body('requestedBy').notEmpty().withMessage('requestedBy (userId) is required')
    ],
    handleValidation,
    async (req: Request, res: Response) => {
      const orderId = req.params['orderId']!;
      const { templateId, requestedBy } = req.body as {
        templateId: string;
        requestedBy: string;
      };

      // templateId and requestedBy are guaranteed non-empty by express-validator
      if (!templateId || !requestedBy) {
        res.status(400).json({ error: 'templateId and requestedBy are required' });
        return;
      }

      logger.info('Received generate request', { orderId, templateId, requestedBy });

      try {
        const report = await service.generateReport({ orderId, templateId, requestedBy });
        // Generation completes synchronously for now (small PDFs).
        // Return 200 with the completed record; update to 202 + polling when async queue is added.
        res.status(200).json(report);
      } catch (error: any) {
        // Precondition errors thrown by the service use recognisable phrases
        const isPreconditionError =
          error.message?.includes('not found') ||
          error.message?.includes('required') ||
          error.message?.includes('decision') ||
          error.message?.includes('inactive');

        if (isPreconditionError) {
          logger.warn('Generate precondition not met', { orderId, error: error.message });
          res.status(422).json({ error: 'Precondition failed', message: error.message });
        } else {
          logger.error('Generate failed with internal error', { orderId, error: error.message });
          res.status(500).json({ error: 'Report generation failed', message: error.message });
        }
      }
    }
  );

  // ==========================================================================
  // GET /orders/:orderId/download
  // Streams the filled PDF from Blob Storage through the API.
  // ==========================================================================
  router.get(
    '/orders/:orderId/download',
    [param('orderId').notEmpty().withMessage('orderId is required')],
    handleValidation,
    async (req: Request, res: Response) => {
      const orderId = req.params['orderId']!;
      try {
        const { readableStream, contentType, contentLength, fileName } =
          await service.downloadReport(orderId);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', contentLength);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`
        );

        readableStream.pipe(res);
        readableStream.on('error', (err) => {
          logger.error('Stream error during PDF download', { orderId, error: err.message });
          // Headers already sent — cannot change status; end the response
          res.end();
        });
      } catch (error: any) {
        const isNotReady =
          error.message?.includes('not found') || error.message?.includes('not ready');

        if (isNotReady) {
          res.status(404).json({ error: error.message });
        } else {
          logger.error('Failed to stream PDF download', { orderId, error: error.message });
          res.status(500).json({ error: 'Download failed', message: error.message });
        }
      }
    }
  );

  // ==========================================================================
  // POST /orders/:orderId/mismo-xml
  // On-demand MISMO XML generation. Idempotent: returns existing blob path if
  // the XML was already generated for the most-recent GENERATED report.
  // Requires requestedBy (userId) in the body.
  // ==========================================================================
  router.post(
    '/orders/:orderId/mismo-xml',
    [
      param('orderId').notEmpty().withMessage('orderId is required'),
      body('requestedBy').notEmpty().withMessage('requestedBy (userId) is required'),
    ],
    handleValidation,
    async (req: Request, res: Response) => {
      const orderId = req.params['orderId']!;
      const requestedBy = (req.body.requestedBy as string | undefined) ?? (req as any).user?.id ?? 'system';
      try {
        const result = await service.generateMismoXmlForReport(orderId, requestedBy);
        res.status(result.alreadyExisted ? 200 : 201).json({
          blobPath:      result.blobPath,
          alreadyExisted: result.alreadyExisted,
          message:       result.alreadyExisted
            ? 'MISMO XML already exists — returning existing blob path'
            : 'MISMO XML generated and uploaded successfully',
        });
      } catch (error: any) {
        const isPrecondition =
          error.message?.includes('not found') ||
          error.message?.includes('status') ||
          error.message?.includes('must be GENERATED');
        if (isPrecondition) {
          res.status(422).json({ error: 'Precondition failed', message: error.message });
        } else {
          logger.error('MISMO XML generation failed', { orderId, error: error.message });
          res.status(500).json({ error: 'MISMO XML generation failed', message: error.message });
        }
      }
    }
  );

  return router;
}
