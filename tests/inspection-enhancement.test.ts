/**
 * Inspection Enhancement Service — Tests (Phase 1.7)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InspectionEnhancementService } from '../src/services/inspection-enhancement.service';

function createMockDbService() {
  const store: Record<string, any> = {};
  const mockContainer = {
    items: {
      query: vi.fn().mockImplementation(({ query, parameters }: any) => ({
        fetchAll: vi.fn().mockImplementation(async () => {
          let results = Object.values(store);
          if (query.includes("type = 'borrower-contact-attempt'")) {
            results = results.filter((i: any) => i.type === 'borrower-contact-attempt');
          }
          if (query.includes("type = 'inspection'")) {
            results = results.filter((i: any) => i.type === 'inspection');
          }
          if (query.includes("type = 'order'")) {
            results = results.filter((i: any) => i.type === 'order');
          }
          for (const p of parameters ?? []) {
            if (p.name === '@iid') results = results.filter((i: any) => i.inspectionId === p.value);
            if (p.name === '@oid') results = results.filter((i: any) => i.orderId === p.value);
            if (p.name === '@tid') results = results.filter((i: any) => i.tenantId === p.value);
          }
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

describe('InspectionEnhancementService', () => {
  let service: InspectionEnhancementService;
  let dbService: ReturnType<typeof createMockDbService>;

  beforeEach(() => {
    dbService = createMockDbService();
    service = new InspectionEnhancementService(dbService);
  });

  describe('recordContactAttempt', () => {
    it('should record a contact attempt', async () => {
      const attempt = await service.recordContactAttempt({
        inspectionId: 'insp-1',
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        attemptedBy: 'user-1',
        attemptedAt: new Date().toISOString(),
        method: 'PHONE',
        outcome: 'CONNECTED',
      });
      expect(attempt.id).toMatch(/^bca-/);
      expect(attempt.method).toBe('PHONE');
      expect(attempt.outcome).toBe('CONNECTED');
    });
  });

  describe('getContactLog', () => {
    it('should return empty log when no attempts', async () => {
      const log = await service.getContactLog('insp-1', 'tenant-1');
      expect(log.totalAttempts).toBe(0);
      expect(log.successfulContact).toBe(false);
    });

    it('should aggregate contact attempts', async () => {
      await service.recordContactAttempt({
        inspectionId: 'insp-1', orderId: 'ORD-001', tenantId: 'tenant-1',
        attemptedBy: 'user-1', attemptedAt: '2026-01-15T10:00:00Z',
        method: 'PHONE', outcome: 'NO_ANSWER',
      });
      await service.recordContactAttempt({
        inspectionId: 'insp-1', orderId: 'ORD-001', tenantId: 'tenant-1',
        attemptedBy: 'user-1', attemptedAt: '2026-01-15T14:00:00Z',
        method: 'PHONE', outcome: 'CONNECTED',
      });

      const log = await service.getContactLog('insp-1', 'tenant-1');
      expect(log.totalAttempts).toBe(2);
      expect(log.successfulContact).toBe(true);
    });

    it('should detect scheduled outcome', async () => {
      await service.recordContactAttempt({
        inspectionId: 'insp-1', orderId: 'ORD-001', tenantId: 'tenant-1',
        attemptedBy: 'user-1', attemptedAt: '2026-01-15T10:00:00Z',
        method: 'PHONE', outcome: 'SCHEDULED',
        scheduledDate: '2026-01-20T09:00:00Z',
      });

      const log = await service.getContactLog('insp-1', 'tenant-1');
      expect(log.successfulContact).toBe(true);
      expect(log.scheduledAt).toBe('2026-01-20T09:00:00Z');
    });
  });

  describe('checkSLACompliance', () => {
    it('should report compliant when within deadline', async () => {
      const recentAssignment = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago
      const status = await service.checkSLACompliance('ORD-001', 'tenant-1', recentAssignment);
      expect(status.isCompliant).toBe(true);
      expect(status.violations).toHaveLength(0);
    });

    it('should flag violations when first contact deadline missed', async () => {
      const oldAssignment = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago
      const status = await service.checkSLACompliance('ORD-001', 'tenant-1', oldAssignment);
      expect(status.isCompliant).toBe(false);
      expect(status.violations.length).toBeGreaterThan(0);
      expect(status.firstContactMade).toBe(false);
    });

    it('should use custom SLA config to extend deadline', async () => {
      const assignment = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(); // 10 hours ago
      const status = await service.checkSLACompliance('ORD-001', 'tenant-1', assignment, {
        firstContactDeadlineHours: 12,
        schedulingDeadlineHours: 48,
      });
      // 10h < 12h custom deadline => still compliant
      expect(status.isCompliant).toBe(true);
      expect(status.violations).toHaveLength(0);
    });
  });
});
