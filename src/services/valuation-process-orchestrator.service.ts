/**
 * Valuation Process Orchestration Service
 * Coordinates the complete valuation and appraisal management process flow
 */

import { Logger } from '../utils/logger.js';
import { OrderIntakeService, OrderIntakeRequest, ClientConfiguration, OrderValidationResult, PaymentCalculation } from './order-intake.service';
import { VendorAssignmentService, VendorProfile, VendorAssignmentRequest, VendorAssignmentResult } from './vendor-assignment.service';
import { NotificationService } from './notification.service';

export interface ProcessFlowRequest {
  orderIntake: OrderIntakeRequest;
  clientConfig: ClientConfiguration;
  vendorPool: VendorProfile[];
  customBusinessRules?: {
    intakeValidation?: string;
    vendorScoring?: string;
    escalationRules?: string;
  };
}

export interface ProcessFlowResult {
  success: boolean;
  processId: string;
  phase: 'INTAKE' | 'VENDOR_ASSIGNMENT' | 'COMPLETED' | 'FAILED';
  
  // Phase 1 Results
  intakeResult?: {
    validation: OrderValidationResult;
    payment: PaymentCalculation;
    orderId?: string;
  };
  
  // Phase 2 Results
  vendorAssignment?: VendorAssignmentResult;
  
  // Process tracking
  timeline: ProcessEvent[];
  nextActions: string[];
  error?: string;
}

export interface ProcessEvent {
  timestamp: Date;
  phase: string;
  event: string;
  details: any;
  userId?: string;
}

export interface EscalationConfig {
  timeoutHours: {
    EMERGENCY: number;
    RUSH: number;
    STANDARD: number;
  };
  escalationActions: {
    reassignToAlternate: boolean;
    expandSearchRadius: boolean;
    manualIntervention: boolean;
  };
  notificationRecipients: {
    coordinator: string;
    manager: string;
    client?: string;
  };
}

export class ValuationProcessOrchestrator {
  private logger: Logger;
  private intakeService: OrderIntakeService;
  private vendorAssignmentService: VendorAssignmentService;
  private notificationService: NotificationService;

  constructor() {
    this.logger = new Logger('ValuationProcessOrchestrator');
    this.intakeService = new OrderIntakeService();
    this.vendorAssignmentService = new VendorAssignmentService();
    this.notificationService = new NotificationService();
  }

