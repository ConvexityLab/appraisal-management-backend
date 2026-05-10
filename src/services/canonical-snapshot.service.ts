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
import { mapPropertyEnrichmentToCanonical } from '../mappers/property-enrichment.mapper.js';
import {
  mergePropertyCanonical,
  pickPropertyCanonical,
} from '../mappers/property-canonical-projection.js';
import type { CanonicalReportDocument, CanonicalSubject } from '../types/canonical-schema.js';
import type { RiskTapeItem } from '../types/review-tape.types.js';
import type { VendorOrder as Order } from '../types/vendor-order.types.js';
import type { PropertyRecord, PropertyCurrentCanonicalView } from '../types/property-record.types.js';
import { OrderContextLoader, type OrderContext } from './order-context-loader.service.js';
import { PropertyObservationService } from './property-observation.service.js';
import { PropertyProjectorService } from './property-projector.service.js';

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

  private readonly contextLoader: OrderContextLoader;
  private readonly observationService: PropertyObservationService;
  private readonly projectorService: PropertyProjectorService;

  constructor(private readonly dbService: CosmosDbService) {
    this.contextLoader = new OrderContextLoader(dbService);
    this.observationService = new PropertyObservationService(dbService);
    this.projectorService = new PropertyProjectorService(dbService);
  }

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

    await this.recordSnapshotObservations(
      extractionRun,
      sourceArtifacts,
      normalizedData?.canonical ?? null,
      snapshot.id,
      now,
    );

    // Slice 8a: project property-scoped branches back to PropertyRecord.currentCanonical
    // so cross-order accumulation survives. Best-effort — failures don't block
    // the snapshot return (snapshot is the contract; property writeback is
    // observability/accumulation).
    await this.updatePropertyCurrentCanonical(
      extractionRun,
      sourceArtifacts.orderContext?.vendorOrder ?? null,
      normalizedData?.canonical ?? null,
      snapshot.id,
      now,
    );

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

    await this.recordSnapshotObservations(
      extractionRun,
      sourceArtifacts,
      normalizedData?.canonical ?? null,
      existing.id,
      now,
    );

    // Slice 8a: refresh the property's currentCanonical too, so post-Axiom
    // consolidated extraction reaches the rolling property view.
    await this.updatePropertyCurrentCanonical(
      extractionRun,
      sourceArtifacts.orderContext?.vendorOrder ?? null,
      normalizedData?.canonical ?? null,
      existing.id,
      now,
    );

    return refreshed;
  }

  private async recordSnapshotObservations(
    extractionRun: RunLedgerRecord,
    artifacts: {
      document: DocumentMetadata | null;
      extractionData: Record<string, unknown> | null;
      enrichment: PropertyEnrichmentRecord | null;
      orderContext: OrderContext | null;
      propertyCurrentCanonical: PropertyCurrentCanonicalView | null;
    },
    canonical: unknown,
    snapshotId: string,
    observedAt: string,
  ): Promise<void> {
    try {
      const db = this.dbService as unknown as {
        createDocument?: unknown;
        getDocument?: unknown;
      };
      if (typeof db.createDocument !== 'function' || typeof db.getDocument !== 'function') {
        return;
      }

      const propertyId = artifacts.orderContext?.vendorOrder.propertyId;
      if (!propertyId || !artifacts.extractionData || Object.keys(artifacts.extractionData).length === 0) {
        return;
      }

      const propertyCanonicalPatch = pickPropertyCanonical(
        canonical as Partial<CanonicalReportDocument> | null,
        {
          snapshotId,
          lastSnapshotAt: observedAt,
        },
      );

      await this.observationService.createObservation({
        tenantId: extractionRun.tenantId,
        propertyId,
        observationType: 'document-extraction',
        sourceSystem: 'document-extraction',
        observedAt,
        sourceArtifactRef: artifacts.document?.id
          ? {
              kind: 'document',
              id: artifacts.document.id,
            }
          : {
              kind: 'snapshot',
              id: snapshotId,
            },
        lineageRefs: [
          ...(artifacts.document?.id ? [{ kind: 'document' as const, id: artifacts.document.id }] : []),
          { kind: 'snapshot' as const, id: snapshotId },
          { kind: 'other' as const, id: extractionRun.id },
          ...(artifacts.enrichment?.id ? [{ kind: 'other' as const, id: artifacts.enrichment.id }] : []),
        ],
        ...(artifacts.document?.orderId ? { orderId: artifacts.document.orderId } : {}),
        ...(extractionRun.engagementId ? { engagementId: extractionRun.engagementId } : {}),
        ...(artifacts.document?.id ? { documentId: artifacts.document.id } : {}),
        snapshotId,
        sourceRecordId: extractionRun.id,
        sourceProvider: extractionRun.engine,
        ...(propertyCanonicalPatch ? { normalizedFacts: { canonicalPatch: propertyCanonicalPatch } } : {}),
        rawPayload: artifacts.extractionData,
        createdBy: extractionRun.initiatedBy,
      });
    } catch (err) {
      this.logger.warn('Snapshot: failed to record extraction observation — non-fatal', {
        runId: extractionRun.id,
        snapshotId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
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
    orderContext: OrderContext | null;
    propertyCurrentCanonical: PropertyCurrentCanonicalView | null;
  }> {
    const document = await this.getDocumentById(extractionRun.documentId, extractionRun.tenantId);
    const extractionData = this.toRecord(document?.extractedData);
    const orderId = typeof document?.orderId === 'string' && document.orderId.length > 0
      ? document.orderId
      : undefined;
    const enrichment = orderId
      ? await this.getLatestEnrichmentByOrderId(orderId, extractionRun.tenantId)
      : null;
    // Phase 7: load joined OrderContext so the canonical projection can pull
    // lender-side fields from the parent ClientOrder (their proper home post
    // Phase 4) instead of the deprecated copy on the VendorOrder row.
    const orderContext = orderId
      ? await this.getOrderContextById(orderId, extractionRun.tenantId)
      : null;
    const propertyCurrentCanonical = orderContext?.vendorOrder.propertyId
      ? await this.getPropertyCurrentCanonical(
          orderContext.vendorOrder.propertyId,
          extractionRun.tenantId,
        )
      : null;

    return {
      document,
      extractionData,
      enrichment,
      orderContext,
      propertyCurrentCanonical,
    };
  }

  /**
   * Slice 8a: read the property's accumulated `currentCanonical` view so
   * it can serve as a base layer when building this snapshot's canonical.
   * Defensive — failures here are non-fatal (returns null).
   */
  private async getPropertyCurrentCanonical(
    propertyId: string,
    tenantId: string,
  ): Promise<PropertyCurrentCanonicalView | null> {
    try {
      const result = await this.dbService.queryItems<PropertyRecord>(
        'property-records',
        `SELECT TOP 1 * FROM c WHERE c.id = @id AND c.tenantId = @tenantId`,
        [
          { name: '@id', value: propertyId },
          { name: '@tenantId', value: tenantId },
        ],
      );
      if (!result.success || !result.data?.[0]) return null;
      return result.data[0].currentCanonical ?? null;
    } catch (err) {
      this.logger.warn('Snapshot: failed to load property currentCanonical — continuing without base layer', {
        propertyId,
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private async getOrderContextById(
    orderId: string,
    tenantId: string,
  ): Promise<OrderContext | null> {
    // Phase 7: load via OrderContextLoader so we get the joined VendorOrder
    // + parent ClientOrder view. Failures here are non-fatal: snapshot
    // still builds from extraction + enrichment, just without
    // order-intake values.
    try {
      return await this.contextLoader.loadByVendorOrderId(orderId);
    } catch (err) {
      this.logger.warn('Snapshot: failed to load order context for canonical projection — continuing', {
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
      orderContext: OrderContext | null;
      propertyCurrentCanonical: PropertyCurrentCanonicalView | null;
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
    //   property-enrichment → subject (public-records, flood, geocoding)
    //   axiom-extraction    → subject, comps, appraiserInfo, reconciliation
    //   loan-tape           → loan, ratios
    //   transaction-history → transactionHistory
    //   avm                 → avmCrossCheck
    //   comp-statistics     → compStatistics (derived from canonical.comps)
    //   risk-flags          → riskFlags
    //
    // Merge order: enrichment first, then extraction on top. Extraction wins
    // for any field both sources carry, since the appraisal report is the
    // authoritative document being QC'd; enrichment is reference data that
    // fills gaps and feeds cross-check branches (e.g. avmCrossCheck).
    //
    // Sources we don't have a feed for in this code path (e.g. real loan tape
    // for single-order dispatch, AVM provider data, title report) emit
    // null-filled or omitted branches per their respective mapper rules.
    // Single-order callers may attach a partial RiskTapeItem via the run-ledger
    // record's metadata once that path is plumbed; the snapshot tolerates its
    // absence.
    const canonical: Record<string, unknown> = {};

    // Four-layer canonical projection. Each layer Object.assigns onto the
    // accumulator, so later layers override earlier ones for fields they
    // supply. The exception is extraction (layer 3): for `subject`, extraction
    // wins only on non-empty values, so earlier layers fill gaps where the
    // axiom mapper emits sentinel empty strings (e.g. county: '').
    //
    // Layer 0 (Slice 8a): propertyCurrentCanonical — property-scoped state
    //   accumulated across prior ClientOrders for the same property (last
    //   year's appraised value as a prior sale, last recorded condition,
    //   latest AVM, etc.). Least authoritative; everything from this order
    //   layers on top.
    // Layer 1: enrichment (public records, flood, geocoding) — fills gaps
    //   for fields the lender / appraiser don't supply directly.
    // Layer 2: order-intake (Order, lender-supplied facts) —
    //   overrides enrichment for fields the lender authoritatively supplies,
    //   fills more gaps for downstream review-program criteria that read
    //   canonical paths before extraction runs.
    // Layer 3: extraction (axiom output from the appraisal report) — most
    //   authoritative; overlays earlier layers but preserves their values
    //   where extraction is missing or empty (see mergePreferNonEmpty).

    // Layer 0: propertyCurrentCanonical (accumulated from prior orders).
    if (artifacts.propertyCurrentCanonical) {
      const v = artifacts.propertyCurrentCanonical;
      if (v.subject) (canonical as Partial<CanonicalReportDocument>).subject = v.subject;
      if (v.transactionHistory) (canonical as Partial<CanonicalReportDocument>).transactionHistory = v.transactionHistory;
      if (v.avmCrossCheck) (canonical as Partial<CanonicalReportDocument>).avmCrossCheck = v.avmCrossCheck;
      if (v.riskFlags) (canonical as Partial<CanonicalReportDocument>).riskFlags = v.riskFlags;
    }

    // Layer 1: enrichment.
    const enrichmentCanonical = mapPropertyEnrichmentToCanonical(
      artifacts.enrichment?.dataResult ?? null,
    );
    if (enrichmentCanonical) {
      Object.assign(canonical, enrichmentCanonical);
    }

    // Layer 2: order-intake.
    const orderCanonical = mapAppraisalOrderToCanonical(artifacts.orderContext);
    if (orderCanonical) {
      Object.assign(canonical, orderCanonical);
    }

    if (artifacts.extractionData) {
      const extractionCanonical = mapAxiomExtractionToCanonical(artifacts.extractionData);

      // Merge subject: extraction wins on non-empty fields; earlier layers
      // (enrichment + intake) preserved where extraction is missing or empty.
      const baseSubject = (canonical as Partial<CanonicalReportDocument>).subject ?? null;
      const extractSubject = extractionCanonical.subject ?? null;
      if (baseSubject || extractSubject) {
        const baseAddress = (baseSubject?.address ?? null) as Partial<CanonicalSubject['address']> | null;
        const extractAddress = (extractSubject?.address ?? null) as Partial<CanonicalSubject['address']> | null;
        const mergedAddress = baseAddress || extractAddress
          ? mergePreferNonEmpty(baseAddress ?? {}, extractAddress ?? {})
          : undefined;

        const baseSansAddress = baseSubject ? { ...baseSubject } : {};
        delete (baseSansAddress as { address?: unknown }).address;
        const extractSansAddress = extractSubject ? { ...extractSubject } : {};
        delete (extractSansAddress as { address?: unknown }).address;

        const mergedSubject: Partial<CanonicalSubject> = mergePreferNonEmpty(
          baseSansAddress as Record<string, unknown>,
          extractSansAddress as Record<string, unknown>,
        ) as Partial<CanonicalSubject>;
        if (mergedAddress) {
          mergedSubject.address = mergedAddress as unknown as CanonicalSubject['address'];
        }
        (canonical as Partial<CanonicalReportDocument>).subject = mergedSubject as CanonicalSubject;
      }

      // Copy non-subject branches from extraction directly. Earlier layers
      // don't produce these.
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

    // Slice 8k: legacy `subjectProperty` flat shim and `providerData` raw
    // blob are no longer emitted on new snapshots. Slice 8j migrated the
    // known readers (CriteriaStepInputService, PreparedDispatchPayloadAssembly)
    // to prefer the canonical view. Pre-8k snapshots continue to carry the
    // shim fields; readers handle the absent-on-new-records case via `?? {}`.
    void subjectProperty;
    void providerData;
    return {
      extraction: artifacts.extractionData ?? {},
      canonical,
      provenance: {
        extractionRunId: extractionRun.id,
        documentId: artifacts.document?.id,
        orderId: artifacts.document?.orderId,
        enrichmentId: artifacts.enrichment?.id,
        ...(extractionRun.sourceIdentity ? { sourceIdentity: extractionRun.sourceIdentity } : {}),
      },
    };
  }

  /**
   * Slice 8a: project property-scoped canonical branches back to
   * PropertyRecord.currentCanonical so cross-order accumulation works.
   *
   * Best-effort — failures here are NON-FATAL. The snapshot is the
   * authoritative per-order record (already persisted by the caller); this
   * method just feeds the rolling property view. We log structured warnings
   * but never throw.
   *
   * Resolution: needs `order.propertyId` to identify the target PropertyRecord.
   * If the order isn't loaded or doesn't carry propertyId, we log and skip
   * — there's no other reliable way to map an extraction run to a property.
   */
  private async updatePropertyCurrentCanonical(
    extractionRun: RunLedgerRecord,
    order: Order | null,
    canonical: unknown,
    snapshotId: string,
    snapshotAt: string,
  ): Promise<void> {
    if (!order?.propertyId) {
      return;
    }

    await this.projectorService.projectCurrentCanonicalFromSnapshot({
      tenantId: extractionRun.tenantId,
      propertyId: order.propertyId,
      orderId: order.id,
      ...(extractionRun.engagementId ? { engagementId: extractionRun.engagementId } : {}),
      ...(extractionRun.documentId ? { documentId: extractionRun.documentId } : {}),
      sourceRunId: extractionRun.id,
      snapshotId,
      snapshotAt,
      initiatedBy: extractionRun.initiatedBy ?? 'SYSTEM:canonical-snapshot',
      canonical: canonical as Partial<CanonicalReportDocument> | null,
    });
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}

/**
 * Merge two records preferring the second's value, but only when it is not
 * empty (null, undefined, or empty string). Used to merge enrichment-derived
 * subject fields with extraction-derived ones: extraction wins where it has
 * real values, but enrichment fills in any field extraction left empty.
 *
 * Nested objects are NOT recursively merged — callers handle nested
 * structures (e.g. address) explicitly.
 */
function mergePreferNonEmpty(
  base: Record<string, unknown>,
  preferred: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(preferred)) {
    if (v == null) continue;
    if (typeof v === 'string' && v.trim().length === 0) continue;
    out[k] = v;
  }
  return out;
}
