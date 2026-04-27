/**
 * CompCollectionListenerJob — unit test
 *
 * Verifies the listener subscribes to `client-order.created` and routes
 * incoming events to OrderCompCollectionService.runForOrder().
 */
import { describe, it, expect, vi } from 'vitest';
import { CompCollectionListenerJob } from '../src/jobs/comp-collection-listener.job';
import { EventCategory, type ClientOrderCreatedEvent, type EventHandler } from '../src/types/events';
import { ProductType } from '../src/types/product-catalog';

function makeEvent(): ClientOrderCreatedEvent {
  return {
    id: 'evt-1',
    type: 'client-order.created',
    category: EventCategory.ORDER,
    timestamp: new Date(),
    source: 'ClientOrderService',
    version: '1.0',
    data: {
      clientOrderId: 'co-1',
      tenantId: 'tenant-a',
      propertyId: 'prop-1',
      productType: ProductType.BPO,
      placedAt: '2026-04-26T00:00:00.000Z',
    },
  };
}

describe('CompCollectionListenerJob', () => {
  it('subscribes to client-order.created and dispatches events to the service', async () => {
    let registered: EventHandler<ClientOrderCreatedEvent> | undefined;
    const subscriber = {
      subscribe: vi.fn(async (eventType: string, handler: EventHandler<ClientOrderCreatedEvent>) => {
        expect(eventType).toBe('client-order.created');
        registered = handler;
      }),
      unsubscribe: vi.fn(async () => {}),
    } as any;

    const service = {
      runForOrder: vi.fn(async () => ({ status: 'COLLECTED', docId: 'doc-1', soldCount: 0, activeCount: 0 })),
    } as any;

    const job = new CompCollectionListenerJob({} as any, { subscriber, service });
    await job.start();

    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(registered).toBeDefined();

    const event = makeEvent();
    await registered!.handle(event);

    expect(service.runForOrder).toHaveBeenCalledWith(event);
  });

  it('start() is idempotent', async () => {
    const subscriber = {
      subscribe: vi.fn(async () => {}),
      unsubscribe: vi.fn(async () => {}),
    } as any;
    const service = { runForOrder: vi.fn() } as any;

    const job = new CompCollectionListenerJob({} as any, { subscriber, service });
    await job.start();
    await job.start();

    expect(subscriber.subscribe).toHaveBeenCalledTimes(1);
  });

  it('re-throws service errors so the bus message can be retried', async () => {
    let registered: EventHandler<ClientOrderCreatedEvent> | undefined;
    const subscriber = {
      subscribe: vi.fn(async (_eventType: string, h: EventHandler<ClientOrderCreatedEvent>) => {
        registered = h;
      }),
      unsubscribe: vi.fn(async () => {}),
    } as any;
    const service = {
      runForOrder: vi.fn(async () => {
        throw new Error('cosmos down');
      }),
    } as any;

    const job = new CompCollectionListenerJob({} as any, { subscriber, service });
    await job.start();

    await expect(registered!.handle(makeEvent())).rejects.toThrow(/cosmos down/);
  });
});
