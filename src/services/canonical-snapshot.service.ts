import { randomUUID } from 'crypto';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { CanonicalSnapshotRecord, RunLedgerRecord } from '../types/run-ledger.types.js';
import type { DocumentMetadata } from '../types/document.types.js';
import type { PropertyDataResult } from '../types/property-data.types.js';
import { extendIntakeSourceIdentity } from '../types/intake-source.types.js';
import { mapAxiomExtractionToCanonical } from '../mappers/axiom-extraction.mapper.js';
import { mapLoanFromTape, computeLoanRatios } from '../mappers/loan-tape.mapper.js';
import { mapTransactionHistoryFromTape } from '../mappers/transaction-history.mapper.js';
import { mapAvmCrossCheckFromTape } from '../mappers/avm.mapper.js';
import { computeCompStatistics } from '../mappers/comp-statistics.mapper.js';
import { mapRiskFlagsFromTape } from '../mappers/risk-flags.mapper.js';
import { validateCanonicalIngress } from '../utils/validate-canonical-ingress.js';
import { mapAppraisalOrderToCanonical } from '../mappers/appraisal-order.mapper.js';
import type { CanonicalReportDocument, CanonicalSubject } from '../types/canonical-schema.js';
import type { RiskTapeItem } from '../types/review-tape.types.js';
import type { AppraisalOrder } from '../types/index.js';

interface PropertyEnrichmentRecord {
  id: string;
  type: 'property-enrichment';
  orderId: string;
  tenantId: string;
  dataResult: PropertyDataResult | null;
  createdAt: string;
}

export class CanonicalSnapshotService {
  private readonly logger = new Logger('CanonicalSnapshotService');
  private readonly runContainerName = 'aiInsights';
  private readonly documentContainerName = 'documents';
  private readonly enrichmentContainerName = 'property-enrichments';

  constructor(private readonly dbService: CosmosDbService) {}

  async createFromExtractionRun(extractionRun: RunLedgerRecord): Promise<CanonicalSnapshotRecord> {
    if (extractionRun.runType !== 'extraction') {
      throw new Error(`createFromExtractionRun requires an extraction run. Got '${extractionRun.runType}'`);
    }

    const now = new Date().toISOString();
    const sourceArtifacts = await this.loadSourceArtifacts(extractionRun);

    const sourceRefs: CanonicalSnapshotRecord['sourceRefs'] = [
      {
        sourceType: 'document-extraction',
        sourceId: extractionRun.documentId ?? extractionRun.id,
        sourceRunId: extractionRun.id,
      },
    ];

    if (sourceArtifacts.enrichment?.id) {
      sourceRefs.push({
        sourceType: 'property-enrichment',
        sourceId: sourceArtifacts.enrichment.id,
      });
    }

    const normalizedData = this.buildNormalizedData(extractionRun, sourceArtifacts);
    const sourceIdentity = extendIntakeSourceIdentity(
      extractionRun.sourceIdentity ?? sourceArtifacts.document?.sourceIdentity,
      {
        ...(sourceArtifacts.document?.orderId ? { orderId: sourceArtifacts.document.orderId } : {}),
        ...(sourceArtifacts.document?.id ? { documentId: sourceArtifacts.document.id } : {}),
      },
    );

    const snapshot: CanonicalSnapshotRecord = {
      id: `snapshot_${Date.now()}_${randomUUID().slice(0, 8)}`,
      type: 'canonical-snapshot',
      tenantId: extractionRun.tenantId,
      createdAt: now,
      createdBy: extractionRun.initiatedBy,
      status: 'ready',
      ...(extractionRun.engagementId ? { engagementId: extractionRun.engagementId } : {}),
      ...(extractionRun.loanPropertyContextId ? { loanPropertyContextId: extractionRun.loanPropertyContextId } : {}),
      ...(sourceIdentity ? { sourceIdentity } : {}),
      sourceRefs,
      normalizedDataRef: `canonical://${extractionRun.tenantId}/${extractionRun.id}/normalized-data`,
      createdByRunIds: [extractionRun.id],
      ...(normalizedData ? { normalizedData } : {}),
    };

    const saveResult = await this.dbService.upsertItem<CanonicalSnapshotRecord>(this.runContainerName, snapshot);
    if (!saveResult.success) {
      throw new Error(
        `Failed to persist canonical snapshot '${snapshot.id}': ${saveResult.error?.message ?? 'Unknown error'}`,
      );
    }

    this.logger.info('Canonical snapshot created from extraction run', {
      snapshotId: snapshot.id,
      extractionRunId: extractionRun.id,
      tenantId: extractionRun.tenantId,
      hasExtraction: Boolean(sourceArtifacts.extractionData),
      hasEnrichment: Boolean(sourceArtifacts.enrichment),
    });

    return snapshot;
  }

