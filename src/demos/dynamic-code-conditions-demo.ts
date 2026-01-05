/**
 * Dynamic Code Conditions Demo
 * Demonstrates JavaScript/Node.js code execution in notification conditions
 */

import { NotificationConditionBuilder } from '../services/condition-builder.service.js';
import { DynamicCodeExecutionService } from '../services/dynamic-code-execution.service.js';
import { NotificationRuleRepository } from '../services/notification-rule-repository.service.js';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { PersistedNotificationRule, NotificationContext } from '../types/persistent-notifications.js';
import { AppEvent } from '../types/events.js';
import { Logger } from '../utils/logger.js';

export class DynamicCodeConditionsDemo {
  private logger: Logger;
  private conditionBuilder: NotificationConditionBuilder;
  private codeService: DynamicCodeExecutionService;
  private repository: NotificationRuleRepository;

  constructor() {
    this.logger = new Logger('DynamicCodeConditionsDemo');
    this.conditionBuilder = new NotificationConditionBuilder();
    this.codeService = new DynamicCodeExecutionService();
    this.repository = new NotificationRuleRepository(new CosmosDbService());
  }

  async runDemo(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Dynamic Code Conditions Demo');

      await this.repository.initialize();

      // Show available templates
      await this.showAvailableTemplates();

      // Demonstrate simple expressions
      await this.demonstrateExpressions();

      // Demonstrate JavaScript code blocks
      await this.demonstrateJavaScriptCode();

      // Demonstrate function-style conditions
      await this.demonstrateFunctionConditions();

      // Demonstrate predefined templates
      await this.demonstrateTemplates();

      // Create real notification rules with dynamic conditions
      await this.createRulesWithDynamicConditions();

      // Test the dynamic conditions
      await this.testDynamicConditions();

      this.logger.info('🎉 Dynamic Code Conditions Demo completed successfully!');

    } catch (error) {
      this.logger.error('❌ Demo failed', { error });
      throw error;
    }
  }

  private async showAvailableTemplates(): Promise<void> {
    this.logger.info('📋 Available Code Templates:');
    
    const templates = this.conditionBuilder.getAvailableTemplates();
    
    Object.entries(templates).forEach(([name, template]) => {
      this.logger.info(`  📄 ${name}:`);
      this.logger.info(`     Description: ${template.description}`);
      this.logger.info(`     Example: ${template.example}`);
      this.logger.info('');
    });
  }

  private async demonstrateExpressions(): Promise<void> {
    this.logger.info('🧮 Demonstrating Simple Expressions:');

    const testEvent = {
      data: {
        orderId: 'ORD-123',
        value: 750000,
        priority: 'high',
        propertyType: 'commercial',
        clientId: 'VIP-CLIENT-001'
      }
    };

    const context = {
      tenantId: 'tenant-001',
      userId: 'user-001',
      userRole: 'manager'
    };

    // Simple value comparison
    const highValueCondition = this.conditionBuilder.expression(
      'event.data.value > 500000',
      'High value order check'
    );

    const result1 = await highValueCondition(testEvent, context);
    this.logger.info(`  💰 High value check: ${result1} (value: $${testEvent.data.value})`);

    // String pattern matching
    const vipClientCondition = this.conditionBuilder.expression(
      'event.data.clientId.startsWith("VIP-")',
      'VIP client check'
    );

    const result2 = await vipClientCondition(testEvent, context);
    this.logger.info(`  ⭐ VIP client check: ${result2} (clientId: ${testEvent.data.clientId})`);

    // Complex expression with multiple conditions
    const complexCondition = this.conditionBuilder.expression(
      'event.data.value > 500000 && event.data.priority === "high" && event.data.propertyType === "commercial"',
      'Complex multi-factor check'
    );

    const result3 = await complexCondition(testEvent, context);
    this.logger.info(`  🔍 Complex condition: ${result3}`);
  }

  private async demonstrateJavaScriptCode(): Promise<void> {
    this.logger.info('💻 Demonstrating JavaScript Code Blocks:');

    const testEvent = {
      data: {
        orderId: 'ORD-456',
        value: 300000,
        dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        clientHistory: {
          totalOrders: 25,
          averageValue: 400000,
          defaultRate: 0.02
        },
        location: 'downtown-business-district'
      }
    };

    const context = {
      tenantId: 'tenant-001',
      userId: 'user-001',
      userRole: 'analyst',
      preferences: {
        riskTolerance: 'medium'
      }
    };

    // Risk scoring algorithm
    const riskScoringCode = `
      let riskScore = 0;
      const { value, clientHistory, location } = event.data;
      
      // Value-based risk
      if (value > 1000000) riskScore += 3;
      else if (value > 500000) riskScore += 2;
      else if (value > 100000) riskScore += 1;
      
      // Client history risk
      if (clientHistory) {
        if (clientHistory.defaultRate > 0.05) riskScore += 3;
        else if (clientHistory.defaultRate > 0.02) riskScore += 1;
        
        if (clientHistory.totalOrders < 5) riskScore += 2;
      }
      
      // Location risk
      if (location && location.includes('high-risk')) riskScore += 2;
      
      // Log the calculation for transparency
      console.log('Risk calculation:', {
        value, 
        defaultRate: clientHistory?.defaultRate, 
        totalOrders: clientHistory?.totalOrders,
        location,
        finalScore: riskScore
      });
      
      return riskScore >= 4;
    `;

    const riskCondition = this.conditionBuilder.javascript(
      riskScoringCode,
      'Advanced risk scoring algorithm'
    );

    const riskResult = await riskCondition(testEvent, context);
    this.logger.info(`  🎯 Risk assessment result: ${riskResult}`);

    // Time-based condition with business logic
    const businessHoursCode = `
      const now = timestamp;
      const hour = now.getHours();
      const day = now.getDay();
      const dueDate = new Date(event.data.dueDate);
      
      // Calculate hours until due
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Business hours: Mon-Fri 9AM-5PM
      const isBusinessHours = day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
      
      // Special handling for urgent items outside business hours
      if (!isBusinessHours && hoursUntilDue <= 8) {
        console.log('Outside business hours but urgent - escalating');
        return true;
      }
      
      // Normal business hours handling
      if (isBusinessHours && hoursUntilDue <= 24) {
        console.log('Business hours and due within 24 hours');
        return true;
      }
      
      return false;
    `;

    const timeCondition = this.conditionBuilder.javascript(
      businessHoursCode,
      'Business hours with urgency escalation'
    );

    const timeResult = await timeCondition(testEvent, context);
    this.logger.info(`  ⏰ Time-based condition result: ${timeResult}`);
  }

  private async demonstrateFunctionConditions(): Promise<void> {
    this.logger.info('🔧 Demonstrating Function-Style Conditions:');

    const testEvent = {
      data: {
        orderId: 'ORD-789',
        propertyData: {
          type: 'residential',
          squareFootage: 2500,
          yearBuilt: 1995,
          condition: 'good',
          neighborhood: 'suburban'
        },
        appraisalRequest: {
          purpose: 'refinance',
          loanAmount: 400000,
          ltv: 0.8
        }
      }
    };

    const context = {
      tenantId: 'bank-a',
      userId: 'underwriter-001',
      userRole: 'underwriter',
      department: 'lending'
    };

    // Complex property evaluation function
    const propertyEvaluationFunction = `
      // Extract property and loan data
      const { propertyData, appraisalRequest } = event.data;
      
      if (!propertyData || !appraisalRequest) {
        console.warn('Missing required property or appraisal data');
        return false;
      }
      
      // Calculate property score based on multiple factors
      let propertyScore = 0;
      
      // Age factor
      const currentYear = new Date().getFullYear();
      const propertyAge = currentYear - propertyData.yearBuilt;
      
      if (propertyAge < 10) propertyScore += 3;
      else if (propertyAge < 25) propertyScore += 2;
      else if (propertyAge < 50) propertyScore += 1;
      
      // Size factor
      if (propertyData.squareFootage > 3000) propertyScore += 2;
      else if (propertyData.squareFootage > 2000) propertyScore += 1;
      
      // Condition factor
      const conditionScores = { excellent: 3, good: 2, fair: 1, poor: 0 };
      propertyScore += conditionScores[propertyData.condition] || 0;
      
      // LTV risk factor
      const ltv = appraisalRequest.ltv;
      const isHighLTV = ltv > 0.85;
      const isComplexProperty = propertyScore < 4;
      
      // Decision logic
      const needsSpecialReview = isHighLTV && isComplexProperty;
      
      console.log('Property evaluation:', {
        propertyAge,
        squareFootage: propertyData.squareFootage,
        condition: propertyData.condition,
        propertyScore,
        ltv,
        needsSpecialReview
      });
      
      return needsSpecialReview;
    `;

    const propertyCondition = this.conditionBuilder.function(
      propertyEvaluationFunction,
      'Complex property evaluation with scoring'
    );

    const propertyResult = await propertyCondition(testEvent, context);
    this.logger.info(`  🏠 Property evaluation result: ${propertyResult}`);

    // User context-aware function
    const contextAwareFunction = `
      // Check user permissions and department
      const userRole = context.userRole;
      const department = context.department;
      const tenantId = context.tenantId;
      
      // Different rules for different roles
      const rolePermissions = {
        'underwriter': { canApproveAmount: 500000, requiresSecondary: true },
        'senior-underwriter': { canApproveAmount: 1000000, requiresSecondary: false },
        'manager': { canApproveAmount: 2000000, requiresSecondary: false }
      };
      
      const permissions = rolePermissions[userRole];
      if (!permissions) {
        console.warn('Unknown user role:', userRole);
        return true; // Default to requiring notification
      }
      
      const loanAmount = event.data.appraisalRequest?.loanAmount || 0;
      const exceedsAuthority = loanAmount > permissions.canApproveAmount;
      
      // Tenant-specific rules
      const isBankA = tenantId === 'bank-a';
      const needsAdditionalReview = isBankA && loanAmount > 750000;
      
      const result = exceedsAuthority || needsAdditionalReview;
      
      console.log('Authority check:', {
        userRole,
        department,
        tenantId,
        loanAmount,
        canApprove: permissions.canApproveAmount,
        exceedsAuthority,
        needsAdditionalReview,
        finalDecision: result
      });
      
      return result;
    `;

    const contextCondition = this.conditionBuilder.function(
      contextAwareFunction,
      'Context-aware approval authority check'
    );

    const contextResult = await contextCondition(testEvent, context);
    this.logger.info(`  👤 Context-aware condition result: ${contextResult}`);
  }

  private async demonstrateTemplates(): Promise<void> {
    this.logger.info('📄 Demonstrating Predefined Templates:');

    const testEvent = {
      data: {
        orderId: 'ORD-TEMPLATE-001',
        priority: 'high',
        value: 850000,
        dueDate: new Date(Date.now() + 18 * 60 * 60 * 1000), // 18 hours from now
        qcScore: 72,
        hasFlags: true
      }
    };

    const context = {
      tenantId: 'tenant-001',
      userId: 'user-001',
      userRole: 'quality-manager'
    };

    // Use business hours template
    const businessHoursCondition = this.conditionBuilder.template('business-hours');
    const businessHoursResult = await businessHoursCondition(testEvent, context);
    this.logger.info(`  🕘 Business hours template: ${businessHoursResult}`);

    // Use deadline approaching template
    const deadlineCondition = this.conditionBuilder.template('deadline-approaching');
    const deadlineResult = await deadlineCondition(testEvent, context);
    this.logger.info(`  ⏰ Deadline approaching template: ${deadlineResult}`);

    // Use high value transaction template with parameters
    const highValueCondition = this.conditionBuilder.template('high-value-transaction');
    const highValueResult = await highValueCondition(testEvent, context);
    this.logger.info(`  💰 High value template: ${highValueResult}`);
  }

  private async createRulesWithDynamicConditions(): Promise<void> {
    this.logger.info('📝 Creating Notification Rules with Dynamic Conditions:');

    // Rule 1: Complex risk assessment with JavaScript
    const riskAssessmentRule: PersistedNotificationRule = {
      id: 'rule-dynamic-risk-001',
      eventType: 'appraisal-order-created',
      condition: this.conditionBuilder.javascript(`
        const { value, propertyType, clientHistory, location } = event.data;
        let riskScore = 0;
        
        // Multiple risk factors
        if (value > 1000000) riskScore += 3;
        if (propertyType === 'industrial') riskScore += 2;
        if (clientHistory?.defaultRate > 0.03) riskScore += 2;
        if (location?.includes('flood-zone')) riskScore += 2;
        
        console.log('Risk assessment:', { value, propertyType, riskScore });
        return riskScore >= 5;
      `, 'Dynamic risk assessment with multiple factors'),
      template: {
        title: 'High Risk Order Detected - {{orderId}}',
        message: 'Order {{orderId}} flagged for high risk - manual review required'
      },
      channels: ['websocket', 'email'],
      priority: 'critical',
      isActive: true,
      version: 1,
      createdAt: new Date(),
      createdBy: 'dynamic-demo',
      updatedAt: new Date(),
      updatedBy: 'dynamic-demo'
    };

    await this.repository.createRule(riskAssessmentRule);
    this.logger.info('  ✅ Created dynamic risk assessment rule');

    // Rule 2: Time-sensitive with business logic
    const timeSensitiveRule: PersistedNotificationRule = {
      id: 'rule-dynamic-time-001',
      eventType: 'deadline-approaching',
      condition: this.conditionBuilder.function(`
        const dueDate = new Date(event.data.dueDate);
        const hoursRemaining = helpers.hoursUntil(dueDate);
        const priority = event.data.priority;
        const userRole = context.userRole;
        
        // Escalation matrix based on role and time
        if (userRole === 'manager') {
          return hoursRemaining <= 8 && priority === 'high';
        } else if (userRole === 'analyst') {
          return hoursRemaining <= 4 && priority === 'critical';
        }
        
        return hoursRemaining <= 2; // Default urgent threshold
      `, 'Role-based time escalation'),
      template: {
        title: 'Urgent Deadline Alert - {{orderId}}',
        message: 'Order {{orderId}} due in {{hoursRemaining}} hours - role: {{userRole}}'
      },
      channels: ['websocket', 'sms'],
      priority: 'high',
      isActive: true,
      version: 1,
      createdAt: new Date(),
      createdBy: 'dynamic-demo',
      updatedAt: new Date(),
      updatedBy: 'dynamic-demo'
    };

    await this.repository.createRule(timeSensitiveRule);
    this.logger.info('  ✅ Created dynamic time-sensitive rule');

    // Rule 3: Using predefined template
    const templateBasedRule: PersistedNotificationRule = {
      id: 'rule-template-001',
      eventType: 'qc-review-completed',
      condition: this.conditionBuilder.template('data-quality-check'),
      template: {
        title: 'Data Quality Issue - {{orderId}}',
        message: 'Quality review found data issues requiring attention'
      },
      channels: ['websocket'],
      priority: 'normal',
      isActive: true,
      version: 1,
      createdAt: new Date(),
      createdBy: 'dynamic-demo',
      updatedAt: new Date(),
      updatedBy: 'dynamic-demo'
    };

    await this.repository.createRule(templateBasedRule);
    this.logger.info('  ✅ Created template-based rule');
  }

  private async testDynamicConditions(): Promise<void> {
    this.logger.info('🧪 Testing Dynamic Conditions with Sample Events:');

    const context: NotificationContext = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      userRole: 'manager',
      departmentId: 'lending'
    };

    // Test high-risk event
    const highRiskEvent = {
      data: {
        orderId: 'ORD-HIGHRISK-001',
        value: 1500000,
        propertyType: 'industrial',
        clientHistory: { defaultRate: 0.05 },
        location: 'flood-zone-area'
      }
    };

    this.logger.info('  📊 Testing high-risk event:');
    const riskRules = await this.repository.getRulesForContext(context, 'appraisal-order-created');
    this.logger.info(`    Found ${riskRules.length} applicable rules`);

    // Test time-sensitive event
    const urgentEvent = {
      data: {
        orderId: 'ORD-URGENT-001',
        dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
        priority: 'high'
      }
    };

    this.logger.info('  ⏰ Testing time-sensitive event:');
    const timeRules = await this.repository.getRulesForContext(context, 'deadline-approaching');
    this.logger.info(`    Found ${timeRules.length} applicable rules`);

    this.logger.info('🎉 Dynamic condition testing completed!');
  }
}

