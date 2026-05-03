import type {
  PreparedReviewContextArtifact,
  PreparedReviewContextDiffResponse,
  PreparedReviewContextDispatchDiff,
  PreparedReviewContextProgramDiff,
  PreparedReviewContextDiffValueChange,
} from '../types/review-preparation.types.js';

export class ReviewContextDiffService {
  diffPreparedContexts(
    left: PreparedReviewContextArtifact,
    right: PreparedReviewContextArtifact,
  ): PreparedReviewContextDiffResponse {
    return {
      leftPreparedContextId: left.preparedContextId,
      rightPreparedContextId: right.preparedContextId,
      orderId: left.orderId,
      comparedAt: new Date().toISOString(),
      valueChanges: this.buildValueChanges(left, right),
      programDiffs: this.buildProgramDiffs(left, right),
      dispatchDiffs: this.buildDispatchDiffs(left, right),
    };
  }

  private buildValueChanges(
    left: PreparedReviewContextArtifact,
    right: PreparedReviewContextArtifact,
  ): PreparedReviewContextDiffValueChange[] {
    const changes: PreparedReviewContextDiffValueChange[] = [];

    this.pushIfChanged(changes, 'preparedContextVersion', left.preparedContextVersion, right.preparedContextVersion);
    this.pushIfChanged(changes, 'preparedAt', left.preparedAt, right.preparedAt);
    this.pushIfChanged(changes, 'contextSummary.documentCount', left.contextSummary.documentCount, right.contextSummary.documentCount);
    this.pushIfChanged(changes, 'contextSummary.hasDocuments', left.contextSummary.hasDocuments, right.contextSummary.hasDocuments);
    this.pushIfChanged(changes, 'contextSummary.hasEnrichment', left.contextSummary.hasEnrichment, right.contextSummary.hasEnrichment);
    this.pushIfChanged(changes, 'contextSummary.extractionRunCount', left.contextSummary.extractionRunCount, right.contextSummary.extractionRunCount);
    this.pushIfChanged(changes, 'contextSummary.criteriaRunCount', left.contextSummary.criteriaRunCount, right.contextSummary.criteriaRunCount);
    this.pushIfChanged(changes, 'contextSummary.latestSnapshotId', left.contextSummary.latestSnapshotId, right.contextSummary.latestSnapshotId);
    this.pushIfChanged(changes, 'context.compSummary.selectedCompCount', left.context.compSummary?.selectedCompCount, right.context.compSummary?.selectedCompCount);
    this.pushIfChanged(changes, 'context.compSummary.adjustedCompCount', left.context.compSummary?.adjustedCompCount, right.context.compSummary?.adjustedCompCount);
    this.pushIfChanged(changes, 'context.adjustmentSummary.maxGrossAdjustmentPct', left.context.adjustmentSummary?.maxGrossAdjustmentPct, right.context.adjustmentSummary?.maxGrossAdjustmentPct);
    this.pushIfChanged(changes, 'context.adjustmentSummary.maxNetAdjustmentPct', left.context.adjustmentSummary?.maxNetAdjustmentPct, right.context.adjustmentSummary?.maxNetAdjustmentPct);

    return changes;
  }

  private buildProgramDiffs(
    left: PreparedReviewContextArtifact,
    right: PreparedReviewContextArtifact,
  ): PreparedReviewContextProgramDiff[] {
    const programIds = new Set([
      ...left.programs.map((program) => program.reviewProgramId),
      ...right.programs.map((program) => program.reviewProgramId),
    ]);

    return [...programIds]
      .map((reviewProgramId) => {
        const leftProgram = left.programs.find((program) => program.reviewProgramId === reviewProgramId);
        const rightProgram = right.programs.find((program) => program.reviewProgramId === reviewProgramId);
        const leftBlockers = leftProgram?.blockers ?? [];
        const rightBlockers = rightProgram?.blockers ?? [];
        const leftWarnings = leftProgram?.warnings ?? [];
        const rightWarnings = rightProgram?.warnings ?? [];

        return {
          reviewProgramId,
          reviewProgramName: rightProgram?.reviewProgramName ?? leftProgram?.reviewProgramName ?? reviewProgramId,
          reviewProgramVersion: rightProgram?.reviewProgramVersion ?? leftProgram?.reviewProgramVersion ?? 'unknown',
          ...(leftProgram?.readiness ? { leftReadiness: leftProgram.readiness } : {}),
          ...(rightProgram?.readiness ? { rightReadiness: rightProgram.readiness } : {}),
          leftCanDispatch: leftProgram?.canDispatch ?? false,
          rightCanDispatch: rightProgram?.canDispatch ?? false,
          addedBlockers: this.diffAdded(rightBlockers, leftBlockers),
          removedBlockers: this.diffAdded(leftBlockers, rightBlockers),
          addedWarnings: this.diffAdded(rightWarnings, leftWarnings),
          removedWarnings: this.diffAdded(leftWarnings, rightWarnings),
        } satisfies PreparedReviewContextProgramDiff;
      })
      .filter((diff) => this.programDiffChanged(diff));
  }

