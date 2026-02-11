/**
 * Application Insights Custom Metrics Service
 * Tracks business-specific metrics for monitoring and analytics
 */

import { TelemetryClient, Contracts } from 'applicationinsights';
import { Logger } from '../utils/logger.js';

export class AppInsightsMetricsService {
  private client: TelemetryClient | null = null;
  private logger: Logger;
  private enabled: boolean = false;

  constructor() {
    this.logger = new Logger();
    this.initializeClient();
  }

  private initializeClient(): void {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    
    if (!connectionString) {
      this.logger.warn('Application Insights connection string not configured. Metrics disabled.');
      return;
    }

    try {
      const appInsights = require('applicationinsights');
      appInsights.setup(connectionString)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true)
        .setUseDiskRetryCaching(true)
        .setSendLiveMetrics(true)
        .start();

      this.client = appInsights.defaultClient;
      this.enabled = true;
      this.logger.info('Application Insights initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Application Insights', { error });
    }
  }

  // ===========================
  // ORDER METRICS
  // ===========================

  trackOrderCreated(orderId: string, clientId: string, productType: string): void {
    this.trackEvent('OrderCreated', {
      orderId,
      clientId,
      productType
    });
    this.trackMetric('Orders.Created', 1);
  }

  trackOrderAssigned(orderId: string, appraiserId: string, assignmentTime: number): void {
    this.trackEvent('OrderAssigned', {
      orderId,
      appraiserId
    });
    this.trackMetric('Orders.AssignmentTime', assignmentTime);
  }

  trackOrderCompleted(orderId: string, turnaroundTime: number, productType: string): void {
    this.trackEvent('OrderCompleted', {
      orderId,
      productType
    });
    this.trackMetric('Orders.TurnaroundTime', turnaroundTime);
    this.trackMetric('Orders.Completed', 1);
  }

  trackOrderCancelled(orderId: string, reason: string): void {
    this.trackEvent('OrderCancelled', {
      orderId,
      reason
    });
    this.trackMetric('Orders.Cancelled', 1);
  }

  // ===========================
  // QC METRICS
  // ===========================

  trackQCReviewStarted(reviewId: string, orderId: string, reviewerId: string): void {
    this.trackEvent('QCReviewStarted', {
      reviewId,
      orderId,
      reviewerId
    });
    this.trackMetric('QC.ReviewsStarted', 1);
  }

  trackQCReviewCompleted(
    reviewId: string,
    result: 'pass' | 'fail',
    reviewTime: number,
    deficiencyCount: number
  ): void {
    this.trackEvent('QCReviewCompleted', {
      reviewId,
      result
    });
    this.trackMetric('QC.ReviewTime', reviewTime);
    this.trackMetric('QC.DeficiencyCount', deficiencyCount);
    this.trackMetric(`QC.Reviews.${result === 'pass' ? 'Passed' : 'Failed'}`, 1);
  }

  trackRevisionRequested(orderId: string, deficiencyCount: number): void {
    this.trackEvent('RevisionRequested', {
      orderId,
      deficiencyCount: deficiencyCount.toString()
    });
    this.trackMetric('QC.RevisionsRequested', 1);
  }

  // ===========================
  // AVM METRICS
  // ===========================

  trackAVMValuation(
    method: string,
    confidence: number,
    processingTime: number,
    success: boolean
  ): void {
    this.trackEvent('AVMValuation', {
      method,
      success: success.toString()
    });
    this.trackMetric('AVM.ProcessingTime', processingTime);
    this.trackMetric('AVM.Confidence', confidence);
    this.trackMetric(`AVM.${success ? 'Success' : 'Failure'}`, 1);
  }

  // ===========================
  // PROPERTY INTELLIGENCE METRICS
  // ===========================

  trackPropertyAnalysis(
    latitude: number,
    longitude: number,
    processingTime: number,
    placesFound: number
  ): void {
    this.trackEvent('PropertyAnalysis', {
      coordinates: `${latitude},${longitude}`,
      placesFound: placesFound.toString()
    });
    this.trackMetric('PropertyIntelligence.ProcessingTime', processingTime);
    this.trackMetric('PropertyIntelligence.PlacesFound', placesFound);
  }

  trackAPIProviderCall(
    provider: string,
    endpoint: string,
    responseTime: number,
    success: boolean
  ): void {
    this.trackDependency({
      target: provider,
      name: endpoint,
      duration: responseTime,
      resultCode: success ? 200 : 500,
      success
    });
  }

  // ===========================
  // SLA METRICS
  // ===========================

  trackSLAWarning(orderId: string, percentageUsed: number): void {
    this.trackEvent('SLAWarning', {
      orderId,
      percentageUsed: percentageUsed.toString()
    });
    this.trackMetric('SLA.Warnings', 1);
  }

  trackSLABreach(orderId: string, timeOverdue: number): void {
    this.trackEvent('SLABreach', {
      orderId,
      timeOverdue: timeOverdue.toString()
    });
    this.trackMetric('SLA.Breaches', 1);
    this.trackMetric('SLA.OvertimeMinutes', timeOverdue);
  }

  // ===========================
  // COST TRACKING
  // ===========================

  trackAPIcost(provider: string, cost: number, operation: string): void {
    this.trackEvent('APIcost', {
      provider,
      operation
    });
    this.trackMetric(`Cost.${provider}`, cost);
    this.trackMetric('Cost.Total', cost);
  }

  // ===========================
  // ERROR TRACKING
  // ===========================

  trackError(error: Error, context?: Record<string, string>): void {
    if (!this.enabled || !this.client) return;

    this.client.trackException({
      exception: error,
      properties: context
    });
  }

  // ===========================
  // CORE TRACKING METHODS
  // ===========================

  private trackEvent(name: string, properties?: Record<string, string>): void {
    if (!this.enabled || !this.client) return;

    this.client.trackEvent({
      name,
      properties
    });
  }

  private trackMetric(name: string, value: number): void {
    if (!this.enabled || !this.client) return;

    this.client.trackMetric({
      name,
      value
    });
  }

  private trackDependency(dependency: {
    target: string;
    name: string;
    duration: number;
    resultCode: number;
    success: boolean;
  }): void {
    if (!this.enabled || !this.client) return;

    this.client.trackDependency({
      target: dependency.target,
      name: dependency.name,
      data: dependency.name,
      duration: dependency.duration,
      resultCode: dependency.resultCode,
      success: dependency.success,
      dependencyTypeName: 'HTTP'
    });
  }

  flush(): void {
    if (!this.enabled || !this.client) return;
    this.client.flush();
  }
}

// Export singleton instance
export const appInsightsMetrics = new AppInsightsMetricsService();
