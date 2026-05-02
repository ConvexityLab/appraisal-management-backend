import { AxiomService } from './axiom.service.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { MopCriteriaService } from './mop-criteria.service.js';
import { ReviewSourcePriorityService } from './review-source-priority.service.js';
import type { AnalysisSubmissionActorContext } from '../types/analysis-submission.types.js';
import type { CompiledProgramNode } from '../types/axiom.types.js';
import type { MopCriteriaCompileResult } from '../types/mop-criteria.types.js';
import type { CriterionResolution } from '../types/review-preparation.types.js';
import type { ReviewContext, ReviewReadinessState, ReviewRecommendedAction } from '../types/review-context.types.js';
import type { ReviewProgram } from '../types/review-tape.types.js';

interface ReviewRequirementResolutionServiceDependencies {
  axiomCriteriaService?: Pick<AxiomService, 'getCompiledCriteria'>;
  mopCriteriaService?: Pick<MopCriteriaService, 'getCompiledCriteria'>;
  sourcePriorityService?: Pick<ReviewSourcePriorityService, 'resolveRequirementPath'>;
}

export class ReviewRequirementResolutionService {
  private static readonly COMP_PATH_KEYWORDS = ['comparables', 'comparable', 'comp', 'comps', 'salescomparisonapproach'] as const;
  private static readonly ADJUSTMENT_PATH_KEYWORDS = ['adjustment', 'adjustments', 'adjustedsaleprice', 'grossadjustment', 'netadjustment'] as const;

  private readonly axiomCriteriaService: Pick<AxiomService, 'getCompiledCriteria'>;
  private readonly mopCriteriaService: Pick<MopCriteriaService, 'getCompiledCriteria'>;
  private readonly sourcePriorityService: Pick<ReviewSourcePriorityService, 'resolveRequirementPath'>;

  constructor(
    dbService: CosmosDbService,
    dependencies: ReviewRequirementResolutionServiceDependencies = {},
  ) {
    this.axiomCriteriaService = dependencies.axiomCriteriaService ?? new AxiomService(dbService);
    this.mopCriteriaService = dependencies.mopCriteriaService ?? new MopCriteriaService(dbService);
    this.sourcePriorityService = dependencies.sourcePriorityService ?? new ReviewSourcePriorityService();
  }

  async resolveProgramRequirements(
    program: ReviewProgram,
    context: ReviewContext,
    actor: AnalysisSubmissionActorContext,
  ): Promise<CriterionResolution[]> {
    const clientId = context.identity.clientId;
    const subClientId = context.identity.subClientId;

    const axiomResolutions = await Promise.all(
      (program.aiCriteriaRefs ?? []).map(async (ref) => {
        if (!clientId) {
          return [this.buildCompileBlockedResolution('AXIOM', ref.programId, ref.programVersion, 'Order clientId is required to resolve Axiom criteria requirements.')];
        }
        if (!subClientId) {
          return [this.buildCompileBlockedResolution('AXIOM', ref.programId, ref.programVersion, 'Order subClientId is required to resolve Axiom criteria requirements.')];
        }

        try {
          const compiled = await this.axiomCriteriaService.getCompiledCriteria(
            clientId,
            subClientId,
            ref.programId,
            ref.programVersion,
          );

          return compiled.criteria.map((criterion) =>
            this.resolveCompiledCriterion(criterion, context, ref.programId, ref.programVersion),
          );
        } catch (error) {
          return [
            this.buildCompileBlockedResolution(
              'AXIOM',
              ref.programId,
              ref.programVersion,
              error instanceof Error ? error.message : `Failed to resolve Axiom criteria for ${ref.programId}`,
            ),
          ];
        }
      }),
    );

    const mopResolutions = await Promise.all(
      (program.rulesetRefs ?? []).map(async (ref) => {
        if (!clientId) {
          return [this.buildCompileBlockedResolution('MOP_PRIO', ref.programId, ref.programVersion, 'Order clientId is required to resolve MOP criteria requirements.')];
        }

        try {
          const compiled = await this.mopCriteriaService.getCompiledCriteria(
            clientId,
            actor.tenantId,
            ref.programId,
            ref.programVersion,
          );

          return this.resolveMopCriteria(compiled, context);
        } catch (error) {
          return [
            this.buildCompileBlockedResolution(
              'MOP_PRIO',
              ref.programId,
              ref.programVersion,
              error instanceof Error ? error.message : `Failed to resolve MOP criteria for ${ref.programId}`,
            ),
          ];
        }
      }),
    );

    return [...axiomResolutions.flat(), ...mopResolutions.flat()];
  }

