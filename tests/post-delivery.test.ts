/**
 * Post-Delivery Service — Tests (Phase 1.10)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostDeliveryService } from '../src/services/post-delivery.service';

function createMockDbService() {
  const store: Record<string, any> = {};
  const mockContainer = {
    items: {
      query: vi.fn().mockImplementation(({ parameters }: any) => ({
        fetchAll: vi.fn().mockImplementation(async () => {
          const results = Object.values(store).filter((item: any) => {
            if (item.type !== 'post-delivery-task') return false;
            for (const p of parameters ?? []) {
              if (p.name === '@oid' && item.orderId !== p.value) return false;
              if (p.name === '@tid' && item.tenantId !== p.value) return false;
              if (p.name === '@id' && item.id !== p.value) return false;
            }
            return true;
          });
          return { resources: results };
        }),
      })),
      upsert: vi.fn().mockImplementation(async (item: any) => {
        store[item.id] = item;
        return { resource: item };
      }),
    },
  };
  return {
    ordersContainer: mockContainer,
    _store: store,
    _mockContainer: mockContainer,
  } as any;
}

describe('PostDeliveryService', () => {
  let service: PostDeliveryService;
  let dbService: ReturnType<typeof createMockDbService>;

  beforeEach(() => {
    dbService = createMockDbService();
    service = new PostDeliveryService(dbService);
  });

  describe('createTask', () => {
    it('should create a task with default fields', async () => {
      const task = await service.createTask({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        taskType: 'DELIVERY_CONFIRMATION',
      });
      expect(task.id).toMatch(/^pdt-/);
      expect(task.status).toBe('PENDING');
      expect(task.taskType).toBe('DELIVERY_CONFIRMATION');
      expect(task.title).toBe('Confirm delivery receipt');
    });

    it('should use custom title when provided', async () => {
      const task = await service.createTask({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        taskType: 'ARCHIVE_REPORT',
        title: 'Custom archive task',
      });
      expect(task.title).toBe('Custom archive task');
    });
  });

  describe('generateDeliveryTasks', () => {
    it('should generate standard post-delivery tasks (no recert)', async () => {
      const tasks = await service.generateDeliveryTasks('ORD-001', 'tenant-1');
      expect(tasks.length).toBe(4); // confirmation, QC, archive, MISMO verify
      expect(tasks.map(t => t.taskType)).toContain('DELIVERY_CONFIRMATION');
      expect(tasks.map(t => t.taskType)).toContain('POST_DELIVERY_QC');
      expect(tasks.map(t => t.taskType)).toContain('ARCHIVE_REPORT');
      expect(tasks.map(t => t.taskType)).toContain('MISMO_SUBMISSION_VERIFY');
    });

    it('should include 1004D recertification when effective date provided', async () => {
      const tasks = await service.generateDeliveryTasks('ORD-002', 'tenant-1', '2026-01-15');
      expect(tasks.length).toBe(5);
      const recert = tasks.find(t => t.taskType === 'RECERTIFICATION_1004D');
      expect(recert).toBeDefined();
      expect(recert!.appraisalEffectiveDate).toBe('2026-01-15');
      expect(recert!.recertificationDeadline).toBeDefined();
    });
  });

  describe('completeTask', () => {
    it('should complete a pending task', async () => {
      const task = await service.createTask({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        taskType: 'DELIVERY_CONFIRMATION',
      });
      const completed = await service.completeTask(task.id, 'tenant-1', 'user-1', 'All good');
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedBy).toBe('user-1');
      expect(completed.completedAt).toBeDefined();
    });

    it('should throw on already completed task', async () => {
      const task = await service.createTask({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        taskType: 'DELIVERY_CONFIRMATION',
      });
      await service.completeTask(task.id, 'tenant-1', 'user-1');
      await expect(service.completeTask(task.id, 'tenant-1', 'user-1')).rejects.toThrow('already COMPLETED');
    });

    it('should throw on non-existent task', async () => {
      await expect(service.completeTask('pdt-nonexistent', 'tenant-1', 'user-1')).rejects.toThrow('not found');
    });
  });

  describe('getTasksForOrder', () => {
    it('should return tasks for a specific order', async () => {
      await service.createTask({ orderId: 'ORD-001', tenantId: 'tenant-1', taskType: 'ARCHIVE_REPORT' });
      await service.createTask({ orderId: 'ORD-001', tenantId: 'tenant-1', taskType: 'POST_DELIVERY_QC' });
      await service.createTask({ orderId: 'ORD-002', tenantId: 'tenant-1', taskType: 'ARCHIVE_REPORT' });

      const tasks = await service.getTasksForOrder('ORD-001', 'tenant-1');
      expect(tasks.length).toBe(2);
    });
  });

  describe('checkRecertificationStatus', () => {
    it('should return null when no recert task exists', async () => {
      await service.createTask({ orderId: 'ORD-001', tenantId: 'tenant-1', taskType: 'ARCHIVE_REPORT' });
      const result = await service.checkRecertificationStatus('ORD-001', 'tenant-1');
      expect(result).toBeNull();
    });

    it('should return recert status when task exists', async () => {
      // Use a recent (but not future) effective date so the 120-day recert
      // window is still active at test time. Previously hardcoded
      // '2026-01-15' which aged out after the 120-day window elapsed and
      // made daysRemaining=0 once real-world time passed May 2026.
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]!;
      await service.generateDeliveryTasks('ORD-001', 'tenant-1', thirtyDaysAgo);
      const result = await service.checkRecertificationStatus('ORD-001', 'tenant-1');
      expect(result).toBeDefined();
      expect(result!.orderId).toBe('ORD-001');
      expect(result!.effectiveDate).toBe(thirtyDaysAgo);
      expect(result!.daysRemaining).toBeGreaterThan(0);
    });
  });
});
