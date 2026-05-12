/**
 * Appraisal Draft Controller — Phase 1 of UAD 3.6 Full Compliance
 *
 * REST endpoints for draft CRUD + section-level save supporting
 * front-end auto-save with optimistic concurrency.
 *
 * Routes (all under /api/appraisal-drafts):
 *   POST   /                           Create a new draft from an order
 *   GET    /order/:orderId             List drafts for an order
 *   GET    /:draftId                   Get a single draft
 *   PUT    /:draftId                   Full-document save
 *   PATCH  /:draftId/sections/:sid     Section-level save
 *   POST   /:draftId/finalize          Finalize a draft
 *   DELETE /:draftId                   Delete a draft (CREATED/EDITING only)
 *
 * @see UAD_3.6_COMPLIANCE_PLAN.md — Phase 1
 */

import express, { type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AppraisalDraftService } from '../services/appraisal-draft.service.js';
import { ReportConfigMergerService } from '../services/report-config-merger.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
// DRAFT_SECTION_IDS / DraftSectionId removed from controller (R-10):
// section key validation is now open to any string (product-config-driven).

const logger = new Logger('AppraisalDraftController');

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveUserId(req: UnifiedAuthRequest): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new Error('Missing user identity on authenticated request');
  }
  return userId;
}

// ── Validators ───────────────────────────────────────────────────────────────

const validateCreate = [
  body('orderId').isString().notEmpty().withMessage('orderId is required'),
  body('reportType').isString().notEmpty().withMessage('reportType is required'),
];

const validateSectionSave = [
  param('draftId').isString().notEmpty(),
  // Accept any non-empty string sectionId — valid keys are determined by the
  // product's EffectiveReportConfig, not a compile-time enum (R-10).
  param('sectionId').isString().notEmpty().withMessage('sectionId must be a non-empty string'),
  body('data').isObject().withMessage('data must be an object'),
  body('expectedVersion').isInt({ min: 1 }).withMessage('expectedVersion must be a positive integer'),
];

const validateFullSave = [
  param('draftId').isString().notEmpty(),
  body('reportDocument').isObject().withMessage('reportDocument must be an object'),
  body('expectedVersion').isInt({ min: 1 }).withMessage('expectedVersion must be a positive integer'),
];

const validateFinalize = [
  param('draftId').isString().notEmpty(),
];

// ── Factory ──────────────────────────────────────────────────────────────────

export function createAppraisalDraftRouter(dbService: CosmosDbService): express.Router {
  const router = express.Router();
  const mergerService = new ReportConfigMergerService(dbService);
  const draftService = new AppraisalDraftService(dbService, mergerService);

  // ── POST / — Create draft ──────────────────────────────────────────────

  router.post('/', ...validateCreate, async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const userId = resolveUserId(req);
      const { orderId, reportType } = req.body;
      const draft = await draftService.createDraft({ orderId, reportType }, userId);
      return res.status(201).json({ success: true, data: draft });
    } catch (error) {
      logger.error('Error creating draft', { error });
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // ── GET /order/:orderId — List drafts for an order ─────────────────────

  router.get('/order/:orderId',
    param('orderId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const drafts = await draftService.getDraftsForOrder(req.params['orderId'] as string);
        return res.status(200).json({ success: true, data: drafts });
      } catch (error) {
        logger.error('Error listing drafts', { error });
        return res.status(500).json({ success: false, error: (error as Error).message });
      }
    },
  );

  // ── GET /:draftId — Get a single draft ─────────────────────────────────

  router.get('/:draftId',
    param('draftId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const orderId = req.query.orderId as string | undefined;
        if (!orderId) {
          return res.status(400).json({ success: false, error: 'orderId query parameter is required' });
        }

        const draft = await draftService.getDraft(req.params['draftId'] as string, orderId);
        return res.status(200).json({ success: true, data: draft });
      } catch (error) {
        logger.error('Error getting draft', { error });
        const status = (error as Error).message?.includes('not found') ? 404 : 500;
        return res.status(status).json({ success: false, error: (error as Error).message });
      }
    },
  );

  // ── PUT /:draftId — Full document save ─────────────────────────────────

  router.put('/:draftId', ...validateFullSave, async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const userId = resolveUserId(req);
      const orderId = req.query.orderId as string | undefined;
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'orderId query parameter is required' });
      }

      const { reportDocument, expectedVersion } = req.body;
      const draft = await draftService.saveDraft(req.params['draftId'] as string, orderId, reportDocument, expectedVersion, userId);
      return res.status(200).json({ success: true, data: draft });
    } catch (error) {
      logger.error('Error saving draft', { error });
      const status = (error as Error).message?.includes('Version conflict') ? 409 : 500;
      return res.status(status).json({ success: false, error: (error as Error).message });
    }
  });

  // ── PATCH /:draftId/sections/:sectionId — Section save ─────────────────

  router.patch(
    '/:draftId/sections/:sectionId',
    ...validateSectionSave,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const userId = resolveUserId(req);
        const draftId = req.params['draftId'] as string;
        const sectionId = req.params['sectionId'] as string;
        const orderId = req.query.orderId as string | undefined;
        if (!orderId) {
          return res.status(400).json({ success: false, error: 'orderId query parameter is required' });
        }

        const { data, expectedVersion } = req.body;

        // R-22b: run config-driven validation before persisting. Errors are
        // returned in the response alongside the saved draft so the FE can
        // display inline field messages.  A non-empty errors list does NOT
        // block the save — section data is always persisted (soft validation).
        const fieldErrors = await draftService.validateSection(orderId, sectionId, data ?? {});

        const draft = await draftService.saveSection(
          draftId,
          orderId,
          sectionId,
          { data, expectedVersion },
          userId,
        );
        return res.status(200).json({
          success: true,
          data: draft,
          ...(fieldErrors.length > 0 && { fieldErrors }),
        });
      } catch (error) {
        logger.error('Error saving section', { error });
        const status = (error as Error).message?.includes('Version conflict') ? 409 : 500;
        return res.status(status).json({ success: false, error: (error as Error).message });
      }
    },
  );

  // ── POST /:draftId/finalize — Finalize draft ──────────────────────────

  router.post('/:draftId/finalize',
    ...validateFinalize,
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const userId = resolveUserId(req);
        const orderId = req.query.orderId as string | undefined;
        if (!orderId) {
          return res.status(400).json({ success: false, error: 'orderId query parameter is required' });
        }

        const draft = await draftService.finalizeDraft(req.params['draftId'] as string, orderId, userId);
        return res.status(200).json({ success: true, data: draft });
      } catch (error) {
        logger.error('Error finalizing draft', { error });
        return res.status(500).json({ success: false, error: (error as Error).message });
      }
    },
  );

  // ── DELETE /:draftId — Delete draft ────────────────────────────────────

  router.delete('/:draftId',
    param('draftId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      try {
        const orderId = req.query.orderId as string | undefined;
        if (!orderId) {
          return res.status(400).json({ success: false, error: 'orderId query parameter is required' });
        }

        await draftService.deleteDraft(req.params['draftId'] as string, orderId);
        return res.status(200).json({ success: true, data: { deleted: true } });
      } catch (error) {
        logger.error('Error deleting draft', { error });
        return res.status(500).json({ success: false, error: (error as Error).message });
      }
    },
  );

  return router;
}
