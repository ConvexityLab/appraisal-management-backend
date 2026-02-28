/**
 * Criteria Programs Controller
 *
 * Exposes Axiom's program compilation API to our platform.
 *
 * Routes (mounted at /api/criteria):
 *
 *   GET  /clients/:clientId/tenants/:tenantId/programs/:programId/:programVersion/compiled
 *        Cache-first. Returns stored compiled criteria if TTL still valid.
 *        Calls Axiom on cache miss. ?force=true always recompiles.
 *        → 200 { criteria, cached, metadata }
 *        → 404 when Axiom reports the program / canonical doesn't exist yet
 *
 *   POST /clients/:clientId/tenants/:tenantId/programs/:programId/:programVersion/compile
 *        Always recompiles from source. Intended for use after editing a
 *        canonical or delta. Optional body { userId } recorded by Axiom.
 *        → 200 { criteria, cached: false, metadata }
 *        → 404 when Axiom reports the program / canonical doesn't exist yet
 */

import express, { Response } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import { AxiomService } from '../services/axiom.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

const logger = new Logger('CriteriaProgramsController');

// ─── Shared param validators ───────────────────────────────────────────────────

const routeParams = [
  param('clientId').isString().notEmpty().withMessage('clientId is required'),
  param('tenantId').isString().notEmpty().withMessage('tenantId is required'),
  param('programId').isString().notEmpty().withMessage('programId is required'),
  param('programVersion').isString().notEmpty().withMessage('programVersion is required'),
];

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCriteriaProgramsRouter(axiomService: AxiomService): express.Router {
  const router = express.Router();

  // ── GET …/compiled ─────────────────────────────────────────────────────────
  router.get(
    '/clients/:clientId/tenants/:tenantId/programs/:programId/:programVersion/compiled',
    [
      ...routeParams,
      query('force').optional().isIn(['true', 'false']).withMessage('force must be true or false'),
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { clientId, tenantId, programId, programVersion } = req.params as {
        clientId: string; tenantId: string; programId: string; programVersion: string;
      };
      const force = req.query['force'] === 'true';

      try {
        const result = await axiomService.getCompiledCriteria(
          clientId, tenantId, programId, programVersion, force,
        );
        return res.json(result);
      } catch (err) {
        if ((err as any).statusCode === 404) {
          return res.status(404).json({ error: (err as Error).message });
        }
        logger.error('getCompiledCriteria failed', { programId, programVersion, error: err });
        return res.status(500).json({ error: 'Failed to retrieve compiled criteria' });
      }
    },
  );

  // ── POST …/compile ─────────────────────────────────────────────────────────
  router.post(
    '/clients/:clientId/tenants/:tenantId/programs/:programId/:programVersion/compile',
    [
      ...routeParams,
      body('userId').optional().isString(),
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { clientId, tenantId, programId, programVersion } = req.params as {
        clientId: string; tenantId: string; programId: string; programVersion: string;
      };
      const userId: string | undefined = typeof req.body?.userId === 'string'
        ? req.body.userId
        : req.user?.id ?? req.user?.azureAdObjectId;

      try {
        const result = await axiomService.compileCriteria(
          clientId, tenantId, programId, programVersion, userId,
        );
        return res.json(result);
      } catch (err) {
        if ((err as any).statusCode === 404) {
          return res.status(404).json({ error: (err as Error).message });
        }
        logger.error('compileCriteria failed', { programId, programVersion, error: err });
        return res.status(500).json({ error: 'Failed to compile criteria' });
      }
    },
  );

  return router;
}
