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

// Stripe SDK would be imported here in production
// import Stripe from 'stripe';

export class PaymentProcessingService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private notificationService: NotificationService;
  
  // Stripe client (initialized if API key is provided)
  private stripeEnabled: boolean = false;
  // private stripe: Stripe | null = null;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.notificationService = new NotificationService();
    
    // Initialize Stripe if configured
    const stripeApiKey = process.env.STRIPE_SECRET_KEY;
    if (stripeApiKey) {
      // this.stripe = new Stripe(stripeApiKey, { apiVersion: '2023-10-16' });
      this.stripeEnabled = true;
      this.logger.info('Stripe payment processing enabled');
    } else {
      this.logger.warn('Stripe not configured - card payments will be disabled');
    }
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

      // Process based on payment method
      let paymentResult: PaymentResult;

      switch (request.paymentMethod) {
        case PaymentMethod.STRIPE:
          paymentResult = await this.processStripePayment(payment, request);
          break;
        
        case PaymentMethod.ACH:
          paymentResult = await this.processACHPayment(payment, request);
          break;
        
        case PaymentMethod.WIRE_TRANSFER:
          paymentResult = await this.processWireTransfer(payment, request);
          break;
        
        case PaymentMethod.CHECK:
          paymentResult = await this.processCheckPayment(payment, request);
          break;
        
        default:
          paymentResult = {
            success: false,
            status: PaymentStatus.FAILED,
            error: 'Unsupported payment method'
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
      let query = `
        SELECT * FROM c 
        WHERE c.vendorId = @vendorId 
        AND c.type = 'payment'
      `;

      const parameters: any[] = [{ name: '@vendorId', value: vendorId }];

      if (startDate) {
        query += ` AND c.createdAt >= @startDate`;
        parameters.push({ name: '@startDate', value: startDate.toISOString() });
      }

      if (endDate) {
        query += ` AND c.createdAt <= @endDate`;
        parameters.push({ name: '@endDate', value: endDate.toISOString() });
      }

      query += ` ORDER BY c.createdAt DESC`;

      const result = await this.dbService.queryItems('payments', query, parameters) as any;
      return result.resources || [];

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
        vendorId,
        period: { startDate, endDate },
        totalEarned,
        totalPaid,
        totalPending,
        totalOverdue,
        invoicesIssued: invoices.length,
        invoicesPaid: invoices.filter(inv => inv.status === InvoiceStatus.PAID).length,
        invoicesPending: invoices.filter(inv => 
          inv.status === InvoiceStatus.SENT || inv.status === InvoiceStatus.VIEWED
        ).length,
        invoicesOverdue: invoices.filter(inv => inv.status === InvoiceStatus.OVERDUE).length,
        paymentsByMethod,
        averagePaymentTime,
        onTimePaymentRate
      };

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
   * Process Stripe payment
   */
  private async processStripePayment(
    payment: Payment,
    request: PaymentRequest
  ): Promise<PaymentResult> {
    try {
      if (!this.stripeEnabled) {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: 'Stripe payment processing not configured'
        };
      }

      // TODO: Actual Stripe integration
      // const paymentIntent = await this.stripe!.paymentIntents.create({
      //   amount: Math.round(request.amount * 100), // Convert to cents
      //   currency: 'usd',
      //   payment_method: request.stripePaymentMethodId,
      //   confirm: true
      // });

      // Simulate successful payment for now
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        status: PaymentStatus.COMPLETED,
        transactionId: `stripe_${Date.now()}`,
        message: 'Payment processed successfully via Stripe'
      };

    } catch (error) {
      this.logger.error('Stripe payment failed', { error });
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error instanceof Error ? error.message : 'Stripe payment failed'
      };
    }
  }

  /**
   * Process ACH payment
   */
  private async processACHPayment(
    payment: Payment,
    request: PaymentRequest
  ): Promise<PaymentResult> {
    try {
      // TODO: Integrate with ACH processing service (Plaid, Dwolla, etc.)
      
      // Validate bank details
      if (!request.bankDetails) {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: 'Bank details required for ACH payment'
        };
      }

      // Simulate ACH processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        success: true,
        status: PaymentStatus.PROCESSING, // ACH takes 1-3 business days
        transactionId: `ach_${Date.now()}`,
        message: 'ACH payment initiated - processing in 1-3 business days'
      };

    } catch (error) {
      this.logger.error('ACH payment failed', { error });
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error instanceof Error ? error.message : 'ACH payment failed'
      };
    }
  }

  /**
   * Process wire transfer
   */
  private async processWireTransfer(
    payment: Payment,
    request: PaymentRequest
  ): Promise<PaymentResult> {
    try {
      // Wire transfers are typically manual - mark as pending manual confirmation
      return {
        success: true,
        status: PaymentStatus.PROCESSING,
        transactionId: `wire_${Date.now()}`,
        message: 'Wire transfer instructions sent - awaiting confirmation'
      };

    } catch (error) {
      this.logger.error('Wire transfer failed', { error });
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error instanceof Error ? error.message : 'Wire transfer failed'
      };
    }
  }

  /**
   * Process check payment
   */
  private async processCheckPayment(
    payment: Payment,
    request: PaymentRequest
  ): Promise<PaymentResult> {
    try {
      // Checks are manual - mark as pending confirmation
      return {
        success: true,
        status: PaymentStatus.PROCESSING,
        transactionId: `check_${Date.now()}`,
        message: 'Check payment recorded - awaiting clearance'
      };

    } catch (error) {
      this.logger.error('Check payment failed', { error });
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error instanceof Error ? error.message : 'Check payment failed'
      };
    }
  }

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
      let query = `
        SELECT * FROM c 
        WHERE c.vendorId = @vendorId 
        AND c.type = 'invoice'
      `;

      const parameters: any[] = [{ name: '@vendorId', value: vendorId }];

      if (startDate) {
        query += ` AND c.createdAt >= @startDate`;
        parameters.push({ name: '@startDate', value: startDate.toISOString() });
      }

      if (endDate) {
        query += ` AND c.createdAt <= @endDate`;
        parameters.push({ name: '@endDate', value: endDate.toISOString() });
      }

      query += ` ORDER BY c.createdAt DESC`;

      const result = await this.dbService.queryItems('invoices', query, parameters) as any;
      return result.resources || [];

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
