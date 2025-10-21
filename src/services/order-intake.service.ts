/**
 * Order Intake Service
 * Handles the complete order entry and intake process including validation,
 * compliance checks, and payment processing
 */

import { Logger } from '../utils/logger';
import { DynamicCodeExecutionService } from './dynamic-code-execution.service';

export interface OrderIntakeRequest {
  clientId: string;
  orderType: 'FULL_APPRAISAL' | 'DRIVE_BY' | 'EXTERIOR_ONLY' | 'DESK_REVIEW';
  productType: 'SINGLE_FAMILY' | 'CONDO' | 'MULTI_FAMILY' | 'COMMERCIAL';
  propertyAddress: string;
  loanAmount: number;
  priority: 'STANDARD' | 'RUSH' | 'EMERGENCY';
  borrowerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  loanInfo: {
    loanAmount: number;
    loanType: string;
    lenderName: string;
  };
  complianceRequirements: {
    stateAMCLicense: boolean;
    clientGuidelines: string[];
  };
}

export interface ClientConfiguration {
  requiresAMCLicense: boolean;
  maxLoanAmount: number;
  reviewThreshold: number;
  supportedProductTypes: string[];
  requiredGuidelines: string[];
  standardTurnaround: number;
  paymentModel: 'BORROWER_PAID' | 'CLIENT_INVOICE';
  feeStructure: Record<string, number>;
  customValidationRules?: string; // Dynamic code for client-specific rules
}

export interface OrderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks: Record<string, string>;
  priorityScore: number;
  suggestedDueDate: Date;
}

export interface PaymentCalculation {
  paymentRequired: boolean;
  paymentAmount: number;
  paymentMethod: string;
  processingFee: number;
  totalAmount: number;
  breakdown: {
    baseFee: number;
    priorityFee: number;
    complexityFee: number;
    processingFee: number;
  };
}

export class OrderIntakeService {
  private logger: Logger;
  private codeExecutionService: DynamicCodeExecutionService;

  constructor() {
    this.logger = new Logger('OrderIntakeService');
    this.codeExecutionService = new DynamicCodeExecutionService();
  }

  /**
   * Validate order intake request against client configuration
   */
  async validateOrderIntake(
    orderRequest: OrderIntakeRequest,
    clientConfig: ClientConfiguration
  ): Promise<OrderValidationResult> {
    const validationResult: OrderValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      checks: {},
      priorityScore: 0,
      suggestedDueDate: new Date()
    };

