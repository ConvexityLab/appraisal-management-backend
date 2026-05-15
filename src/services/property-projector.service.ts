import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { CanonicalReportDocument } from '@l1/shared-types';
import type {
  PropertyCurrentCanonicalView,
  PropertyRecord,
  PropertyVersionEntry,
} from '@l1/shared-types';
import {
  mergePropertyCanonical,
  pickPropertyCanonical,
  PROPERTY_CANONICAL_PROJECTOR_VERSION,
} from '../mappers/property-canonical-projection.js';
import { PropertyObservationService } from './property-observation.service.js';
import { PropertyEventOutboxService } from './property-event-outbox.service.js';
import type { PropertyObservationRecord } from '../types/property-observation.types.js';

export interface ProjectPropertyCanonicalInput {
  tenantId: string;
  propertyId: string;
  orderId?: string;
  engagementId?: string;
  documentId?: string;
  sourceRunId: string;
  snapshotId: string;
  snapshotAt: string;
  sourceSchemaVersion?: string;
  initiatedBy: string;
  canonical: Partial<CanonicalReportDocument> | null;
}

export interface ReplayPropertyCanonicalFromObservationsInput {
  tenantId: string;
  propertyId: string;
  initiatedBy: string;
}

interface PropertyProjectionLineage {
  projectedAt: string;
  projectionVersion: string;
  latestObservationAt: string;
  latestSnapshotId?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function compareIso(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '');
}

function maxIso(...values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort(compareIso)
    .at(-1);
}

function buildSnapshotProjectionLineage(
  property: PropertyRecord,
  merged: PropertyCurrentCanonicalView,
  input: ProjectPropertyCanonicalInput,
): PropertyProjectionLineage {
  const latestObservationAt = maxIso(property.latestObservationAt, input.snapshotAt) ?? input.snapshotAt;
  const projectedAt = maxIso(property.projectedAt, latestObservationAt) ?? latestObservationAt;

  return {
    projectedAt,
    projectionVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
    latestObservationAt,
    latestSnapshotId: merged.lastSnapshotId ?? property.latestSnapshotId ?? input.snapshotId,
  };
}

function buildObservationProjectionLineage(
  observation: PropertyObservationRecord,
): PropertyProjectionLineage {
  const rawPayload = asRecord(observation.rawPayload);
  const projectionSource = asRecord(rawPayload?.projectionSource);
  const snapshotId = observation.snapshotId
    ?? asNonEmptyString(projectionSource?.snapshotId)
    ?? asNonEmptyString(rawPayload?.snapshotId);

  return {
    projectedAt: observation.observedAt,
    projectionVersion:
      asNonEmptyString(rawPayload?.projectorVersion) ?? PROPERTY_CANONICAL_PROJECTOR_VERSION,
    latestObservationAt: observation.observedAt,
    ...(snapshotId ? { latestSnapshotId: snapshotId } : {}),
  };
}

function hasProjectionStateChanged(
  property: PropertyRecord,
  currentCanonical: PropertyCurrentCanonicalView,
  lineage: PropertyProjectionLineage,
): boolean {
  return (
    JSON.stringify(property.currentCanonical ?? {}) !== JSON.stringify(currentCanonical)
    || property.projectedAt !== lineage.projectedAt
    || property.projectionVersion !== lineage.projectionVersion
    || property.latestSnapshotId !== lineage.latestSnapshotId
    || property.latestObservationAt !== lineage.latestObservationAt
  );
}