  private resolveCompiledCriterion(
    criterion: CompiledProgramNode,
    context: ReviewContext,
    engineProgramId: string,
    engineProgramVersion: string,
  ): CriterionResolution {
    const requiredDataPaths = (criterion.dataRequirements ?? [])
      .filter((requirement) => requirement.required)
      .map((requirement) => requirement.path)
      .filter((path): path is string => typeof path === 'string' && path.trim().length > 0);
    const resolvedRequiredBindings = requiredDataPaths
      .map((path) => this.sourcePriorityService.resolveRequirementPath(context, path))
      .filter((binding): binding is NonNullable<typeof binding> => binding !== null);
    const missingDataPaths = requiredDataPaths.filter(
      (path) => !resolvedRequiredBindings.some((binding) => binding.requirementPath === path),
    );
    const optionalMissingDataPaths = (criterion.dataRequirements ?? [])
      .filter((requirement) => !requirement.required)
      .map((requirement) => requirement.path)
      .filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
      .filter((path) => this.sourcePriorityService.resolveRequirementPath(context, path) === null);
    const requiredDocumentTypes = (criterion.documentRequirements ?? [])
      .filter((requirement) => requirement.required)
      .map((requirement) => requirement.documentType)
      .filter((documentType): documentType is string => typeof documentType === 'string' && documentType.trim().length > 0);
    const missingDocumentTypes = requiredDocumentTypes.filter((documentType) => !this.hasDocumentType(context, documentType));
    const resolvedDocumentTypes = requiredDocumentTypes.filter((documentType) => !missingDocumentTypes.includes(documentType));
    const warnings = optionalMissingDataPaths.length > 0
      ? [`Optional data not currently present: ${optionalMissingDataPaths.join(', ')}`]
      : [];

    // Schema-driven category lookup: when the compiled criterion explicitly
    // categorizes a data requirement as 'comp' / 'adjustment' / 'standard',
    // honor that classification instead of guessing from path keywords.
    const pathCategoryMap = this.buildPathCategoryMap(criterion);

    return this.buildResolution({
      criterionId: criterion.concept || criterion.nodeId || criterion.id,
      criterionTitle: criterion.title || criterion.concept || 'Unnamed Axiom criterion',
      engine: 'AXIOM',
      engineProgramId,
      engineProgramVersion,
      resolvedDataBindings: resolvedRequiredBindings,
      requiredDataPaths,
      missingDataPaths,
      resolvedDocumentTypes,
      requiredDocumentTypes,
      missingDocumentTypes,
      warnings,
      context,
      pathCategoryMap,
    });
  }

  private buildPathCategoryMap(
    criterion: CompiledProgramNode,
  ): Map<string, 'comp' | 'adjustment' | 'standard'> {
    const map = new Map<string, 'comp' | 'adjustment' | 'standard'>();
    for (const requirement of criterion.dataRequirements ?? []) {
      if (!requirement?.category || typeof requirement.path !== 'string' || requirement.path.trim().length === 0) {
        continue;
      }
      map.set(this.normalizePath(requirement.path), requirement.category);
    }
    return map;
  }

