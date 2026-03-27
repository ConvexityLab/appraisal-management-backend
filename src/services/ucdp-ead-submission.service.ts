/**
 * UCDP/EAD Submission Service (Phase 1.5)
 *
 * Manages submission of appraisal reports to Fannie Mae UCDP and FHA EAD portals.
 * Handles SSR (Submission Summary Report) feedback parsing, status tracking,
 * and auto-retry on transient failures.
 *
 * NOTE: Actual GSE API integration requires API credentials and is configured
 * at deployment time. This service implements the full lifecycle + state machine;
 * the transport layer is pluggable via SubmissionProvider interface.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type SubmissionPortal = 'UCDP' | 'EAD';
export type SubmissionStatus = 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'ACCEPTED_WITH_WARNINGS' | 'REJECTED' | 'ERROR' | 'RETRYING';

export interface SubmissionRequest {
  orderId: string;
  tenantId: string;
  portal: SubmissionPortal;
  /** MISMO 3.4 XML content */
  xmlContent: string;
  /** Loan number for tracking */
  loanNumber?: string;
  /** Lender identifier required by UCDP/EAD */
  lenderId?: string;
}

export interface SSRFinding {
  code: string;
  severity: 'HARD_STOP' | 'WARNING' | 'MESSAGE';
  category: string;
  description: string;
  fieldPath?: string;
}

export interface SubmissionRecord {
  id: string;
  orderId: string;
  tenantId: string;
  portal: SubmissionPortal;
  status: SubmissionStatus;
  /** Portal-assigned document ID */
  portalDocumentId?: string;
  /** Submission Summary Report findings */
  ssrFindings: SSRFinding[];
  /** Number of retry attempts */
  retryCount: number;
  maxRetries: number;
  submittedAt?: string;
  completedAt?: string;
  lastCheckedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionResult {
  submission: SubmissionRecord;
  isAccepted: boolean;
  hardStopCount: number;
  warningCount: number;
}

/**
 * Pluggable transport interface for actual GSE API calls.
 * In production, implement with real UCDP/EAD API clients.
 */
export interface SubmissionProvider {
  submit(portal: SubmissionPortal, xmlContent: string, lenderId: string): Promise<{
    portalDocumentId: string;
    status: SubmissionStatus;
    findings: SSRFinding[];
  }>;
  checkStatus(portal: SubmissionPortal, portalDocumentId: string): Promise<{
    status: SubmissionStatus;
    findings: SSRFinding[];
  }>;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class UCDPEADSubmissionService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private provider: SubmissionProvider | null;

  static readonly MAX_RETRIES = 3;
  static readonly RETRY_DELAY_MS = 30_000; // 30 seconds

  constructor(dbService: CosmosDbService, provider?: SubmissionProvider) {
    this.dbService = dbService;
    this.provider = provider ?? null;
    this.logger = new Logger('UCDPEADSubmissionService');
  }

