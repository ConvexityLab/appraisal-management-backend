/**
 * Payment Processing Types
 * Handles invoicing, payments, and vendor compensation
 */

export enum PaymentMethod {
  ACH = 'ACH',
  WIRE_TRANSFER = 'WIRE_TRANSFER',
  CHECK = 'CHECK',
  CREDIT_CARD = 'CREDIT_CARD',
  STRIPE = 'STRIPE'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED'
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED'
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  orderId: string;
  
  // Amounts
  subtotal: number;
  taxAmount: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  
  // Dates
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  
  // Status
  status: InvoiceStatus;
  
  // Line items
  lineItems: InvoiceLineItem[];
  
  // Payment details
  paymentMethod?: PaymentMethod;
  paymentTerms: string; // e.g., "Net 30"
  
  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // References
  paymentIds?: string[];
  receiptUrl?: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxable: boolean;
  category?: string; // e.g., "Appraisal Fee", "Rush Fee", "Inspection Fee"
}

export interface Payment {
  id: string;
  invoiceId: string;
  vendorId: string;
  orderId: string;
  
  // Amount
  amount: number;
  currency: string;
  
  // Method
  paymentMethod: PaymentMethod;
  paymentProvider?: string; // e.g., "Stripe", "Bank of America"
  
  // Status
  status: PaymentStatus;
  
  // Dates
  initiatedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  
  // Payment details
  transactionId?: string;
  externalTransactionId?: string; // Stripe payment intent ID, etc.
  confirmationNumber?: string;
  
  // Bank details (for ACH/Wire)
  bankDetails?: PaymentBankDetails;
  
  // Stripe details
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  
  // Error handling
  errorMessage?: string;
  errorCode?: string;
  retryCount?: number;
  
  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  processedBy?: string;
  
  // Receipt
  receiptUrl?: string;
  receiptNumber?: string;
}

export interface PaymentBankDetails {
  bankName: string;
  accountType: 'CHECKING' | 'SAVINGS';
  accountNumber: string; // Last 4 digits only for security
  routingNumber: string;
  accountHolderName: string;
}

export interface PaymentRequest {
  invoiceId: string;
  vendorId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  scheduledDate?: Date;
  
  // For ACH/Wire
  bankDetails?: PaymentBankDetails;
  
  // For Stripe
  stripePaymentMethodId?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  status: PaymentStatus;
  message?: string;
  error?: string;
  receiptUrl?: string;
}

export interface VendorPaymentSettings {
  vendorId: string;
  preferredMethod: PaymentMethod;
  paymentTerms: string;
  
  // Bank account (ACH)
  achEnabled: boolean;
  bankAccount?: {
    bankName: string;
    accountType: 'CHECKING' | 'SAVINGS';
    accountNumber: string; // Encrypted
    routingNumber: string;
    accountHolderName: string;
    verifiedAt?: Date;
  };
  
  // Wire transfer
  wireEnabled: boolean;
  wireInstructions?: {
    bankName: string;
    swiftCode?: string;
    accountNumber: string; // Encrypted
    beneficiaryName: string;
    beneficiaryAddress: string;
  };
  
  // Stripe
  stripeEnabled: boolean;
  stripeAccountId?: string;
  stripeCustomerId?: string;
  
  // Check
  checkEnabled: boolean;
  mailingAddress?: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentSummary {
  vendorId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // Totals
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  
  // Counts
  invoicesIssued: number;
  invoicesPaid: number;
  invoicesPending: number;
  invoicesOverdue: number;
  
  // Payment breakdown
  paymentsByMethod: Record<PaymentMethod, number>;
  
  // Performance
  averagePaymentTime: number; // days
  onTimePaymentRate: number; // percentage
}

export interface InvoiceCreateRequest {
  vendorId: string;
  orderId: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxable: boolean;
    category?: string;
  }>;
  paymentTerms?: string;
  dueInDays?: number;
  notes?: string;
  createdBy: string;
}

export interface BulkPaymentRequest {
  payments: Array<{
    invoiceId: string;
    vendorId: string;
    amount: number;
  }>;
  paymentMethod: PaymentMethod;
  scheduledDate?: Date;
  notes?: string;
  initiatedBy: string;
}

export interface BulkPaymentResult {
  success: boolean;
  totalRequested: number;
  successCount: number;
  failureCount: number;
  totalAmount: number;
  results: Array<{
    invoiceId: string;
    vendorId: string;
    success: boolean;
    paymentId?: string;
    error?: string;
  }>;
}

export interface PaymentReconciliation {
  id: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // Summary
  totalPaymentsExpected: number;
  totalPaymentsCompleted: number;
  totalPaymentsFailed: number;
  discrepancies: number;
  
  // Details
  reconciliationDetails: Array<{
    invoiceId: string;
    expectedAmount: number;
    actualAmount: number;
    discrepancy: number;
    reason?: string;
  }>;
  
  // Metadata
  reconciledAt: Date;
  reconciledBy: string;
  notes?: string;
}
