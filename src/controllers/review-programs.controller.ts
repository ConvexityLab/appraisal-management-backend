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
import { randomUUID } from 'crypto';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { ReviewProgram } from '../types/review-tape.types.js';
import { ReviewPreparationService } from '../services/review-preparation.service.js';
import { ReviewPreparedContextService } from '../services/review-prepared-context.service.js';
import { ReviewDispatchService } from '../services/review-dispatch.service.js';
import { ReviewContextDiffService } from '../services/review-context-diff.service.js';
import { ServiceBusEventPublisher } from '../services/service-bus-publisher.js';
import { dedupeReviewPrograms, normalizeReviewProgram, selectPreferredReviewProgram } from '../utils/review-program-normalization.js';
import {
  EventCategory,
  EventPriority,
  type ReviewProgramPrepareCompletedEvent,
  type ReviewProgramPrepareFailedEvent,
  type ReviewProgramPrepareStartedEvent,
  type ReviewProgramDispatchCompletedEvent,
  type ReviewProgramSubmittedEvent,
} from '../types/events.js';
import type {
  ReviewProgramOrchestrationRequest,
  ReviewProgramOrchestrationResult,
} from '../types/review-program-orchestration.types.js';
import type {
  DispatchPreparedReviewProgramsRequest,
  DispatchPreparedReviewProgramsResponse,
  PrepareReviewProgramsRequest,
  PrepareReviewProgramsResponse,
} from '../types/review-preparation.types.js';

const logger = new Logger();

/**
 * Cosmos stores global programs (clientId === null) with a synthetic
 * partition key so that the container's required /clientId key is never null.
 */
const GLOBAL_CLIENT_ID = '__global__';

interface ReviewProgramsRouterDependencies {
  preparationFactory?: () => Pick<ReviewPreparationService, 'prepare'>;
  preparedContextFactory?: () => Pick<ReviewPreparedContextService, 'persistPreparation' | 'getPreparedContext' | 'listPreparedContextsForOrder'>;
  dispatchFactory?: () => Pick<ReviewDispatchService, 'dispatch'>;
  eventPublisher?: Pick<ServiceBusEventPublisher, 'publishBatch'>;
}

function hasInlineConfig(program: Partial<ReviewProgram>): boolean {
  return Boolean(
    program.thresholds ||
    program.decisionRules ||
    (program.autoFlags?.length ?? 0) > 0 ||
    (program.manualFlags?.length ?? 0) > 0,
  );
}

function normalizeEngineRefs(
  refs: Array<{ programId: string; programVersion: string }> | undefined,
): Array<{ programId: string; programVersion: string }> {
  return (refs ?? []).filter(
    (ref) => ref.programId.trim().length > 0 && ref.programVersion.trim().length > 0,
  );
}

// ─── factory ──────────────────────────────────────────────────────────────────

