import { describe, expect, it, vi } from 'vitest';
import { VendorMatchingEngine } from '../../src/services/vendor-matching-engine.service.js';
import type { VendorMatchRequest } from '../../src/types/vendor-marketplace.types.js';

describe('VendorMatchingEngine bid persistence', () => {
  it('omits persisted propertyAddress from vendor-bid invitations', async () => {
    const engine = new VendorMatchingEngine() as any;
    const createItem = vi.fn().mockResolvedValue({});

    engine.dbService = {
      createItem,
    };

    engine.findMatchingVendors = vi.fn().mockResolvedValue([
      {
        vendorId: 'vendor-1',
        matchScore: 92,
      },
    ]);

    const request: VendorMatchRequest = {
      orderId: 'order-1',
      tenantId: 'tenant-1',
      propertyAddress: '123 Main St, Dallas, TX 75001',
      propertyType: 'SFR',
      urgency: 'STANDARD',
    };

    await engine.broadcastToVendors(request, 1, 24);

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith('vendor-bids', expect.any(Object));

    const persistedInvitation = createItem.mock.calls[0]?.[1];
    expect(persistedInvitation).toBeDefined();
    expect(persistedInvitation).not.toHaveProperty('propertyAddress');
    expect(persistedInvitation).toMatchObject({
      orderId: 'order-1',
      vendorId: 'vendor-1',
      tenantId: 'tenant-1',
      propertyType: 'SFR',
      status: 'PENDING',
      entityType: 'vendor-bid-invitation',
    });
  });
});