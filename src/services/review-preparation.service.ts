import { AxiomService } from './axiom.service.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { MopCriteriaService } from './mop-criteria.service.js';
import { ReviewContextAssemblyService } from './review-context-assembly.service.js';
import { ReviewRequirementResolutionService } from './review-requirement-resolution.service.js';
import { ReviewSourcePriorityService } from './review-source-priority.service.js';
import type { AnalysisSubmissionActorContext } from '../types/analysis-submission.types.js';
import type {
  CriterionResolution,
  PrepareReviewProgramsRequest,
  PrepareReviewProgramsResponse,
  ProgramReadiness,
} from '../types/review-preparation.types.js';
import type { ReviewContext, ReviewReadinessState, ReviewRecommendedAction } from '../types/review-context.types.js';
import type { ReviewProgram } from '../types/review-tape.types.js';

interface ReviewPreparationServiceDependencies {
  assemblyService?: Pick<ReviewContextAssemblyService, 'assemble'>;
  requirementResolutionService?: Pick<ReviewRequirementResolutionService, 'resolveProgramRequirements'>;
  axiomCriteriaService?: Pick<AxiomService, 'getCompiledCriteria'>;
  mopCriteriaService?: Pick<MopCriteriaService, 'getCompiledCriteria'>;
  sourcePriorityService?: Pick<ReviewSourcePriorityService, 'resolveRequirementPath'>;
}

export class ReviewPreparationService {
  private readonly assemblyService: Pick<ReviewContextAssemblyService, 'assemble'>;
  private readonly requirementResolutionService: Pick<ReviewRequirementResolutionService, 'resolveProgramRequirements'>;

  constructor(
    private readonly dbService: CosmosDbService,
    dependencies: ReviewPreparationServiceDependencies = {},
  ) {
    this.assemblyService = dependencies.assemblyService ?? new ReviewContextAssemblyService(dbService);
    const axiomCriteriaService = dependencies.axiomCriteriaService ?? new AxiomService(dbService);
    const mopCriteriaService = dependencies.mopCriteriaService ?? new MopCriteriaService(dbService);
    const sourcePriorityService = dependencies.sourcePriorityService ?? new ReviewSourcePriorityService();
    this.requirementResolutionService = dependencies.requirementResolutionService ?? new ReviewRequirementResolutionService(dbService, {
      axiomCriteriaService,
      mopCriteriaService,
      sourcePriorityService,
    });
  }

  async prepare(
    request: PrepareReviewProgramsRequest,
    actor: AnalysisSubmissionActorContext,
  ): Promise<PrepareReviewProgramsResponse> {
    const context = await this.assemblyService.assemble(request, actor);

    const programs = await Promise.all(
      context.reviewPrograms.map((program) => this.buildProgramReadiness(program, context, actor)),
    );
    const recommendedActions = [...new Set(programs.flatMap((program) => program.recommendedActions))];

    return {
      orderId: context.identity.orderId,
      ...(context.identity.engagementId ? { engagementId: context.identity.engagementId } : {}),
      preparedAt: new Date().toISOString(),
      contextSummary: {
        ...(context.identity.clientId ? { clientId: context.identity.clientId } : {}),
        ...(context.identity.subClientId ? { subClientId: context.identity.subClientId } : {}),
        documentCount: context.documents.length,
        hasDocuments: context.documents.length > 0,
        hasEnrichment: Boolean(context.latestEnrichment?.hasDataResult),
        extractionRunCount: context.runSummary.extractionRuns,
        criteriaRunCount: context.runSummary.criteriaRuns,
        ...(context.runSummary.latestSnapshotId ? { latestSnapshotId: context.runSummary.latestSnapshotId } : {}),
        reviewProgramsRequested: request.reviewProgramIds.length,
        reviewProgramsResolved: context.reviewPrograms.length,
      },
      programs,
      warnings: context.warnings,
      recommendedActions,
      context,
    };
  }

  private async buildProgramReadiness(
    program: ReviewProgram,
    context: ReviewContext,
    actor: AnalysisSubmissionActorContext,
  ): Promise<ProgramReadiness> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const recommendedActions: ReviewRecommendedAction[] = [];
    const axiomRefCount = program.aiCriteriaRefs?.length ?? 0;
    const mopRefCount = program.rulesetRefs?.length ?? 0;
    const criterionResolutions = await this.requirementResolutionService.resolveProgramRequirements(program, context, actor);

