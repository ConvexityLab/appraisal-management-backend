/**
 * WIP Board Service — Tests (Phase 1.9)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WIPBoardService } from '../src/services/wip-board.service';

function createMockDbService(orders: any[] = []) {
  const mockContainer = {
    items: {
      query: vi.fn().mockReturnValue({
        fetchAll: vi.fn().mockResolvedValue({ resources: orders }),
      }),
    },
  };
  return {
    ordersContainer: mockContainer,
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
  });

  describe('getColumnOrders', () => {
    it('should return empty array when no container', async () => {
      const dbService = { ordersContainer: null } as any;
      const service = new WIPBoardService(dbService);
      const orders = await service.getColumnOrders('tenant-1', 'intake');
      expect(orders).toEqual([]);
    });
  });
});
