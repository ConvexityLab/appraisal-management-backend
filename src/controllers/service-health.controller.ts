/**
 * Service Health Controller - API endpoint for diagnostics
 */

import express, { Request, Response, NextFunction } from 'express';
import { ServiceHealthCheckService } from '../services/service-health-check.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

/**
 * Optional API key gate for health endpoints.
 *
 * If HEALTH_CHECK_API_KEY is set, the request must include a matching
 * X-Health-Api-Key header.  If the env var is not set the middleware is a
 * no-op (transparent pass-through) — a startup warning is logged separately
 * in api-server.ts when running in production without the key configured.
 */
function healthApiKeyGuard(req: Request, res: Response, next: NextFunction): void {
  const requiredKey = process.env.HEALTH_CHECK_API_KEY;
  if (!requiredKey) {
    // Key not configured — allow unauthenticated access (warn emitted at startup)
    next();
    return;
  }

  const providedKey = req.headers['x-health-api-key'];
  if (!providedKey || providedKey !== requiredKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: provide a valid X-Health-Api-Key header to access health diagnostics',
    });
    return;
  }

  next();
}

export const createServiceHealthRouter = () => {
  const router = express.Router();
  const healthService = new ServiceHealthCheckService();

  /**
   * GET /api/health/services
   * Get comprehensive health check of all services
   */
  router.get('/services', healthApiKeyGuard, async (req: Request, res: Response) => {
    try {
      const report = await healthService.performHealthCheck();
      
      // Log to console if verbose query param
      if (req.query.verbose === 'true') {
        healthService.printHealthReport(report);
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/health/services/communication
   * Get health check for communication services only
   */
  router.get('/services/communication', healthApiKeyGuard, async (req: Request, res: Response) => {
    try {
      const report = await healthService.performHealthCheck();
      
      res.json({
        success: true,
        data: {
          services: report.services.communication,
          timestamp: report.timestamp
        }
      });
    } catch (error) {
      logger.error('Communication health check failed', { error });
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  });

  /**
   * GET /api/health/services/ai
   * Get health check for AI services only
   */
  router.get('/services/ai', healthApiKeyGuard, async (req: Request, res: Response) => {
    try {
      const report = await healthService.performHealthCheck();
      
      res.json({
        success: true,
        data: {
          services: report.services.ai,
          timestamp: report.timestamp
        }
      });
    } catch (error) {
      logger.error('AI health check failed', { error });
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  });

  /**
   * GET /api/health/services/summary
   * Get quick summary of service health
   */
  router.get('/services/summary', healthApiKeyGuard, async (req: Request, res: Response) => {
    try {
      const report = await healthService.performHealthCheck();
      
      res.json({
        success: true,
        data: {
          overallStatus: report.overallStatus,
          summary: report.summary,
          timestamp: report.timestamp
        }
      });
    } catch (error) {
      logger.error('Health summary failed', { error });
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  });

  return router;
};
