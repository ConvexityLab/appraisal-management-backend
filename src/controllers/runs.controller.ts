import express, { Response } from 'express';
import { body, header, param, query, validationResult } from 'express-validator';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { RunLedgerService } from '../services/run-ledger.service.js';
import { CanonicalSnapshotService } from '../services/canonical-snapshot.service.js';
import { EngineDispatchService } from '../services/engine-dispatch.service.js';
import { CriteriaStepInputService } from '../services/criteria-step-input.service.js';
import { AxiomService } from '../services/axiom.service.js';

const router = express.Router();
let service: RunLedgerService | null = null;
let snapshotService: CanonicalSnapshotService | null = null;
let dispatchService: EngineDispatchService | null = null;
let stepInputService: CriteriaStepInputService | null = null;

function getService(dbService: CosmosDbService): RunLedgerService {
  if (!service) {
    service = new RunLedgerService(dbService);
  }
  return service;
}

function getSnapshotService(dbService: CosmosDbService): CanonicalSnapshotService {
  if (!snapshotService) {
    snapshotService = new CanonicalSnapshotService(dbService);
  }
  return snapshotService;
}

function getDispatchService(dbService: CosmosDbService): EngineDispatchService {
  if (!dispatchService) {
    dispatchService = new EngineDispatchService(new AxiomService(dbService));
  }
  return dispatchService;
}

function getStepInputService(dbService: CosmosDbService): CriteriaStepInputService {
  if (!stepInputService) {
    stepInputService = new CriteriaStepInputService(dbService);
  }
  return stepInputService;
}

function resolveTenantId(req: UnifiedAuthRequest): string {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID is required but missing from authenticated user context');
  }
  return tenantId;
}

function resolveInitiatedBy(req: UnifiedAuthRequest): string {
  return req.user?.id ?? req.user?.azureAdObjectId ?? 'unknown-user';
}

const baseHeaders = [
  header('Idempotency-Key').isString().notEmpty().withMessage('Idempotency-Key header is required'),
  header('X-Correlation-Id').isString().notEmpty().withMessage('X-Correlation-Id header is required'),
];

const extractionValidators = [
  ...baseHeaders,
  body('documentId').isString().notEmpty().withMessage('documentId is required'),
  body('runReason').isString().notEmpty().withMessage('runReason is required'),
  body('schemaKey').isObject().withMessage('schemaKey is required'),
  body('schemaKey.clientId').isString().notEmpty().withMessage('schemaKey.clientId is required'),
  body('schemaKey.subClientId').isString().notEmpty().withMessage('schemaKey.subClientId is required'),
  body('schemaKey.documentType').isString().notEmpty().withMessage('schemaKey.documentType is required'),
  body('schemaKey.version').isString().notEmpty().withMessage('schemaKey.version is required'),
  body('engineTarget').optional().isIn(['AXIOM', 'MOP_PRIO']).withMessage('engineTarget must be AXIOM or MOP_PRIO'),
  body('enginePolicyRef').optional().isString().notEmpty(),
  body('engagementId').optional().isString().notEmpty(),
  body('loanPropertyContextId').optional().isString().notEmpty(),
];

const criteriaValidators = [
  ...baseHeaders,
  body('snapshotId').isString().notEmpty().withMessage('snapshotId is required'),
  body('programKey').isObject().withMessage('programKey is required'),
  body('programKey.clientId').isString().notEmpty().withMessage('programKey.clientId is required'),
  body('programKey.subClientId').isString().notEmpty().withMessage('programKey.subClientId is required'),
  body('programKey.programId').isString().notEmpty().withMessage('programKey.programId is required'),
  body('programKey.version').isString().notEmpty().withMessage('programKey.version is required'),
  body('runMode').isIn(['FULL', 'STEP_ONLY']).withMessage('runMode must be FULL or STEP_ONLY'),
  body('engineTarget').optional().isIn(['AXIOM', 'MOP_PRIO']).withMessage('engineTarget must be AXIOM or MOP_PRIO'),
  body('enginePolicyRef').optional().isString().notEmpty(),
  body('rerunReason').optional().isString().notEmpty(),
  body('parentRunId').optional().isString().notEmpty(),
  body('criteriaStepKeys').optional().isArray().withMessage('criteriaStepKeys must be an array of step keys'),
  body('criteriaStepKeys.*').optional().isString().notEmpty().withMessage('criteriaStepKeys entries must be non-empty strings'),
  body('engagementId').optional().isString().notEmpty(),
  body('loanPropertyContextId').optional().isString().notEmpty(),
];

