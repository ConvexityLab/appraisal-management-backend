/**
 * Comprehensive Integration Test
 * 
 * Tests the complete appraisal management workflow:
 * 1. Order Creation with Property Intelligence Pre-qualification
 * 2. Vendor Assignment and Tracking
 * 3. Appraisal Delivery and Document Management
 * 4. Comprehensive QC Validation using our Census intelligence
 * 5. Order Completion and Performance Tracking
 */

import { Logger } from '../utils/logger.js';
import { EnhancedOrderManagementService } from '../services/enhanced-order-management.service.js';
import { ComprehensiveQCValidationService } from '../services/comprehensive-qc-validation.service.js';
import { CensusIntelligenceService } from '../services/census-intelligence.service.js';
import { MultiProviderPropertyIntelligenceService } from '../services/multi-provider-intelligence.service.js';
import {
  OrderType,
  OrderPriority,
  OrderStatus,
  ClientInformation,
  PropertyDetails
} from '../types/order-management.js';
import {
  AppraisalData,
  PropertyType,
  ConfidenceLevel,
  MarketConditions,
  AdjustmentType
} from '../types/qc-validation.js';

export class ComprehensiveIntegrationTest {
  private logger: Logger;
  private orderService: EnhancedOrderManagementService;
  private qcService: ComprehensiveQCValidationService;
  private censusService: CensusIntelligenceService;
  private propertyService: MultiProviderPropertyIntelligenceService;

  constructor() {
    this.logger = new Logger();
    
    // Initialize services (in real implementation, these would be injected)
    this.orderService = new EnhancedOrderManagementService(null as any);
    this.qcService = new ComprehensiveQCValidationService();
    this.censusService = new CensusIntelligenceService();
    this.propertyService = new MultiProviderPropertyIntelligenceService();
  }

  /**
   * Execute comprehensive workflow integration test
   */
  async executeCompleteWorkflowTest(): Promise<{
    success: boolean;
    testResults: Array<{
      phase: string;
      success: boolean;
      duration: number;
      data?: any;
      error?: string;
    }>;
    summary: {
      totalDuration: number;
      passedPhases: number;
      failedPhases: number;
      finalOrderStatus: OrderStatus;
      qcScore?: number;
      propertyIntelligenceScore?: number;
    };
  }> {
    
    const testStartTime = Date.now();
    const testResults: Array<{
      phase: string;
      success: boolean;
      duration: number;
      data?: any;
      error?: string;
    }> = [];

    this.logger.info('Starting comprehensive integration test');

    // Phase 1: Order Creation with Property Intelligence
    const phase1Result = await this.testOrderCreationWithIntelligence();
    testResults.push(phase1Result);

    if (!phase1Result.success) {
      return this.buildTestSummary(testStartTime, testResults);
    }

    const order = phase1Result.data.order;
    const propertyIntelligence = phase1Result.data.propertyIntelligence;

    // Phase 2: Order Submission and Status Tracking
    const phase2Result = await this.testOrderSubmissionAndTracking(order.id);
    testResults.push(phase2Result);

    // Phase 3: Appraisal Delivery Simulation
    const phase3Result = await this.testAppraisalDelivery(order.id);
    testResults.push(phase3Result);

    if (!phase3Result.success) {
      return this.buildTestSummary(testStartTime, testResults);
    }

    const mockAppraisalData = phase3Result.data.appraisalData;

    // Phase 4: Comprehensive QC Validation
    const phase4Result = await this.testComprehensiveQCValidation(
      order.id,
      mockAppraisalData
    );
    testResults.push(phase4Result);

    // Phase 5: Dashboard and Reporting
    const phase5Result = await this.testDashboardAndReporting();
    testResults.push(phase5Result);

    // Phase 6: Service Health Checks
    const phase6Result = await this.testServiceHealthChecks();
    testResults.push(phase6Result);

    return this.buildTestSummary(testStartTime, testResults, {
      finalOrder: order,
      propertyIntelligence,
      qcReport: phase4Result.data?.qcReport
    });
  }

