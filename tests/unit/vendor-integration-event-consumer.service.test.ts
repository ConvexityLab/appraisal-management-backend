import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventCategory } from '../../src/types/events.js';
import { OrderStatus } from '../../src/types/order-status.js';
import { VendorIntegrationEventConsumerService } from '../../src/services/vendor-integration-event-consumer.service.js';

vi.mock('../../src/services/service-bus-subscriber.js', () => ({
  ServiceBusEventSubscriber: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  })),
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