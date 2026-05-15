import express, { type Request, type Response, type Router } from 'express';
import { Logger } from '../utils/logger.js';
import { VendorIntegrationService } from '../services/vendor-integrations/VendorIntegrationService.js';
import type { VendorType } from '../types/vendor-integration.types.js';
import { VendorConnectionConfigurationError } from '../services/vendor-integrations/VendorIntegrationErrors.js';
import type { VendorAssignmentTrigger } from '../services/vendor-integrations/VendorOrderReferenceService.js';

const logger = new Logger('VendorIntegrationController');
const APIM_FORWARDED_HEADER = 'x-apim-forwarded';

function normalizedEnvironment(): string {
  return (process.env.ENVIRONMENT ?? 'dev').trim().toLowerCase();
}

function requiresApimForwarding(vendorType: VendorType): boolean {
  return vendorType === 'aim-port' && normalizedEnvironment() !== 'dev';
}

function enforceApimForwarding(vendorType: VendorType): (req: Request, res: Response, next: express.NextFunction) => void {
  return (req, res, next) => {
    if (!requiresApimForwarding(vendorType)) {
      next();
      return;
    }

    const forwardedHeader = req.get(APIM_FORWARDED_HEADER)?.trim().toLowerCase();
    if (forwardedHeader === 'true') {
      next();
      return;
    }

    logger.warn('Rejected vendor integration request that did not arrive through APIM', {
      vendorType,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      headerValue: forwardedHeader ?? null,
    });

    res.status(403).json({
      success: false,
      error: {
        code: 'VENDOR_INTEGRATION_EDGE_ENFORCEMENT_FAILED',
        message: 'AIM-Port inbound requests must be routed through APIM.',
      },
    });
  };
}

function statusForError(error: unknown, message: string): number {
  if (error instanceof VendorConnectionConfigurationError) return 503;
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

function codeForError(error: unknown): string {
  if (error instanceof VendorConnectionConfigurationError) {
    return 'VENDOR_INTEGRATION_CONFIGURATION_ERROR';
  }
  return 'VENDOR_INTEGRATION_INBOUND_FAILED';
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

      res.status(statusForError(error, message)).json({
        success: false,
        error: {
          code: codeForError(error),
          message,
        },
      });
    }
  };
}

export function createVendorIntegrationRouter(
  service?: VendorIntegrationService,
  orchestratorRef?: () => VendorAssignmentTrigger | undefined,
): Router {
  const router = express.Router();
  const integrationService =
    service ?? new VendorIntegrationService(undefined, undefined, undefined, undefined, orchestratorRef);

  router.post('/aim-port/inbound', enforceApimForwarding('aim-port'), sendInbound(integrationService, 'aim-port'));
  router.post('/class-valuation/inbound', sendInbound(integrationService, 'class-valuation'));

  return router;
}
