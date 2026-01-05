#!/usr/bin/env node

/**
 * Advanced Dynamic Code Execution Service Demo
 * 
 * Demonstrates various real-world use cases for the Dynamic Code Execution Service:
 * - Financial calculations
 * - Business rules processing
 * - Data transformation
 * - Risk assessment
 * - Report generation
 */

import { DynamicCodeExecutionService } from '../services/dynamic-code-execution.service.js';

class AdvancedDynamicCodeDemo {
    private codeService: DynamicCodeExecutionService;

    constructor() {
        this.codeService = new DynamicCodeExecutionService();
    }

    async runDemo(): Promise<void> {
        console.log('\n🚀 Advanced Dynamic Code Execution Demo');
        console.log('=========================================\n');

        await this.demo1_FinancialCalculations();
        await this.demo2_BusinessRulesEngine();
        await this.demo3_DataTransformation();
        await this.demo4_RiskAssessment();
        await this.demo5_ReportGeneration();
        await this.demo6_ValidationEngine();

        console.log('\n✅ All advanced demos completed successfully!\n');
    }

    /**
     * Demo 1: Financial Calculations
     */
    private async demo1_FinancialCalculations(): Promise<void> {
        console.log('💰 Demo 1: Financial Calculations');
        console.log('----------------------------------');

        // Loan payment calculation
        const loanCalculationCode = `
            const { principal, annualRate, termYears } = event.data;
            const monthlyRate = annualRate / 12 / 100;
            const totalPayments = termYears * 12;
            
            const monthlyPayment = principal * 
                (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
                (Math.pow(1 + monthlyRate, totalPayments) - 1);
            
            const totalPaid = monthlyPayment * totalPayments;
            const totalInterest = totalPaid - principal;
            
            return {
                monthlyPayment: Math.round(monthlyPayment * 100) / 100,
                totalPaid: Math.round(totalPaid * 100) / 100,
                totalInterest: Math.round(totalInterest * 100) / 100,
                effectiveRate: Math.round((totalInterest / principal) * 100 * 100) / 100
            };
        `;

        const loanContext = {
            event: { data: { principal: 300000, annualRate: 4.25, termYears: 30 } },
            context: { calculationType: 'mortgage' },
            rule: { name: 'mortgage-calculator' },
            timestamp: new Date(),
            utils: { date: Date, math: Math, json: JSON, regex: RegExp, console: console }
        };

        try {
            const result = await this.codeService.executeCode(loanCalculationCode, loanContext);
            if (result.success) {
                console.log('  ✅ Mortgage Calculation:');
                console.log(`     Principal: $${loanContext.event.data.principal.toLocaleString()}`);
                console.log(`     Monthly Payment: $${result.result.monthlyPayment.toLocaleString()}`);
                console.log(`     Total Interest: $${result.result.totalInterest.toLocaleString()}`);
                console.log(`     Effective Rate: ${result.result.effectiveRate}%`);
            }
        } catch (error) {
            console.log(`  ❌ Loan calculation failed: ${error}`);
        }
        console.log();
    }

