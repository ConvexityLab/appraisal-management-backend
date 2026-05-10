import { createHash } from 'crypto';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  CreatePropertyObservationInput,
  PropertyObservationRecord,
  PropertyObservationType,
} from '../types/property-observation.types.js';

export const PROPERTY_OBSERVATIONS_CONTAINER = 'property-observations';

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`);

  return `{${entries.join(',')}}`;
}

export function buildObservationFingerprint(input: {
  propertyId: string;
  observationType: string;
  sourceSystem: string;
  observedAt: string;
  sourceRecordId?: string;
  sourceArtifactRef?: unknown;
  normalizedFacts?: unknown;
  rawPayload?: unknown;
}): string {
  const normalized = stableSerialize({
    propertyId: input.propertyId,
    observationType: input.observationType,
    sourceSystem: input.sourceSystem,
    observedAt: input.observedAt,
    sourceRecordId: input.sourceRecordId ?? null,
    sourceArtifactRef: input.sourceArtifactRef ?? null,
    normalizedFacts: input.normalizedFacts ?? null,
    rawPayload: input.rawPayload ?? null,
  });

  return createHash('sha256').update(normalized).digest('hex');
}

export class PropertyObservationService {
  private readonly logger = new Logger('PropertyObservationService');

  constructor(private readonly cosmosService: CosmosDbService) {}

  async createObservation(
    input: CreatePropertyObservationInput,
  ): Promise<PropertyObservationRecord> {
    if (!input.tenantId) {
      throw new Error('PropertyObservationService.createObservation: tenantId is required');
    }
    if (!input.propertyId) {
      throw new Error('PropertyObservationService.createObservation: propertyId is required');
    }
    if (!input.observationType) {
      throw new Error('PropertyObservationService.createObservation: observationType is required');
    }
    if (!input.sourceSystem) {
      throw new Error('PropertyObservationService.createObservation: sourceSystem is required');
    }
    if (!input.observedAt) {
      throw new Error('PropertyObservationService.createObservation: observedAt is required');
    }

    const sourceFingerprint = buildObservationFingerprint({
      propertyId: input.propertyId,
      observationType: input.observationType,
      sourceSystem: input.sourceSystem,
      observedAt: input.observedAt,
      ...(input.sourceRecordId ? { sourceRecordId: input.sourceRecordId } : {}),
      ...(input.sourceArtifactRef ? { sourceArtifactRef: input.sourceArtifactRef } : {}),
      ...(input.normalizedFacts ? { normalizedFacts: input.normalizedFacts } : {}),
      ...(input.rawPayload !== undefined ? { rawPayload: input.rawPayload } : {}),
    });

    const id = `propobs-${sourceFingerprint}`;
    const existing = await this.cosmosService.getDocument<PropertyObservationRecord>(
      PROPERTY_OBSERVATIONS_CONTAINER,
      id,
      input.tenantId,
    );

    if (existing) {
      return existing;
    }

    const record: PropertyObservationRecord = {
      id,
      type: 'property-observation',
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      observationType: input.observationType,
      sourceSystem: input.sourceSystem,
      sourceFingerprint,
      observedAt: input.observedAt,
      ingestedAt: input.ingestedAt ?? new Date().toISOString(),
      ...(input.sourceArtifactRef ? { sourceArtifactRef: input.sourceArtifactRef } : {}),
      ...(input.lineageRefs?.length ? { lineageRefs: input.lineageRefs } : {}),
      ...(input.orderId ? { orderId: input.orderId } : {}),
      ...(input.engagementId ? { engagementId: input.engagementId } : {}),
      ...(input.documentId ? { documentId: input.documentId } : {}),
      ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
      ...(input.sourceRecordId ? { sourceRecordId: input.sourceRecordId } : {}),
      ...(input.sourceProvider ? { sourceProvider: input.sourceProvider } : {}),
      ...(input.confidence != null ? { confidence: input.confidence } : {}),
      ...(input.normalizedFacts ? { normalizedFacts: input.normalizedFacts } : {}),
      ...(input.rawPayload !== undefined ? { rawPayload: input.rawPayload } : {}),
      createdBy: input.createdBy ?? 'SYSTEM',
    };

    const created = await this.cosmosService.createDocument<PropertyObservationRecord>(
      PROPERTY_OBSERVATIONS_CONTAINER,
      record,
    );

    this.logger.info('Property observation created', {
      id: created.id,
      tenantId: created.tenantId,
      propertyId: created.propertyId,
      observationType: created.observationType,
      sourceSystem: created.sourceSystem,
    });

    return created;
  }

  async listByPropertyId(
    propertyId: string,
    tenantId: string,
    observationType?: PropertyObservationType,
  ): Promise<PropertyObservationRecord[]> {
    if (!propertyId) {
      throw new Error('PropertyObservationService.listByPropertyId: propertyId is required');
    }
    if (!tenantId) {
      throw new Error('PropertyObservationService.listByPropertyId: tenantId is required');
    }

    const query = [
      'SELECT * FROM c',
      'WHERE c.type = @type',
      '  AND c.tenantId = @tenantId',
      '  AND c.propertyId = @propertyId',
      observationType ? '  AND c.observationType = @observationType' : '',
      'ORDER BY c.observedAt DESC',
    ].filter(Boolean).join('\n');

    const params = [
      { name: '@type', value: 'property-observation' },
      { name: '@tenantId', value: tenantId },
      { name: '@propertyId', value: propertyId },
      ...(observationType ? [{ name: '@observationType', value: observationType }] : []),
    ];

    return this.cosmosService.queryDocuments<PropertyObservationRecord>(
      PROPERTY_OBSERVATIONS_CONTAINER,
      query,
      params,
    );
  }

  async getLatestByType(
    propertyId: string,
    tenantId: string,
    observationType: PropertyObservationType,
  ): Promise<PropertyObservationRecord | null> {
    if (!observationType) {
      throw new Error('PropertyObservationService.getLatestByType: observationType is required');
    }

    const rows = await this.listByPropertyId(propertyId, tenantId, observationType);
    return rows[0] ?? null;
  }
}
