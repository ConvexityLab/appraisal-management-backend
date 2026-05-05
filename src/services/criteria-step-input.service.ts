import { randomUUID } from 'crypto';
import { CosmosDbService } from './cosmos-db.service.js';
import {
  CanonicalSnapshotRecord,
  CriteriaStepEvidenceRef,
  CriteriaStepInputSliceRecord,
  RunLedgerRecord,
} from '../types/run-ledger.types.js';

export class CriteriaStepInputService {
  private readonly containerName = 'aiInsights';

  constructor(private readonly dbService: CosmosDbService) {}

  async createStepInputSlice(params: {
    tenantId: string;
    initiatedBy: string;
    criteriaRun: RunLedgerRecord;
    stepRun: RunLedgerRecord;
    snapshot: CanonicalSnapshotRecord;
  }): Promise<CriteriaStepInputSliceRecord> {
    const now = new Date().toISOString();
    const payload = this.buildPayloadForStep(params.snapshot, params.stepRun.stepKey ?? 'unknown-step');
    const evidenceRefs = this.buildEvidenceRefs(params.snapshot);

    const record: CriteriaStepInputSliceRecord = {
      id: `step_input_${Date.now()}_${randomUUID().slice(0, 8)}`,
      type: 'criteria-step-input-slice',
      tenantId: params.tenantId,
      createdAt: now,
      createdBy: params.initiatedBy,
      snapshotId: params.snapshot.id,
      criteriaRunId: params.criteriaRun.id,
      stepRunId: params.stepRun.id,
      stepKey: params.stepRun.stepKey ?? 'unknown-step',
      payloadRef: `step-input://${params.tenantId}/${params.stepRun.id}`,
      payload,
      evidenceRefs,
    };

    const persisted = await this.dbService.upsertItem<CriteriaStepInputSliceRecord>(this.containerName, record);
    if (!persisted.success) {
      throw new Error(
        `Failed to persist criteria step input slice '${record.id}': ${persisted.error?.message ?? 'Unknown error'}`,
      );
    }

    return record;
  }

  async getStepInputSliceById(
    stepInputSliceId: string,
    tenantId: string,
  ): Promise<CriteriaStepInputSliceRecord | null> {
    const query = `
      SELECT TOP 1 * FROM c
      WHERE c.type = @type AND c.id = @id AND c.tenantId = @tenantId`;

    const result = await this.dbService.queryItems<CriteriaStepInputSliceRecord>(this.containerName, query, [
      { name: '@type', value: 'criteria-step-input-slice' },
      { name: '@id', value: stepInputSliceId },
      { name: '@tenantId', value: tenantId },
    ]);

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  async getLatestStepInputSliceForRun(
    stepRunId: string,
    tenantId: string,
  ): Promise<CriteriaStepInputSliceRecord | null> {
    const query = `
      SELECT TOP 1 * FROM c
      WHERE c.type = @type AND c.stepRunId = @stepRunId AND c.tenantId = @tenantId
      ORDER BY c.createdAt DESC`;

    const result = await this.dbService.queryItems<CriteriaStepInputSliceRecord>(this.containerName, query, [
      { name: '@type', value: 'criteria-step-input-slice' },
      { name: '@stepRunId', value: stepRunId },
      { name: '@tenantId', value: tenantId },
    ]);

    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }

    return result.data[0] ?? null;
  }

  private buildPayloadForStep(
    snapshot: CanonicalSnapshotRecord,
    stepKey: string,
  ): Record<string, unknown> {
    const stepKeyMapJson = process.env.RUN_CRITERIA_STEP_INPUT_PATHS_JSON;
    // Slice 8j: prefer the canonical view (the one true shape) over the
    // legacy parallel shims. `subjectProperty` and `providerData` remain
    // populated for now so any stragglers continue working; final removal
    // is slice 8k.
    const normalized = snapshot.normalizedData ?? {};
    const defaultPayload = {
      stepKey,
      snapshotId: snapshot.id,
      canonical: (normalized as { canonical?: unknown }).canonical ?? {},
      extraction: normalized.extraction ?? {},
      provenance: normalized.provenance ?? {},
      // @deprecated — read from `canonical.subject` instead. Retained until slice 8k.
      subjectProperty: normalized.subjectProperty ?? {},
      // @deprecated — raw provider blob; consume `canonical.subject` (enrichment
      // already projected) or fetch the property-enrichment record directly.
      providerData: normalized.providerData ?? {},
    };

    if (!stepKeyMapJson) {
      return defaultPayload;
    }

    let parsed: Record<string, string[]>;
    try {
      parsed = JSON.parse(stepKeyMapJson) as Record<string, string[]>;
    } catch {
      throw new Error('RUN_CRITERIA_STEP_INPUT_PATHS_JSON must be valid JSON map of stepKey to payload field list');
    }

    const selectedFields = parsed[stepKey];
    if (!selectedFields || selectedFields.length === 0) {
      return defaultPayload;
    }

    const sliced: Record<string, unknown> = {
      stepKey,
      snapshotId: snapshot.id,
    };

    for (const key of selectedFields) {
      if (key in defaultPayload) {
        sliced[key] = defaultPayload[key as keyof typeof defaultPayload];
      }
    }

    return sliced;
  }

  private buildEvidenceRefs(snapshot: CanonicalSnapshotRecord): CriteriaStepEvidenceRef[] {
    return snapshot.sourceRefs.map((sourceRef) => {
      const mappedType: CriteriaStepEvidenceRef['sourceType'] = sourceRef.sourceType === 'property-enrichment'
        ? 'property-enrichment'
        : sourceRef.sourceType === 'document-extraction'
          ? 'document-extraction'
          : 'canonical-snapshot';

      return {
        sourceType: mappedType,
        sourceId: sourceRef.sourceId,
        ...(sourceRef.sourceRunId ? { sourceRunId: sourceRef.sourceRunId } : {}),
      };
    });
  }
}