// Export demo runner function
export async function runDynamicCodeConditionsDemo(): Promise<void> {
  const demo = new DynamicCodeConditionsDemo();
  await demo.runDemo();
}

// Also export examples for documentation
export const dynamicCodeExamples = {
  // Simple expressions
  expressions: {
    highValue: 'event.data.value > 500000',
    vipClient: 'event.data.clientId.startsWith("VIP-")',
    businessHours: 'timestamp.getHours() >= 9 && timestamp.getHours() <= 17 && timestamp.getDay() >= 1 && timestamp.getDay() <= 5',
    multiCondition: 'event.data.priority === "high" && event.data.value > 100000 && context.userRole === "manager"'
  },

  // JavaScript code blocks
  codeBlocks: {
    riskAssessment: `
      let riskScore = 0;
      const { value, propertyType, clientHistory } = event.data;
      
      if (value > 1000000) riskScore += 3;
      if (propertyType === 'commercial') riskScore += 2;
      if (clientHistory?.defaultRate > 0.05) riskScore += 2;
      
      return riskScore >= 4;
    `,
    
    timeBasedEscalation: `
      const dueDate = new Date(event.data.dueDate);
      const hoursRemaining = (dueDate.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
      const isWeekend = timestamp.getDay() === 0 || timestamp.getDay() === 6;
      
      if (isWeekend && hoursRemaining <= 48) return true;
      if (!isWeekend && hoursRemaining <= 24) return true;
      
      return false;
    `
  },

  // Function-style conditions
  functions: {
    complexApproval: `
      const { loanAmount, propertyValue, creditScore } = event.data;
      const userRole = context.userRole;
      
      // Calculate LTV ratio
      const ltv = loanAmount / propertyValue;
      
      // Role-based approval limits
      const approvalLimits = {
        'analyst': 250000,
        'senior-analyst': 500000,
        'manager': 1000000
      };
      
      const limit = approvalLimits[userRole] || 0;
      const needsApproval = loanAmount > limit || ltv > 0.8 || creditScore < 650;
      
      console.log('Approval check:', { loanAmount, ltv, creditScore, userRole, needsApproval });
      return needsApproval;
    `
  }
};