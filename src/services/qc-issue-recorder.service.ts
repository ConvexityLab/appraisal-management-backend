/**
 * QC Issue Recorder Service
 *
 * Listens for qc.issue.detected events (fired by AxiomService when a criterion
 * fails or warns) and persists them as QC issue records in the qc-issues
 * Cosmos container.  Each issue carries the source document references
 * (page, coordinates, quote) so the QC analyst can click through to the PDF
 * at the exact location that caused the verdict.
 *
 * Events subscribed:
 *   - qc.issue.detected  (published by axiom.service.ts#fetchAndStorePipelineResults)
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber.js';
import type { BaseEvent, EventHandler } from '../types/events.js';

export interface QCIssueRecord {
  id: string;
  type: 'qc-issue';
  tenantId: string;
  /** Stored in aiInsights container which is partitioned by /orderId */
  orderId: string;
  criterionId: string;
  issueSummary: string;
  issueType: 'criterion-fail' | 'criterion-warning' | 'manual';
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  confidence?: number;
  reasoning?: string;
  remediation?: string;
  /** Document references from Axiom — page, coordinates, quote */
  documentReferences?: Array<{
    documentId?: string;
    documentName?: string;
    page?: number;
    section?: string;
    quote?: string;
    coordinates?: { x: number; y: number; width: number; height: number };
    blobUrl?: string;
  }>;
  evaluationId?: string;
  pipelineJobId?: string;
  createdBy: 'axiom' | string;
  createdAt: string;
  updatedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

/** Container where QC issue records are stored (shared with Axiom evaluations for simplicity) */
const QC_ISSUES_CONTAINER = 'aiInsights';

export class QCIssueRecorderService {
  private readonly logger = new Logger('QCIssueRecorderService');
  private readonly subscriber: ServiceBusEventSubscriber;
  private isStarted = false;

  constructor(private readonly dbService: CosmosDbService) {
    this.subscriber = new ServiceBusEventSubscriber('qc-issue-recorder');
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('QCIssueRecorderService already started');
      return;
    }
    const handler: EventHandler<BaseEvent> = {
      handle: async (event) => {
        await this.onIssueDetected(event);
      },
    };
    await this.subscriber.subscribe('qc.issue.detected', handler);
    this.isStarted = true;
    this.logger.info('QCIssueRecorderService started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.subscriber.unsubscribe('qc.issue.detected').catch(() => {});
    this.isStarted = false;
  }

  /**
   * Create a qc-issue record when a criterion fails or warns.
   * Idempotent: uses a deterministic ID built from orderId + criterionId + evaluationId,
   * so re-running the same evaluation doesn't create duplicate issues.
   */
  private async onIssueDetected(event: any): Promise<void> {
    const data = event?.data ?? {};
    const orderId = data.orderId as string | undefined;
    const criterionId = data.criterionId as string | undefined;
    const tenantId = data.tenantId as string | undefined;

    if (!orderId || !criterionId || !tenantId) {
      this.logger.warn('qc.issue.detected missing required fields', {
        orderId, criterionId, tenantId,
      });
      return;
    }

    const evalId = data.evaluationId ?? data.pipelineJobId ?? 'manual';
    const issueId = `qc-issue-${orderId}-${criterionId}-${String(evalId).substring(0, 16)}`;

    const record: QCIssueRecord = {
      id: issueId,
      type: 'qc-issue',
      tenantId,
      orderId,
      criterionId,
      issueSummary: (data.issueSummary as string) ?? criterionId,
      issueType: data.issueType === 'criterion-fail' ? 'criterion-fail'
        : data.issueType === 'criterion-warning' ? 'criterion-warning'
        : 'manual',
      severity: (data.severity as any) ?? 'MAJOR',
      status: 'OPEN',
      createdBy: 'axiom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(typeof data.confidence === 'number' ? { confidence: data.confidence } : {}),
      ...(typeof data.reasoning === 'string' ? { reasoning: data.reasoning } : {}),
      ...(typeof data.remediation === 'string' ? { remediation: data.remediation } : {}),
      ...(Array.isArray(data.documentReferences) ? { documentReferences: data.documentReferences } : {}),
      ...(typeof data.evaluationId === 'string' ? { evaluationId: data.evaluationId } : {}),
      ...(typeof data.pipelineJobId === 'string' ? { pipelineJobId: data.pipelineJobId } : {}),
    };

    try {
      // Upsert into aiInsights container (partition key: /orderId).
      // If the issue already exists from a prior evaluation, the upsert replaces it,
      // keeping the most recent verdict as source of truth.
      const container = this.dbService.getContainer(QC_ISSUES_CONTAINER);
      await container.items.upsert(record);
      this.logger.info('QC issue recorded', { issueId, orderId, criterionId, severity: record.severity });
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error('Failed to record QC issue', {
        issueId, orderId, criterionId, container: QC_ISSUES_CONTAINER, error: msg,
      });
    }
  }
}

export { QC_ISSUES_CONTAINER };
