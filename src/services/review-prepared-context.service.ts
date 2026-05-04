import { randomUUID } from 'crypto';
import { CosmosDbService } from './cosmos-db.service.js';
import { PreparedDispatchPayloadAssemblyService } from './prepared-dispatch-payload-assembly.service.js';
import type { AnalysisSubmissionActorContext } from '../types/analysis-submission.types.js';
import type {
  AxiomPreparedPayload,
  MopPrioPreparedPayload,
  PrepareReviewProgramsResponse,
  PreparedDocumentInventoryItem,
  PreparedEngineDispatch,
  PreparedReviewContextArtifact,
  PreparedReviewContextListItem,
} from '../types/review-preparation.types.js';

const PREPARED_CONTEXT_TYPE = 'review-program-prepared-context';
const CONTRACT_VERSION = '1.0' as const;

export class ReviewPreparedContextService {
  private readonly containerName = 'aiInsights';
  private readonly payloadAssemblyService = new PreparedDispatchPayloadAssemblyService();

  constructor(private readonly dbService: CosmosDbService) {}

  async persistPreparation(
    response: PrepareReviewProgramsResponse,
    actor: AnalysisSubmissionActorContext,
  ): Promise<PrepareReviewProgramsResponse> {
    const preparedContextId = randomUUID();
    const preparedContextVersion = response.context.contextVersion;
    const plannedEngineDispatches = this.buildPlannedEngineDispatches(
      response,
      preparedContextId,
      preparedContextVersion,
      actor.tenantId,
    );
    const createdAt = new Date().toISOString();

    const artifact: PreparedReviewContextArtifact = {
      id: preparedContextId,
      type: PREPARED_CONTEXT_TYPE,
      tenantId: actor.tenantId,
      createdAt,
      createdBy: actor.initiatedBy,
      preparedContextId,
      preparedContextVersion,
      orderId: response.orderId,
      ...(response.engagementId ? { engagementId: response.engagementId } : {}),
      preparedAt: response.preparedAt,
      contextSummary: response.contextSummary,
      programs: response.programs,
      warnings: response.warnings,
      recommendedActions: response.recommendedActions,
      plannedEngineDispatches,
      context: response.context,
    };

    const saveResult = await this.dbService.upsertItem<PreparedReviewContextArtifact>(this.containerName, artifact);
    if (!saveResult.success) {
      throw new Error(saveResult.error?.message ?? 'Failed to persist prepared review context artifact');
    }

    return {
      ...response,
      preparedContextId,
      preparedContextVersion,
      plannedEngineDispatches,
    };
  }

