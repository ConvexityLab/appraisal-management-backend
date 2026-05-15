export type PropertyDomainEventType =
  | 'property.observation.recorded'
  | 'property.currentCanonical.updated'
  | 'property.snapshot.created'
  | 'property.snapshot.refreshed';

export type PropertyDomainEventStatus = 'pending' | 'processing' | 'published' | 'failed' | 'dead-letter';

export interface PropertyEventOutboxPayload {
  observationId?: string;
  snapshotId?: string;
  propertyId: string;
  recordVersion?: number;
  projectorVersion?: string;
  sourceSchemaVersion?: string | null;
  observationType?: string;
  observedAt?: string;
  sourceSystem?: string;
  sourceProvider?: string | null;
  orderId?: string | null;
  engagementId?: string | null;
  documentId?: string | null;
  sourceRecordId?: string | null;
  sourceArtifactRef?: Record<string, unknown> | null;
  lineageRefs?: Record<string, unknown>[];
}

export interface PropertyEventOutboxRecord {
  id: string;
  type: 'property-event-outbox';
  tenantId: string;
  aggregateType: 'property';
  aggregateId: string;
  eventType: PropertyDomainEventType;
  status: PropertyDomainEventStatus;
  occurredAt: string;
  availableAt: string;
  createdAt: string;
  publishAttempts: number;
  correlationId: string;
  sourceObservationId?: string;
  sourceSnapshotId?: string;
  payload: PropertyEventOutboxPayload;
  createdBy: string;
  publishedAt?: string;
  lastAttemptAt?: string;
  lastError?: string;
  claimedAt?: string;
  claimedBy?: string;
}

export interface CreatePropertyEventOutboxInput {
  tenantId: string;
  aggregateId: string;
  eventType: PropertyDomainEventType;
  occurredAt: string;
  availableAt?: string;
  correlationId?: string;
  sourceObservationId?: string;
  sourceSnapshotId?: string;
  payload: PropertyEventOutboxPayload;
  createdBy?: string;
}