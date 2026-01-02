/**
 * Nightly Batch Job: Calculate Vendor Performance Metrics
 * 
 * Scheduled job that recalculates performance metrics for all vendors
 * Run daily at 2:00 AM via Azure Functions timer trigger or cron
 * 
 * Schedule: 0 2 * * * (daily at 2 AM)
 * Duration: ~5-10 minutes for 1000 vendors
 * 
 * Deployment options:
 * 1. Azure Functions Timer Trigger (recommended for production)
 * 2. Azure Logic Apps with HTTP call
 * 3. K8s CronJob
 * 4. GitHub Actions scheduled workflow
 */

import { VendorPerformanceCalculatorService } from '../services/vendor-performance-calculator.service';
import { CosmosDbService } from '../services/cosmos-db.service';
import { Logger } from '../utils/logger';

const logger = new Logger();

interface BatchJobResult {
  jobId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalVendors: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ vendorId: string; error: string }>;
  tenantResults: Array<{
    tenantId: string;
    vendorCount: number;
    successCount: number;
    failureCount: number;
  }>;
}

interface JobConfiguration {
  batchSize: number;
  parallelism: number;
  timeoutMs: number;
  retryAttempts: number;
  tenantIds?: string[]; // If specified, only process these tenants
}

const DEFAULT_CONFIG: JobConfiguration = {
  batchSize: 50, // Process 50 vendors at a time
  parallelism: 5, // 5 concurrent calculations
  timeoutMs: 300000, // 5 minute timeout per vendor
  retryAttempts: 3
};

export class VendorMetricsBatchJob {
  private performanceService: VendorPerformanceCalculatorService;
  private dbService: CosmosDbService;
  private logger: Logger;

  constructor() {
    this.performanceService = new VendorPerformanceCalculatorService();
    this.dbService = new CosmosDbService();
    this.logger = new Logger();
  }

