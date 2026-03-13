/**
 * Billing Enhancement Service (Phase 1.8)
 *
 * Adds aging reports, batch invoicing, 1099 report generation, and refund
 * processing on top of the existing PaymentProcessingService.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  invoiceCount: number;
  totalAmount: number;
  invoiceIds: string[];
}

export interface AgingReport {
  tenantId: string;
  generatedAt: string;
  /** Total outstanding across all buckets */
  totalOutstanding: number;
  buckets: AgingBucket[];
  /** Vendors with the highest outstanding balances */
  topDelinquent: Array<{ vendorId: string; vendorName: string; amount: number }>;
}

export interface BatchInvoiceRequest {
  tenantId: string;
  /** Order IDs to include in batch invoicing */
  orderIds: string[];
  /** Override payment terms */
  paymentTerms?: string;
  /** Due in days from now */
  dueInDays?: number;
  createdBy: string;
}

export interface BatchInvoiceResult {
  success: boolean;
  totalOrders: number;
  invoicesCreated: number;
  errors: Array<{ orderId: string; error: string }>;
  totalAmount: number;
}

export interface Form1099Record {
  vendorId: string;
  vendorName: string;
  taxId?: string;
  year: number;
  totalPaid: number;
  /** True if total exceeds IRS $600 threshold */
  requires1099: boolean;
  invoiceCount: number;
}

export interface Form1099Report {
  tenantId: string;
  year: number;
  generatedAt: string;
  vendors: Form1099Record[];
  totalVendorsAboveThreshold: number;
  totalAmountAboveThreshold: number;
}

export interface RefundRequest {
  orderId: string;
  tenantId: string;
  invoiceId: string;
  vendorId: string;
  refundAmount: number;
  reason: string;
  requestedBy: string;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  tenantId: string;
  invoiceId: string;
  vendorId: string;
  refundAmount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSED' | 'DENIED';
  requestedBy: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  notes?: string;
}

// IRS threshold
const IRS_1099_THRESHOLD = 600;

// ── Service ──────────────────────────────────────────────────────────────────

