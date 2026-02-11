/**
 * Service Health Check Runner
 * Run this to diagnose communication and AI service issues
 */

import { ServiceHealthCheckService } from './services/service-health-check.service.js';

async function main() {
  console.log('Starting Service Health Check...\n');
  
  const healthService = new ServiceHealthCheckService();
  const report = await healthService.performHealthCheck();
  
  healthService.printHealthReport(report);
  
  // Exit with error code if critical issues found
  if (report.overallStatus === 'critical') {
    console.error('⛔ CRITICAL ISSUES DETECTED - Service startup may fail');
    process.exit(1);
  } else if (report.overallStatus === 'degraded') {
    console.warn('⚠️  DEGRADED STATUS - Some features may not work');
    process.exit(0);
  } else {
    console.log('✅ ALL SERVICES HEALTHY');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Health check failed:', error);
  process.exit(1);
});