    /**
     * Demo 2: Business Rules Engine
     */
    private async demo2_BusinessRulesEngine(): Promise<void> {
        console.log('📋 Demo 2: Business Rules Engine');
        console.log('---------------------------------');

        // Dynamic pricing rules
        const pricingRulesCode = `
            const { product, customer, market } = event.data;
            let finalPrice = product.basePrice;
            const adjustments = [];
            
            // Customer tier pricing
            const tierDiscounts = { bronze: 0, silver: 0.05, gold: 0.1, platinum: 0.15 };
            const customerDiscount = tierDiscounts[customer.tier] || 0;
            if (customerDiscount > 0) {
                finalPrice *= (1 - customerDiscount);
                adjustments.push(\`Customer tier (\${customer.tier}): -\${(customerDiscount * 100)}%\`);
            }
            
            // Volume discount
            if (product.quantity >= 100) {
                finalPrice *= 0.9;
                adjustments.push('Volume discount: -10%');
            }
            
            // Market conditions
            if (market.demand === 'high') {
                finalPrice *= 1.1;
                adjustments.push('High demand: +10%');
            } else if (market.demand === 'low') {
                finalPrice *= 0.95;
                adjustments.push('Low demand: -5%');
            }
            
            // Seasonal adjustment
            const currentMonth = timestamp.getMonth();
            if ([11, 0, 1].includes(currentMonth)) { // Dec, Jan, Feb
                finalPrice *= 1.05;
                adjustments.push('Winter premium: +5%');
            }
            
            return {
                originalPrice: product.basePrice,
                finalPrice: Math.round(finalPrice * 100) / 100,
                totalDiscount: Math.round((1 - finalPrice / product.basePrice) * 100 * 100) / 100,
                adjustments
            };
        `;

        const pricingContext = {
            event: {
                data: {
                    product: { basePrice: 1000, quantity: 150, category: 'electronics' },
                    customer: { tier: 'gold', id: 'CUST-123' },
                    market: { demand: 'high', competitorPrice: 950 }
                }
            },
            context: { region: 'US-WEST' },
            rule: { name: 'dynamic-pricing' },
            timestamp: new Date('2024-12-15'),
            utils: { date: Date, math: Math, json: JSON, regex: RegExp, console: console }
        };

        try {
            const result = await this.codeService.executeCode(pricingRulesCode, pricingContext);
            if (result.success) {
                console.log('  ✅ Dynamic Pricing Result:');
                console.log(`     Original Price: $${result.result.originalPrice}`);
                console.log(`     Final Price: $${result.result.finalPrice}`);
                console.log(`     Total Adjustment: ${result.result.totalDiscount}%`);
                console.log('     Applied Rules:');
                result.result.adjustments.forEach((adj: string) => {
                    console.log(`       • ${adj}`);
                });
            }
        } catch (error) {
            console.log(`  ❌ Pricing rules failed: ${error}`);
        }
        console.log();
    }