  async getPreparedContext(
    preparedContextId: string,
    tenantId: string,
  ): Promise<PreparedReviewContextArtifact> {
    const result = await this.dbService.queryItems<PreparedReviewContextArtifact>(
      this.containerName,
      `SELECT TOP 1 * FROM c WHERE c.type = @type AND c.id = @id AND c.tenantId = @tenantId`,
      [
        { name: '@type', value: PREPARED_CONTEXT_TYPE },
        { name: '@id', value: preparedContextId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    const artifact = result.success ? result.data?.[0] : null;
    if (!artifact) {
      throw new Error(`Prepared review context '${preparedContextId}' not found for tenant '${tenantId}'`);
    }

    return artifact;
  }

  async listPreparedContextsForOrder(
    orderId: string,
    tenantId: string,
    limit = 10,
  ): Promise<PreparedReviewContextListItem[]> {
    if (!orderId || orderId.trim().length === 0) {
      throw new Error('orderId is required to list prepared review contexts');
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error(`limit must be a positive integer, got '${limit}'`);
    }

    const result = await this.dbService.queryItems<PreparedReviewContextArtifact>(
      this.containerName,
      `SELECT TOP ${limit} * FROM c WHERE c.type = @type AND c.orderId = @orderId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC`,
      [
        { name: '@type', value: PREPARED_CONTEXT_TYPE },
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success || !result.data) {
      throw new Error(result.error?.message ?? `Failed to list prepared review contexts for order '${orderId}'`);
    }

    return result.data.map((artifact) => ({
      preparedContextId: artifact.preparedContextId,
      preparedContextVersion: artifact.preparedContextVersion,
      orderId: artifact.orderId,
      ...(artifact.engagementId ? { engagementId: artifact.engagementId } : {}),
      createdAt: artifact.createdAt,
      createdBy: artifact.createdBy,
      preparedAt: artifact.preparedAt,
      reviewProgramCount: artifact.programs.length,
      dispatchCount: artifact.plannedEngineDispatches.length,
      warningCount: artifact.warnings.length,
      recommendedActionCount: artifact.recommendedActions.length,
      readyProgramCount: artifact.programs.filter((program) => program.canDispatch).length,
      blockedProgramCount: artifact.programs.filter((program) => !program.canDispatch).length,
      ...(artifact.context.runSummary.latestSnapshotId
        ? { latestSnapshotId: artifact.context.runSummary.latestSnapshotId }
        : {}),
    }));
  }

  async getPreparedDispatchByRef(
    payloadRef: string,
    tenantId: string,
  ): Promise<PreparedEngineDispatch> {
    const preparedContextId = this.extractPreparedContextId(payloadRef);
    const artifact = await this.getPreparedContext(preparedContextId, tenantId);
    const dispatch = artifact.plannedEngineDispatches.find((candidate) => candidate.payloadRef === payloadRef);

    if (!dispatch) {
      throw new Error(`Prepared dispatch payload '${payloadRef}' was not found in prepared context '${preparedContextId}'`);
    }

    return dispatch;
  }

  private buildPlannedEngineDispatches(
    response: PrepareReviewProgramsResponse,
    preparedContextId: string,
    preparedContextVersion: string,
    tenantId: string,
  ): PreparedEngineDispatch[] {
    const documentInventory = this.buildDocumentInventory(response);
    const snapshotId = response.context.runSummary.latestSnapshotId;
    const clientId = response.context.identity.clientId;
    const subClientId = response.context.identity.subClientId;

    return response.programs.flatMap((program) => {
      const programDefinition = response.context.reviewPrograms.find(
        (candidate) => candidate.id === program.reviewProgramId,
      );
      if (!programDefinition) {
        return [];
      }

      const axiomDispatches = (programDefinition.aiCriteriaRefs ?? []).map((ref) => {
        const criteria = program.criterionResolutions.filter(
          (criterion) => criterion.engine === 'AXIOM'
            && criterion.engineProgramId === ref.programId
            && criterion.engineProgramVersion === ref.programVersion,
        );
        const payloadData = this.payloadAssemblyService.buildDispatchPayloadData(
          criteria,
          response.context,
          documentInventory,
          snapshotId,
        );
        const blockedReasons = criteria
          .filter((criterion) => criterion.readiness !== 'ready' && criterion.readiness !== 'ready_with_warnings')
          .map((criterion) => criterion.blockingReason ?? `${criterion.criterionTitle} is not dispatchable.`);
        if (!clientId || !subClientId) {
          blockedReasons.push('Prepared context is missing client/sub-client configuration required for dispatch.');
        }
        const payloadRef = `prepared-context://${preparedContextId}/dispatch/AXIOM/${ref.programId}:${ref.programVersion}`;
        const payload: AxiomPreparedPayload = {
          contractType: 'axiom-review-dispatch',
          contractVersion: CONTRACT_VERSION,
          dispatchMode: 'prepared-context',
          preparedContextId,
          preparedContextVersion,
          orderId: response.orderId,
          ...(response.engagementId ? { engagementId: response.engagementId } : {}),
          tenantId,
          reviewProgramId: program.reviewProgramId,
          reviewProgramVersion: program.reviewProgramVersion,
          engineProgramId: ref.programId,
          engineProgramVersion: ref.programVersion,
          ...(snapshotId ? { snapshotId } : {}),
          ...(clientId && subClientId
            ? {
                programKey: {
                  clientId,
                  subClientId,
                  programId: ref.programId,
                  version: ref.programVersion,
                },
              }
            : {}),
          criteria: payloadData.criteria,
          unmetRequiredInputs: payloadData.unmetRequiredInputs,
          criteriaSummary: payloadData.criteriaSummary,
          provenanceSummary: payloadData.provenanceSummary,
          documentInventory,
          evidenceRefs: response.context.evidenceRefs,
        };

        return {
          id: `${preparedContextId}:AXIOM:${ref.programId}:${ref.programVersion}`,
          reviewProgramId: program.reviewProgramId,
          reviewProgramVersion: program.reviewProgramVersion,
          engine: 'AXIOM' as const,
          engineProgramId: ref.programId,
          engineProgramVersion: ref.programVersion,
          payloadContractType: 'axiom-review-dispatch' as const,
          payloadContractVersion: CONTRACT_VERSION,
          payloadRef,
          canDispatch: blockedReasons.length === 0,
          blockedReasons: [...new Set(blockedReasons)],
          payload,
        } satisfies PreparedEngineDispatch;
      });

      const mopDispatches = (programDefinition.rulesetRefs ?? []).map((ref) => {
        const criteria = program.criterionResolutions.filter(
          (criterion) => criterion.engine === 'MOP_PRIO'
            && criterion.engineProgramId === ref.programId
            && criterion.engineProgramVersion === ref.programVersion,
        );
        const payloadData = this.payloadAssemblyService.buildDispatchPayloadData(
          criteria,
          response.context,
          documentInventory,
          snapshotId,
        );
        const blockedReasons = criteria
          .filter((criterion) => criterion.readiness !== 'ready' && criterion.readiness !== 'ready_with_warnings')
          .map((criterion) => criterion.blockingReason ?? `${criterion.criterionTitle} is not dispatchable.`);
        if (!clientId || !subClientId) {
          blockedReasons.push('Prepared context is missing client/sub-client configuration required for dispatch.');
        }
        const payloadRef = `prepared-context://${preparedContextId}/dispatch/MOP_PRIO/${ref.programId}:${ref.programVersion}`;
        const payload: MopPrioPreparedPayload = {
          contractType: 'mop-prio-review-dispatch',
          contractVersion: CONTRACT_VERSION,
          preparedContextId,
          preparedContextVersion,
          orderId: response.orderId,
          ...(response.engagementId ? { engagementId: response.engagementId } : {}),
          tenantId,
          reviewProgramId: program.reviewProgramId,
          reviewProgramVersion: program.reviewProgramVersion,
          engineProgramId: ref.programId,
          engineProgramVersion: ref.programVersion,
          ...(snapshotId ? { snapshotId } : {}),
          ...(clientId && subClientId
            ? {
                programKey: {
                  clientId,
                  subClientId,
                  programId: ref.programId,
                  version: ref.programVersion,
                },
              }
            : {}),
          dispatchMode: 'prepared-context',
          criteria: payloadData.criteria,
          unmetRequiredInputs: payloadData.unmetRequiredInputs,
          criteriaSummary: payloadData.criteriaSummary,
          provenanceSummary: payloadData.provenanceSummary,
          documentInventory,
          evidenceRefs: response.context.evidenceRefs,
        };

        return {
          id: `${preparedContextId}:MOP_PRIO:${ref.programId}:${ref.programVersion}`,
          reviewProgramId: program.reviewProgramId,
          reviewProgramVersion: program.reviewProgramVersion,
          engine: 'MOP_PRIO' as const,
          engineProgramId: ref.programId,
          engineProgramVersion: ref.programVersion,
          payloadContractType: 'mop-prio-review-dispatch' as const,
          payloadContractVersion: CONTRACT_VERSION,
          payloadRef,
          canDispatch: blockedReasons.length === 0,
          blockedReasons: [...new Set(blockedReasons)],
          payload,
        } satisfies PreparedEngineDispatch;
      });

      return [...axiomDispatches, ...mopDispatches];
    });
  }

  private buildDocumentInventory(response: PrepareReviewProgramsResponse): PreparedDocumentInventoryItem[] {
    return response.context.documents.map((document) => ({
      documentId: document.id,
      ...(document.name ? { name: document.name } : {}),
      ...(document.orderId ? { orderId: document.orderId } : {}),
      ...(document.documentType ? { documentType: document.documentType } : {}),
      ...(document.category ? { category: document.category } : {}),
      ...(document.extractionStatus ? { extractionStatus: document.extractionStatus } : {}),
      ...(document.originEntityType ? { originEntityType: document.originEntityType } : {}),
      ...(document.originEntityId ? { originEntityId: document.originEntityId } : {}),
      ...(document.orderLinkedAt ? { orderLinkedAt: document.orderLinkedAt } : {}),
      ...(document.orderLinkedBy ? { orderLinkedBy: document.orderLinkedBy } : {}),
    }));
  }

  private extractPreparedContextId(payloadRef: string): string {
    const match = /^prepared-context:\/\/([^/]+)\/dispatch\//.exec(payloadRef.trim());
    if (!match?.[1]) {
      throw new Error(`Prepared payload ref '${payloadRef}' is invalid. Expected format prepared-context://<preparedContextId>/dispatch/...`);
    }

    return match[1];
  }
}