export class BillingEnhancementService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('BillingEnhancementService');
  }

  /**
   * Generate an accounts receivable aging report.
   */
  async generateAgingReport(tenantId: string): Promise<AgingReport> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      return { tenantId, generatedAt: new Date().toISOString(), totalOutstanding: 0, buckets: [], topDelinquent: [] };
    }

    // Get all unpaid invoices
    const { resources: invoices } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'invoice' AND c.tenantId = @tid AND c.status IN ('SENT', 'VIEWED', 'OVERDUE')`,
      parameters: [{ name: '@tid', value: tenantId }],
    }).fetchAll();

    const now = Date.now();
    const bucketDefs: Array<{ label: string; min: number; max: number | null }> = [
      { label: 'Current (0-30)', min: 0, max: 30 },
      { label: '31-60 Days', min: 31, max: 60 },
      { label: '61-90 Days', min: 61, max: 90 },
      { label: '91-120 Days', min: 91, max: 120 },
      { label: 'Over 120 Days', min: 121, max: null },
    ];

    const buckets: AgingBucket[] = bucketDefs.map(def => ({
      label: def.label,
      minDays: def.min,
      maxDays: def.max,
      invoiceCount: 0,
      totalAmount: 0,
      invoiceIds: [],
    }));

    const vendorTotals: Record<string, { vendorId: string; vendorName: string; amount: number }> = {};

    for (const inv of invoices) {
      const daysSinceIssue = Math.floor((now - new Date(inv.issueDate).getTime()) / (24 * 60 * 60 * 1000));
      const amountDue = inv.amountDue ?? (inv.totalAmount - (inv.amountPaid ?? 0));

      for (const bucket of buckets) {
        if (daysSinceIssue >= bucket.minDays && (bucket.maxDays === null || daysSinceIssue <= bucket.maxDays)) {
          bucket.invoiceCount++;
          bucket.totalAmount += amountDue;
          bucket.invoiceIds.push(inv.id);
          break;
        }
      }

      // Track vendor totals
      const vid = inv.vendorId ?? 'unknown';
      if (!vendorTotals[vid]) {
        vendorTotals[vid] = { vendorId: vid, vendorName: inv.vendorName ?? vid, amount: 0 };
      }
      vendorTotals[vid].amount += amountDue;
    }

    const totalOutstanding = buckets.reduce((sum, b) => sum + b.totalAmount, 0);
    const topDelinquent = Object.values(vendorTotals)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      totalOutstanding,
      buckets,
      topDelinquent,
    };
  }

  /**
   * Create invoices for multiple completed orders in batch.
   */
  async batchCreateInvoices(request: BatchInvoiceRequest): Promise<BatchInvoiceResult> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      return { success: false, totalOrders: request.orderIds.length, invoicesCreated: 0, errors: [{ orderId: '*', error: 'Database not initialized' }], totalAmount: 0 };
    }

    const errors: Array<{ orderId: string; error: string }> = [];
    let invoicesCreated = 0;
    let totalAmount = 0;

    for (const orderId of request.orderIds) {
      try {
        // Load the order
        const { resources: orders } = await container.items.query({
          query: `SELECT * FROM c WHERE c.type = 'order' AND c.id = @oid AND c.tenantId = @tid`,
          parameters: [
            { name: '@oid', value: orderId },
            { name: '@tid', value: request.tenantId },
          ],
        }).fetchAll();

        const order = orders[0];
        if (!order) {
          errors.push({ orderId, error: 'Order not found' });
          continue;
        }

        if (!order.vendorId) {
          errors.push({ orderId, error: 'No vendor assigned' });
          continue;
        }

        const fee = order.fee ?? order.appraisalFee ?? 0;
        if (fee <= 0) {
          errors.push({ orderId, error: 'No fee set on order' });
          continue;
        }

        const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date();
        const dueDate = new Date(now.getTime() + (request.dueInDays ?? 30) * 24 * 60 * 60 * 1000);

        const invoice = {
          id: invoiceId,
          type: 'invoice',
          tenantId: request.tenantId,
          orderId,
          vendorId: order.vendorId,
          invoiceNumber: `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-6)}`,
          subtotal: fee,
          taxAmount: 0,
          discount: 0,
          totalAmount: fee,
          amountPaid: 0,
          amountDue: fee,
          issueDate: now.toISOString(),
          dueDate: dueDate.toISOString(),
          status: 'SENT',
          lineItems: [{
            id: `${invoiceId}-line-1`,
            description: `Appraisal - ${order.productType ?? 'Standard'}`,
            quantity: 1,
            unitPrice: fee,
            totalPrice: fee,
            taxable: false,
            category: 'Appraisal Fee',
          }],
          paymentTerms: request.paymentTerms ?? 'Net 30',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          createdBy: request.createdBy,
        };

        await container.items.upsert(invoice);
        invoicesCreated++;
        totalAmount += fee;
      } catch (error) {
        errors.push({ orderId, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    this.logger.info('Batch invoicing complete', { total: request.orderIds.length, created: invoicesCreated, errors: errors.length });

    return {
      success: errors.length === 0,
      totalOrders: request.orderIds.length,
      invoicesCreated,
      errors,
      totalAmount,
    };
  }

  /**
   * Generate 1099 report for a tax year.
   */
  async generate1099Report(tenantId: string, year: number): Promise<Form1099Report> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      return { tenantId, year, generatedAt: new Date().toISOString(), vendors: [], totalVendorsAboveThreshold: 0, totalAmountAboveThreshold: 0 };
    }

    const yearStart = `${year}-01-01T00:00:00.000Z`;
    const yearEnd = `${year}-12-31T23:59:59.999Z`;

    // Get all completed payments in the year
    const { resources: payments } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'payment' AND c.tenantId = @tid AND c.status = 'COMPLETED' AND c.completedAt >= @start AND c.completedAt <= @end`,
      parameters: [
        { name: '@tid', value: tenantId },
        { name: '@start', value: yearStart },
        { name: '@end', value: yearEnd },
      ],
    }).fetchAll();

    // Aggregate by vendor
    const vendorAgg: Record<string, { vendorId: string; totalPaid: number; invoiceCount: number }> = {};
    for (const payment of payments) {
      const vid = payment.vendorId;
      if (!vendorAgg[vid]) {
        vendorAgg[vid] = { vendorId: vid, totalPaid: 0, invoiceCount: 0 };
      }
      vendorAgg[vid].totalPaid += payment.amount ?? 0;
      vendorAgg[vid].invoiceCount++;
    }

    // Enrich with vendor details
    const vendors: Form1099Record[] = [];
    for (const agg of Object.values(vendorAgg)) {
      let vendorName = agg.vendorId;
      try {
        const vendorResult = await this.dbService.findVendorById(agg.vendorId);
        if (vendorResult.success && vendorResult.data) {
          vendorName = (vendorResult.data as any).name ?? (vendorResult.data as any).businessName ?? agg.vendorId;
        }
      } catch {
        // Use vendorId as name fallback
      }

      vendors.push({
        vendorId: agg.vendorId,
        vendorName,
        year,
        totalPaid: Math.round(agg.totalPaid * 100) / 100,
        requires1099: agg.totalPaid >= IRS_1099_THRESHOLD,
        invoiceCount: agg.invoiceCount,
      });
    }

    vendors.sort((a, b) => b.totalPaid - a.totalPaid);

    const above = vendors.filter(v => v.requires1099);

    return {
      tenantId,
      year,
      generatedAt: new Date().toISOString(),
      vendors,
      totalVendorsAboveThreshold: above.length,
      totalAmountAboveThreshold: above.reduce((s, v) => s + v.totalPaid, 0),
    };
  }

  /**
   * Request a refund for a paid invoice.
   */
  async requestRefund(request: RefundRequest): Promise<RefundRecord> {
    const refund: RefundRecord = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderId: request.orderId,
      tenantId: request.tenantId,
      invoiceId: request.invoiceId,
      vendorId: request.vendorId,
      refundAmount: request.refundAmount,
      reason: request.reason,
      status: 'PENDING',
      requestedBy: request.requestedBy,
      requestedAt: new Date().toISOString(),
    };

    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      throw new Error('Database container not initialized');
    }
    await container.items.upsert({ ...refund, type: 'refund' });

    this.logger.info('Refund requested', { refundId: refund.id, amount: refund.refundAmount, orderId: refund.orderId });
    return refund;
  }

  /**
   * Approve/deny a refund request.
   */
  async processRefund(refundId: string, tenantId: string, approve: boolean, processedBy: string, notes?: string): Promise<RefundRecord> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database container not initialized');

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'refund' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: refundId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    const refund = resources[0] as RefundRecord | undefined;
    if (!refund) throw new Error(`Refund not found: ${refundId}`);
    if (refund.status !== 'PENDING') throw new Error(`Refund is already ${refund.status}`);

    refund.status = approve ? 'APPROVED' : 'DENIED';
    refund.processedAt = new Date().toISOString();
    refund.processedBy = processedBy;
    if (notes) refund.notes = notes;

    await container.items.upsert({ ...refund, type: 'refund' });
    this.logger.info(`Refund ${approve ? 'approved' : 'denied'}`, { refundId, processedBy });
    return refund;
  }

  /**
   * Get pending refunds for a tenant.
   */
  async getPendingRefunds(tenantId: string): Promise<RefundRecord[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'refund' AND c.tenantId = @tid AND c.status = 'PENDING' ORDER BY c.requestedAt DESC`,
      parameters: [{ name: '@tid', value: tenantId }],
    }).fetchAll();

    return resources as RefundRecord[];
  }

  /**
   * List all invoices for a tenant, optionally filtered by status.
   */
  async getInvoices(tenantId: string, status?: string): Promise<any[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const params: Array<{ name: string; value: string }> = [
      { name: '@tid', value: tenantId },
    ];
    let query = `SELECT * FROM c WHERE c.type = 'invoice' AND c.tenantId = @tid`;
    if (status) {
      query += ` AND c.status = @status`;
      params.push({ name: '@status', value: status });
    }
    query += ` ORDER BY c.createdAt DESC`;

    const { resources } = await container.items.query({ query, parameters: params }).fetchAll();
    return resources;
  }

  /**
   * Get a single invoice by ID.
   */
  async getInvoice(invoiceId: string, tenantId: string): Promise<any | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'invoice' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: invoiceId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources.length > 0 ? resources[0] : null;
  }

  /**
   * Record a payment against an invoice.
   */
  async recordPayment(
    invoiceId: string,
    tenantId: string,
    amount: number,
    method: string,
    reference: string,
    recordedBy: string,
  ): Promise<any> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) throw new Error('Database not initialized');

    const invoice = await this.getInvoice(invoiceId, tenantId);
    if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);

    const paymentId = `pmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const payment = {
      id: paymentId,
      invoiceId,
      amount,
      method,
      reference,
      recordedBy,
      recordedAt: new Date().toISOString(),
    };

    // Update invoice totals and status
    const payments = invoice.payments ?? [];
    payments.push(payment);
    const totalPaid = (invoice.amountPaid ?? 0) + amount;
    const amountDue = (invoice.totalAmount ?? 0) - totalPaid;

    invoice.payments = payments;
    invoice.amountPaid = totalPaid;
    invoice.amountDue = Math.max(0, amountDue);
    invoice.status = amountDue <= 0 ? 'PAID' : 'PARTIAL';
    invoice.updatedAt = new Date().toISOString();

    await container.items.upsert(invoice);
    return invoice;
  }
}
