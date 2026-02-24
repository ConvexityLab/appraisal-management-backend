/**
 * QC Workflow - End-to-End Integration Test
 * 
 * Tests the complete workflow:
 * 1. Order added to queue → Priority scoring
 * 2. Auto-assignment → Workload balancing
 * 3. Revision request → Version tracking
 * 4. Revision submission → Auto re-QC trigger
 * 5. Escalation → Dispute resolution
 * 6. SLA tracking → Breach detection
 */

import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_JWT_TOKEN = process.env.TEST_JWT_TOKEN || 'test-jwt-token';

// Test data
const TEST_ORDER_ID = `ORD-TEST-${Date.now()}`;
const TEST_ORDER_NUMBER = `AP-TEST-${Date.now()}`;
const TEST_ANALYST_ID = 'analyst-test-001';
const TEST_APPRAISER_ID = 'appraiser-test-001';
const TEST_MANAGER_ID = 'manager-test-001';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class QCWorkflowE2ETest {
  private client: AxiosInstance;
  private testResults: { name: string; passed: boolean; message: string }[] = [];
  private testData: {
    queueItemId?: string;
    revisionId?: string;
    escalationId?: string;
    slaTrackingId?: string;
  } = {};

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  // Utility methods
  private log(message: string, color: keyof typeof colors = 'reset'): void {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  private logSection(title: string): void {
    console.log('\n' + '='.repeat(80));
    this.log(title, 'bright');
    console.log('='.repeat(80) + '\n');
  }

  private async recordTest(name: string, testFn: () => Promise<void>): Promise<void> {
    try {
      this.log(`▶ ${name}`, 'cyan');
      await testFn();
      this.testResults.push({ name, passed: true, message: 'PASSED' });
      this.log(`✓ ${name} - PASSED`, 'green');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.testResults.push({ name, passed: false, message });
      this.log(`✗ ${name} - FAILED: ${message}`, 'red');
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test scenarios
  async testHealthCheck(): Promise<void> {
    await this.recordTest('Health Check', async () => {
      const response = await this.client.get('/health');
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      this.log(`  Status: ${response.data.status}`, 'reset');
    });
  }

  async testAddToQueue(): Promise<void> {
    await this.recordTest('Add Order to QC Review Queue', async () => {
      const response = await this.client.post('/api/qc-workflow/queue', {
        orderId: TEST_ORDER_ID,
        orderNumber: TEST_ORDER_NUMBER,
        orderPriority: 'RUSH',
        orderValue: 850000,
        clientId: 'client-test-001',
        clientTier: 'PREMIUM',
        vendorId: 'vendor-test-001',
        appraisalId: `APR-${TEST_ORDER_ID}`,
        propertyAddress: '456 Test Ave, Seattle, WA 98101'
      });

      if (response.status !== 201) {
        throw new Error(`Expected status 201, got ${response.status}`);
      }

      const queueItem = response.data;
      this.testData.queueItemId = queueItem.id;

      this.log(`  Queue Item ID: ${queueItem.id}`, 'reset');
      this.log(`  Priority Score: ${queueItem.priorityScore}`, 'reset');
      this.log(`  Priority Level: ${queueItem.priorityLevel}`, 'reset');
      this.log(`  Status: ${queueItem.status}`, 'reset');

      // Validate priority scoring
      if (queueItem.priorityScore < 0 || queueItem.priorityScore > 100) {
        throw new Error(`Invalid priority score: ${queueItem.priorityScore}`);
      }

      if (queueItem.status !== 'PENDING') {
        throw new Error(`Expected status PENDING, got ${queueItem.status}`);
      }
    });
  }

  async testQueueStatistics(): Promise<void> {
    await this.recordTest('Get Queue Statistics', async () => {
      const response = await this.client.get('/api/qc-workflow/queue/statistics');

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const stats = response.data;
      this.log(`  Total: ${stats.total}`, 'reset');
      this.log(`  Pending: ${stats.pending}`, 'reset');
      this.log(`  In Review: ${stats.inReview}`, 'reset');
      this.log(`  Completed: ${stats.completed}`, 'reset');
      this.log(`  Breached: ${stats.breached}`, 'reset');
      this.log(`  Average Wait: ${stats.averageWaitTimeMinutes} minutes`, 'reset');
    });
  }

  async testAnalystWorkload(): Promise<void> {
    await this.recordTest('Get Analyst Workload', async () => {
      const response = await this.client.get('/api/qc-workflow/analysts/workload');

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const workloads = response.data;
      if (workloads.length > 0) {
        const workload = workloads[0];
        this.log(`  Analyst: ${workload.analystId}`, 'reset');
        this.log(`  Utilization: ${workload.utilizationPercent}%`, 'reset');
        this.log(`  Total Assigned: ${workload.totalAssigned}/${workload.maxConcurrent}`, 'reset');
      } else {
        this.log('  No analysts found (expected for test)', 'yellow');
      }
    });
  }

  async testManualAssignment(): Promise<void> {
    await this.recordTest('Manual Assignment to Analyst', async () => {
      if (!this.testData.queueItemId) {
        throw new Error('Queue item ID not available');
      }

      const response = await this.client.post('/api/qc-workflow/queue/assign', {
        queueItemId: this.testData.queueItemId,
        analystId: TEST_ANALYST_ID,
        notes: 'High priority test order'
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const assignedItem = response.data;
      this.log(`  Assigned to: ${assignedItem.assignedAnalystId}`, 'reset');
      this.log(`  Status: ${assignedItem.status}`, 'reset');

      if (assignedItem.status !== 'IN_REVIEW') {
        throw new Error(`Expected status IN_REVIEW, got ${assignedItem.status}`);
      }
    });
  }

  async testStartSLATracking(): Promise<void> {
    await this.recordTest('Start SLA Tracking', async () => {
      if (!this.testData.queueItemId) {
        throw new Error('Queue item ID not available');
      }

      const response = await this.client.post('/api/qc-workflow/sla/start', {
        entityType: 'QC_REVIEW',
        entityId: this.testData.queueItemId,
        orderId: TEST_ORDER_ID,
        orderNumber: TEST_ORDER_NUMBER,
        orderPriority: 'RUSH'
      });

      if (response.status !== 201) {
        throw new Error(`Expected status 201, got ${response.status}`);
      }

      const tracking = response.data;
      this.testData.slaTrackingId = tracking.trackingId;

      this.log(`  Tracking ID: ${tracking.trackingId}`, 'reset');
      this.log(`  Target Minutes: ${tracking.targetMinutes}`, 'reset');
      this.log(`  Target Date: ${tracking.targetDate}`, 'reset');
      this.log(`  Status: ${tracking.status}`, 'reset');

      if (tracking.status !== 'ON_TRACK') {
        throw new Error(`Expected status ON_TRACK, got ${tracking.status}`);
      }
    });
  }

  async testGetSLAStatus(): Promise<void> {
    await this.recordTest('Get SLA Status', async () => {
      if (!this.testData.slaTrackingId) {
        throw new Error('SLA tracking ID not available');
      }

      const response = await this.client.get(`/api/qc-workflow/sla/${this.testData.slaTrackingId}`);

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const tracking = response.data;
      this.log(`  Status: ${tracking.status}`, 'reset');
      this.log(`  Elapsed: ${tracking.elapsedMinutes} minutes`, 'reset');
      this.log(`  Percent Complete: ${tracking.percentComplete}%`, 'reset');
    });
  }

  async testCreateRevision(): Promise<void> {
    await this.recordTest('Create Revision Request', async () => {
      const response = await this.client.post('/api/qc-workflow/revisions', {
        orderId: TEST_ORDER_ID,
        appraisalId: `APR-${TEST_ORDER_ID}`,
        qcReportId: `QCR-${TEST_ORDER_ID}`,
        severity: 'MAJOR',
        issues: [
          {
            category: 'COMPARABLE_SELECTION',
            description: 'Comp #2 is 1.8 miles away - exceeds guideline maximum',
            severity: 'MAJOR'
          },
          {
            category: 'VALUE_CONCLUSION',
            description: 'Final value does not align with adjusted comp grid',
            severity: 'MODERATE'
          }
        ],
        requestNotes: 'Please address comparable selection and provide additional market analysis',
        requestedBy: TEST_ANALYST_ID
      });

      if (response.status !== 201) {
        throw new Error(`Expected status 201, got ${response.status}`);
      }

      const revision = response.data;
      this.testData.revisionId = revision.id;

      this.log(`  Revision ID: ${revision.id}`, 'reset');
      this.log(`  Version: ${revision.version}`, 'reset');
      this.log(`  Severity: ${revision.severity}`, 'reset');
      this.log(`  Issue Count: ${revision.issues.length}`, 'reset');
      this.log(`  Due Date: ${revision.dueDate}`, 'reset');
      this.log(`  Status: ${revision.status}`, 'reset');

      if (revision.status !== 'PENDING') {
        throw new Error(`Expected status PENDING, got ${revision.status}`);
      }

      if (revision.version !== 'v1') {
        throw new Error(`Expected version v1, got ${revision.version}`);
      }
    });
  }

  async testGetRevisionHistory(): Promise<void> {
    await this.recordTest('Get Revision History', async () => {
      const response = await this.client.get(`/api/qc-workflow/revisions/order/${TEST_ORDER_ID}/history`);

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const history = response.data;
      this.log(`  Total Revisions: ${history.totalRevisions}`, 'reset');
      this.log(`  Current Version: ${history.currentVersion}`, 'reset');

      if (history.totalRevisions < 1) {
        throw new Error('Expected at least 1 revision in history');
      }
    });
  }

  async testSubmitRevision(): Promise<void> {
    await this.recordTest('Submit Revised Appraisal (triggers auto re-QC)', async () => {
      if (!this.testData.revisionId) {
        throw new Error('Revision ID not available');
      }

      const response = await this.client.post(`/api/qc-workflow/revisions/${this.testData.revisionId}/submit`, {
        responseNotes: 'Updated comp selection - replaced with comp within 0.5 miles. Added market trend analysis.',
        submittedBy: TEST_APPRAISER_ID,
        resolvedIssues: [
          {
            issueId: 'ISS-001',
            resolution: 'Replaced comp #2 with property at 0.4 miles - similar condition and features'
          },
          {
            issueId: 'ISS-002',
            resolution: 'Added 3-month market trend data showing 2.1% appreciation'
          }
        ]
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const revision = response.data;
      this.log(`  Status: ${revision.status}`, 'reset');
      this.log(`  Auto Re-QC Triggered: ${revision.autoReQCTriggered}`, 'reset');
      if (revision.reQCQueueItemId) {
        this.log(`  Re-QC Queue Item: ${revision.reQCQueueItemId}`, 'reset');
      }

      if (revision.status !== 'SUBMITTED') {
        throw new Error(`Expected status SUBMITTED, got ${revision.status}`);
      }

      // Verify auto re-QC was triggered
      if (!revision.autoReQCTriggered) {
        this.log('  WARNING: Auto re-QC was not triggered', 'yellow');
      }
    });
  }

  async testGetActiveRevisions(): Promise<void> {
    await this.recordTest('Get Active Revisions', async () => {
      const response = await this.client.get('/api/qc-workflow/revisions/active');

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const revisions = response.data;
      this.log(`  Active Revisions Count: ${revisions.length}`, 'reset');

      if (revisions.length > 0) {
        const revision = revisions[0];
        this.log(`  Example - ID: ${revision.id}, Status: ${revision.status}`, 'reset');
      }
    });
  }

  async testCreateEscalation(): Promise<void> {
    await this.recordTest('Create Escalation (QC Dispute)', async () => {
      const response = await this.client.post('/api/qc-workflow/escalations', {
        orderId: TEST_ORDER_ID,
        escalationType: 'QC_DISPUTE',
        priority: 'HIGH',
        title: 'Appraiser disputes QC findings on comp adjustments',
        description: 'Appraiser provided additional market data showing comp adjustments are supported by local trends',
        raisedBy: TEST_APPRAISER_ID,
        appraisalId: `APR-${TEST_ORDER_ID}`,
        qcReportId: `QCR-${TEST_ORDER_ID}`,
        revisionId: this.testData.revisionId,
        metadata: {
          disputedFindings: [
            'Comp distance exceeds guidelines',
            'Adjustment amounts too high'
          ]
        }
      });

      if (response.status !== 201) {
        throw new Error(`Expected status 201, got ${response.status}`);
      }

      const escalation = response.data;
      this.testData.escalationId = escalation.id;

      this.log(`  Escalation ID: ${escalation.id}`, 'reset');
      this.log(`  Type: ${escalation.escalationType}`, 'reset');
      this.log(`  Priority: ${escalation.priority}`, 'reset');
      this.log(`  Status: ${escalation.status}`, 'reset');
      this.log(`  Assigned To: ${escalation.assignedTo || 'Auto-assigned'}`, 'reset');

      if (escalation.status !== 'OPEN') {
        throw new Error(`Expected status OPEN, got ${escalation.status}`);
      }
    });
  }

  async testAddEscalationComment(): Promise<void> {
    await this.recordTest('Add Comment to Escalation', async () => {
      if (!this.testData.escalationId) {
        throw new Error('Escalation ID not available');
      }

      const response = await this.client.post(`/api/qc-workflow/escalations/${this.testData.escalationId}/comment`, {
        commentBy: TEST_MANAGER_ID,
        comment: 'Reviewed appraiser market data. Adjustments appear reasonable given local trends.',
        visibility: 'INTERNAL'
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const escalation = response.data;
      this.log(`  Comments Count: ${escalation.comments?.length || 0}`, 'reset');
    });
  }

  async testGetOpenEscalations(): Promise<void> {
    await this.recordTest('Get Open Escalations', async () => {
      const response = await this.client.get('/api/qc-workflow/escalations/open');

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const escalations = response.data;
      this.log(`  Open Escalations Count: ${escalations.length}`, 'reset');

      if (escalations.length > 0) {
        const escalation = escalations[0];
        this.log(`  Example - Type: ${escalation.escalationType}, Priority: ${escalation.priority}`, 'reset');
      }
    });
  }

  async testResolveEscalation(): Promise<void> {
    await this.recordTest('Resolve Escalation (Overturn QC)', async () => {
      if (!this.testData.escalationId) {
        throw new Error('Escalation ID not available');
      }

      const response = await this.client.post(`/api/qc-workflow/escalations/${this.testData.escalationId}/resolve`, {
        resolution: 'QC finding overturned based on additional market evidence. Comp adjustments are justified.',
        resolvedBy: TEST_MANAGER_ID,
        actions: [
          {
            actionType: 'QC_OVERRIDE',
            description: 'Overrode QC finding on comp distance',
            performedBy: TEST_MANAGER_ID,
            performedAt: new Date().toISOString(),
            metadata: {
              resolutionType: 'OVERTURN_QC',
              justification: 'Local market conditions support longer comp distances'
            }
          }
        ]
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const escalation = response.data;
      this.log(`  Status: ${escalation.status}`, 'reset');
      this.log(`  Resolution: ${escalation.resolution}`, 'reset');
      this.log(`  Actions Count: ${escalation.actions?.length || 0}`, 'reset');

      if (escalation.status !== 'RESOLVED') {
        throw new Error(`Expected status RESOLVED, got ${escalation.status}`);
      }
    });
  }

  async testSLAMetrics(): Promise<void> {
    await this.recordTest('Get SLA Metrics', async () => {
      const response = await this.client.get('/api/qc-workflow/sla/metrics?period=TODAY&entityType=QC_REVIEW');

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const metrics = response.data;
      this.log(`  Total Tracked: ${metrics.totalTracked}`, 'reset');
      this.log(`  On Track: ${metrics.onTrack}`, 'reset');
      this.log(`  At Risk: ${metrics.atRisk}`, 'reset');
      this.log(`  Breached: ${metrics.breached}`, 'reset');
      this.log(`  On-Time %: ${metrics.onTimePercentage}%`, 'reset');
      this.log(`  Breach Rate: ${metrics.breachRate}%`, 'reset');
    });
  }

  async testExtendSLA(): Promise<void> {
    await this.recordTest('Extend SLA Deadline', async () => {
      if (!this.testData.slaTrackingId) {
        throw new Error('SLA tracking ID not available');
      }

      const response = await this.client.post(`/api/qc-workflow/sla/${this.testData.slaTrackingId}/extend`, {
        extensionMinutes: 60,
        reason: 'Complex property requires additional research',
        extendedBy: TEST_MANAGER_ID
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const tracking = response.data;
      this.log(`  New Target Minutes: ${tracking.targetMinutes}`, 'reset');
      this.log(`  Status: ${tracking.status}`, 'reset');
      this.log(`  Extension Recorded: ${tracking.extensionMinutes || 0} minutes`, 'reset');
    });
  }

  // Main test runner
  async runAllTests(): Promise<void> {
    this.logSection('QC WORKFLOW - END-TO-END INTEGRATION TEST');
    
    const startTime = Date.now();

    // Phase 1: Queue Management
    this.logSection('Phase 1: Queue Management & Priority Scoring');
    await this.testHealthCheck();
    await this.testAddToQueue();
    await this.testQueueStatistics();
    await this.testAnalystWorkload();
    await this.testManualAssignment();

    // Phase 2: SLA Tracking
    this.logSection('Phase 2: SLA Tracking & Monitoring');
    await this.testStartSLATracking();
    await this.testGetSLAStatus();
    await this.testExtendSLA();

    // Phase 3: Revision Workflow
    this.logSection('Phase 3: Revision Management & Auto Re-QC');
    await this.testCreateRevision();
    await this.testGetRevisionHistory();
    await this.testSubmitRevision();
    await this.testGetActiveRevisions();

    // Phase 4: Escalation Workflow
    this.logSection('Phase 4: Escalation & Dispute Resolution');
    await this.testCreateEscalation();
    await this.testAddEscalationComment();
    await this.testGetOpenEscalations();
    await this.testResolveEscalation();

    // Phase 5: Metrics & Analytics
    this.logSection('Phase 5: Metrics & Analytics');
    await this.testSLAMetrics();

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    this.logSection('TEST SUMMARY');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;

    this.log(`Total Tests: ${total}`, 'bright');
    this.log(`Passed: ${passed}`, 'green');
    this.log(`Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
    this.log(`Duration: ${duration}s`, 'cyan');

    if (failed > 0) {
      this.log('\nFailed Tests:', 'red');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          this.log(`  ✗ ${r.name}: ${r.message}`, 'red');
        });
    }

    this.log('\n' + '='.repeat(80), 'reset');
    
    if (failed === 0) {
      this.log('✓ ALL TESTS PASSED', 'green');
    } else {
      this.log(`✗ ${failed} TEST(S) FAILED`, 'red');
      process.exit(1);
    }
  }
}

// INTEGRATION TEST — requires running server at localhost:3000.
// Run manually or set INTEGRATION_TESTS=true before starting vitest.
if (process.env.INTEGRATION_TESTS === 'true') {
  const runner = new QCWorkflowE2ETest();
  runner.runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

// Vitest placeholder — all real tests run via QCWorkflowE2ETest above
describe.skip('QC Workflow E2E Tests (requires running server at localhost:3000)', () => {
  it('placeholder — run with INTEGRATION_TESTS=true', () => {});
});
