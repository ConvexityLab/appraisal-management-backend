/**
 * Billing Enhancement Service — Tests (Phase 1.8)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingEnhancementService } from '../src/services/billing-enhancement.service';

function createMockDbService() {
  const store: Record<string, any> = {};
  const mockContainer = {
    items: {
      query: vi.fn().mockImplementation(({ parameters }: any) => ({
        fetchAll: vi.fn().mockImplementation(async () => {
          let results = Object.values(store);
          for (const p of parameters ?? []) {
            if (p.name === '@tid') results = results.filter((i: any) => i.tenantId === p.value);
            if (p.name === '@oid') results = results.filter((i: any) => (i.orderId ?? i.id) === p.value);
            if (p.name === '@id') results = results.filter((i: any) => i.id === p.value);
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
    findVendorById: vi.fn().mockResolvedValue({ success: false }),
    _store: store,
  } as any;
}

function seedInvoice(db: any, overrides: Record<string, any>) {
  const inv = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'invoice',
    tenantId: 'tenant-1',
    vendorId: 'vendor-1',
    vendorName: 'Acme Appraisals',
    totalAmount: 500,
    amountPaid: 0,
    amountDue: 500,
    issueDate: new Date().toISOString(),
    status: 'SENT',
    ...overrides,
  };
  db._store[inv.id] = inv;
  return inv;
}

describe('BillingEnhancementService', () => {
  let service: BillingEnhancementService;
  let dbService: ReturnType<typeof createMockDbService>;

  beforeEach(() => {
    dbService = createMockDbService();
    service = new BillingEnhancementService(dbService);
  });

  describe('generateAgingReport', () => {
    it('should return empty report when no invoices', async () => {
      const report = await service.generateAgingReport('tenant-1');
      expect(report.totalOutstanding).toBe(0);
      expect(report.buckets).toHaveLength(5);
      expect(report.buckets.every(b => b.invoiceCount === 0)).toBe(true);
    });

    it('should place invoice in correct aging bucket', async () => {
      const issueDate45DaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
      seedInvoice(dbService, {
        issueDate: issueDate45DaysAgo,
        amountDue: 750,
        totalAmount: 750,
        amountPaid: 0,
      });

      const report = await service.generateAgingReport('tenant-1');
      // 45 days ago => "31-60 Days" bucket
      const bucket31to60 = report.buckets.find(b => b.label === '31-60 Days')!;
      expect(bucket31to60.invoiceCount).toBe(1);
      expect(bucket31to60.totalAmount).toBe(750);
      expect(report.totalOutstanding).toBe(750);
    });

    it('should track top delinquent vendors', async () => {
      seedInvoice(dbService, { vendorId: 'v1', vendorName: 'Vendor A', amountDue: 500 });
      seedInvoice(dbService, { vendorId: 'v2', vendorName: 'Vendor B', amountDue: 1000 });
      seedInvoice(dbService, { vendorId: 'v2', vendorName: 'Vendor B', amountDue: 200 });

      const report = await service.generateAgingReport('tenant-1');
      expect(report.topDelinquent[0].vendorId).toBe('v2');
      expect(report.topDelinquent[0].amount).toBe(1200);
      expect(report.topDelinquent[1].vendorId).toBe('v1');
    });
  });

  describe('batchCreateInvoices', () => {
    it('should create invoices for orders with fees', async () => {
      dbService._store['ORD-001'] = {
        id: 'ORD-001', type: 'order', tenantId: 'tenant-1',
        vendorId: 'vendor-1', fee: 450,
      };
      dbService._store['ORD-002'] = {
        id: 'ORD-002', type: 'order', tenantId: 'tenant-1',
        vendorId: 'vendor-2', appraisalFee: 600,
      };

      const result = await service.batchCreateInvoices({
        tenantId: 'tenant-1',
        orderIds: ['ORD-001', 'ORD-002'],
        createdBy: 'user-1',
      });

      expect(result.success).toBe(true);
      expect(result.invoicesCreated).toBe(2);
      expect(result.totalAmount).toBe(1050);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for missing orders', async () => {
      const result = await service.batchCreateInvoices({
        tenantId: 'tenant-1',
        orderIds: ['ORD-999'],
        createdBy: 'user-1',
      });

      expect(result.success).toBe(false);
      expect(result.invoicesCreated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('not found');
    });

    it('should skip orders with no vendor', async () => {
      dbService._store['ORD-001'] = {
        id: 'ORD-001', type: 'order', tenantId: 'tenant-1', fee: 450,
      };

      const result = await service.batchCreateInvoices({
        tenantId: 'tenant-1',
        orderIds: ['ORD-001'],
        createdBy: 'user-1',
      });

      expect(result.invoicesCreated).toBe(0);
      expect(result.errors[0].error).toContain('No vendor');
    });
  });

  describe('generate1099Report', () => {
    it('should aggregate payments by vendor', async () => {
      const yearPayment = (vendorId: string, amount: number) => ({
        id: `pay-${Math.random().toString(36).slice(2, 6)}`,
        type: 'payment', tenantId: 'tenant-1', vendorId,
        amount, status: 'COMPLETED',
        completedAt: '2026-06-15T00:00:00.000Z',
      });

      dbService._store['p1'] = yearPayment('vendor-1', 400);
      dbService._store['p2'] = yearPayment('vendor-1', 300);
      dbService._store['p3'] = yearPayment('vendor-2', 500);

      const report = await service.generate1099Report('tenant-1', 2026);
      expect(report.vendors).toHaveLength(2);

      const v1 = report.vendors.find(v => v.vendorId === 'vendor-1')!;
      expect(v1.totalPaid).toBe(700);
      expect(v1.requires1099).toBe(true); // 700 >= 600

      const v2 = report.vendors.find(v => v.vendorId === 'vendor-2')!;
      expect(v2.totalPaid).toBe(500);
      expect(v2.requires1099).toBe(false); // 500 < 600
    });

    it('should report threshold summary', async () => {
      dbService._store['p1'] = {
        id: 'p1', type: 'payment', tenantId: 'tenant-1',
        vendorId: 'vendor-1', amount: 1000, status: 'COMPLETED',
        completedAt: '2026-06-15T00:00:00.000Z',
      };

      const report = await service.generate1099Report('tenant-1', 2026);
      expect(report.totalVendorsAboveThreshold).toBe(1);
      expect(report.totalAmountAboveThreshold).toBe(1000);
    });
  });

  describe('refund workflow', () => {
    it('should create a pending refund request', async () => {
      const refund = await service.requestRefund({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        invoiceId: 'inv-001',
        vendorId: 'vendor-1',
        refundAmount: 200,
        reason: 'Duplicate charge',
        requestedBy: 'user-1',
      });

      expect(refund.id).toMatch(/^ref-/);
      expect(refund.status).toBe('PENDING');
      expect(refund.refundAmount).toBe(200);
    });

    it('should approve a pending refund', async () => {
      const refund = await service.requestRefund({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        invoiceId: 'inv-001',
        vendorId: 'vendor-1',
        refundAmount: 200,
        reason: 'Duplicate',
        requestedBy: 'user-1',
      });

      const approved = await service.processRefund(refund.id, 'tenant-1', true, 'admin-1', 'Approved - verified duplicate');
      expect(approved.status).toBe('APPROVED');
      expect(approved.processedBy).toBe('admin-1');
      expect(approved.notes).toBe('Approved - verified duplicate');
    });

    it('should deny a pending refund', async () => {
      const refund = await service.requestRefund({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        invoiceId: 'inv-001',
        vendorId: 'vendor-1',
        refundAmount: 200,
        reason: 'Mistake',
        requestedBy: 'user-1',
      });

      const denied = await service.processRefund(refund.id, 'tenant-1', false, 'admin-1');
      expect(denied.status).toBe('DENIED');
    });

    it('should reject processing an already-processed refund', async () => {
      const refund = await service.requestRefund({
        orderId: 'ORD-001',
        tenantId: 'tenant-1',
        invoiceId: 'inv-001',
        vendorId: 'vendor-1',
        refundAmount: 200,
        reason: 'Test',
        requestedBy: 'user-1',
      });

      await service.processRefund(refund.id, 'tenant-1', true, 'admin-1');
      await expect(
        service.processRefund(refund.id, 'tenant-1', false, 'admin-2'),
      ).rejects.toThrow('already APPROVED');
    });
  });
});
