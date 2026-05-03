import { randomUUID } from 'crypto';
import { CosmosDbService } from './cosmos-db.service.js';
import { ReviewPreparedContextService } from './review-prepared-context.service.js';
import { ReviewProgramOrchestrationService } from './review-program-orchestration.service.js';
import type { AnalysisSubmissionActorContext } from '../types/analysis-submission.types.js';
import type {
  DispatchPreparedReviewProgramsRequest,
  DispatchPreparedReviewProgramsResponse,
} from '../types/review-preparation.types.js';

interface ReviewDispatchServiceDependencies {
  preparedContextService?: Pick<ReviewPreparedContextService, 'getPreparedContext'>;
  orchestrationService?: Pick<ReviewProgramOrchestrationService, 'orchestrate'>;
}

export class ReviewDispatchService {
  private readonly preparedContextService: Pick<ReviewPreparedContextService, 'getPreparedContext'>;
  private readonly orchestrationService: Pick<ReviewProgramOrchestrationService, 'orchestrate'>;

  constructor(
    dbService: CosmosDbService,
    dependencies: ReviewDispatchServiceDependencies = {},
  ) {
    this.preparedContextService = dependencies.preparedContextService ?? new ReviewPreparedContextService(dbService);
    this.orchestrationService = dependencies.orchestrationService ?? new ReviewProgramOrchestrationService(dbService);
  }

  async dispatch(
    request: DispatchPreparedReviewProgramsRequest,
    actor: AnalysisSubmissionActorContext,
  ): Promise<DispatchPreparedReviewProgramsResponse> {
    const preparedContext = await this.preparedContextService.getPreparedContext(request.preparedContextId, actor.tenantId);
    const dispatchMode = request.dispatchMode ?? 'all_ready_only';
    const dispatchId = randomUUID();
    const submittedPrograms: DispatchPreparedReviewProgramsResponse['submittedPrograms'] = [];
    const skippedPrograms: DispatchPreparedReviewProgramsResponse['skippedPrograms'] = [];
    const warnings: string[] = [];

    const requestedProgramIds = new Set(request.reviewProgramIds);
    const selectedPrograms = preparedContext.programs.filter((program) => requestedProgramIds.has(program.reviewProgramId));

    if (selectedPrograms.length !== requestedProgramIds.size) {
      const resolvedIds = new Set(selectedPrograms.map((program) => program.reviewProgramId));
      const missingIds = [...requestedProgramIds].filter((programId) => !resolvedIds.has(programId));
      throw new Error(`Prepared context does not contain requested review programs: ${missingIds.join(', ')}`);
    }

    const snapshotId = preparedContext.context.runSummary.latestSnapshotId;
    const clientId = preparedContext.context.identity.clientId;
    const subClientId = preparedContext.context.identity.subClientId;

    for (const program of selectedPrograms) {
      if (!clientId || !subClientId) {
        skippedPrograms.push({
          reviewProgramId: program.reviewProgramId,
          reason: 'Prepared context is missing client/sub-client configuration required for dispatch.',
        });
        continue;
      }

      if (program.readiness === 'ready_with_warnings' && !request.confirmWarnings) {
        skippedPrograms.push({
          reviewProgramId: program.reviewProgramId,
          reason: 'Program has warnings that require confirmWarnings=true before dispatch.',
        });
        continue;
      }

      if (!program.canDispatch) {
        const preparedEngineDispatches = preparedContext.plannedEngineDispatches.filter(
          (dispatch) => dispatch.reviewProgramId === program.reviewProgramId,
        );
        const dispatchableEngineDispatches = preparedEngineDispatches.filter((dispatch) => dispatch.canDispatch);
        if (dispatchMode !== 'include_partial' || dispatchableEngineDispatches.length === 0) {
          skippedPrograms.push({
            reviewProgramId: program.reviewProgramId,
            reason: program.blockers[0] ?? 'Program is not dispatchable from the prepared context.',
          });
          continue;
        }
      }

      const preparedEngineDispatches = preparedContext.plannedEngineDispatches.filter(
        (dispatch) => dispatch.reviewProgramId === program.reviewProgramId,
      );
      const dispatchableEngineDispatches = preparedEngineDispatches.filter((dispatch) => dispatch.canDispatch);
      if (dispatchMode === 'all_ready_only' && preparedEngineDispatches.some((dispatch) => !dispatch.canDispatch)) {
        skippedPrograms.push({
          reviewProgramId: program.reviewProgramId,
          reason: 'One or more engine legs are blocked in the prepared dispatch plan.',
        });
        continue;
      }
      if (dispatchableEngineDispatches.length === 0) {
        skippedPrograms.push({
          reviewProgramId: program.reviewProgramId,
          reason: program.blockers[0] ?? 'Program has no dispatchable engine legs in the prepared dispatch plan.',
        });
        continue;
      }

      const orchestrationResult = await this.orchestrationService.orchestrate(
        program.reviewProgramId,
        {
          clientId,
          subClientId,
          loanPropertyContextId: preparedContext.orderId,
          ...(snapshotId ? { snapshotId } : {}),
          ...(preparedContext.engagementId ? { engagementId: preparedContext.engagementId } : {}),
          preparedContextId: preparedContext.preparedContextId,
          preparedContextVersion: preparedContext.preparedContextVersion,
          preparedDispatchId: dispatchId,
          preparedEngineDispatches,
        },
        actor,
      );

      submittedPrograms.push({
        reviewProgramId: orchestrationResult.reviewProgramId,
        reviewProgramName: orchestrationResult.reviewProgramName,
        reviewProgramVersion: program.reviewProgramVersion,
        overallStatus: orchestrationResult.overallStatus,
        axiomLegs: orchestrationResult.axiomLegs,
        mopLegs: orchestrationResult.mopLegs,
        ...(orchestrationResult.skippedReason ? { skippedReason: orchestrationResult.skippedReason } : {}),
      });

      if (orchestrationResult.overallStatus !== 'all_submitted') {
        warnings.push(`${program.reviewProgramName} dispatched with overall status ${orchestrationResult.overallStatus}.`);
      }
      if (dispatchMode === 'include_partial' && dispatchableEngineDispatches.length < preparedEngineDispatches.length) {
        warnings.push(`${program.reviewProgramName} dispatched only the engine legs that were ready in the prepared context.`);
      }
    }

    return {
      dispatchId,
      preparedContextId: preparedContext.preparedContextId,
      preparedContextVersion: preparedContext.preparedContextVersion,
      orderId: preparedContext.orderId,
      ...(preparedContext.engagementId ? { engagementId: preparedContext.engagementId } : {}),
      dispatchedAt: new Date().toISOString(),
      dispatchMode,
      submittedPrograms,
      skippedPrograms,
      warnings: [...new Set(warnings)],
    };
  }
}
