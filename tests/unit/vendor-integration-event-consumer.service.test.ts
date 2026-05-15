import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventCategory } from '../../src/types/events.js';
import { OrderStatus } from '../../src/types/order-status.js';
import { VendorIntegrationEventConsumerService } from '../../src/services/vendor-integration-event-consumer.service.js';

const {
  loadByVendorOrderMock,
  getPropertyAddressMock,
} = vi.hoisted(() => ({
  loadByVendorOrderMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
}));

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrder: loadByVendorOrderMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-123',
    tenantId: 'tenant-1',
    clientId: 'lender-1',
    orderNumber: 'ORD-123',
    productType: 'FULL_APPRAISAL',
    propertyAddress: {
      streetAddress: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75001',
    },
    dueDate: '2026-05-01T00:00:00.000Z',
    status: OrderStatus.NEW,
    metadata: {},
    ...overrides,
  };
}

function makeEvent(type: string, payload: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    type,
    timestamp: new Date('2026-04-23T00:00:00.000Z'),
    source: 'vendor-outbox-worker-service',
    version: '1.0',
    correlationId: 'vendor-outbox:evt-1',
    category: EventCategory.VENDOR,
    data: {
      connectionId: 'vc-1',
      tenantId: 'tenant-1',
      lenderId: 'lender-1',
      vendorType: 'aim-port',
      vendorOrderId: 'AP-1001',
      ourOrderId: 'order-123',
      occurredAt: '2026-04-23T00:00:00.000Z',
      payload,
      priority: 'normal',
      ...overrides,
    },
  } as any;
}

describe('VendorIntegrationEventConsumerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadByVendorOrderMock.mockResolvedValue({ vendorOrder: { id: 'order-123' }, clientOrder: null, property: {} });
    getPropertyAddressMock.mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
    });
  });

  it('publishes canonical order.created when a vendor order is received', async () => {
    const db = {
      getItem: vi.fn().mockResolvedValue({ success: true, data: makeOrder() }),
      updateItem: vi.fn(),
      queryItems: vi.fn(),
      upsertItem: vi.fn(),
    };
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, vi.fn());

    await (service as any).onVendorEvent(makeEvent('vendor.order.received', {
      orderType: 'residential',
      borrower: { name: 'Jane Borrower' },
      address: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75001',
      propertyType: 'sfr',
      products: [{ id: 49079, name: '1004 Single-family Appraisal' }],
      files: [],
      rush: false,
    }));

    expect(publisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'order.created',
      category: EventCategory.ORDER,
      data: expect.objectContaining({
        orderId: 'order-123',
        clientId: 'lender-1',
        propertyAddress: '123 Canonical Main St, Austin, TX',
      }),
    }));
  });

  it('uploads vendor completion files and advances the order to SUBMITTED', async () => {
    const db = {
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: makeOrder({ status: OrderStatus.IN_PROGRESS }),
      }),
      updateItem: vi.fn().mockImplementation(async (_container, _id, updates) => ({
        success: true,
        data: { ...makeOrder({ status: OrderStatus.IN_PROGRESS }), ...updates },
      })),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn(),
    };
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const persistFiles = vi.fn().mockResolvedValue(undefined);
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, persistFiles);

    await (service as any).onVendorEvent(makeEvent('vendor.order.completed', {
      files: [{
        fileId: 'file-1',
        filename: 'report.pdf',
        category: 'appraisal',
        content: 'YmFzZTY0',
      }],
    }));

    expect(persistFiles).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-123',
      files: expect.arrayContaining([expect.objectContaining({ fileId: 'file-1' })]),
    }));
    expect(db.updateItem).toHaveBeenCalledWith(
      'orders',
      'order-123',
      expect.objectContaining({
        status: OrderStatus.SUBMITTED,
        orderStatus: OrderStatus.SUBMITTED,
      }),
      'tenant-1',
    );
    expect(publisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'order.status.changed',
      data: expect.objectContaining({
        orderId: 'order-123',
        previousStatus: OrderStatus.IN_PROGRESS,
        newStatus: OrderStatus.SUBMITTED,
      }),
    }));
  });

  it('uses canonical property address when creating inspection artifacts', async () => {
    const db = {
      getItem: vi.fn().mockResolvedValue({ success: true, data: makeOrder() }),
      updateItem: vi.fn().mockImplementation(async (_container, _id, updates) => ({
        success: true,
        data: { ...makeOrder(), ...updates },
      })),
      queryItems: vi.fn().mockImplementation(async (container: string) => {
        if (container === 'appraisers') {
          return {
            success: true,
            data: [{ id: 'appraiser-1', firstName: 'Avery', lastName: 'Appraiser', phone: '555-0101' }],
          };
        }
        return { success: true, data: [] };
      }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: {} }),
      getContainer: vi.fn(),
    };
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, vi.fn());

    await (service as any).onVendorEvent(makeEvent('vendor.order.scheduled', {
      appraiserId: 'appraiser-1',
      appointmentType: 'property_inspection',
      propertyAccess: 'occupied',
      scheduledSlot: {
        date: '2026-05-02T15:00:00.000Z',
        endDate: '2026-05-02T17:00:00.000Z',
        timezone: 'UTC',
      },
      requestedBy: 'vendor',
      inspectionNotes: 'Bring ID',
    }));

    expect(db.upsertItem).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX',
      }),
    );
  });

  it('records inbound vendor messages as communication records', async () => {
    const db = {
      getItem: vi.fn().mockResolvedValue({ success: true, data: makeOrder() }),
      updateItem: vi.fn(),
      queryItems: vi.fn(),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: { id: 'vendor-communication:evt-1' } }),
    };
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, vi.fn());

    await (service as any).onVendorEvent(makeEvent('vendor.message.received', {
      subject: 'Need updated docs',
      content: 'Please send the revised contract.',
    }));

    expect(db.upsertItem).toHaveBeenCalledWith('communications', expect.objectContaining({
      id: 'vendor-communication:evt-1',
      type: 'communication',
      category: 'order_discussion',
      primaryEntity: expect.objectContaining({ id: 'order-123', type: 'order' }),
      body: 'Please send the revised contract.',
    }));
  });

  it('marks vendor revision requests as REVISION_REQUESTED', async () => {
    const db = {
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: makeOrder({
          status: OrderStatus.SUBMITTED,
          appraiserId: 'vendor-42',
          appraiserName: 'Acme Appraisal Co.',
        }),
      }),
      updateItem: vi.fn().mockImplementation(async (_container, _id, updates) => ({
        success: true,
        data: { ...makeOrder({ status: OrderStatus.SUBMITTED }), ...updates },
      })),
      queryItems: vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: { id: 'vendor-communication:evt-1' } }),
    };
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, vi.fn());

    await (service as any).onVendorEvent(makeEvent('vendor.revision.requested', {
      subject: 'Revision requested',
      content: 'Please revise the report for condition comments.',
    }));

    expect(db.updateItem).toHaveBeenCalledWith(
      'orders',
      'order-123',
      expect.objectContaining({ status: OrderStatus.REVISION_REQUESTED }),
      'tenant-1',
    );
    expect(db.upsertItem).toHaveBeenCalledWith(
      'revisions',
      expect.objectContaining({
        id: 'vendor-revision:evt-1',
        orderId: 'order-123',
        status: 'PENDING',
        assignedTo: 'vendor-42',
        assignedToName: 'Acme Appraisal Co.',
      }),
    );
  });

  it('creates an internal inspection artifact from vendor scheduled events', async () => {
    const db = {
      getItem: vi.fn().mockResolvedValue({
        success: true,
        data: makeOrder({
          status: OrderStatus.ACCEPTED,
          propertyType: 'SFR',
        }),
      }),
      updateItem: vi.fn().mockImplementation(async (_container, _id, updates) => ({
        success: true,
        data: { ...makeOrder({ status: OrderStatus.ACCEPTED }), ...updates },
      })),
      queryItems: vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({
          success: true,
          data: [{ id: 'appraiser-42', firstName: 'Pat', lastName: 'Appraiser', phone: '555-1212' }],
        }),
      upsertItem: vi.fn().mockResolvedValue({ success: true, data: { id: 'vendor-inspection:evt-1' } }),
    };
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, vi.fn());

    await (service as any).onVendorEvent(makeEvent('vendor.order.scheduled', {
      inspectionDate: '2026-04-25',
      appraiserId: 'appraiser-42',
      scheduledSlot: {
        date: '2026-04-25',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'America/Chicago',
      },
      propertyAccess: {
        contactName: 'Jane Borrower',
        contactPhone: '555-0100',
        contactEmail: 'jane@example.com',
        accessInstructions: 'Gate code 1234',
        requiresEscort: false,
      },
      requestedBy: 'client',
      inspectionNotes: 'Borrower requested morning slot.',
      appointmentType: 'property_inspection',
    }));

    expect(db.upsertItem).toHaveBeenCalledWith(
      'orders',
      expect.objectContaining({
        id: 'vendor-inspection:evt-1',
        type: 'inspection',
        orderId: 'order-123',
        appraiserId: 'appraiser-42',
        appraiserName: 'Pat Appraiser',
        appraiserPhone: '555-1212',
        scheduledSlot: expect.objectContaining({
          date: '2026-04-25',
          timezone: 'America/Chicago',
        }),
        propertyAccess: expect.objectContaining({
          contactName: 'Jane Borrower',
          contactPhone: '555-0100',
        }),
      }),
    );
    expect(db.updateItem).toHaveBeenCalledWith(
      'orders',
      'order-123',
      expect.objectContaining({
        status: OrderStatus.INSPECTION_SCHEDULED,
        inspectionScheduledAt: '2026-04-25',
      }),
      'tenant-1',
    );
  });
});