  /**
   * A-13: Refresh a canonical snapshot after Axiom has completed and written
   * consolidated data back to `documents.extractedData`. Rebuilds `normalizedData`
   * from the current document + latest enrichment so downstream reports read
   * post-Axiom data, not the submit-time extraction snapshot.
   *
   * Idempotent: locating the snapshot first; silently no-op if it was deleted.
   */
  async refreshFromExtractionRun(extractionRun: RunLedgerRecord): Promise<CanonicalSnapshotRecord | null> {
    if (extractionRun.runType !== 'extraction') {
      this.logger.warn('refreshFromExtractionRun: non-extraction run — skipping', {
        runId: extractionRun.id,
        runType: extractionRun.runType,
      });
      return null;
    }
    if (!extractionRun.canonicalSnapshotId) {
      this.logger.info('refreshFromExtractionRun: no snapshot linked to run — nothing to refresh', {
        runId: extractionRun.id,
      });
      return null;
    }

    const existing = await this.getSnapshotById(extractionRun.canonicalSnapshotId, extractionRun.tenantId);
    if (!existing) {
      this.logger.warn('refreshFromExtractionRun: snapshot not found — skipping', {
        runId: extractionRun.id,
        snapshotId: extractionRun.canonicalSnapshotId,
      });
      return null;
    }

    const now = new Date().toISOString();
    const sourceArtifacts = await this.loadSourceArtifacts(extractionRun);
    const normalizedData = this.buildNormalizedData(extractionRun, sourceArtifacts);
    const sourceIdentity = extendIntakeSourceIdentity(
      extractionRun.sourceIdentity ?? sourceArtifacts.document?.sourceIdentity ?? existing.sourceIdentity,
      {
        ...(sourceArtifacts.document?.orderId ? { orderId: sourceArtifacts.document.orderId } : {}),
        ...(sourceArtifacts.document?.id ? { documentId: sourceArtifacts.document.id } : {}),
      },
    );

    const refreshed: CanonicalSnapshotRecord = {
      ...existing,
      status: 'ready',
      ...(normalizedData ? { normalizedData } : {}),
      refreshedAt: now,
      ...(sourceIdentity ? { sourceIdentity } : {}),
    } as CanonicalSnapshotRecord;

    const saveResult = await this.dbService.upsertItem<CanonicalSnapshotRecord>(this.runContainerName, refreshed);
    if (!saveResult.success) {
      this.logger.error('refreshFromExtractionRun: upsert failed — non-fatal', {
        snapshotId: existing.id,
        error: saveResult.error?.message,
      });
      return null;
    }

    this.logger.info('Canonical snapshot refreshed post-Axiom', {
      snapshotId: existing.id,
      runId: extractionRun.id,
      hasExtraction: Boolean(sourceArtifacts.extractionData),
      hasEnrichment: Boolean(sourceArtifacts.enrichment),
    });
    return refreshed;
  }