function buildProjectionVersionEntry(input: {
  property: PropertyRecord;
  nextVersion: number;
  changedBy: string;
  changedAt: string;
  reason: string;
  sourceArtifactId?: string;
  previousCurrentCanonical: PropertyCurrentCanonicalView | null;
  nextCurrentCanonical: PropertyCurrentCanonicalView;
  lineage: PropertyProjectionLineage;
}): PropertyVersionEntry {
  return {
    version: input.nextVersion,
    createdAt: input.changedAt,
    createdBy: input.changedBy,
    reason: input.reason,
    source: 'CANONICAL_SNAPSHOT',
    ...(input.sourceArtifactId ? { sourceArtifactId: input.sourceArtifactId } : {}),
    changedFields: [
      'currentCanonical',
      'projectedAt',
      'projectionVersion',
      'latestSnapshotId',
      'latestObservationAt',
    ],
    previousValues: {
      currentCanonical: input.previousCurrentCanonical,
      projectedAt: input.property.projectedAt ?? null,
      projectionVersion: input.property.projectionVersion ?? null,
      latestSnapshotId: input.property.latestSnapshotId ?? null,
      latestObservationAt: input.property.latestObservationAt ?? null,
    },
    newValues: {
      currentCanonical: input.nextCurrentCanonical,
      projectedAt: input.lineage.projectedAt,
      projectionVersion: input.lineage.projectionVersion,
      latestSnapshotId: input.lineage.latestSnapshotId ?? null,
      latestObservationAt: input.lineage.latestObservationAt,
    },
  };
}

function withOptionalString<T extends object>(key: string, value: string | undefined): T | {} {
  return value ? { [key]: value } as T : {};
}

function getCanonicalPatch(
  observation: PropertyObservationRecord,
): Partial<PropertyCurrentCanonicalView> | null {
  const patch = observation.normalizedFacts?.canonicalPatch;
  const patchRecord = asRecord(patch);
  return patchRecord ? patchRecord as Partial<PropertyCurrentCanonicalView> : null;
}

function compareObservationReplayOrder(
  left: PropertyObservationRecord,
  right: PropertyObservationRecord,
): number {
  const observedAtCompare = compareIso(left.observedAt, right.observedAt);
  if (observedAtCompare !== 0) {
    return observedAtCompare;
  }

  const ingestedAtCompare = compareIso(left.ingestedAt, right.ingestedAt);
  if (ingestedAtCompare !== 0) {
    return ingestedAtCompare;
  }

  return left.id.localeCompare(right.id);
}

export class PropertyProjectorService {
  private readonly logger = new Logger('PropertyProjectorService');
  private readonly observationService: PropertyObservationService;
  private readonly outboxService: PropertyEventOutboxService;

  constructor(private readonly dbService: CosmosDbService) {
    this.observationService = new PropertyObservationService(dbService);
    this.outboxService = new PropertyEventOutboxService(dbService);
  }

  async replayCurrentCanonicalFromObservations(
    input: ReplayPropertyCanonicalFromObservationsInput,
  ): Promise<void> {
    if (!input.tenantId) {
      throw new Error(
        'PropertyProjectorService.replayCurrentCanonicalFromObservations: tenantId is required',
      );
    }
    if (!input.propertyId) {
      throw new Error(
        'PropertyProjectorService.replayCurrentCanonicalFromObservations: propertyId is required',
      );
    }
    if (!input.initiatedBy) {
      throw new Error(
        'PropertyProjectorService.replayCurrentCanonicalFromObservations: initiatedBy is required',
      );
    }

    const property = await this.loadPropertyRecord(input.propertyId, input.tenantId);
    if (!property) {
      this.logger.warn('Projector replay: PropertyRecord not found — skipping replay', {
        propertyId: input.propertyId,
        tenantId: input.tenantId,
      });
      return;
    }

    const observations = await this.observationService.listByPropertyId(
      input.propertyId,
      input.tenantId,
      'canonical-projection',
    );

    const orderedObservations = [...observations].sort(compareObservationReplayOrder);

    let replayedCanonical: PropertyCurrentCanonicalView | undefined;
    let latestAppliedObservation: PropertyObservationRecord | null = null;
    let appliedObservationCount = 0;

    for (const observation of orderedObservations) {
      const canonicalPatch = getCanonicalPatch(observation);
      if (!canonicalPatch) {
        continue;
      }

      replayedCanonical = mergePropertyCanonical(replayedCanonical, canonicalPatch);
      latestAppliedObservation = observation;
      appliedObservationCount += 1;
    }

    if (!replayedCanonical || !latestAppliedObservation || appliedObservationCount === 0) {
      this.logger.info('Projector replay: no canonical-projection observations to apply', {
        propertyId: input.propertyId,
        tenantId: input.tenantId,
      });
      return;
    }

    const lineage = buildObservationProjectionLineage(latestAppliedObservation);
    if (!hasProjectionStateChanged(property, replayedCanonical, lineage)) {
      return;
    }

    const nextVersion = property.recordVersion + 1;
    const updated: PropertyRecord = {
      ...property,
      currentCanonical: replayedCanonical,
      ...lineage,
      recordVersion: nextVersion,
      versionHistory: [
        ...property.versionHistory,
        buildProjectionVersionEntry({
          property,
          nextVersion,
          changedBy: input.initiatedBy,
          changedAt: latestAppliedObservation.observedAt,
          reason:
            `Replayed currentCanonical from ${appliedObservationCount} canonical-projection observations`,
          ...withOptionalString<{ sourceArtifactId: string }>('sourceArtifactId', latestAppliedObservation.snapshotId),
          previousCurrentCanonical: property.currentCanonical ?? null,
          nextCurrentCanonical: replayedCanonical,
          lineage,
        }),
      ],
      updatedAt: latestAppliedObservation.observedAt,
    };

    const writeResult = await this.dbService.upsertItem<PropertyRecord>('property-records', updated);
    if (!writeResult.success) {
      this.logger.warn('Projector replay: PropertyRecord currentCanonical write failed', {
        propertyId: input.propertyId,
        tenantId: input.tenantId,
        error: writeResult.error?.message,
      });
      return;
    }

    this.logger.info('PropertyRecord currentCanonical replayed from observations', {
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      appliedObservationCount,
      latestObservationId: latestAppliedObservation.id,
    });
  }

