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

import { VendorManagementService } from '../../src/services/vendor-management.service.js';
import { VendorStatus } from '../../src/types/index.js';

describe('VendorManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadByVendorOrderMock.mockResolvedValue({ vendorOrder: { id: 'order-1' }, clientOrder: null, property: {} });
    getPropertyAddressMock.mockReturnValue({
      streetAddress: '123 Canonical Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
    });
  });

  it('filters available vendors by canonical property state instead of embedded order state', async () => {
    const db = {
      findAllVendors: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'vendor-tx',
            name: 'Texas Vendor',
            status: VendorStatus.ACTIVE,
            serviceAreas: [{ state: 'TX' }],
            productTypes: ['FULL_APPRAISAL'],
          },
          {
            id: 'vendor-ca',
            name: 'California Vendor',
            status: VendorStatus.ACTIVE,
            serviceAreas: [{ state: 'CA' }],
            productTypes: ['FULL_APPRAISAL'],
          },
        ],
      }),
    };

    const service = new VendorManagementService(db as any);
    const vendors = await service.findAvailableVendors({
      id: 'order-1',
      tenantId: 'tenant-1',
      productType: 'FULL_APPRAISAL',
      propertyAddress: { state: 'CA' },
    } as any);

    expect(loadByVendorOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      { includeProperty: true },
    );
    expect(vendors.map((vendor) => vendor.id)).toEqual(['vendor-tx']);
  });
});
