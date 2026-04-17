import express, { type Response } from 'express';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { AxiomService } from '../services/axiom.service.js';

export function createAxiomAdminRouter(axiomService: AxiomService) {
  const router = express.Router();

  router.get('/queue/stats', async (_req: UnifiedAuthRequest, res: Response) => {
    const stats = await axiomService.getQueueStats();
    if (!stats) {
      res.status(503).json({ error: 'Axiom queue stats unavailable' });
      return;
    }
    res.json(stats);
  });

  router.get('/queue/active', async (req: UnifiedAuthRequest, res: Response) => {
    const limit = parseInt(req.query['limit'] as string, 10) || 20;
    const jobs = await axiomService.getActiveJobs(limit);
    res.json({ jobs });
  });

  router.get('/pipelines', async (req: UnifiedAuthRequest, res: Response) => {
    const limit = parseInt(req.query['limit'] as string, 10) || 20;
    const pipelines = await axiomService.getRecentPipelines(limit);
    res.json({ pipelines });
  });

  router.get('/pipelines/:jobId', async (req: UnifiedAuthRequest, res: Response) => {
    const status = await axiomService.getPipelineStatus(req.params['jobId']!);
    if (!status) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }
    res.json(status);
  });

  router.post('/queue/fail-stuck', async (req: UnifiedAuthRequest, res: Response) => {
    const maxAgeMs = req.body?.maxAgeMs ?? 300_000;
    const result = await axiomService.failStuckJobs(maxAgeMs);
    if (!result) {
      res.status(503).json({ error: 'Failed to drain stuck jobs' });
      return;
    }
    res.json(result);
  });

  router.post('/queue/clean-failed', async (req: UnifiedAuthRequest, res: Response) => {
    const minAgeMs = req.body?.minAgeMs ?? 1;
    const result = await axiomService.cleanFailedJobs(minAgeMs);
    if (!result) {
      res.status(503).json({ error: 'Failed to clean failed jobs' });
      return;
    }
    res.json(result);
  });

  return router;
}
