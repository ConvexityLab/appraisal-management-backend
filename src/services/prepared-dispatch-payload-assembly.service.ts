import type {
  CriterionResolution,
  PreparedDispatchCriteriaSummary,
  PreparedDispatchProvenanceSummary,
  PreparedCriterionDispatchInput,
  PreparedDocumentInventoryItem,
  PreparedInputSourceType,
  PreparedResolvedBindingSummary,
  PreparedUnmetRequiredInput,
} from '../types/review-preparation.types.js';
import type { ReviewContext } from '../types/review-context.types.js';

const PREPARED_INPUT_SOURCE_TYPES: PreparedInputSourceType[] = [
  'subjectProperty',
  'extraction',
  'providerData',
  'order',
  'provenance',
];

export class PreparedDispatchPayloadAssemblyService {
  buildDispatchPayloadData(
    criteria: CriterionResolution[],
    context: ReviewContext,
    documentInventory: PreparedDocumentInventoryItem[],
    snapshotId?: string,
  ): {
    criteria: PreparedCriterionDispatchInput[];
    unmetRequiredInputs: PreparedUnmetRequiredInput[];
    criteriaSummary: PreparedDispatchCriteriaSummary;
    provenanceSummary: PreparedDispatchProvenanceSummary;
  } {
    const criterionInputs = criteria.map((criterion) => {
      const matchedDocuments = this.matchDocuments(documentInventory, criterion.requiredDocumentTypes);
      const unmetRequiredInputs = this.buildUnmetRequiredInputs(criterion);

      return {
        criterionId: criterion.criterionId,
        criterionTitle: criterion.criterionTitle,
        readiness: criterion.readiness,
        resolvedDataBindings: criterion.resolvedDataBindings,
        requiredDataPaths: criterion.requiredDataPaths,
        missingDataPaths: criterion.missingDataPaths,
        resolvedDocumentTypes: criterion.resolvedDocumentTypes,
        requiredDocumentTypes: criterion.requiredDocumentTypes,
        missingDocumentTypes: criterion.missingDocumentTypes,
        resolvedDataValues: criterion.resolvedDataBindings.map((binding) => ({
          requirementPath: binding.requirementPath,
          resolvedPath: binding.resolvedPath,
          sourceType: binding.sourceType,
          value: this.getResolvedValue(context, binding.resolvedPath),
        })),
        matchedDocuments,
        unmetRequiredInputs,
        warnings: criterion.warnings,
      } satisfies PreparedCriterionDispatchInput;
    });

    return {
      criteria: criterionInputs,
      unmetRequiredInputs: criterionInputs.flatMap((criterion) => criterion.unmetRequiredInputs ?? []),
      criteriaSummary: this.buildCriteriaSummary(criterionInputs),
      provenanceSummary: this.buildProvenanceSummary(criterionInputs, context, snapshotId),
    };
  }

  private buildUnmetRequiredInputs(criterion: CriterionResolution): PreparedUnmetRequiredInput[] {
    return [
      ...criterion.missingDataPaths.map((path) => ({
        criterionId: criterion.criterionId,
        criterionTitle: criterion.criterionTitle,
        inputType: 'data' as const,
        requirement: path,
        ...(criterion.blockingReason ? { blockingReason: criterion.blockingReason } : {}),
        ...(criterion.recommendedAction ? { recommendedAction: criterion.recommendedAction } : {}),
      })),
      ...criterion.missingDocumentTypes.map((documentType) => ({
        criterionId: criterion.criterionId,
        criterionTitle: criterion.criterionTitle,
        inputType: 'document' as const,
        requirement: documentType,
        ...(criterion.blockingReason ? { blockingReason: criterion.blockingReason } : {}),
        ...(criterion.recommendedAction ? { recommendedAction: criterion.recommendedAction } : {}),
      })),
    ];
  }

  private buildCriteriaSummary(criteria: PreparedCriterionDispatchInput[]): PreparedDispatchCriteriaSummary {
    return {
      totalCriteria: criteria.length,
      readyCriteriaCount: criteria.filter((criterion) => criterion.readiness === 'ready').length,
      warningCriteriaCount: criteria.filter((criterion) => criterion.readiness === 'ready_with_warnings').length,
      blockedCriteriaCount: criteria.filter((criterion) => criterion.readiness !== 'ready' && criterion.readiness !== 'ready_with_warnings').length,
      criteriaWithUnmetRequiredInputsCount: criteria.filter((criterion) => (criterion.unmetRequiredInputs?.length ?? 0) > 0).length,
    };
  }

