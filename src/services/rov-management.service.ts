/**
 * ROV (Reconsideration of Value) Management Service
 * 
 * Handles the complete lifecycle of appraisal challenges:
 * - Request intake and validation
 * - Research and comparable analysis
 * - Response generation and delivery
 * - Compliance tracking and audit trail
 */

import { Logger } from '../utils/logger';
import { CosmosDbService } from './cosmos-db.service';
import { AccessControlHelper } from './access-control-helper.service';
import {
  ROVRequest,
  ROVStatus,
  ROVDecision,
  ROVTimelineEntry,
  ROVComparable,
  ROVResearch,
  ROVResponse,
  ROVResponseTemplate,
  ROVMetrics,
  ROVFilters,
  CreateROVRequestInput,
  UpdateROVResearchInput,
  SubmitROVResponseInput,
  ROVListResponse,
  ROVSLATracking
} from '../types/rov.types';

export class ROVManagementService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private accessControlHelper: AccessControlHelper;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.accessControlHelper = new AccessControlHelper();
  }

  /**
   * Create a new ROV request
   */
  async createROVRequest(
    input: CreateROVRequestInput,
    createdBy: string,
    tenantId: string
  ): Promise<{ success: boolean; data?: ROVRequest; error?: string }> {
    try {
      this.logger.info('Creating new ROV request', { orderId: input.orderId, createdBy });

      // Fetch original order to get property and appraisal details
      const orderResult = await this.dbService.findOrderById(input.orderId);
      if (!orderResult.success || !orderResult.data) {
        return { success: false, error: 'Order not found' };
      }

      const order = orderResult.data;
      const rovNumber = await this.generateROVNumber();

      // Calculate SLA tracking (default: 10 business days)
      const submittedAt = new Date();
      const slaTracking = this.calculateSLATracking(submittedAt, 10);

      const rovRequest: ROVRequest = {
        id: this.generateId(),
        rovNumber,
        orderId: input.orderId,
        propertyAddress: `${order.propertyAddress.streetAddress}, ${order.propertyAddress.city}, ${order.propertyAddress.state} ${order.propertyAddress.zipCode}`,
        ...(order.loanInformation?.loanAmount ? { loanNumber: order.loanInformation.loanAmount.toString() } : {}),
        borrowerName: `${order.borrowerInformation.firstName} ${order.borrowerInformation.lastName}`,
        
        status: ROVStatus.SUBMITTED,
        requestorType: input.requestorType,
        requestorName: input.requestorName,
        requestorEmail: input.requestorEmail,
        ...(input.requestorPhone ? { requestorPhone: input.requestorPhone } : {}),
        
        challengeReason: input.challengeReason,
        challengeDescription: input.challengeDescription,
        originalAppraisalValue: input.originalAppraisalValue || 0,
        ...(input.requestedValue ? { requestedValue: input.requestedValue } : {}),
        supportingEvidence: (input.supportingEvidence || []).map(ev => ({
          ...ev,
          id: this.generateId(),
          uploadedAt: new Date(),
          uploadedBy: createdBy
        })),
        
        timeline: [
          {
            id: this.generateId(),
            timestamp: submittedAt,
            action: 'ROV_SUBMITTED',
            performedBy: createdBy,
            performedByEmail: input.requestorEmail,
            details: `ROV request submitted by ${input.requestorName}`,
            metadata: { requestorType: input.requestorType }
          }
        ],
        
        slaTracking,
        
        priority: input.priority || 'NORMAL',
        tags: [],
        internalNotes: '',
        
        complianceFlags: {
          possibleBias: input.challengeReason === 'BIAS_DISCRIMINATION',
          discriminationClaim: input.challengeReason === 'BIAS_DISCRIMINATION',
          regulatoryEscalation: false,
          legalReview: false
        },
        
        accessControl: this.accessControlHelper.createAccessControl({
          ownerId: createdBy,
          ...(order.clientId ? { clientId: order.clientId } : {}),
          tenantId,
          visibilityScope: 'TEAM'
        }),
        
        createdAt: submittedAt,
        updatedAt: submittedAt,
        submittedAt
      };

      // Save to database
      const result = await this.dbService.createROVRequest(rovRequest);
      
      if (!result.success) {
        return { success: false, error: result.error || 'Failed to create ROV request' };
      }

      this.logger.info('ROV request created successfully', { rovId: rovRequest.id, rovNumber });

      return { success: true, data: rovRequest };
    } catch (error) {
      this.logger.error('Error creating ROV request', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Assign ROV request to a team member
   */
  async assignROVRequest(
    rovId: string,
    assignedTo: string,
    assignedToEmail: string,
    assignedBy: string
  ): Promise<{ success: boolean; data?: ROVRequest; error?: string }> {
    try {
      const rov = await this.getROVById(rovId);
      if (!rov.success || !rov.data) {
        return { success: false, error: 'ROV request not found' };
      }

      const updated: Partial<ROVRequest> = {
        assignedTo,
        assignedToEmail,
        assignedAt: new Date(),
        status: ROVStatus.UNDER_REVIEW,
        updatedAt: new Date(),
        timeline: [
          ...rov.data.timeline,
          {
            id: this.generateId(),
            timestamp: new Date(),
            action: 'ROV_ASSIGNED',
            performedBy: assignedBy,
            details: `ROV assigned to ${assignedToEmail}`,
            metadata: { assignedTo, assignedToEmail }
          }
        ]
      };

      const result = await this.dbService.updateROVRequest(rovId, updated);
      return result;
    } catch (error) {
      this.logger.error('Error assigning ROV request', { error, rovId });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update ROV research data
   */
  async updateROVResearch(
    input: UpdateROVResearchInput,
    updatedBy: string
  ): Promise<{ success: boolean; data?: ROVRequest; error?: string }> {
    try {
      const rov = await this.getROVById(input.rovId);
      if (!rov.success || !rov.data) {
        return { success: false, error: 'ROV request not found' };
      }

      const updated: Partial<ROVRequest> = {
        research: {
          ...rov.data.research,
          ...input.research,
          researchCompletedBy: updatedBy,
          researchCompletedAt: new Date()
        } as ROVResearch,
        status: ROVStatus.RESEARCHING,
        internalNotes: input.internalNotes || rov.data.internalNotes,
        updatedAt: new Date(),
        timeline: [
          ...rov.data.timeline,
          {
            id: this.generateId(),
            timestamp: new Date(),
            action: 'RESEARCH_UPDATED',
            performedBy: updatedBy,
            details: 'ROV research data updated',
            metadata: { comparablesCount: input.research.comparables?.length }
          }
        ]
      };

      const result = await this.dbService.updateROVRequest(input.rovId, updated);
      return result;
    } catch (error) {
      this.logger.error('Error updating ROV research', { error, rovId: input.rovId });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Submit ROV response
   */
  async submitROVResponse(
    input: SubmitROVResponseInput,
    respondedBy: string,
    respondedByEmail: string
  ): Promise<{ success: boolean; data?: ROVRequest; error?: string }> {
    try {
      const rov = await this.getROVById(input.rovId);
      if (!rov.success || !rov.data) {
        return { success: false, error: 'ROV request not found' };
      }

      const originalValue = rov.data.originalAppraisalValue;
      const newValue = input.newValue || originalValue;
      const valueChangeAmount = newValue - originalValue;
      const valueChangePercentage = (valueChangeAmount / originalValue) * 100;

      const response: ROVResponse = {
        decision: input.decision,
        ...(input.decision === ROVDecision.VALUE_INCREASED || input.decision === ROVDecision.VALUE_DECREASED
          ? { newValue }
          : {}),
        valueChangeAmount: input.decision !== ROVDecision.VALUE_UNCHANGED ? valueChangeAmount : 0,
        valueChangePercentage: input.decision !== ROVDecision.VALUE_UNCHANGED ? valueChangePercentage : 0,
        explanation: input.explanation,
        supportingRationale: input.supportingRationale,
        comparablesUsed: input.comparablesUsed,
        responseDate: new Date(),
        respondedBy,
        deliveryMethod: input.deliveryMethod
      };

      const finalStatus = this.determineStatusFromDecision(input.decision);

      const updated: Partial<ROVRequest> = {
        response,
        status: finalStatus,
        completedAt: new Date(),
        updatedAt: new Date(),
        timeline: [
          ...rov.data.timeline,
          {
            id: this.generateId(),
            timestamp: new Date(),
            action: 'RESPONSE_SUBMITTED',
            performedBy: respondedBy,
            performedByEmail: respondedByEmail,
            details: `ROV response submitted: ${input.decision}`,
            metadata: { 
              decision: input.decision, 
              valueChange: valueChangeAmount,
              deliveryMethod: input.deliveryMethod
            }
          }
        ]
      };

      const result = await this.dbService.updateROVRequest(input.rovId, updated);
      
      if (result.success) {
        // TODO: Send notification to requestor
        this.logger.info('ROV response submitted', { 
          rovId: input.rovId, 
          decision: input.decision,
          valueChange: valueChangeAmount 
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Error submitting ROV response', { error, rovId: input.rovId });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get ROV request by ID
   */
  async getROVById(rovId: string): Promise<{ success: boolean; data?: ROVRequest; error?: string }> {
    try {
      const result = await this.dbService.findROVRequestById(rovId);
      return result;
    } catch (error) {
      this.logger.error('Error fetching ROV request', { error, rovId });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * List ROV requests with filters and pagination
   */
  async listROVRequests(
    filters: ROVFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<ROVListResponse> {
    try {
      const result = await this.dbService.findROVRequests(filters, (page - 1) * limit, limit);
      
      if (!result.success) {
        return { data: [], total: 0, page, limit, hasMore: false };
      }

      return {
        data: result.data || [],
        total: result.total || 0,
        page,
        limit,
        hasMore: ((result.total || 0) > page * limit)
      };
    } catch (error) {
      this.logger.error('Error listing ROV requests', { error, filters });
      return { data: [], total: 0, page, limit, hasMore: false };
    }
  }

  /**
   * Get ROV metrics for reporting
   */
  async getROVMetrics(
    startDate: Date,
    endDate: Date,
    filters?: Partial<ROVFilters>
  ): Promise<ROVMetrics> {
    try {
      const result = await this.dbService.getROVMetrics(startDate, endDate, filters);
      return result;
    } catch (error) {
      this.logger.error('Error fetching ROV metrics', { error });
      throw error;
    }
  }

  /**
   * Helper: Calculate SLA tracking
   */
  private calculateSLATracking(submittedAt: Date, targetDays: number): ROVSLATracking {
    const now = new Date();
    const dueDate = this.addBusinessDays(submittedAt, targetDays);
    const businessDaysElapsed = this.calculateBusinessDays(submittedAt, now);
    const daysUntilDue = targetDays - businessDaysElapsed;
    const isOverdue = daysUntilDue < 0;

    const escalationWarnings = [];
    if (businessDaysElapsed >= targetDays * 0.75) {
      escalationWarnings.push({
        level: 'WARNING' as const,
        message: 'Approaching SLA deadline',
        triggeredAt: now
      });
    }
    if (isOverdue) {
      escalationWarnings.push({
        level: 'CRITICAL' as const,
        message: 'SLA deadline exceeded',
        triggeredAt: now
      });
    }

    return {
      submittedAt,
      dueDate,
      responseTargetDays: targetDays,
      businessDaysElapsed,
      isOverdue,
      daysUntilDue,
      escalationWarnings
    };
  }

  /**
   * Helper: Add business days to a date
   */
  private addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;
    
    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }
    
    return result;
  }

  /**
   * Helper: Calculate business days between two dates
   */
  private calculateBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // Not weekend
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  /**
   * Helper: Determine final status from decision
   */
  private determineStatusFromDecision(decision: ROVDecision): ROVStatus {
    switch (decision) {
      case ROVDecision.VALUE_INCREASED:
      case ROVDecision.VALUE_DECREASED:
        return ROVStatus.ACCEPTED;
      case ROVDecision.VALUE_UNCHANGED:
        return ROVStatus.REJECTED;
      case ROVDecision.REQUIRES_NEW_APPRAISAL:
        return ROVStatus.ESCALATED;
      default:
        return ROVStatus.RESPONDED;
    }
  }

  /**
   * Helper: Generate ROV number
   */
  private async generateROVNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.dbService.getROVCountForYear(year);
    return `ROV-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Helper: Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
