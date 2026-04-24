import express, { type Request, type Response, type Router } from 'express';
import { Logger } from '../utils/logger.js';
import { VendorIntegrationService } from '../services/vendor-integrations/VendorIntegrationService.js';

export function createVendorIntegrationRouter(): Router {
  const router = express.Router();
  const logger = new Logger('VendorIntegrationController');
  const service = new VendorIntegrationService();

  router.post('/inbound', async (req: Request, res: Response) => {
    try {
      const result = await service.processInbound(req.body, req.headers, (req as any).rawBody as Buffer | undefined);
      res.setHeader('X-Vendor-Type', result.adapter.vendorType);
      res.setHeader('X-Vendor-Connection-Id', result.connection.id);
      res.setHeader('X-Normalized-Event-Count', String(result.domainEvents.length));
      res.status(result.ack.statusCode).json(result.ack.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Inbound vendor integration failed';
      logger.error('Inbound vendor integration failed', {
        error: message,
        headers: req.headers,
      });

      const status = message.includes('authentication failed') || message.includes('mismatch') ? 401
        : message.includes('not found') || message.includes('could not resolve') ? 404
          : message.includes('required') || message.includes('No vendor adapter matched') ? 400
            : 500;

      res.status(status).json({
        success: false,
        error: {
          code: 'VENDOR_INTEGRATION_INBOUND_FAILED',
          message,
        },
      });
    }
  });

  return router;
}