  private buildProvenanceSummary(
    criteria: PreparedCriterionDispatchInput[],
    context: ReviewContext,
    snapshotId?: string,
  ): PreparedDispatchProvenanceSummary {
    const resolvedBindingsBySource = this.createEmptyResolvedBindingsBySource();
    const matchedDocumentIds = new Set<string>();
    const matchedDocumentTypes = new Set<string>();

    for (const criterion of criteria) {
      for (const resolvedValue of criterion.resolvedDataValues) {
        const bucket = resolvedBindingsBySource[resolvedValue.sourceType];
        if (!bucket.some((binding) => binding.requirementPath === resolvedValue.requirementPath && binding.resolvedPath === resolvedValue.resolvedPath)) {
          bucket.push({
            requirementPath: resolvedValue.requirementPath,
            resolvedPath: resolvedValue.resolvedPath,
          });
        }
      }

      for (const document of criterion.matchedDocuments) {
        matchedDocumentIds.add(document.documentId);
        if (document.documentType) {
          matchedDocumentTypes.add(document.documentType);
        } else if (document.category) {
          matchedDocumentTypes.add(document.category);
        }
      }
    }

    return {
      sourceTypesUsed: PREPARED_INPUT_SOURCE_TYPES.filter((sourceType) => resolvedBindingsBySource[sourceType].length > 0),
      resolvedBindingsBySource,
      matchedDocumentIds: [...matchedDocumentIds],
      matchedDocumentTypes: [...matchedDocumentTypes],
      evidenceSourceTypes: [...new Set(context.evidenceRefs.map((evidenceRef) => evidenceRef.sourceType))],
      snapshotLinked: Boolean(snapshotId),
      ...(snapshotId ? { snapshotId } : {}),
    };
  }

  private createEmptyResolvedBindingsBySource(): Record<PreparedInputSourceType, PreparedResolvedBindingSummary[]> {
    return {
      canonical: [],
      subjectProperty: [],
      extraction: [],
      providerData: [],
      order: [],
      provenance: [],
    };
  }

  private matchDocuments(
    documentInventory: PreparedDocumentInventoryItem[],
    requiredDocumentTypes: string[],
  ): PreparedDocumentInventoryItem[] {
    const requiredSet = new Set(requiredDocumentTypes.map((value) => this.normalize(value)));
    if (requiredSet.size === 0) {
      return [];
    }

    return documentInventory.filter((document) => {
      const documentType = this.normalize(document.documentType ?? '');
      const category = this.normalize(document.category ?? '');
      return requiredSet.has(documentType) || requiredSet.has(category);
    });
  }

  private getResolvedValue(context: ReviewContext, resolvedPath: string): unknown {
    const path = resolvedPath.trim();
    if (path.length === 0) {
      return undefined;
    }

    if (path.startsWith('order.')) {
      return this.readPath(context.order, path.slice('order.'.length));
    }
    if (path.startsWith('subjectProperty.')) {
      return this.readPath(context.canonicalData?.subjectProperty, path.slice('subjectProperty.'.length));
    }
    if (path.startsWith('extraction.')) {
      return this.readPath(context.canonicalData?.extraction, path.slice('extraction.'.length));
    }
    if (path.startsWith('providerData.')) {
      return this.readPath(context.canonicalData?.providerData, path.slice('providerData.'.length));
    }
    if (path.startsWith('provenance.')) {
      return this.readPath(context.canonicalData?.provenance, path.slice('provenance.'.length));
    }

    return this.readPath(context.order, path);
  }

  private readPath(target: unknown, path: string): unknown {
    if (!target || !path) {
      return undefined;
    }

    const segments = path
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    let current: unknown = target;
    for (const segment of segments) {
      if (current == null) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const index = Number(segment);
        if (!Number.isInteger(index)) {
          return undefined;
        }
        current = current[index];
        continue;
      }

      if (typeof current !== 'object') {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
}
