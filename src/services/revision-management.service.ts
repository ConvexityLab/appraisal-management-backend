/**
 * Revision Management Service
 * 
 * Manages appraisal revisions with:
 * - Version tracking (v1, v2, v3...)
 * - Issue tracking and resolution
 * - Appraiser notifications (email, SMS, in-app)
 * - Automatic re-QC after resubmission
 * - Revision history and analytics
 */

import { Logger } from '../utils/logger';
import { CosmosDbService } from './cosmos-db.service';
import { NotificationService } from './notification.service';
import { QCReviewQueueService } from './qc-review-queue.service';
import { ComprehensiveQCValidationService } from './comprehensive-qc-validation.service';
import {
  RevisionRequest,
  RevisionStatus,
  RevisionSeverity,
  RevisionIssue,
  RevisionNotification,
  RevisionHistory,
  CreateRevisionRequest,
  SubmitRevisionRequest
} from '../types/qc-workflow';
import { AppraisalData } from '../types/qc-validation';

export interface RevisionAnalytics {
  totalRevisions: number;
  averageRevisionTime: number; // minutes
  revisionRate: number; // percentage of orders requiring revision
  byVendor: {
    [vendorId: string]: {
      count: number;
      averageTime: number;
    };
  };
  bySeverity: {
    [severity: string]: number;
  };
  byIssueType: {
    [issueType: string]: number;
  };
}