  async projectCurrentCanonicalFromSnapshot(input: ProjectPropertyCanonicalInput): Promise<void> {
    try {
      const projected = pickPropertyCanonical(input.canonical, {
        snapshotId: input.snapshotId,
        lastSnapshotAt: input.snapshotAt,
      });
      if (!projected) {
        return;
      }

      const property = await this.loadPropertyRecord(input.propertyId, input.tenantId);
      if (!property) {
        this.logger.warn('Projector: PropertyRecord not found — skipping currentCanonical update', {
          propertyId: input.propertyId,
          tenantId: input.tenantId,
          sourceRunId: input.sourceRunId,
        });
        return;
      }

      const merged = mergePropertyCanonical(
        property.currentCanonical as PropertyCurrentCanonicalView | undefined,
        projected,
      );
      const lineage = buildSnapshotProjectionLineage(property, merged, input);

      if (!hasProjectionStateChanged(property, merged, lineage)) {
        return;
      }

      const newVersion = property.recordVersion + 1;
      const updated: PropertyRecord = {
        ...property,
        currentCanonical: merged,
        ...lineage,
        recordVersion: newVersion,
        versionHistory: [
          ...property.versionHistory,
          buildProjectionVersionEntry({
            property,
            nextVersion: newVersion,
            changedBy: input.initiatedBy,
            changedAt: input.snapshotAt,
            reason: `Canonical snapshot ${input.snapshotId} updated currentCanonical`,
            sourceArtifactId: input.snapshotId,
            previousCurrentCanonical: property.currentCanonical ?? null,
            nextCurrentCanonical: merged,
            lineage,
          }),
        ],
        updatedAt: input.snapshotAt,
      };

      const writeResult = await this.dbService.upsertItem<PropertyRecord>('property-records', updated);
      if (!writeResult.success) {
        this.logger.warn('Projector: PropertyRecord currentCanonical write failed — non-fatal', {
          propertyId: input.propertyId,
          tenantId: input.tenantId,
          error: writeResult.error?.message,
        });
        return;
      }

      await this.observationService.createObservation({
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        observationType: 'canonical-projection',
        sourceSystem: 'canonical-snapshot-service',
        observedAt: input.snapshotAt,
        sourceArtifactRef: { kind: 'snapshot', id: input.snapshotId },
        lineageRefs: [
          { kind: 'snapshot', id: input.snapshotId },
          ...(input.documentId ? [{ kind: 'document' as const, id: input.documentId }] : []),
          { kind: 'other' as const, id: input.sourceRunId },
        ],
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(input.engagementId ? { engagementId: input.engagementId } : {}),
        ...(input.documentId ? { documentId: input.documentId } : {}),
        snapshotId: input.snapshotId,
        sourceRecordId: input.sourceRunId,
        sourceProvider: 'canonical-snapshot-service',
        normalizedFacts: { canonicalPatch: projected },
        rawPayload: {
          projectorVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
          sourceSchemaVersion: input.sourceSchemaVersion ?? null,
          projectionSource: {
            snapshotId: input.snapshotId,
            snapshotAt: input.snapshotAt,
            sourceRunId: input.sourceRunId,
            orderId: input.orderId ?? null,
            engagementId: input.engagementId ?? null,
            documentId: input.documentId ?? null,
          },
          previousCurrentCanonical: property.currentCanonical ?? null,
          nextCurrentCanonical: merged,
        },
        createdBy: input.initiatedBy,
      });

      await this.enqueueCurrentCanonicalUpdatedEvent({
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
        ...(input.engagementId !== undefined ? { engagementId: input.engagementId } : {}),
        ...(input.documentId !== undefined ? { documentId: input.documentId } : {}),
        sourceRunId: input.sourceRunId,
        snapshotId: input.snapshotId,
        snapshotAt: input.snapshotAt,
        ...(input.sourceSchemaVersion !== undefined
          ? { sourceSchemaVersion: input.sourceSchemaVersion }
          : {}),
        initiatedBy: input.initiatedBy,
        newVersion,
      });

      this.logger.info('PropertyRecord currentCanonical updated from snapshot', {
        propertyId: input.propertyId,
        tenantId: input.tenantId,
        snapshotId: input.snapshotId,
        newVersion,
      });
    } catch (err) {
      this.logger.warn('Projector: currentCanonical update threw — non-fatal', {
        propertyId: input.propertyId,
        tenantId: input.tenantId,
        sourceRunId: input.sourceRunId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async loadPropertyRecord(
    propertyId: string,
    tenantId: string,
  ): Promise<PropertyRecord | null> {
    const propertyResult = await this.dbService.queryItems<PropertyRecord>(
      'property-records',
      `SELECT TOP 1 * FROM c WHERE c.id = @id AND c.tenantId = @tenantId`,
      [
        { name: '@id', value: propertyId },
        { name: '@tenantId', value: tenantId },
      ],
    );

    if (!propertyResult.success || !propertyResult.data?.[0]) {
      return null;
    }

    return propertyResult.data[0];
  }

  private async enqueueCurrentCanonicalUpdatedEvent(input: {
    tenantId: string;
    propertyId: string;
    orderId?: string;
    engagementId?: string;
    documentId?: string;
    sourceRunId: string;
    snapshotId: string;
    snapshotAt: string;
    sourceSchemaVersion?: string;
    initiatedBy: string;
    newVersion: number;
  }): Promise<void> {
    try {
      await this.outboxService.createEvent({
        tenantId: input.tenantId,
        aggregateId: input.propertyId,
        eventType: 'property.currentCanonical.updated',
        occurredAt: input.snapshotAt,
        correlationId: input.propertyId,
        sourceSnapshotId: input.snapshotId,
        payload: {
          propertyId: input.propertyId,
          snapshotId: input.snapshotId,
          recordVersion: input.newVersion,
          observedAt: input.snapshotAt,
          sourceSystem: 'canonical-snapshot-service',
          sourceProvider: 'canonical-snapshot-service',
          projectorVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
          sourceSchemaVersion: input.sourceSchemaVersion ?? null,
          orderId: input.orderId ?? null,
          engagementId: input.engagementId ?? null,
          documentId: input.documentId ?? null,
          sourceRecordId: input.sourceRunId,
          sourceArtifactRef: { kind: 'snapshot', id: input.snapshotId },
          lineageRefs: [
            { kind: 'snapshot', id: input.snapshotId },
            ...(input.documentId ? [{ kind: 'document', id: input.documentId }] : []),
            { kind: 'other', id: input.sourceRunId },
          ],
        },
        createdBy: input.initiatedBy,
      });
    } catch (err) {
      this.logger.warn('Projector: currentCanonical updated but outbox enqueue failed — non-fatal', {
        propertyId: input.propertyId,
        tenantId: input.tenantId,
        snapshotId: input.snapshotId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