    if (!context.identity.clientId) {
      blockers.push('Order clientId is missing.');
      recommendedActions.push('contact_admin');
    }
    if (!context.identity.subClientId) {
      blockers.push('Order subClientId is missing.');
      recommendedActions.push('configure_sub_client');
    }
    if (axiomRefCount + mopRefCount === 0) {
      blockers.push('Review program does not declare any engine refs.');
      recommendedActions.push('update_review_program_mapping');
    }
    if (context.documents.length === 0) {
      warnings.push('No documents are attached to this order.');
      recommendedActions.push('upload_required_documents');
    }
    if (!context.runSummary.latestSnapshotId && context.documents.length > 0) {
      warnings.push('No extraction snapshot exists yet.');
      recommendedActions.push('run_extraction');
    }
    if (!context.latestEnrichment?.hasDataResult) {
      warnings.push('No property enrichment data is currently attached to this preparation context.');
    }

    for (const criterion of criterionResolutions) {
      if (criterion.blockingReason) {
        blockers.push(`${criterion.criterionTitle}: ${criterion.blockingReason}`);
      }
      if (criterion.warnings.length > 0) {
        warnings.push(...criterion.warnings.map((warning) => `${criterion.criterionTitle}: ${warning}`));
      }
      if (criterion.recommendedAction) {
        recommendedActions.push(criterion.recommendedAction);
      }
    }

    const readiness = this.computeProgramReadiness({
      hasEngineRefs: axiomRefCount + mopRefCount > 0,
      context,
      criterionResolutions,
      warnings,
    });
    const canDispatch = this.computeProgramDispatchability({
      readiness,
      axiomRefCount,
      mopRefCount,
      context,
    });

    return {
      reviewProgramId: program.id,
      reviewProgramName: program.name,
      reviewProgramVersion: program.version,
      readiness,
      canDispatch,
      axiomRefCount,
      mopRefCount,
      blockers: [...new Set(blockers)],
      warnings: [...new Set(warnings)],
      recommendedActions: [...new Set(recommendedActions)],
      criterionResolutions,
    };
  }

  private computeProgramReadiness(params: {
    hasEngineRefs: boolean;
    context: ReviewContext;
    criterionResolutions: CriterionResolution[];
    warnings: string[];
  }): ReviewReadinessState {
    const { hasEngineRefs, context, criterionResolutions, warnings } = params;

    if (!hasEngineRefs) {
      return 'not_runnable';
    }
    if (!context.identity.clientId || !context.identity.subClientId) {
      return 'blocked_by_configuration';
    }

    const criterionStates = new Set(criterionResolutions.map((criterion) => criterion.readiness));
    const readyCriteriaCount = criterionResolutions.filter(
      (criterion) => criterion.readiness === 'ready' || criterion.readiness === 'ready_with_warnings',
    ).length;
    const blockedCriteriaCount = criterionResolutions.length - readyCriteriaCount;

    if (criterionStates.has('not_runnable')) {
      return 'not_runnable';
    }
    if (criterionStates.has('blocked_by_configuration')) {
      return 'blocked_by_configuration';
    }
    if (criterionStates.has('blocked_by_data_integrity')) {
      return 'blocked_by_data_integrity';
    }
    if (criterionStates.has('requires_extraction')) {
      return 'requires_extraction';
    }
    if (readyCriteriaCount > 0 && blockedCriteriaCount > 0) {
      return 'partially_ready';
    }
    if (criterionStates.has('requires_documents')) {
      return 'requires_documents';
    }
    if (criterionStates.has('requires_comp_selection')) {
      return 'requires_comp_selection';
    }
    if (criterionStates.has('requires_manual_resolution')) {
      return 'requires_manual_resolution';
    }
    if (warnings.length > 0 || criterionStates.has('ready_with_warnings')) {
      return 'ready_with_warnings';
    }

    return 'ready';
  }

  private computeProgramDispatchability(params: {
    readiness: ReviewReadinessState;
    axiomRefCount: number;
    mopRefCount: number;
    context: ReviewContext;
  }): boolean {
    const { readiness, axiomRefCount, mopRefCount, context } = params;

    if (readiness !== 'ready' && readiness !== 'ready_with_warnings') {
      return false;
    }

    if (!context.identity.clientId || !context.identity.subClientId) {
      return false;
    }

    return axiomRefCount + mopRefCount > 0;
  }

}