export function createReviewProgramsRouter(
  dbService: CosmosDbService,
  dependencies: ReviewProgramsRouterDependencies = {},
) {
  const router = express.Router();
  const eventPublisher = dependencies.eventPublisher ?? new ServiceBusEventPublisher();

  const publishReviewProgramEvents = async (params: {
    request: ReviewProgramOrchestrationRequest;
    result: ReviewProgramOrchestrationResult;
    tenantId: string;
    initiatedBy: string;
    correlationId: string;
  }) => {
    const { request, result, tenantId, initiatedBy, correlationId } = params;
    const orderId = request.loanPropertyContextId;
    const allLegs = [...result.axiomLegs, ...result.mopLegs];
    const submittedLegs = allLegs.filter((leg) => leg.status === 'submitted').length;
    const failedLegs = allLegs.filter((leg) => leg.status === 'failed').length;
    const skippedLegs = allLegs.filter((leg) => leg.status === 'skipped').length;
    const priority =
      result.overallStatus === 'all_submitted'
        ? EventPriority.NORMAL
        : result.overallStatus === 'partial'
          ? EventPriority.HIGH
          : EventPriority.CRITICAL;

    const submittedEvent: ReviewProgramSubmittedEvent = {
      id: randomUUID(),
      type: 'review-program.submitted',
      category: EventCategory.SUBMISSION,
      source: 'review-programs.controller',
      version: '1.0',
      timestamp: new Date(),
      correlationId,
      data: {
        reviewProgramId: result.reviewProgramId,
        reviewProgramName: result.reviewProgramName,
        ...(orderId ? { orderId } : {}),
        ...(request.engagementId ? { engagementId: request.engagementId } : {}),
        tenantId,
        clientId: request.clientId,
        subClientId: request.subClientId,
        ...(request.snapshotId ? { snapshotId: request.snapshotId } : {}),
        initiatedBy,
        priority: EventPriority.NORMAL,
      },
    };

    const completedEvent: ReviewProgramDispatchCompletedEvent = {
      id: randomUUID(),
      type: 'review-program.dispatch.completed',
      category: EventCategory.SUBMISSION,
      source: 'review-programs.controller',
      version: '1.0',
      timestamp: new Date(),
      correlationId,
      data: {
        reviewProgramId: result.reviewProgramId,
        reviewProgramName: result.reviewProgramName,
        ...(orderId ? { orderId } : {}),
        ...(request.engagementId ? { engagementId: request.engagementId } : {}),
        tenantId,
        clientId: request.clientId,
        subClientId: request.subClientId,
        ...(request.snapshotId ? { snapshotId: request.snapshotId } : {}),
        initiatedBy,
        overallStatus: result.overallStatus,
        submittedLegs,
        failedLegs,
        skippedLegs,
        axiomLegs: result.axiomLegs.map((leg) => ({
          programId: leg.programId,
          programVersion: leg.programVersion,
          status: leg.status,
          ...(leg.runId ? { runId: leg.runId } : {}),
          ...(leg.error ? { error: leg.error } : {}),
        })),
        mopLegs: result.mopLegs.map((leg) => ({
          programId: leg.programId,
          programVersion: leg.programVersion,
          status: leg.status,
          ...(leg.runId ? { runId: leg.runId } : {}),
          ...(leg.error ? { error: leg.error } : {}),
        })),
        priority,
      },
    };

    try {
      await eventPublisher.publishBatch([submittedEvent, completedEvent]);
    } catch (publishErr) {
      logger.warn('Failed to publish review-program lifecycle events', {
        reviewProgramId: result.reviewProgramId,
        correlationId,
        error: publishErr instanceof Error ? publishErr.message : String(publishErr),
      });
    }
  };

  const publishPreparationEvents = async (
    events: Array<
      ReviewProgramPrepareStartedEvent |
      ReviewProgramPrepareCompletedEvent |
      ReviewProgramPrepareFailedEvent
    >,
  ) => {
    try {
      await eventPublisher.publishBatch(events);
    } catch (publishErr) {
      logger.warn('Failed to publish review-program preparation lifecycle events', {
        eventTypes: events.map((event) => event.type),
        correlationIds: [...new Set(events.map((event) => event.correlationId))],
        error: publishErr instanceof Error ? publishErr.message : String(publishErr),
      });
    }
  };

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

        const { resources: items } = await container.items
          .query<ReviewProgram>({
            query: `SELECT * FROM c WHERE ${whereClause} ORDER BY c.name ASC`,
            parameters,
          })
          .fetchAll();

        const normalizedItems = dedupeReviewPrograms(items, clientId ?? undefined);
        const total = normalizedItems.length;
        const pagedItems = normalizedItems.slice(offset, offset + pageSizeNum);

        return res.json({ items: pagedItems, total, page: pageNum, pageSize: pageSizeNum });
      } catch (err) {
        logger.error('Failed to list review programs', { error: err });
        return res.status(500).json({ error: 'Failed to retrieve review programs' });
      }
    },
  );

  // ── POST /prepare ───────────────────────────────────────────────────────────
  /**
   * Assemble review context and report dispatch readiness for one or more review programs.
   *
   * This route does not submit anything to downstream engines. It is a conservative,
   * read-only preparation pass that surfaces missing prerequisites before dispatch.
   */
  router.post(
    '/prepare',
    body('orderId').isString().notEmpty().withMessage('orderId is required'),
    body('reviewProgramIds').isArray({ min: 1 }).withMessage('reviewProgramIds must contain at least one id'),
    body('reviewProgramIds.*').isString().notEmpty().withMessage('reviewProgramIds must contain non-empty ids'),
    body('engagementId').optional().isString().notEmpty().withMessage('engagementId must be a non-empty string'),
    body('clientId').optional().isString().notEmpty().withMessage('clientId must be a non-empty string'),
    body('subClientId').optional().isString().notEmpty().withMessage('subClientId must be a non-empty string'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'User tenant not resolved — authentication required' });
      }

      const correlationSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const correlationId =
        (req.header('X-Correlation-Id') ?? `rp-prepare-${correlationSuffix}`).trim();
      const idempotencyKey =
        (req.header('Idempotency-Key') ?? `rp-prepare-${correlationSuffix}`).trim();
      const initiatedBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'unknown-user';

      const preparationRequest: PrepareReviewProgramsRequest = {
        orderId: req.body.orderId as string,
        reviewProgramIds: req.body.reviewProgramIds as string[],
        ...(req.body.engagementId ? { engagementId: req.body.engagementId as string } : {}),
        ...(req.body.clientId ? { clientId: req.body.clientId as string } : {}),
        ...(req.body.subClientId ? { subClientId: req.body.subClientId as string } : {}),
      };
      if (req.body.options && typeof req.body.options === 'object') {
        const options = req.body.options as NonNullable<PrepareReviewProgramsRequest['options']>;
        preparationRequest.options = options;
      }

      await publishPreparationEvents([
        {
          id: randomUUID(),
          type: 'review-program.prepare.started',
          category: EventCategory.SUBMISSION,
          source: 'review-programs.controller',
          version: '1.0',
          timestamp: new Date(),
          correlationId,
          data: {
            orderId: preparationRequest.orderId,
            ...(preparationRequest.engagementId ? { engagementId: preparationRequest.engagementId } : {}),
            tenantId,
            ...(preparationRequest.clientId ? { clientId: preparationRequest.clientId } : {}),
            ...(preparationRequest.subClientId ? { subClientId: preparationRequest.subClientId } : {}),
            reviewProgramIds: preparationRequest.reviewProgramIds,
            initiatedBy,
            priority: EventPriority.NORMAL,
          },
        },
      ]);

      try {
        const preparationService =
          dependencies.preparationFactory?.() ?? new ReviewPreparationService(dbService);
        const preparedContextService =
          dependencies.preparedContextFactory?.() ?? new ReviewPreparedContextService(dbService);

        const result: PrepareReviewProgramsResponse = await preparationService.prepare(
          preparationRequest,
          {
            tenantId,
            initiatedBy,
            correlationId,
            idempotencyKey,
          },
        );

        const persistedResult = await preparedContextService.persistPreparation(
          result,
          {
            tenantId,
            initiatedBy,
            correlationId,
            idempotencyKey,
          },
        );

        if (!persistedResult.preparedContextId || !persistedResult.preparedContextVersion) {
          throw new Error('Prepared review context persistence did not return a prepared context id/version.');
        }

        await publishPreparationEvents([
          {
            id: randomUUID(),
            type: 'review-program.prepare.completed',
            category: EventCategory.SUBMISSION,
            source: 'review-programs.controller',
            version: '1.0',
            timestamp: new Date(),
            correlationId,
            data: {
              orderId: preparationRequest.orderId,
              ...(preparationRequest.engagementId ? { engagementId: preparationRequest.engagementId } : {}),
              tenantId,
              ...(persistedResult.contextSummary.clientId ? { clientId: persistedResult.contextSummary.clientId } : {}),
              ...(persistedResult.contextSummary.subClientId ? { subClientId: persistedResult.contextSummary.subClientId } : {}),
              reviewProgramIds: preparationRequest.reviewProgramIds,
              preparedContextId: persistedResult.preparedContextId,
              preparedContextVersion: persistedResult.preparedContextVersion,
              readyProgramCount: persistedResult.programs.filter((program) => program.canDispatch).length,
              blockedProgramCount: persistedResult.programs.filter((program) => !program.canDispatch).length,
              warningCount: persistedResult.warnings.length,
              recommendedActionCount: persistedResult.recommendedActions.length,
              initiatedBy,
              priority: persistedResult.programs.some((program) => !program.canDispatch)
                ? EventPriority.HIGH
                : EventPriority.NORMAL,
            },
          },
        ]);

        return res.status(200).json({ success: true, data: persistedResult });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to prepare review programs';
        logger.error('Review program preparation failed', {
          orderId: req.body.orderId,
          reviewProgramIds: req.body.reviewProgramIds,
          error: err,
        });

        await publishPreparationEvents([
          {
            id: randomUUID(),
            type: 'review-program.prepare.failed',
            category: EventCategory.SUBMISSION,
            source: 'review-programs.controller',
            version: '1.0',
            timestamp: new Date(),
            correlationId,
            data: {
              orderId: preparationRequest.orderId,
              ...(preparationRequest.engagementId ? { engagementId: preparationRequest.engagementId } : {}),
              tenantId,
              ...(preparationRequest.clientId ? { clientId: preparationRequest.clientId } : {}),
              ...(preparationRequest.subClientId ? { subClientId: preparationRequest.subClientId } : {}),
              reviewProgramIds: preparationRequest.reviewProgramIds,
              initiatedBy,
              error: message,
              priority: EventPriority.HIGH,
            },
          },
        ]);

        const status = message.includes('not found') ? 404 : message.includes('required') ? 400 : 500;
        return res.status(status).json({ success: false, error: message });
      }
    },
  );

  // ── POST /dispatch ─────────────────────────────────────────────────────────
  /**
   * Dispatch one or more review programs from a persisted prepared context artifact.
   */
  const preparedDispatchValidators = [
    body('preparedContextId').optional().isString().notEmpty().withMessage('preparedContextId must be a non-empty string'),
    body('reviewProgramIds').isArray({ min: 1 }).withMessage('reviewProgramIds must contain at least one id'),
    body('reviewProgramIds.*').isString().notEmpty().withMessage('reviewProgramIds must contain non-empty ids'),
    body('dispatchMode').optional().isIn(['all_ready_only', 'include_partial']).withMessage('dispatchMode must be all_ready_only or include_partial'),
    body('confirmWarnings').optional().isBoolean().withMessage('confirmWarnings must be a boolean'),
  ];

  const handlePreparedDispatch = async (req: UnifiedAuthRequest, res: Response) => {
    const preparedContextIdFromRoute = req.params['preparedContextId'];
    const preparedContextIdFromBody = req.body.preparedContextId as string | undefined;

    if (!preparedContextIdFromRoute && !preparedContextIdFromBody) {
      return res.status(400).json({
        errors: [{
          type: 'field',
          msg: 'preparedContextId is required',
          path: 'preparedContextId',
          location: 'body',
        }],
      });
    }

    if (
      preparedContextIdFromRoute &&
      preparedContextIdFromBody &&
      preparedContextIdFromRoute !== preparedContextIdFromBody
    ) {
      return res.status(400).json({
        success: false,
        error: 'preparedContextId in the route must match preparedContextId in the request body when both are supplied',
      });
    }

    const preparedContextId = preparedContextIdFromRoute ?? (preparedContextIdFromBody as string);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'User tenant not resolved — authentication required' });
    }

    try {
      const preparedContextService =
        dependencies.preparedContextFactory?.() ?? new ReviewPreparedContextService(dbService);
      const dispatchService =
        dependencies.dispatchFactory?.() ?? new ReviewDispatchService(dbService);

      const correlationSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const correlationId =
        (req.header('X-Correlation-Id') ?? `rp-dispatch-${correlationSuffix}`).trim();
      const idempotencyKey =
        (req.header('Idempotency-Key') ?? `rp-dispatch-${correlationSuffix}`).trim();
      const initiatedBy = req.user?.id ?? req.user?.azureAdObjectId ?? 'unknown-user';

      const dispatchRequest: DispatchPreparedReviewProgramsRequest = {
        preparedContextId,
        reviewProgramIds: req.body.reviewProgramIds as string[],
        ...(req.body.dispatchMode ? { dispatchMode: req.body.dispatchMode as 'all_ready_only' | 'include_partial' } : {}),
        ...(typeof req.body.confirmWarnings === 'boolean' ? { confirmWarnings: req.body.confirmWarnings as boolean } : {}),
      };

      const preparedContext = await preparedContextService.getPreparedContext(dispatchRequest.preparedContextId, tenantId);
      const result: DispatchPreparedReviewProgramsResponse = await dispatchService.dispatch(
        dispatchRequest,
        {
          tenantId,
          initiatedBy,
          correlationId,
          idempotencyKey,
        },
      );

      const snapshotId = preparedContext.context.runSummary.latestSnapshotId;
      const clientId = preparedContext.context.identity.clientId;
      const subClientId = preparedContext.context.identity.subClientId;
      if (snapshotId && clientId && subClientId) {
        for (const submittedProgram of result.submittedPrograms) {
          await publishReviewProgramEvents({
            request: {
              snapshotId,
              clientId,
              subClientId,
              ...(preparedContext.engagementId ? { engagementId: preparedContext.engagementId } : {}),
              loanPropertyContextId: preparedContext.orderId,
              preparedContextId: preparedContext.preparedContextId,
              preparedContextVersion: preparedContext.preparedContextVersion,
              preparedDispatchId: result.dispatchId,
              preparedEngineDispatches: preparedContext.plannedEngineDispatches.filter(
                (dispatch) => dispatch.reviewProgramId === submittedProgram.reviewProgramId,
              ),
            },
            result: {
              reviewProgramId: submittedProgram.reviewProgramId,
              reviewProgramName: submittedProgram.reviewProgramName,
              overallStatus: submittedProgram.overallStatus,
              axiomLegs: submittedProgram.axiomLegs,
              mopLegs: submittedProgram.mopLegs,
              ...(submittedProgram.skippedReason ? { skippedReason: submittedProgram.skippedReason } : {}),
            },
            tenantId,
            initiatedBy,
            correlationId,
          });
        }
      }

      const httpStatus =
        result.submittedPrograms.length === 0
          ? 422
          : result.skippedPrograms.length > 0 || result.warnings.length > 0
            ? 207
            : 202;

      return res.status(httpStatus).json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to dispatch prepared review programs';
      logger.error('Prepared review program dispatch failed', {
        preparedContextId,
        reviewProgramIds: req.body.reviewProgramIds,
        error: err,
      });
      const status = message.includes('not found') ? 404 : message.includes('required') ? 400 : 500;
      return res.status(status).json({ success: false, error: message });
    }
  };

  router.post(
    '/dispatch',
    preparedDispatchValidators,
    handlePreparedDispatch,
  );

  router.post(
    '/prepared/:preparedContextId/dispatch',
    param('preparedContextId').isString().notEmpty().withMessage('preparedContextId is required'),
    preparedDispatchValidators,
    handlePreparedDispatch,
  );

  // ── GET /prepared/:id ───────────────────────────────────────────────────────
  /**
   * Retrieve a persisted prepared review-context artifact for explainability and re-dispatch.
   */
  router.get(
    '/prepared',
    [
      query('orderId').isString().notEmpty().withMessage('orderId is required'),
      query('limit').optional().isInt({ min: 1, max: 25 }).withMessage('limit must be between 1 and 25'),
    ],
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'User tenant not resolved — authentication required' });
      }

      try {
        const preparedContextService =
          dependencies.preparedContextFactory?.() ?? new ReviewPreparedContextService(dbService);
        const orderId = req.query['orderId'] as string;
        const limit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string, 10) : 10;
        const preparedContexts = await preparedContextService.listPreparedContextsForOrder(orderId, tenantId, limit);
        return res.status(200).json({ success: true, data: preparedContexts });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to list prepared review contexts';
        logger.error('Prepared review context listing failed', {
          orderId: req.query['orderId'],
          error: err,
        });
        return res.status(message.includes('required') ? 400 : 500).json({ success: false, error: message });
      }
    },
  );

  router.get(
    '/prepared/:id',
    param('id').isString().notEmpty().withMessage('id is required'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'User tenant not resolved — authentication required' });
      }

      try {
        const preparedContextService =
          dependencies.preparedContextFactory?.() ?? new ReviewPreparedContextService(dbService);
        const preparedContext = await preparedContextService.getPreparedContext(req.params['id'] as string, tenantId);
        return res.status(200).json({ success: true, data: preparedContext });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to retrieve prepared review context';
        logger.error('Prepared review context retrieval failed', {
          preparedContextId: req.params['id'],
          error: err,
        });
        return res.status(message.includes('not found') ? 404 : 500).json({ success: false, error: message });
      }
    },
  );

  // ── GET /prepared/:id/diff/:otherId ───────────────────────────────────────
  /**
   * Compare two persisted prepared review-context artifacts and summarize what changed.
   */
  router.get(
    '/prepared/:id/diff/:otherId',
    param('id').isString().notEmpty().withMessage('id is required'),
    param('otherId').isString().notEmpty().withMessage('otherId is required'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'User tenant not resolved — authentication required' });
      }

      try {
        const preparedContextService =
          dependencies.preparedContextFactory?.() ?? new ReviewPreparedContextService(dbService);
        const diffService = new ReviewContextDiffService();
        const [leftPreparedContext, rightPreparedContext] = await Promise.all([
          preparedContextService.getPreparedContext(req.params['id'] as string, tenantId),
          preparedContextService.getPreparedContext(req.params['otherId'] as string, tenantId),
        ]);

        if (leftPreparedContext.orderId !== rightPreparedContext.orderId) {
          return res.status(400).json({
            success: false,
            error: `Prepared contexts '${leftPreparedContext.preparedContextId}' and '${rightPreparedContext.preparedContextId}' belong to different orders and cannot be compared.`,
          });
        }

        const diff = diffService.diffPreparedContexts(leftPreparedContext, rightPreparedContext);
        return res.status(200).json({ success: true, data: diff });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to diff prepared review contexts';
        logger.error('Prepared review context diff failed', {
          preparedContextId: req.params['id'],
          otherPreparedContextId: req.params['otherId'],
          error: err,
        });
        return res.status(message.includes('not found') ? 404 : message.includes('cannot be compared') ? 400 : 500).json({ success: false, error: message });
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

        const program = selectPreferredReviewProgram(resources);
        if (!program) {
          return res.status(404).json({ error: `Review program '${req.params['id']}' not found` });
        }

        return res.json(normalizeReviewProgram(program));
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

        return res.json(resources.map((program) => normalizeReviewProgram(program)));
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
    body('thresholds').optional().isObject().withMessage('thresholds must be an object'),
    body('decisionRules').optional().isObject().withMessage('decisionRules must be an object'),
    body('rulesetRefs').optional().isArray().withMessage('rulesetRefs must be an array'),
    body('aiCriteriaRefs').optional().isArray().withMessage('aiCriteriaRefs must be an array'),
    body('rulesetRefs.*.programId').optional().isString().notEmpty().withMessage('rulesetRefs[].programId is required'),
    body('rulesetRefs.*.programVersion').optional().isString().notEmpty().withMessage('rulesetRefs[].programVersion is required'),
    body('aiCriteriaRefs.*.programId').optional().isString().notEmpty().withMessage('aiCriteriaRefs[].programId is required'),
    body('aiCriteriaRefs.*.programVersion').optional().isString().notEmpty().withMessage('aiCriteriaRefs[].programVersion is required'),
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
          rulesetRefs,
          aiCriteriaRefs,
          thresholds,
          autoFlags,
          manualFlags,
          decisionRules,
        } = req.body as ReviewProgram;

        const normalizedRulesetRefs = normalizeEngineRefs(rulesetRefs);
        const normalizedAiCriteriaRefs = normalizeEngineRefs(aiCriteriaRefs);
        const inlineConfigRequested = hasInlineConfig({
          ...(thresholds !== undefined ? { thresholds } : {}),
          ...(autoFlags !== undefined ? { autoFlags } : {}),
          ...(manualFlags !== undefined ? { manualFlags } : {}),
          ...(decisionRules !== undefined ? { decisionRules } : {}),
        });

        if (!inlineConfigRequested && normalizedRulesetRefs.length === 0 && normalizedAiCriteriaRefs.length === 0) {
          return res.status(400).json({
            error: 'A review program must define either engine refs (aiCriteriaRefs / rulesetRefs) or inline rules.',
          });
        }

        if (inlineConfigRequested && (!thresholds || !decisionRules)) {
          return res.status(400).json({
            error: 'Inline-rule programs must include both thresholds and decisionRules.',
          });
        }

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
          ...(normalizedRulesetRefs.length > 0 ? { rulesetRefs: normalizedRulesetRefs } : {}),
          ...(normalizedAiCriteriaRefs.length > 0 ? { aiCriteriaRefs: normalizedAiCriteriaRefs } : {}),
          ...(thresholds !== undefined    ? { thresholds }    : {}),
          ...(autoFlags !== undefined     ? { autoFlags: autoFlags ?? [] } : {}),
          ...(manualFlags !== undefined   ? { manualFlags: manualFlags ?? [] } : {}),
          ...(decisionRules !== undefined ? { decisionRules } : {}),
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

        const normalizedRulesetRefs = normalizeEngineRefs(updated.rulesetRefs);
        const normalizedAiCriteriaRefs = normalizeEngineRefs(updated.aiCriteriaRefs);
        const inlineConfigPresent = hasInlineConfig(updated);

        if (!inlineConfigPresent && normalizedRulesetRefs.length === 0 && normalizedAiCriteriaRefs.length === 0) {
          return res.status(400).json({
            error: 'A review program must define either engine refs (aiCriteriaRefs / rulesetRefs) or inline rules.',
          });
        }

        if (inlineConfigPresent && (!updated.thresholds || !updated.decisionRules)) {
          return res.status(400).json({
            error: 'Inline-rule programs must include both thresholds and decisionRules.',
          });
        }

        const normalizedUpdatedBase = {
          ...updated,
          ...(normalizedRulesetRefs.length > 0 ? { rulesetRefs: normalizedRulesetRefs } : {}),
          ...(normalizedAiCriteriaRefs.length > 0 ? { aiCriteriaRefs: normalizedAiCriteriaRefs } : {}),
        };
        const normalizedUpdated = { ...normalizedUpdatedBase } as Partial<ReviewProgram> & Pick<ReviewProgram, 'id' | 'name' | 'version' | 'programType' | 'status' | 'clientId' | 'createdAt'>;
        if (normalizedRulesetRefs.length === 0) {
          delete normalizedUpdated.rulesetRefs;
        }
        if (normalizedAiCriteriaRefs.length === 0) {
          delete normalizedUpdated.aiCriteriaRefs;
        }

        const partitionKey = existing.clientId ?? GLOBAL_CLIENT_ID;
        await container.item(id, partitionKey).replace({ ...normalizedUpdated, clientId: partitionKey });

        return res.json({ ...normalizedUpdated, clientId: existing.clientId });
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

  // ── POST /:id/submit ──────────────────────────────────────────────────────────
  /**
   * Legacy snapshot-first submission is retired.
   * Clients must call `POST /prepare` followed by prepared-context dispatch.
   */
  router.post(
    '/:id/submit',
    param('id').isString().notEmpty().withMessage('id is required'),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      logger.warn('Legacy review-program submit route invoked after retirement', {
        reviewProgramId: req.params['id'],
        tenantId: req.user?.tenantId,
      });

      return res.status(410).json({
        success: false,
        error: 'Legacy snapshot-based review program submission has been retired. Use POST /api/review-programs/prepare and then POST /api/review-programs/dispatch (or POST /api/review-programs/prepared/:preparedContextId/dispatch).',
      });
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
