import { CosmosDbService } from './cosmos-db.service.js';
import { CanonicalSnapshotService } from './canonical-snapshot.service.js';
import { RunLedgerService } from './run-ledger.service.js';
import type { DocumentMetadata } from '../types/document.types.js';
import type { ReviewProgram } from '../types/review-tape.types.js';
import type { CanonicalSnapshotRecord, RunLedgerRecord } from '../types/run-ledger.types.js';
import type { AnalysisSubmissionActorContext } from '../types/analysis-submission.types.js';
import type { CanonicalComp, CanonicalReportDocument } from '@l1/shared-types';
import type { ReviewContext } from '../types/review-context.types.js';
import type { PrepareReviewProgramsRequest } from '../types/review-preparation.types.js';
import { selectPreferredReviewProgram } from '../utils/review-program-normalization.js';

interface PropertyEnrichmentRecord {
  id: string;
  type: 'property-enrichment';
  orderId: string;
  tenantId: string;
  status?: string;
  dataResult?: Record<string, unknown> | null;
  createdAt?: string;
}

export class ReviewContextAssemblyService {
  private readonly runLedgerService: RunLedgerService;
  private readonly snapshotService: CanonicalSnapshotService;

  constructor(private readonly dbService: CosmosDbService) {
    this.runLedgerService = new RunLedgerService(dbService);
    this.snapshotService = new CanonicalSnapshotService(dbService);
  }

  async assemble(
    request: PrepareReviewProgramsRequest,
    actor: AnalysisSubmissionActorContext,
  ): Promise<ReviewContext> {
    const orderResult = await this.dbService.findOrderById(request.orderId);
    if (!orderResult.success) {
      throw new Error(orderResult.error?.message ?? `Failed to load order '${request.orderId}'`);
    }

    const order = orderResult.data;
    if (!order) {
      throw new Error(`Order '${request.orderId}' not found`);
    }

    const resolvedClientId =
      request.clientId?.trim() ||
      order.clientId?.trim() ||
      ((order as any).clientInformation?.clientId as string | undefined)?.trim() ||
      undefined;
    const resolvedSubClientId =
      request.subClientId?.trim() ||
      ((order as any).subClientId as string | undefined)?.trim() ||
      ((order as any).clientInformation?.subClientId as string | undefined)?.trim() ||
      undefined;
    const resolvedEngagementId =
      request.engagementId?.trim() ||
      (typeof order.engagementId === 'string' && order.engagementId.trim().length > 0 ? order.engagementId : undefined);

    const [documents, latestEnrichment, runs, reviewPrograms] = await Promise.all([
      this.loadDocuments(request.orderId, actor.tenantId),
      this.loadLatestEnrichment(request.orderId, actor.tenantId),
      this.runLedgerService.listRuns(actor.tenantId, {
        loanPropertyContextId: request.orderId,
        limit: 100,
      }),
      this.loadReviewPrograms(request.reviewProgramIds),
    ]);
    const latestReport = await this.loadLatestReport(request.orderId, actor.tenantId);

    const extractionRuns = runs.filter((run) => run.runType === 'extraction');
    const criteriaRuns = runs.filter((run) => run.runType === 'criteria');
    const latestSnapshotRun = [...extractionRuns]
      .filter((run) => Boolean(run.canonicalSnapshotId ?? run.snapshotId))
      .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())[0];
    const latestSnapshotId = latestSnapshotRun?.canonicalSnapshotId ?? latestSnapshotRun?.snapshotId;
    const latestSnapshot = latestSnapshotId
      ? await this.snapshotService.getSnapshotById(latestSnapshotId, actor.tenantId)
      : null;

    const warnings: string[] = [];
    const missingProgramIds = request.reviewProgramIds.filter((id) => !reviewPrograms.some((program) => program.id === id));
    if (missingProgramIds.length > 0) {
      warnings.push(`Requested review programs were not found: ${missingProgramIds.join(', ')}`);
    }
    if (!resolvedClientId) {
      warnings.push('Order clientId could not be resolved during preparation.');
    }
    if (!resolvedSubClientId) {
      warnings.push('Order subClientId could not be resolved during preparation.');
    }

    const adjustmentSummary = latestReport ? this.buildAdjustmentSummary(latestReport.comps) : undefined;

