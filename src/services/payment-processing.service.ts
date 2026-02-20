/**
 * Payment Processing Service
 * Handles invoicing, vendor payments, Stripe integration, and ACH transfers
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { NotificationService } from './notification.service.js';
import {
  Invoice,
  Payment,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  InvoiceStatus,
  PaymentMethod,
  InvoiceCreateRequest,
  VendorPaymentSettings,
  PaymentSummary,
  BulkPaymentRequest,
  BulkPaymentResult
} from '../types/payment.types.js';
import { createPaymentProvider, PaymentProvider } from './payment-providers/index.js';

export class PaymentProcessingService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private notificationService: NotificationService;
  private provider: PaymentProvider;

  constructor(dbService?: CosmosDbService) {
    this.logger = new Logger();
    this.dbService = dbService || new CosmosDbService();
    this.notificationService = new NotificationService();
    this.provider = createPaymentProvider();
    this.logger.info(`Payment provider initialised: ${this.provider.name}`);
  }

  /**
   * Create invoice for vendor order completion
   */
  async createInvoice(request: InvoiceCreateRequest): Promise<Invoice> {
    try {
      this.logger.info('Creating invoice', { vendorId: request.vendorId, orderId: request.orderId });

      // Calculate amounts
      const subtotal = request.lineItems.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);

      const taxableItems = request.lineItems.filter(item => item.taxable);
      const taxableAmount = taxableItems.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);

      const taxRate = 0.00; // TODO: Calculate based on vendor state/location
      const taxAmount = taxableAmount * taxRate;
      const totalAmount = subtotal + taxAmount;

      const invoiceNumber = this.generateInvoiceNumber();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (request.dueInDays || 30));

      const invoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber,
        vendorId: request.vendorId,
        orderId: request.orderId,
        subtotal,
        taxAmount,
        discount: 0,
        totalAmount,
        amountPaid: 0,
        amountDue: totalAmount,
        issueDate: new Date(),
        dueDate,
        status: InvoiceStatus.DRAFT,
        lineItems: request.lineItems.map((item, index) => ({
          id: `item-${index}`,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          taxable: item.taxable,
          ...(item.category && { category: item.category })
        })),
        paymentTerms: request.paymentTerms || 'Net 30',
        ...(request.notes && { notes: request.notes }),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: request.createdBy
      };

      // Store in database
      await this.dbService.createItem('invoices', {
        ...invoice,
        type: 'invoice',
        partitionKey: request.vendorId
      });

      this.logger.info('Invoice created', { invoiceId: invoice.id, invoiceNumber });
      return invoice;

    } catch (error) {
      this.logger.error('Failed to create invoice', { error, request });
      throw error;
    }
  }

  /**
   * Send invoice to vendor
   */
  async sendInvoice(invoiceId: string, vendorId: string): Promise<boolean> {
    try {
      this.logger.info('Sending invoice', { invoiceId, vendorId });

      const invoice = await this.getInvoiceById(invoiceId, vendorId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Update status to SENT
      await this.dbService.updateItem('invoices', invoiceId, {
        status: InvoiceStatus.SENT,
        updatedAt: new Date()
      }, vendorId);

      // Get vendor email
      const vendor = await this.dbService.getItem('vendors', vendorId, vendorId);
      const vendorEmail = (vendor as any)?.email || '';

      // Send email notification
      await this.notificationService.sendEmail({
        to: vendorEmail,
        subject: `Invoice ${invoice.invoiceNumber} - Payment Due`,
        body: this.generateInvoiceEmailBody(invoice),
        priority: 'normal'
      });

      this.logger.info('Invoice sent', { invoiceId, vendorEmail });
      return true;

    } catch (error) {
      this.logger.error('Failed to send invoice', { error, invoiceId });
      return false;
    }
  }

  /**
   * Process payment
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      this.logger.info('Processing payment', { 
        invoiceId: request.invoiceId,
        method: request.paymentMethod,
        amount: request.amount 
      });

      // Get invoice
      const invoice = await this.getInvoiceById(request.invoiceId, request.vendorId);
      if (!invoice) {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: 'Invoice not found'
        };
      }

      // Validate amount
      if (request.amount > invoice.amountDue) {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: 'Payment amount exceeds amount due'
        };
      }

      // Create payment record
      const payment: Payment = {
        id: `pay-${Date.now()}`,
        invoiceId: request.invoiceId,
        vendorId: request.vendorId,
        orderId: invoice.orderId,
        amount: request.amount,
        currency: 'USD',
        paymentMethod: request.paymentMethod,
        status: PaymentStatus.PROCESSING,
        initiatedAt: new Date(),
        ...(request.notes && { notes: request.notes }),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Delegate to the configured payment provider
      let paymentResult: PaymentResult;

      switch (request.paymentMethod) {
        case PaymentMethod.STRIPE:
        case PaymentMethod.CREDIT_CARD: {
          // Inbound charge (client → platform)
          const chargeResult = await this.provider.charge({
            idempotencyKey: payment.id,
            amountCents: Math.round(request.amount * 100),
            currency: 'usd',
            ...(request.stripePaymentMethodId ? { paymentMethodToken: request.stripePaymentMethodId } : {}),
            description: `Invoice ${request.invoiceId}`,
            metadata: { invoiceId: request.invoiceId, vendorId: request.vendorId },
          });
          paymentResult = {
            success: chargeResult.success,
            status: chargeResult.status,
            ...(chargeResult.providerTransactionId ? { transactionId: chargeResult.providerTransactionId } : {}),
            ...(chargeResult.message ? { message: chargeResult.message } : {}),
            ...(chargeResult.error ? { error: chargeResult.error } : {}),
            ...(chargeResult.receiptUrl ? { receiptUrl: chargeResult.receiptUrl } : {}),
          };
          break;
        }

        case PaymentMethod.ACH:
        case PaymentMethod.WIRE_TRANSFER: {
          // Outbound payout (platform → vendor)
          const payoutResult = await this.provider.payout({
            idempotencyKey: payment.id,
            amountCents: Math.round(request.amount * 100),
            currency: 'usd',
            ...(request.bankDetails ? {
              bankDetails: {
                routingNumber: request.bankDetails.routingNumber,
                accountNumber: request.bankDetails.accountNumber,
                accountHolderName: request.bankDetails.accountHolderName,
                accountType: request.bankDetails.accountType.toLowerCase() as 'checking' | 'savings',
              }
            } : {}),
            description: `Payout for invoice ${request.invoiceId}`,
            metadata: { invoiceId: request.invoiceId, vendorId: request.vendorId },
          });
          paymentResult = {
            success: payoutResult.success,
            status: payoutResult.status,
            ...(payoutResult.providerTransactionId ? { transactionId: payoutResult.providerTransactionId } : {}),
            ...(payoutResult.message ? { message: payoutResult.message } : {}),
            ...(payoutResult.error ? { error: payoutResult.error } : {}),
          };
          break;
        }

        case PaymentMethod.CHECK: {
          // Checks are manual — just record and mark as processing
          paymentResult = {
            success: true,
            status: PaymentStatus.PROCESSING,
            transactionId: `check_${Date.now()}`,
            message: 'Check payment recorded — awaiting clearance',
          };
          break;
        }

        default:
          paymentResult = {
            success: false,
            status: PaymentStatus.FAILED,
            error: `Unsupported payment method: ${request.paymentMethod}`,
          };
      }

      // Update payment record with result
      payment.status = paymentResult.status;
      if (paymentResult.transactionId) {
        payment.transactionId = paymentResult.transactionId;
      }
      if (paymentResult.error) {
        payment.errorMessage = paymentResult.error;
      }
      if (paymentResult.success) {
        payment.completedAt = new Date();
      } else {
        payment.failedAt = new Date();
      }

      // Store payment
      await this.dbService.createItem('payments', {
        ...payment,
        type: 'payment',
        partitionKey: request.vendorId
      });

      // Update invoice if payment successful
      if (paymentResult.success) {
        await this.updateInvoicePayment(invoice.id, request.vendorId, request.amount, payment.id);
      }

      return {
        ...paymentResult,
        paymentId: payment.id
      };

    } catch (error) {
      this.logger.error('Payment processing failed', { error, request });
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error instanceof Error ? error.message : 'Payment failed'
      };
    }
  }

  /**
   * Get payment history for vendor
   */
  async getVendorPayments(
    vendorId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Payment[]> {
    try {
      // Get payments from vendor.paymentHistory
      const vendorResult = await this.dbService.findVendorById(vendorId);
      
      if (!vendorResult.success || !vendorResult.data) {
        this.logger.warn('Vendor not found', { vendorId });
        return [];
      }

      const vendor = vendorResult.data;
      this.logger.info('DEBUG: Vendor payment data', { 
        vendorId, 
        hasPaymentHistory: !!vendor.paymentHistory,
        paymentHistoryLength: vendor.paymentHistory?.length || 0,
        hasInvoiceHistory: !!vendor.invoiceHistory,
        invoiceHistoryLength: vendor.invoiceHistory?.length || 0
      });
      let payments = vendor.paymentHistory || [];

      // Filter by date range if provided
      if (startDate) {
        payments = payments.filter(p => new Date(p.createdAt) >= startDate);
      }
      if (endDate) {
        payments = payments.filter(p => new Date(p.createdAt) <= endDate);
      }

      // Map PaymentRecord to Payment type
      return payments.map(p => ({
        ...p,
        currency: 'USD',
        paymentProvider: 'Bank of America',
        initiatedAt: new Date(p.createdAt),
        completedAt: p.processedAt,
        updatedAt: p.processedAt,
        type: 'payment'
      } as any));

    } catch (error) {
      this.logger.error('Failed to get vendor payments', { error, vendorId });
      return [];
    }
  }

  /**
   * Get payment summary for vendor
   */
  async getPaymentSummary(
    vendorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PaymentSummary> {
    try {
      const invoices = await this.getVendorInvoices(vendorId, startDate, endDate);
      const payments = await this.getVendorPayments(vendorId, startDate, endDate);

      const totalEarned = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const totalPaid = invoices
        .filter(inv => inv.status === InvoiceStatus.PAID)
        .reduce((sum, inv) => sum + inv.amountPaid, 0);
      
      const totalPending = invoices
        .filter(inv => inv.status === InvoiceStatus.SENT || inv.status === InvoiceStatus.VIEWED)
        .reduce((sum, inv) => sum + inv.amountDue, 0);
      
      const totalOverdue = invoices
        .filter(inv => inv.status === InvoiceStatus.OVERDUE)
        .reduce((sum, inv) => sum + inv.amountDue, 0);

      // Payment breakdown by method
      const paymentsByMethod: any = {};
      for (const method of Object.values(PaymentMethod)) {
        paymentsByMethod[method] = payments
          .filter(p => p.paymentMethod === method && p.status === PaymentStatus.COMPLETED)
          .reduce((sum, p) => sum + p.amount, 0);
      }

      // Calculate average payment time
      const paidInvoices = invoices.filter(inv => inv.paidDate);
      const totalDays = paidInvoices.reduce((sum, inv) => {
        const issued = new Date(inv.issueDate).getTime();
        const paid = new Date(inv.paidDate!).getTime();
        return sum + (paid - issued) / (1000 * 60 * 60 * 24);
      }, 0);
      const averagePaymentTime = paidInvoices.length > 0 ? totalDays / paidInvoices.length : 0;

      // On-time payment rate
      const onTimePayments = paidInvoices.filter(inv => {
        return new Date(inv.paidDate!) <= new Date(inv.dueDate);
      });
      const onTimePaymentRate = paidInvoices.length > 0 
        ? (onTimePayments.length / paidInvoices.length) * 100 
        : 0;

      return {
        totalPaid: totalPaid || 0,
        totalPending: totalPending || 0,
        averagePaymentDays: Math.round(averagePaymentTime) || 0,
        recentPayments: payments.slice(0, 10) // Last 10 payments
      } as any;

    } catch (error) {
      this.logger.error('Failed to get payment summary', { error, vendorId });
      throw error;
    }
  }

  /**
   * Process bulk payments (batch processing)
   */
  async processBulkPayments(request: BulkPaymentRequest): Promise<BulkPaymentResult> {
    try {
      this.logger.info('Processing bulk payments', { count: request.payments.length });

      const results: BulkPaymentResult['results'] = [];
      let successCount = 0;
      let failureCount = 0;
      let totalAmount = 0;

      for (const paymentRequest of request.payments) {
        try {
          const result = await this.processPayment({
            ...paymentRequest,
            paymentMethod: request.paymentMethod,
            ...(request.notes && { notes: request.notes }),
            ...(request.scheduledDate && { scheduledDate: request.scheduledDate })
          });

          if (result.success) {
            successCount++;
            totalAmount += paymentRequest.amount;
          } else {
            failureCount++;
          }

          results.push({
            invoiceId: paymentRequest.invoiceId,
            vendorId: paymentRequest.vendorId,
            success: result.success,
            ...(result.paymentId && { paymentId: result.paymentId }),
            ...(result.error && { error: result.error })
          });

        } catch (error) {
          failureCount++;
          results.push({
            invoiceId: paymentRequest.invoiceId,
            vendorId: paymentRequest.vendorId,
            success: false,
            error: error instanceof Error ? error.message : 'Payment failed'
          });
        }
      }

      return {
        success: failureCount === 0,
        totalRequested: request.payments.length,
        successCount,
        failureCount,
        totalAmount,
        results
      };

    } catch (error) {
      this.logger.error('Bulk payment processing failed', { error });
      throw error;
    }
  }

  // ===========================
  // PRIVATE HELPER METHODS
  // ===========================

  /**
   * Update invoice with payment
   */
  private async updateInvoicePayment(
    invoiceId: string,
    vendorId: string,
    amount: number,
    paymentId: string
  ): Promise<void> {
    try {
      const invoice = await this.getInvoiceById(invoiceId, vendorId);
      if (!invoice) return;

      const newAmountPaid = invoice.amountPaid + amount;
      const newAmountDue = invoice.totalAmount - newAmountPaid;
      const newStatus = newAmountDue <= 0 ? InvoiceStatus.PAID : invoice.status;

      await this.dbService.updateItem('invoices', invoiceId, {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: newStatus,
        paidDate: newAmountDue <= 0 ? new Date() : undefined,
        paymentIds: [...(invoice.paymentIds || []), paymentId],
        updatedAt: new Date()
      }, vendorId);

    } catch (error) {
      this.logger.error('Failed to update invoice payment', { error, invoiceId });
    }
  }

  /**
   * Get invoice by ID
   */
  private async getInvoiceById(invoiceId: string, vendorId: string): Promise<Invoice | null> {
    try {
      const result = await this.dbService.getItem('invoices', invoiceId, vendorId);
      return (result as any)?.data || result || null;
    } catch (error) {
      this.logger.error('Failed to get invoice', { error, invoiceId });
      return null;
    }
  }

  /**
   * Get vendor invoices
   */
  private async getVendorInvoices(
    vendorId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Invoice[]> {
    try {
      // Get invoices from vendor.invoiceHistory
      const vendorResult = await this.dbService.findVendorById(vendorId);
      
      if (!vendorResult.success || !vendorResult.data) {
        this.logger.warn('Vendor not found for invoices', { vendorId });
        return [];
      }

      const vendor = vendorResult.data;
      let invoices = vendor.invoiceHistory || [];

      // Filter by date range if provided
      if (startDate) {
        invoices = invoices.filter(inv => new Date(inv.issueDate) >= startDate);
      }
      if (endDate) {
        invoices = invoices.filter(inv => new Date(inv.issueDate) <= endDate);
      }

      // Map InvoiceRecord to Invoice type
      return invoices.map(inv => ({
        ...inv,
        vendorId,
        subtotal: inv.totalAmount / 1.08, // Assuming 8% tax
        taxAmount: inv.totalAmount * 0.08 / 1.08,
        discount: 0,
        status: inv.status.toUpperCase() as any, // Convert 'paid' -> 'PAID'
        lineItems: [{
          id: `${inv.id}-line-1`,
          description: 'Residential Appraisal - Full Service',
          quantity: 1,
          unitPrice: inv.totalAmount / 1.08,
          totalPrice: inv.totalAmount / 1.08,
          taxable: true,
          category: 'Appraisal Fee'
        }],
        paymentMethod: 'ach' as any,
        paymentTerms: 'Net 30',
        createdAt: inv.issueDate,
        updatedAt: inv.paidDate || inv.issueDate,
        createdBy: 'system'
      } as any));

    } catch (error) {
      this.logger.error('Failed to get vendor invoices', { error, vendorId });
      return [];
    }
  }

  /**
   * Generate unique invoice number
   */
  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${year}${month}-${timestamp}`;
  }

  /**
   * Generate invoice email body
   */
  private generateInvoiceEmailBody(invoice: Invoice): string {
    return `
Invoice Number: ${invoice.invoiceNumber}
Order ID: ${invoice.orderId}

Amount Due: $${invoice.amountDue.toFixed(2)}
Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}
Payment Terms: ${invoice.paymentTerms}

Line Items:
${invoice.lineItems.map(item => 
  `- ${item.description}: ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.totalPrice.toFixed(2)}`
).join('\n')}

Subtotal: $${invoice.subtotal.toFixed(2)}
Tax: $${invoice.taxAmount.toFixed(2)}
Total: $${invoice.totalAmount.toFixed(2)}

${invoice.notes ? `\nNotes: ${invoice.notes}` : ''}

Please remit payment by the due date to avoid late fees.
    `.trim();
  }
}