    try {
      // 1. AMC License Validation
      if (clientConfig.requiresAMCLicense && !orderRequest.complianceRequirements.stateAMCLicense) {
        validationResult.errors.push('State AMC license verification required');
        validationResult.isValid = false;
      } else {
        validationResult.checks.amcLicense = 'VERIFIED';
      }

      // 2. Loan Amount Validation
      if (orderRequest.loanAmount > clientConfig.maxLoanAmount) {
        validationResult.errors.push(
          `Loan amount $${orderRequest.loanAmount.toLocaleString()} exceeds client limit $${clientConfig.maxLoanAmount.toLocaleString()}`
        );
        validationResult.isValid = false;
      } else if (orderRequest.loanAmount > clientConfig.reviewThreshold) {
        validationResult.warnings.push('High-value loan requires additional review');
        validationResult.priorityScore += 2;
      }
      validationResult.checks.loanAmount = 'VALIDATED';

      // 3. Product Type Support
      if (!clientConfig.supportedProductTypes.includes(orderRequest.productType)) {
        validationResult.warnings.push('Product type may require specialized vendor');
        validationResult.priorityScore += 1;
      }
      validationResult.checks.productType = 'SUPPORTED';

      // 4. Compliance Guidelines Check
      const missingGuidelines = clientConfig.requiredGuidelines.filter(
        guideline => !orderRequest.complianceRequirements.clientGuidelines.includes(guideline)
      );
      if (missingGuidelines.length > 0) {
        validationResult.warnings.push(`Missing guidelines: ${missingGuidelines.join(', ')}`);
      }
      validationResult.checks.guidelines = 'REVIEWED';

      // 5. Calculate Due Date
      const baseDays = clientConfig.standardTurnaround;
      const urgencyMultiplier = this.getUrgencyMultiplier(orderRequest.priority);
      const adjustedDays = Math.max(1, Math.floor(baseDays * urgencyMultiplier));
      
      validationResult.suggestedDueDate = new Date(Date.now() + adjustedDays * 24 * 60 * 60 * 1000);
      validationResult.priorityScore += this.getPriorityScore(orderRequest.priority);

      // 6. Execute Custom Validation Rules (if any)
      if (clientConfig.customValidationRules) {
        const customResult = await this.executeCustomValidation(
          orderRequest,
          clientConfig,
          clientConfig.customValidationRules
        );
        
        if (customResult.success && customResult.result) {
          validationResult.errors.push(...(customResult.result.errors || []));
          validationResult.warnings.push(...(customResult.result.warnings || []));
          validationResult.priorityScore += customResult.result.additionalPriorityScore || 0;
          
          if (customResult.result.errors?.length > 0) {
            validationResult.isValid = false;
          }
        }
      }

      this.logger.info('Order validation completed', {
        orderId: 'temp',
        isValid: validationResult.isValid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length
      });

      return validationResult;

    } catch (error) {
      this.logger.error('Order validation failed', { error });
      validationResult.isValid = false;
      validationResult.errors.push('Validation process encountered an error');
      return validationResult;
    }
  }

  /**
   * Calculate payment amount and processing requirements
   */
  calculatePayment(
    orderRequest: OrderIntakeRequest,
    clientConfig: ClientConfiguration
  ): PaymentCalculation {
    const baseFee = clientConfig.feeStructure[orderRequest.orderType] || 500;
    let priorityFee = 0;
    let complexityFee = 0;

    // Calculate priority-based fees
    switch (orderRequest.priority) {
      case 'RUSH':
        priorityFee = baseFee * 0.5; // 50% rush fee
        break;
      case 'EMERGENCY':
        priorityFee = baseFee * 1.0; // 100% emergency fee
        break;
      default:
        priorityFee = 0;
    }

    // Calculate complexity fees for high-value loans
    if (orderRequest.loanAmount > 1000000) {
      complexityFee = baseFee * 0.25; // 25% complexity fee
    }

    const subtotal = baseFee + priorityFee + complexityFee;
    
    // Calculate processing fees
    let processingFee = 0;
    let paymentRequired = false;
    let paymentMethod = 'INVOICE';

    if (clientConfig.paymentModel === 'BORROWER_PAID') {
      paymentRequired = true;
      paymentMethod = 'CREDIT_CARD';
      processingFee = subtotal * 0.029; // 2.9% processing fee
    }

    const totalAmount = subtotal + processingFee;

    return {
      paymentRequired,
      paymentAmount: Math.round(subtotal * 100) / 100,
      paymentMethod,
      processingFee: Math.round(processingFee * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      breakdown: {
        baseFee,
        priorityFee,
        complexityFee,
        processingFee
      }
    };
  }

  /**
   * Complete order intake process
   */
  async processOrderIntake(
    orderRequest: OrderIntakeRequest,
    clientConfig: ClientConfiguration
  ): Promise<{
    success: boolean;
    validation: OrderValidationResult;
    payment: PaymentCalculation;
    orderId?: string;
    error?: string;
  }> {
    try {
      // 1. Validate the order
      const validation = await this.validateOrderIntake(orderRequest, clientConfig);
      
      if (!validation.isValid) {
        return {
          success: false,
          validation,
          payment: this.calculatePayment(orderRequest, clientConfig),
          error: 'Order validation failed'
        };
      }

      // 2. Calculate payment
      const payment = this.calculatePayment(orderRequest, clientConfig);

      // 3. Generate order ID (in real implementation, this would come from database)
      const orderId = this.generateOrderId();

      this.logger.info('Order intake completed successfully', {
        orderId,
        clientId: orderRequest.clientId,
        orderType: orderRequest.orderType,
        loanAmount: orderRequest.loanAmount
      });

      return {
        success: true,
        validation,
        payment,
        orderId
      };

    } catch (error) {
      this.logger.error('Order intake process failed', { error });
      return {
        success: false,
        validation: { isValid: false, errors: ['Process failed'], warnings: [], checks: {}, priorityScore: 0, suggestedDueDate: new Date() },
        payment: this.calculatePayment(orderRequest, clientConfig),
        error: 'Intake process encountered an error'
      };
    }
  }

  /**
   * Execute custom validation rules using Dynamic Code Execution Service
   */
  private async executeCustomValidation(
    orderRequest: OrderIntakeRequest,
    clientConfig: ClientConfiguration,
    customRules: string
  ) {
    return await this.codeExecutionService.executeCode(customRules, {
      event: { data: { orderData: orderRequest, clientConfig } },
      context: { userId: 'intake-system', role: 'validation' },
      rule: { name: 'custom-client-validation' },
      timestamp: new Date(),
      utils: {
        date: Date,
        math: Math,
        json: JSON,
        regex: RegExp,
        console: { log: this.logger.info.bind(this.logger), warn: this.logger.warn.bind(this.logger), error: this.logger.error.bind(this.logger) }
      }
    });
  }

  private getUrgencyMultiplier(priority: string): number {
    switch (priority) {
      case 'EMERGENCY': return 0.25;
      case 'RUSH': return 0.5;
      default: return 1.0;
    }
  }

  private getPriorityScore(priority: string): number {
    switch (priority) {
      case 'EMERGENCY': return 5;
      case 'RUSH': return 3;
      default: return 0;
    }
  }

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `ORD-${timestamp}-${random}`.toUpperCase();
  }
}