  private resolveMopCriteria(
    compiled: MopCriteriaCompileResult,
    context: ReviewContext,
  ): CriterionResolution[] {
    const autoFlagResolutions = compiled.criteria.autoFlags.map((flag) => {
      const requiredDataPaths = [...new Set(flag.condition.rules.map((rule) => String(rule.field)).filter((field) => field.trim().length > 0))];
      const resolvedDataBindings = requiredDataPaths
        .map((path) => this.sourcePriorityService.resolveRequirementPath(context, path))
        .filter((binding): binding is NonNullable<typeof binding> => binding !== null);
      const missingDataPaths = requiredDataPaths.filter(
        (path) => !resolvedDataBindings.some((binding) => binding.requirementPath === path),
      );

      return this.buildResolution({
        criterionId: flag.id,
        criterionTitle: flag.label,
        engine: 'MOP_PRIO',
        engineProgramId: compiled.metadata.programId,
        engineProgramVersion: compiled.metadata.programVersion,
        resolvedDataBindings,
        requiredDataPaths,
        missingDataPaths,
        resolvedDocumentTypes: [],
        requiredDocumentTypes: [],
        missingDocumentTypes: [],
        warnings: [],
        context,
      });
    });

    const manualFlagResolutions = compiled.criteria.manualFlags.map((flag) => {
      const requiredDataPaths = [String(flag.field)].filter((field) => field.trim().length > 0);
      const resolvedDataBindings = requiredDataPaths
        .map((path) => this.sourcePriorityService.resolveRequirementPath(context, path))
        .filter((binding): binding is NonNullable<typeof binding> => binding !== null);
      const missingDataPaths = requiredDataPaths.filter(
        (path) => !resolvedDataBindings.some((binding) => binding.requirementPath === path),
      );

      return this.buildResolution({
        criterionId: flag.id,
        criterionTitle: flag.label,
        engine: 'MOP_PRIO',
        engineProgramId: compiled.metadata.programId,
        engineProgramVersion: compiled.metadata.programVersion,
        resolvedDataBindings,
        requiredDataPaths,
        missingDataPaths,
        resolvedDocumentTypes: [],
        requiredDocumentTypes: [],
        missingDocumentTypes: [],
        warnings: [],
        context,
      });
    });

    return [...autoFlagResolutions, ...manualFlagResolutions];
  }

  private buildResolution(params: {
    criterionId: string;
    criterionTitle: string;
    engine: 'AXIOM' | 'MOP_PRIO';
    engineProgramId?: string;
    engineProgramVersion?: string;
    resolvedDataBindings: CriterionResolution['resolvedDataBindings'];
    requiredDataPaths: string[];
    missingDataPaths: string[];
    resolvedDocumentTypes: string[];
    requiredDocumentTypes: string[];
    missingDocumentTypes: string[];
    warnings: string[];
    context: ReviewContext;
    pathCategoryMap?: Map<string, 'comp' | 'adjustment' | 'standard'>;
  }): CriterionResolution {
    const {
      criterionId,
      criterionTitle,
      engine,
      engineProgramId,
      engineProgramVersion,
      resolvedDataBindings,
      requiredDataPaths,
      missingDataPaths,
      resolvedDocumentTypes,
      requiredDocumentTypes,
      missingDocumentTypes,
      warnings,
      context,
      pathCategoryMap,
    } = params;

    let readiness: ReviewReadinessState = 'ready';
    let blockingReason: string | undefined;
    let recommendedAction: ReviewRecommendedAction | undefined;
    const compRequirementBlock = this.buildCompRequirementBlock(context, missingDataPaths, pathCategoryMap);
    const requiresExtraction = this.shouldRequireExtraction(context, missingDataPaths, pathCategoryMap);

    if (missingDocumentTypes.length > 0) {
      readiness = 'requires_documents';
      blockingReason = `Missing required document types: ${missingDocumentTypes.join(', ')}`;
      recommendedAction = 'upload_required_documents';
    } else if (compRequirementBlock) {
      readiness = 'requires_comp_selection';
      blockingReason = compRequirementBlock;
      recommendedAction = 'select_comps';
    } else if (requiresExtraction) {
      readiness = 'requires_extraction';
      blockingReason = `Missing required extracted data paths: ${missingDataPaths.join(', ')}`;
      recommendedAction = 'run_extraction';
    } else if (missingDataPaths.length > 0) {
      readiness = 'requires_manual_resolution';
      blockingReason = `Missing required data paths: ${missingDataPaths.join(', ')}`;
      recommendedAction = context.documents.length > 0 && !context.runSummary.latestSnapshotId
        ? 'run_extraction'
        : 'resolve_source_conflict';
    } else if (warnings.length > 0) {
      readiness = 'ready_with_warnings';
    }

    return {
      criterionId,
      criterionTitle,
      engine,
      ...(engineProgramId ? { engineProgramId } : {}),
      ...(engineProgramVersion ? { engineProgramVersion } : {}),
      readiness,
      ...(blockingReason ? { blockingReason } : {}),
      ...(recommendedAction ? { recommendedAction } : {}),
      resolvedDataBindings,
      requiredDataPaths,
      missingDataPaths,
      resolvedDocumentTypes,
      requiredDocumentTypes,
      missingDocumentTypes,
      warnings,
    };
  }

