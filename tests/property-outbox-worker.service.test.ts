import { describe, expect, it, vi } from 'vitest';
import { EventCategory } from '../src/types/events.js';
import { PropertyOutboxWorkerService } from '../src/services/property-outbox-worker.service.js';
import type { PropertyEventOutboxRecord } from '../src/types/property-event-outbox.types.js';

function createContainerHarness(initial: PropertyEventOutboxRecord) {
  const docs = new Map<string, PropertyEventOutboxRecord>([[initial.id, structuredClone(initial)]]);
  const etags = new Map<string, string>([[initial.id, 'etag-1']]);

  const container = {
    item(id: string, _tenantId: string) {
      return {
        read: vi.fn(async () => ({
          resource: docs.get(id),
          etag: etags.get(id),
        })),
        replace: vi.fn(async (next: PropertyEventOutboxRecord, options?: { accessCondition?: { condition?: string } }) => {
          const currentEtag = etags.get(id);
          if (options?.accessCondition?.condition !== currentEtag) {
            throw { code: 412 };
          }

          const nextEtag = `${currentEtag}-next`;
          docs.set(id, structuredClone(next));
          etags.set(id, nextEtag);
          return {
            resource: docs.get(id),
            etag: nextEtag,
          };
        }),
      };
    },
  };

  return { docs, container };
}

describe('PropertyOutboxWorkerService', () => {
  it('publishes pending property observation events and marks them published', async () => {
    const record: PropertyEventOutboxRecord = {
      id: 'propoutbox-1',
      type: 'property-event-outbox',
      tenantId: 'tenant-1',
      aggregateType: 'property',
      aggregateId: 'prop-1',
      eventType: 'property.observation.recorded',
      status: 'pending',
      occurredAt: '2026-05-10T00:00:00.000Z',
      availableAt: '2026-05-10T00:00:00.000Z',
      createdAt: '2026-05-10T00:00:00.000Z',
      publishAttempts: 0,
      correlationId: 'prop-1',
      sourceObservationId: 'obs-1',
      payload: {
        propertyId: 'prop-1',
        observationId: 'obs-1',
        observationType: 'manual-correction',
        observedAt: '2026-05-10T00:00:00.000Z',
        sourceSystem: 'property-record-controller',
        lineageRefs: [],
      },
      createdBy: 'user-1',
    };

    const harness = createContainerHarness(record);
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    const queryItems = vi.fn().mockResolvedValue({ success: true, data: [record] });
    const service = new PropertyOutboxWorkerService(
      { queryItems, getContainer: vi.fn().mockReturnValue(harness.container) } as any,
      publisher as any,
      { workerId: 'worker-1' },
    );

    const processed = await service.processPendingBatch('2026-05-10T00:00:05.000Z');

    expect(processed).toBe(1);
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'property.observation.recorded',
        category: EventCategory.PROPERTY,
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          observationId: 'obs-1',
        }),
      }),
    );
    expect(harness.docs.get(record.id)).toEqual(
      expect.objectContaining({
        status: 'published',
        publishAttempts: 1,
        publishedAt: '2026-05-10T00:00:05.000Z',
      }),
    );
  });

  it('publishes pending property snapshot events and marks them published', async () => {
    const record: PropertyEventOutboxRecord = {
      id: 'propoutbox-2',
      type: 'property-event-outbox',
      tenantId: 'tenant-1',
      aggregateType: 'property',
      aggregateId: 'prop-1',
      eventType: 'property.snapshot.created',
      status: 'pending',
      occurredAt: '2026-05-10T00:00:00.000Z',
      availableAt: '2026-05-10T00:00:00.000Z',
      createdAt: '2026-05-10T00:00:00.000Z',
      publishAttempts: 0,
      correlationId: 'prop-1',
      sourceSnapshotId: 'snap-1',
      payload: {
        propertyId: 'prop-1',
        snapshotId: 'snap-1',
        observedAt: '2026-05-10T00:00:00.000Z',
        sourceSystem: 'canonical-snapshot-service',
        lineageRefs: [],
      },
      createdBy: 'user-1',
    };

    const harness = createContainerHarness(record);
    const publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    const queryItems = vi.fn().mockResolvedValue({ success: true, data: [record] });
    const service = new PropertyOutboxWorkerService(
      { queryItems, getContainer: vi.fn().mockReturnValue(harness.container) } as any,
      publisher as any,
      { workerId: 'worker-1' },
    );

    const processed = await service.processPendingBatch('2026-05-10T00:00:05.000Z');

    expect(processed).toBe(1);
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'property.snapshot.created',
        category: EventCategory.PROPERTY,
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          propertyId: 'prop-1',
          snapshotId: 'snap-1',
        }),
      }),
    );
    expect(harness.docs.get(record.id)).toEqual(
      expect.objectContaining({
        status: 'published',
        publishAttempts: 1,
        publishedAt: '2026-05-10T00:00:05.000Z',
      }),
    );
  });
});