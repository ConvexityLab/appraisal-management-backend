import { describe, expect, it, vi } from 'vitest';
import {
  buildPropertyEventOutboxFingerprint,
  PropertyEventOutboxService,
  PROPERTY_EVENT_OUTBOX_CONTAINER,
} from '../src/services/property-event-outbox.service';
import type { PropertyEventOutboxRecord } from '../src/types/property-event-outbox.types';

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'prop-1';

function makeOutboxRecord(
  overrides: Partial<PropertyEventOutboxRecord> = {},
): PropertyEventOutboxRecord {
  return {
    id: 'propoutbox-1',
    type: 'property-event-outbox',
    tenantId: TENANT_ID,
    aggregateType: 'property',
    aggregateId: PROPERTY_ID,
    eventType: 'property.observation.recorded',
    status: 'pending',
    occurredAt: '2026-05-10T00:00:00.000Z',
    availableAt: '2026-05-10T00:00:00.000Z',
    createdAt: '2026-05-10T00:00:01.000Z',
    publishAttempts: 0,
    correlationId: PROPERTY_ID,
    sourceObservationId: 'propobs-1',
    payload: {
      observationId: 'propobs-1',
      propertyId: PROPERTY_ID,
      observationType: 'provider-enrichment',
    },
    createdBy: 'SYSTEM',
    ...overrides,
  };
}

function makeCosmosService(initialRows: PropertyEventOutboxRecord[] = []) {
  const store = new Map<string, PropertyEventOutboxRecord>();
  for (const row of initialRows) {
    store.set(row.id, row);
  }

  return {
    getDocument: vi.fn().mockImplementation(async (_container: string, id: string) => store.get(id) ?? null),
    createDocument: vi.fn().mockImplementation(async (_container: string, row: PropertyEventOutboxRecord) => {
      store.set(row.id, row);
      return row;
    }),
  };
}

describe('buildPropertyEventOutboxFingerprint', () => {
  it('is stable for the same event refs', () => {
    const a = buildPropertyEventOutboxFingerprint({
      tenantId: TENANT_ID,
      aggregateId: PROPERTY_ID,
      eventType: 'property.observation.recorded',
      sourceObservationId: 'propobs-1',
    });
    const b = buildPropertyEventOutboxFingerprint({
      tenantId: TENANT_ID,
      aggregateId: PROPERTY_ID,
      eventType: 'property.observation.recorded',
      sourceObservationId: 'propobs-1',
    });

    expect(a).toBe(b);
  });
});

describe('PropertyEventOutboxService.createEvent', () => {
  it('creates a pending property outbox row', async () => {
    const cosmos = makeCosmosService();
    const svc = new PropertyEventOutboxService(cosmos as any);

    const created = await svc.createEvent({
      tenantId: TENANT_ID,
      aggregateId: PROPERTY_ID,
      eventType: 'property.observation.recorded',
      occurredAt: '2026-05-10T00:00:00.000Z',
      sourceObservationId: 'propobs-1',
      payload: {
        observationId: 'propobs-1',
        propertyId: PROPERTY_ID,
        observationType: 'provider-enrichment',
      },
    });

    expect(created.id).toMatch(/^propoutbox-/);
    expect(cosmos.createDocument).toHaveBeenCalledWith(
      PROPERTY_EVENT_OUTBOX_CONTAINER,
      expect.objectContaining({
        aggregateId: PROPERTY_ID,
        eventType: 'property.observation.recorded',
        status: 'pending',
        sourceObservationId: 'propobs-1',
      }),
    );
  });

  it('returns the existing row when the outbox event already exists', async () => {
    const existing = makeOutboxRecord({
      id: `propoutbox-${buildPropertyEventOutboxFingerprint({
        tenantId: TENANT_ID,
        aggregateId: PROPERTY_ID,
        eventType: 'property.observation.recorded',
        sourceObservationId: 'propobs-1',
      })}`,
    });
    const cosmos = makeCosmosService([existing]);
    const svc = new PropertyEventOutboxService(cosmos as any);

    const result = await svc.createEvent({
      tenantId: TENANT_ID,
      aggregateId: PROPERTY_ID,
      eventType: 'property.observation.recorded',
      occurredAt: '2026-05-10T00:00:00.000Z',
      sourceObservationId: 'propobs-1',
      payload: {
        observationId: 'propobs-1',
        propertyId: PROPERTY_ID,
      },
    });

    expect(result).toEqual(existing);
    expect(cosmos.createDocument).not.toHaveBeenCalled();
  });
});