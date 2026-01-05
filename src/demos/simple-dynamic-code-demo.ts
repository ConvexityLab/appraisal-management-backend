#!/usr/bin/env node

/**
 * Simple Dynamic Code Demo
 * 
 * A streamlined demo showing the dynamic JavaScript execution capabilities
 * in the notification system. This demo focuses on working examples that
 * demonstrate the core functionality.
 */

import { DynamicCodeExecutionService } from '../services/dynamic-code-execution.service.js';

class SimpleDynamicCodeDemo {
    private codeService: DynamicCodeExecutionService;

    constructor() {
        this.codeService = new DynamicCodeExecutionService();
    }

    async runDemo(): Promise<void> {
        console.log('\n🚀 Simple Dynamic Code Execution Demo');
        console.log('=====================================\n');

        // Test data representing a typical notification event
        const sampleEvent = {
            type: 'appraisal-request',
            data: {
                orderId: 'ORD-2024-001',
                value: 750000,
                propertyType: 'residential',
                clientId: 'VIP-CLIENT-123',
                priority: 'high',
                dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
                location: {
                    state: 'CA',
                    floodZone: false,
                    crimeRate: 0.02
                },
                clientHistory: {
                    totalOrders: 25,
                    defaultRate: 0.01,
                    averageDays: 12
                }
            }
        };

        const sampleContext = {
            tenantId: 'bank-premium-001',
            userId: 'user-456',
            userRole: 'senior-analyst',
            departmentId: 'commercial-lending'
        };

        await this.demo1_SimpleExpressions(sampleEvent, sampleContext);
        await this.demo2_JavaScriptBlocks(sampleEvent, sampleContext);
        await this.demo3_ComplexBusinessLogic(sampleEvent, sampleContext);
        await this.demo4_ErrorHandling();

        console.log('\n✅ All demos completed successfully!\n');
    }

    /**
     * Demo 1: Simple Expression Evaluation
     */
    private async demo1_SimpleExpressions(event: any, context: any): Promise<void> {
        console.log('📋 Demo 1: Simple Expression Evaluation');
        console.log('----------------------------------------');

        const expressions = [
            {
                name: 'High Value Check',
                code: 'event.data.value > 500000',
                expected: true
            },
            {
                name: 'VIP Client Check',
                code: 'event.data.clientId.startsWith("VIP-")',
                expected: true
            },
            {
                name: 'Senior Role Check',
                code: 'context.userRole === "senior-analyst"',
                expected: true
            },
            {
                name: 'Combined Condition',
                code: 'event.data.priority === "high" && event.data.value > 500000',
                expected: true
            }
        ];

        for (const test of expressions) {
            try {
                const executionContext = {
                    event,
                    context,
                    rule: { name: test.name },
                    timestamp: new Date(),
                    utils: {
                        date: Date,
                        math: Math,
                        json: JSON,
                        regex: RegExp,
                        console: { log: console.log, warn: console.warn, error: console.error }
                    }
                };

                const executionResult = await this.codeService.executeCode(
                    `return ${test.code}`,
                    executionContext
                );

                const result = executionResult.success ? executionResult.result : false;
                const status = result === test.expected ? '✅' : '❌';
                console.log(`  ${status} ${test.name}: ${result} (expected: ${test.expected})`);
            } catch (error) {
                console.log(`  ❌ ${test.name}: Error - ${error}`);
            }
        }
        console.log();
    }

    /**
     * Demo 2: JavaScript Code Blocks
     */
    private async demo2_JavaScriptBlocks(event: any, context: any): Promise<void> {
        console.log('📋 Demo 2: JavaScript Code Blocks');
        console.log('----------------------------------');

        // Risk assessment calculation
        const riskAssessmentCode = `
            let riskScore = 0;
            const { value, propertyType, clientHistory, location } = event.data;
            
            // Value-based risk
            if (value > 1000000) riskScore += 3;
            else if (value > 500000) riskScore += 2;
            else if (value > 250000) riskScore += 1;
            
            // Property type risk
            const typeRisk = { residential: 1, commercial: 2, industrial: 3, mixed: 2 };
            riskScore += typeRisk[propertyType] || 0;
            
            // Client history factor
            if (clientHistory && clientHistory.defaultRate > 0.02) riskScore += 2;
            if (clientHistory && clientHistory.totalOrders < 10) riskScore += 1;
            
            // Location risk
            if (location && location.floodZone) riskScore += 2;
            if (location && location.crimeRate > 0.05) riskScore += 1;
            
            console.log('Risk calculation details:', {
                value, propertyType, riskScore,
                clientHistory: clientHistory ? 'present' : 'missing',
                location: location ? 'present' : 'missing'
            });
            
            return riskScore >= 4; // High risk threshold
        `;

        try {
            const executionContext = {
                event,
                context,
                rule: { name: 'Risk Assessment' },
                timestamp: new Date(),
                utils: {
                    date: Date,
                    math: Math,
                    json: JSON,
                    regex: RegExp,
                    console: { log: console.log, warn: console.warn, error: console.error }
                }
            };

            const executionResult = await this.codeService.executeCode(
                riskAssessmentCode,
                executionContext
            );

            const result = executionResult.success ? executionResult.result : false;
            console.log(`  ✅ Risk Assessment Result: ${result}`);
            console.log(`  📊 Risk Score Calculated: ${result ? 'HIGH RISK (≥4)' : 'LOW RISK (<4)'}`);
        } catch (error) {
            console.log(`  ❌ Risk Assessment Error: ${error}`);
        }
        console.log();
    }