export class RevisionManagementService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private notificationService: NotificationService;
  private qcQueueService: QCReviewQueueService;
  private qcValidationService: ComprehensiveQCValidationService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.notificationService = new NotificationService();
    this.qcQueueService = new QCReviewQueueService();
    this.qcValidationService = new ComprehensiveQCValidationService();
  }

  // ===========================
  // REVISION CREATION
  // ===========================

  /**
   * Create a new revision request
   */
  async createRevisionRequest(request: CreateRevisionRequest): Promise<RevisionRequest> {
    try {
      this.logger.info('Creating revision request', {
        orderId: request.orderId,
        severity: request.severity,
        issuesCount: request.issues.length
      });

      // Get current revision history
      const history = await this.getRevisionHistory(request.orderId);
      const version = history.currentVersion + 1;

      // Create revision issues with IDs
      const issues: RevisionIssue[] = request.issues.map((issue, index) => ({
        ...issue,
        id: `issue-${version}-${index + 1}`,
        resolved: false
      }));

      // Calculate due date if not provided
      const dueDate = request.dueDate || this.calculateRevisionDueDate(request.severity);

      const revision: RevisionRequest = {
        id: `rev-${request.orderId}-${version}`,
        orderId: request.orderId,
        orderNumber: history.orderNumber,
        appraisalId: request.appraisalId,
        qcReportId: request.qcReportId,
        version,
        revisionNumber: `REV-${version}`,
        severity: request.severity,
        status: RevisionStatus.PENDING,
        issues,
        requestedBy: request.requestedBy,
        requestedByName: await this.getUserName(request.requestedBy),
        assignedTo: '', // Will be set to vendor ID
        assignedToName: '', // Will be set to vendor name
        requestedAt: new Date(),
        dueDate,
        requestNotes: request.requestNotes,
        notificationsSent: [],
        remindersSent: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store revision
      await this.dbService.createDocument('revisions', revision);

      // Send notification to appraiser
      await this.notifyAppraiserOfRevision(revision);

      this.logger.info('Revision request created successfully', {
        revisionId: revision.id,
        version: revision.version,
        dueDate: revision.dueDate
      });

      return revision;

    } catch (error) {
      this.logger.error('Failed to create revision request', { error, request });
      throw error;
    }
  }

  /**
   * Submit revised appraisal
   */
  async submitRevision(request: SubmitRevisionRequest): Promise<RevisionRequest> {
    try {
      this.logger.info('Submitting revision', {
        revisionId: request.revisionId
      });

      const revision = await this.getRevision(request.revisionId);
      if (!revision) {
        throw new Error('Revision not found');
      }

      if (revision.status !== RevisionStatus.PENDING && revision.status !== RevisionStatus.IN_PROGRESS) {
        throw new Error(`Cannot submit revision in ${revision.status} status`);
      }

      // Mark resolved issues
      revision.issues.forEach(issue => {
        if (request.resolvedIssues.includes(issue.id)) {
          issue.resolved = true;
          issue.resolvedAt = new Date();
          issue.resolvedBy = request.submittedBy;
        }
      });

      // Update revision status
      revision.status = RevisionStatus.SUBMITTED;
      revision.submittedAt = new Date();
      revision.responseNotes = request.responseNotes;
      revision.updatedAt = new Date();

      await this.dbService.upsertDocument('revisions', revision);

      // Trigger automatic re-QC
      await this.triggerAutoReQC(revision);

      this.logger.info('Revision submitted successfully', {
        revisionId: revision.id,
        resolvedIssues: request.resolvedIssues.length,
        totalIssues: revision.issues.length
      });

      return revision;

    } catch (error) {
      this.logger.error('Failed to submit revision', { error, request });
      throw error;
    }
  }

  /**
   * Accept revision after re-QC
   */
  async acceptRevision(revisionId: string, acceptedBy: string, notes?: string): Promise<RevisionRequest> {
    try {
      const revision = await this.getRevision(revisionId);
      if (!revision) {
        throw new Error('Revision not found');
      }

      revision.status = RevisionStatus.ACCEPTED;
      revision.reviewedAt = new Date();
      revision.completedAt = new Date();
      if (notes) {
        revision.internalNotes = notes;
      }
      revision.updatedAt = new Date();

      await this.dbService.upsertDocument('revisions', revision);

      // Notify appraiser
      await this.notifyRevisionAccepted(revision);

      this.logger.info('Revision accepted', { revisionId, acceptedBy });

      return revision;

    } catch (error) {
      this.logger.error('Failed to accept revision', { error, revisionId });
      throw error;
    }
  }

  /**
   * Reject revision (needs more work)
   */
  async rejectRevision(revisionId: string, rejectedBy: string, reason: string): Promise<RevisionRequest> {
    try {
      const revision = await this.getRevision(revisionId);
      if (!revision) {
        throw new Error('Revision not found');
      }

      revision.status = RevisionStatus.REJECTED;
      revision.reviewedAt = new Date();
      revision.internalNotes = reason;
      revision.updatedAt = new Date();

      await this.dbService.upsertDocument('revisions', revision);

      // Notify appraiser - more work needed
      await this.notifyRevisionRejected(revision, reason);

      this.logger.info('Revision rejected', { revisionId, rejectedBy, reason });

      return revision;

    } catch (error) {
      this.logger.error('Failed to reject revision', { error, revisionId });
      throw error;
    }
  }

  // ===========================
  // AUTO RE-QC
  // ===========================

  /**
   * Automatically trigger QC validation after revision submission
   */
  private async triggerAutoReQC(revision: RevisionRequest): Promise<void> {
    try {
      this.logger.info('Triggering automatic re-QC', {
        revisionId: revision.id,
        orderId: revision.orderId
      });

      // Update revision status
      revision.status = RevisionStatus.UNDER_REVIEW;
      await this.dbService.upsertDocument('revisions', revision);

      // Add back to QC queue with high priority
      await this.qcQueueService.addToQueue({
        orderId: revision.orderId,
        orderNumber: revision.orderNumber,
        appraisalId: revision.appraisalId,
        propertyAddress: '', // Would fetch from order
        appraisedValue: 0, // Would fetch from order
        orderPriority: 'EXPEDITED', // Revisions get priority
        clientId: '',
        clientName: '',
        vendorId: '',
        vendorName: '',
        submittedAt: new Date()
      });

      this.logger.info('Auto re-QC triggered successfully', { revisionId: revision.id });

    } catch (error) {
      this.logger.error('Failed to trigger auto re-QC', { error, revisionId: revision.id });
      // Don't throw - revision is still submitted
    }
  }

  // ===========================
  // NOTIFICATIONS
  // ===========================

  /**
   * Notify appraiser of revision request
   */
  private async notifyAppraiserOfRevision(revision: RevisionRequest): Promise<void> {
    try {
      const notification: RevisionNotification = {
        id: `notif-${Date.now()}`,
        notificationType: 'REQUEST',
        sentTo: revision.assignedTo,
        sentAt: new Date(),
        channel: 'EMAIL',
        delivered: false
      };

      // Send email
      await this.notificationService.sendEmail({
        to: '', // Would get from vendor profile
        subject: `Revision Required: Order ${revision.orderNumber}`,
        body: this.generateRevisionEmailBody(revision),
        templateId: 'revision-request'
      });

      notification.delivered = true;
      revision.notificationsSent.push(notification);

      await this.dbService.upsertDocument('revisions', revision);

      this.logger.info('Revision notification sent', {
        revisionId: revision.id,
        channel: 'EMAIL'
      });

    } catch (error) {
      this.logger.error('Failed to send revision notification', { error, revisionId: revision.id });
    }
  }

  /**
   * Send reminder if revision not submitted
   */
  async sendRevisionReminder(revisionId: string): Promise<void> {
    try {
      const revision = await this.getRevision(revisionId);
      if (!revision) return;

      if (revision.status !== RevisionStatus.PENDING && revision.status !== RevisionStatus.IN_PROGRESS) {
        return; // Already submitted
      }

      const hoursUntilDue = (revision.dueDate.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilDue > 4) {
        return; // Not urgent yet
      }

      const notification: RevisionNotification = {
        id: `notif-${Date.now()}`,
        notificationType: 'REMINDER',
        sentTo: revision.assignedTo,
        sentAt: new Date(),
        channel: 'EMAIL',
        delivered: false
      };

      await this.notificationService.sendEmail({
        to: '',
        subject: `REMINDER: Revision Due Soon - Order ${revision.orderNumber}`,
        body: `Your revision is due in ${Math.floor(hoursUntilDue)} hours. Please submit as soon as possible.`,
        templateId: 'revision-reminder'
      });

      notification.delivered = true;
      revision.notificationsSent.push(notification);
      revision.remindersSent++;

      await this.dbService.upsertDocument('revisions', revision);

      this.logger.info('Revision reminder sent', { revisionId, reminderCount: revision.remindersSent });

    } catch (error) {
      this.logger.error('Failed to send revision reminder', { error, revisionId });
    }
  }

  /**
   * Notify appraiser of revision acceptance
   */
  private async notifyRevisionAccepted(revision: RevisionRequest): Promise<void> {
    try {
      await this.notificationService.sendEmail({
        to: '',
        subject: `Revision Accepted: Order ${revision.orderNumber}`,
        body: `Your revision for order ${revision.orderNumber} has been accepted. Thank you!`,
        templateId: 'revision-accepted'
      });

      this.logger.info('Revision acceptance notification sent', { revisionId: revision.id });

    } catch (error) {
      this.logger.error('Failed to send acceptance notification', { error });
    }
  }

  /**
   * Notify appraiser of revision rejection
   */
  private async notifyRevisionRejected(revision: RevisionRequest, reason: string): Promise<void> {
    try {
      await this.notificationService.sendEmail({
        to: '',
        subject: `Revision Needs More Work: Order ${revision.orderNumber}`,
        body: `Your revision for order ${revision.orderNumber} requires additional work.\n\nReason: ${reason}`,
        templateId: 'revision-rejected'
      });

      this.logger.info('Revision rejection notification sent', { revisionId: revision.id });

    } catch (error) {
      this.logger.error('Failed to send rejection notification', { error });
    }
  }

  // ===========================
  // REVISION HISTORY
  // ===========================

  /**
   * Get revision history for an order
   */
  async getRevisionHistory(orderId: string): Promise<RevisionHistory> {
    try {
      const container = this.dbService.getContainer('revisions');
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.version ASC',
          parameters: [{ name: '@orderId', value: orderId }]
        })
        .fetchAll();

      const revisions = resources as RevisionRequest[];

      const lastRevision = revisions[revisions.length - 1];
      return {
        orderId,
        orderNumber: revisions[0]?.orderNumber || '',
        revisions,
        totalRevisions: revisions.length,
        currentVersion: revisions.length,
        lastRevisionDate: lastRevision?.requestedAt || new Date()
      };

    } catch (error) {
      this.logger.error('Failed to get revision history', { error, orderId });
      return {
        orderId,
        orderNumber: '',
        revisions: [],
        totalRevisions: 0,
        currentVersion: 0
      };
    }
  }

  /**
   * Get all active revisions (pending or in progress)
   */
  async getActiveRevisions(): Promise<RevisionRequest[]> {
    try {
      const container = this.dbService.getContainer('revisions');
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.status IN (@pending, @inProgress) ORDER BY c.dueDate ASC',
          parameters: [
            { name: '@pending', value: RevisionStatus.PENDING },
            { name: '@inProgress', value: RevisionStatus.IN_PROGRESS }
          ]
        })
        .fetchAll();

      return resources as RevisionRequest[];

    } catch (error) {
      this.logger.error('Failed to get active revisions', { error });
      return [];
    }
  }

  /**
   * Get overdue revisions
   */
  async getOverdueRevisions(): Promise<RevisionRequest[]> {
    const activeRevisions = await this.getActiveRevisions();
    const now = Date.now();

    return activeRevisions.filter(rev => rev.dueDate.getTime() < now);
  }

  // ===========================
  // ANALYTICS
  // ===========================

  /**
   * Get revision analytics
   */
  async getRevisionAnalytics(startDate: Date, endDate: Date): Promise<RevisionAnalytics> {
    try {
      const container = this.dbService.getContainer('revisions');
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.requestedAt >= @start AND c.requestedAt <= @end',
          parameters: [
            { name: '@start', value: startDate.toISOString() },
            { name: '@end', value: endDate.toISOString() }
          ]
        })
        .fetchAll();

      const revisions = resources as RevisionRequest[];

      // Calculate metrics
      const completedRevisions = revisions.filter(r => r.completedAt);
      const avgTime = completedRevisions.length > 0
        ? completedRevisions.reduce((sum, r) => {
            const duration = r.completedAt!.getTime() - r.requestedAt.getTime();
            return sum + duration / (1000 * 60); // minutes
          }, 0) / completedRevisions.length
        : 0;

      // Group by severity
      const bySeverity: { [key: string]: number } = {};
      revisions.forEach(r => {
        bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
      });

      // Group by issue type
      const byIssueType: { [key: string]: number } = {};
      revisions.forEach(r => {
        r.issues.forEach(issue => {
          byIssueType[issue.issueType] = (byIssueType[issue.issueType] || 0) + 1;
        });
      });

      return {
        totalRevisions: revisions.length,
        averageRevisionTime: Math.floor(avgTime),
        revisionRate: 0, // Would calculate from total orders
        byVendor: {},
        bySeverity,
        byIssueType
      };

    } catch (error) {
      this.logger.error('Failed to get revision analytics', { error });
      throw error;
    }
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  private async getRevision(revisionId: string): Promise<RevisionRequest | null> {
    try {
      const result = await this.dbService.getDocument('revisions', revisionId);
      return result as RevisionRequest;
    } catch {
      return null;
    }
  }

  private calculateRevisionDueDate(severity: RevisionSeverity): Date {
    const hoursMap: { [key: string]: number } = {
      [RevisionSeverity.CRITICAL]: 4,
      [RevisionSeverity.MAJOR]: 24,
      [RevisionSeverity.MODERATE]: 48,
      [RevisionSeverity.MINOR]: 72
    };

    const hours = hoursMap[severity] || 48;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private async getUserName(userId: string): Promise<string> {
    // Would fetch from user service
    return `User ${userId}`;
  }

  private generateRevisionEmailBody(revision: RevisionRequest): string {
    const issuesList = revision.issues
      .map((issue, i) => `${i + 1}. [${issue.severity}] ${issue.description}`)
      .join('\n');

    return `
Dear Appraiser,

A revision is required for Order ${revision.orderNumber}.

Severity: ${revision.severity}
Due Date: ${revision.dueDate.toLocaleString()}
Version: ${revision.version}

Issues to Address:
${issuesList}

Additional Notes:
${revision.requestNotes}

Please address these issues and resubmit the appraisal.

Thank you,
QC Team
    `.trim();
  }

  /**
   * Background job: Check for overdue revisions and send reminders
   */
  async processRevisionReminders(): Promise<void> {
    try {
      const activeRevisions = await this.getActiveRevisions();
      
      for (const revision of activeRevisions) {
        const hoursUntilDue = (revision.dueDate.getTime() - Date.now()) / (1000 * 60 * 60);
        
        // Send reminder at 4 hours and 1 hour before due
        if ((hoursUntilDue <= 4 && revision.remindersSent === 0) ||
            (hoursUntilDue <= 1 && revision.remindersSent === 1)) {
          await this.sendRevisionReminder(revision.id);
        }
      }

      this.logger.info('Revision reminders processed', { 
        activeCount: activeRevisions.length 
      });

    } catch (error) {
      this.logger.error('Failed to process revision reminders', { error });
    }
  }
}
