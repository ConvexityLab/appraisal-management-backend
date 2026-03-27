/**
 * Engagement Letter Service — Tests (Phase 1.1)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EngagementLetterService } from '../src/services/engagement-letter.service';

// Mock the CosmosDbService container
function createMockDbService() {
  const items: any[] = [];
  let orderData: any = null;
  const mockContainer = {
    items: {
      query: vi.fn().mockReturnValue({
        fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
      }),
      upsert: vi.fn().mockImplementation(async (item: any) => {
        items.push(item);
        return { resource: item };
      }),
      create: vi.fn().mockImplementation(async (item: any) => {
        items.push(item);
        return { resource: item };
      }),
    },
    item: vi.fn().mockReturnValue({
      read: vi.fn().mockResolvedValue({ resource: null }),
    }),
  };
  return {
    ordersContainer: mockContainer,
    vendorsContainer: mockContainer,
    getContainer: vi.fn().mockReturnValue(mockContainer),
    findOrderById: vi.fn().mockImplementation(async () => ({ success: !!orderData, data: orderData })),
    findVendorById: vi.fn().mockResolvedValue({ success: true, data: { name: 'Test Appraiser', email: 'test@appraiser.com', licenseNumber: 'LIC-123', licenseState: 'CA' } }),
    _items: items,
    _mockContainer: mockContainer,
    _setOrderData(data: any) { orderData = data; },
  } as any;
}

describe('EngagementLetterService', () => {
  let service: EngagementLetterService;
  let dbService: ReturnType<typeof createMockDbService>;

  beforeEach(() => {
    dbService = createMockDbService();
    service = new EngagementLetterService(dbService);
  });

  describe('generateEngagementLetter', () => {
    it('should generate a letter for a standard product', async () => {
      dbService._setOrderData({
        id: 'ORD-001',
        orderNumber: 'ORD-001',
        productType: 'STANDARD',
        propertyAddress: { streetAddress: '123 Main St', city: 'Anytown', state: 'CA', zipCode: '90210' },
        borrowerInformation: { firstName: 'John', lastName: 'Doe' },
        fee: 500,
      });

      const result = await service.generateEngagementLetter({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        productType: 'STANDARD',
        vendorId: 'vendor-1',
      });

      expect(result).toBeDefined();
      expect(result.orderId).toBe('ORD-001');
      expect(result.status).toBeDefined();
    });

    it('should generate a letter for a rush product', async () => {
      dbService._setOrderData({
        id: 'ORD-002',
        orderNumber: 'ORD-002',
        productType: 'RUSH',
        propertyAddress: { streetAddress: '456 Oak Ave', city: 'Somewhere', state: 'TX', zipCode: '75001' },
        borrowerInformation: { firstName: 'Jane', lastName: 'Smith' },
        fee: 750,
      });

      const result = await service.generateEngagementLetter({
        orderId: 'ORD-002',
        tenantId: 'tenant-1',
        productType: 'RUSH',
        vendorId: 'vendor-1',
      });

      expect(result).toBeDefined();
      expect(result.orderId).toBe('ORD-002');
    });

    it('should save the letter record to Cosmos', async () => {
      dbService._setOrderData({
        id: 'ORD-003',
        productType: 'STANDARD',
        propertyAddress: { streetAddress: '789 Pine Ln' },
        borrowerInformation: { firstName: 'Bob', lastName: 'Jones' },
        fee: 500,
      });

      await service.generateEngagementLetter({
        orderId: 'ORD-003',
        tenantId: 'tenant-1',
        productType: 'STANDARD',
      });

      // At least one create call should have been made (saveLetterRecord uses create)
      expect(dbService._mockContainer.items.create).toHaveBeenCalled();
    });
  });

  describe('getLettersForOrder', () => {
    it('should return empty array when no letters exist', async () => {
      const letters = await service.getLettersForOrder('ORD-999', 'tenant-1');
      expect(letters).toEqual([]);
    });
  });
});
