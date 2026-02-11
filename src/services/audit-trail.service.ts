/**
 * Audit Trail Service
 * Immutable append-only audit logging for compliance and security
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { getCorrelationId } from '../middleware/correlation-id.middleware.js';

export interface AuditEvent {
  id: string;
  correlationId?: string;
  timestamp: Date;
  actor: {
    userId: string;
    email?: string;
    role?: string;
    ip?: string;
  };
  action: string;
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  before?: Record<string, any>;
  after?: Record<string, any>;
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  metadata?: Record<string, any>;
}

export class AuditTrailService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private readonly containerName = 'audit-trail';

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Log an audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'correlationId'>): Promise<void> {
    try {
      const correlationId = getCorrelationId();
      const auditEvent: AuditEvent = {
        ...event,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ...(correlationId && { correlationId }),
      };

      // Write to Cosmos DB (append-only)
      await this.dbService.createDocument(this.containerName, auditEvent);

      this.logger.info('Audit event logged', {
        action: event.action,
        resource: `${event.resource.type}:${event.resource.id}`,
        actor: event.actor.userId,
      });
    } catch (error) {
      // Critical: audit logging failure should be logged but not throw
      this.logger.error('Failed to log audit event', {
        error: error instanceof Error ? error.message : String(error),
        action: event.action,
        resource: event.resource,
      });
    }
  }

  // ===========================
  // ORDER AUDIT EVENTS
  // ===========================

  async logOrderCreated(
    actor: AuditEvent['actor'],
    orderId: string,
    orderData: Record<string, any>
  ): Promise<void> {
    await this.log({
      actor,
      action: 'order.created',
      resource: { type: 'order', id: orderId },
      after: orderData,
    });
  }

  async logOrderUpdated(
    actor: AuditEvent['actor'],
    orderId: string,
    before: Record<string, any>,
    after: Record<string, any>
  ): Promise<void> {
    const changes = this.calculateChanges(before, after);
    
    await this.log({
      actor,
      action: 'order.updated',
      resource: { type: 'order', id: orderId },
      before,
      after,
      changes,
    });
  }

  async logOrderAssigned(
    actor: AuditEvent['actor'],
    orderId: string,
    appraiserId: string,
    previousAppraiserId?: string
  ): Promise<void> {
    await this.log({
      actor,
      action: 'order.assigned',
      resource: { type: 'order', id: orderId },
      metadata: {
        newAppraiserId: appraiserId,
        previousAppraiserId,
      },
    });
  }

  async logOrderStatusChanged(
    actor: AuditEvent['actor'],
    orderId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    await this.log({
      actor,
      action: 'order.status_changed',
      resource: { type: 'order', id: orderId },
      changes: [{
        field: 'status',
        oldValue: oldStatus,
        newValue: newStatus,
      }],
    });
  }

  async logOrderDeleted(
    actor: AuditEvent['actor'],
    orderId: string,
    orderData: Record<string, any>
  ): Promise<void> {
    await this.log({
      actor,
      action: 'order.deleted',
      resource: { type: 'order', id: orderId },
      before: orderData,
    });
  }

  // ===========================
  // USER AUDIT EVENTS
  // ===========================

  async logUserLogin(
    actor: AuditEvent['actor'],
    success: boolean
  ): Promise<void> {
    await this.log({
      actor,
      action: success ? 'user.login.success' : 'user.login.failed',
      resource: { type: 'user', id: actor.userId },
    });
  }

  async logUserPermissionChanged(
    actor: AuditEvent['actor'],
    targetUserId: string,
    permissionsBefore: string[],
    permissionsAfter: string[]
  ): Promise<void> {
    await this.log({
      actor,
      action: 'user.permissions_changed',
      resource: { type: 'user', id: targetUserId },
      before: { permissions: permissionsBefore },
      after: { permissions: permissionsAfter },
    });
  }

  // ===========================
  // DOCUMENT AUDIT EVENTS
  // ===========================

  async logDocumentAccessed(
    actor: AuditEvent['actor'],
    documentId: string,
    documentName: string,
    action: 'view' | 'download'
  ): Promise<void> {
    await this.log({
      actor,
      action: `document.${action}`,
      resource: { type: 'document', id: documentId, name: documentName },
    });
  }

  async logDocumentUploaded(
    actor: AuditEvent['actor'],
    documentId: string,
    documentName: string,
    fileSize: number
  ): Promise<void> {
    await this.log({
      actor,
      action: 'document.uploaded',
      resource: { type: 'document', id: documentId, name: documentName },
      metadata: { fileSize },
    });
  }

  async logDocumentDeleted(
    actor: AuditEvent['actor'],
    documentId: string,
    documentName: string
  ): Promise<void> {
    await this.log({
      actor,
      action: 'document.deleted',
      resource: { type: 'document', id: documentId, name: documentName },
    });
  }

  // ===========================
  // QC AUDIT EVENTS
  // ===========================

  async logQCReviewCreated(
    actor: AuditEvent['actor'],
    reviewId: string,
    orderId: string
  ): Promise<void> {
    await this.log({
      actor,
      action: 'qc.review_created',
      resource: { type: 'qc_review', id: reviewId },
      metadata: { orderId },
    });
  }

  async logQCReviewCompleted(
    actor: AuditEvent['actor'],
    reviewId: string,
    result: 'pass' | 'fail',
    deficiencies: number
  ): Promise<void> {
    await this.log({
      actor,
      action: 'qc.review_completed',
      resource: { type: 'qc_review', id: reviewId },
      metadata: { result, deficiencies },
    });
  }

  // ===========================
  // QUERY METHODS
  // ===========================

  async getAuditTrail(
    resourceType: string,
    resourceId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<AuditEvent[]> {
    try {
      const query = `
        SELECT * FROM c 
        WHERE c.resource.type = @resourceType 
        AND c.resource.id = @resourceId
        ${options?.startDate ? 'AND c.timestamp >= @startDate' : ''}
        ${options?.endDate ? 'AND c.timestamp <= @endDate' : ''}
        ORDER BY c.timestamp DESC
        OFFSET 0 LIMIT @limit
      `;

      const parameters = [
        { name: '@resourceType', value: resourceType },
        { name: '@resourceId', value: resourceId },
        { name: '@limit', value: options?.limit || 100 },
      ];

      if (options?.startDate) {
        parameters.push({ name: '@startDate', value: options.startDate.toISOString() });
      }
      if (options?.endDate) {
        parameters.push({ name: '@endDate', value: options.endDate.toISOString() });
      }

      const result = await this.dbService.queryDocuments(this.containerName, query, parameters);
      return Array.isArray(result) ? result as AuditEvent[] : [];
    } catch (error) {
      this.logger.error('Failed to query audit trail', { error, resourceType, resourceId });
      return [];
    }
  }

  async getAuditsByActor(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<AuditEvent[]> {
    try {
      const query = `
        SELECT * FROM c 
        WHERE c.actor.userId = @userId
        ${options?.startDate ? 'AND c.timestamp >= @startDate' : ''}
        ${options?.endDate ? 'AND c.timestamp <= @endDate' : ''}
        ORDER BY c.timestamp DESC
        OFFSET 0 LIMIT @limit
      `;

      const parameters = [
        { name: '@userId', value: userId },
        { name: '@limit', value: options?.limit || 100 },
      ];

      if (options?.startDate) {
        parameters.push({ name: '@startDate', value: options.startDate.toISOString() });
      }
      if (options?.endDate) {
        parameters.push({ name: '@endDate', value: options.endDate.toISOString() });
      }

      const result = await this.dbService.queryDocuments(this.containerName, query, parameters);
      return Array.isArray(result) ? result as AuditEvent[] : [];
    } catch (error) {
      this.logger.error('Failed to query audit trail by actor', { error, userId });
      return [];
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  private calculateChanges(
    before: Record<string, any>,
    after: Record<string, any>
  ): Array<{ field: string; oldValue: any; newValue: any }> {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes.push({
          field: key,
          oldValue: before[key],
          newValue: after[key],
        });
      }
    }
    
    return changes;
  }
}
