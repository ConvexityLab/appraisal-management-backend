/**
 * Review Programs Controller
 *
 * Routes (all authenticated):
 *   GET  /api/review-programs          → list active review programs (optionally filtered by clientId)
 *   GET  /api/review-programs/:id      → get a single program by ID
 *   GET  /api/review-programs/:id/versions → list all versions of a named program
 *
 * Review programs are generic — programType ('FRAUD' | 'QC' | 'PORTFOLIO' | '1033' | 'APPRAISAL_REVIEW')
 * is just metadata.  The evaluation engine is identical for every type.
 *
 * The `review-programs` Cosmos container is partitioned by `/clientId`.
 * Platform-wide programs have clientId = null and are stored with the
 * synthetic partition key "__global__" to satisfy the non-null partition key requirement.
 */

import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { ReviewProgram } from '../types/review-tape.types.js';

const logger = new Logger();

/**
 * Cosmos stores global programs (clientId === null) with a synthetic
 * partition key so that the container's required /clientId key is never null.
 */
const GLOBAL_CLIENT_ID = '__global__';

// ─── factory ──────────────────────────────────────────────────────────────────

export function createReviewProgramsRouter(dbService: CosmosDbService) {
  const router = express.Router();

  // ── GET / ───────────────────────────────────────────────────────────────────
  /**
   * List review programs.
   *
   * Query params:
   *   clientId    (optional) — include this client's programs plus global ones
   *   programType (optional) — filter by programType ('FRAUD' | 'QC' | ...)
   *   status      (optional) — 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'all'
   *                            defaults to 'ACTIVE' for backward compatibility
   *   page        (optional) — 1-based page number, defaults to 1
   *   pageSize    (optional) — records per page, defaults to 50, max 100
   *
   * Response: { items: ReviewProgram[]; total: number; page: number; pageSize: number }
   */
  router.get(
    '/',
    query('clientId').optional().isString(),
    query('programType').optional().isString(),
    query('status')
      .optional()
      .isIn(['ACTIVE', 'INACTIVE', 'DRAFT', 'all'])
      .withMessage('status must be ACTIVE | INACTIVE | DRAFT | all'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize must be 1–100'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const container = dbService.getReviewProgramsContainer();

        const clientId =
          typeof req.query.clientId === 'string' ? req.query.clientId : null;
        const programType =
          typeof req.query.programType === 'string' ? req.query.programType : null;
        // Default to 'ACTIVE' so existing callers (ReviewProgramSelector) are unaffected.
        const statusFilter =
          typeof req.query.status === 'string' ? req.query.status : 'ACTIVE';

        const pageNum = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const pageSizeNum = Math.min(
          100,
          Math.max(1, parseInt(String(req.query.pageSize ?? '50'), 10) || 50),
        );
        const offset = (pageNum - 1) * pageSizeNum;

        // Always include global programs; add the client's partition when supplied.
        const partitionValues = [GLOBAL_CLIENT_ID];
        if (clientId && clientId !== GLOBAL_CLIENT_ID) {
          partitionValues.push(clientId);
        }

        // Build shared WHERE clause reused by both count and data queries.
        let whereClause = 'ARRAY_CONTAINS(@partitions, c.clientId)';
        const parameters: Array<{ name: string; value: string | string[] }> = [
          { name: '@partitions', value: partitionValues },
        ];

        if (statusFilter !== 'all') {
          whereClause += ' AND c.status = @status';
          parameters.push({ name: '@status', value: statusFilter });
        }

        if (programType) {
          whereClause += ' AND c.programType = @programType';
          parameters.push({ name: '@programType', value: programType });
        }

        // Count query — same WHERE clause, no ORDER / OFFSET / LIMIT
        const countResult = await container.items
          .query<number>({
            query: `SELECT VALUE COUNT(1) FROM c WHERE ${whereClause}`,
            parameters,
          })
          .fetchAll();
        const total = countResult.resources[0] ?? 0;

        // Data query — paginated
        const { resources: items } = await container.items
          .query<ReviewProgram>({
            query: `SELECT * FROM c WHERE ${whereClause} ORDER BY c.name ASC OFFSET ${offset} LIMIT ${pageSizeNum}`,
            parameters,
          })
          .fetchAll();

        return res.json({ items, total, page: pageNum, pageSize: pageSizeNum });
      } catch (err) {
        logger.error('Failed to list review programs', { error: err });
        return res.status(500).json({ error: 'Failed to retrieve review programs' });
      }
    },
  );

  // ── GET /:id ─────────────────────────────────────────────────────────────────
  /**
   * Get a single program by ID.
   *
   * Cross-partition query because we do not know the clientId from the URL alone.
   * Cosmos will fan-out to all partitions — acceptable here since programs are
   * a small, infrequently-accessed collection.
   */
  router.get(
    '/:id',
    param('id').isString().notEmpty().withMessage('id is required'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const container = dbService.getReviewProgramsContainer();
        const { resources } = await container.items
          .query<ReviewProgram>({
            query: 'SELECT * FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: req.params['id'] as string }],
          })
          .fetchAll();

        const program = resources[0];
        if (!program) {
          return res.status(404).json({ error: `Review program '${req.params['id']}' not found` });
        }

        return res.json(program);
      } catch (err) {
        logger.error('Failed to fetch review program', {
          id: req.params['id'],
          error: err,
        });
        return res.status(500).json({ error: 'Failed to retrieve review program' });
      }
    },
  );

  // ── GET /:id/versions ────────────────────────────────────────────────────────
  /**
   * List all versions of a program identified by its human-readable name.
   * The `:id` segment is treated as the program `name` (slug) here because
   * stable version history queries are by name, not the versioned id.
   *
   * Returns versions sorted newest-first by `createdAt`.
   */
  router.get(
    '/:id/versions',
    param('id').isString().notEmpty().withMessage('id is required'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const container = dbService.getReviewProgramsContainer();

        // The id in the URL is either the exact id (e.g. "vision-appraisal-v1.0")
        // or the program name — try matching on the base name prefix first, then
        // fall back to the id value directly.
        const rawId = req.params['id'] as string;

        const { resources } = await container.items
          .query<ReviewProgram>({
            query:
              'SELECT c.id, c.name, c.version, c.status, c.programType, c.clientId, c.createdAt' +
              ' FROM c' +
              ' WHERE STARTSWITH(c.id, @baseName) OR c.name = @name' +
              ' ORDER BY c.createdAt DESC',
            parameters: [
              // Strip trailing version suffix to get the base name used as a prefix
              { name: '@baseName', value: rawId.replace(/-v[\d.]+$/, '') },
              { name: '@name', value: rawId },
            ],
          })
          .fetchAll();

        return res.json(resources);
      } catch (err) {
        logger.error('Failed to list review program versions', {
          id: req.params['id'],
          error: err,
        });
        return res.status(500).json({ error: 'Failed to retrieve program versions' });
      }
    },
  );

  // ── POST / ──────────────────────────────────────────────────────────────────
  /**
   * Create a new review program.
   *
   * The id is derived as `${slug(name)}-v${version}`.
   * Global programs (clientId absent or null) are stored under the
   * synthetic partition key '__global__'.
   */
  router.post(
    '/',
    body('name').isString().notEmpty().withMessage('name is required'),
    body('version').isString().notEmpty().withMessage('version is required'),
    body('programType')
      .isIn(['FRAUD', 'QC', 'PORTFOLIO', '1033', 'APPRAISAL_REVIEW'])
      .withMessage('programType must be one of FRAUD | QC | PORTFOLIO | 1033 | APPRAISAL_REVIEW'),
    body('status')
      .isIn(['ACTIVE', 'INACTIVE', 'DRAFT'])
      .withMessage('status must be ACTIVE | INACTIVE | DRAFT'),
    body('thresholds').isObject().withMessage('thresholds must be an object'),
    body('decisionRules').isObject().withMessage('decisionRules must be an object'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const container = dbService.getReviewProgramsContainer();

        const {
          name,
          version,
          programType,
          status,
          clientId,
          thresholds,
          autoFlags,
          manualFlags,
          decisionRules,
        } = req.body as ReviewProgram;

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const id = `${slug}-v${version}`;

        // Validate id uniqueness
        const { resources: existing } = await container.items
          .query<ReviewProgram>({
            query: 'SELECT c.id FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: id }],
          })
          .fetchAll();

        if (existing.length > 0) {
          return res.status(409).json({
            error: `A review program with id '${id}' already exists. Bump the version to create a new one.`,
          });
        }

        const partitionKey = clientId ?? GLOBAL_CLIENT_ID;

        const newProgram: ReviewProgram = {
          id,
          name,
          version,
          programType,
          status,
          clientId: clientId ?? null,
          createdAt: new Date().toISOString(),
          thresholds,
          autoFlags: autoFlags ?? [],
          manualFlags: manualFlags ?? [],
          decisionRules,
        };

        await container.items.create({ ...newProgram, clientId: partitionKey });

        // Return with clientId restored to null for global programs
        return res.status(201).json(newProgram);
      } catch (err) {
        logger.error('Failed to create review program', { error: err });
        return res.status(500).json({ error: 'Failed to create review program' });
      }
    },
  );

  // ── PUT /:id ─────────────────────────────────────────────────────────────────
  /**
   * Full update of an existing review program.
   * id and createdAt are immutable — any values in the request body are ignored.
   */
  router.put(
    '/:id',
    param('id').isString().notEmpty().withMessage('id is required'),
    body('programType')
      .optional()
      .isIn(['FRAUD', 'QC', 'PORTFOLIO', '1033', 'APPRAISAL_REVIEW']),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'DRAFT']),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const container = dbService.getReviewProgramsContainer();
        const id = req.params['id'] as string;

        // Fetch existing (cross-partition — we don't know partition key from URL)
        const { resources } = await container.items
          .query<ReviewProgram>({
            query: 'SELECT * FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: id }],
          })
          .fetchAll();

        const existing = resources[0];
        if (!existing) {
          return res.status(404).json({ error: `Review program '${id}' not found` });
        }

        const updated: ReviewProgram = {
          ...existing,
          ...req.body,
          // Immutable fields
          id: existing.id,
          createdAt: existing.createdAt,
          clientId: existing.clientId,
        };

        const partitionKey = existing.clientId ?? GLOBAL_CLIENT_ID;
        await container.item(id, partitionKey).replace({ ...updated, clientId: partitionKey });

        return res.json({ ...updated, clientId: existing.clientId });
      } catch (err) {
        logger.error('Failed to update review program', { id: req.params['id'], error: err });
        return res.status(500).json({ error: 'Failed to update review program' });
      }
    },
  );

  // ── PATCH /:id/status ────────────────────────────────────────────────────────
  /**
   * Toggle the status of a review program (ACTIVE ↔ INACTIVE ↔ DRAFT).
   * Lightweight alternative to a full PUT when only the activation state changes.
   */
  router.patch(
    '/:id/status',
    param('id').isString().notEmpty().withMessage('id is required'),
    body('status')
      .isIn(['ACTIVE', 'INACTIVE', 'DRAFT'])
      .withMessage('status must be ACTIVE | INACTIVE | DRAFT'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const container = dbService.getReviewProgramsContainer();
        const id = req.params['id'] as string;
        const { status } = req.body as { status: ReviewProgram['status'] };

        const { resources } = await container.items
          .query<ReviewProgram>({
            query: 'SELECT * FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: id }],
          })
          .fetchAll();

        const existing = resources[0];
        if (!existing) {
          return res.status(404).json({ error: `Review program '${id}' not found` });
        }

        const partitionKey = existing.clientId ?? GLOBAL_CLIENT_ID;
        const updated = { ...existing, status, clientId: partitionKey };
        await container.item(id, partitionKey).replace(updated);

        return res.json({ ...updated, clientId: existing.clientId });
      } catch (err) {
        logger.error('Failed to update review program status', { id: req.params['id'], error: err });
        return res.status(500).json({ error: 'Failed to update review program status' });
      }
    },
  );

  // ── DELETE /:id ──────────────────────────────────────────────────────────────
  /**
   * Delete a review program by id.
   *
   * Only INACTIVE or DRAFT programs may be deleted — deleting an ACTIVE program
   * is blocked to prevent breaking in-flight evaluations.
   */
  router.delete(
    '/:id',
    param('id').isString().notEmpty().withMessage('id is required'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const container = dbService.getReviewProgramsContainer();
        const id = req.params['id'] as string;

        const { resources } = await container.items
          .query<ReviewProgram>({
            query: 'SELECT * FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: id }],
          })
          .fetchAll();

        const existing = resources[0];
        if (!existing) {
          return res.status(404).json({ error: `Review program '${id}' not found` });
        }

        if (existing.status === 'ACTIVE') {
          return res.status(409).json({
            error: 'Cannot delete an ACTIVE review program. Deactivate it first.',
          });
        }

        const partitionKey = existing.clientId ?? GLOBAL_CLIENT_ID;
        await container.item(id, partitionKey).delete();

        return res.json({ message: `Review program '${id}' deleted successfully` });
      } catch (err) {
        logger.error('Failed to delete review program', { id: req.params['id'], error: err });
        return res.status(500).json({ error: 'Failed to delete review program' });
      }
    },
  );

  return router;
}