    /**
     * Demo 3: Data Transformation
     */
    private async demo3_DataTransformation(): Promise<void> {
        console.log('🔄 Demo 3: Data Transformation');
        console.log('-------------------------------');

        // Transform API response to internal format
        const transformationCode = `
            const { apiResponse } = event.data;
            
            const transformed = apiResponse.customers.map(customer => {
                // Calculate customer metrics
                const totalSpent = customer.orders.reduce((sum, order) => sum + order.amount, 0);
                const avgOrderValue = totalSpent / customer.orders.length;
                const daysSinceLastOrder = customer.orders.length > 0 ? 
                    Math.floor((timestamp.getTime() - new Date(customer.orders[0].date).getTime()) / (1000 * 60 * 60 * 24)) : 999;
                
                // Determine customer segment
                let segment = 'NEW';
                if (totalSpent > 10000) segment = 'VIP';
                else if (totalSpent > 5000) segment = 'PREMIUM';
                else if (customer.orders.length > 5) segment = 'REGULAR';
                
                // Risk assessment
                const riskFactors = [];
                if (daysSinceLastOrder > 365) riskFactors.push('INACTIVE');
                if (avgOrderValue < 50) riskFactors.push('LOW_VALUE');
                if (customer.returns > customer.orders.length * 0.2) riskFactors.push('HIGH_RETURNS');
                
                return {
                    customerId: customer.id,
                    profile: {
                        name: \`\${customer.firstName} \${customer.lastName}\`,
                        email: customer.email.toLowerCase(),
                        phone: customer.phone,
                        joinDate: customer.createdAt
                    },
                    metrics: {
                        totalSpent: Math.round(totalSpent * 100) / 100,
                        orderCount: customer.orders.length,
                        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
                        daysSinceLastOrder,
                        returnRate: Math.round((customer.returns / customer.orders.length) * 100)
                    },
                    classification: {
                        segment,
                        riskLevel: riskFactors.length > 1 ? 'HIGH' : riskFactors.length === 1 ? 'MEDIUM' : 'LOW',
                        riskFactors
                    }
                };
            });
            
            return {
                customers: transformed,
                summary: {
                    total: transformed.length,
                    bySegment: transformed.reduce((acc, c) => {
                        acc[c.classification.segment] = (acc[c.classification.segment] || 0) + 1;
                        return acc;
                    }, {}),
                    highRisk: transformed.filter(c => c.classification.riskLevel === 'HIGH').length
                }
            };
        `;

        const transformContext = {
            event: {
                data: {
                    apiResponse: {
                        customers: [
                            {
                                id: 1,
                                firstName: 'John',
                                lastName: 'Doe',
                                email: 'JOHN@EXAMPLE.COM',
                                phone: '+1-555-0123',
                                createdAt: '2023-01-15',
                                orders: [
                                    { date: '2024-01-10', amount: 250 },
                                    { date: '2024-03-15', amount: 180 },
                                    { date: '2024-06-20', amount: 320 }
                                ],
                                returns: 1
                            },
                            {
                                id: 2,
                                firstName: 'Jane',
                                lastName: 'Smith',
                                email: 'jane@example.com',
                                phone: '+1-555-0456',
                                createdAt: '2022-08-10',
                                orders: [
                                    { date: '2024-09-01', amount: 1200 },
                                    { date: '2024-09-15', amount: 800 }
                                ],
                                returns: 0
                            }
                        ]
                    }
                }
            },
            context: { system: 'crm-import' },
            rule: { name: 'customer-transformation' },
            timestamp: new Date('2024-09-28'),
            utils: { date: Date, math: Math, json: JSON, regex: RegExp, console: console }
        };

        try {
            const result = await this.codeService.executeCode(transformationCode, transformContext);
            if (result.success) {
                console.log('  ✅ Data Transformation Result:');
                console.log(`     Customers Processed: ${result.result.summary.total}`);
                console.log('     Segment Distribution:');
                Object.entries(result.result.summary.bySegment).forEach(([segment, count]) => {
                    console.log(`       ${segment}: ${count}`);
                });
                console.log(`     High Risk Customers: ${result.result.summary.highRisk}`);
            }
        } catch (error) {
            console.log(`  ❌ Data transformation failed: ${error}`);
        }
        console.log();
    }

