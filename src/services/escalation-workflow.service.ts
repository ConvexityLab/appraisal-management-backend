/**
 * Escalation Workflow Service
 * 
 * Manages escalations with:
 * - QC dispute resolution
 * - Manager override capabilities
 * - Complex case routing
 * - Compliance issue handling
 * - Action tracking and audit trail
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { NotificationService } from './notification.service';
import {
  EscalationCase,
  EscalationType,
  EscalationStatus,
  EscalationPriority,
  EscalationAction,
  EscalationComment,
  DisputeResolution,
  CreateEscalationRequest,
  ResolveEscalationRequest
} from '../types/qc-workflow.js';

export interface EscalationMetrics {
  totalEscalations: number;
  openEscalations: number;
  averageResolutionTime: number; // hours
  byType: {
    [key: string]: number;
  };
  byPriority: {
    [key: string]: number;
  };
  resolutionRate: number; // percentage
}

export class EscalationWorkflowService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private notificationService: NotificationService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.notificationService = new NotificationService();
  }

  // ===========================
  // ESCALATION CREATION
  // ===========================

  /**
   * Create new escalation case
   */
  async createEscalation(request: CreateEscalationRequest): Promise<EscalationCase> {
    try {
      this.logger.info('Creating escalation case', {
        orderId: request.orderId,
        type: request.escalationType,
        priority: request.priority
      });

      const escalation: EscalationCase = {
        id: `esc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        escalationType: request.escalationType,
        priority: request.priority,
        status: EscalationStatus.OPEN,
        orderId: request.orderId,
        orderNumber: '', // Would fetch from order
        title: request.title,
        description: request.description,
        raisedBy: request.raisedBy,
        raisedByName: await this.getUserName(request.raisedBy),
        raisedByRole: await this.getUserRole(request.raisedBy),
        raisedAt: new Date(),
        actions: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add optional properties only if they are defined
      if (request.appraisalId) escalation.appraisalId = request.appraisalId;
      if (request.qcReportId) escalation.qcReportId = request.qcReportId;
      if (request.revisionId) escalation.revisionId = request.revisionId;

      // Store escalation
      await this.dbService.createDocument('escalations', escalation);

      // Auto-assign to appropriate manager based on type
      await this.autoAssignEscalation(escalation);

      // Send notifications
      await this.notifyEscalationCreated(escalation);

      this.logger.info('Escalation created successfully', {
        escalationId: escalation.id,
        assignedTo: escalation.assignedTo
      });

      return escalation;

    } catch (error) {
      this.logger.error('Failed to create escalation', { error, request });
      throw error;
    }
  }

  /**
   * Auto-assign escalation to appropriate manager
   */
  private async autoAssignEscalation(escalation: EscalationCase): Promise<void> {
    try {
      // Assignment logic based on escalation type
      const managerMap: { [key: string]: string } = {
        [EscalationType.QC_DISPUTE]: 'qc-manager-1',
        [EscalationType.SLA_BREACH]: 'operations-manager-1',
        [EscalationType.COMPLEX_CASE]: 'senior-qc-analyst-1',
        [EscalationType.REVISION_FAILURE]: 'qc-manager-1',
        [EscalationType.FRAUD_SUSPECTED]: 'compliance-manager-1',
        [EscalationType.COMPLIANCE_ISSUE]: 'compliance-manager-1',
        [EscalationType.CLIENT_COMPLAINT]: 'client-relations-manager-1'
      };

      const managerId = managerMap[escalation.escalationType] || 'qc-manager-1';

      escalation.assignedTo = managerId;
      escalation.assignedToName = await this.getUserName(managerId);
      escalation.assignedAt = new Date();
      escalation.status = EscalationStatus.UNDER_REVIEW;

      await this.dbService.upsertDocument('escalations', escalation);

      this.logger.info('Escalation auto-assigned', {
        escalationId: escalation.id,
        managerId
      });

    } catch (error) {
      this.logger.error('Failed to auto-assign escalation', { error });
    }
  }

  // ===========================
  // ESCALATION MANAGEMENT
  // ===========================

  /**
   * Reassign escalation to different manager
   */
  async reassignEscalation(
    escalationId: string,
    newManagerId: string,
    reassignedBy: string,
    reason: string
  ): Promise<EscalationCase> {
    try {
      const escalation = await this.getEscalation(escalationId);
      if (!escalation) {
        throw new Error('Escalation not found');
      }

      const previousManager = escalation.assignedToName;

      // Record action
      const action: EscalationAction = {
        id: `action-${Date.now()}`,
        actionType: 'REASSIGN',
        actionBy: reassignedBy,
        actionByName: await this.getUserName(reassignedBy),
        actionAt: new Date(),
        description: `Reassigned from ${previousManager} to new manager. Reason: ${reason}`,
        outcome: 'Pending'
      };

      escalation.assignedTo = newManagerId;
      escalation.assignedToName = await this.getUserName(newManagerId);
      escalation.actions.push(action);
      escalation.updatedAt = new Date();

      await this.dbService.upsertDocument('escalations', escalation);

      // Notify new manager
      await this.notificationService.sendEmail({
        to: '',
        subject: `Escalation Assigned: ${escalation.title}`,
        body: `You have been assigned escalation ${escalation.id} for order ${escalation.orderNumber}.`,
        templateId: 'escalation-assigned'
      });

      this.logger.info('Escalation reassigned', {
        escalationId,
        from: previousManager,
        to: escalation.assignedToName
      });

      return escalation;

    } catch (error) {
      this.logger.error('Failed to reassign escalation', { error, escalationId });
      throw error;
    }
  }

  /**
   * Add comment to escalation
   */
  async addComment(
    escalationId: string,
    commentBy: string,
    comment: string,
    visibility: 'INTERNAL' | 'VENDOR' | 'CLIENT' = 'INTERNAL'
  ): Promise<EscalationCase> {
    try {
      const escalation = await this.getEscalation(escalationId);
      if (!escalation) {
        throw new Error('Escalation not found');
      }

      const newComment: EscalationComment = {
        id: `comment-${Date.now()}`,
        commentBy,
        commentByName: await this.getUserName(commentBy),
        commentAt: new Date(),
        comment,
        visibility
      };

      escalation.comments.push(newComment);
      escalation.updatedAt = new Date();

      await this.dbService.upsertDocument('escalations', escalation);

      this.logger.info('Comment added to escalation', {
        escalationId,
        commentBy,
        visibility
      });

      return escalation;

    } catch (error) {
      this.logger.error('Failed to add comment', { error, escalationId });
      throw error;
    }
  }

  // ===========================
  // DISPUTE RESOLUTION
  // ===========================

  /**
   * Resolve QC dispute
   */
  async resolveQCDispute(
    escalationId: string,
    resolution: DisputeResolution
  ): Promise<EscalationCase> {
    try {
      this.logger.info('Resolving QC dispute', {
        escalationId,
        resolution: resolution.resolution
      });

      const escalation = await this.getEscalation(escalationId);
      if (!escalation) {
        throw new Error('Escalation not found');
      }

      if (escalation.escalationType !== EscalationType.QC_DISPUTE) {
        throw new Error('Escalation is not a QC dispute');
      }

      // Record action
      const action: EscalationAction = {
        id: `action-${Date.now()}`,
        actionType: 'OVERRIDE',
        actionBy: resolution.resolvedBy,
        actionByName: await this.getUserName(resolution.resolvedBy),
        actionAt: resolution.resolvedAt,
        description: `QC Dispute Resolution: ${resolution.resolution}`,
        outcome: resolution.finalDecision
      };

      escalation.actions.push(action);
      escalation.resolution = resolution.reasoning;
      escalation.resolvedBy = resolution.resolvedBy;
      escalation.resolvedByName = await this.getUserName(resolution.resolvedBy);
      escalation.resolvedAt = resolution.resolvedAt;
      escalation.status = EscalationStatus.RESOLVED;
      escalation.updatedAt = new Date();

      await this.dbService.upsertDocument('escalations', escalation);

      // Notify relevant parties
      await this.notifyDisputeResolved(escalation, resolution);

      this.logger.info('QC dispute resolved', {
        escalationId,
        resolution: resolution.resolution
      });

      return escalation;

    } catch (error) {
      this.logger.error('Failed to resolve QC dispute', { error, escalationId });
      throw error;
    }
  }

  /**
   * Override QC decision (manager privilege)
   */
  async overrideQCDecision(
    escalationId: string,
    overrideBy: string,
    newDecision: string,
    reasoning: string
  ): Promise<EscalationCase> {
    try {
      const escalation = await this.getEscalation(escalationId);
      if (!escalation) {
        throw new Error('Escalation not found');
      }

      const action: EscalationAction = {
        id: `action-${Date.now()}`,
        actionType: 'OVERRIDE',
        actionBy: overrideBy,
        actionByName: await this.getUserName(overrideBy),
        actionAt: new Date(),
        description: `Manager Override: Changed decision to "${newDecision}". Reasoning: ${reasoning}`,
        outcome: newDecision
      };

      escalation.actions.push(action);
      escalation.updatedAt = new Date();

      await this.dbService.upsertDocument('escalations', escalation);

      this.logger.info('QC decision overridden', {
        escalationId,
        overrideBy,
        newDecision
      });

      return escalation;

    } catch (error) {
      this.logger.error('Failed to override QC decision', { error, escalationId });
      throw error;
    }
  }

  /**
   * Waive QC issue
   */
  async waiveQCIssue(
    escalationId: string,
    waivedBy: string,
    issueDescription: string,
    justification: string
  ): Promise<EscalationCase> {
    try {
      const escalation = await this.getEscalation(escalationId);
      if (!escalation) {
        throw new Error('Escalation not found');
      }

      const action: EscalationAction = {
        id: `action-${Date.now()}`,
        actionType: 'WAIVE_ISSUE',
        actionBy: waivedBy,
        actionByName: await this.getUserName(waivedBy),
        actionAt: new Date(),
        description: `Waived issue: "${issueDescription}". Justification: ${justification}`,
        outcome: 'Issue waived'
      };

      escalation.actions.push(action);
      escalation.updatedAt = new Date();

      await this.dbService.upsertDocument('escalations', escalation);

      this.logger.info('QC issue waived', {
        escalationId,
        waivedBy
      });

      return escalation;

    } catch (error) {
      this.logger.error('Failed to waive QC issue', { error, escalationId });
      throw error;
    }
  }

  // ===========================
  // RESOLUTION & CLOSURE
  // ===========================

  /**
   * Resolve escalation
   */
  async resolveEscalation(request: ResolveEscalationRequest): Promise<EscalationCase> {
    try {
      const escalation = await this.getEscalation(request.escalationId);
      if (!escalation) {
        throw new Error('Escalation not found');
      }

      // Add all actions
      for (const actionData of request.actions) {
        const action: EscalationAction = {
          ...actionData,
          id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          actionByName: await this.getUserName(actionData.actionBy),
          actionAt: new Date()
        };
        escalation.actions.push(action);
      }

      escalation.resolution = request.resolution;
      escalation.resolvedBy = request.resolvedBy;
      escalation.resolvedByName = await this.getUserName(request.resolvedBy);
      escalation.resolvedAt = new Date();
      escalation.status = EscalationStatus.RESOLVED;
      escalation.updatedAt = new Date();

      await this.dbService.upsertDocument('escalations', escalation);

      // Notify parties
      await this.notifyEscalationResolved(escalation);

      this.logger.info('Escalation resolved', {
        escalationId: request.escalationId,
        resolvedBy: request.resolvedBy
      });

      return escalation;

    } catch (error) {
      this.logger.error('Failed to resolve escalation', { error, request });
      throw error;
    }
  }

  /**
   * Close escalation
   */
  async closeEscalation(escalationId: string, closedBy: string, notes?: string): Promise<EscalationCase> {
    try {
      const escalation = await this.getEscalation(escalationId);
      if (!escalation) {
        throw new Error('Escalation not found');
      }

      if (escalation.status !== EscalationStatus.RESOLVED) {
        throw new Error('Can only close resolved escalations');
      }

      const action: EscalationAction = {
        id: `action-${Date.now()}`,
        actionType: 'CLOSE_ORDER',
        actionBy: closedBy,
        actionByName: await this.getUserName(closedBy),
        actionAt: new Date(),
        description: `Escalation closed. ${notes || ''}`,
        outcome: 'Closed'
      };

      escalation.actions.push(action);
      escalation.status = EscalationStatus.CLOSED;
      escalation.updatedAt = new Date();

      await this.dbService.upsertDocument('escalations', escalation);

      this.logger.info('Escalation closed', { escalationId, closedBy });

      return escalation;

    } catch (error) {
      this.logger.error('Failed to close escalation', { error, escalationId });
      throw error;
    }
  }

  // ===========================
  // QUERIES & ANALYTICS
  // ===========================

  /**
   * Get all open escalations
   */
  async getOpenEscalations(): Promise<EscalationCase[]> {
    try {
      const container = this.dbService.getContainer('escalations');
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.status IN (@open, @underReview) ORDER BY c.priority DESC, c.raisedAt ASC',
          parameters: [
            { name: '@open', value: EscalationStatus.OPEN },
            { name: '@underReview', value: EscalationStatus.UNDER_REVIEW }
          ]
        })
        .fetchAll();

      return resources as EscalationCase[];

    } catch (error) {
      this.logger.error('Failed to get open escalations', { error });
      return [];
    }
  }

  /**
   * Get escalations by manager
   */
  async getEscalationsByManager(managerId: string): Promise<EscalationCase[]> {
    try {
      const container = this.dbService.getContainer('escalations');
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.assignedTo = @managerId AND c.status != @closed ORDER BY c.raisedAt DESC',
          parameters: [
            { name: '@managerId', value: managerId },
            { name: '@closed', value: EscalationStatus.CLOSED }
          ]
        })
        .fetchAll();

      return resources as EscalationCase[];

    } catch (error) {
      this.logger.error('Failed to get manager escalations', { error, managerId });
      return [];
    }
  }

  /**
   * Get escalation metrics
   */
  async getEscalationMetrics(startDate: Date, endDate: Date): Promise<EscalationMetrics> {
    try {
      const container = this.dbService.getContainer('escalations');
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.raisedAt >= @start AND c.raisedAt <= @end',
          parameters: [
            { name: '@start', value: startDate.toISOString() },
            { name: '@end', value: endDate.toISOString() }
          ]
        })
        .fetchAll();

      const escalations = resources as EscalationCase[];

      // Calculate average resolution time
      const resolved = escalations.filter(e => e.resolvedAt);
      const avgResolutionTime = resolved.length > 0
        ? resolved.reduce((sum, e) => {
            const duration = e.resolvedAt!.getTime() - e.raisedAt.getTime();
            return sum + duration / (1000 * 60 * 60); // hours
          }, 0) / resolved.length
        : 0;

      // Group by type
      const byType: { [key: string]: number } = {};
      escalations.forEach(e => {
        byType[e.escalationType] = (byType[e.escalationType] || 0) + 1;
      });

      // Group by priority
      const byPriority: { [key: string]: number } = {};
      escalations.forEach(e => {
        byPriority[e.priority] = (byPriority[e.priority] || 0) + 1;
      });

      return {
        totalEscalations: escalations.length,
        openEscalations: escalations.filter(e => 
          e.status === EscalationStatus.OPEN || 
          e.status === EscalationStatus.UNDER_REVIEW
        ).length,
        averageResolutionTime: Math.round(avgResolutionTime * 10) / 10,
        byType,
        byPriority,
        resolutionRate: escalations.length > 0 
          ? (resolved.length / escalations.length) * 100 
          : 0
      };

    } catch (error) {
      this.logger.error('Failed to get escalation metrics', { error });
      throw error;
    }
  }

  // ===========================
  // NOTIFICATIONS
  // ===========================

  private async notifyEscalationCreated(escalation: EscalationCase): Promise<void> {
    try {
      if (escalation.assignedTo) {
        await this.notificationService.sendEmail({
          to: '',
          subject: `New Escalation: ${escalation.title}`,
          body: `Escalation ${escalation.id} has been assigned to you.\n\nType: ${escalation.escalationType}\nPriority: ${escalation.priority}\n\nDescription: ${escalation.description}`,
          templateId: 'escalation-created'
        });
      }
    } catch (error) {
      this.logger.error('Failed to send escalation notification', { error });
    }
  }

  private async notifyDisputeResolved(escalation: EscalationCase, resolution: DisputeResolution): Promise<void> {
    try {
      await this.notificationService.sendEmail({
        to: '',
        subject: `QC Dispute Resolved: Order ${escalation.orderNumber}`,
        body: `The QC dispute for order ${escalation.orderNumber} has been resolved.\n\nResolution: ${resolution.resolution}\n\nDecision: ${resolution.finalDecision}`,
        templateId: 'dispute-resolved'
      });
    } catch (error) {
      this.logger.error('Failed to send dispute resolution notification', { error });
    }
  }

  private async notifyEscalationResolved(escalation: EscalationCase): Promise<void> {
    try {
      await this.notificationService.sendEmail({
        to: '',
        subject: `Escalation Resolved: ${escalation.title}`,
        body: `Escalation ${escalation.id} has been resolved.\n\nResolution: ${escalation.resolution}`,
        templateId: 'escalation-resolved'
      });
    } catch (error) {
      this.logger.error('Failed to send escalation resolved notification', { error });
    }
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  private async getEscalation(escalationId: string): Promise<EscalationCase | null> {
    try {
      const result = await this.dbService.getDocument('escalations', escalationId);
      return result as EscalationCase;
    } catch {
      return null;
    }
  }

  private async getUserName(userId: string): Promise<string> {
    // Would fetch from user service
    return `User ${userId}`;
  }

  private async getUserRole(userId: string): Promise<string> {
    // Would fetch from user service
    return 'QC Analyst';
  }
}
