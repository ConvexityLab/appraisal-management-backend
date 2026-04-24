import { describe, expect, it, vi } from 'vitest';
import { VendorOrderReferenceService } from '../../src/services/vendor-integrations/VendorOrderReferenceService.js';
import type { VendorConnection, VendorDomainEvent } from '../../src/types/vendor-integration.types.js';

const connection: VendorConnection = {
  id: 'vc-aim-1',
  tenantId: 'tenant-1',
  vendorType: 'aim-port',
  lenderId: 'lender-1',
  lenderName: 'Sample Lender',
  inboundIdentifier: '501102',
  credentials: {
    inboundApiKeySecretName: 'aim-inbound',
    outboundApiKeySecretName: 'aim-outbound',
    outboundClientId: '501102',
  },
  outboundEndpointUrl: 'https://vendor.example.com/api',
  active: true,
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
};

const event: VendorDomainEvent = {
  id: 'evt-1',
  eventType: 'vendor.order.received',
  vendorType: 'aim-port',
  vendorOrderId: 'AP-1001',
  ourOrderId: null,
  lenderId: 'lender-1',
  tenantId: 'tenant-1',
  occurredAt: '2026-04-23T00:00:00.000Z',
  payload: {
    orderType: 'residential',
    address: '123 Main St',
    city: 'Dallas',
    state: 'TX',
    zipCode: '75001',
    loanNumber: 'LN-1',
    disclosedFee: 550,
    loanAmount: 500000,
    propertyType: 'sfr',
    borrower: {
      name: 'Jane Borrower',
      email: 'jane@example.com',
      phone: '555-111-2222',
    },
    products: [{ id: 49079, name: '1004 Single-family Appraisal' }],
    dueDate: '2026-05-01T00:00:00.000Z',
    rush: false,
    files: [],
  },
};

describe('VendorOrderReferenceService', () => {
  it('returns an existing order reference when the vendor order was already created', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({
        success: true,
        data: [{ id: 'order-existing', orderNumber: 'VND-EXISTING' }],
      }),
      createOrder: vi.fn(),
    };

    const service = new VendorOrderReferenceService(db as any);
    const result = await service.createOrGetOrderReference(connection, event);

    expect(result).toEqual({
      orderId: 'order-existing',
      orderNumber: 'VND-EXISTING',
      existed: true,
    });
    expect(db.createOrder).not.toHaveBeenCalled();
  });

  it('creates a new internal order when the vendor order is first seen', async () => {
    const db = {
      queryItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      createOrder: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'order-new', orderNumber: 'VND-NEW-1' },
      }),
    };

    const service = new VendorOrderReferenceService(db as any);
    const result = await service.createOrGetOrderReference(connection, event);

    expect(result).toEqual({
      orderId: 'order-new',
      orderNumber: 'VND-NEW-1',
      existed: false,
    });
    expect(db.createOrder).toHaveBeenCalledTimes(1);
    expect(db.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      clientId: 'lender-1',
      orderNumber: expect.stringMatching(/^VND-/),
      metadata: expect.objectContaining({
        vendorIntegration: expect.objectContaining({
          connectionId: 'vc-aim-1',
          vendorOrderId: 'AP-1001',
        }),
      }),
    }));
  });
});