const criteriaStepValidators = [
  ...baseHeaders,
  param('criteriaRunId').isString().notEmpty().withMessage('criteriaRunId is required'),
  param('stepKey').isString().notEmpty().withMessage('stepKey is required'),
  body('rerunReason').isString().notEmpty().withMessage('rerunReason is required'),
  body('engineTarget').optional().isIn(['AXIOM', 'MOP_PRIO']).withMessage('engineTarget must be AXIOM or MOP_PRIO'),
  body('enginePolicyRef').optional().isString().notEmpty(),
];

const listRunsValidators = [
  query('runType').optional().isIn(['extraction', 'criteria', 'criteria-step']),
  query('status').optional().isIn(['queued', 'running', 'completed', 'failed', 'cancelled']),
  query('engagementId').optional().isString().notEmpty(),
  query('loanPropertyContextId').optional().isString().notEmpty(),
  query('documentId').optional().isString().notEmpty(),
  query('parentRunId').optional().isString().notEmpty(),
  query('criteriaRunId').optional().isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
];

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

function readStatusDetailString(
  statusDetails: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!statusDetails || !(key in statusDetails)) {
    return undefined;
  }
  const value = statusDetails[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function createRunsRouter(dbService: CosmosDbService): express.Router {
  router.get('/', listRunsValidators, async (req: UnifiedAuthRequest, res: Response) => {
    if (validationErrorResponse(req, res)) return;

    try {
      const tenantId = resolveTenantId(req);
      const listFilters = {
        ...(typeof req.query.runType === 'string'
          ? { runType: req.query.runType as 'extraction' | 'criteria' | 'criteria-step' }
          : {}),
        ...(typeof req.query.status === 'string'
          ? { status: req.query.status as 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' }
          : {}),
        ...(typeof req.query.engagementId === 'string' ? { engagementId: req.query.engagementId } : {}),
        ...(typeof req.query.loanPropertyContextId === 'string'
          ? { loanPropertyContextId: req.query.loanPropertyContextId }
          : {}),
        ...(typeof req.query.documentId === 'string' ? { documentId: req.query.documentId } : {}),
        ...(typeof req.query.parentRunId === 'string' ? { parentRunId: req.query.parentRunId } : {}),
        ...(typeof req.query.criteriaRunId === 'string' ? { criteriaRunId: req.query.criteriaRunId } : {}),
        ...(typeof req.query.limit === 'string' ? { limit: Number(req.query.limit) } : {}),
      };
      const runs = await getService(dbService).listRuns(tenantId, listFilters);

      res.status(200).json({ success: true, data: runs });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'RUN_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Failed to list runs',
        },
      });
    }
  });

  router.post('/extraction', extractionValidators, async (req: UnifiedAuthRequest, res: Response) => {
    if (validationErrorResponse(req, res)) return;

    try {
      const tenantId = resolveTenantId(req);
      const runService = getService(dbService);
      const run = await runService.createExtractionRun({
        tenantId,
        initiatedBy: resolveInitiatedBy(req),
        correlationId: String(req.header('X-Correlation-Id')),
        idempotencyKey: String(req.header('Idempotency-Key')),
        documentId: req.body.documentId,
        schemaKey: req.body.schemaKey,
        runReason: req.body.runReason,
        engineTarget: req.body.engineTarget,
        enginePolicyRef: req.body.enginePolicyRef,
        engagementId: req.body.engagementId,
        loanPropertyContextId: req.body.loanPropertyContextId,
      });

      const dispatchResult = await getDispatchService(dbService).dispatchExtraction(run);
      const runningRun = await runService.setRunStatus(run.id, tenantId, dispatchResult.status, {
        engineRunRef: dispatchResult.engineRunRef,
        engineVersion: dispatchResult.engineVersion,
        engineRequestRef: dispatchResult.engineRequestRef,
        engineResponseRef: dispatchResult.engineResponseRef,
        ...(dispatchResult.statusDetails ? { statusDetails: dispatchResult.statusDetails } : {}),
      });

      const snapshot = await getSnapshotService(dbService).createFromExtractionRun(runningRun);
      const linkedRun = await runService.updateRun(run.id, tenantId, {
        canonicalSnapshotId: snapshot.id,
      });

      res.status(202).json({ success: true, data: linkedRun });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'RUN_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create extraction run',
        },
      });
    }
  });

  router.post('/criteria', criteriaValidators, async (req: UnifiedAuthRequest, res: Response) => {
    if (validationErrorResponse(req, res)) return;

    try {
      const tenantId = resolveTenantId(req);
      const runService = getService(dbService);
      const snapshot = await getSnapshotService(dbService).getSnapshotById(req.body.snapshotId, tenantId);
      if (!snapshot) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SNAPSHOT_NOT_FOUND',
            message: `Snapshot '${req.body.snapshotId}' was not found for tenant '${tenantId}'`,
          },
        });
        return;
      }

      const run = await runService.createCriteriaRun({
        tenantId,
        initiatedBy: resolveInitiatedBy(req),
        correlationId: String(req.header('X-Correlation-Id')),
        idempotencyKey: String(req.header('Idempotency-Key')),
        snapshotId: req.body.snapshotId,
        programKey: req.body.programKey,
        runMode: req.body.runMode,
        engineTarget: req.body.engineTarget,
        enginePolicyRef: req.body.enginePolicyRef,
        rerunReason: req.body.rerunReason,
        parentRunId: req.body.parentRunId,
        engagementId: req.body.engagementId,
        loanPropertyContextId: req.body.loanPropertyContextId,
      });

      const dispatchResult = await getDispatchService(dbService).dispatchCriteria(run);
      const criteriaStepKeys: string[] =
        Array.isArray(req.body.criteriaStepKeys) && req.body.criteriaStepKeys.length > 0
          ? req.body.criteriaStepKeys
          : (process.env.RUN_DEFAULT_CRITERIA_STEPS
              ? process.env.RUN_DEFAULT_CRITERIA_STEPS.split(',').map((value) => value.trim()).filter(Boolean)
              : ['overall-criteria']);

      const updatedCriteriaRun = await runService.setRunStatus(run.id, tenantId, dispatchResult.status, {
        engineRunRef: dispatchResult.engineRunRef,
        engineVersion: dispatchResult.engineVersion,
        engineRequestRef: dispatchResult.engineRequestRef,
        engineResponseRef: dispatchResult.engineResponseRef,
        canonicalSnapshotId: snapshot.id,
        criteriaStepKeys,
        ...(dispatchResult.statusDetails ? { statusDetails: dispatchResult.statusDetails } : {}),
      });

      const stepRuns = [];
      for (const stepKey of criteriaStepKeys) {
        const stepRun = await runService.createCriteriaStepRun({
          tenantId,
          initiatedBy: resolveInitiatedBy(req),
          correlationId: `${String(req.header('X-Correlation-Id'))}:${stepKey}`,
          idempotencyKey: `${String(req.header('Idempotency-Key'))}:${stepKey}`,
          parentCriteriaRunId: updatedCriteriaRun.id,
          stepKey,
          engineTarget: req.body.engineTarget,
          enginePolicyRef: req.body.enginePolicyRef,
        });

        const stepInputSlice = await getStepInputService(dbService).createStepInputSlice({
          tenantId,
          initiatedBy: resolveInitiatedBy(req),
          criteriaRun: updatedCriteriaRun,
          stepRun,
          snapshot,
        });

        const stepDispatchResult = await getDispatchService(dbService).dispatchCriteriaStep(stepRun, {
          inputSliceRef: stepInputSlice.payloadRef,
          inputSlice: stepInputSlice.payload,
          evidenceRefs: stepInputSlice.evidenceRefs,
        });
        const hydratedStepRun = await runService.setRunStatus(stepRun.id, tenantId, stepDispatchResult.status, {
          engineRunRef: stepDispatchResult.engineRunRef,
          engineVersion: stepDispatchResult.engineVersion,
          engineRequestRef: stepDispatchResult.engineRequestRef,
          engineResponseRef: stepDispatchResult.engineResponseRef,
          statusDetails: {
            ...(stepDispatchResult.statusDetails ?? {}),
            stepInputSliceId: stepInputSlice.id,
            stepInputPayloadRef: stepInputSlice.payloadRef,
            stepEvidenceRefs: stepInputSlice.evidenceRefs,
          },
        });
        stepRuns.push(hydratedStepRun);
      }

      const finalCriteriaRun = await runService.updateRun(updatedCriteriaRun.id, tenantId, {
        criteriaStepRunIds: stepRuns.map((item) => item.id),
      });

      res.status(202).json({ success: true, data: { run: finalCriteriaRun, stepRuns } });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'RUN_CREATE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create criteria run',
        },
      });
    }
  });

  router.post(
    '/criteria/:criteriaRunId/steps/:stepKey/rerun',
    criteriaStepValidators,
    async (req: UnifiedAuthRequest, res: Response) => {
      if (validationErrorResponse(req, res)) return;

      try {
        const tenantId = resolveTenantId(req);
        const runService = getService(dbService);
        const stepRun = await runService.rerunCriteriaStep({
          tenantId,
          initiatedBy: resolveInitiatedBy(req),
          correlationId: String(req.header('X-Correlation-Id')),
          idempotencyKey: String(req.header('Idempotency-Key')),
          criteriaRunId: String(req.params.criteriaRunId),
          stepKey: String(req.params.stepKey),
          rerunReason: req.body.rerunReason,
          engineTarget: req.body.engineTarget,
          enginePolicyRef: req.body.enginePolicyRef,
        });

        const criteriaRun = await runService.getRunById(String(req.params.criteriaRunId), tenantId);
        if (!criteriaRun) {
          throw new Error(`Criteria run '${req.params.criteriaRunId}' was not found`);
        }
        const snapshotId = criteriaRun.canonicalSnapshotId ?? criteriaRun.snapshotId;
        if (!snapshotId) {
          throw new Error(`Criteria run '${req.params.criteriaRunId}' is missing snapshot linkage`);
        }
        const snapshot = await getSnapshotService(dbService).getSnapshotById(snapshotId, tenantId);
        if (!snapshot) {
          throw new Error(`Snapshot '${snapshotId}' was not found for tenant '${tenantId}'`);
        }

        const stepInputSlice = await getStepInputService(dbService).createStepInputSlice({
          tenantId,
          initiatedBy: resolveInitiatedBy(req),
          criteriaRun,
          stepRun,
          snapshot,
        });

        const stepDispatchResult = await getDispatchService(dbService).dispatchCriteriaStep(stepRun, {
          inputSliceRef: stepInputSlice.payloadRef,
          inputSlice: stepInputSlice.payload,
          evidenceRefs: stepInputSlice.evidenceRefs,
        });
        const hydratedStepRun = await runService.setRunStatus(stepRun.id, tenantId, stepDispatchResult.status, {
          engineRunRef: stepDispatchResult.engineRunRef,
          engineVersion: stepDispatchResult.engineVersion,
          engineRequestRef: stepDispatchResult.engineRequestRef,
          engineResponseRef: stepDispatchResult.engineResponseRef,
          statusDetails: {
            ...(stepDispatchResult.statusDetails ?? {}),
            stepInputSliceId: stepInputSlice.id,
            stepInputPayloadRef: stepInputSlice.payloadRef,
            stepEvidenceRefs: stepInputSlice.evidenceRefs,
          },
        });

        res.status(202).json({ success: true, data: hydratedStepRun });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to rerun criteria step';
        const statusCode = message.includes('was not found') ? 404 : 500;
        res.status(statusCode).json({
          success: false,
          error: {
            code: statusCode === 404 ? 'RUN_NOT_FOUND' : 'RUN_CREATE_FAILED',
            message,
          },
        });
      }
    },
  );

  router.get('/:runId', param('runId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    if (validationErrorResponse(req, res)) return;

    try {
      const tenantId = resolveTenantId(req);
      const run = await getService(dbService).getRunById(String(req.params.runId), tenantId);

      if (!run) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RUN_NOT_FOUND',
            message: `Run '${req.params.runId}' was not found`,
          },
        });
        return;
      }

      res.status(200).json({ success: true, data: run });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'RUN_READ_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve run',
        },
      });
    }
  });

  router.get('/:runId/snapshot', param('runId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    if (validationErrorResponse(req, res)) return;

    try {
      const tenantId = resolveTenantId(req);
      const run = await getService(dbService).getRunById(String(req.params.runId), tenantId);

      if (!run) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RUN_NOT_FOUND',
            message: `Run '${req.params.runId}' was not found`,
          },
        });
        return;
      }

      const snapshotId = run.canonicalSnapshotId ?? run.snapshotId;
      if (!snapshotId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SNAPSHOT_NOT_LINKED',
            message: `Run '${req.params.runId}' has no linked snapshot`,
          },
        });
        return;
      }

      const snapshot = await getSnapshotService(dbService).getSnapshotById(snapshotId, tenantId);
      if (!snapshot) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SNAPSHOT_NOT_FOUND',
            message: `Snapshot '${snapshotId}' was not found`,
          },
        });
        return;
      }

      res.status(200).json({ success: true, data: snapshot });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'RUN_READ_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve run snapshot',
        },
      });
    }
  });

  router.get('/:runId/step-input', param('runId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    if (validationErrorResponse(req, res)) return;

    try {
      const tenantId = resolveTenantId(req);
      const run = await getService(dbService).getRunById(String(req.params.runId), tenantId);

      if (!run) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RUN_NOT_FOUND',
            message: `Run '${req.params.runId}' was not found`,
          },
        });
        return;
      }

      if (run.runType !== 'criteria-step') {
        res.status(400).json({
          success: false,
          error: {
            code: 'RUN_TYPE_INVALID',
            message: `Run '${req.params.runId}' is type '${run.runType}' and has no step input slice`,
          },
        });
        return;
      }

      const stepInputSliceId = readStatusDetailString(run.statusDetails, 'stepInputSliceId');
      const stepInputSlice = stepInputSliceId
        ? await getStepInputService(dbService).getStepInputSliceById(stepInputSliceId, tenantId)
        : await getStepInputService(dbService).getLatestStepInputSliceForRun(run.id, tenantId);

      if (!stepInputSlice) {
        res.status(404).json({
          success: false,
          error: {
            code: 'STEP_INPUT_NOT_FOUND',
            message: `No step input slice found for run '${req.params.runId}'`,
          },
        });
        return;
      }

      res.status(200).json({ success: true, data: stepInputSlice });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'RUN_READ_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve run step input',
        },
      });
    }
  });

  router.post('/:runId/refresh-status', param('runId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    if (validationErrorResponse(req, res)) return;

    try {
      const tenantId = resolveTenantId(req);
      const runService = getService(dbService);
      const run = await runService.getRunById(String(req.params.runId), tenantId);

      if (!run) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RUN_NOT_FOUND',
            message: `Run '${req.params.runId}' was not found`,
          },
        });
        return;
      }

      const refreshed = await getDispatchService(dbService).refreshStatus(run);
      const hydratedRun = await runService.setRunStatus(run.id, tenantId, refreshed.status, {
        engineRunRef: refreshed.engineRunRef,
        engineVersion: refreshed.engineVersion,
        engineRequestRef: refreshed.engineRequestRef,
        engineResponseRef: refreshed.engineResponseRef,
        ...(refreshed.statusDetails ? { statusDetails: refreshed.statusDetails } : {}),
      });

      res.status(200).json({ success: true, data: hydratedRun });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'RUN_REFRESH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to refresh run status',
        },
      });
    }
  });

  return router;
}
