import express, { type Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AxiomService } from '../services/axiom.service.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AxiomAdminController');
const MAX_LIMIT = 100;

function clampLimit(raw: unknown): number {
  const parsed = parseInt(String(raw), 10);
  if (isNaN(parsed) || parsed < 1) return 20;
  return Math.min(parsed, MAX_LIMIT);
}

export function createAxiomAdminRouter(axiomService: AxiomService) {
  const router = express.Router();

  router.get('/queue/stats', async (_req: UnifiedAuthRequest, res: Response) => {
    try {
      const stats = await axiomService.getQueueStats();
      if (!stats) {
        res.status(503).json({ error: 'Axiom queue stats unavailable' });
        return;
      }
      res.json(stats);
    } catch (err) {
      logger.error('Failed to get queue stats', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to retrieve queue stats' });
    }
  });

  router.get('/queue/active', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const limit = clampLimit(req.query['limit']);
      const jobs = await axiomService.getActiveJobs(limit);
      res.json({ jobs });
    } catch (err) {
      logger.error('Failed to get active jobs', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to retrieve active jobs' });
    }
  });

  router.get('/pipelines', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const limit = clampLimit(req.query['limit']);
      const pipelines = await axiomService.getRecentPipelines(limit);
      res.json({ pipelines });
    } catch (err) {
      logger.error('Failed to get recent pipelines', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to retrieve recent pipelines' });
    }
  });

  router.get('/pipelines/:jobId', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const status = await axiomService.getPipelineStatus(req.params['jobId']!);
      if (!status) {
        res.status(404).json({ error: 'Pipeline not found' });
        return;
      }
      res.json(status);
    } catch (err) {
      logger.error('Failed to get pipeline status', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to retrieve pipeline status' });
    }
  });

  router.post('/queue/fail-stuck', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const maxAgeMs = req.body?.maxAgeMs;
      if (typeof maxAgeMs !== 'number' || maxAgeMs < 1) {
        res.status(400).json({ error: 'maxAgeMs (number, >= 1) is required in the request body' });
        return;
      }
      const result = await axiomService.failStuckJobs(maxAgeMs);
      if (!result) {
        res.status(503).json({ error: 'Failed to drain stuck jobs' });
        return;
      }
      res.json(result);
    } catch (err) {
      logger.error('Failed to fail stuck jobs', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to drain stuck jobs' });
    }
  });

  router.post('/queue/clean-failed', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const minAgeMs = req.body?.minAgeMs;
      if (typeof minAgeMs !== 'number' || minAgeMs < 1) {
        res.status(400).json({ error: 'minAgeMs (number, >= 1) is required in the request body' });
        return;
      }
      const result = await axiomService.cleanFailedJobs(minAgeMs);
      if (!result) {
        res.status(503).json({ error: 'Failed to clean failed jobs' });
        return;
      }
      res.json(result);
    } catch (err) {
      logger.error('Failed to clean failed jobs', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to clean failed jobs' });
    }
  });

  return router;
}
