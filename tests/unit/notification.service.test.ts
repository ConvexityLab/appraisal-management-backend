import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  sendEmailMock,
  findVendorByIdMock,
  loadByVendorOrderMock,
  getPropertyAddressMock,
} = vi.hoisted(() => ({
  sendEmailMock: vi.fn().mockResolvedValue({ success: true }),
  findVendorByIdMock: vi.fn(),
  loadByVendorOrderMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
}));

vi.mock('../../src/services/email-notification.service.js', () => ({
  EmailNotificationService: vi.fn().mockImplementation(() => ({
    sendEmail: sendEmailMock,
  })),
}));

vi.mock('../../src/services/cosmos-db.service.js', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({
    findVendorById: findVendorByIdMock,
    getContainer: vi.fn().mockReturnValue({
      items: {
        create: vi.fn().mockResolvedValue({}),
      },
    }),
  })),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrder: loadByVendorOrderMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

import { NotificationService } from '../../src/services/notification.service.js';

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findVendorByIdMock.mockResolvedValue({
      success: true,
      data: { email: 'vendor@example.com', name: 'Vendor One' },
    });
    loadByVendorOrderMock.mockResolvedValue({ vendorOrder: { id: 'order-1' }, clientOrder: null, property: {} });
    getPropertyAddressMock.mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    });
  });

  it('uses canonical order-context address accessors for vendor assignment emails', async () => {
    const service = new NotificationService();

    await service.notifyVendorAssignment('vendor-1', {
      id: 'order-1',
      propertyId: 'prop-1',
      clientOrderId: 'co-1',
      tenantId: 'tenant-1',
      propertyAddress: undefined,
      productType: 'Standard',
      priority: 'normal',
    } as any);

    expect(loadByVendorOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      { includeProperty: true },
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlBody: expect.stringContaining('123 Canonical Main St, Austin, TX, 78701'),
      }),
      expect.any(String),
    );
  });

  it('falls back to legacy string property addresses when canonical lookup fails', async () => {
    loadByVendorOrderMock.mockRejectedValueOnce(new Error('canonical load failed'));

    const service = new NotificationService();

    await service.notifyVendorAssignment('vendor-1', {
      id: 'order-2',
      tenantId: 'tenant-1',
      propertyAddress: '999 Legacy Main St, Legacy City, TX, 73301',
      productType: 'Standard',
      priority: 'normal',
    } as any);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlBody: expect.stringContaining('999 Legacy Main St, Legacy City, TX, 73301'),
      }),
      expect.any(String),
    );
  });
});