    /**
     * Demo 4: Risk Assessment
     */
    private async demo4_RiskAssessment(): Promise<void> {
        console.log('⚠️  Demo 4: Risk Assessment');
        console.log('----------------------------');

        const riskAssessmentCode = `
            const { loan, applicant, property } = event.data;
            let riskScore = 0;
            const riskFactors = [];
            
            // Credit score assessment (40% weight)
            if (applicant.creditScore < 600) {
                riskScore += 40;
                riskFactors.push('Poor credit score (<600)');
            } else if (applicant.creditScore < 700) {
                riskScore += 20;
                riskFactors.push('Fair credit score (600-699)');
            } else if (applicant.creditScore < 750) {
                riskScore += 10;
                riskFactors.push('Good credit score (700-749)');
            }
            
            // Debt-to-income ratio (25% weight)
            const dti = (applicant.monthlyDebt + loan.monthlyPayment) / applicant.monthlyIncome;
            if (dti > 0.43) {
                riskScore += 25;
                riskFactors.push(\`High DTI ratio (\${Math.round(dti * 100)}%)\`);
            } else if (dti > 0.36) {
                riskScore += 15;
                riskFactors.push(\`Elevated DTI ratio (\${Math.round(dti * 100)}%)\`);
            }
            
            // Loan-to-value ratio (20% weight)
            const ltv = loan.amount / property.appraisedValue;
            if (ltv > 0.95) {
                riskScore += 20;
                riskFactors.push(\`Very high LTV (\${Math.round(ltv * 100)}%)\`);
            } else if (ltv > 0.80) {
                riskScore += 10;
                riskFactors.push(\`High LTV (\${Math.round(ltv * 100)}%)\`);
            }
            
            // Employment stability (10% weight)
            if (applicant.employmentYears < 2) {
                riskScore += 10;
                riskFactors.push('Short employment history');
            }
            
            // Property location risk (5% weight)
            if (property.location.floodZone) {
                riskScore += 5;
                riskFactors.push('Property in flood zone');
            }
            
            // Determine risk level and decision
            let riskLevel = 'LOW';
            let decision = 'APPROVED';
            
            if (riskScore >= 70) {
                riskLevel = 'VERY_HIGH';
                decision = 'DECLINED';
            } else if (riskScore >= 50) {
                riskLevel = 'HIGH';
                decision = 'MANUAL_REVIEW';
            } else if (riskScore >= 30) {
                riskLevel = 'MEDIUM';
                decision = 'CONDITIONAL_APPROVAL';
            }
            
            return {
                riskScore,
                riskLevel,
                decision,
                riskFactors,
                metrics: {
                    dti: Math.round(dti * 100),
                    ltv: Math.round(ltv * 100),
                    creditScore: applicant.creditScore
                },
                recommendations: riskScore > 30 ? [
                    'Consider requiring additional documentation',
                    'Verify income sources thoroughly',
                    'Consider mortgage insurance if LTV > 80%'
                ] : []
            };
        `;

        const riskContext = {
            event: {
                data: {
                    loan: { amount: 350000, monthlyPayment: 1800, termYears: 30 },
                    applicant: {
                        creditScore: 720,
                        monthlyIncome: 6000,
                        monthlyDebt: 800,
                        employmentYears: 3.5
                    },
                    property: {
                        appraisedValue: 400000,
                        location: { floodZone: false, crimeRate: 'low' }
                    }
                }
            },
            context: { lender: 'BANK-001' },
            rule: { name: 'mortgage-risk-assessment' },
            timestamp: new Date(),
            utils: { date: Date, math: Math, json: JSON, regex: RegExp, console: console }
        };

        try {
            const result = await this.codeService.executeCode(riskAssessmentCode, riskContext);
            if (result.success) {
                console.log('  ✅ Risk Assessment Result:');
                console.log(`     Risk Score: ${result.result.riskScore}/100`);
                console.log(`     Risk Level: ${result.result.riskLevel}`);
                console.log(`     Decision: ${result.result.decision}`);
                console.log('     Key Metrics:');
                console.log(`       DTI Ratio: ${result.result.metrics.dti}%`);
                console.log(`       LTV Ratio: ${result.result.metrics.ltv}%`);
                console.log(`       Credit Score: ${result.result.metrics.creditScore}`);
                if (result.result.riskFactors.length > 0) {
                    console.log('     Risk Factors:');
                    result.result.riskFactors.forEach((factor: string) => {
                        console.log(`       • ${factor}`);
                    });
                }
            }
        } catch (error) {
            console.log(`  ❌ Risk assessment failed: ${error}`);
        }
        console.log();
    }