  // ===========================
  // PHASE 1: ORDER CREATION WITH INTELLIGENCE
  // ===========================

  private async testOrderCreationWithIntelligence(): Promise<any> {
    const phaseStartTime = Date.now();
    
    try {
      this.logger.info('Phase 1: Testing order creation with property intelligence');

      // Create comprehensive client and property data
      const clientInfo: ClientInformation = {
        clientId: 'client_test_001',
        clientName: 'First National Bank',
        contactPerson: 'Sarah Johnson',
        email: 'sarah.johnson@firstnational.com',
        phone: '555-0123',
        address: '100 Banking Plaza, Dallas, TX 75201',
        loanNumber: 'LN-2024-456789',
        borrowerName: 'Michael Smith',
        loanOfficer: 'Robert Davis',
        loanOfficerEmail: 'robert.davis@firstnational.com',
        loanOfficerPhone: '555-0124'
      };

      const propertyDetails: PropertyDetails = {
        address: '123 Elm Street',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        county: 'Travis',
        coordinates: {
          latitude: 30.2672,
          longitude: -97.7431
        },
        parcelNumber: 'AUS-12345-67890',
        propertyType: 'SINGLE_FAMILY',
        yearBuilt: 2015,
        squareFootage: 2200,
        lotSize: 0.25,
        bedrooms: 4,
        bathrooms: 3,
        stories: 2,
        hasBasement: false,
        hasGarage: true,
        accessConcerns: 'None reported',
        specialInstructions: 'Property has solar panels and energy-efficient features'
      };

      const orderData = {
        clientInformation: clientInfo,
        propertyDetails,
        orderType: OrderType.FULL_APPRAISAL,
        priority: OrderPriority.ROUTINE,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
        orderValue: 650,
        specialInstructions: 'Please note energy-efficient features in valuation',
        accessInstructions: 'Contact owner 24 hours in advance',
        contactInstructions: 'Owner prefers morning appointments'
      };

      // Create order with property intelligence
      const result = await this.orderService.createOrderWithIntelligence(
        orderData,
        'TEST_USER',
        true // Enable pre-qualification
      );

      if (!result.success) {
        throw new Error(result.error || 'Order creation failed');
      }

      this.logger.info('Order created successfully', {
        orderId: result.data?.id,
        orderNumber: result.data?.orderNumber,
        hasPropertyIntelligence: !!result.propertyIntelligence
      });

      return {
        phase: 'Order Creation with Intelligence',
        success: true,
        duration: Date.now() - phaseStartTime,
        data: {
          order: result.data,
          propertyIntelligence: result.propertyIntelligence
        }
      };

    } catch (error) {
      this.logger.error('Phase 1 failed', { error });
      return {
        phase: 'Order Creation with Intelligence',
        success: false,
        duration: Date.now() - phaseStartTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===========================
  // PHASE 2: ORDER SUBMISSION AND TRACKING
  // ===========================

  private async testOrderSubmissionAndTracking(orderId: string): Promise<any> {
    const phaseStartTime = Date.now();
    
    try {
      this.logger.info('Phase 2: Testing order submission and status tracking');

      // Get current order status
      const initialOrder = await this.orderService.getOrder(orderId, 'TEST_USER');
      if (!initialOrder.success) {
        throw new Error('Failed to retrieve order');
      }

      // Update order status to simulate workflow progression
      await this.orderService.updateOrderStatus(
        orderId,
        OrderStatus.SUBMITTED,
        'TEST_USER',
        'Order submitted by test system'
      );

      await this.delay(1000); // Simulate processing time

      await this.orderService.updateOrderStatus(
        orderId,
        OrderStatus.ASSIGNED,
        'SYSTEM',
        'Order assigned to test vendor'
      );

      await this.delay(1000);

      await this.orderService.updateOrderStatus(
        orderId,
        OrderStatus.IN_PROGRESS,
        'VENDOR_TEST',
        'Assignment accepted by vendor'
      );

      // Verify status progression
      const updatedOrder = await this.orderService.getOrder(orderId, 'TEST_USER');
      if (!updatedOrder.success || updatedOrder.data?.status !== OrderStatus.IN_PROGRESS) {
        throw new Error('Order status progression failed');
      }

      this.logger.info('Order status progression successful', {
        orderId,
        statusHistory: updatedOrder.data?.statusHistory.length
      });

      return {
        phase: 'Order Submission and Tracking',
        success: true,
        duration: Date.now() - phaseStartTime,
        data: {
          finalStatus: updatedOrder.data?.status,
          statusHistoryCount: updatedOrder.data?.statusHistory.length
        }
      };

    } catch (error) {
      this.logger.error('Phase 2 failed', { error, orderId });
      return {
        phase: 'Order Submission and Tracking',
        success: false,
        duration: Date.now() - phaseStartTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===========================
  // PHASE 3: APPRAISAL DELIVERY SIMULATION
  // ===========================

  private async testAppraisalDelivery(orderId: string): Promise<any> {
    const phaseStartTime = Date.now();
    
    try {
      this.logger.info('Phase 3: Testing appraisal delivery simulation');

      // Update to delivered status
      await this.orderService.updateOrderStatus(
        orderId,
        OrderStatus.DELIVERED,
        'VENDOR_TEST',
        'Appraisal completed and delivered'
      );

      // Create comprehensive mock appraisal data for QC testing
      const mockAppraisalData: AppraisalData = {
        id: `appraisal_${orderId}`,
        property: {
          address: '123 Elm Street, Austin, TX 78701',
          coordinates: { latitude: 30.2672, longitude: -97.7431 },
          propertyType: PropertyType.SINGLE_FAMILY,
          yearBuilt: 2015,
          squareFootage: 2200,
          bedrooms: 4,
          bathrooms: 3,
          description: 'Modern single-family home with energy-efficient features'
        },
        comparables: [
          {
            address: '125 Elm Street, Austin, TX 78701',
            coordinates: { latitude: 30.2675, longitude: -97.7428 },
            saleDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
            salePrice: 485000,
            squareFootage: 2150,
            distanceFromSubject: 0.1,
            adjustments: [],
            dataSource: 'MLS'
          },
          {
            address: '789 Oak Avenue, Austin, TX 78701',
            coordinates: { latitude: 30.2680, longitude: -97.7440 },
            saleDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
            salePrice: 510000,
            squareFootage: 2300,
            distanceFromSubject: 0.3,
            adjustments: [],
            dataSource: 'MLS'
          },
          {
            address: '456 Pine Street, Austin, TX 78701',
            coordinates: { latitude: 30.2665, longitude: -97.7435 },
            saleDate: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000), // 75 days ago
            salePrice: 475000,
            squareFootage: 2100,
            distanceFromSubject: 0.2,
            adjustments: [],
            dataSource: 'MLS'
          }
        ],
        valuation: {
          finalValue: 495000,
          valueRange: { low: 485000, high: 505000 },
          confidenceLevel: ConfidenceLevel.HIGH,
          marketConditions: MarketConditions.STABLE
        },
        marketAnalysis: {
          neighborhoodDescription: 'Established residential neighborhood near downtown Austin',
          pricePerSquareFoot: 225,
          daysOnMarket: 28,
          demographics: {
            medianIncome: 85000,
            populationDensity: 2500,
            householdSize: 2.3,
            ownershipRate: 72.5
          },
          economicFactors: {
            employmentRate: 96.2,
            majorIndustries: ['Technology', 'Education', 'Government'],
            economicStability: 'HIGH'
          }
        },
        adjustments: [
          {
            comparableId: 'comp_001',
            adjustmentType: AdjustmentType.SIZE,
            amount: 12500,
            description: 'Square footage adjustment',
            justification: 'Subject property has 50 sq ft more living space'
          }
        ]
      };

      this.logger.info('Mock appraisal data created', {
        orderId,
        finalValue: mockAppraisalData.valuation.finalValue,
        comparablesCount: mockAppraisalData.comparables.length
      });

      return {
        phase: 'Appraisal Delivery Simulation',
        success: true,
        duration: Date.now() - phaseStartTime,
        data: {
          appraisalData: mockAppraisalData,
          deliveryStatus: OrderStatus.DELIVERED
        }
      };

    } catch (error) {
      this.logger.error('Phase 3 failed', { error, orderId });
      return {
        phase: 'Appraisal Delivery Simulation',
        success: false,
        duration: Date.now() - phaseStartTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===========================
  // PHASE 4: COMPREHENSIVE QC VALIDATION
  // ===========================

  private async testComprehensiveQCValidation(
    orderId: string,
    appraisalData: AppraisalData
  ): Promise<any> {
    const phaseStartTime = Date.now();
    
    try {
      this.logger.info('Phase 4: Testing comprehensive QC validation');

      // Process the delivered order with QC validation
      const qcResult = await this.orderService.processDeliveredOrderWithQC(
        orderId,
        appraisalData,
        'QC_ANALYST',
        true // Enable auto-completion
      );

      if (!qcResult.success) {
        throw new Error(qcResult.error || 'QC validation failed');
      }

      const qcReport = qcResult.qcReport;
      if (!qcReport) {
        throw new Error('QC report not generated');
      }

      // Verify QC report completeness
      const hasMarketValidation = !!qcReport.validationResults.marketValidation;
      const hasComparableValidation = !!qcReport.validationResults.comparableValidation;
      const hasRiskAssessment = !!qcReport.validationResults.riskAssessment;

      if (!hasMarketValidation || !hasComparableValidation || !hasRiskAssessment) {
        throw new Error('Incomplete QC validation results');
      }

      this.logger.info('QC validation completed successfully', {
        orderId,
        qcScore: qcReport.overallQCScore,
        decision: qcReport.qcDecision,
        actionItemsCount: qcReport.actionItems.length,
        processingTime: qcReport.processingTime
      });

      return {
        phase: 'Comprehensive QC Validation',
        success: true,
        duration: Date.now() - phaseStartTime,
        data: {
          qcReport,
          qcScore: qcReport.overallQCScore,
          qcDecision: qcReport.qcDecision,
          actionItemsCount: qcReport.actionItems.length,
          marketValidationScore: qcReport.validationResults.marketValidation.validationScore,
          comparableValidationScore: qcReport.validationResults.comparableValidation.validationScore,
          riskScore: qcReport.validationResults.riskAssessment.overallRiskScore
        }
      };

    } catch (error) {
      this.logger.error('Phase 4 failed', { error, orderId });
      return {
        phase: 'Comprehensive QC Validation',
        success: false,
        duration: Date.now() - phaseStartTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===========================
  // PHASE 5: DASHBOARD AND REPORTING
  // ===========================

  private async testDashboardAndReporting(): Promise<any> {
    const phaseStartTime = Date.now();
    
    try {
      this.logger.info('Phase 5: Testing dashboard and reporting');

      // Test dashboard data generation
      const dashboardResult = await this.orderService.getOrderDashboard(
        {
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            end: new Date()
          }
        },
        'TEST_USER'
      );

      if (!dashboardResult.success || !dashboardResult.data) {
        throw new Error('Dashboard generation failed');
      }

      const dashboard = dashboardResult.data;

      // Verify dashboard completeness
      if (!dashboard.summary || !dashboard.qcMetrics || !dashboard.vendorPerformance) {
        throw new Error('Incomplete dashboard data');
      }

      this.logger.info('Dashboard generated successfully', {
        totalOrders: dashboard.summary.totalOrders,
        averageQCScore: dashboard.summary.averageQCScore,
        vendorCount: dashboard.vendorPerformance.length,
        recentActivityCount: dashboard.recentActivity.length
      });

      return {
        phase: 'Dashboard and Reporting',
        success: true,
        duration: Date.now() - phaseStartTime,
        data: {
          dashboard,
          metricsCount: Object.keys(dashboard.summary).length,
          vendorPerformanceRecords: dashboard.vendorPerformance.length
        }
      };

    } catch (error) {
      this.logger.error('Phase 5 failed', { error });
      return {
        phase: 'Dashboard and Reporting',
        success: false,
        duration: Date.now() - phaseStartTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===========================
  // PHASE 6: SERVICE HEALTH CHECKS
  // ===========================

  private async testServiceHealthChecks(): Promise<any> {
    const phaseStartTime = Date.now();
    
    try {
      this.logger.info('Phase 6: Testing service health checks');

      // Test all service health endpoints
      const [
        orderServiceHealth,
        qcServiceHealth,
        censusServiceHealth
      ] = await Promise.all([
        this.orderService.getHealthStatus(),
        this.qcService.getHealthStatus(),
        this.censusService.getHealthStatus()
      ]);

      const healthChecks = {
        orderService: orderServiceHealth.status,
        qcService: qcServiceHealth.status,
        censusService: censusServiceHealth.status
      };

      // Verify all services are operational
      const allHealthy = Object.values(healthChecks).every(status => status === 'operational');

      this.logger.info('Service health checks completed', {
        healthChecks,
        allHealthy
      });

      return {
        phase: 'Service Health Checks',
        success: allHealthy,
        duration: Date.now() - phaseStartTime,
        data: {
          healthChecks,
          servicesCount: Object.keys(healthChecks).length,
          operationalCount: Object.values(healthChecks).filter(s => s === 'operational').length
        }
      };

    } catch (error) {
      this.logger.error('Phase 6 failed', { error });
      return {
        phase: 'Service Health Checks',
        success: false,
        duration: Date.now() - phaseStartTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  private buildTestSummary(
    testStartTime: number,
    testResults: any[],
    additionalData?: any
  ): any {
    
    const totalDuration = Date.now() - testStartTime;
    const passedPhases = testResults.filter(r => r.success).length;
    const failedPhases = testResults.filter(r => !r.success).length;

    let finalOrderStatus = OrderStatus.DRAFT;
    let qcScore: number | undefined;
    let propertyIntelligenceScore: number | undefined;

    if (additionalData?.finalOrder) {
      finalOrderStatus = additionalData.finalOrder.status;
    }

    if (additionalData?.qcReport) {
      qcScore = additionalData.qcReport.overallQCScore;
    }

    if (additionalData?.propertyIntelligence) {
      propertyIntelligenceScore = additionalData.propertyIntelligence.demographicCompatibilityScore;
    }

    const summary = {
      totalDuration,
      passedPhases,
      failedPhases,
      finalOrderStatus,
      qcScore,
      propertyIntelligenceScore
    };

    this.logger.info('Integration test completed', {
      success: failedPhases === 0,
      summary,
      testResults: testResults.map(r => ({ phase: r.phase, success: r.success, duration: r.duration }))
    });

    return {
      success: failedPhases === 0,
      testResults,
      summary
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run quick integration test (simplified version)
   */
  async runQuickTest(): Promise<{ success: boolean; message: string; details: any }> {
    try {
      this.logger.info('Running quick integration test');

      // Test basic order creation
      const orderResult = await this.testOrderCreationWithIntelligence();
      if (!orderResult.success) {
        return {
          success: false,
          message: 'Quick test failed at order creation',
          details: orderResult
        };
      }

      // Test QC service health
      const qcHealth = await this.qcService.getHealthStatus();
      const censusHealth = await this.censusService.getHealthStatus();

      return {
        success: true,
        message: 'Quick integration test passed',
        details: {
          orderCreated: orderResult.success,
          qcServiceStatus: qcHealth.status,
          censusServiceStatus: censusHealth.status,
          availableCapabilities: qcHealth.capabilities || []
        }
      };

    } catch (error) {
      this.logger.error('Quick test failed', { error });
      return {
        success: false,
        message: 'Quick test encountered an error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}