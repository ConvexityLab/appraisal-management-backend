import { randomUUID } from 'crypto';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { CanonicalSnapshotRecord, RunLedgerRecord } from '../types/run-ledger.types.js';
import type { DocumentMetadata } from '../types/document.types.js';
import type { PropertyDataResult } from '../types/property-data.types.js';

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

    const snapshot: CanonicalSnapshotRecord = {
      id: `snapshot_${Date.now()}_${randomUUID().slice(0, 8)}`,
      type: 'canonical-snapshot',
      tenantId: extractionRun.tenantId,
      createdAt: now,
      createdBy: extractionRun.initiatedBy,
      status: 'ready',
      ...(extractionRun.engagementId ? { engagementId: extractionRun.engagementId } : {}),
      ...(extractionRun.loanPropertyContextId ? { loanPropertyContextId: extractionRun.loanPropertyContextId } : {}),
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
  }> {
    const document = await this.getDocumentById(extractionRun.documentId, extractionRun.tenantId);
    const extractionData = this.toRecord(document?.extractedData);
    const orderId = typeof document?.orderId === 'string' && document.orderId.length > 0
      ? document.orderId
      : undefined;
    const enrichment = orderId
      ? await this.getLatestEnrichmentByOrderId(orderId, extractionRun.tenantId)
      : null;

    return {
      document,
      extractionData,
      enrichment,
    };
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

    return {
      subjectProperty,
      extraction: artifacts.extractionData ?? {},
      providerData: providerData ?? {},
      provenance: {
        extractionRunId: extractionRun.id,
        documentId: artifacts.document?.id,
        orderId: artifacts.document?.orderId,
        enrichmentId: artifacts.enrichment?.id,
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
