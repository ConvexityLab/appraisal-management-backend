/**
 * Appraiser Exclusionary List Controller
 *
 * Manages the per-tenant list of appraisers/vendors that must never be
 * assigned to an order.  Each entry is backed by a 'blacklist' rule in the
 * vendor-matching-rules container so the existing matching engine enforces it
 * automatically — no dual-write race conditions.
 *
 * Routes (mounted at /api/exclusion-list):
 *   GET    /                     - List all active exclusion entries for tenant
 *   POST   /                     - Add an appraiser to the exclusion list
 *   DELETE /:id                  - Remove an entry (re-enables the appraiser)
 *   GET    /:id                  - Get a single entry
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { VendorMatchingRulesService } from '../services/vendor-matching-rules.service.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import {
  ExclusionListEntry,
  ExclusionReason,
  CreateExclusionRequest,
} from '../types/exclusion.types.js';

const CONTAINER = 'vendor-matching-rules';

export class ExclusionListController {
  private readonly rulesService: VendorMatchingRulesService;
  private readonly db: CosmosDbService;
  private readonly logger: Logger;

  constructor(db: CosmosDbService) {
    this.db = db;
    this.rulesService = new VendorMatchingRulesService(db);
    this.logger = new Logger('ExclusionListController');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/exclusion-list
  // ─────────────────────────────────────────────────────────────────────────
  list = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    try {
      const container = this.db.getContainer(CONTAINER);
      const { resources } = await container.items.query<ExclusionListEntry>({
        query: `SELECT * FROM c
                WHERE c.tenantId = @tid
                  AND c.type = 'appraiser-exclusion'
                ORDER BY c.addedAt DESC`,
        parameters: [{ name: '@tid', value: tenantId }],
      }).fetchAll();

      // Filter out expired entries (soft filter — expired entries are inert because
      // the backing rule is deactivated when expiresAt passes, but we clean up the
      // view here to avoid confusion).
      const now = new Date().toISOString();
      const active = resources.filter(e => !e.expiresAt || e.expiresAt > now);

      res.json({ success: true, data: active, total: active.length });
    } catch (error) {
      this.logger.error('Failed to list exclusion entries', { error, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve exclusion list' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/exclusion-list/:id
  // ─────────────────────────────────────────────────────────────────────────
  getById = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id parameter is required' } });
      return;
    }

    try {
      const entry = await this.findEntry(id, tenantId);
      if (!entry) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Exclusion entry not found: ${id}` } });
        return;
      }
      res.json({ success: true, data: entry });
    } catch (error) {
      this.logger.error('Failed to get exclusion entry', { error, id, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve exclusion entry' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/exclusion-list
  //
  // Body: CreateExclusionRequest
  // ─────────────────────────────────────────────────────────────────────────
  create = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    const addedBy = req.user?.id ?? 'unknown';
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    const body = req.body as Partial<CreateExclusionRequest>;

    if (!body.appraiserId) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'appraiserId is required' } });
      return;
    }
    if (!body.appraiserName) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'appraiserName is required' } });
      return;
    }
    if (!body.reason) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'reason is required' } });
      return;
    }

    const validReasons: ExclusionReason[] = [
      'performance', 'conflict_of_interest', 'regulatory',
      'client_request', 'internal_policy', 'other',
    ];
    if (!validReasons.includes(body.reason)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `reason must be one of: ${validReasons.join(', ')}. Got: "${body.reason}"`,
        },
      });
      return;
    }

    // Regulatory and conflict of interest require a written explanation.
    if ((body.reason === 'regulatory' || body.reason === 'conflict_of_interest') && !body.notes) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `notes are required when reason is "${body.reason}"`,
        },
      });
      return;
    }

    try {
      // Check for duplicate active exclusion for this tenant+appraiser pair.
      const container = this.db.getContainer(CONTAINER);
      const { resources: existing } = await container.items.query<ExclusionListEntry>({
        query: `SELECT * FROM c
                WHERE c.tenantId = @tid
                  AND c.appraiserId = @aid
                  AND c.type = 'appraiser-exclusion'`,
        parameters: [
          { name: '@tid', value: tenantId },
          { name: '@aid', value: body.appraiserId },
        ],
      }).fetchAll();

      const now = new Date().toISOString();
      const activeDuplicate = existing.find(e => !e.expiresAt || e.expiresAt > now);
      if (activeDuplicate) {
        res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_EXCLUSION',
            message: `Appraiser ${body.appraiserId} is already on the exclusion list for this tenant (entry id: ${activeDuplicate.id})`,
          },
        });
        return;
      }

      // Create the backing blacklist rule in the matching engine.
      const rule = await this.rulesService.createRule({
        tenantId,
        name: `Exclusion: ${body.appraiserName}`,
        description: `[Exclusion List] ${body.reason}${body.notes ? ` — ${body.notes}` : ''}`,
        isActive: true,
        priority: 1,  // evaluated first — deny rules must be ≤ 20
        ruleType: 'blacklist',
        action: 'deny',
        vendorId: body.appraiserId,
        createdBy: addedBy,
      });

      // Store the ExclusionListEntry as a companion document.
      const entry: ExclusionListEntry = {
        id: uuidv4(),
        tenantId,
        appraiserId: body.appraiserId,
        appraiserName: body.appraiserName,
        reason: body.reason,
        ...(body.notes !== undefined && { notes: body.notes }),
        addedBy,
        addedAt: now,
        expiresAt: body.expiresAt ?? null,
        matchingRuleId: rule.id,
        type: 'appraiser-exclusion',
      };

      await this.db.createDocument(CONTAINER, entry);

      this.logger.info('Appraiser added to exclusion list', {
        id: entry.id,
        appraiserId: body.appraiserId,
        tenantId,
        reason: body.reason,
      });

      res.status(201).json({ success: true, data: entry });
    } catch (error) {
      this.logger.error('Failed to create exclusion entry', { error, body, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add appraiser to exclusion list' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/exclusion-list/:id
  // ─────────────────────────────────────────────────────────────────────────
  remove = async (req: UnifiedAuthRequest, res: Response): Promise<void> => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id parameter is required' } });
      return;
    }

    try {
      const entry = await this.findEntry(id, tenantId);
      if (!entry) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Exclusion entry not found: ${id}` } });
        return;
      }

      // Delete the backing blacklist rule first.
      await this.rulesService.deleteRule(entry.matchingRuleId, tenantId);

      // Delete the exclusion entry document.
      await this.db.deleteDocument(CONTAINER, entry.id, tenantId);

      this.logger.info('Appraiser removed from exclusion list', {
        id: entry.id,
        appraiserId: entry.appraiserId,
        tenantId,
      });

      res.json({ success: true, data: { id: entry.id, removed: true } });
    } catch (error) {
      this.logger.error('Failed to remove exclusion entry', { error, id, tenantId });
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove exclusion entry' } });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async findEntry(id: string, tenantId: string): Promise<ExclusionListEntry | null> {
    const container = this.db.getContainer(CONTAINER);
    const { resources } = await container.items.query<ExclusionListEntry>({
      query: `SELECT * FROM c
              WHERE c.id = @id
                AND c.tenantId = @tid
                AND c.type = 'appraiser-exclusion'`,
      parameters: [
        { name: '@id', value: id },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();
    return resources[0] ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router factory (matches the pattern used by every other controller)
// ─────────────────────────────────────────────────────────────────────────────
export function createExclusionListRouter(db: CosmosDbService): Router {
  const router = Router();
  const ctrl = new ExclusionListController(db);

  router.get('/',      ctrl.list);
  router.get('/:id',   ctrl.getById);
  router.post('/',     ctrl.create);
  router.delete('/:id', ctrl.remove);

  return router;
}
