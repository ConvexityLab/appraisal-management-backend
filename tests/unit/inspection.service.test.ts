import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadByVendorOrderMock,
  getPropertyAddressMock,
} = vi.hoisted(() => ({
  loadByVendorOrderMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrder: loadByVendorOrderMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

import { InspectionService } from '../../src/services/inspection.service.js';

function createOrdersContainer() {
  const createMock = vi.fn().mockResolvedValue({});

  return {
    items: {
      create: createMock,
      query: vi.fn().mockReturnValue({
        fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
      }),
    },
    item: vi.fn((id: string) => ({
      read: vi.fn().mockResolvedValue(
        id === 'order-1'
          ? {
              resource: {
                id: 'order-1',
                orderNumber: 'ORD-001',
                engagementId: 'eng-1',
                engagementPropertyId: 'prop-1',
                engagementClientOrderId: 'co-1',
                propertyAddress: {
                  streetAddress: '999 Legacy Main St',
                  city: 'Legacy City',
                  state: 'TX',
                  zipCode: '73301',
                },
                propertyType: 'SFR',
              },
            }
          : {
              resource: {
                id: 'appraiser-1',
                firstName: 'Pat',
                lastName: 'Appraiser',
                phone: '555-0100',
              },
            },
      ),
    })),
    createMock,
  };
}

describe('InspectionService scheduleInspection canonical property context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadByVendorOrderMock.mockResolvedValue({
      vendorOrder: { id: 'order-1' },
      clientOrder: null,
      property: {},
    });
    getPropertyAddressMock.mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    });
  });

  it('stores canonical property text when scheduling an inspection', async () => {
    const ordersContainer = createOrdersContainer();
    const service = new InspectionService({
      getContainer: vi.fn().mockReturnValue(ordersContainer),
    } as any);
    vi.spyOn(service, 'checkSchedulingConflict').mockResolvedValue({ hasConflict: false });

    const inspection = await service.scheduleInspection({
      orderId: 'order-1',
      appraiserId: 'appraiser-1',
      scheduledSlot: {
        date: '2026-05-11',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'America/Chicago',
      },
      propertyAccess: {
        contactName: 'Jane Owner',
        contactPhone: '555-0101',
        requiresEscort: false,
      },
      requestedBy: 'system',
    }, 'tenant-1', 'user-1');

    expect(loadByVendorOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      { includeProperty: true },
    );
    expect(inspection.propertyAddress).toBe('123 Canonical Main St, Austin, TX, 78701');
    expect(ordersContainer.createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyAddress: '123 Canonical Main St, Austin, TX, 78701',
      }),
    );
  });

  it('falls back to the embedded order address when canonical property lookup fails', async () => {
    loadByVendorOrderMock.mockRejectedValueOnce(new Error('canonical lookup failed'));
    const ordersContainer = createOrdersContainer();
    const service = new InspectionService({
      getContainer: vi.fn().mockReturnValue(ordersContainer),
    } as any);
    vi.spyOn(service, 'checkSchedulingConflict').mockResolvedValue({ hasConflict: false });

    const inspection = await service.scheduleInspection({
      orderId: 'order-1',
      appraiserId: 'appraiser-1',
      scheduledSlot: {
        date: '2026-05-11',
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'America/Chicago',
      },
      propertyAccess: {
        contactName: 'Jane Owner',
        contactPhone: '555-0101',
        requiresEscort: false,
      },
      requestedBy: 'system',
    }, 'tenant-1', 'user-1');

    expect(inspection.propertyAddress).toBe('999 Legacy Main St, Legacy City, TX, 73301');
  });
});