  /**
   * Main job execution entry point
   */
  async execute(config: Partial<JobConfiguration> = {}): Promise<BatchJobResult> {
    const jobConfig = { ...DEFAULT_CONFIG, ...config };
    const jobId = `vendor-metrics-${Date.now()}`;
    const startTime = new Date();

    this.logger.info('🚀 Starting vendor metrics batch job', { jobId, config: jobConfig });

    try {
      // Get all tenants to process
      const tenantIds = jobConfig.tenantIds || await this.getAllTenantIds();
      this.logger.info(`Processing ${tenantIds.length} tenants`);

      const tenantResults: BatchJobResult['tenantResults'] = [];
      let totalVendors = 0;
      let successCount = 0;
      let failureCount = 0;
      const errors: Array<{ vendorId: string; error: string }> = [];

      // Process each tenant
      for (const tenantId of tenantIds) {
        try {
          this.logger.info(`Processing tenant: ${tenantId}`);
          
          const result = await this.performanceService.batchCalculateAllVendorMetrics(
            tenantId
          );

          // Get vendor count for this tenant
          const vendorCountQuery = `SELECT VALUE COUNT(1) FROM c WHERE c.tenantId = '${tenantId}'`;
          const countResult = await this.dbService.queryItems('vendors', vendorCountQuery) as any;
          const vendorCount = countResult.resources?.[0] || 0;

          tenantResults.push({
            tenantId,
            vendorCount,
            successCount: vendorCount,
            failureCount: 0
          });

          totalVendors += vendorCount;
          successCount += vendorCount;

          this.logger.info(`✅ Tenant ${tenantId} complete: ${vendorCount} vendors`);

        } catch (tenantError: any) {
          this.logger.error(`❌ Failed to process tenant ${tenantId}:`, tenantError);
          tenantResults.push({
            tenantId,
            vendorCount: 0,
            successCount: 0,
            failureCount: 1
          });
          failureCount++;
          errors.push({ 
            vendorId: `tenant-${tenantId}`, 
            error: tenantError.message 
          });
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const result: BatchJobResult = {
        jobId,
        startTime,
        endTime,
        duration,
        totalVendors,
        successCount,
        failureCount,
        errors,
        tenantResults
      };

      // Save job result to database for monitoring
      await this.saveJobResult(result);

      // Log summary
      this.logger.info('');
      this.logger.info('✨ Batch job completed!');
      this.logger.info(`  Job ID: ${jobId}`);
      this.logger.info(`  Duration: ${(duration / 1000).toFixed(2)} seconds`);
      this.logger.info(`  Total vendors: ${totalVendors}`);
      this.logger.info(`  Success: ${successCount}`);
      this.logger.info(`  Failures: ${failureCount}`);
      this.logger.info(`  Success rate: ${((successCount / totalVendors) * 100).toFixed(2)}%`);
      
      if (errors.length > 0) {
        this.logger.warn(`  ⚠️ ${errors.length} errors occurred (see job-results container for details)`);
      }

      // Alert if failure rate is high
      if (failureCount / totalVendors > 0.1) {
        this.logger.error(`🚨 HIGH FAILURE RATE DETECTED: ${failureCount}/${totalVendors} vendors failed`);
        await this.sendFailureAlert(result);
      }

      return result;

    } catch (error: any) {
      this.logger.error('❌ Batch job failed:', error);
      
      const endTime = new Date();
      const failedResult: BatchJobResult = {
        jobId,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        totalVendors: 0,
        successCount: 0,
        failureCount: 1,
        errors: [{ vendorId: 'job-level', error: error.message }],
        tenantResults: []
      };

      await this.saveJobResult(failedResult);
      throw error;
    }
  }

  /**
   * Get all tenant IDs from the database
   */
  private async getAllTenantIds(): Promise<string[]> {
    try {
      // Query distinct tenant IDs from vendors container
      const query = 'SELECT DISTINCT c.tenantId FROM c WHERE c.entityType = "vendor"';
      const result = await this.dbService.queryItems('vendors', query) as any;
      const resources = result.resources || [];
      
      return resources.map((r: any) => r.tenantId);
    } catch (error: any) {
      this.logger.error('Failed to get tenant IDs:', error);
      // Fallback to default tenant if query fails
      return [process.env.DEFAULT_TENANT_ID || 'default-tenant'];
    }
  }

  /**
   * Save job result to database for monitoring and auditing
   */
  private async saveJobResult(result: BatchJobResult): Promise<void> {
    try {
      const jobRecord = {
        id: result.jobId,
        entityType: 'batch-job-result',
        jobType: 'vendor-metrics-calculation',
        ...result,
        createdAt: new Date().toISOString()
      };

      await this.dbService.createItem('job-results', jobRecord);
      this.logger.info(`Job result saved: ${result.jobId}`);
    } catch (error: any) {
      this.logger.error('Failed to save job result:', error);
      // Non-fatal error - don't throw
    }
  }

  /**
   * Send alert for high failure rates
   */
  private async sendFailureAlert(result: BatchJobResult): Promise<void> {
    // TODO: Implement alerting (email, Slack, PagerDuty, etc.)
    this.logger.error('ALERT: High failure rate in vendor metrics batch job', {
      jobId: result.jobId,
      failureRate: (result.failureCount / result.totalVendors) * 100,
      failures: result.failureCount,
      total: result.totalVendors
    });

    // Example: Send to Azure Application Insights
    // Example: Post to Slack webhook
    // Example: Send email via SendGrid
  }

  /**
   * Cleanup old job results (run weekly)
   */
  async cleanupOldResults(daysToKeep = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const query = `
        SELECT c.id FROM c 
        WHERE c.entityType = 'batch-job-result' 
        AND c.jobType = 'vendor-metrics-calculation'
        AND c.startTime < '${cutoffDate.toISOString()}'
      `;

      const result = await this.dbService.queryItems('job-results', query) as any;
      const resources = result.resources || [];
      
      this.logger.info(`Cleaning up ${resources.length} old job results`);

      for (const item of resources) {
        await this.dbService.deleteItem('job-results', item.id, item.id);
      }

      this.logger.info(`✅ Cleanup complete: removed ${resources.length} old results`);
    } catch (error: any) {
      this.logger.error('Failed to cleanup old results:', error);
    }
  }
}

/**
 * CLI execution handler
 */
async function main() {
  const job = new VendorMetricsBatchJob();
  
  try {
    const result = await job.execute();
    
    if (result.failureCount > 0) {
      process.exit(1); // Exit with error code if any failures
    }
    
    process.exit(0);
  } catch (error: any) {
    logger.error('Batch job execution failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
