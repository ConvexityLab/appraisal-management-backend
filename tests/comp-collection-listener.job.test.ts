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
    const compSelection = { selectForOrder: vi.fn(async () => ({})) } as any;

    const job = new CompCollectionListenerJob({} as any, { subscriber, service, compSelection });
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
    const compSelection = { selectForOrder: vi.fn() } as any;

    const job = new CompCollectionListenerJob({} as any, { subscriber, service, compSelection });
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
    const compSelection = { selectForOrder: vi.fn() } as any;

    const job = new CompCollectionListenerJob({} as any, { subscriber, service, compSelection });
    await job.start();

    await expect(registered!.handle(makeEvent())).rejects.toThrow(/cosmos down/);
    expect(compSelection.selectForOrder).not.toHaveBeenCalled();
  });

  // ── Phase 2 chain ───────────────────────────────────────────────────────────

  async function runHandlerOnce(deps: {
    runResult: Awaited<ReturnType<import('../src/services/order-comp-collection.service').OrderCompCollectionService['runForOrder']>>;
    selectImpl?: () => Promise<unknown>;
    event?: ClientOrderCreatedEvent;
  }) {
    let registered: EventHandler<ClientOrderCreatedEvent> | undefined;
    const subscriber = {
      subscribe: vi.fn(async (_t: string, h: EventHandler<ClientOrderCreatedEvent>) => {
        registered = h;
      }),
      unsubscribe: vi.fn(async () => {}),
    } as any;
    const service = { runForOrder: vi.fn(async () => deps.runResult) } as any;
    const compSelection = {
      selectForOrder: vi.fn(deps.selectImpl ?? (async () => ({}))),
    } as any;

    const job = new CompCollectionListenerJob({} as any, { subscriber, service, compSelection });
    await job.start();

    return { runResult: registered!.handle(deps.event ?? makeEvent()), service, compSelection };
  }

  it('chains Phase 2 selectForOrder after a COLLECTED Phase 1 run for a qualifying product type', async () => {
    const { runResult, compSelection } = await runHandlerOnce({
      runResult: { status: 'COLLECTED', docId: 'doc-1', soldCount: 5, activeCount: 2 },
    });
    await runResult;

    expect(compSelection.selectForOrder).toHaveBeenCalledTimes(1);
    expect(compSelection.selectForOrder).toHaveBeenCalledWith(
      'co-1',
      'tenant-a',
      ProductType.BPO,
      'prop-1',
    );
  });

  it('does NOT chain Phase 2 when Phase 1 returns SKIPPED', async () => {
    const { runResult, compSelection } = await runHandlerOnce({
      runResult: { status: 'SKIPPED', reason: 'NO_COORDINATES', docId: 'doc-skipped' },
    });
    await runResult;
    expect(compSelection.selectForOrder).not.toHaveBeenCalled();
  });

  it('does NOT chain Phase 2 when Phase 1 returns NOT_TRIGGERED', async () => {
    const { runResult, compSelection } = await runHandlerOnce({
      runResult: { status: 'NOT_TRIGGERED', reason: 'PRODUCT_TYPE_NOT_IN_TRIGGER_SET' },
    });
    await runResult;
    expect(compSelection.selectForOrder).not.toHaveBeenCalled();
  });

  it('does NOT chain Phase 2 when product type is outside COMP_SELECTION_PRODUCT_TYPES', async () => {
    const event = makeEvent();
    event.data.productType = ProductType.FULL_APPRAISAL;
    const { runResult, compSelection } = await runHandlerOnce({
      runResult: { status: 'COLLECTED', docId: 'doc-1', soldCount: 1, activeCount: 1 },
      event,
    });
    await runResult;
    expect(compSelection.selectForOrder).not.toHaveBeenCalled();
  });

  it('does NOT chain Phase 2 when propertyId is absent on the event', async () => {
    const event = makeEvent();
    delete (event.data as { propertyId?: string }).propertyId;
    const { runResult, compSelection } = await runHandlerOnce({
      runResult: { status: 'COLLECTED', docId: 'doc-1', soldCount: 1, activeCount: 1 },
      event,
    });
    await runResult;
    expect(compSelection.selectForOrder).not.toHaveBeenCalled();
  });

  it('re-throws Phase 2 failures so the bus message can be retried', async () => {
    const { runResult, compSelection } = await runHandlerOnce({
      runResult: { status: 'COLLECTED', docId: 'doc-1', soldCount: 1, activeCount: 1 },
      selectImpl: async () => {
        throw new Error('selectForOrder blew up');
      },
    });
    await expect(runResult).rejects.toThrow(/selectForOrder blew up/);
    expect(compSelection.selectForOrder).toHaveBeenCalledTimes(1);
  });
});