    /**
     * Demo 5: Report Generation
     */
    private async demo5_ReportGeneration(): Promise<void> {
        console.log('📊 Demo 5: Report Generation');
        console.log('-----------------------------');

        const reportCode = `
            const { salesData, period } = event.data;
            
            // Group sales by month
            const monthlyData = salesData.reduce((acc, sale) => {
                const month = new Date(sale.date).toISOString().slice(0, 7);
                if (!acc[month]) {
                    acc[month] = {
                        revenue: 0,
                        orders: 0,
                        customers: new Set(),
                        products: {}
                    };
                }
                
                acc[month].revenue += sale.amount;
                acc[month].orders += 1;
                acc[month].customers.add(sale.customerId);
                
                if (!acc[month].products[sale.productCategory]) {
                    acc[month].products[sale.productCategory] = { count: 0, revenue: 0 };
                }
                acc[month].products[sale.productCategory].count += 1;
                acc[month].products[sale.productCategory].revenue += sale.amount;
                
                return acc;
            }, {});
            
            // Calculate metrics
            const monthlyReport = Object.entries(monthlyData).map(([month, data]) => {
                const topCategory = Object.entries(data.products)
                    .sort(([,a], [,b]) => b.revenue - a.revenue)[0];
                
                return {
                    month,
                    revenue: Math.round(data.revenue * 100) / 100,
                    orders: data.orders,
                    uniqueCustomers: data.customers.size,
                    avgOrderValue: Math.round((data.revenue / data.orders) * 100) / 100,
                    topCategory: topCategory ? {
                        name: topCategory[0],
                        revenue: Math.round(topCategory[1].revenue * 100) / 100,
                        percentage: Math.round((topCategory[1].revenue / data.revenue) * 100)
                    } : null
                };
            }).sort((a, b) => a.month.localeCompare(b.month));
            
            // Calculate totals and trends
            const totalRevenue = monthlyReport.reduce((sum, m) => sum + m.revenue, 0);
            const totalOrders = monthlyReport.reduce((sum, m) => sum + m.orders, 0);
            const avgMonthlyRevenue = totalRevenue / monthlyReport.length;
            
            // Growth calculation (if more than one month)
            let growthRate = 0;
            if (monthlyReport.length > 1) {
                const firstMonth = monthlyReport[0].revenue;
                const lastMonth = monthlyReport[monthlyReport.length - 1].revenue;
                growthRate = Math.round(((lastMonth - firstMonth) / firstMonth) * 100);
            }
            
            return {
                summary: {
                    period: period,
                    totalRevenue: Math.round(totalRevenue * 100) / 100,
                    totalOrders,
                    avgMonthlyRevenue: Math.round(avgMonthlyRevenue * 100) / 100,
                    growthRate: \`\${growthRate}%\`
                },
                monthlyBreakdown: monthlyReport,
                insights: [
                    \`Best performing month: \${monthlyReport.sort((a, b) => b.revenue - a.revenue)[0].month}\`,
                    \`Average order value: $\${Math.round((totalRevenue / totalOrders) * 100) / 100}\`,
                    growthRate > 0 ? \`Positive growth trend: +\${growthRate}%\` : 
                    growthRate < 0 ? \`Declining trend: \${growthRate}%\` : 'Stable performance'
                ]
            };
        `;

        const reportContext = {
            event: {
                data: {
                    period: 'Q1 2024',
                    salesData: [
                        { date: '2024-01-15', amount: 1200, customerId: 'C001', productCategory: 'Electronics' },
                        { date: '2024-01-20', amount: 800, customerId: 'C002', productCategory: 'Clothing' },
                        { date: '2024-02-10', amount: 1500, customerId: 'C001', productCategory: 'Electronics' },
                        { date: '2024-02-25', amount: 600, customerId: 'C003', productCategory: 'Home' },
                        { date: '2024-03-05', amount: 2000, customerId: 'C004', productCategory: 'Electronics' },
                        { date: '2024-03-18', amount: 900, customerId: 'C002', productCategory: 'Clothing' }
                    ]
                }
            },
            context: { reportType: 'sales-summary' },
            rule: { name: 'quarterly-report' },
            timestamp: new Date(),
            utils: { date: Date, math: Math, json: JSON, regex: RegExp, console: console }
        };

        try {
            const result = await this.codeService.executeCode(reportCode, reportContext);
            if (result.success) {
                console.log('  ✅ Sales Report Generated:');
                console.log(`     Period: ${result.result.summary.period}`);
                console.log(`     Total Revenue: $${result.result.summary.totalRevenue.toLocaleString()}`);
                console.log(`     Total Orders: ${result.result.summary.totalOrders}`);
                console.log(`     Growth Rate: ${result.result.summary.growthRate}`);
                console.log('     Key Insights:');
                result.result.insights.forEach((insight: string) => {
                    console.log(`       • ${insight}`);
                });
            }
        } catch (error) {
            console.log(`  ❌ Report generation failed: ${error}`);
        }
        console.log();
    }

