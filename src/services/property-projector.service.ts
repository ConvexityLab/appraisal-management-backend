import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { CanonicalReportDocument } from '../types/canonical-schema.js';
import type { PropertyCurrentCanonicalView, PropertyRecord } from '../types/property-record.types.js';
import { mergePropertyCanonical, pickPropertyCanonical } from '../mappers/property-canonical-projection.js';
import { PropertyObservationService } from './property-observation.service.js';

export interface ProjectPropertyCanonicalInput {
  tenantId: string;
  propertyId: string;
  orderId?: string;
  engagementId?: string;
  documentId?: string;
  sourceRunId: string;
  snapshotId: string;
  snapshotAt: string;
  initiatedBy: string;
  canonical: Partial<CanonicalReportDocument> | null;
}

export class PropertyProjectorService {
  private readonly logger = new Logger('PropertyProjectorService');
  private readonly observationService: PropertyObservationService;

  constructor(private readonly dbService: CosmosDbService) {
    this.observationService = new PropertyObservationService(dbService);
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

      const propertyResult = await this.dbService.queryItems<PropertyRecord>(
        'property-records',
        `SELECT TOP 1 * FROM c WHERE c.id = @id AND c.tenantId = @tenantId`,
        [
          { name: '@id', value: input.propertyId },
          { name: '@tenantId', value: input.tenantId },
        ],
      );
      if (!propertyResult.success || !propertyResult.data?.[0]) {
        this.logger.warn('Projector: PropertyRecord not found — skipping currentCanonical update', {
          propertyId: input.propertyId,
          tenantId: input.tenantId,
          sourceRunId: input.sourceRunId,
        });
        return;
      }
      const property = propertyResult.data[0];

      const merged = mergePropertyCanonical(
        property.currentCanonical as PropertyCurrentCanonicalView | undefined,
        projected,
      );

      if (JSON.stringify(property.currentCanonical ?? {}) === JSON.stringify(merged)) {
        return;
      }

      const newVersion = property.recordVersion + 1;
      const updated: PropertyRecord = {
        ...property,
        currentCanonical: merged,
        recordVersion: newVersion,
        versionHistory: [
          ...property.versionHistory,
          {
            version: newVersion,
            createdAt: input.snapshotAt,
            createdBy: input.initiatedBy,
            reason: `Canonical snapshot ${input.snapshotId} updated currentCanonical`,
            source: 'CANONICAL_SNAPSHOT',
            changedFields: ['currentCanonical'],
            previousValues: { currentCanonical: property.currentCanonical ?? null },
          },
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
          previousCurrentCanonical: property.currentCanonical ?? null,
          nextCurrentCanonical: merged,
        },
        createdBy: input.initiatedBy,
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
}
