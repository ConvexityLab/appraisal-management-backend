/**
 * MOP Criteria Controller
 *
 * Exposes the platform's own MOP rule-set compilation API.
 * Mirrors the pattern of criteria-programs.controller.ts (Axiom side).
 *
 * Routes (mounted at /api/mop-criteria):
 *
 *   GET  /clients/:clientId/tenants/:tenantId/programs/:programId/:programVersion/compiled
 *        Cache-first. Returns the merged (canonical + client) rule set.
 *        ?force=true always recompiles from Cosmos.
 *        → 200 { criteria, cached, metadata }
 *        → 404 when no canonical definition exists for the given program
 *
 *   POST /clients/:clientId/tenants/:tenantId/programs/:programId/:programVersion/compile
 *        Always recompiles from Cosmos and updates the cache.
 *        Intended for use after editing a canonical or client-tier document.
 *        → 200 { criteria, cached: false, metadata }
 *        → 404 when no canonical definition exists for the given program
 *
 *   GET  /canonical
 *        Lists all active canonical rule-set definitions.
 *        ?status=ACTIVE|INACTIVE|DRAFT  (default: ACTIVE)
 *        → 200 { programs: MopCriteriaDefinition[] }
 */

import express, { Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { MopCriteriaService } from '../services/mop-criteria.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

const logger = new Logger('MopCriteriaController');

const routeParams = [
  param('clientId').isString().notEmpty().withMessage('clientId is required'),
  param('tenantId').isString().notEmpty().withMessage('tenantId is required'),
  param('programId').isString().notEmpty().withMessage('programId is required'),
  param('programVersion').isString().notEmpty().withMessage('programVersion is required'),
];

export function createMopCriteriaRouter(dbService: CosmosDbService): express.Router {
  const router = express.Router();
  const mopCriteriaService = new MopCriteriaService(dbService);

  // ── GET …/canonical ────────────────────────────────────────────────────────
  router.get(
    '/canonical',
    [
      query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'DRAFT'])
        .withMessage('status must be ACTIVE, INACTIVE, or DRAFT'),
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const status = req.query['status'] as 'ACTIVE' | 'INACTIVE' | 'DRAFT' | undefined;

      try {
        const programs = await mopCriteriaService.listCanonical(status);
        return res.json({ programs });
      } catch (err) {
        logger.error('listCanonical failed', { error: err });
        return res.status(500).json({ error: 'Failed to list canonical MOP criteria' });
      }
    },
  );

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
        const result = await mopCriteriaService.getCompiledCriteria(
          clientId, tenantId, programId, programVersion, force,
        );
        return res.json(result);
      } catch (err) {
        if ((err as any).statusCode === 404) {
          return res.status(404).json({ error: (err as Error).message });
        }
        logger.error('getCompiledCriteria failed', { programId, programVersion, error: err });
        return res.status(500).json({ error: 'Failed to retrieve compiled MOP criteria' });
      }
    },
  );

  // ── POST …/compile ─────────────────────────────────────────────────────────
  router.post(
    '/clients/:clientId/tenants/:tenantId/programs/:programId/:programVersion/compile',
    routeParams,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { clientId, tenantId, programId, programVersion } = req.params as {
        clientId: string; tenantId: string; programId: string; programVersion: string;
      };

      try {
        const result = await mopCriteriaService.compileCriteria(
          clientId, tenantId, programId, programVersion,
        );
        return res.json(result);
      } catch (err) {
        if ((err as any).statusCode === 404) {
          return res.status(404).json({ error: (err as Error).message });
        }
        logger.error('compileCriteria failed', { programId, programVersion, error: err });
        return res.status(500).json({ error: 'Failed to compile MOP criteria' });
      }
    },
  );

  return router;
}