  private buildDispatchDiffs(
    left: PreparedReviewContextArtifact,
    right: PreparedReviewContextArtifact,
  ): PreparedReviewContextDispatchDiff[] {
    const dispatchKeys = new Set([
      ...left.plannedEngineDispatches.map((dispatch) => this.dispatchKey(dispatch.reviewProgramId, dispatch.engine, dispatch.engineProgramId, dispatch.engineProgramVersion)),
      ...right.plannedEngineDispatches.map((dispatch) => this.dispatchKey(dispatch.reviewProgramId, dispatch.engine, dispatch.engineProgramId, dispatch.engineProgramVersion)),
    ]);

    return [...dispatchKeys]
      .map((key) => {
        const leftDispatch = left.plannedEngineDispatches.find((dispatch) => this.dispatchKey(dispatch.reviewProgramId, dispatch.engine, dispatch.engineProgramId, dispatch.engineProgramVersion) === key);
        const rightDispatch = right.plannedEngineDispatches.find((dispatch) => this.dispatchKey(dispatch.reviewProgramId, dispatch.engine, dispatch.engineProgramId, dispatch.engineProgramVersion) === key);
        const leftReasons = leftDispatch?.blockedReasons ?? [];
        const rightReasons = rightDispatch?.blockedReasons ?? [];

        return {
          reviewProgramId: rightDispatch?.reviewProgramId ?? leftDispatch?.reviewProgramId ?? 'unknown',
          engine: rightDispatch?.engine ?? leftDispatch?.engine ?? 'AXIOM',
          engineProgramId: rightDispatch?.engineProgramId ?? leftDispatch?.engineProgramId ?? 'unknown',
          engineProgramVersion: rightDispatch?.engineProgramVersion ?? leftDispatch?.engineProgramVersion ?? 'unknown',
          leftCanDispatch: leftDispatch?.canDispatch ?? false,
          rightCanDispatch: rightDispatch?.canDispatch ?? false,
          addedBlockedReasons: this.diffAdded(rightReasons, leftReasons),
          removedBlockedReasons: this.diffAdded(leftReasons, rightReasons),
        } satisfies PreparedReviewContextDispatchDiff;
      })
      .filter((diff) => diff.leftCanDispatch !== diff.rightCanDispatch || diff.addedBlockedReasons.length > 0 || diff.removedBlockedReasons.length > 0);
  }

  private pushIfChanged(changes: PreparedReviewContextDiffValueChange[], field: string, left: unknown, right: unknown): void {
    if (left !== right) {
      changes.push({ field, left, right });
    }
  }

  private diffAdded(values: string[], baseline: string[]): string[] {
    const baselineSet = new Set(baseline);
    return values.filter((value) => !baselineSet.has(value));
  }

  private programDiffChanged(diff: PreparedReviewContextProgramDiff): boolean {
    return diff.leftReadiness !== diff.rightReadiness
      || diff.leftCanDispatch !== diff.rightCanDispatch
      || diff.addedBlockers.length > 0
      || diff.removedBlockers.length > 0
      || diff.addedWarnings.length > 0
      || diff.removedWarnings.length > 0;
  }

  private dispatchKey(reviewProgramId: string, engine: string, engineProgramId: string, engineProgramVersion: string): string {
    return `${reviewProgramId}:${engine}:${engineProgramId}:${engineProgramVersion}`;
  }
}
