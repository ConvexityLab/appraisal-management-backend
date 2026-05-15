import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventCategory } from '../../src/types/events.js';
import { OrderStatus, Priority } from '../../src/types/index.js';

const { publishMock } = vi.hoisted(() => ({
  publishMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/service-bus-publisher.js', () => ({
  ServiceBusEventPublisher: vi.fn().mockImplementation(() => ({
    publish: publishMock,
  })),
}));

import { OrderManagementService } from '../../src/services/order-management.service.js';

function makeDependencies() {
  return {
    db: {
      orders: {
        create: vi.fn().mockResolvedValue(undefined),
        findById: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      properties: {
        findById: vi.fn().mockResolvedValue({
          id: 'prop-1',
          address: {
            streetAddress: '123 Canonical Main St',
            city: 'Austin',
            state: 'TX',
            zipCode: '78701',
            county: 'Travis',
          },
        }),
      },
    },
    vendorService: {
      checkVendorAvailability: vi.fn(),
      findBestVendorForOrder: vi.fn(),
      updateVendorPerformance: vi.fn(),
    },
    notificationService: {
      notifyVendorAssignment: vi.fn(),
      scheduleVendorReminder: vi.fn().mockResolvedValue(undefined),
      notifyVendorCancellation: vi.fn(),
    },
    auditService: {
      logActivity: vi.fn().mockResolvedValue(undefined),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe('OrderManagementService canonical property publishing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows canonical propertyId-only order creation without embedded propertyAddress', async () => {
    const deps = makeDependencies();
    const service = new OrderManagementService(
      deps.db as any,
      deps.vendorService as any,
      deps.notificationService as any,
      deps.auditService as any,
      deps.logger as any,
    );

    const result = await service.createOrder({
      clientId: 'client-1',
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      orderNumber: 'ORD-001A',
      propertyId: 'prop-1',
      orderType: 'PURCHASE',
      productType: 'FULL_APPRAISAL',
      priority: Priority.NORMAL,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: OrderStatus.NEW,
    } as any);

    expect(result.success).toBe(true);
    expect(deps.db.orders.create).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: 'prop-1',
    }));
    expect(deps.db.orders.create.mock.calls[0]?.[0]).not.toHaveProperty('propertyAddress');
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX 78701',
      }),
    }));
  });

  it('rejects order creation when both propertyAddress and propertyId are missing', async () => {
    const deps = makeDependencies();
    const service = new OrderManagementService(
      deps.db as any,
      deps.vendorService as any,
      deps.notificationService as any,
      deps.auditService as any,
      deps.logger as any,
    );

    const result = await service.createOrder({
      clientId: 'client-1',
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      orderNumber: 'ORD-001B',
      orderType: 'PURCHASE',
      productType: 'FULL_APPRAISAL',
      priority: Priority.NORMAL,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: OrderStatus.NEW,
    } as any);

    expect(result.success).toBe(false);
    expect(result.error?.details).toEqual(expect.objectContaining({
      error: 'Property address or propertyId is required',
    }));
    expect(deps.db.orders.create).not.toHaveBeenCalled();
  });

  it('publishes order.created with canonical property address when propertyId resolves', async () => {
    const deps = makeDependencies();
    const service = new OrderManagementService(
      deps.db as any,
      deps.vendorService as any,
      deps.notificationService as any,
      deps.auditService as any,
      deps.logger as any,
    );

    const result = await service.createOrder({
      clientId: 'client-1',
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      orderNumber: 'ORD-001',
      propertyId: 'prop-1',
      propertyAddress: {
        streetAddress: 'Legacy Address',
        city: 'Legacy City',
        state: 'CA',
        zipCode: '90001',
        county: 'Legacy County',
      },
      orderType: 'PURCHASE',
      productType: 'FULL_APPRAISAL',
      priority: Priority.NORMAL,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: OrderStatus.NEW,
    } as any);

    expect(result.success).toBe(true);
    expect(deps.db.properties.findById).toHaveBeenCalledWith('prop-1');
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'order.created',
      category: EventCategory.ORDER,
      data: expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX 78701',
      }),
    }));
  });
});
