/**
 * WIP Board Service — Tests (Phase 1.9)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WIPBoardService } from '../src/services/wip-board.service';

function createMockDbService(orders: any[] = [], clientOrders: any[] = [], propertyRecords: any[] = []) {
  const mockContainer = {
    items: {
      query: vi.fn().mockReturnValue({
        fetchAll: vi.fn().mockResolvedValue({ resources: orders }),
      }),
    },
  };
  return {
    ordersContainer: mockContainer,
    queryDocuments: vi.fn().mockImplementation((containerName: string) => {
      if (containerName === 'client-orders') {
        return Promise.resolve(clientOrders);
      }
      if (containerName === 'property-records') {
        return Promise.resolve(propertyRecords);
      }
      return Promise.resolve([]);
    }),
    _mockContainer: mockContainer,
  } as any;
}

describe('WIPBoardService', () => {
  describe('getBoard', () => {
    it('should return empty board when no orders', async () => {
      const dbService = createMockDbService([]);
      const service = new WIPBoardService(dbService);
      const board = await service.getBoard('tenant-1');
      expect(board.totalOrders).toBe(0);
      expect(board.columns.length).toBe(5);
      expect(board.columns.map(c => c.category)).toEqual(['intake', 'assignment', 'active', 'review', 'final']);
    });

    it('should categorize orders into correct columns', async () => {
      const orders = [
        { id: '1', orderNumber: 'ORD-1', status: 'NEW', propertyAddress: '123 Main', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: '2', orderNumber: 'ORD-2', status: 'ASSIGNED', propertyAddress: '456 Oak', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: '3', orderNumber: 'ORD-3', status: 'IN_PROGRESS', propertyAddress: '789 Pine', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: '4', orderNumber: 'ORD-4', status: 'QC_REVIEW', propertyAddress: '101 Elm', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: '5', orderNumber: 'ORD-5', status: 'COMPLETED', propertyAddress: '202 Birch', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      ];
      const dbService = createMockDbService(orders);
      const service = new WIPBoardService(dbService);
      const board = await service.getBoard('tenant-1');

      expect(board.totalOrders).toBe(5);
      const intake = board.columns.find(c => c.category === 'intake');
      expect(intake!.totalCount).toBe(1); // NEW
      const assignment = board.columns.find(c => c.category === 'assignment');
      expect(assignment!.totalCount).toBe(1); // ASSIGNED
      const active = board.columns.find(c => c.category === 'active');
      expect(active!.totalCount).toBe(1); // IN_PROGRESS
      const review = board.columns.find(c => c.category === 'review');
      expect(review!.totalCount).toBe(1); // QC_REVIEW
      const final = board.columns.find(c => c.category === 'final');
      expect(final!.totalCount).toBe(1); // COMPLETED
    });

    it('should count overdue orders', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const orders = [
        { id: '1', orderNumber: 'ORD-1', status: 'IN_PROGRESS', dueDate: pastDate, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: '2', orderNumber: 'ORD-2', status: 'IN_PROGRESS', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      ];
      const dbService = createMockDbService(orders);
      const service = new WIPBoardService(dbService);
      const board = await service.getBoard('tenant-1');

      expect(board.overdueOrders).toBe(1);
    });

    it('should filter by search term', async () => {
      const orders = [
        { id: '1', orderNumber: 'ORD-1', status: 'NEW', propertyAddress: '123 Main St', borrowerName: 'Smith', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: '2', orderNumber: 'ORD-2', status: 'NEW', propertyAddress: '456 Oak Ave', borrowerName: 'Jones', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      ];
      const dbService = createMockDbService(orders);
      const service = new WIPBoardService(dbService);
      const board = await service.getBoard('tenant-1', { searchTerm: 'oak' });

      expect(board.totalOrders).toBe(1);
    });

    it('should filter by rush status', async () => {
      const orders = [
        { id: '1', orderNumber: 'ORD-1', status: 'NEW', isRush: true, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { id: '2', orderNumber: 'ORD-2', status: 'NEW', isRush: false, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      ];
      const dbService = createMockDbService(orders);
      const service = new WIPBoardService(dbService);
      const board = await service.getBoard('tenant-1', { isRush: true });

      expect(board.totalOrders).toBe(1);
    });

    it('should count recently updated orders', async () => {
      const recentDate = new Date().toISOString();
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const orders = [
        { id: '1', status: 'NEW', updatedAt: recentDate, createdAt: recentDate },
        { id: '2', status: 'NEW', updatedAt: oldDate, createdAt: oldDate },
      ];
      const dbService = createMockDbService(orders);
      const service = new WIPBoardService(dbService);
      const board = await service.getBoard('tenant-1');

      expect(board.recentlyUpdated).toBe(1);
    });

    it('resolves board addresses from canonical property records instead of embedded vendor-order fields', async () => {
      const orders = [
        {
          id: '1',
          orderNumber: 'ORD-1',
          status: 'NEW',
          propertyId: 'prop-1',
          clientOrderId: 'co-1',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];
      const clientOrders = [
        {
          id: 'co-1',
          propertyId: 'prop-1',
          propertyAddress: { streetAddress: '123 Client Cache St', city: 'Austin', state: 'TX', zipCode: '78701' },
        },
      ];
      const propertyRecords = [
        {
          id: 'prop-1',
          address: { street: '123 Canonical Main St', city: 'Austin', state: 'TX', zip: '78701' },
        },
      ];

      const dbService = createMockDbService(orders, clientOrders, propertyRecords);
      const service = new WIPBoardService(dbService);
      const board = await service.getBoard('tenant-1', { searchTerm: 'canonical' });

      expect(board.totalOrders).toBe(1);
      expect(board.columns[0]?.orders[0]?.propertyAddress).toBe('123 Canonical Main St');
      expect(dbService.queryDocuments).toHaveBeenCalledWith(
        'property-records',
        expect.stringContaining('ARRAY_CONTAINS(@propertyIds, c.id)'),
        expect.any(Array),
      );
    });
  });

  describe('getColumnOrders', () => {
    it('should return empty array when no container', async () => {
      const dbService = { ordersContainer: null } as any;
      const service = new WIPBoardService(dbService);
      const orders = await service.getColumnOrders('tenant-1', 'intake');
      expect(orders).toEqual([]);
    });

    it('resolves column order addresses from client-order/property joins when vendor orders lack embedded address fields', async () => {
      const orders = [
        {
          id: '1',
          orderNumber: 'ORD-1',
          status: 'NEW',
          propertyId: 'prop-1',
          clientOrderId: 'co-1',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];
      const clientOrders = [
        {
          id: 'co-1',
          propertyId: 'prop-1',
          propertyAddress: { streetAddress: '123 Client Cache St', city: 'Austin', state: 'TX', zipCode: '78701' },
        },
      ];
      const propertyRecords = [
        {
          id: 'prop-1',
          address: { street: '123 Canonical Main St', city: 'Austin', state: 'TX', zip: '78701' },
        },
      ];

      const dbService = createMockDbService(orders, clientOrders, propertyRecords);
      const service = new WIPBoardService(dbService);
      const result = await service.getColumnOrders('tenant-1', 'intake');

      expect(result).toHaveLength(1);
      expect(result[0]?.propertyAddress).toBe('123 Canonical Main St');
    });
  });
});
