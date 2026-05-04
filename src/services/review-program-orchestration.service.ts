/**
 * ReviewProgramOrchestrationService
 *
 * Given a ReviewProgram ID and a canonical snapshot, fans out criteria runs to
 * every declared engine:
 *   - aiCriteriaRefs  → Axiom (AXIOM engine)
 *   - rulesetRefs     → MOP/Prio (MOP_PRIO engine)
 *
 * Design goals:
 *   1. Resilient — if one engine is absent, unavailable, or its env var is
 *      missing, the OTHER engine's legs still complete successfully.
 *   2. No silent defaults — each leg failure is recorded with a clear reason.
 *   3. No infrastructure creation — reads existing programs + snapshots only.
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { AnalysisSubmissionService } from './analysis-submission.service.js';
import { CanonicalSnapshotService } from './canonical-snapshot.service.js';
import type { ReviewProgram } from '../types/review-tape.types.js';
import { selectPreferredReviewProgram } from '../utils/review-program-normalization.js';
import type {
  OrchestrationRunLeg,
  ReviewProgramOrchestrationOverallStatus,
  ReviewProgramOrchestrationRequest,
  ReviewProgramOrchestrationResult,
} from '../types/review-program-orchestration.types.js';
import type { AnalysisSubmissionActorContext } from '../types/analysis-submission.types.js';
import type { PreparedEngineDispatch } from '../types/review-preparation.types.js';

export class ReviewProgramOrchestrationService {
  private readonly logger = new Logger('ReviewProgramOrchestrationService');
  private readonly submissionService: AnalysisSubmissionService;
  private readonly snapshotService: CanonicalSnapshotService;

  constructor(private readonly dbService: CosmosDbService) {
    this.submissionService = new AnalysisSubmissionService(dbService);
    this.snapshotService = new CanonicalSnapshotService(dbService);
  }

  // ─── public API ─────────────────────────────────────────────────────────────

  async orchestrate(
    reviewProgramId: string,
    request: ReviewProgramOrchestrationRequest,
    actor: AnalysisSubmissionActorContext,
  ): Promise<ReviewProgramOrchestrationResult> {
    if (!reviewProgramId || reviewProgramId.trim().length === 0) {
      throw new Error('reviewProgramId is required');
    }

    // 1. Resolve the program
    const program = await this.fetchProgram(reviewProgramId);
    if (!program) {
      throw new Error(`Review program '${reviewProgramId}' not found`);
    }

    // 2. Validate the snapshot when one is supplied.
    if (request.snapshotId) {
      const snapshot = await this.snapshotService.getSnapshotById(request.snapshotId, actor.tenantId);
      if (!snapshot) {
        throw new Error(`Snapshot '${request.snapshotId}' not found for tenant '${actor.tenantId}'`);
      }
    }

    const runMode = request.runMode ?? 'FULL';
    const axiomLegs: OrchestrationRunLeg[] = [];
    const mopLegs: OrchestrationRunLeg[] = [];

    // 3. Fan out: Axiom legs (aiCriteriaRefs)
    const aiRefs = program.aiCriteriaRefs ?? [];
    if (aiRefs.length === 0) {
      this.logger.info('ReviewProgram has no aiCriteriaRefs — skipping Axiom legs', {
        reviewProgramId,
      });
    }
    for (const ref of aiRefs) {
      const preparedDispatch = request.preparedEngineDispatches?.find(
        (dispatch) => dispatch.engine === 'AXIOM'
          && dispatch.engineProgramId === ref.programId
          && dispatch.engineProgramVersion === ref.programVersion,
      );
      axiomLegs.push(await this.dispatchAxiomLeg(ref, request, runMode, actor, preparedDispatch));
    }

    // 4. Fan out: MOP/Prio legs (rulesetRefs)
    const rulesetRefs = program.rulesetRefs ?? [];
    if (rulesetRefs.length === 0) {
      this.logger.info('ReviewProgram has no rulesetRefs — skipping MOP/Prio legs', {
        reviewProgramId,
      });
    }
    for (const ref of rulesetRefs) {
      const preparedDispatch = request.preparedEngineDispatches?.find(
        (dispatch) => dispatch.engine === 'MOP_PRIO'
          && dispatch.engineProgramId === ref.programId
          && dispatch.engineProgramVersion === ref.programVersion,
      );
      mopLegs.push(await this.dispatchMopLeg(ref, request, runMode, actor, preparedDispatch));
    }

    // 5. Compute overall status
    const totalLegs = axiomLegs.length + mopLegs.length;
    const allLegs = [...axiomLegs, ...mopLegs];
    const submittedCount = allLegs.filter((l) => l.status === 'submitted').length;

    let overallStatus: ReviewProgramOrchestrationOverallStatus;
    let skippedReason: string | undefined;

    if (totalLegs === 0) {
      overallStatus = 'none_submitted';
      skippedReason =
        'ReviewProgram has no aiCriteriaRefs and no rulesetRefs declared — nothing to dispatch.';
    } else if (submittedCount === 0) {
      overallStatus = 'none_submitted';
    } else if (submittedCount === totalLegs) {
      overallStatus = 'all_submitted';
    } else {
      overallStatus = 'partial';
    }

    this.logger.info('ReviewProgram orchestration complete', {
      reviewProgramId,
      overallStatus,
      axiomLegsCount: axiomLegs.length,
      mopLegsCount: mopLegs.length,
      submittedCount,
    });

    return {
      reviewProgramId,
      reviewProgramName: program.name,
      overallStatus,
      axiomLegs,
      mopLegs,
      ...(skippedReason ? { skippedReason } : {}),
    };
  }

  // ─── private helpers ─────────────────────────────────────────────────────────

  private async fetchProgram(programId: string): Promise<ReviewProgram | null> {
    const container = this.dbService.getReviewProgramsContainer();
    const { resources } = await container.items
      .query<ReviewProgram>({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: programId }],
      })
      .fetchAll();
    return selectPreferredReviewProgram(resources);
  }

  private async dispatchAxiomLeg(
    ref: { programId: string; programVersion: string },
    request: ReviewProgramOrchestrationRequest,
    runMode: 'FULL' | 'STEP_ONLY',
    actor: AnalysisSubmissionActorContext,
    preparedDispatch?: PreparedEngineDispatch,
  ): Promise<OrchestrationRunLeg> {
    const leg: OrchestrationRunLeg = {
      engine: 'AXIOM',
      programId: ref.programId,
      programVersion: ref.programVersion,
      status: 'failed',
    };

    if (preparedDispatch && !preparedDispatch.canDispatch) {
      leg.status = 'skipped';
      leg.error = preparedDispatch.blockedReasons[0] ?? 'Prepared context blocked this Axiom leg.';
      return leg;
    }

    try {
      const result = await this.submissionService.submit(
        {
          analysisType: 'CRITERIA',
          ...(request.snapshotId ? { snapshotId: request.snapshotId } : {}),
          programKey: {
            clientId: request.clientId,
            subClientId: request.subClientId,
            programId: ref.programId,
            version: ref.programVersion,
          },
          runMode,
          engineTarget: 'AXIOM',
          ...(request.rerunReason ? { rerunReason: request.rerunReason } : {}),
          ...(request.engagementId ? { engagementId: request.engagementId } : {}),
          ...(request.loanPropertyContextId
            ? { loanPropertyContextId: request.loanPropertyContextId }
            : {}),
          ...(request.preparedContextId ? { preparedContextId: request.preparedContextId } : {}),
          ...(request.preparedContextVersion ? { preparedContextVersion: request.preparedContextVersion } : {}),
          ...(request.preparedDispatchId ? { preparedDispatchId: request.preparedDispatchId } : {}),
          ...(preparedDispatch?.payloadRef ? { preparedPayloadRef: preparedDispatch.payloadRef } : {}),
          ...(preparedDispatch?.payloadContractType ? { preparedPayloadContractType: preparedDispatch.payloadContractType } : {}),
          ...(preparedDispatch?.payloadContractVersion ? { preparedPayloadContractVersion: preparedDispatch.payloadContractVersion } : {}),
        },
        {
          ...actor,
          // ensure each leg has a unique idempotency key
          idempotencyKey: `${actor.idempotencyKey}:axiom:${ref.programId}:${ref.programVersion}`,
          correlationId: `${actor.correlationId}:axiom:${ref.programId}`,
        },
      );

      leg.status = 'submitted';
      leg.runId = result.submissionId;

      this.logger.info('Axiom criteria leg submitted', {
        programId: ref.programId,
        programVersion: ref.programVersion,
        runId: result.submissionId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      leg.status = 'failed';
      leg.error = message;
      this.logger.warn('Axiom criteria leg failed — continuing orchestration', {
        programId: ref.programId,
        programVersion: ref.programVersion,
        error: message,
      });
    }

    return leg;
  }

  private async dispatchMopLeg(
    ref: { programId: string; programVersion: string },
    request: ReviewProgramOrchestrationRequest,
    runMode: 'FULL' | 'STEP_ONLY',
    actor: AnalysisSubmissionActorContext,
    preparedDispatch?: PreparedEngineDispatch,
  ): Promise<OrchestrationRunLeg> {
    const leg: OrchestrationRunLeg = {
      engine: 'MOP_PRIO',
      programId: ref.programId,
      programVersion: ref.programVersion,
      status: 'failed',
    };

    if (preparedDispatch && !preparedDispatch.canDispatch) {
      leg.status = 'skipped';
      leg.error = preparedDispatch.blockedReasons[0] ?? 'Prepared context blocked this MOP/Prio leg.';
      return leg;
    }

    // Detect whether MOP/Prio is configured. In non-production we tolerate a
    // missing engine URL (mark the leg 'skipped') so dev / test environments
    // can run Axiom legs without standing up MOP/Prio. In production a missing
    // URL is a deployment defect — failing the leg loudly surfaces the broken
    // deploy in run-ledger and overall status instead of masking it as a
    // partial success.
    if (!process.env.MOP_PRIO_API_BASE_URL) {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        leg.status = 'failed';
        leg.error =
          'MOP_PRIO_API_BASE_URL is not configured in production — refusing to skip MOP/Prio leg silently. Fix the deployment configuration.';
        this.logger.error('MOP/Prio leg failed in production — engine not configured', {
          programId: ref.programId,
          programVersion: ref.programVersion,
        });
        return leg;
      }
      leg.status = 'skipped';
      leg.error =
        'MOP_PRIO_API_BASE_URL is not configured — MOP/Prio engine is not available in this environment.';
      this.logger.warn('MOP/Prio leg skipped — engine not configured', {
        programId: ref.programId,
        programVersion: ref.programVersion,
      });
      return leg;
    }

    try {
      const result = await this.submissionService.submit(
        {
          analysisType: 'CRITERIA',
          programKey: {
            clientId: request.clientId,
            subClientId: request.subClientId,
            programId: ref.programId,
            version: ref.programVersion,
          },
          runMode,
          engineTarget: 'MOP_PRIO',
          ...(request.snapshotId ? { snapshotId: request.snapshotId } : {}),
          ...(request.rerunReason ? { rerunReason: request.rerunReason } : {}),
          ...(request.engagementId ? { engagementId: request.engagementId } : {}),
          ...(request.loanPropertyContextId
            ? { loanPropertyContextId: request.loanPropertyContextId }
            : {}),
          ...(request.preparedContextId ? { preparedContextId: request.preparedContextId } : {}),
          ...(request.preparedContextVersion ? { preparedContextVersion: request.preparedContextVersion } : {}),
          ...(request.preparedDispatchId ? { preparedDispatchId: request.preparedDispatchId } : {}),
          ...(preparedDispatch?.payloadRef ? { preparedPayloadRef: preparedDispatch.payloadRef } : {}),
          ...(preparedDispatch?.payloadContractType ? { preparedPayloadContractType: preparedDispatch.payloadContractType } : {}),
          ...(preparedDispatch?.payloadContractVersion ? { preparedPayloadContractVersion: preparedDispatch.payloadContractVersion } : {}),
        },
        {
          ...actor,
          idempotencyKey: `${actor.idempotencyKey}:mop:${ref.programId}:${ref.programVersion}`,
          correlationId: `${actor.correlationId}:mop:${ref.programId}`,
        },
      );

      leg.status = 'submitted';
      leg.runId = result.submissionId;

      this.logger.info('MOP/Prio criteria leg submitted', {
        programId: ref.programId,
        programVersion: ref.programVersion,
        runId: result.submissionId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      leg.status = 'failed';
      leg.error = message;
      this.logger.warn('MOP/Prio criteria leg failed — continuing orchestration', {
        programId: ref.programId,
        programVersion: ref.programVersion,
        error: message,
      });
    }

    return leg;
  }
}