  private buildCompileBlockedResolution(
    engine: 'AXIOM' | 'MOP_PRIO',
    engineProgramId: string,
    engineProgramVersion: string,
    reason: string,
  ): CriterionResolution {
    return {
      criterionId: `${engineProgramId}:${engineProgramVersion}:compile`,
      criterionTitle: `${engineProgramId} requirements`,
      engine,
      engineProgramId,
      engineProgramVersion,
      readiness: 'blocked_by_configuration',
      blockingReason: reason,
      recommendedAction: 'update_review_program_mapping',
      resolvedDataBindings: [],
      requiredDataPaths: [],
      missingDataPaths: [],
      resolvedDocumentTypes: [],
      requiredDocumentTypes: [],
      missingDocumentTypes: [],
      warnings: [],
    };
  }

  private hasDocumentType(context: ReviewContext, documentType: string): boolean {
    const expected = this.normalizePath(documentType);
    return context.documents.some((document) => {
      const actual = this.normalizePath(document.documentType ?? document.category ?? '');
      return actual === expected;
    });
  }

  private normalizePath(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\[(\d+)\]/g, '')
      .replace(/[^a-z0-9.]+/g, '');
  }

  private buildCompRequirementBlock(
    context: ReviewContext,
    missingDataPaths: string[],
    pathCategoryMap?: Map<string, 'comp' | 'adjustment' | 'standard'>,
  ): string | null {
    if (missingDataPaths.length === 0) {
      return null;
    }

    const adjustmentPaths = missingDataPaths.filter((path) => this.isAdjustmentRequirementPath(path, pathCategoryMap));
    const compPaths = missingDataPaths.filter(
      (path) => this.isCompRequirementPath(path, pathCategoryMap) && !adjustmentPaths.includes(path),
    );

    if (adjustmentPaths.length > 0) {
      if (!context.compSummary?.hasCompSelection) {
        return `Comparable selection is required before adjustment-driven criteria can run: ${adjustmentPaths.join(', ')}`;
      }
      if (!context.compSummary?.hasAdjustments) {
        return `Comparable adjustments are required for data paths: ${adjustmentPaths.join(', ')}`;
      }
    }

    if (compPaths.length > 0) {
      if (!context.latestReport && !context.compSummary) {
        return `Comparable context is not available for required data paths: ${compPaths.join(', ')}`;
      }
      if (!context.compSummary?.hasCompSelection) {
        return `Comparable selection is required for data paths: ${compPaths.join(', ')}`;
      }
    }

    return null;
  }

  private isCompRequirementPath(
    path: string,
    pathCategoryMap?: Map<string, 'comp' | 'adjustment' | 'standard'>,
  ): boolean {
    const normalized = this.normalizePath(path);
    if (normalized.length === 0) {
      return false;
    }

    // Schema-driven categorization wins when present — this avoids false
    // positives from path keywords (e.g. a 'standard' requirement whose path
    // happens to contain "comparables.") and false negatives (a comp
    // requirement whose path is "subjectProperty.x").
    if (pathCategoryMap) {
      const category = pathCategoryMap.get(normalized);
      if (category) {
        return category === 'comp';
      }
    }

    return ReviewRequirementResolutionService.COMP_PATH_KEYWORDS.some((keyword) =>
      normalized === keyword || normalized.includes(`${keyword}.`) || normalized.includes(`.${keyword}`) || normalized.includes(keyword),
    );
  }

  private shouldRequireExtraction(
    context: ReviewContext,
    missingDataPaths: string[],
    pathCategoryMap?: Map<string, 'comp' | 'adjustment' | 'standard'>,
  ): boolean {
    if (missingDataPaths.length === 0) {
      return false;
    }

    if (context.documents.length === 0 || context.runSummary.latestSnapshotId) {
      return false;
    }

    return missingDataPaths.every((path) => !this.isCompRequirementPath(path, pathCategoryMap));
  }

  private isAdjustmentRequirementPath(
    path: string,
    pathCategoryMap?: Map<string, 'comp' | 'adjustment' | 'standard'>,
  ): boolean {
    const normalized = this.normalizePath(path);
    if (normalized.length === 0) {
      return false;
    }

    if (pathCategoryMap) {
      const category = pathCategoryMap.get(normalized);
      if (category) {
        return category === 'adjustment';
      }
    }

    return ReviewRequirementResolutionService.ADJUSTMENT_PATH_KEYWORDS.some((keyword) =>
      normalized === keyword || normalized.includes(`${keyword}.`) || normalized.includes(`.${keyword}`) || normalized.includes(keyword),
    );
  }
}