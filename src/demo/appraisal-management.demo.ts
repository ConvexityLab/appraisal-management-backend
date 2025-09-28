/**
 * Appraisal Management System Demo
 * 
 * Demonstrates the complete workflow from order creation to QC validation
 * Showcases our Census intelligence and property intelligence capabilities
 */

import { Logger } from '../utils/logger';
import { ComprehensiveIntegrationTest } from '../tests/comprehensive-integration.test';

export class AppraisalManagementDemo {
  private logger: Logger;
  private integrationTest: ComprehensiveIntegrationTest;

  constructor() {
    this.logger = new Logger();
    this.integrationTest = new ComprehensiveIntegrationTest();
  }

  /**
   * Run the complete demo showcasing all capabilities
   */
  async runCompleteDemo(): Promise<void> {
    try {
      console.log('\n🏠 APPRAISAL MANAGEMENT SYSTEM DEMO');
      console.log('=====================================\n');

      console.log('🚀 Starting comprehensive workflow demonstration...\n');

      // Execute the complete integration test which demonstrates all features
      const testResult = await this.integrationTest.executeCompleteWorkflowTest();

      // Display results
      this.displayTestResults(testResult);

      if (testResult.success) {
        console.log('\n✅ DEMO COMPLETED SUCCESSFULLY!');
        console.log('\nOur Appraisal Management System provides:');
        console.log('• Complete order lifecycle management');
        console.log('• U.S. Census Bureau intelligence integration');
        console.log('• Multi-provider property intelligence');
        console.log('• Comprehensive QC validation with fraud detection');
        console.log('• Automated workflow processing');
        console.log('• Real-time performance monitoring');
        console.log('• Advanced dashboard and reporting capabilities');
      } else {
        console.log('\n❌ Demo encountered issues - see details above');
      }

    } catch (error) {
      console.error('\n💥 Demo failed with error:', error);
    }
  }

  /**
   * Run a quick demo for fast validation
   */
  async runQuickDemo(): Promise<void> {
    try {
      console.log('\n🏠 QUICK APPRAISAL MANAGEMENT DEMO');
      console.log('===================================\n');

      const quickResult = await this.integrationTest.runQuickTest();

      if (quickResult.success) {
        console.log('✅ Quick demo passed!');
        console.log('\nSystem Status:');
        console.log(`• Order Creation: ${quickResult.details.orderCreated ? '✅' : '❌'}`);
        console.log(`• QC Service: ${quickResult.details.qcServiceStatus}`);
        console.log(`• Census Service: ${quickResult.details.censusServiceStatus}`);
        console.log('\nCapabilities:', quickResult.details.availableCapabilities.slice(0, 5).join(', '));
      } else {
        console.log('❌ Quick demo failed:', quickResult.message);
        console.log('Details:', JSON.stringify(quickResult.details, null, 2));
      }

    } catch (error) {
      console.error('\n💥 Quick demo failed:', error);
    }
  }

  /**
   * Display comprehensive test results
   */
  private displayTestResults(result: any): void {
    console.log('WORKFLOW TEST RESULTS');
    console.log('=====================\n');

    // Phase Results
    result.testResults.forEach((phase: any, index: number) => {
      const icon = phase.success ? '✅' : '❌';
      const duration = `(${phase.duration}ms)`;
      console.log(`${index + 1}. ${icon} ${phase.phase} ${duration}`);
      
      if (!phase.success && phase.error) {
        console.log(`   Error: ${phase.error}`);
      }
      
      if (phase.success && phase.data) {
        this.displayPhaseData(phase.phase, phase.data);
      }
    });

    // Summary
    console.log('\nTEST SUMMARY');
    console.log('============');
    console.log(`Total Duration: ${result.summary.totalDuration}ms`);
    console.log(`Passed Phases: ${result.summary.passedPhases}/${result.testResults.length}`);
    console.log(`Failed Phases: ${result.summary.failedPhases}/${result.testResults.length}`);
    
    if (result.summary.qcScore) {
      console.log(`QC Score: ${result.summary.qcScore}/100`);
    }
    
    if (result.summary.propertyIntelligenceScore) {
      console.log(`Property Intelligence Score: ${result.summary.propertyIntelligenceScore}/100`);
    }
    
    console.log(`Final Order Status: ${result.summary.finalOrderStatus}`);
  }