describe('VendorIntegrationEventConsumerService — outbound dispatch', () => {
  function makeDbWithOrder(orderOverrides: Record<string, unknown> = {}) {
    return {
      getItem: vi.fn().mockResolvedValue({ success: true, data: { id: 'order-123', tenantId: 'tenant-1', clientId: 'lender-1', orderNumber: 'ORD-123', status: 'NEW', metadata: {}, ...orderOverrides } }),
      updateItem: vi.fn().mockResolvedValue({ success: true, data: { id: 'order-123', status: 'ASSIGNED', metadata: {} } }),
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      upsertItem: vi.fn().mockResolvedValue({ success: true }),
      getContainer: vi.fn(),
    };
  }

  it('calls outboundDispatcher.dispatch fire-and-forget when dispatcher is provided', async () => {
    const db = makeDbWithOrder();
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const dispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, vi.fn(), dispatcher);

    const event = makeEvent('vendor.order.assigned', {});
    await (service as any).onVendorEvent(event);

    expect(dispatcher.dispatch).toHaveBeenCalledOnce();
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'vendor.order.assigned',
        vendorType: 'aim-port',
        vendorOrderId: 'AP-1001',
        tenantId: 'tenant-1',
      }),
      'vc-1',
    );
  });

  it('does NOT call outboundDispatcher when none is provided', async () => {
    const db = makeDbWithOrder();
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, vi.fn());

    // just confirming no explosion — no dispatcher means no dispatch
    await expect((service as any).onVendorEvent(makeEvent('vendor.order.assigned', {}))).resolves.toBeUndefined();
  });

  it('continues inbound processing even when outboundDispatcher.dispatch rejects', async () => {
    const db = makeDbWithOrder();
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const dispatcher = { dispatch: vi.fn().mockRejectedValue(new Error('connection refused')) };
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, vi.fn(), dispatcher);

    const event = makeEvent('vendor.order.assigned', {});
    // should resolve without throwing despite dispatcher failure
    await expect((service as any).onVendorEvent(event)).resolves.toBeUndefined();
    // internal status update still happened
    expect(db.updateItem).toHaveBeenCalled();
  });

  it('skips dispatch when event has no connectionId', async () => {
    const db = makeDbWithOrder();
    const publisher = { publish: vi.fn().mockResolvedValue(undefined), publishBatch: vi.fn() };
    const dispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };
    const service = new VendorIntegrationEventConsumerService(db as any, publisher as any, vi.fn(), dispatcher);

    const event = makeEvent('vendor.order.assigned', {}, { connectionId: '' });
    await (service as any).onVendorEvent(event);

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('maps VendorIntegrationEvent fields correctly to VendorDomainEvent', () => {
    const service = new VendorIntegrationEventConsumerService(
      { getItem: vi.fn(), updateItem: vi.fn(), queryItems: vi.fn(), upsertItem: vi.fn(), getContainer: vi.fn() } as any,
    );
    const event = makeEvent('vendor.order.completed', { files: [] });
    const domainEvent = (service as any).toVendorDomainEvent(event);

    expect(domainEvent).toEqual({
      id: 'evt-1',
      eventType: 'vendor.order.completed',
      vendorType: 'aim-port',
      vendorOrderId: 'AP-1001',
      ourOrderId: 'order-123',
      lenderId: 'lender-1',
      tenantId: 'tenant-1',
      occurredAt: '2026-04-23T00:00:00.000Z',
      payload: { files: [] },
    });
  });
});