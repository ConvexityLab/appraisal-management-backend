/**
 * SLA Tracking Service
 * 
 * Monitors and enforces Service Level Agreements with:
 * - Real-time SLA status tracking
 * - Automatic breach detection and alerts
 * - SLA extension and waiver capabilities
 * - Performance metrics and reporting
 * - Integration with QC queue, revisions, and escalations
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { NotificationService } from './notification.service';
import { EscalationWorkflowService } from './escalation-workflow.service';
import {
  SLAConfiguration,
  SLATracking,
  SLAStatus,
  SLAMetrics,
  SLAAlert,
  ExtendSLARequest,
  WaiveSLARequest
} from '../types/qc-workflow.js';
import { EscalationType, EscalationPriority } from '../types/qc-workflow.js';

export class SLATrackingService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private notificationService: NotificationService;
  private escalationService: EscalationWorkflowService;

  // Default SLA configurations (in minutes)
  private defaultSLAs = {
    qcReview: 240, // 4 hours
    revisionTurnaround: 1440, // 24 hours
    escalationResponse: 120 // 2 hours
  };

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.notificationService = new NotificationService();
    this.escalationService = new EscalationWorkflowService();
  }

  // ===========================
  // SLA CONFIGURATION
  // ===========================

  /**
   * Create SLA configuration
   */
  async createSLAConfiguration(config: Omit<SLAConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<SLAConfiguration> {
    try {
      const slaConfig: SLAConfiguration = {
        ...config,
        id: `sla-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.dbService.createDocument('sla-configurations', slaConfig);

      this.logger.info('SLA configuration created', {
        configId: slaConfig.id,
        name: slaConfig.name
      });

      return slaConfig;

    } catch (error) {
      this.logger.error('Failed to create SLA configuration', { error, config });
      throw error;
    }
  }

  /**
   * Get applicable SLA configuration
   */
  async getSLAConfiguration(
    entityType: 'QC_REVIEW' | 'REVISION' | 'ESCALATION',
    clientId?: string,
    orderType?: string
  ): Promise<SLAConfiguration | null> {
    try {
      // Try to find client-specific config first
      if (clientId) {
        const container = this.dbService.getContainer('sla-configurations');
        const { resources } = await container.items
          .query({
            query: 'SELECT * FROM c WHERE c.clientId = @clientId AND c.active = true',
            parameters: [{ name: '@clientId', value: clientId }]
          })
          .fetchAll();

        if (resources.length > 0) {
          return resources[0] as SLAConfiguration;
        }
      }

      // Fall back to default config
      return this.getDefaultSLAConfig(entityType);

    } catch (error) {
      this.logger.error('Failed to get SLA configuration', { error, entityType, clientId });
      return this.getDefaultSLAConfig(entityType);
    }
  }

  private getDefaultSLAConfig(entityType: 'QC_REVIEW' | 'REVISION' | 'ESCALATION'): SLAConfiguration {
    const minutesMap = {
      QC_REVIEW: this.defaultSLAs.qcReview,
      REVISION: this.defaultSLAs.revisionTurnaround,
      ESCALATION: this.defaultSLAs.escalationResponse
    };

    return {
      id: 'default-sla-config',
      name: `Default ${entityType} SLA`,
      description: 'Default SLA configuration',
      qcReviewTime: this.defaultSLAs.qcReview,
      revisionTurnaround: this.defaultSLAs.revisionTurnaround,
      escalationResponse: this.defaultSLAs.escalationResponse,
      rushOrderMultiplier: 0.5,
      routineOrderMultiplier: 1.0,
      autoEscalateOnBreach: true,
      notifyOnAtRisk: true,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // ===========================
  // SLA TRACKING
  // ===========================

  /**
   * Start tracking SLA for an entity
   */
  async startSLATracking(
    entityType: 'QC_REVIEW' | 'REVISION' | 'ESCALATION',
    entityId: string,
    orderId: string,
    orderNumber: string,
    orderPriority: string = 'ROUTINE',
    clientId?: string
  ): Promise<SLATracking> {
    try {
      this.logger.info('Starting SLA tracking', {
        entityType,
        entityId,
        orderId
      });

      // Get applicable SLA configuration
      const config = await this.getSLAConfiguration(entityType, clientId);
      
      // Calculate target minutes based on entity type and priority
      const baseMinutes = this.getBaseMinutes(entityType, config);
      const priorityMultiplier = this.getPriorityMultiplier(orderPriority, config);
      const targetMinutes = Math.floor(baseMinutes * priorityMultiplier);
      
      const startTime = new Date();
      const targetDate = new Date(startTime.getTime() + targetMinutes * 60 * 1000);

      const tracking: SLATracking = {
        id: `sla-${entityType.toLowerCase()}-${entityId}`,
        entityType,
        entityId,
        orderId,
        orderNumber,
        slaConfigId: config?.id || 'default',
        targetMinutes,
        targetDate,
        status: SLAStatus.ON_TRACK,
        startTime,
        elapsedMinutes: 0,
        remainingMinutes: targetMinutes,
        percentComplete: 0,
        extended: false,
        waived: false,
        atRiskAlertSent: false,
        breachAlertSent: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.dbService.createDocument('sla-tracking', tracking);

      this.logger.info('SLA tracking started', {
        trackingId: tracking.id,
        targetDate,
        targetMinutes
      });

      return tracking;

    } catch (error) {
      this.logger.error('Failed to start SLA tracking', { error, entityType, entityId });
      throw error;
    }
  }

  /**
   * Update SLA tracking status
   */
  async updateSLAStatus(trackingId: string): Promise<SLATracking> {
    try {
      const tracking = await this.getSLATracking(trackingId);
      if (!tracking) {
        throw new Error('SLA tracking not found');
      }

      const now = Date.now();
      tracking.elapsedMinutes = Math.floor((now - tracking.startTime.getTime()) / (1000 * 60));
      tracking.remainingMinutes = Math.max(0, tracking.targetMinutes - tracking.elapsedMinutes);
      tracking.percentComplete = Math.min(100, (tracking.elapsedMinutes / tracking.targetMinutes) * 100);

      // Determine status
      if (tracking.waived) {
        tracking.status = SLAStatus.WAIVED;
      } else if (now > tracking.targetDate.getTime()) {
        tracking.status = SLAStatus.BREACHED;
        if (!tracking.breachedAt) {
          tracking.breachedAt = new Date();
          tracking.breachDuration = tracking.elapsedMinutes - tracking.targetMinutes;
          await this.handleSLABreach(tracking);
        }
      } else if (tracking.percentComplete >= 80) {
        tracking.status = SLAStatus.AT_RISK;
        if (!tracking.atRiskAlertSent) {
          await this.handleSLAAtRisk(tracking);
        }
      } else {
        tracking.status = SLAStatus.ON_TRACK;
      }

      tracking.updatedAt = new Date();
      await this.dbService.upsertDocument('sla-tracking', tracking);

      return tracking;

    } catch (error) {
      this.logger.error('Failed to update SLA status', { error, trackingId });
      throw error;
    }
  }

  /**
   * Complete SLA tracking
   */
  async completeSLATracking(trackingId: string): Promise<SLATracking> {
    try {
      const tracking = await this.updateSLAStatus(trackingId);
      tracking.endTime = new Date();
      tracking.updatedAt = new Date();

      await this.dbService.upsertDocument('sla-tracking', tracking);

      this.logger.info('SLA tracking completed', {
        trackingId,
        status: tracking.status,
        elapsedMinutes: tracking.elapsedMinutes,
        targetMinutes: tracking.targetMinutes
      });

      return tracking;

    } catch (error) {
      this.logger.error('Failed to complete SLA tracking', { error, trackingId });
      throw error;
    }
  }

  // ===========================
  // SLA BREACH HANDLING
  // ===========================

  /**
   * Handle SLA at-risk status (80% of time elapsed)
   */
  private async handleSLAAtRisk(tracking: SLATracking): Promise<void> {
    try {
      this.logger.warn('SLA at risk', {
        trackingId: tracking.id,
        entityType: tracking.entityType,
        orderId: tracking.orderId,
        percentComplete: tracking.percentComplete
      });

      // Send alert
      const alert = await this.createSLAAlert(
        tracking,
        'AT_RISK',
        `SLA at risk for ${tracking.entityType} ${tracking.entityId} (${tracking.percentComplete.toFixed(1)}% elapsed)`,
        'WARNING'
      );

      // Notify relevant parties
      await this.notificationService.sendEmail({
        to: '', // Would get from config
        subject: `SLA Alert: ${tracking.entityType} At Risk - Order ${tracking.orderNumber}`,
        body: `SLA is at risk for ${tracking.entityType} ${tracking.entityId}.\n\nElapsed: ${tracking.elapsedMinutes} minutes\nRemaining: ${tracking.remainingMinutes} minutes\nTarget: ${tracking.targetDate.toLocaleString()}`,
        templateId: 'sla-at-risk'
      });

      tracking.atRiskAlertSent = true;
      await this.dbService.upsertDocument('sla-tracking', tracking);

    } catch (error) {
      this.logger.error('Failed to handle SLA at-risk', { error, trackingId: tracking.id });
    }
  }

  /**
   * Handle SLA breach
   */
  private async handleSLABreach(tracking: SLATracking): Promise<void> {
    try {
      this.logger.error('SLA BREACHED', {
        trackingId: tracking.id,
        entityType: tracking.entityType,
        orderId: tracking.orderId,
        breachDuration: tracking.breachDuration
      });

      // Create alert
      const alert = await this.createSLAAlert(
        tracking,
        'BREACHED',
        `SLA BREACHED for ${tracking.entityType} ${tracking.entityId} (${tracking.breachDuration} minutes over)`,
        'CRITICAL'
      );

      // Send critical notification
      await this.notificationService.sendEmail({
        to: '', // Would get from config
        subject: `🚨 SLA BREACH: ${tracking.entityType} - Order ${tracking.orderNumber}`,
        body: `CRITICAL: SLA has been breached for ${tracking.entityType} ${tracking.entityId}.\n\nBreach Duration: ${tracking.breachDuration} minutes\nTarget Was: ${tracking.targetDate.toLocaleString()}\nOrder: ${tracking.orderNumber}`,
        templateId: 'sla-breached'
      });

      tracking.breachAlertSent = true;
      await this.dbService.upsertDocument('sla-tracking', tracking);

      // Auto-escalate if configured
      const config = await this.getSLAConfiguration(tracking.entityType);
      if (config?.autoEscalateOnBreach) {
        await this.autoEscalateSLABreach(tracking);
      }

    } catch (error) {
      this.logger.error('Failed to handle SLA breach', { error, trackingId: tracking.id });
    }
  }

  /**
   * Auto-escalate SLA breach
   */
  private async autoEscalateSLABreach(tracking: SLATracking): Promise<void> {
    try {
      const escalationRequest: any = {
        orderId: tracking.orderId,
        escalationType: EscalationType.SLA_BREACH,
        priority: EscalationPriority.HIGH,
        title: `SLA Breach: ${tracking.entityType} - Order ${tracking.orderNumber}`,
        description: `SLA has been breached for ${tracking.entityType} ${tracking.entityId}.\n\nTarget: ${tracking.targetDate.toLocaleString()}\nBreach Duration: ${tracking.breachDuration} minutes`,
        raisedBy: 'system'
      };
      
      if (tracking.entityType === 'QC_REVIEW') {
        escalationRequest.appraisalId = tracking.entityId;
      }
      
      await this.escalationService.createEscalation(escalationRequest);

      this.logger.info('SLA breach auto-escalated', {
        trackingId: tracking.id,
        orderId: tracking.orderId
      });

    } catch (error) {
      this.logger.error('Failed to auto-escalate SLA breach', { error });
    }
  }

  // ===========================
  // SLA EXTENSIONS & WAIVERS
  // ===========================

  /**
   * Extend SLA deadline
   */
  async extendSLA(request: ExtendSLARequest): Promise<SLATracking> {
    try {
      this.logger.info('Extending SLA', {
        trackingId: request.slaTrackingId,
        extensionMinutes: request.extensionMinutes
      });

      const tracking = await this.getSLATracking(request.slaTrackingId);
      if (!tracking) {
        throw new Error('SLA tracking not found');
      }

      tracking.extended = true;
      tracking.extensionReason = request.reason;
      tracking.extensionBy = request.extendedBy;
      tracking.extensionMinutes = request.extensionMinutes;
      tracking.targetMinutes += request.extensionMinutes;
      tracking.targetDate = new Date(tracking.targetDate.getTime() + request.extensionMinutes * 60 * 1000);
      tracking.status = SLAStatus.EXTENDED;
      tracking.updatedAt = new Date();

      await this.dbService.upsertDocument('sla-tracking', tracking);

      this.logger.info('SLA extended successfully', {
        trackingId: tracking.id,
        newTargetDate: tracking.targetDate
      });

      return tracking;

    } catch (error) {
      this.logger.error('Failed to extend SLA', { error, request });
      throw error;
    }
  }

  /**
   * Waive SLA
   */
  async waiveSLA(request: WaiveSLARequest): Promise<SLATracking> {
    try {
      this.logger.info('Waiving SLA', {
        trackingId: request.slaTrackingId,
        reason: request.reason
      });

      const tracking = await this.getSLATracking(request.slaTrackingId);
      if (!tracking) {
        throw new Error('SLA tracking not found');
      }

      tracking.waived = true;
      tracking.waiverReason = request.reason;
      tracking.waiverBy = request.waivedBy;
      tracking.status = SLAStatus.WAIVED;
      tracking.updatedAt = new Date();

      await this.dbService.upsertDocument('sla-tracking', tracking);

      this.logger.info('SLA waived successfully', {
        trackingId: tracking.id
      });

      return tracking;

    } catch (error) {
      this.logger.error('Failed to waive SLA', { error, request });
      throw error;
    }
  }

  // ===========================
  // ALERTS
  // ===========================

  /**
   * Create SLA alert
   */
  private async createSLAAlert(
    tracking: SLATracking,
    alertType: 'AT_RISK' | 'BREACHED' | 'EXTENDED',
    message: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
  ): Promise<SLAAlert> {
    try {
      const alert: SLAAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        alertType,
        slaTrackingId: tracking.id,
        orderId: tracking.orderId,
        orderNumber: tracking.orderNumber,
        entityType: tracking.entityType,
        message,
        severity,
        notifiedUsers: [],
        createdAt: new Date()
      };

      await this.dbService.createDocument('sla-alerts', alert);

      return alert;

    } catch (error) {
      this.logger.error('Failed to create SLA alert', { error });
      throw error;
    }
  }

  // ===========================
  // METRICS & REPORTING
  // ===========================

  /**
   * Get SLA metrics for period
   */
  async getSLAMetrics(
    period: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR',
    entityType?: 'QC_REVIEW' | 'REVISION' | 'ESCALATION'
  ): Promise<SLAMetrics> {
    try {
      const { startDate, endDate } = this.getPeriodDates(period);

      const container = this.dbService.getContainer('sla-tracking');
      let query = 'SELECT * FROM c WHERE c.startTime >= @start AND c.startTime <= @end';
      const parameters = [
        { name: '@start', value: startDate.toISOString() },
        { name: '@end', value: endDate.toISOString() }
      ];

      if (entityType) {
        query += ' AND c.entityType = @entityType';
        parameters.push({ name: '@entityType', value: entityType });
      }

      const { resources } = await container.items.query({ query, parameters }).fetchAll();
      const trackings = resources as SLATracking[];

      // Calculate metrics
      const onTrack = trackings.filter(t => t.status === SLAStatus.ON_TRACK).length;
      const atRisk = trackings.filter(t => t.status === SLAStatus.AT_RISK).length;
      const breached = trackings.filter(t => t.status === SLAStatus.BREACHED).length;
      const waived = trackings.filter(t => t.status === SLAStatus.WAIVED).length;

      const completed = trackings.filter(t => t.endTime);
      const avgCompletionTime = completed.length > 0
        ? completed.reduce((sum, t) => sum + t.elapsedMinutes, 0) / completed.length
        : 0;

      const onTimeCount = completed.filter(t => 
        t.status !== SLAStatus.BREACHED && !t.waived
      ).length;
      const onTimePercentage = completed.length > 0 
        ? (onTimeCount / completed.length) * 100 
        : 0;

      // Group by entity type
      const byEntityType: { [key: string]: any } = {};
      const entityTypes = [...new Set(trackings.map(t => t.entityType))];
      entityTypes.forEach(type => {
        const filtered = trackings.filter(t => t.entityType === type);
        const typeBreached = filtered.filter(t => t.status === SLAStatus.BREACHED).length;
        const typeCompleted = filtered.filter(t => t.endTime);
        const typeAvgTime = typeCompleted.length > 0
          ? typeCompleted.reduce((sum, t) => sum + t.elapsedMinutes, 0) / typeCompleted.length
          : 0;

        byEntityType[type] = {
          total: filtered.length,
          breached: typeBreached,
          averageTime: Math.floor(typeAvgTime)
        };
      });

      const metrics: SLAMetrics = {
        period,
        startDate,
        endDate,
        totalTracked: trackings.length,
        onTrack,
        atRisk,
        breached,
        waived,
        averageCompletionTime: Math.floor(avgCompletionTime),
        onTimePercentage: Math.round(onTimePercentage * 10) / 10,
        breachRate: trackings.length > 0 ? (breached / trackings.length) * 100 : 0,
        byEntityType,
        byPriority: {} // Would implement if priority tracked
      };

      return metrics;

    } catch (error) {
      this.logger.error('Failed to get SLA metrics', { error, period });
      throw error;
    }
  }

  // ===========================
  // BACKGROUND JOBS
  // ===========================

  /**
   * Check all active SLAs and update status
   */
  async checkActiveSLAs(): Promise<void> {
    try {
      const container = this.dbService.getContainer('sla-tracking');
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.endTime = null'
        })
        .fetchAll();

      const activeTrackings = resources as SLATracking[];

      for (const tracking of activeTrackings) {
        await this.updateSLAStatus(tracking.id);
      }

      this.logger.info('Active SLAs checked', {
        count: activeTrackings.length
      });

    } catch (error) {
      this.logger.error('Failed to check active SLAs', { error });
    }
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  private async getSLATracking(trackingId: string): Promise<SLATracking | null> {
    try {
      const result = await this.dbService.getDocument('sla-tracking', trackingId);
      return result as SLATracking;
    } catch {
      return null;
    }
  }

  private getBaseMinutes(
    entityType: 'QC_REVIEW' | 'REVISION' | 'ESCALATION',
    config: SLAConfiguration | null
  ): number {
    if (!config) {
      return this.defaultSLAs[entityType === 'QC_REVIEW' ? 'qcReview' : 
                               entityType === 'REVISION' ? 'revisionTurnaround' : 
                               'escalationResponse'];
    }

    const minutesMap = {
      QC_REVIEW: config.qcReviewTime,
      REVISION: config.revisionTurnaround,
      ESCALATION: config.escalationResponse
    };

    return minutesMap[entityType];
  }

  private getPriorityMultiplier(priority: string, config: SLAConfiguration | null): number {
    if (!config) {
      return priority === 'RUSH' || priority === 'EMERGENCY' ? 0.5 : 1.0;
    }

    if (priority === 'RUSH' || priority === 'EMERGENCY' || priority === 'EXPEDITED') {
      return config.rushOrderMultiplier;
    }

    return config.routineOrderMultiplier;
  }

  private getPeriodDates(period: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const endDate = now;
    let startDate: Date;

    switch (period) {
      case 'TODAY':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'WEEK':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'MONTH':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'QUARTER':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'YEAR':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    return { startDate, endDate };
  }
}
