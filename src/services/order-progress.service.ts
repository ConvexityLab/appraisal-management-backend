/**
 * Order Progress Service
 * Tracks order progress through milestones and lifecycle stages
 */

import { Logger } from '../utils/logger';
import { CosmosDbService } from './cosmos-db.service';
import { ApiResponse } from '../types/index';
import {
  OrderStatus,
  MilestoneType,
  MilestoneStatus,
  OrderMilestone,
  OrderProgressUpdate,
  OrderTimeline,
  ProgressMetrics
} from '../types/order-progress.types';

export class OrderProgressService {
  private logger: Logger;
  private dbService: CosmosDbService;

  // Standard milestone sequence for typical appraisal workflow
  private readonly STANDARD_MILESTONE_SEQUENCE: MilestoneType[] = [
    'ASSIGNMENT',
    'ACCEPTANCE',
    'INSPECTION_SCHEDULED',
    'INSPECTION_COMPLETE',
    'DRAFT_SUBMISSION',
    'DRAFT_REVIEW',
    'FINAL_SUBMISSION',
    'FINAL_REVIEW',
    'APPROVAL',
    'DELIVERY',
    'COMPLETION'
  ];

  // Expected days for each milestone (configurable per tenant)
  private readonly DEFAULT_MILESTONE_DURATIONS: Record<MilestoneType, number> = {
    ASSIGNMENT: 1,
    ACCEPTANCE: 1,
    INSPECTION_SCHEDULED: 2,
    INSPECTION_COMPLETE: 3,
    DRAFT_SUBMISSION: 5,
    DRAFT_REVIEW: 2,
    REVISION_REQUEST: 2,
    FINAL_SUBMISSION: 2,
    FINAL_REVIEW: 1,
    APPROVAL: 1,
    DELIVERY: 0.5,
    COMPLETION: 0.5
  };

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Initialize milestones for a new order
   */
  async initializeOrderMilestones(
    orderId: string,
    tenantId: string,
    dueDate: Date,
    customSequence?: MilestoneType[]
  ): Promise<ApiResponse<OrderMilestone[]>> {
    try {
      this.logger.info('Initializing milestones for order', { orderId, tenantId });

      const sequence = customSequence || this.STANDARD_MILESTONE_SEQUENCE;
      const milestones: OrderMilestone[] = [];
      
      let currentDate = new Date();
      
      for (const type of sequence) {
        const duration = this.DEFAULT_MILESTONE_DURATIONS[type] || 1;
        const milestoneDate = new Date(currentDate);
        milestoneDate.setDate(milestoneDate.getDate() + duration);
        
        const milestone: OrderMilestone = {
          id: `milestone-${orderId}-${type}-${Date.now()}`,
          orderId,
          tenantId,
          type,
          status: 'PENDING',
          scheduledDate: milestoneDate,
          dueDate: type === 'COMPLETION' ? dueDate : milestoneDate,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        milestones.push(milestone);
        currentDate = milestoneDate;
      }

      // Save all milestones
      for (const milestone of milestones) {
        await this.dbService.createItem('milestones', milestone);
      }

      return {
        success: true,
        data: milestones
      };
    } catch (error) {
      this.logger.error('Error initializing order milestones', { orderId, error });
      throw error;
    }
  }

  /**
   * Update milestone status
   */
  async updateMilestone(
    milestoneId: string,
    status: MilestoneStatus,
    userId: string,
    tenantId: string,
    notes?: string
  ): Promise<ApiResponse<OrderMilestone>> {
    try {
      this.logger.info('Updating milestone', { milestoneId, status });

      const response = await this.dbService.getItem('milestones', milestoneId, tenantId) as ApiResponse<any>;
      const milestone = response.data;

      if (!milestone) {
        return {
          success: false,
          data: null as any,
          error: { code: 'MILESTONE_NOT_FOUND', message: 'Milestone not found', timestamp: new Date() }
        };
      }

      milestone.status = status;
      milestone.updatedAt = new Date();
      
      if (status === 'IN_PROGRESS' && !milestone.startedAt) {
        milestone.startedAt = new Date();
      }
      
      if (status === 'COMPLETED' && !milestone.completedAt) {
        milestone.completedAt = new Date();
        milestone.completedBy = userId;
      }
      
      if (notes) {
        milestone.notes = notes;
      }

      await this.dbService.updateItem('milestones', milestoneId, milestone, tenantId);

      // Create progress update
      await this.createProgressUpdate({
        orderId: milestone.orderId,
        tenantId,
        previousStatus: 'IN_PROGRESS' as OrderStatus,
        newStatus: 'IN_PROGRESS' as OrderStatus,
        milestoneType: milestone.type,
        milestoneId,
        updatedBy: userId,
        updateType: 'MILESTONE_COMPLETE',
        notes: notes || '',
        timestamp: new Date()
      });

      // If milestone completed, start next milestone
      if (status === 'COMPLETED') {
        await this.startNextMilestone(milestone.orderId, milestone.type, tenantId);
      }

      return {
        success: true,
        data: milestone
      };
    } catch (error) {
      this.logger.error('Error updating milestone', { milestoneId, error });
      throw error;
    }
  }

  /**
   * Start the next milestone in sequence
   */
  private async startNextMilestone(
    orderId: string,
    completedType: MilestoneType,
    tenantId: string
  ): Promise<void> {
    try {
      const currentIndex = this.STANDARD_MILESTONE_SEQUENCE.indexOf(completedType);
      if (currentIndex === -1 || currentIndex === this.STANDARD_MILESTONE_SEQUENCE.length - 1) {
        return; // No next milestone
      }

      const nextType = this.STANDARD_MILESTONE_SEQUENCE[currentIndex + 1];
      
      // Find and start next milestone
      const response = await this.dbService.queryItems(
        'milestones',
        'SELECT * FROM c WHERE c.orderId = @orderId AND c.type = @type',
        [
          { name: '@orderId', value: orderId },
          { name: '@type', value: nextType }
        ]
      ) as ApiResponse<any[]>;

      const milestones = response.data || [];
      
      if (milestones.length > 0) {
        const nextMilestone = milestones[0];
        nextMilestone.status = 'IN_PROGRESS';
        nextMilestone.startedAt = new Date();
        nextMilestone.updatedAt = new Date();
        
        await this.dbService.updateItem('milestones', nextMilestone.id, nextMilestone, tenantId);
      }
    } catch (error) {
      this.logger.error('Error starting next milestone', { orderId, completedType, error });
    }
  }

  /**
   * Update order status and create progress record
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string,
    tenantId: string,
    notes?: string,
    metadata?: Record<string, any>
  ): Promise<ApiResponse<any>> {
    try {
      this.logger.info('Updating order status', { orderId, newStatus });

      const response = await this.dbService.getItem('orders', orderId, tenantId) as ApiResponse<any>;
      const order = response.data;

      if (!order) {
        return {
          success: false,
          data: null,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found', timestamp: new Date() }
        };
      }

      const previousStatus = order.status;
      order.status = newStatus;
      order.updatedAt = new Date();
      
      if (metadata) {
        order.metadata = { ...order.metadata, ...metadata };
      }

      await this.dbService.updateItem('orders', orderId, order, tenantId);

      // Create progress update
      await this.createProgressUpdate({
        orderId,
        tenantId,
        previousStatus,
        newStatus,
        updatedBy: userId,
        updateType: 'STATUS_CHANGE',
        notes: notes || '',
        metadata: metadata || {},
        timestamp: new Date()
      });

      // Update related milestone
      await this.updateMilestoneForStatus(orderId, newStatus, userId, tenantId);

      return {
        success: true,
        data: {
          orderId,
          previousStatus,
          newStatus,
          updatedAt: order.updatedAt
        }
      };
    } catch (error) {
      this.logger.error('Error updating order status', { orderId, error });
      throw error;
    }
  }

  /**
   * Update milestone based on order status change
   */
  private async updateMilestoneForStatus(
    orderId: string,
    status: OrderStatus,
    userId: string,
    tenantId: string
  ): Promise<void> {
    try {
      const statusToMilestone: Partial<Record<OrderStatus, MilestoneType>> = {
        ASSIGNED: 'ASSIGNMENT',
        ACCEPTED: 'ACCEPTANCE',
        INSPECTION_SCHEDULED: 'INSPECTION_SCHEDULED',
        INSPECTION_COMPLETE: 'INSPECTION_COMPLETE',
        DRAFT_SUBMITTED: 'DRAFT_SUBMISSION',
        FINAL_SUBMITTED: 'FINAL_SUBMISSION',
        APPROVED: 'APPROVAL',
        DELIVERED: 'DELIVERY',
        COMPLETED: 'COMPLETION'
      };

      const milestoneType = statusToMilestone[status];
      if (!milestoneType) return;

      const response = await this.dbService.queryItems(
        'milestones',
        'SELECT * FROM c WHERE c.orderId = @orderId AND c.type = @type',
        [
          { name: '@orderId', value: orderId },
          { name: '@type', value: milestoneType }
        ]
      ) as ApiResponse<any[]>;

      const milestones = response.data || [];
      
      if (milestones.length > 0) {
        await this.updateMilestone(milestones[0].id, 'COMPLETED', userId, tenantId);
      }
    } catch (error) {
      this.logger.error('Error updating milestone for status', { orderId, status, error });
    }
  }

  /**
   * Create progress update record
   */
  private async createProgressUpdate(update: Omit<OrderProgressUpdate, 'id'>): Promise<void> {
    try {
      const progressUpdate: OrderProgressUpdate = {
        id: `progress-${update.orderId}-${Date.now()}`,
        ...update
      };

      await this.dbService.createItem('progressUpdates', progressUpdate);
    } catch (error) {
      this.logger.error('Error creating progress update', { error });
    }
  }

  /**
   * Get order milestones
   */
  async getOrderMilestones(
    orderId: string,
    tenantId: string
  ): Promise<ApiResponse<OrderMilestone[]>> {
    try {
      const response = await this.dbService.queryItems(
        'milestones',
        'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.scheduledDate',
        [{ name: '@orderId', value: orderId }]
      ) as ApiResponse<any[]>;

      return {
        success: true,
        data: response.data || []
      };
    } catch (error) {
      this.logger.error('Error getting order milestones', { orderId, error });
      throw error;
    }
  }

  /**
   * Get order timeline
   */
  async getOrderTimeline(
    orderId: string,
    tenantId: string
  ): Promise<ApiResponse<OrderTimeline>> {
    try {
      const response = await this.dbService.queryItems(
        'progressUpdates',
        'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.timestamp DESC',
        [{ name: '@orderId', value: orderId }]
      ) as ApiResponse<OrderProgressUpdate[]>;

      const updates = response.data || [];
      
      const timeline: OrderTimeline = {
        orderId,
        events: updates.map((update: OrderProgressUpdate) => {
          const eventTypeMap: Record<string, 'STATUS_CHANGE' | 'MILESTONE' | 'DOCUMENT_UPLOAD' | 'REVIEW' | 'COMMUNICATION' | 'NOTE'> = {
            'STATUS_CHANGE': 'STATUS_CHANGE',
            'MILESTONE_COMPLETE': 'MILESTONE',
            'NOTE_ADDED': 'NOTE',
            'FILE_UPLOADED': 'DOCUMENT_UPLOAD',
            'REVISION_REQUESTED': 'REVIEW'
          };
          
          return {
            id: update.id,
            timestamp: update.timestamp,
            eventType: eventTypeMap[update.updateType] || 'NOTE',
            actor: update.updatedBy,
            actorRole: 'VENDOR', // TODO: Get from user profile
            description: this.formatEventDescription(update),
            ...(update.metadata && { metadata: update.metadata })
          };
        })
      };

      return {
        success: true,
        data: timeline
      };
    } catch (error) {
      this.logger.error('Error getting order timeline', { orderId, error });
      throw error;
    }
  }

  /**
   * Calculate progress metrics
   */
  async calculateProgressMetrics(
    orderId: string,
    tenantId: string
  ): Promise<ApiResponse<ProgressMetrics>> {
    try {
      const orderResponse = await this.dbService.getItem('orders', orderId, tenantId) as ApiResponse<any>;
      const order = orderResponse.data;

      if (!order) {
        return {
          success: false,
          data: null as any,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found', timestamp: new Date() }
        };
      }

      const milestonesResponse = await this.getOrderMilestones(orderId, tenantId);
      const milestones = milestonesResponse.data || [];

      const totalMilestones = milestones.length;
      const completedMilestones = milestones.filter((m: any) => m.status === 'COMPLETED').length;
      const pendingMilestones = milestones.filter((m: any) => m.status === 'PENDING' || m.status === 'IN_PROGRESS').length;

      const overallCompletion = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

      const now = new Date();
      const createdDate = new Date(order.createdAt);
      const dueDate = new Date(order.dueDate);
      
      const daysElapsed = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const totalDays = Math.floor((dueDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedCompletion = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
      
      const isOnTrack = overallCompletion >= expectedCompletion;
      const isAtRisk = daysRemaining < 2 && overallCompletion < 80;

      const metrics: ProgressMetrics = {
        orderId,
        overallCompletion,
        currentPhase: order.status,
        totalMilestones,
        completedMilestones,
        pendingMilestones,
        daysElapsed,
        daysRemaining,
        estimatedCompletionDate: this.estimateCompletionDate(milestones, order.dueDate),
        onTimePercentage: isOnTrack ? 100 : (overallCompletion / expectedCompletion) * 100,
        revisionCount: 0, // TODO: Get from revision requests
        averageReviewTime: 0, // TODO: Calculate from review milestones
        documentCompleteness: 0, // TODO: Calculate from documents
        isOnTrack,
        isAtRisk,
        riskFactors: this.identifyRiskFactors(milestones, order, isAtRisk)
      };

      return {
        success: true,
        data: metrics
      };
    } catch (error) {
      this.logger.error('Error calculating progress metrics', { orderId, error });
      throw error;
    }
  }

  /**
   * Estimate completion date based on milestone progress
   */
  private estimateCompletionDate(milestones: OrderMilestone[], originalDueDate: Date): Date {
    const pendingMilestones = milestones.filter(m => m.status === 'PENDING' || m.status === 'IN_PROGRESS');
    
    if (pendingMilestones.length === 0) {
      return new Date(); // Already complete
    }

    let estimatedDays = 0;
    for (const milestone of pendingMilestones) {
      const duration = this.DEFAULT_MILESTONE_DURATIONS[milestone.type] || 1;
      estimatedDays += duration;
    }

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);

    return estimatedDate;
  }

  /**
   * Identify risk factors for order
   */
  private identifyRiskFactors(milestones: OrderMilestone[], order: any, isAtRisk: boolean): string[] {
    const risks: string[] = [];

    if (isAtRisk) {
      risks.push('Order is behind schedule');
    }

    const now = new Date();
    const overdueMilestones = milestones.filter(m => 
      m.status !== 'COMPLETED' && m.dueDate && new Date(m.dueDate) < now
    );

    if (overdueMilestones.length > 0) {
      risks.push(`${overdueMilestones.length} milestone(s) overdue`);
    }

    const blockedMilestones = milestones.filter(m => m.blockedBy && m.blockedBy.length > 0);
    if (blockedMilestones.length > 0) {
      risks.push(`${blockedMilestones.length} milestone(s) blocked`);
    }

    return risks;
  }

  /**
   * Format event description for timeline
   */
  private formatEventDescription(update: OrderProgressUpdate): string {
    const eventTypeMap: Record<string, string> = {
      'STATUS_CHANGE': 'STATUS_CHANGE',
      'MILESTONE_COMPLETE': 'MILESTONE',
      'NOTE_ADDED': 'NOTE',
      'FILE_UPLOADED': 'DOCUMENT_UPLOAD',
      'REVISION_REQUESTED': 'REVIEW'
    };
    
    switch (update.updateType) {
      case 'STATUS_CHANGE':
        return `Status changed from ${update.previousStatus} to ${update.newStatus}`;
      case 'MILESTONE_COMPLETE':
        return `Milestone completed: ${update.milestoneType}`;
      case 'NOTE_ADDED':
        return `Note added: ${update.notes}`;
      case 'FILE_UPLOADED':
        return `File uploaded: ${update.fileIds?.length || 0} file(s)`;
      case 'REVISION_REQUESTED':
        return `Revision requested: ${update.notes}`;
      default:
        return `Update: ${update.updateType}`;
    }
  }
}





