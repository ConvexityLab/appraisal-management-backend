import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  sendEmailMock,
  sendSmsMock,
  findVendorByIdMock,
  loadByVendorOrderMock,
  getPropertyAddressMock,
  isServiceConfiguredMock,
} = vi.hoisted(() => ({
  sendEmailMock: vi.fn().mockResolvedValue(undefined),
  sendSmsMock: vi.fn().mockResolvedValue(undefined),
  findVendorByIdMock: vi.fn(),
  loadByVendorOrderMock: vi.fn(),
  getPropertyAddressMock: vi.fn(),
  isServiceConfiguredMock: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/services/cosmos-db.service.js', () => ({
  CosmosDbService: vi.fn().mockImplementation(() => ({
    findVendorById: findVendorByIdMock,
  })),
}));

vi.mock('../../src/services/email-notification.service.js', () => ({
  EmailNotificationService: vi.fn().mockImplementation(() => ({
    sendEmail: sendEmailMock,
  })),
}));

vi.mock('../../src/services/sms-notification.service.js', () => ({
  SmsNotificationService: vi.fn().mockImplementation(() => ({
    sendSms: sendSmsMock,
  })),
}));

vi.mock('../../src/services/teams.service.js', () => ({
  TeamsService: vi.fn().mockImplementation(() => ({
    isServiceConfigured: isServiceConfiguredMock,
    sendChannelMessage: vi.fn(),
  })),
}));

vi.mock('../../src/services/order-context-loader.service.js', () => ({
  OrderContextLoader: vi.fn().mockImplementation(() => ({
    loadByVendorOrder: loadByVendorOrderMock,
  })),
  getPropertyAddress: getPropertyAddressMock,
}));

import { OrderNotificationService } from '../../src/services/order-notification.service.js';

describe('OrderNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findVendorByIdMock.mockResolvedValue({
      success: true,
      data: {
        id: 'vendor-1',
        name: 'Vendor One',
        email: 'vendor@example.com',
        phone: '+15551230000',
      },
    });
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
      county: 'Travis',
    });
  });

  it('uses canonical order-context property accessors for vendor assignment notifications', async () => {
    const service = new OrderNotificationService();

    await service.notifyVendorAssigned({
      id: 'order-1',
      tenantId: 'tenant-1',
      orderNumber: 'ORD-001',
      assignedVendorId: 'vendor-1',
      dueDate: '2026-05-10T00:00:00.000Z',
      propertyId: 'prop-1',
      clientOrderId: 'client-1',
      propertyAddress: {
        streetAddress: 'Legacy Address',
        city: 'Legacy City',
        state: 'TX',
        zipCode: '73301',
        county: 'Travis',
      },
    } as any);

    expect(loadByVendorOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      { includeProperty: true },
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlBody: expect.stringContaining('123 Canonical Main St, Austin, TX, 78701'),
      }),
      'tenant-1',
    );
    expect(sendSmsMock).toHaveBeenCalledWith(
      '+15551230000',
      expect.stringContaining('123 Canonical Main St, Austin, TX, 78701'),
      'tenant-1',
    );
  });
});