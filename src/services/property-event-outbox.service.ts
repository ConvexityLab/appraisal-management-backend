import { createHash } from 'crypto';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  CreatePropertyEventOutboxInput,
  PropertyEventOutboxRecord,
} from '../types/property-event-outbox.types.js';

export const PROPERTY_EVENT_OUTBOX_CONTAINER = 'property-event-outbox';

export function buildPropertyEventOutboxFingerprint(input: {
  tenantId: string;
  aggregateId: string;
  eventType: string;
  sourceObservationId?: string;
  sourceSnapshotId?: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        tenantId: input.tenantId,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        sourceObservationId: input.sourceObservationId ?? null,
        sourceSnapshotId: input.sourceSnapshotId ?? null,
      }),
    )
    .digest('hex');
}

export class PropertyEventOutboxService {
  private readonly logger = new Logger('PropertyEventOutboxService');

  constructor(private readonly cosmosService: CosmosDbService) {}

  async createEvent(input: CreatePropertyEventOutboxInput): Promise<PropertyEventOutboxRecord> {
    if (!input.tenantId) {
      throw new Error('PropertyEventOutboxService.createEvent: tenantId is required');
    }
    if (!input.aggregateId) {
      throw new Error('PropertyEventOutboxService.createEvent: aggregateId is required');
    }
    if (!input.eventType) {
      throw new Error('PropertyEventOutboxService.createEvent: eventType is required');
    }
    if (!input.occurredAt) {
      throw new Error('PropertyEventOutboxService.createEvent: occurredAt is required');
    }
    if (!input.payload?.propertyId) {
      throw new Error('PropertyEventOutboxService.createEvent: payload.propertyId is required');
    }

    const fingerprint = buildPropertyEventOutboxFingerprint({
      tenantId: input.tenantId,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      ...(input.sourceObservationId ? { sourceObservationId: input.sourceObservationId } : {}),
      ...(input.sourceSnapshotId ? { sourceSnapshotId: input.sourceSnapshotId } : {}),
    });

    const id = `propoutbox-${fingerprint}`;
    const existing = await this.cosmosService.getDocument<PropertyEventOutboxRecord>(
      PROPERTY_EVENT_OUTBOX_CONTAINER,
      id,
      input.tenantId,
    );
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const record: PropertyEventOutboxRecord = {
      id,
      type: 'property-event-outbox',
      tenantId: input.tenantId,
      aggregateType: 'property',
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      status: 'pending',
      occurredAt: input.occurredAt,
      availableAt: input.availableAt ?? now,
      createdAt: now,
      publishAttempts: 0,
      correlationId: input.correlationId ?? input.aggregateId,
      ...(input.sourceObservationId ? { sourceObservationId: input.sourceObservationId } : {}),
      ...(input.sourceSnapshotId ? { sourceSnapshotId: input.sourceSnapshotId } : {}),
      payload: input.payload,
      createdBy: input.createdBy ?? 'SYSTEM',
    };

    const created = await this.cosmosService.createDocument<PropertyEventOutboxRecord>(
      PROPERTY_EVENT_OUTBOX_CONTAINER,
      record,
    );

    this.logger.info('Property outbox event created', {
      id: created.id,
      tenantId: created.tenantId,
      aggregateId: created.aggregateId,
      eventType: created.eventType,
      sourceObservationId: created.sourceObservationId,
    });

    return created;
  }
}