  /**
   * Display phase-specific data
   */
  private displayPhaseData(phaseName: string, data: any): void {
    switch (phaseName) {
      case 'Order Creation with Intelligence':
        if (data.order) {
          console.log(`   Order: ${data.order.orderNumber} (${data.order.orderType})`);
        }
        if (data.propertyIntelligence) {
          console.log(`   Property Score: ${data.propertyIntelligence.demographicCompatibilityScore}/100`);
        }
        break;

      case 'Order Submission and Tracking':
        console.log(`   Final Status: ${data.finalStatus}`);
        console.log(`   Status Changes: ${data.statusHistoryCount}`);
        break;

      case 'Comprehensive QC Validation':
        console.log(`   QC Score: ${data.qcScore}/100`);
        console.log(`   Decision: ${data.qcDecision}`);
        console.log(`   Action Items: ${data.actionItemsCount}`);
        console.log(`   Market Validation: ${data.marketValidationScore}/100`);
        console.log(`   Comparable Validation: ${data.comparableValidationScore}/100`);
        console.log(`   Risk Score: ${data.riskScore}/100`);
        break;

      case 'Dashboard and Reporting':
        if (data.dashboard) {
          console.log(`   Total Orders: ${data.dashboard.summary.totalOrders}`);
          console.log(`   Average QC Score: ${data.dashboard.summary.averageQCScore}`);
          console.log(`   On-Time Rate: ${data.dashboard.summary.onTimeDeliveryRate}%`);
        }
        break;

      case 'Service Health Checks':
        if (data.healthChecks) {
          const services = Object.entries(data.healthChecks)
            .map(([service, status]) => `${service}: ${status}`)
            .join(', ');
          console.log(`   Services: ${services}`);
        }
        break;
    }
  }

  /**
   * Display system capabilities
   */
  displaySystemCapabilities(): void {
    console.log('\n🎯 SYSTEM CAPABILITIES');
    console.log('======================\n');

    console.log('📊 CENSUS INTELLIGENCE:');
    console.log('• Official U.S. Census Bureau demographic data');
    console.log('• Income and economic validation');
    console.log('• Market compatibility scoring');
    console.log('• Neighborhood demographic analysis');

    console.log('\n🏠 PROPERTY INTELLIGENCE:');
    console.log('• Multi-provider geographic data (Google, Azure, OSM)');
    console.log('• Property feature extraction and analysis');
    console.log('• Creative property feature identification');
    console.log('• Market context and comparable analysis');

    console.log('\n🔍 QC VALIDATION:');
    console.log('• Comprehensive appraisal quality control');
    console.log('• Market validation using Census data');
    console.log('• Comparable property analysis');
    console.log('• Risk assessment and fraud detection');
    console.log('• Automated scoring and decision making');

    console.log('\n📋 ORDER MANAGEMENT:');
    console.log('• Complete order lifecycle management');
    console.log('• Vendor assignment and tracking');
    console.log('• Document management and workflow');
    console.log('• Status tracking and notifications');
    console.log('• Performance monitoring and reporting');

    console.log('\n📈 ANALYTICS & REPORTING:');
    console.log('• Real-time dashboard and metrics');
    console.log('• Vendor performance tracking');
    console.log('• QC trend analysis');
    console.log('• Market intelligence reporting');
  }
}

// Demo execution when run directly
if (require.main === module) {
  const demo = new AppraisalManagementDemo();
  
  // Get command line argument
  const args = process.argv.slice(2);
  const isQuickDemo = args.includes('--quick') || args.includes('-q');
  
  if (isQuickDemo) {
    console.log('Running quick demo...');
    demo.runQuickDemo();
  } else {
    // Show capabilities first
    demo.displaySystemCapabilities();
    
    // Ask user which demo to run
    console.log('\n🎮 DEMO OPTIONS:');
    console.log('Run with --quick for fast validation');
    console.log('Run without arguments for complete demo\n');
    
    // Run complete demo
    demo.runCompleteDemo();
  }
}