/**
 * QC Review Queue Service
 * 
 * Manages the queue of appraisals awaiting QC review with:
 * - Intelligent priority scoring
 * - Analyst assignment and workload balancing
 * - SLA tracking integration
 * - Real-time queue management
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import {
  QCReviewQueueItem,
  QCReviewStatus,
  QCPriorityLevel,
  QCAnalystWorkload,
  QCPriorityScoreFactors,
  QCReviewQueueSearchCriteria
} from '../types/qc-workflow.js';

export interface QueueStatistics {
  total: number;
  pending: number;
  inReview: number;
  completed: number;
  breached: number;
  averageWaitTime: number; // minutes
  longestWaitTime: number; // minutes
  byPriority: {
    [key: string]: number;
  };
}

export class QCReviewQueueService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private dbInitialized: boolean = false;
  
  // In-memory analyst cache (would be DB in production)
  private analysts: Map<string, QCAnalystWorkload> = new Map();

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDbInitialized(): Promise<void> {
    if (!this.dbInitialized) {
      await this.dbService.initialize();
      this.dbInitialized = true;
    }
  }

  // ===========================
  // QUEUE MANAGEMENT
  // ===========================

  /**
   * Add appraisal to QC review queue
   */
  async addToQueue(orderData: {
    orderId: string;
    orderNumber: string;
    appraisalId: string;
    propertyAddress: string;
    appraisedValue: number;
    orderPriority: string;
    clientId: string;
    clientName: string;
    vendorId: string;
    vendorName: string;
    submittedAt?: Date;
  }): Promise<QCReviewQueueItem> {
    
    try {
      this.logger.info('Adding appraisal to QC review queue', {
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber
      });

      // Calculate priority score
      const priorityFactors = await this.calculatePriorityScore(orderData);
      const priorityLevel = this.determinePriorityLevel(priorityFactors.orderPriority);

      // Calculate SLA target
      const slaTargetDate = this.calculateSLATarget(
        orderData.orderPriority,
        orderData.submittedAt || new Date()
      );

      const queueItem: QCReviewQueueItem = {
        id: `qc-queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        orderId: orderData.orderId,
        orderNumber: orderData.orderNumber,
        appraisalId: orderData.appraisalId,
        priorityLevel,
        priorityScore: this.sumPriorityFactors(priorityFactors),
        status: QCReviewStatus.PENDING,
        submittedAt: orderData.submittedAt || new Date(),
        propertyAddress: orderData.propertyAddress,
        appraisedValue: orderData.appraisedValue,
        orderPriority: orderData.orderPriority,
        clientId: orderData.clientId,
        clientName: orderData.clientName,
        vendorId: orderData.vendorId,
        vendorName: orderData.vendorName,
        slaTargetDate,
        slaBreached: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in database
      await this.dbService.createDocument('qc-reviews', queueItem);

      this.logger.info('Appraisal added to QC queue successfully', {
        queueItemId: queueItem.id,
        priorityScore: queueItem.priorityScore,
        priorityLevel: queueItem.priorityLevel,
        slaTarget: slaTargetDate
      });

      return queueItem;

    } catch (error) {
      this.logger.error('Failed to add appraisal to QC queue', { error, orderData });
      throw error;
    }
  }

  /**
   * Get next review for analyst (intelligent assignment)
   */
  async getNextReview(analystId: string): Promise<QCReviewQueueItem | null> {
    try {
      this.logger.info('Getting next review for analyst', { analystId });

      // Check analyst workload
      const workload = await this.getAnalystWorkload(analystId);
      
      if (workload.totalActiveReviews >= workload.maxConcurrentReviews) {
        this.logger.warn('Analyst at capacity', {
          analystId,
          currentLoad: workload.totalActiveReviews,
          maxCapacity: workload.maxConcurrentReviews
        });
        return null;
      }

      // Get highest priority pending item
      const pendingItems = await this.searchQueue({
        status: [QCReviewStatus.PENDING],
        limit: 10
      });

      if (pendingItems.length === 0) {
        return null;
      }

      // Sort by priority score (descending)
      const sortedItems = pendingItems.sort((a, b) => b.priorityScore - a.priorityScore);
      const nextItem = sortedItems[0];

      // Assign to analyst
      if (nextItem) {
        await this.assignReview(nextItem.id, analystId);
        return await this.getQueueItem(nextItem.id);
      }

      return null;

    } catch (error) {
      this.logger.error('Failed to get next review', { error, analystId });
      throw error;
    }
  }

  /**
   * Assign review to analyst
   */
  async assignReview(queueItemId: string, analystId: string, notes?: string): Promise<QCReviewQueueItem> {
    try {
      this.logger.info('Assigning QC review', { queueItemId, analystId });

      const queueItem = await this.getQueueItem(queueItemId);
      if (!queueItem) {
        throw new Error('Queue item not found');
      }

      if (queueItem.status !== QCReviewStatus.PENDING) {
        throw new Error(`Cannot assign review in ${queueItem.status} status`);
      }

      // Get analyst info
      const workload = await this.getAnalystWorkload(analystId);

      // Update queue item
      queueItem.assignedAnalystId = analystId;
      queueItem.assignedAnalystName = workload.analystName;
      queueItem.assignedAt = new Date();
      queueItem.status = QCReviewStatus.IN_REVIEW;
      queueItem.startedAt = new Date();
      queueItem.updatedAt = new Date();

      await this.dbService.upsertDocument('qc-reviews', queueItem);

      this.logger.info('QC review assigned successfully', {
        queueItemId,
        analystId,
        analystName: workload.analystName
      });

      return queueItem;

    } catch (error) {
      this.logger.error('Failed to assign QC review', { error, queueItemId, analystId });
      throw error;
    }
  }

  /**
   * Complete review and remove from queue
   */
  async completeReview(queueItemId: string, qcReportId: string): Promise<void> {
    try {
      this.logger.info('Completing QC review', { queueItemId, qcReportId });

      const queueItem = await this.getQueueItem(queueItemId);
      if (!queueItem) {
        throw new Error('Queue item not found');
      }

      queueItem.status = QCReviewStatus.COMPLETED;
      queueItem.completedAt = new Date();
      queueItem.updatedAt = new Date();

      await this.dbService.upsertDocument('qc-reviews', queueItem);

      this.logger.info('QC review completed', {
        queueItemId,
        duration: this.calculateDuration(queueItem.startedAt!, queueItem.completedAt)
      });

    } catch (error) {
      this.logger.error('Failed to complete QC review', { error, queueItemId });
      throw error;
    }
  }

  /**
   * Return a review to the queue (unassign analyst)
   * Phase 5.6
   */
  async returnToQueue(queueItemId: string, reason: string, returnedBy: string): Promise<QCReviewQueueItem> {
    try {
      this.logger.info('Returning QC review to queue', { queueItemId, reason, returnedBy });

      const queueItem = await this.getQueueItem(queueItemId);
      if (!queueItem) {
        throw new Error('Queue item not found');
      }

      if (queueItem.status !== QCReviewStatus.IN_REVIEW && queueItem.status !== QCReviewStatus.IN_PROGRESS) {
        throw new Error(`Cannot return review in ${queueItem.status} status to queue`);
      }

      const previousAnalyst = queueItem.assignedAnalystId;
      queueItem.assignedAnalystId = undefined as any;
      queueItem.assignedAnalystName = undefined as any;
      queueItem.assignedAt = undefined as any;
      queueItem.startedAt = undefined as any;
      queueItem.status = QCReviewStatus.PENDING;
      queueItem.updatedAt = new Date();
      (queueItem as any).returnedToQueueAt = new Date();
      (queueItem as any).returnReason = reason;
      (queueItem as any).returnedBy = returnedBy;
      (queueItem as any).previousAnalystId = previousAnalyst;

      await this.dbService.upsertDocument('qc-reviews', queueItem);

      this.logger.info('QC review returned to queue', { queueItemId, previousAnalyst, reason });
      return queueItem;

    } catch (error) {
      this.logger.error('Failed to return QC review to queue', { error, queueItemId });
      throw error;
    }
  }

  /**
   * Complete review with a decision (approve / reject / conditional)
   * Phase 5.7
   */
  async completeWithDecision(
    queueItemId: string,
    decision: {
      outcome: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
      reviewedBy: string;
      notes?: string;
      conditions?: string[];
      score?: number;
    }
  ): Promise<QCReviewQueueItem> {
    try {
      this.logger.info('Completing QC review with decision', { queueItemId, outcome: decision.outcome });

      const queueItem = await this.getQueueItem(queueItemId);
      if (!queueItem) {
        throw new Error('Queue item not found');
      }

      if (queueItem.status !== QCReviewStatus.IN_REVIEW && queueItem.status !== QCReviewStatus.IN_PROGRESS) {
        throw new Error(`Cannot complete review in ${queueItem.status} status`);
      }

      queueItem.completedAt = new Date();
      queueItem.updatedAt = new Date();

      // Map decision to final status
      if (decision.outcome === 'REJECTED') {
        queueItem.status = QCReviewStatus.REVISION_REQUESTED;
      } else {
        queueItem.status = QCReviewStatus.COMPLETED;
      }

      // Store decision details on the item
      (queueItem as any).decision = {
        outcome: decision.outcome,
        reviewedBy: decision.reviewedBy,
        notes: decision.notes,
        conditions: decision.conditions,
        score: decision.score,
        decidedAt: new Date(),
      };

      await this.dbService.upsertDocument('qc-reviews', queueItem);

      this.logger.info('QC review decision recorded', {
        queueItemId,
        outcome: decision.outcome,
        reviewedBy: decision.reviewedBy,
        duration: this.calculateDuration(queueItem.startedAt!, queueItem.completedAt),
      });

      return queueItem;

    } catch (error) {
      this.logger.error('Failed to complete QC review with decision', { error, queueItemId });
      throw error;
    }
  }

  // ===========================
  // PRIORITY SCORING
  // ===========================

  /**
   * Calculate priority score factors
   */
  private async calculatePriorityScore(orderData: any): Promise<QCPriorityScoreFactors> {
    // Factor 1: Order Age (0-25 points)
    const orderAge = this.calculateOrderAgeScore(orderData.submittedAt || new Date());

    // Factor 2: Order Value (0-20 points)
    const orderValue = this.calculateOrderValueScore(orderData.appraisedValue);

    // Factor 3: Order Priority (0-30 points)
    const orderPriority = this.calculateOrderPriorityScore(orderData.orderPriority);

    // Factor 4: Client Tier (0-15 points) - would come from client profile
    const clientTier = await this.getClientTierScore(orderData.clientId);

    // Factor 5: Vendor Risk Score (0-10 points) - based on past QC failures
    const vendorRiskScore = await this.getVendorRiskScore(orderData.vendorId);

    return {
      orderAge,
      orderValue,
      orderPriority,
      clientTier,
      vendorRiskScore
    };
  }

  /**
   * Order age scoring (older = higher priority)
   */
  private calculateOrderAgeScore(submittedAt: Date): number {
    const ageHours = (Date.now() - submittedAt.getTime()) / (1000 * 60 * 60);
    
    if (ageHours < 4) return 5; // < 4 hours
    if (ageHours < 8) return 10; // 4-8 hours
    if (ageHours < 24) return 15; // 8-24 hours
    if (ageHours < 48) return 20; // 1-2 days
    return 25; // > 2 days (max)
  }

  /**
   * Order value scoring (higher value = higher priority)
   */
  private calculateOrderValueScore(appraisedValue: number): number {
    if (appraisedValue >= 1000000) return 20; // $1M+
    if (appraisedValue >= 500000) return 15; // $500k-$1M
    if (appraisedValue >= 300000) return 10; // $300k-$500k
    if (appraisedValue >= 150000) return 5; // $150k-$300k
    return 0; // < $150k
  }

  /**
   * Order priority scoring
   */
  private calculateOrderPriorityScore(priority: string): number {
    const priorityMap: { [key: string]: number } = {
      'EMERGENCY': 30,
      'RUSH': 25,
      'EXPEDITED': 15,
      'ROUTINE': 10
    };
    return priorityMap[priority] || 10;
  }

  /**
   * Get client tier score (premium clients get priority)
   * Queries sla-configurations container to determine client tier.
   * Clients with custom SLA configs (enterprise/premium) score higher.
   */
  private async getClientTierScore(clientId: string): Promise<number> {
    try {
      const result = await this.dbService.queryItems<{ slaLevel?: string; clientTier?: string }>(
        'sla-configurations',
        'SELECT c.slaLevel, c.clientTier FROM c WHERE c.clientId = @clientId',
        [{ name: '@clientId', value: clientId }]
      );

      if (!result.success || !result.data || result.data.length === 0) {
        return 10; // Default tier score — no SLA config on record
      }

      const config = result.data[0];
      if (!config) {
        return 10;
      }
      const tier = (config.clientTier || config.slaLevel || '').toUpperCase();

      const tierScores: Record<string, number> = {
        ENTERPRISE: 15,
        PREMIUM: 15,
        STANDARD: 10,
        BASIC: 5
      };

      return tierScores[tier] ?? 10;
    } catch (error) {
      this.logger.error('Failed to look up client tier score, using default', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      });

      return 10;
    }
  }

  /**
   * Get vendor risk score (vendors with QC issues get more scrutiny)
   * Queries qc-reviews container for historical QC outcomes for this vendor.
   * Higher score = higher risk = higher priority for thorough review.
   */
  private async getVendorRiskScore(vendorId: string): Promise<number> {
    try {
      const result = await this.dbService.queryItems<{
        totalReviews: number;
        failedReviews: number;
      }>(
        'qc-reviews',
        `SELECT
           COUNT(1) AS totalReviews,
           COUNT(
             CASE WHEN c.results.decision = 'REJECTED'
                   OR c.results.decision = 'REVISION_REQUIRED'
             THEN 1 END
           ) AS failedReviews
         FROM c
         WHERE c.vendorId = @vendorId
           AND c.status = 'COMPLETED'`,
        [{ name: '@vendorId', value: vendorId }]
      );

      if (!result.success || !result.data || result.data.length === 0) {
        return 5; // Default moderate risk — no history available
      }

      const vendorStats = result.data[0];
      if (!vendorStats) {
        return 5;
      }
      const { totalReviews, failedReviews } = vendorStats;

      if (totalReviews === 0) {
        return 5; // No history — moderate default
      }

      const failureRate = failedReviews / totalReviews;

      // Map failure rate to 0-10 score
      // 0% failures → 0 (low risk, low priority)
      // 10% failures → 3
      // 25% failures → 5
      // 50%+ failures → 10 (high risk, high priority)
      if (failureRate >= 0.5) return 10;
      if (failureRate >= 0.35) return 8;
      if (failureRate >= 0.25) return 6;
      if (failureRate >= 0.15) return 4;
      if (failureRate >= 0.05) return 2;

      return 0;
    } catch (error) {
      this.logger.error('Failed to calculate vendor risk score, using default', {
        vendorId,
        error: error instanceof Error ? error.message : String(error)
      });

      return 5;
    }
  }

  /**
   * Sum priority factors
   */
  private sumPriorityFactors(factors: QCPriorityScoreFactors): number {
    return (
      factors.orderAge +
      factors.orderValue +
      factors.orderPriority +
      factors.clientTier +
      factors.vendorRiskScore
    );
  }

  /**
   * Determine priority level from score
   */
  private determinePriorityLevel(orderPriorityScore: number): QCPriorityLevel {
    if (orderPriorityScore >= 30) return QCPriorityLevel.CRITICAL;
    if (orderPriorityScore >= 25) return QCPriorityLevel.HIGH;
    if (orderPriorityScore >= 15) return QCPriorityLevel.MEDIUM;
    return QCPriorityLevel.LOW;
  }

  // ===========================
  // ANALYST WORKLOAD
  // ===========================

  /**
   * Get analyst workload and availability
   */
  async getAnalystWorkload(analystId: string): Promise<QCAnalystWorkload> {
    try {
      // Check cache first
      if (this.analysts.has(analystId)) {
        return this.analysts.get(analystId)!;
      }

      // Count active reviews
      const pendingReviews = await this.countReviews(analystId, [QCReviewStatus.PENDING]);
      const inProgressReviews = await this.countReviews(analystId, [QCReviewStatus.IN_REVIEW]);

      const workload: QCAnalystWorkload = {
        analystId,
        analystName: `Analyst ${analystId}`, // Would fetch from user service
        analystEmail: `analyst-${analystId}@example.com`,
        pendingReviews,
        inProgressReviews,
        totalActiveReviews: pendingReviews + inProgressReviews,
        maxConcurrentReviews: 10, // Configurable
        capacityUtilization: ((pendingReviews + inProgressReviews) / 10) * 100,
        averageReviewTime: 180, // Would calculate from history (180 min = 3 hours)
        completedToday: 0,
        completedThisWeek: 0,
        isAvailable: true
      };

      // Cache for 5 minutes
      this.analysts.set(analystId, workload);
      setTimeout(() => this.analysts.delete(analystId), 5 * 60 * 1000);

      return workload;

    } catch (error) {
      this.logger.error('Failed to get analyst workload', { error, analystId });
      throw error;
    }
  }

  /**
   * Get all analysts with workload
   */
  async getAllAnalystWorkloads(): Promise<QCAnalystWorkload[]> {
    // Would query user service for all QC analysts
    const analystIds = ['analyst-1', 'analyst-2', 'analyst-3']; // Placeholder
    
    const workloads = await Promise.all(
      analystIds.map(id => this.getAnalystWorkload(id))
    );

    return workloads.sort((a, b) => a.capacityUtilization - b.capacityUtilization);
  }

  /**
   * Auto-assign reviews to balance workload
   */
  async autoAssignReviews(): Promise<number> {
    try {
      this.logger.info('Starting auto-assignment process');

      // Get pending reviews
      const pendingReviews = await this.searchQueue({
        status: [QCReviewStatus.PENDING],
        limit: 50
      });

      if (pendingReviews.length === 0) {
        return 0;
      }

      // Get available analysts
      const analysts = await this.getAllAnalystWorkloads();
      const availableAnalysts = analysts.filter(a => 
        a.isAvailable && a.totalActiveReviews < a.maxConcurrentReviews
      );

      if (availableAnalysts.length === 0) {
        this.logger.warn('No available analysts for auto-assignment');
        return 0;
      }

      let assigned = 0;

      // Assign reviews to analysts with lowest workload
      for (const review of pendingReviews) {
        // Find analyst with lowest utilization
        const analyst = availableAnalysts.reduce((prev, curr) => 
          curr.capacityUtilization < prev.capacityUtilization ? curr : prev
        );

        if (analyst.totalActiveReviews < analyst.maxConcurrentReviews) {
          await this.assignReview(review.id, analyst.analystId);
          analyst.totalActiveReviews++;
          analyst.capacityUtilization = (analyst.totalActiveReviews / analyst.maxConcurrentReviews) * 100;
          assigned++;
        }
      }

      this.logger.info('Auto-assignment completed', { assigned });
      return assigned;

    } catch (error) {
      this.logger.error('Auto-assignment failed', { error });
      throw error;
    }
  }

  // ===========================
  // QUEUE QUERIES
  // ===========================

  /**
   * Search queue with criteria
   */
  async searchQueue(criteria: QCReviewQueueSearchCriteria): Promise<QCReviewQueueItem[]> {
    try {
      await this.ensureDbInitialized();
      const container = this.dbService.getContainer('qc-reviews');
      
      // Read all QC reviews and map to queue items
      const { resources } = await container.items.readAll().fetchAll();
      
      // Map QCReview to QCReviewQueueItem
      let queueItems = resources.map((review: any): QCReviewQueueItem => {
        const assignedAnalystId = review.reviewers?.[0]?.analystId;
        const assignedAnalystName = review.reviewers?.[0]?.analystName;
        const assignedAt = review.reviewers?.[0]?.assignedAt ? new Date(review.reviewers[0].assignedAt) : undefined;
        const startedAt = review.startedAt ? new Date(review.startedAt) : undefined;
        const completedAt = review.completedAt ? new Date(review.completedAt) : undefined;
        
        return {
          id: review.id,
          orderId: review.orderId,
          orderNumber: review.orderNumber || review.orderId,
          appraisalId: review.appraisalId || review.orderId,
          priorityLevel: review.priorityLevel,
          priorityScore: review.priorityScore || 0,
          ...(assignedAnalystId && { assignedAnalystId }),
          ...(assignedAnalystName && { assignedAnalystName }),
          ...(assignedAt && { assignedAt }),
          status: review.status,
          submittedAt: review.createdAt ? new Date(review.createdAt) : new Date(),
          ...(startedAt && { startedAt }),
          ...(completedAt && { completedAt }),
          updatedAt: review.updatedAt ? new Date(review.updatedAt) : new Date(),
          propertyAddress: review.propertyAddress || 'N/A',
          appraisedValue: review.appraisedValue || 0,
          orderPriority: review.priorityLevel,
          clientId: review.clientId || 'unknown',
          clientName: review.clientName || 'Unknown Client',
          vendorId: review.vendorId || 'unknown',
          vendorName: review.vendorName || 'Unknown Vendor',
          slaTargetDate: review.sla?.dueDate ? new Date(review.sla.dueDate) : new Date(),
          slaBreached: review.sla?.breached || false,
          createdAt: review.createdAt ? new Date(review.createdAt) : new Date()
        };
      });

      // Apply filters
      if (criteria.status) {
        queueItems = queueItems.filter(item => criteria.status!.includes(item.status));
      }

      if (criteria.priorityLevel) {
        queueItems = queueItems.filter(item => criteria.priorityLevel!.includes(item.priorityLevel));
      }

      if (criteria.assignedAnalystId) {
        queueItems = queueItems.filter(item => item.assignedAnalystId === criteria.assignedAnalystId);
      }

      if (criteria.slaBreached !== undefined) {
        queueItems = queueItems.filter(item => item.slaBreached === criteria.slaBreached);
      }

      if (criteria.minPriorityScore) {
        queueItems = queueItems.filter(item => item.priorityScore >= criteria.minPriorityScore!);
      }

      // Sort by priority score
      queueItems.sort((a, b) => b.priorityScore - a.priorityScore);

      // Apply pagination
      const offset = criteria.offset || 0;
      const limit = criteria.limit || 50;
      
      return queueItems.slice(offset, offset + limit);

    } catch (error) {
      this.logger.error('Queue search failed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        criteria 
      });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(): Promise<QueueStatistics> {
    try {
      const allItems = await this.searchQueue({ limit: 10000 });

      const stats: QueueStatistics = {
        total: allItems.length,
        pending: allItems.filter(i => i.status === QCReviewStatus.PENDING).length,
        inReview: allItems.filter(i => i.status === QCReviewStatus.IN_REVIEW).length,
        completed: allItems.filter(i => i.status === QCReviewStatus.COMPLETED).length,
        breached: allItems.filter(i => i.slaBreached).length,
        averageWaitTime: this.calculateAverageWaitTime(allItems),
        longestWaitTime: this.calculateLongestWaitTime(allItems),
        byPriority: {
          [QCPriorityLevel.CRITICAL]: allItems.filter(i => i.priorityLevel === QCPriorityLevel.CRITICAL).length,
          [QCPriorityLevel.HIGH]: allItems.filter(i => i.priorityLevel === QCPriorityLevel.HIGH).length,
          [QCPriorityLevel.MEDIUM]: allItems.filter(i => i.priorityLevel === QCPriorityLevel.MEDIUM).length,
          [QCPriorityLevel.LOW]: allItems.filter(i => i.priorityLevel === QCPriorityLevel.LOW).length
        }
      };

      return stats;

    } catch (error) {
      this.logger.error('Failed to get queue statistics', { error });
      throw error;
    }
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  /**
   * Update arbitrary metadata on a queue item (e.g., Axiom evaluation results).
   * Merges provided fields into the existing document.
   */
  async updateQueueItem(queueItemId: string | undefined, updates: Record<string, any>): Promise<void> {
    if (!queueItemId) return;
    try {
      await this.ensureDbInitialized();
      const item = await this.getQueueItem(queueItemId);
      if (!item) {
        this.logger.warn('Cannot update queue item — not found', { queueItemId });
        return;
      }
      Object.assign(item, updates, { updatedAt: new Date() });
      await this.dbService.upsertDocument('qc-reviews', item);
    } catch (error) {
      this.logger.error('Failed to update queue item', { queueItemId, error });
      throw error;
    }
  }

  private async getQueueItem(queueItemId: string): Promise<QCReviewQueueItem | null> {
    try {
      const result = await this.dbService.getDocument('qc-reviews', queueItemId);
      return result as QCReviewQueueItem;
    } catch {
      return null;
    }
  }

  private async countReviews(analystId: string, statuses: QCReviewStatus[]): Promise<number> {
    const items = await this.searchQueue({
      assignedAnalystId: analystId,
      status: statuses,
      limit: 1000
    });
    return items.length;
  }

  private calculateSLATarget(priority: string, submittedAt: Date): Date {
    const slaMinutes: { [key: string]: number } = {
      'EMERGENCY': 120, // 2 hours
      'RUSH': 240, // 4 hours
      'EXPEDITED': 480, // 8 hours
      'ROUTINE': 1440 // 24 hours
    };

    const minutes = slaMinutes[priority] || 1440;
    return new Date(submittedAt.getTime() + minutes * 60 * 1000);
  }

  private calculateDuration(startTime: Date, endTime: Date): number {
    return Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes
  }

  private calculateAverageWaitTime(items: QCReviewQueueItem[]): number {
    const pending = items.filter(i => i.status === QCReviewStatus.PENDING);
    if (pending.length === 0) return 0;

    const totalWait = pending.reduce((sum, item) => {
      return sum + (Date.now() - item.submittedAt.getTime()) / (1000 * 60);
    }, 0);

    return Math.floor(totalWait / pending.length);
  }

  private calculateLongestWaitTime(items: QCReviewQueueItem[]): number {
    const pending = items.filter(i => i.status === QCReviewStatus.PENDING);
    if (pending.length === 0) return 0;

    const waitTimes = pending.map(item => 
      (Date.now() - item.submittedAt.getTime()) / (1000 * 60)
    );

    return Math.floor(Math.max(...waitTimes));
  }
}
