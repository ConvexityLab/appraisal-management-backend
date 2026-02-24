/**
 * Matching Criteria Controller
 *
 * CRUD for named, reusable MatchingCriteriaSet documents.
 *
 * Routes (mounted at /api/matching-criteria):
 *   GET    /           → list all criteria sets for tenant
 *   POST   /           → create a new set
 *   GET    /:setId     → get one set
 *   PUT    /:setId     → update a set
 *   DELETE /:setId     → delete a set
 */

import express, { Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type {
  MatchingCriteriaSet,
  CreateMatchingCriteriaSetRequest,
  UpdateMatchingCriteriaSetRequest,
} from '../types/matching.types.js';

const logger = new Logger('MatchingCriteriaController');

// ─── Tenant helper ────────────────────────────────────────────────────────────

function resolveTenantId(req: UnifiedAuthRequest): string {
  const tid =
    req.user?.tenantId ?? (req.headers['x-tenant-id'] as string | undefined);
  if (!tid) {
    throw new Error(
      'Tenant ID is required but was not found in the auth token or x-tenant-id header',
    );
  }
  return tid;
}

function generateId(): string {
  return `mcs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Validators ───────────────────────────────────────────────────────────────

const validateCreate = [
  body('name').isString().notEmpty().withMessage('name is required'),
  body('combinator')
    .isIn(['AND', 'OR'])
    .withMessage('combinator must be AND or OR'),
  body('criteria')
    .isArray()
    .withMessage('criteria must be an array'),
  body('criteria.*.field')
    .isString()
    .notEmpty()
    .withMessage('Each criterion must have a non-empty field'),
  body('criteria.*.operator')
    .isString()
    .notEmpty()
    .withMessage('Each criterion must have an operator'),
  body('providerTypes')
    .isArray()
    .withMessage('providerTypes must be an array'),
];

const validateUpdate = [
  param('setId').isString().notEmpty(),
  body('name').optional().isString().notEmpty(),
  body('combinator').optional().isIn(['AND', 'OR']),
  body('criteria').optional().isArray(),
  body('providerTypes').optional().isArray(),
];

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createMatchingCriteriaRouter(dbService: CosmosDbService) {
  const router = express.Router();

  // GET / — list all criteria sets for this tenant
  router.get('/', async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const container = dbService.getMatchingCriteriaSetsContainer();
      const { resources } = await container.items
        .query<MatchingCriteriaSet>({
          query: 'SELECT * FROM c WHERE c.tenantId = @tenantId ORDER BY c.name ASC',
          parameters: [{ name: '@tenantId', value: tenantId }],
        })
        .fetchAll();
      res.json({ criteriaSets: resources, count: resources.length });
    } catch (err) {
      logger.error('listCriteriaSets failed', { error: err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST / — create a new criteria set
  router.post('/', ...validateCreate, async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const tenantId = resolveTenantId(req);
      const createdBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'system';
      const body = req.body as CreateMatchingCriteriaSetRequest;
      const now = new Date().toISOString();
      const doc: MatchingCriteriaSet = {
        id: generateId(),
        tenantId,
        name: body.name,
        ...(body.description !== undefined && { description: body.description }),
        combinator: body.combinator,
        criteria: body.criteria,
        providerTypes: body.providerTypes,
        createdAt: now,
        updatedAt: now,
        createdBy,
      };
      const container = dbService.getMatchingCriteriaSetsContainer();
      const { resource } = await container.items.create(doc);
      res.status(201).json(resource);
    } catch (err) {
      logger.error('createCriteriaSet failed', { error: err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /:setId — get one criteria set
  router.get(
    '/:setId',
    [param('setId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const { setId } = req.params as { setId: string };
        const container = dbService.getMatchingCriteriaSetsContainer();
        const { resources } = await container.items
          .query<MatchingCriteriaSet>({
            query: 'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
            parameters: [
              { name: '@id', value: setId },
              { name: '@tenantId', value: tenantId },
            ],
          })
          .fetchAll();
        if (!resources.length) {
          res.status(404).json({ error: 'CRITERIA_SET_NOT_FOUND' });
          return;
        }
        res.json(resources[0]);
      } catch (err) {
        logger.error('getCriteriaSet failed', { error: err });
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  // PUT /:setId — update a criteria set
  router.put('/:setId', ...validateUpdate, async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Validation failed', details: errors.array() });
      return;
    }
    try {
      const tenantId = resolveTenantId(req);
      const { setId } = req.params as { setId: string };
      const container = dbService.getMatchingCriteriaSetsContainer();

      // Fetch existing
      const { resources } = await container.items
        .query<MatchingCriteriaSet>({
          query: 'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
          parameters: [
            { name: '@id', value: setId },
            { name: '@tenantId', value: tenantId },
          ],
        })
        .fetchAll();
      if (!resources.length) {
        res.status(404).json({ error: 'CRITERIA_SET_NOT_FOUND' });
        return;
      }

      const existing = resources[0]!;
      const updates = req.body as UpdateMatchingCriteriaSetRequest;
      const updated: MatchingCriteriaSet = {
        ...existing,
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.combinator !== undefined && { combinator: updates.combinator }),
        ...(updates.criteria !== undefined && { criteria: updates.criteria }),
        ...(updates.providerTypes !== undefined && { providerTypes: updates.providerTypes }),
        updatedAt: new Date().toISOString(),
      };

      const { resource } = await container.items.upsert(updated);
      res.json(resource);
    } catch (err) {
      logger.error('updateCriteriaSet failed', { error: err });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /:setId — delete a criteria set
  router.delete(
    '/:setId',
    [param('setId').isString().notEmpty()],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ error: 'Validation failed', details: errors.array() });
        return;
      }
      try {
        const tenantId = resolveTenantId(req);
        const { setId } = req.params as { setId: string };
        const container = dbService.getMatchingCriteriaSetsContainer();

        // Verify ownership before delete
        const { resources } = await container.items
          .query<MatchingCriteriaSet>({
            query: 'SELECT c.id, c.tenantId FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
            parameters: [
              { name: '@id', value: setId },
              { name: '@tenantId', value: tenantId },
            ],
          })
          .fetchAll();
        if (!resources.length) {
          res.status(404).json({ error: 'CRITERIA_SET_NOT_FOUND' });
          return;
        }

        await container.item(setId, tenantId).delete();
        res.status(204).send();
      } catch (err) {
        logger.error('deleteCriteriaSet failed', { error: err });
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  return router;
}