    /**
     * Demo 6: Validation Engine
     */
    private async demo6_ValidationEngine(): Promise<void> {
        console.log('✅ Demo 6: Validation Engine');
        console.log('-----------------------------');

        const validationCode = `
            const { formData } = event.data;
            const errors = [];
            const warnings = [];
            let score = 100;
            
            // Email validation
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!formData.email) {
                errors.push('Email is required');
                score -= 20;
            } else if (!emailRegex.test(formData.email)) {
                errors.push('Invalid email format');
                score -= 15;
            }
            
            // Phone validation
            const phoneRegex = /^\\+?[\\d\\s\\-\\(\\)]{10,}$/;
            if (!formData.phone) {
                warnings.push('Phone number is recommended');
                score -= 5;
            } else if (!phoneRegex.test(formData.phone)) {
                errors.push('Invalid phone format');
                score -= 10;
            }
            
            // Age validation
            if (!formData.age) {
                errors.push('Age is required');
                score -= 15;
            } else if (formData.age < 18) {
                errors.push('Must be 18 or older');
                score -= 25;
            } else if (formData.age > 120) {
                warnings.push('Age seems unusually high');
                score -= 5;
            }
            
            // Password strength
            if (!formData.password) {
                errors.push('Password is required');
                score -= 20;
            } else {
                let passwordScore = 0;
                if (formData.password.length >= 8) passwordScore += 25;
                if (/[A-Z]/.test(formData.password)) passwordScore += 25;
                if (/[a-z]/.test(formData.password)) passwordScore += 25;
                if (/\\d/.test(formData.password)) passwordScore += 25;
                if (/[^\\w\\s]/.test(formData.password)) passwordScore += 25;
                
                if (passwordScore < 75) {
                    warnings.push('Password could be stronger');
                    score -= (75 - passwordScore) / 5;
                }
            }
            
            // Address validation
            if (!formData.address || !formData.address.street || !formData.address.city) {
                warnings.push('Complete address is recommended');
                score -= 5;
            }
            
            const isValid = errors.length === 0;
            const qualityLevel = score >= 90 ? 'EXCELLENT' : 
                                score >= 75 ? 'GOOD' : 
                                score >= 60 ? 'FAIR' : 'POOR';
            
            return {
                isValid,
                score: Math.max(0, Math.round(score)),
                qualityLevel,
                errors,
                warnings,
                summary: {
                    totalIssues: errors.length + warnings.length,
                    criticalIssues: errors.length,
                    recommendations: [
                        ...errors.map(e => \`Fix: \${e}\`),
                        ...warnings.map(w => \`Consider: \${w}\`)
                    ]
                }
            };
        `;

        const validationContext = {
            event: {
                data: {
                    formData: {
                        email: 'john.doe@example.com',
                        phone: '+1-555-0123',
                        age: 28,
                        password: 'MySecure123!',
                        address: {
                            street: '123 Main St',
                            city: 'Anytown',
                            state: 'CA',
                            zip: '12345'
                        }
                    }
                }
            },
            context: { formType: 'user-registration' },
            rule: { name: 'form-validation' },
            timestamp: new Date(),
            utils: { date: Date, math: Math, json: JSON, regex: RegExp, console: console }
        };

        try {
            const result = await this.codeService.executeCode(validationCode, validationContext);
            if (result.success) {
                console.log('  ✅ Validation Result:');
                console.log(`     Valid: ${result.result.isValid}`);
                console.log(`     Quality Score: ${result.result.score}/100 (${result.result.qualityLevel})`);
                console.log(`     Issues Found: ${result.result.summary.totalIssues}`);
                if (result.result.errors.length > 0) {
                    console.log('     Errors:');
                    result.result.errors.forEach((error: string) => {
                        console.log(`       ❌ ${error}`);
                    });
                }
                if (result.result.warnings.length > 0) {
                    console.log('     Warnings:');
                    result.result.warnings.forEach((warning: string) => {
                        console.log(`       ⚠️  ${warning}`);
                    });
                }
            }
        } catch (error) {
            console.log(`  ❌ Validation failed: ${error}`);
        }
        console.log();
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    const demo = new AdvancedDynamicCodeDemo();
    demo.runDemo().catch(console.error);
}

export { AdvancedDynamicCodeDemo };