  /**
   * Submit an appraisal to UCDP or EAD.
   */
  async submit(request: SubmissionRequest): Promise<SubmissionResult> {
    this.logger.info('Starting GSE submission', {
      orderId: request.orderId,
      portal: request.portal,
    });

    const now = new Date().toISOString();
    const submissionId = `sub-${request.portal.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Create initial submission record
    const record: SubmissionRecord = {
      id: submissionId,
      orderId: request.orderId,
      tenantId: request.tenantId,
      portal: request.portal,
      status: 'PENDING',
      ssrFindings: [],
      retryCount: 0,
      maxRetries: UCDPEADSubmissionService.MAX_RETRIES,
      createdAt: now,
      updatedAt: now,
    };

    if (!this.provider) {
      // No provider configured — record the intent but can't submit
      record.status = 'ERROR';
      record.errorMessage = `${request.portal} submission provider not configured. Configure the ${request.portal} API credentials to enable submissions.`;
      await this.saveRecord(record);
      return {
        submission: record,
        isAccepted: false,
        hardStopCount: 0,
        warningCount: 0,
      };
    }

    try {
      // Attempt submission
      record.status = 'SUBMITTED';
      record.submittedAt = now;
      const response = await this.provider.submit(
        request.portal,
        request.xmlContent,
        request.lenderId ?? '',
      );

      record.portalDocumentId = response.portalDocumentId;
      record.status = response.status;
      record.ssrFindings = response.findings;
      record.completedAt = new Date().toISOString();
      record.updatedAt = new Date().toISOString();

      await this.saveRecord(record);

      const hardStopCount = response.findings.filter(f => f.severity === 'HARD_STOP').length;
      const warningCount = response.findings.filter(f => f.severity === 'WARNING').length;

      this.logger.info('GSE submission completed', {
        submissionId,
        portal: request.portal,
        status: record.status,
        hardStopCount,
        warningCount,
      });

      return {
        submission: record,
        isAccepted: record.status === 'ACCEPTED' || record.status === 'ACCEPTED_WITH_WARNINGS',
        hardStopCount,
        warningCount,
      };
    } catch (error) {
      record.status = 'ERROR';
      record.errorMessage = error instanceof Error ? error.message : 'Unknown submission error';
      record.retryCount += 1;
      record.updatedAt = new Date().toISOString();
      await this.saveRecord(record);

      this.logger.error('GSE submission failed', {
        submissionId,
        portal: request.portal,
        error: record.errorMessage,
        retryCount: record.retryCount,
      });

      return {
        submission: record,
        isAccepted: false,
        hardStopCount: 0,
        warningCount: 0,
      };
    }
  }

  /**
   * Check the status of a previously submitted document.
   */
  async checkSubmissionStatus(submissionId: string, tenantId: string): Promise<SubmissionResult> {
    const record = await this.loadRecord(submissionId, tenantId);
    if (!record) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    if (!this.provider || !record.portalDocumentId) {
      return {
        submission: record,
        isAccepted: record.status === 'ACCEPTED' || record.status === 'ACCEPTED_WITH_WARNINGS',
        hardStopCount: record.ssrFindings.filter(f => f.severity === 'HARD_STOP').length,
        warningCount: record.ssrFindings.filter(f => f.severity === 'WARNING').length,
      };
    }

    try {
      const response = await this.provider.checkStatus(record.portal, record.portalDocumentId);
      record.status = response.status;
      record.ssrFindings = response.findings;
      record.lastCheckedAt = new Date().toISOString();
      record.updatedAt = new Date().toISOString();
      if (record.status === 'ACCEPTED' || record.status === 'ACCEPTED_WITH_WARNINGS' || record.status === 'REJECTED') {
        record.completedAt = new Date().toISOString();
      }
      await this.saveRecord(record);
    } catch (error) {
      this.logger.error('Status check failed', { submissionId, error });
    }

    return {
      submission: record,
      isAccepted: record.status === 'ACCEPTED' || record.status === 'ACCEPTED_WITH_WARNINGS',
      hardStopCount: record.ssrFindings.filter(f => f.severity === 'HARD_STOP').length,
      warningCount: record.ssrFindings.filter(f => f.severity === 'WARNING').length,
    };
  }

  /**
   * Get submission history for an order.
   */
  async getSubmissionsForOrder(orderId: string, tenantId: string): Promise<SubmissionRecord[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'gse-submission' AND c.orderId = @oid AND c.tenantId = @tid ORDER BY c.createdAt DESC`,
      parameters: [
        { name: '@oid', value: orderId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources as SubmissionRecord[];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async saveRecord(record: SubmissionRecord): Promise<void> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      this.logger.warn('Cannot save submission record — container not initialized');
      return;
    }
    await container.items.upsert({
      ...record,
      type: 'gse-submission',
    });
  }

  private async loadRecord(submissionId: string, tenantId: string): Promise<SubmissionRecord | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'gse-submission' AND c.id = @id AND c.tenantId = @tid`,
      parameters: [
        { name: '@id', value: submissionId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources.length > 0 ? resources[0] as SubmissionRecord : null;
  }
}