  /**
   * Execute the complete valuation process flow
   */
  async executeProcessFlow(request: ProcessFlowRequest): Promise<ProcessFlowResult> {
    const processId = this.generateProcessId();
    const timeline: ProcessEvent[] = [];
    
    this.logger.info('Starting valuation process flow', {
      processId,
      clientId: request.orderIntake.clientId,
      orderType: request.orderIntake.orderType
    });

    try {
      // Phase 1: Order Entry & Intake
      timeline.push({
        timestamp: new Date(),
        phase: 'INTAKE',
        event: 'PROCESS_STARTED',
        details: { processId, clientId: request.orderIntake.clientId }
      });

      const intakeResult = await this.executePhase1_OrderIntake(
        request.orderIntake,
        request.clientConfig,
        request.customBusinessRules?.intakeValidation
      );

      timeline.push({
        timestamp: new Date(),
        phase: 'INTAKE',
        event: intakeResult.success ? 'INTAKE_COMPLETED' : 'INTAKE_FAILED',
        details: intakeResult
      });

      if (!intakeResult.success) {
        return {
          success: false,
          processId,
          phase: 'INTAKE',
          intakeResult,
          timeline,
          nextActions: ['Review and correct validation errors', 'Resubmit order'],
          error: 'Order intake validation failed'
        };
      }

      // Phase 2: Vendor Engagement
      timeline.push({
        timestamp: new Date(),
        phase: 'VENDOR_ASSIGNMENT',
        event: 'VENDOR_SEARCH_STARTED',
        details: { orderId: intakeResult.orderId }
      });

      const vendorAssignment = await this.executePhase2_VendorEngagement(
        request.orderIntake,
        intakeResult.orderId!,
        request.vendorPool,
        request.customBusinessRules?.vendorScoring
      );

      timeline.push({
        timestamp: new Date(),
        phase: 'VENDOR_ASSIGNMENT',
        event: vendorAssignment.success ? 'VENDOR_ASSIGNED' : 'VENDOR_ASSIGNMENT_FAILED',
        details: vendorAssignment
      });

      // Send notifications
      await this.sendProcessNotifications(processId, intakeResult, vendorAssignment);

      const finalPhase = vendorAssignment.success ? 'COMPLETED' : 'FAILED';
      const nextActions = this.generateNextActions(intakeResult, vendorAssignment);

      return {
        success: vendorAssignment.success,
        processId,
        phase: finalPhase,
        intakeResult,
        vendorAssignment,
        timeline,
        nextActions
      };

    } catch (error) {
      this.logger.error('Process flow execution failed', { error, processId });
      
      timeline.push({
        timestamp: new Date(),
        phase: 'FAILED',
        event: 'PROCESS_ERROR',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return {
        success: false,
        processId,
        phase: 'FAILED',
        timeline,
        nextActions: ['Review error logs', 'Contact system administrator'],
        error: 'Process execution encountered an error'
      };
    }
  }

  /**
   * Monitor assignment acceptance and handle escalation
   */
  async monitorVendorAcceptance(
    processId: string,
    assignmentId: string,
    escalationConfig: EscalationConfig
  ): Promise<{
    requiresEscalation: boolean;
    escalationAction: string;
    reason: string;
  }> {
    // This would typically check database for assignment status
    // For demo purposes, we'll simulate the logic
    
    const hoursElapsed = 6; // Simulated
    const orderPriority = 'RUSH'; // Simulated
    
    const threshold = escalationConfig.timeoutHours[orderPriority as keyof typeof escalationConfig.timeoutHours] || 12;
    
    if (hoursElapsed > threshold) {
      this.logger.warn('Vendor assignment timeout detected', {
        processId,
        assignmentId,
        hoursElapsed,
        threshold
      });

      let escalationAction = 'MANUAL_INTERVENTION';
      
      if (escalationConfig.escalationActions.reassignToAlternate) {
        escalationAction = 'REASSIGN_TO_ALTERNATE';
      } else if (escalationConfig.escalationActions.expandSearchRadius) {
        escalationAction = 'EXPAND_SEARCH_RADIUS';
      }

      // Send escalation notifications
      await this.sendEscalationNotifications(processId, escalationAction, escalationConfig);

      return {
        requiresEscalation: true,
        escalationAction,
        reason: `No vendor response after ${hoursElapsed} hours (threshold: ${threshold}h)`
      };
    }

    return {
      requiresEscalation: false,
      escalationAction: 'NONE',
      reason: 'Within acceptable timeframe'
    };
  }

  /**
   * Phase 1: Order Entry & Intake
   */
  private async executePhase1_OrderIntake(
    orderRequest: OrderIntakeRequest,
    clientConfig: ClientConfiguration,
    customValidationRules?: string
  ) {
    // Add custom validation rules to client config if provided
    if (customValidationRules) {
      clientConfig.customValidationRules = customValidationRules;
    }

    const result = await this.intakeService.processOrderIntake(orderRequest, clientConfig);
    
    this.logger.info('Phase 1 completed', {
      success: result.success,
      orderId: result.orderId,
      validationErrors: result.validation.errors.length,
      paymentRequired: result.payment.paymentRequired
    });

    return result;
  }

  /**
   * Phase 2: Vendor Engagement
   */
  private async executePhase2_VendorEngagement(
    orderRequest: OrderIntakeRequest,
    orderId: string,
    vendorPool: VendorProfile[],
    customScoringRules?: string
  ): Promise<VendorAssignmentResult> {
    
    // Extract property details (in real implementation, this would use geocoding service)
    const propertyParts = orderRequest.propertyAddress.split(', ');
    const propertyState = propertyParts[propertyParts.length - 1]?.split(' ')[0] || 'TX';
    const propertyCounty = 'Travis'; // Would be determined by geocoding

    const assignmentRequest: VendorAssignmentRequest = {
      orderId,
      orderType: orderRequest.orderType,
      productType: orderRequest.productType,
      propertyAddress: orderRequest.propertyAddress,
      propertyState,
      propertyCounty,
      clientId: orderRequest.clientId,
      loanAmount: orderRequest.loanAmount,
      priority: orderRequest.priority,
      borrowerName: orderRequest.borrowerInfo.name,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    };

    const result = await this.vendorAssignmentService.assignBestVendor(
      assignmentRequest,
      vendorPool,
      customScoringRules
    );

    this.logger.info('Phase 2 completed', {
      success: result.success,
      assignedVendor: result.assignedVendor?.businessName,
      alternatesCount: result.alternateVendors?.length || 0
    });

    return result;
  }

  /**
   * Send process notifications
   */
  private async sendProcessNotifications(
    processId: string,
    intakeResult: any,
    vendorAssignment: VendorAssignmentResult
  ): Promise<void> {
    try {
      if (vendorAssignment.success && vendorAssignment.assignedVendor) {
        // Send vendor assignment notification using existing method
        await this.notificationService.notifyVendorAssignment(
          vendorAssignment.assignedVendor.id,
          intakeResult.order || {
            id: intakeResult.orderId,
            clientEmail: intakeResult.clientEmail,
            propertyAddress: intakeResult.propertyAddress,
            dueDate: vendorAssignment.estimatedCompletion,
            fee: vendorAssignment.fee
          }
        );

        this.logger.info('Vendor assignment notification sent', {
          processId,
          vendorId: vendorAssignment.assignedVendor.id,
          vendorEmail: vendorAssignment.assignedVendor.email
        });
      }
    } catch (error) {
      this.logger.error('Failed to send process notifications', { error, processId });
    }
  }

  /**
   * Send escalation notifications
   */
  private async sendEscalationNotifications(
    processId: string,
    escalationAction: string,
    config: EscalationConfig
  ): Promise<void> {
    try {
      // Log escalation notifications (would use email service in production)
      this.logger.warn('Escalation notification required', {
        processId,
        escalationAction,
        coordinator: config.notificationRecipients.coordinator,
        urgency: 'HIGH'
      });

      // For critical escalations, log manager notification requirement
      if (escalationAction === 'MANUAL_INTERVENTION_REQUIRED') {
        this.logger.error('Manager intervention required', {
          processId,
          manager: config.notificationRecipients.manager,
          requiresManagerIntervention: true
        });
      }

      this.logger.info('Escalation notifications sent', { processId, escalationAction });
    } catch (error) {
      this.logger.error('Failed to send escalation notifications', { error, processId });
    }
  }

  /**
   * Generate next action recommendations
   */
  private generateNextActions(intakeResult: any, vendorAssignment: VendorAssignmentResult): string[] {
    const actions: string[] = [];

    if (vendorAssignment.success) {
      actions.push('Monitor vendor acceptance (12-hour deadline)');
      actions.push('Prepare order documents and scope of work');
      actions.push('Schedule quality control review');
    } else {
      actions.push('Review vendor assignment failure reason');
      
      if (vendorAssignment.error === 'No vendors available') {
        actions.push('Expand search to adjacent states');
        actions.push('Consider alternative order types');
        actions.push('Contact vendor coordinator for manual assignment');
      } else if (vendorAssignment.error === 'Conflict of interest') {
        actions.push('Review and update vendor exclusion lists');
        actions.push('Consider third-party vendor networks');
      }
    }

    if (intakeResult.payment.paymentRequired) {
      actions.push('Process borrower payment');
      actions.push('Confirm payment before vendor notification');
    }

    return actions;
  }

  private generateProcessId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `PROC-${timestamp}-${random}`.toUpperCase();
  }
}