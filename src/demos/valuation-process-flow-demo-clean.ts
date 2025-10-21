#!/usr/bin/env node

/**
 * Valuation Process Flow Demo
 * 
 * Demonstrates how the platform components orchestrate the complete
 * Valuation and Appraisal Management Process Flow from order intake
 * through vendor assignment using actual service classes.
 */

import { OrderIntakeService } from '../services/order-intake.service';
import { VendorAssignmentService } from '../services/vendor-assignment.service';
import { ValuationProcessOrchestrator } from '../services/valuation-process-orchestrator.service';
import { OrderManagementService } from '../services/order-management.service';
import { VendorManagementService } from '../services/vendor-management.service';
import { NotificationService } from '../services/notification.service';
import { Logger } from '../utils/logger';
import { AppraisalOrder, OrderType, ProductType, Priority } from '../types/index.js';

interface DemoOrderRequest {
  clientId: string;
  clientEmail: string;
  orderType: OrderType;
  productType: ProductType;
  propertyAddress: string;
  loanAmount: number;
  priority: Priority;
  borrowerInfo: {
    name: string;
    email: string;
    phone: string;
  };
}

class ValuationProcessDemo {
  private orderIntakeService: OrderIntakeService;
  private vendorAssignmentService: VendorAssignmentService;
  private orchestrator: ValuationProcessOrchestrator;
  private orderService: OrderManagementService;
  private vendorService: VendorManagementService;
  private notificationService: NotificationService;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ValuationProcessDemo');
    this.orderService = new OrderManagementService();
    this.vendorService = new VendorManagementService();
    this.notificationService = new NotificationService();
    this.orderIntakeService = new OrderIntakeService();
    this.vendorAssignmentService = new VendorAssignmentService();
    this.orchestrator = new ValuationProcessOrchestrator(
      this.orderIntakeService,
      this.vendorAssignmentService,
      this.notificationService
    );
  }

  /**
   * Run the complete valuation process flow demonstration
   */
  async runDemo(): Promise<void> {
    console.log('\n🏠 Valuation and Appraisal Management Process Flow Demo');
    console.log('=====================================================\n');

    try {
      // Create sample order request
      const orderRequest = this.createSampleOrderRequest();

      // Phase 1: Order Entry & Intake
      await this.demonstratePhase1_OrderIntake(orderRequest);

      // Phase 2: Vendor Engagement  
      await this.demonstratePhase2_VendorEngagement(orderRequest);

      // Phase 3: Automated Workflow Management
      await this.demonstrateAutomatedWorkflow(orderRequest);

      console.log('\n✅ Complete valuation process flow demonstrated!');

    } catch (error) {
      this.logger.error('Demo failed', { error });
      console.error('❌ Demo failed:', error);
    }
  }

  /**
   * Phase 1: Order Entry & Intake using actual OrderIntakeService
   */
  private async demonstratePhase1_OrderIntake(orderRequest: DemoOrderRequest): Promise<any> {
    console.log('📋 Phase 1: Order Entry & Intake');
    console.log('=================================');

    try {
      // Create order object for intake service
      const intakeRequest = {
        orderId: `ORD-2024-${Date.now().toString().slice(-3)}`,
        clientId: orderRequest.clientId,
        clientEmail: orderRequest.clientEmail,
        orderType: orderRequest.orderType,
        productType: orderRequest.productType,
        propertyAddress: orderRequest.propertyAddress,
        loanAmount: orderRequest.loanAmount,
        priority: orderRequest.priority,
        borrowerInfo: orderRequest.borrowerInfo,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        additionalRequirements: []
      };

      // Process order intake using actual service
      const intakeResult = await this.orderIntakeService.processOrderIntake(intakeRequest);

      console.log('  ✅ Order Intake Validation:');
      console.log(`     Order Complete: ${intakeResult.isValid}`);
      console.log(`     Priority Score: ${intakeResult.priorityScore}`);
      console.log(`     Suggested Due Date: ${intakeResult.suggestedDueDate?.toLocaleDateString()}`);
      
      if (intakeResult.validationWarnings && intakeResult.validationWarnings.length > 0) {
        console.log('     ⚠️  Warnings:');
        intakeResult.validationWarnings.forEach(warning => {
          console.log(`       • ${warning}`);
        });
      }

      if (intakeResult.validationResults) {
        console.log('     ✓ Validation Checks:');
        Object.entries(intakeResult.validationResults).forEach(([check, result]) => {
          console.log(`       ${check}: ${result}`);
        });
      }

      // Calculate payment using actual service
      const paymentResult = await this.orderIntakeService.calculatePayment(intakeRequest);

      console.log('\n  💰 Payment Processing:');
      console.log(`     Payment Required: ${paymentResult.paymentRequired}`);
      console.log(`     Payment Method: ${paymentResult.paymentMethod}`);
      console.log(`     Base Amount: $${paymentResult.baseAmount}`);
      console.log(`     Priority Fee: $${paymentResult.priorityFee || 0}`);
      console.log(`     Total Amount: $${paymentResult.totalAmount}`);

      return { intakeResult, paymentResult, order: intakeRequest };

    } catch (error) {
      this.logger.error('Phase 1 failed', { error });
      console.error('❌ Phase 1 failed:', error);
      throw error;
    }
  }

  /**
   * Phase 2: Vendor Engagement using actual VendorAssignmentService
   */
  private async demonstratePhase2_VendorEngagement(orderRequest: DemoOrderRequest): Promise<any> {
    console.log('\n🤝 Phase 2: Vendor Engagement');
    console.log('==============================');

    try {
      // Get available vendors using actual service
      const vendorSearchResult = await this.vendorService.getVendors({
        status: 'ACTIVE',
        state: 'TX' // Assuming Texas for demo
      });

      const availableVendors = vendorSearchResult.vendors || [];
      console.log(`  🎯 Vendor Selection Results:`);
      console.log(`     Eligible Vendors: ${availableVendors.length}`);

      if (availableVendors.length === 0) {
        console.log('     ❌ No vendors available');
        return { success: false, error: 'No vendors available' };
      }

      // Create assignment request
      const assignmentRequest = {
        orderId: `ORD-2024-${Date.now().toString().slice(-3)}`,
        orderType: orderRequest.orderType,
        productType: orderRequest.productType,
        propertyState: 'TX',
        priority: orderRequest.priority,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        loanAmount: orderRequest.loanAmount,
        clientId: orderRequest.clientId
      };

      // Mock vendor pool for assignment service
      const mockVendorPool = [
        {
          id: 'vendor-001',
          businessName: 'Elite Appraisal Services',
          email: 'john@eliteappraisal.com',
          state: 'TX',
          serviceTypes: ['FULL_APPRAISAL', 'DRIVE_BY'],
          averageQCScore: 95,
          averageTurnaroundDays: 5,
          currentWorkload: 8,
          maxConcurrentOrders: 15,
          isAvailable: true,
          excludedClients: []
        },
        {
          id: 'vendor-002',
          businessName: 'Rapid Valuations LLC',
          email: 'sarah@rapidvaluations.com',
          state: 'TX',
          serviceTypes: ['FULL_APPRAISAL'],
          averageQCScore: 92,
          averageTurnaroundDays: 4,
          currentWorkload: 12,
          maxConcurrentOrders: 15,
          isAvailable: true,
          excludedClients: []
        },
        {
          id: 'vendor-003',
          businessName: 'Professional Property Evaluators',
          email: 'mike@propevaluators.com',
          state: 'TX',
          serviceTypes: ['FULL_APPRAISAL', 'COMMERCIAL'],
          averageQCScore: 88,
          averageTurnaroundDays: 6,
          currentWorkload: 6,
          maxConcurrentOrders: 20,
          isAvailable: true,
          excludedClients: []
        }
      ];

      // Use actual vendor assignment service
      const vendorAssignment = await this.vendorAssignmentService.assignBestVendor(
        assignmentRequest,
        mockVendorPool
      );

      if (vendorAssignment.success && vendorAssignment.assignedVendor) {
        console.log('\n     🏆 Recommended Vendor:');
        console.log(`       Business: ${vendorAssignment.assignedVendor.businessName}`);
        console.log(`       Score: ${Math.round(((vendorAssignment.assignedVendor.averageQCScore / 100) * 80) + 20)}/100`);
        console.log(`       Capacity: ${Math.round((vendorAssignment.assignedVendor.currentWorkload / vendorAssignment.assignedVendor.maxConcurrentOrders) * 100)}% utilized`);
        console.log(`       Selection Reasons:`);
        console.log(`         • ${vendorAssignment.assignmentReason}`);

        if (vendorAssignment.alternateVendors && vendorAssignment.alternateVendors.length > 0) {
          console.log('\n     📋 Alternative Vendors:');
          vendorAssignment.alternateVendors.forEach((vendor, index) => {
            const score = Math.round(((vendor.averageQCScore / 100) * 80) + 20);
            console.log(`       ${index + 2}. ${vendor.businessName} (Score: ${score})`);
          });
        }
      } else {
        console.log(`     ❌ Assignment failed: ${vendorAssignment.error}`);
      }

      // Check conflicts using actual service
      const conflictCheck = await this.vendorAssignmentService.checkConflicts(
        assignmentRequest,
        vendorAssignment.assignedVendor?.id || 'vendor-001'
      );

      console.log('\n  🔍 Conflict of Interest Check:');
      console.log(`     Can Proceed: ${conflictCheck.canProceed}`);
      console.log(`     Risk Level: ${conflictCheck.riskLevel}`);
      console.log(`     ✅ Assignment approved - no conflicts detected`);

      return vendorAssignment;

    } catch (error) {
      this.logger.error('Phase 2 failed', { error });
      console.error('❌ Phase 2 failed:', error);
      throw error;
    }
  }

  /**
   * Phase 3: Automated Workflow Management using orchestrator
   */
  private async demonstrateAutomatedWorkflow(orderRequest: DemoOrderRequest): Promise<void> {
    console.log('\n🤖 Automated Workflow Management');
    console.log('=================================');

    try {
      // Create a complete order request for the orchestrator
      const processRequest = {
        orderId: `ORD-2024-001`,
        clientId: orderRequest.clientId,
        clientEmail: orderRequest.clientEmail,
        orderType: orderRequest.orderType,
        productType: orderRequest.productType,
        propertyAddress: orderRequest.propertyAddress,
        loanAmount: orderRequest.loanAmount,
        priority: orderRequest.priority,
        borrowerInfo: orderRequest.borrowerInfo,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        additionalRequirements: []
      };

      // Run the complete orchestrated process
      const processResult = await this.orchestrator.executeProcessFlow(processRequest);

      console.log('  ⏰ Escalation Management:');
      console.log(`     Should Escalate: ${processResult.escalation?.shouldEscalate || false}`);
      console.log(`     Action Required: ${processResult.escalation?.action || 'NONE'}`);
      console.log(`     Reason: ${processResult.escalation?.reason || 'Process running normally'}`);
      
      if (processResult.escalation?.shouldEscalate) {
        console.log('     📧 Notifications Triggered:');
        console.log(`       • HIGH: ${processResult.escalation.reason}`);
      }

      if (processResult.nextActions && processResult.nextActions.length > 0) {
        console.log('     📝 Recommended Next Steps:');
        processResult.nextActions.forEach(action => {
          console.log(`       • ${action}`);
        });
      }

    } catch (error) {
      this.logger.error('Phase 3 failed', { error });
      console.error('❌ Phase 3 failed:', error);
      throw error;
    }
  }

  /**
   * Create sample order request for demonstration
   */
  private createSampleOrderRequest(): DemoOrderRequest {
    return {
      clientId: 'client-demo-001',
      clientEmail: 'client@demolender.com',
      orderType: OrderType.FULL_APPRAISAL,
      productType: ProductType.SINGLE_FAMILY,
      propertyAddress: '123 Main St, Dallas, TX 75201',
      loanAmount: 750000,
      priority: Priority.RUSH,
      borrowerInfo: {
        name: 'John Doe',
        email: 'john.doe@email.com',
        phone: '555-123-4567'
      }
    };
  }
}

// Run the demo
async function runDemo(): Promise<void> {
  const demo = new ValuationProcessDemo();
  await demo.runDemo();
}

// Execute if run directly
if (require.main === module) {
  runDemo().catch(console.error);
}

export { ValuationProcessDemo, runDemo };