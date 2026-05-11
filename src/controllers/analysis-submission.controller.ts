import express, { Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { AnalysisSubmissionService } from '../services/analysis-submission.service.js';
import { AxiomService } from '../services/axiom.service.js';
import type { AnalysisSubmissionRequest, AnalysisSubmissionType } from '../types/analysis-submission.types.js';

const router = express.Router();

const SUPPORTED_ANALYSIS_TYPES: AnalysisSubmissionType[] = ['DOCUMENT_ANALYZE', 'EXTRACTION', 'CRITERIA'];
const SUPPORTED_DOCUMENT_ANALYZE_EVALUATION_MODES = ['EXTRACTION', 'CRITERIA_EVALUATION', 'COMPLETE_EVALUATION'] as const;

function createCorrelationSuffix(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${random}`;
}

function resolveTenantId(req: UnifiedAuthRequest): string {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    throw new Error('User tenant not resolved — authentication required');
  }
  return tenantId;
}

function resolveInitiatedBy(req: UnifiedAuthRequest): string {
  return req.user?.id ?? req.user?.azureAdObjectId ?? 'unknown-user';
}

function resolveHeaderOrGenerate(req: UnifiedAuthRequest, headerName: string, prefix: string): string {
  const value = req.header(headerName);
  if (value && value.trim()) {
    return value.trim();
  }
  return `${prefix}-${createCorrelationSuffix()}`;
}

function validationErrorResponse(req: express.Request, res: express.Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array(),
      },
    });
    return true;
  }
  return false;
}

function validateTypedPayload(body: Record<string, unknown>): string | null {
  const analysisType = body.analysisType;
  if (typeof analysisType !== 'string' || !SUPPORTED_ANALYSIS_TYPES.includes(analysisType as AnalysisSubmissionType)) {
    return `analysisType must be one of: ${SUPPORTED_ANALYSIS_TYPES.join(', ')}`;
  }

  if (analysisType === 'DOCUMENT_ANALYZE') {
    if (typeof body.documentId !== 'string' || body.documentId.trim().length === 0) {
      return 'documentId is required for DOCUMENT_ANALYZE';
    }
    if (typeof body.orderId !== 'string' || body.orderId.trim().length === 0) {
      return 'orderId is required for DOCUMENT_ANALYZE';
    }
    if (
      body.evaluationMode !== undefined &&
      (typeof body.evaluationMode !== 'string' || !SUPPORTED_DOCUMENT_ANALYZE_EVALUATION_MODES.includes(body.evaluationMode as typeof SUPPORTED_DOCUMENT_ANALYZE_EVALUATION_MODES[number]))
    ) {
      return `evaluationMode must be one of: ${SUPPORTED_DOCUMENT_ANALYZE_EVALUATION_MODES.join(', ')}`;
    }
    return null;
  }

  if (analysisType === 'EXTRACTION') {
    if (typeof body.documentId !== 'string' || body.documentId.trim().length === 0) {
      return 'documentId is required for EXTRACTION';
    }
    if (!body.schemaKey || typeof body.schemaKey !== 'object') {
      return 'schemaKey is required for EXTRACTION';
    }
    if (typeof body.runReason !== 'string' || body.runReason.trim().length === 0) {
      return 'runReason is required for EXTRACTION';
    }
    return null;
  }

  if (!body.snapshotId || typeof body.snapshotId !== 'string') {
    return 'snapshotId is required for CRITERIA';
  }
  if (!body.programKey || typeof body.programKey !== 'object') {
    return 'programKey is required for CRITERIA';
  }
  if (body.runMode !== 'FULL' && body.runMode !== 'STEP_ONLY') {
    return "runMode must be 'FULL' or 'STEP_ONLY' for CRITERIA";
  }
  return null;
}

export function createAnalysisSubmissionRouter(dbService: CosmosDbService, axiomService?: AxiomService): express.Router {
  const service = new AnalysisSubmissionService(dbService, axiomService);

  router.post(
    '/submissions',
    body('analysisType').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      if (validationErrorResponse(req, res)) return;

      try {
        const payload = req.body as Record<string, unknown>;
        const typedValidationError = validateTypedPayload(payload);
        if (typedValidationError) {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: typedValidationError },
          });
          return;
        }

        const submission = await service.submit(payload as unknown as AnalysisSubmissionRequest, {
          tenantId: resolveTenantId(req),
          initiatedBy: resolveInitiatedBy(req),
          correlationId: resolveHeaderOrGenerate(req, 'X-Correlation-Id', 'ui-correlation'),
          idempotencyKey: resolveHeaderOrGenerate(req, 'Idempotency-Key', 'ui-idempotency'),
        });

        res.status(202).json({ success: true, data: submission });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to submit analysis';
        const status = message.includes('not found') ? 404 : message.includes('required') ? 400 : 500;
        res.status(status).json({
          success: false,
          error: {
            code: 'ANALYSIS_SUBMIT_FAILED',
            message,
          },
        });
      }
    },
  );

  router.get(
    '/submissions/:submissionId',
    param('submissionId').isString().notEmpty(),
    query('analysisType').optional().isIn(SUPPORTED_ANALYSIS_TYPES),
    async (req: UnifiedAuthRequest, res: Response) => {
      if (validationErrorResponse(req, res)) return;

      try {
        const submissionId = String(req.params.submissionId);
        const analysisType = typeof req.query.analysisType === 'string'
          ? req.query.analysisType as AnalysisSubmissionType
          : undefined;

        const submission = await service.getSubmission(submissionId, {
          tenantId: resolveTenantId(req),
          initiatedBy: resolveInitiatedBy(req),
          correlationId: resolveHeaderOrGenerate(req, 'X-Correlation-Id', 'ui-correlation'),
          idempotencyKey: resolveHeaderOrGenerate(req, 'Idempotency-Key', 'ui-idempotency'),
        }, analysisType);

        res.status(200).json({ success: true, data: submission });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load submission';
        const status = message.includes('not found') ? 404 : message.includes('required') ? 400 : 500;
        res.status(status).json({
          success: false,
          error: {
            code: 'ANALYSIS_FETCH_FAILED',
            message,
          },
        });
      }
    },
  );

  /**
   * SSE bridge: streams status updates for a submission until it reaches a terminal state.
   * Clients receive `data: <json>\n\n` events on each poll cycle.
   * Terminal states: completed, failed, cancelled.
   * The connection auto-closes once a terminal state is reached or the client disconnects.
   */
  router.get(
    '/submissions/:submissionId/stream',
    param('submissionId').isString().notEmpty(),
    query('analysisType').optional().isIn(SUPPORTED_ANALYSIS_TYPES),
    async (req: UnifiedAuthRequest, res: Response) => {
      if (validationErrorResponse(req, res)) return;

      const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
      const POLL_INTERVAL_MS = 2_000;
      const MAX_POLL_ATTEMPTS = 150; // 5 minutes at 2s intervals

      const submissionId = String(req.params.submissionId);
      const analysisType = typeof req.query.analysisType === 'string'
        ? req.query.analysisType as AnalysisSubmissionType
        : undefined;

      const actor = {
        tenantId: resolveTenantId(req),
        initiatedBy: resolveInitiatedBy(req),
        correlationId: resolveHeaderOrGenerate(req, 'X-Correlation-Id', 'sse-correlation'),
        idempotencyKey: resolveHeaderOrGenerate(req, 'Idempotency-Key', 'sse-idempotency'),
      };

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let closed = false;
      req.on('close', () => { closed = true; });

      const sendEvent = (eventName: string, data: unknown): void => {
        if (!closed) {
          res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      };

      let attempts = 0;
      const poll = async (): Promise<void> => {
        if (closed) return;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          sendEvent('timeout', { message: 'Max polling duration reached', submissionId });
          res.end();
          return;
        }
        attempts++;

        try {
          const submission = await service.getSubmission(submissionId, actor, analysisType);
          sendEvent('status', submission);

          if (TERMINAL_STATUSES.has(submission.status)) {
            sendEvent('done', { submissionId, finalStatus: submission.status });
            res.end();
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load submission';
          const isNotFound = message.includes('not found');
          sendEvent('error', {
            code: isNotFound ? 'SUBMISSION_NOT_FOUND' : 'ANALYSIS_FETCH_FAILED',
            message,
          });
          res.end();
          return;
        }

        if (!closed) {
          setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
        }
      };

      void poll();
    },
  );

  return router;
}
