/**
 * Review Assignment & Workflow Service
 * Manages review requests, assignments, stages, and workflow progression
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import {
  AppraisalReview,
  ReviewType,
  ReviewStatus,
  ReviewPriority,
  ReviewStage,
  ReviewFinding,
  ReviewNote,
  ReviewEscalation,
  SupplementalRequest,
  CreateReviewRequest,
  AssignReviewRequest,
  UpdateReviewRequest,
  ReviewListFilters,
  ReviewMetrics,
  ReviewerPerformance
} from '../types/review.types.js';

export class ReviewWorkflowService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Create a new appraisal review request
   */
  async createReview(request: CreateReviewRequest, tenantId: string, requestedBy: string): Promise<AppraisalReview> {
    this.logger.info('Creating appraisal review', { 
      orderId: request.orderId, 
      reviewType: request.reviewType 
    });

    const stages = this.initializeWorkflowStages(request.reviewType);

    const review: AppraisalReview = {
      id: this.generateReviewId(),
      tenantId,
      orderId: request.orderId,
      originalAppraisalId: request.originalAppraisalId,
      reviewType: request.reviewType,
      priority: request.priority,
      requestedBy,
      requestedAt: new Date(),
      requestReason: request.requestReason,
      assignmentMethod: request.assignToReviewer ? 'MANUAL' : 'AUTOMATIC',
      status: ReviewStatus.REQUESTED,
      currentStage: stages[0],
      stages,
      findings: [],
      originalValue: 0, // Will be populated from appraisal document
      supportingDocuments: [],
      reviewerNotes: [],
      escalations: [],
      supplementalRequests: [],
      dueDate: request.dueDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: requestedBy,
      updatedBy: requestedBy
    };

    // Auto-assign if reviewer specified
    if (request.assignToReviewer) {
      review.assignedTo = request.assignToReviewer;
      review.assignedAt = new Date();
      review.status = ReviewStatus.ASSIGNED;
    }

    await this.dbService.createReview(review);

    this.logger.info('Review created successfully', { reviewId: review.id });
    return review;
  }

  /**
   * Assign review to a reviewer
   */
  async assignReview(
    reviewId: string,
    assignment: AssignReviewRequest,
    assignedBy: string
  ): Promise<AppraisalReview> {
    this.logger.info('Assigning review', { reviewId, reviewerId: assignment.reviewerId });

    const review = await this.dbService.findReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    if (review.status !== ReviewStatus.REQUESTED) {
      throw new Error(`Cannot assign review in status: ${review.status}`);
    }

    const updates = {
      assignedTo: assignment.reviewerId,
      assignedAt: new Date(),
      assignmentMethod: assignment.assignmentMethod,
      status: ReviewStatus.ASSIGNED,
      updatedAt: new Date(),
      updatedBy: assignedBy
    };

    if (assignment.notes) {
      const note: ReviewNote = {
        id: this.generateId(),
        text: assignment.notes,
        category: 'ASSIGNMENT',
        isPrivate: true,
        createdBy: assignedBy,
        createdAt: new Date()
      };
      updates['reviewerNotes'] = [...review.reviewerNotes, note];
    }

    await this.dbService.updateReview(reviewId, updates);

    this.logger.info('Review assigned successfully', { 
      reviewId, 
      reviewerId: assignment.reviewerId 
    });

    return { ...review, ...updates };
  }

  /**
   * Auto-assign review based on workload and specialization
   */
  async autoAssignReview(reviewId: string): Promise<AppraisalReview> {
    this.logger.info('Auto-assigning review', { reviewId });

    const review = await this.dbService.findReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Get available reviewers
    const reviewers = await this.getAvailableReviewers(review.tenantId, review.reviewType);
    
    if (reviewers.length === 0) {
      throw new Error('No available reviewers found');
    }

    // Select best reviewer based on workload and performance
    const selectedReviewer = this.selectOptimalReviewer(reviewers, review);

    return this.assignReview(
      reviewId,
      {
        reviewerId: selectedReviewer.id,
        assignmentMethod: 'AUTOMATIC',
        notes: `Auto-assigned based on workload and specialization`
      },
      'SYSTEM'
    );
  }

  /**
   * Start review work
   */
  async startReview(reviewId: string, reviewerId: string): Promise<AppraisalReview> {
    this.logger.info('Starting review', { reviewId, reviewerId });

    const review = await this.dbService.findReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    if (review.assignedTo !== reviewerId) {
      throw new Error('Review not assigned to this reviewer');
    }

    if (review.status !== ReviewStatus.ASSIGNED) {
      throw new Error(`Cannot start review in status: ${review.status}`);
    }

    // Update current stage
    const stages = [...review.stages];
    stages[0] = {
      ...stages[0],
      status: 'IN_PROGRESS',
      startedAt: new Date()
    };

    const updates = {
      status: ReviewStatus.IN_PROGRESS,
      startedAt: new Date(),
      stages,
      currentStage: stages[0],
      updatedAt: new Date(),
      updatedBy: reviewerId
    };

    await this.dbService.updateReview(reviewId, updates);

    return { ...review, ...updates };
  }

  /**
   * Update review progress
   */
  async updateReview(
    reviewId: string,
    updates: UpdateReviewRequest,
    updatedBy: string
  ): Promise<AppraisalReview> {
    this.logger.info('Updating review', { reviewId });

    const review = await this.dbService.findReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    const updateData: any = {
      updatedAt: new Date(),
      updatedBy
    };

    if (updates.status) {
      updateData.status = updates.status;
      
      if (updates.status === ReviewStatus.COMPLETED && !review.completedAt) {
        updateData.completedAt = new Date();
        updateData.turnaroundTime = this.calculateTurnaroundTime(review.startedAt!, new Date());
      }
    }

    if (updates.outcome) {
      updateData.outcome = updates.outcome;
    }

    if (updates.reviewedValue !== undefined) {
      updateData.reviewedValue = updates.reviewedValue;
      updateData.valueAdjustment = updates.reviewedValue - review.originalValue;
      if (updates.valueAdjustmentReason) {
        updateData.valueAdjustmentReason = updates.valueAdjustmentReason;
      }
    }

    if (updates.findings) {
      updateData.findings = [...review.findings, ...updates.findings];
    }

    if (updates.notes) {
      const note: ReviewNote = {
        id: this.generateId(),
        text: updates.notes,
        isPrivate: false,
        createdBy: updatedBy,
        createdAt: new Date()
      };
      updateData.reviewerNotes = [...review.reviewerNotes, note];
    }

    await this.dbService.updateReview(reviewId, updateData);

    return { ...review, ...updateData };
  }

  /**
   * Advance to next workflow stage
   */
  async advanceStage(reviewId: string, userId: string): Promise<AppraisalReview> {
    this.logger.info('Advancing review stage', { reviewId });

    const review = await this.dbService.findReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    const currentStageIndex = review.stages.findIndex(s => s.order === review.currentStage.order);
    if (currentStageIndex === -1 || currentStageIndex === review.stages.length - 1) {
      throw new Error('No next stage available');
    }

    const stages = [...review.stages];
    
    // Complete current stage
    stages[currentStageIndex] = {
      ...stages[currentStageIndex],
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy: userId
    };

    // Start next stage
    const nextStageIndex = currentStageIndex + 1;
    stages[nextStageIndex] = {
      ...stages[nextStageIndex],
      status: 'IN_PROGRESS',
      startedAt: new Date()
    };

    const updates = {
      stages,
      currentStage: stages[nextStageIndex],
      updatedAt: new Date(),
      updatedBy: userId
    };

    await this.dbService.updateReview(reviewId, updates);

    return { ...review, ...updates };
  }

  /**
   * Add finding to review
   */
  async addFinding(
    reviewId: string,
    finding: Omit<ReviewFinding, 'id' | 'createdAt'>,
    userId: string
  ): Promise<AppraisalReview> {
    this.logger.info('Adding review finding', { reviewId, category: finding.category });

    const review = await this.dbService.findReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    const newFinding: ReviewFinding = {
      ...finding,
      id: this.generateId(),
      createdAt: new Date()
    };

    const updates = {
      findings: [...review.findings, newFinding],
      updatedAt: new Date(),
      updatedBy: userId
    };

    await this.dbService.updateReview(reviewId, updates);

    return { ...review, ...updates };
  }

  /**
   * Request supplemental information
   */
  async requestSupplemental(
    reviewId: string,
    request: Omit<SupplementalRequest, 'id' | 'requestedAt' | 'status'>,
    requestedBy: string
  ): Promise<AppraisalReview> {
    this.logger.info('Requesting supplemental information', { reviewId });

    const review = await this.dbService.findReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    const supplementalRequest: SupplementalRequest = {
      ...request,
      id: this.generateId(),
      requestedAt: new Date(),
      requestedBy,
      status: 'PENDING'
    };

    const updates = {
      supplementalRequests: [...review.supplementalRequests, supplementalRequest],
      status: ReviewStatus.PENDING_INFORMATION,
      updatedAt: new Date(),
      updatedBy: requestedBy
    };

    await this.dbService.updateReview(reviewId, updates);

    return { ...review, ...updates };
  }

  /**
   * Escalate review
   */
  async escalateReview(
    reviewId: string,
    reason: string,
    escalateTo: string,
    escalatedBy: string
  ): Promise<AppraisalReview> {
    this.logger.info('Escalating review', { reviewId, escalateTo });

    const review = await this.dbService.findReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    const escalation: ReviewEscalation = {
      id: this.generateId(),
      reason,
      escalatedTo,
      escalatedBy,
      escalatedAt: new Date()
    };

    const updates = {
      escalations: [...review.escalations, escalation],
      status: ReviewStatus.ESCALATED,
      updatedAt: new Date(),
      updatedBy: escalatedBy
    };

    await this.dbService.updateReview(reviewId, updates);

    return { ...review, ...updates };
  }

  /**
   * Complete review
   */
  async completeReview(
    reviewId: string,
    outcome: string,
    reviewedValue: number | undefined,
    userId: string
  ): Promise<AppraisalReview> {
    this.logger.info('Completing review', { reviewId, outcome });

    const review = await this.dbService.findReviewById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Complete all remaining stages
    const stages = review.stages.map(stage => ({
      ...stage,
      status: stage.status === 'PENDING' ? 'SKIPPED' as const : 
              stage.status === 'IN_PROGRESS' ? 'COMPLETED' as const : 
              stage.status,
      completedAt: stage.status === 'IN_PROGRESS' ? new Date() : stage.completedAt,
      completedBy: stage.status === 'IN_PROGRESS' ? userId : stage.completedBy
    }));

    const completedAt = new Date();
    const turnaroundTime = review.startedAt 
      ? this.calculateTurnaroundTime(review.startedAt, completedAt)
      : undefined;

    const updates: any = {
      status: ReviewStatus.COMPLETED,
      outcome,
      completedAt,
      turnaroundTime,
      stages,
      updatedAt: new Date(),
      updatedBy: userId
    };

    if (reviewedValue !== undefined) {
      updates.reviewedValue = reviewedValue;
      updates.valueAdjustment = reviewedValue - review.originalValue;
    }

    await this.dbService.updateReview(reviewId, updates);

    return { ...review, ...updates };
  }

  /**
   * Get review by ID
   */
  async getReviewById(reviewId: string): Promise<AppraisalReview | null> {
    return this.dbService.findReviewById(reviewId);
  }

  /**
   * List reviews with filters
   */
  async listReviews(
    tenantId: string,
    filters: ReviewListFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ reviews: AppraisalReview[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    const reviews = await this.dbService.findReviews(tenantId, filters, offset, limit);
    const total = await this.dbService.countReviews(tenantId, filters);

    return {
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get review metrics
   */
  async getReviewMetrics(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<ReviewMetrics> {
    const reviews = await this.dbService.findReviews(tenantId, { dateFrom, dateTo });

    const metrics: ReviewMetrics = {
      totalReviews: reviews.length,
      reviewsByStatus: this.aggregateByField(reviews, 'status'),
      reviewsByType: this.aggregateByField(reviews, 'reviewType'),
      reviewsByOutcome: this.aggregateByField(reviews.filter(r => r.outcome), 'outcome'),
      averageTurnaroundTime: this.calculateAverageTurnaround(reviews),
      onTimeCompletion: this.calculateOnTimeRate(reviews),
      valueAdjustmentRate: this.calculateAdjustmentRate(reviews),
      averageValueAdjustment: this.calculateAverageAdjustment(reviews)
    };

    return metrics;
  }

  /**
   * Get reviewer performance
   */
  async getReviewerPerformance(tenantId: string, reviewerId: string): Promise<ReviewerPerformance> {
    const reviews = await this.dbService.findReviews(tenantId, { assignedTo: reviewerId });
    const completed = reviews.filter(r => r.status === ReviewStatus.COMPLETED);

    return {
      reviewerId,
      reviewerName: 'Reviewer Name', // Would fetch from user service
      totalReviews: reviews.length,
      completedReviews: completed.length,
      averageTurnaroundTime: this.calculateAverageTurnaround(completed),
      onTimeRate: this.calculateOnTimeRate(completed),
      specializations: this.getReviewerSpecializations(reviews)
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private initializeWorkflowStages(reviewType: ReviewType): ReviewStage[] {
    const baseStages: ReviewStage[] = [
      { name: 'Document Review', status: 'PENDING', order: 1 },
      { name: 'Analysis', status: 'PENDING', order: 2 },
      { name: 'Findings Documentation', status: 'PENDING', order: 3 },
      { name: 'Report Preparation', status: 'PENDING', order: 4 }
    ];

    if (reviewType === ReviewType.FIELD_REVIEW) {
      baseStages.splice(2, 0, {
        name: 'Field Inspection',
        status: 'PENDING',
        order: 3
      });
      // Reorder subsequent stages
      baseStages.forEach((stage, index) => {
        if (stage.order >= 3 && stage.name !== 'Field Inspection') {
          stage.order = index + 1;
        }
      });
    }

    return baseStages;
  }

  private async getAvailableReviewers(tenantId: string, reviewType: ReviewType): Promise<any[]> {
    // In production, would query user service for reviewers
    // For now, return mock data
    return [
      { id: 'reviewer-1', name: 'John Reviewer', workload: 5, specializations: [reviewType] },
      { id: 'reviewer-2', name: 'Jane Reviewer', workload: 3, specializations: [reviewType] }
    ];
  }

  private selectOptimalReviewer(reviewers: any[], review: AppraisalReview): any {
    // Sort by workload (ascending) and prioritize those with matching specialization
    return reviewers.sort((a, b) => {
      const aHasSpecialization = a.specializations.includes(review.reviewType) ? -1 : 0;
      const bHasSpecialization = b.specializations.includes(review.reviewType) ? -1 : 0;
      
      if (aHasSpecialization !== bHasSpecialization) {
        return aHasSpecialization - bHasSpecialization;
      }
      
      return a.workload - b.workload;
    })[0];
  }

  private calculateTurnaroundTime(startDate: Date, endDate: Date): number {
    return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)); // Minutes
  }

  private aggregateByField(items: any[], field: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[field];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateAverageTurnaround(reviews: AppraisalReview[]): number {
    const completed = reviews.filter(r => r.turnaroundTime);
    if (completed.length === 0) return 0;
    
    const total = completed.reduce((sum, r) => sum + (r.turnaroundTime || 0), 0);
    return Math.round(total / completed.length / 60); // Convert to hours
  }

  private calculateOnTimeRate(reviews: AppraisalReview[]): number {
    const withDueDate = reviews.filter(r => r.dueDate && r.completedAt);
    if (withDueDate.length === 0) return 100;
    
    const onTime = withDueDate.filter(r => r.completedAt! <= r.dueDate!);
    return Math.round((onTime.length / withDueDate.length) * 100);
  }

  private calculateAdjustmentRate(reviews: AppraisalReview[]): number {
    const completed = reviews.filter(r => r.status === ReviewStatus.COMPLETED);
    if (completed.length === 0) return 0;
    
    const adjusted = completed.filter(r => r.valueAdjustment && r.valueAdjustment !== 0);
    return Math.round((adjusted.length / completed.length) * 100);
  }

  private calculateAverageAdjustment(reviews: AppraisalReview[]): number {
    const adjusted = reviews.filter(r => r.valueAdjustment && r.valueAdjustment !== 0);
    if (adjusted.length === 0) return 0;
    
    const total = adjusted.reduce((sum, r) => sum + Math.abs(r.valueAdjustment!), 0);
    return Math.round(total / adjusted.length);
  }

  private getReviewerSpecializations(reviews: AppraisalReview[]): ReviewType[] {
    const types = new Set(reviews.map(r => r.reviewType));
    return Array.from(types);
  }

  private generateReviewId(): string {
    return `REV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