    /**
     * Demo 3: Complex Business Logic
     */
    private async demo3_ComplexBusinessLogic(event: any, context: any): Promise<void> {
        console.log('📋 Demo 3: Complex Business Logic');
        console.log('----------------------------------');

        const businessLogicCode = `
            // Multi-factor approval logic
            const { value, propertyType, priority, dueDate } = event.data;
            const { userRole, tenantId } = context;
            
            // Role-based approval limits
            const approvalLimits = {
                'analyst': 250000,
                'senior-analyst': 500000,
                'manager': 1000000,
                'vp': 5000000
            };
            
            const userLimit = approvalLimits[userRole] || 0;
            const exceedsAuthority = value > userLimit;
            
            // Time pressure calculation
            const dueDateTime = new Date(dueDate);
            const hoursUntilDue = (dueDateTime.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
            const isUrgent = hoursUntilDue < 24;
            
            // Tenant-specific rules
            const isPremiumTenant = tenantId.includes('premium');
            const needsExecutiveReview = isPremiumTenant && value > 750000;
            
            // Complex decision matrix
            let requiresNotification = false;
            let reason = [];
            
            if (exceedsAuthority) {
                requiresNotification = true;
                reason.push('exceeds user authority');
            }
            
            if (isUrgent && priority === 'high') {
                requiresNotification = true;
                reason.push('urgent high-priority request');
            }
            
            if (needsExecutiveReview) {
                requiresNotification = true;
                reason.push('premium tenant high-value transaction');
            }
            
            console.log('Business logic analysis:', {
                value, userRole, userLimit, exceedsAuthority,
                hoursUntilDue: hoursUntilDue.toFixed(1), isUrgent,
                isPremiumTenant, needsExecutiveReview,
                requiresNotification, reasons: reason
            });
            
            return requiresNotification;
        `;

        try {
            const executionContext = {
                event,
                context,
                rule: { name: 'Business Logic' },
                timestamp: new Date(),
                utils: {
                    date: Date,
                    math: Math,
                    json: JSON,
                    regex: RegExp,
                    console: { log: console.log, warn: console.warn, error: console.error }
                }
            };

            const executionResult = await this.codeService.executeCode(
                businessLogicCode,
                executionContext
            );

            const result = executionResult.success ? executionResult.result : false;
            console.log(`  ✅ Business Logic Result: ${result}`);
            console.log(`  📋 Decision: ${result ? 'NOTIFICATION REQUIRED' : 'NO NOTIFICATION NEEDED'}`);
        } catch (error) {
            console.log(`  ❌ Business Logic Error: ${error}`);
        }
        console.log();
    }

    /**
     * Demo 4: Error Handling
     */
    private async demo4_ErrorHandling(): Promise<void> {
        console.log('📋 Demo 4: Error Handling');
        console.log('-------------------------');

        const errorTestCases = [
            {
                name: 'Syntax Error',
                code: 'return invalid syntax here;',
                expectError: true
            },
            {
                name: 'Runtime Error',
                code: 'return nonExistentVariable.property;',
                expectError: true
            },
            {
                name: 'Infinite Loop (should timeout)',
                code: 'while(true) { /* infinite loop */ }',
                expectError: true
            },
            {
                name: 'Valid Code',
                code: 'return true;',
                expectError: false
            }
        ];

        for (const test of errorTestCases) {
            try {
                const executionContext = {
                    event: {},
                    context: {},
                    rule: { name: test.name },
                    timestamp: new Date(),
                    utils: {
                        date: Date,
                        math: Math,
                        json: JSON,
                        regex: RegExp,
                        console: { log: console.log, warn: console.warn, error: console.error }
                    }
                };

                const executionResult = await this.codeService.executeCode(
                    test.code,
                    executionContext,
                    { timeout: 1000 } // Short timeout for infinite loop test
                );

                const result = executionResult.success ? executionResult.result : false;
                
                if (test.expectError && !executionResult.success) {
                    console.log(`  ✅ ${test.name}: Correctly caught error - ${executionResult.error}`);
                } else if (test.expectError && executionResult.success) {
                    console.log(`  ⚠️  ${test.name}: Expected error but got result: ${result}`);
                } else if (!test.expectError && executionResult.success) {
                    console.log(`  ✅ ${test.name}: ${result}`);
                } else {
                    console.log(`  ❌ ${test.name}: Unexpected error - ${executionResult.error}`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                if (test.expectError) {
                    console.log(`  ✅ ${test.name}: Correctly caught error - ${errorMessage}`);
                } else {
                    console.log(`  ❌ ${test.name}: Unexpected error - ${errorMessage}`);
                }
            }
        }
        console.log();
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    const demo = new SimpleDynamicCodeDemo();
    demo.runDemo().catch(console.error);
}

export { SimpleDynamicCodeDemo };