  async getSnapshotById(snapshotId: string, tenantId: string): Promise<CanonicalSnapshotRecord | null> {
    const query = `
      SELECT TOP 1 * FROM c
      WHERE c.type = @type AND c.id = @id AND c.tenantId = @tenantId`;

    const result = await this.dbService.queryItems<CanonicalSnapshotRecord>(this.runContainerName, query, [
      { name: '@type', value: 'canonical-snapshot' },
      { name: '@id', value: snapshotId },
      { name: '@tenantId', value: tenantId },
    ]);

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  private async loadSourceArtifacts(extractionRun: RunLedgerRecord): Promise<{
    document: DocumentMetadata | null;
    extractionData: Record<string, unknown> | null;
    enrichment: PropertyEnrichmentRecord | null;
    order: AppraisalOrder | null;
  }> {
    const document = await this.getDocumentById(extractionRun.documentId, extractionRun.tenantId);
    const extractionData = this.toRecord(document?.extractedData);
    const orderId = typeof document?.orderId === 'string' && document.orderId.length > 0
      ? document.orderId
      : undefined;
    const enrichment = orderId
      ? await this.getLatestEnrichmentByOrderId(orderId, extractionRun.tenantId)
      : null;
    const order = orderId
      ? await this.getOrderById(orderId, extractionRun.tenantId)
      : null;

    return {
      document,
      extractionData,
      enrichment,
      order,
    };
  }

  private async getOrderById(
    orderId: string,
    tenantId: string,
  ): Promise<AppraisalOrder | null> {
    // Orders live in the 'orders' container per the rest of the codebase. We
    // load defensively — failures here are non-fatal: snapshot still builds
    // from extraction + enrichment, just without order-intake values.
    try {
      const result = await this.dbService.queryItems<AppraisalOrder>(
        'orders',
        `SELECT TOP 1 * FROM c WHERE c.id = @id AND c.tenantId = @tenantId`,
        [
          { name: '@id', value: orderId },
          { name: '@tenantId', value: tenantId },
        ],
      );
      if (!result.success || !result.data || result.data.length === 0) {
        return null;
      }
      return result.data[0] ?? null;
    } catch (err) {
      this.logger.warn('Snapshot: failed to load order for canonical projection — continuing', {
        orderId,
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private async getDocumentById(
    documentId: string | undefined,
    tenantId: string,
  ): Promise<DocumentMetadata | null> {
    if (!documentId) return null;

    const query = `
      SELECT TOP 1 * FROM c
      WHERE c.id = @id AND c.tenantId = @tenantId
    `;

    const result = await this.dbService.queryItems<DocumentMetadata>(this.documentContainerName, query, [
      { name: '@id', value: documentId },
      { name: '@tenantId', value: tenantId },
    ]);

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  private async getLatestEnrichmentByOrderId(
    orderId: string,
    tenantId: string,
  ): Promise<PropertyEnrichmentRecord | null> {
    const query = `
      SELECT TOP 1 * FROM c
      WHERE c.type = @type AND c.orderId = @orderId AND c.tenantId = @tenantId
      ORDER BY c.createdAt DESC
    `;

    const result = await this.dbService.queryItems<PropertyEnrichmentRecord>(
      this.enrichmentContainerName,
      query,
      [
        { name: '@type', value: 'property-enrichment' },
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  private buildNormalizedData(
    extractionRun: RunLedgerRecord,
    artifacts: {
      document: DocumentMetadata | null;
      extractionData: Record<string, unknown> | null;
      enrichment: PropertyEnrichmentRecord | null;
      order: AppraisalOrder | null;
    },
  ): CanonicalSnapshotRecord['normalizedData'] {
    const providerData = artifacts.enrichment?.dataResult
      ? this.toRecord(artifacts.enrichment.dataResult as unknown)
      : null;

    const subjectProperty = {
      ...(providerData?.['core'] && typeof providerData['core'] === 'object'
        ? (providerData['core'] as Record<string, unknown>)
        : {}),
      ...(providerData?.['publicRecord'] && typeof providerData['publicRecord'] === 'object'
        ? (providerData['publicRecord'] as Record<string, unknown>)
        : {}),
      ...(providerData?.['flood'] && typeof providerData['flood'] === 'object'
        ? (providerData['flood'] as Record<string, unknown>)
        : {}),
    };

    // Project all known sources onto the AMP canonical-schema shape (UAD 3.6 /
    // URAR / MISMO 3.4 aligned). This is the source-of-truth shape for
    // review-program data; the resolver prefers `canonical` over `extraction`
    // when both have a path. See src/mappers/.
    //
    // Mappers invoked:
    //   axiom-extraction → subject, comps, appraiserInfo, reconciliation
    //   loan-tape        → loan, ratios
    //   transaction-history → transactionHistory
    //   avm              → avmCrossCheck
    //   comp-statistics  → compStatistics (derived from canonical.comps)
    //   risk-flags       → riskFlags
    //
    // Sources we don't have a feed for in this code path (e.g. real loan tape
    // for single-order dispatch, AVM provider data, title report) emit
    // null-filled or omitted branches per their respective mapper rules.
    // Single-order callers may attach a partial RiskTapeItem via the run-ledger
    // record's metadata once that path is plumbed; the snapshot tolerates its
    // absence.
    const canonical: Record<string, unknown> = {};

    // Order-intake projection: AppraisalOrder fields land in canonical at
    // intake time so review-program criteria can read canonical paths even
    // before extraction runs. Extraction merges on top below — extraction is
    // the authoritative document being QC'd; intake is reference data that
    // fills gaps. Merge happens via Object.assign after extraction so
    // extraction wins on overlap.
    const orderCanonical = mapAppraisalOrderToCanonical(artifacts.order);
    if (orderCanonical) {
      Object.assign(canonical, orderCanonical);
    }

    if (artifacts.extractionData) {
      const extractionCanonical = mapAxiomExtractionToCanonical(artifacts.extractionData);
      // Merge: extraction overlays intake, but per-branch deep merge for
      // subject so intake-only fields (parcelNumber, condition, etc.) survive
      // when extraction emits its own subject without those fields.
      const intakeSubject = (canonical as Partial<CanonicalReportDocument>).subject;
      const extractSubject = extractionCanonical.subject;
      if (intakeSubject && extractSubject) {
        (canonical as Partial<CanonicalReportDocument>).subject = {
          ...intakeSubject,
          ...extractSubject,
        };
        // Address: deep-merge field-by-field, dropping empty-string sentinels
        // from extraction (axiom mapper emits county: '' when missing — that
        // would clobber a real intake county).
        const intakeAddress = intakeSubject.address;
        const extractAddress = extractSubject.address;
        if (intakeAddress || extractAddress) {
          const merged: Record<string, unknown> = { ...(intakeAddress ?? {}) };
          for (const [k, v] of Object.entries(extractAddress ?? {})) {
            if (v == null) continue;
            if (typeof v === 'string' && v.trim().length === 0) continue;
            merged[k] = v;
          }
          (canonical as Partial<CanonicalReportDocument>).subject = {
            ...((canonical as Partial<CanonicalReportDocument>).subject ?? {}),
            address: merged as unknown as CanonicalSubject['address'],
          } as CanonicalSubject;
        }
      } else {
        // No overlap — simple assign for non-subject branches.
        for (const [k, v] of Object.entries(extractionCanonical)) {
          (canonical as Record<string, unknown>)[k] = v;
        }
      }

      // Non-subject branches always copy from extraction (no overlap with
      // order-intake here — intake only emits subject/loan/ratios).
      for (const [k, v] of Object.entries(extractionCanonical)) {
        if (k === 'subject') continue;
        (canonical as Record<string, unknown>)[k] = v;
      }
    }

    // Loan / ratios. Today the source is either a RiskTapeItem on the
    // run-ledger metadata (bulk-portfolio path) or null (single-order path
    // until loan data is plumbed). The mapper produces all-null branches when
    // there's no source — avoid emitting empty branches in that case.
    const tape: Partial<RiskTapeItem> | null =
      (extractionRun.statusDetails?.['riskTapeItem'] as Partial<RiskTapeItem> | undefined)
      ?? null;
    if (tape) {
      const loan = mapLoanFromTape(tape);
      if (loan) (canonical as Partial<CanonicalReportDocument>).loan = loan;
      const subjectFromCanonical = (canonical as Partial<CanonicalReportDocument>).subject;
      const appraisedValue =
        (canonical as Partial<CanonicalReportDocument>).reconciliation?.finalOpinionOfValue
        ?? (canonical as Partial<CanonicalReportDocument>).valuation?.estimatedValue
        ?? null;
      const ratios = computeLoanRatios(loan, appraisedValue, tape);
      if (ratios) (canonical as Partial<CanonicalReportDocument>).ratios = ratios;

      const txHistory = mapTransactionHistoryFromTape({
        tape,
        appraisedValue,
        effectiveDate:
          (canonical as Partial<CanonicalReportDocument>).reconciliation?.effectiveDate ?? null,
      });
      if (txHistory) (canonical as Partial<CanonicalReportDocument>).transactionHistory = txHistory;

      const avmCrossCheck = mapAvmCrossCheckFromTape({
        tape,
        appraisedValue,
        avmProviderData: null,  // hook up when AVM provider data is plumbed
      });
      if (avmCrossCheck) (canonical as Partial<CanonicalReportDocument>).avmCrossCheck = avmCrossCheck;

      const riskFlags = mapRiskFlagsFromTape({ tape });
      if (riskFlags) (canonical as Partial<CanonicalReportDocument>).riskFlags = riskFlags;

      void subjectFromCanonical; // reserved for future cross-source enrichment
    }

    // Comp statistics — pure derivation from canonical.comps, no external
    // source needed. Always run when there are comps.
    const compsForStats = (canonical as Partial<CanonicalReportDocument>).comps;
    if (Array.isArray(compsForStats) && compsForStats.length > 0) {
      const compStats = computeCompStatistics(compsForStats);
      if (compStats) (canonical as Partial<CanonicalReportDocument>).compStatistics = compStats;
    }

    // Strict-canonical-ingress validation. Runs after all mappers + the merge
    // produced the candidate canonical fragment. Logs structured warnings when
    // a high-leverage branch (address / loan / ratios / riskFlags) drifted —
    // the snapshot still persists. This is observability into mapper bugs;
    // the per-source upstream adapters already strict-validate at the wire
    // boundary.
    const ingressValidation = validateCanonicalIngress(canonical as Partial<CanonicalReportDocument>);
    if (!ingressValidation.ok) {
      this.logger.warn('Canonical ingress validation: drift detected', {
        runId: extractionRun.id,
        tenantId: extractionRun.tenantId,
        issueCount: ingressValidation.issues.length,
        issues: ingressValidation.issues.slice(0, 10),
        branchesChecked: ingressValidation.branchesChecked,
      });
    }

    return {
      subjectProperty,
      extraction: artifacts.extractionData ?? {},
      canonical,
      providerData: providerData ?? {},
      provenance: {
        extractionRunId: extractionRun.id,
        documentId: artifacts.document?.id,
        orderId: artifacts.document?.orderId,
        enrichmentId: artifacts.enrichment?.id,
        ...(extractionRun.sourceIdentity ? { sourceIdentity: extractionRun.sourceIdentity } : {}),
      },
    };
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