    return {
      identity: {
        orderId: request.orderId,
        tenantId: actor.tenantId,
        ...(resolvedEngagementId ? { engagementId: resolvedEngagementId } : {}),
        ...(resolvedClientId ? { clientId: resolvedClientId } : {}),
        ...(resolvedSubClientId ? { subClientId: resolvedSubClientId } : {}),
        ...((order as any).metadata?.sourceIdentity ? { sourceIdentity: (order as any).metadata.sourceIdentity } : {}),
      },
      order,
      ...(latestSnapshot?.normalizedData
        ? {
            canonicalData: {
              // `canonical` is the UAD/MISMO-aligned projection — the
              // preferred view per slice 8j and the one whose paths line
              // up with Axiom criteria's `dataRequirements.fieldRef.path`
              // (e.g. `subject.taxYear`). Earlier this destructure only
              // copied subjectProperty/extraction/providerData/provenance,
              // silently dropping canonical — the envelope assembler then
              // had no canonical bucket to publish, so every Axiom
              // criterion resolved to `cannot_evaluate` (surfaced by the
              // full-pipeline live-fire on 2026-05-11).
              ...((latestSnapshot.normalizedData as { canonical?: Record<string, unknown> }).canonical
                ? { canonical: (latestSnapshot.normalizedData as { canonical?: Record<string, unknown> }).canonical }
                : {}),
              ...(latestSnapshot.normalizedData.subjectProperty
                ? { subjectProperty: latestSnapshot.normalizedData.subjectProperty }
                : {}),
              ...(latestSnapshot.normalizedData.extraction
                ? { extraction: latestSnapshot.normalizedData.extraction }
                : {}),
              ...(latestSnapshot.normalizedData.providerData
                ? { providerData: latestSnapshot.normalizedData.providerData }
                : {}),
              ...(latestSnapshot.normalizedData.provenance
                ? { provenance: latestSnapshot.normalizedData.provenance }
                : {}),
            },
          }
        : {}),
      reviewPrograms,
      documents: documents.map((document) => ({
        id: document.id,
        name: document.name,
        ...(document.orderId ? { orderId: document.orderId } : {}),
        ...(document.category ? { category: document.category } : {}),
        ...(document.documentType ? { documentType: document.documentType } : {}),
        ...(document.extractionStatus ? { extractionStatus: document.extractionStatus } : {}),
        ...(document.uploadedAt ? { uploadedAt: new Date(document.uploadedAt).toISOString() } : {}),
        ...(document.entityType ? { originEntityType: document.entityType } : {}),
        ...(document.entityId ? { originEntityId: document.entityId } : {}),
        ...(document.orderLinkedAt ? { orderLinkedAt: new Date(document.orderLinkedAt).toISOString() } : {}),
        ...(document.orderLinkedBy ? { orderLinkedBy: document.orderLinkedBy } : {}),
      })),
      ...(latestEnrichment
        ? {
            latestEnrichment: {
              id: latestEnrichment.id,
              ...(latestEnrichment.status ? { status: latestEnrichment.status } : {}),
              ...(latestEnrichment.createdAt ? { createdAt: latestEnrichment.createdAt } : {}),
              hasDataResult: Boolean(latestEnrichment.dataResult),
            },
          }
        : {}),
      ...(latestSnapshot
        ? {
            latestSnapshot: {
              id: latestSnapshot.id,
              createdAt: latestSnapshot.createdAt,
              ...(latestSnapshot.refreshedAt ? { refreshedAt: latestSnapshot.refreshedAt } : {}),
              hasNormalizedData: Boolean(latestSnapshot.normalizedData),
              ...(latestSnapshot.sourceIdentity ? { sourceIdentity: latestSnapshot.sourceIdentity } : {}),
              availableDataPaths: this.collectAvailableDataPaths(latestSnapshot),
              availableDataPathsBySource: this.collectAvailableDataPathsBySource(latestSnapshot),
            },
          }
        : {}),
      ...(latestReport
        ? {
            latestReport: {
              reportId: latestReport.reportId,
              ...(latestReport.reportType ? { reportType: latestReport.reportType } : {}),
              ...(latestReport.status ? { status: latestReport.status } : {}),
              ...(latestReport.schemaVersion ? { schemaVersion: latestReport.schemaVersion } : {}),
              ...(latestReport.updatedAt ? { updatedAt: latestReport.updatedAt } : {}),
              subjectPresent: Boolean(latestReport.subject),
              totalComps: latestReport.comps.length,
              selectedCompCount: latestReport.comps.filter((comp) => comp.selected).length,
              adjustedCompCount: latestReport.comps.filter((comp) => comp.adjustments != null).length,
            },
            compSummary: this.buildCompSummary(latestReport.comps),
            ...(adjustmentSummary ? { adjustmentSummary } : {}),
          }
        : {}),
      runs,
      runSummary: {
        totalRuns: runs.length,
        extractionRuns: extractionRuns.length,
        criteriaRuns: criteriaRuns.length,
        ...(latestSnapshotId ? { latestSnapshotId } : {}),
      },
      evidenceRefs: [
        { sourceType: 'order', sourceId: request.orderId },
        ...documents.map((document) => ({ sourceType: 'document' as const, sourceId: document.id })),
        ...(latestEnrichment ? [{ sourceType: 'property-enrichment' as const, sourceId: latestEnrichment.id }] : []),
        ...(latestReport
          ? [
              { sourceType: 'report' as const, sourceId: latestReport.id },
              ...latestReport.comps
                .filter((comp) => comp.selected)
                .map((comp) => ({ sourceType: 'report-comp' as const, sourceId: comp.compId })),
              ...latestReport.comps
                .filter((comp) => comp.adjustments != null)
                .map((comp) => ({ sourceType: 'report-adjustment' as const, sourceId: `${comp.compId}-adjustments` })),
            ]
          : []),
        ...runs.map((run) => ({ sourceType: 'run-ledger' as const, sourceId: run.id })),
      ],
      warnings,
      assembledAt: new Date().toISOString(),
      assembledBy: actor.initiatedBy,
      contextVersion: `review-context:${request.orderId}:${Date.now()}`,
    };
  }

  private async loadDocuments(orderId: string, tenantId: string): Promise<DocumentMetadata[]> {
    const result = await this.dbService.queryItems<DocumentMetadata>(
      'documents',
      'SELECT * FROM c WHERE c.orderId = @orderId AND c.tenantId = @tenantId ORDER BY c.uploadedAt DESC',
      [
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success) {
      throw new Error(
        `Failed to load review-context documents for order '${orderId}' and tenant '${tenantId}': ${result.error?.message ?? 'query failed'}`,
      );
    }

    if (!result.data) {
      return [];
    }

    return result.data;
  }

  private async loadLatestEnrichment(orderId: string, tenantId: string): Promise<PropertyEnrichmentRecord | null> {
    const result = await this.dbService.queryItems<PropertyEnrichmentRecord>(
      'property-enrichments',
      'SELECT TOP 1 * FROM c WHERE c.type = @type AND c.orderId = @orderId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC',
      [
        { name: '@type', value: 'property-enrichment' },
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success) {
      throw new Error(
        `Failed to load review-context enrichment for order '${orderId}' and tenant '${tenantId}': ${result.error?.message ?? 'query failed'}`,
      );
    }

    if (!result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  private async loadReviewPrograms(reviewProgramIds: string[]): Promise<ReviewProgram[]> {
    if (reviewProgramIds.length === 0) {
      return [];
    }

    const container = this.dbService.getReviewProgramsContainer();
    const { resources } = await container.items
      .query<ReviewProgram>({
        query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)',
        parameters: [{ name: '@ids', value: reviewProgramIds }],
      })
      .fetchAll();

    return reviewProgramIds
      .map((reviewProgramId) => selectPreferredReviewProgram(
        resources.filter((program) => program.id === reviewProgramId),
      ))
      .filter((program): program is ReviewProgram => Boolean(program));
  }

  private async loadLatestReport(orderId: string, tenantId: string): Promise<CanonicalReportDocument | null> {
    const result = await this.dbService.queryItems<CanonicalReportDocument>(
      'reporting',
      `
        SELECT TOP 1 * FROM c
        WHERE c.orderId = @orderId
          AND (NOT IS_DEFINED(c.tenantId) OR c.tenantId = @tenantId)
        ORDER BY c.updatedAt DESC
      `,
      [
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success) {
      throw new Error(
        `Failed to load review-context report for order '${orderId}' and tenant '${tenantId}': ${result.error?.message ?? 'query failed'}`,
      );
    }

    if (!result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  private buildCompSummary(comps: CanonicalComp[]): NonNullable<ReviewContext['compSummary']> {
    const selectedComps = comps.filter((comp) => comp.selected);
    const compsWithAdjustments = comps.filter((comp) => comp.adjustments != null);

    return {
      totalComps: comps.length,
      selectedCompCount: selectedComps.length,
      candidateCompCount: comps.filter((comp) => !comp.selected).length,
      adjustedCompCount: compsWithAdjustments.length,
      selectedCompIds: selectedComps.map((comp) => comp.compId),
      compIdsWithAdjustments: compsWithAdjustments.map((comp) => comp.compId),
      hasCompSelection: selectedComps.length > 0,
      hasAdjustments: compsWithAdjustments.length > 0,
    };
  }

  private buildAdjustmentSummary(comps: CanonicalComp[]): NonNullable<ReviewContext['adjustmentSummary']> | undefined {
    const compsWithAdjustments = comps.filter((comp): comp is CanonicalComp & { adjustments: NonNullable<CanonicalComp['adjustments']> } => comp.adjustments != null);
    if (compsWithAdjustments.length === 0) {
      return undefined;
    }

    const netAdjustmentPcts = compsWithAdjustments
      .map((comp) => comp.adjustments.netAdjustmentPct)
      .filter((value): value is number => typeof value === 'number');
    const grossAdjustmentPcts = compsWithAdjustments
      .map((comp) => comp.adjustments.grossAdjustmentPct)
      .filter((value): value is number => typeof value === 'number');

    return {
      adjustedCompCount: compsWithAdjustments.length,
      ...(netAdjustmentPcts.length > 0
        ? {
            averageNetAdjustmentPct: this.average(netAdjustmentPcts),
            maxNetAdjustmentPct: Math.max(...netAdjustmentPcts),
          }
        : {}),
      ...(grossAdjustmentPcts.length > 0
        ? {
            averageGrossAdjustmentPct: this.average(grossAdjustmentPcts),
            maxGrossAdjustmentPct: Math.max(...grossAdjustmentPcts),
          }
        : {}),
    };
  }

  private average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private collectAvailableDataPaths(snapshot: CanonicalSnapshotRecord): string[] {
    const pathSet = new Set<string>();
    const roots = Object.values(this.collectAvailableDataPathsBySource(snapshot));

    for (const root of roots) {
      for (const path of root) {
        // Strip ALL known bucket prefixes (canonical / subjectProperty /
        // extraction / providerData / provenance) so consumers checking
        // "do we have `subject.X`?" find it regardless of which bucket
        // the snapshot stored it in. Earlier this regex omitted
        // `canonical`, leaving `canonical.subject.taxYear` un-normalized
        // in the path set — same class of bug as the canonicalData
        // destructure omission in this file (see f12fc18).
        const normalized = path.replace(/^(canonical|subjectProperty|extraction|providerData|provenance)\./, '');
        if (normalized.length > 0) {
          pathSet.add(normalized);
        }
      }
    }

    return [...pathSet].sort();
  }

  private collectAvailableDataPathsBySource(snapshot: CanonicalSnapshotRecord): {
    subjectProperty: string[];
    extraction: string[];
    canonical: string[];
    providerData: string[];
    provenance: string[];
  } {
    const result = {
      subjectProperty: [] as string[],
      extraction: [] as string[],
      canonical: [] as string[],
      providerData: [] as string[],
      provenance: [] as string[],
    };

    this.walkObject(snapshot.normalizedData?.subjectProperty, 'subjectProperty', new Set<string>(result.subjectProperty));
    result.subjectProperty = this.collectPaths(snapshot.normalizedData?.subjectProperty, 'subjectProperty');
    result.extraction = this.collectPaths(snapshot.normalizedData?.extraction, 'extraction');
    result.canonical = this.collectPaths(snapshot.normalizedData?.canonical, 'canonical');
    result.providerData = this.collectPaths(snapshot.normalizedData?.providerData, 'providerData');
    result.provenance = this.collectPaths(snapshot.normalizedData?.provenance, 'provenance');

    return result;
  }

  private collectPaths(value: unknown, prefix: string): string[] {
    const pathSet = new Set<string>();
    this.walkObject(value, prefix, pathSet);
    return [...pathSet].sort();
  }

  private walkObject(value: unknown, prefix: string, pathSet: Set<string>): void {
    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.walkObject(item, prefix, pathSet);
      }
      return;
    }

    if (typeof value !== 'object') {
      if (prefix) {
        pathSet.add(prefix);
      }
      return;
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      pathSet.add(nextPrefix);
      this.walkObject(child, nextPrefix, pathSet);
    }
  }
}
