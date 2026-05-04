import express, { type Request, type Response, type Router } from 'express';
import { Logger } from '../utils/logger.js';
import { VendorIntegrationService } from '../services/vendor-integrations/VendorIntegrationService.js';
import type { VendorType } from '../types/vendor-integration.types.js';

const logger = new Logger('VendorIntegrationController');

function statusForError(message: string): number {
  if (message.includes('authentication failed') || message.includes('mismatch')) return 401;
  if (message.includes('not found') || message.includes('could not resolve')) return 404;
  if (
    message.includes('required') ||
    message.includes('No adapter registered') ||
    message.includes('does not match')
  ) {
    return 400;
  }
  return 500;
}

function sendInbound(
  service: VendorIntegrationService,
  vendorType: VendorType,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    try {
      const result = await service.processInbound(
        req.body,
        req.headers,
        (req as any).rawBody as Buffer | undefined,
        vendorType,
      );
      res.setHeader('X-Vendor-Type', result.adapter.vendorType);
      res.setHeader('X-Vendor-Connection-Id', result.connection.id);
      res.setHeader('X-Normalized-Event-Count', String(result.domainEvents.length));
      res.status(result.ack.statusCode).json(result.ack.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Inbound vendor integration failed';
      logger.error('Inbound vendor integration failed', {
        error: message,
        vendorType,
        headers: req.headers,
      });

      res.status(statusForError(message)).json({
        success: false,
        error: {
          code: 'VENDOR_INTEGRATION_INBOUND_FAILED',
          message,
        },
      });
    }
  };
}

export function createVendorIntegrationRouter(service?: VendorIntegrationService): Router {
  const router = express.Router();
  const integrationService = service ?? new VendorIntegrationService();

  router.post('/aim-port/inbound', sendInbound(integrationService, 'aim-port'));
  router.post('/class-valuation/inbound', sendInbound(integrationService, 'class-valuation'));

  return router;
}
