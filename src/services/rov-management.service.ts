/**
 * ROV (Reconsideration of Value) Management Service
 * 
 * Handles the complete lifecycle of appraisal challenges:
 * - Request intake and validation
 * - Research and comparable analysis
 * - Response generation and delivery
 * - Compliance tracking and audit trail
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { AccessControlHelper } from './access-control-helper.service';
import { UniversalAIService } from './universal-ai.service.js';
import { ServiceBusEventPublisher } from './service-bus-publisher.js';
import { EventCategory, EventPriority, RovCreatedEvent, RovAssignedEvent, RovDecisionIssuedEvent } from '../types/events.js';
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
  ROVSLATracking,
  ROVAITriageResult,
} from '../types/rov.types.js';

/**
 * Valid ROV status transitions — enforced by isValidROVTransition().
 * Keys are the current status; values are the set of statuses reachable from it.
 */
const VALID_ROV_TRANSITIONS: Record<ROVStatus, ReadonlySet<ROVStatus>> = {
  [ROVStatus.SUBMITTED]:        new Set([ROVStatus.UNDER_REVIEW, ROVStatus.WITHDRAWN]),
  [ROVStatus.UNDER_REVIEW]:     new Set([ROVStatus.RESEARCHING, ROVStatus.ESCALATED, ROVStatus.WITHDRAWN]),
  [ROVStatus.RESEARCHING]:      new Set([ROVStatus.PENDING_RESPONSE, ROVStatus.ESCALATED, ROVStatus.WITHDRAWN]),
  [ROVStatus.PENDING_RESPONSE]: new Set([ROVStatus.RESPONDED, ROVStatus.ESCALATED]),
  [ROVStatus.RESPONDED]:        new Set([ROVStatus.ACCEPTED, ROVStatus.REJECTED]),
  [ROVStatus.ACCEPTED]:         new Set(),
  [ROVStatus.REJECTED]:         new Set(),
  [ROVStatus.WITHDRAWN]:        new Set(),
  [ROVStatus.ESCALATED]:        new Set([ROVStatus.UNDER_REVIEW, ROVStatus.RESPONDED]),
};

function isValidROVTransition(from: ROVStatus, to: ROVStatus): boolean {
  return VALID_ROV_TRANSITIONS[from]?.has(to) ?? false;
}

export class ROVManagementService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private accessControlHelper: AccessControlHelper;
  private aiService: UniversalAIService;
  private eventPublisher: ServiceBusEventPublisher;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.accessControlHelper = new AccessControlHelper();
    this.aiService = new UniversalAIService();
    this.eventPublisher = new ServiceBusEventPublisher();
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
        ...(input.engagementId ? { engagementId: input.engagementId } : {}),
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

      // Kick off AI triage asynchronously — result is persisted to internalNotes.
      // Fire-and-forget intentional: triage is advisory only and must not block submission.
      this.performAITriage(rovRequest.id, 'system').catch((err: unknown) => {
        this.logger.error('Background AI triage failed for ROV', {
          rovId: rovRequest.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      const createdEvent: RovCreatedEvent = {
        id: this.generateId(),
        version: '1.0',
        type: 'rov.created',
        category: EventCategory.ROV,
        timestamp: new Date(),
        source: 'rov-management.service',
        data: {
          rovId: rovRequest.id,
          orderId: rovRequest.orderId,
          tenantId: (order as any).tenantId || 'default',
          requestorType: rovRequest.requestorType as any,
          challengeReason: rovRequest.challengeReason as any,
          originalValue: rovRequest.originalAppraisalValue || 0,
          priority: EventPriority.HIGH
        }
      };
      await this.eventPublisher.publish(createdEvent).catch(err => 
        this.logger.error('Failed to emit rov.created event', { error: err })
      );

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

      if (!isValidROVTransition(rov.data.status, ROVStatus.UNDER_REVIEW)) {
        return { success: false, error: `Cannot assign ROV in ${rov.data.status} status` };
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
      
      if (result.success && result.data) {
        const assignedEvent: RovAssignedEvent = {
          id: this.generateId(),
          version: '1.0',
          type: 'rov.assigned',
          category: EventCategory.ROV,
          timestamp: new Date(),
          source: 'rov-management.service',
          data: {
            rovId: rovId,
            orderId: result.data.orderId,
            tenantId: (result.data as any).tenantId || 'default',
            assignedTo: assignedTo,
            priority: EventPriority.HIGH
          }
        };
        await this.eventPublisher.publish(assignedEvent).catch((err: unknown) => 
          this.logger.error('Failed to emit rov.assigned event', { error: err })
        );
      }

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

      // Allow research updates when UNDER_REVIEW → RESEARCHING (first time) or already RESEARCHING (subsequent)
      if (rov.data.status !== ROVStatus.RESEARCHING && !isValidROVTransition(rov.data.status, ROVStatus.RESEARCHING)) {
        return { success: false, error: `Cannot update research for ROV in ${rov.data.status} status` };
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

      const finalStatus = this.determineStatusFromDecision(input.decision);
      // The response may arrive from RESEARCHING or PENDING_RESPONSE via RESPONDED → terminal
      const intermediateTarget = ROVStatus.RESPONDED;
      if (rov.data.status !== intermediateTarget && !isValidROVTransition(rov.data.status, intermediateTarget)) {
        return { success: false, error: `Cannot submit response for ROV in ${rov.data.status} status` };
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

      if (result.success && result.data) {
        // Send notification to requestor
        this.logger.info('ROV response submitted', {
          rovId: input.rovId,
          decision: input.decision,
          valueChange: valueChangeAmount
        });

        let decisionType: 'upheld' | 'value_changed' | 'withdrawn' = 'upheld';
        if (input.decision === ROVDecision.VALUE_INCREASED || input.decision === ROVDecision.VALUE_DECREASED) {
          decisionType = 'value_changed';
        }

        const decisionEvent: RovDecisionIssuedEvent = {
          id: this.generateId(),
          version: '1.0',
          type: 'rov.decision.issued',
          category: EventCategory.ROV,
          timestamp: new Date(),
          source: 'rov-management.service',
          data: {
            rovId: input.rovId,
            orderId: result.data.orderId,
            tenantId: (result.data as any).tenantId || 'default',
            decision: decisionType,
            ...(newValue !== originalValue ? { updatedValue: newValue } : {}),
            decidedBy: respondedBy,
            priority: EventPriority.HIGH
          }
        };
        await this.eventPublisher.publish(decisionEvent).catch((err: unknown) => 
          this.logger.error('Failed to emit rov.decision.issued event', { error: err })
        );
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
   * Withdraw an ROV request. Requestor indicates they are no longer challenging the value.
   * Valid from: SUBMITTED, UNDER_REVIEW, RESEARCHING.
   */
  async withdrawROVRequest(
    rovId: string,
    withdrawnBy: string,
    reason: string,
  ): Promise<{ success: boolean; data?: ROVRequest; error?: string }> {
    try {
      const rov = await this.getROVById(rovId);
      if (!rov.success || !rov.data) return { success: false, error: 'ROV request not found' };

      if (!isValidROVTransition(rov.data.status, ROVStatus.WITHDRAWN)) {
        return { success: false, error: `Cannot withdraw ROV in ${rov.data.status} status` };
      }

      const updated: Partial<ROVRequest> = {
        status: ROVStatus.WITHDRAWN,
        updatedAt: new Date(),
        timeline: [
          ...rov.data.timeline,
          {
            id: this.generateId(),
            timestamp: new Date(),
            action: 'ROV_WITHDRAWN',
            performedBy: withdrawnBy,
            details: `ROV withdrawn: ${reason}`,
            metadata: { reason },
          },
        ],
      };

      return await this.dbService.updateROVRequest(rovId, updated);
    } catch (error) {
      this.logger.error('Error withdrawing ROV request', { error, rovId });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Escalate an ROV request to senior management / compliance.
   * Valid from: UNDER_REVIEW, RESEARCHING, PENDING_RESPONSE.
   */
  async escalateROVRequest(
    rovId: string,
    escalatedBy: string,
    reason: string,
  ): Promise<{ success: boolean; data?: ROVRequest; error?: string }> {
    try {
      const rov = await this.getROVById(rovId);
      if (!rov.success || !rov.data) return { success: false, error: 'ROV request not found' };

      if (!isValidROVTransition(rov.data.status, ROVStatus.ESCALATED)) {
        return { success: false, error: `Cannot escalate ROV in ${rov.data.status} status` };
      }

      const updated: Partial<ROVRequest> = {
        status: ROVStatus.ESCALATED,
        updatedAt: new Date(),
        complianceFlags: {
          ...rov.data.complianceFlags,
          regulatoryEscalation: true,
        },
        timeline: [
          ...rov.data.timeline,
          {
            id: this.generateId(),
            timestamp: new Date(),
            action: 'ROV_ESCALATED',
            performedBy: escalatedBy,
            details: `ROV escalated to senior management: ${reason}`,
            metadata: { reason },
          },
        ],
      };

      return await this.dbService.updateROVRequest(rovId, updated);
    } catch (error) {
      this.logger.error('Error escalating ROV request', { error, rovId });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update the SLA deadline (e.g. when a regulatory extension is granted).
   */
  async updateROVDeadline(
    rovId: string,
    newDueDate: Date,
    updatedBy: string,
  ): Promise<{ success: boolean; data?: ROVRequest; error?: string }> {
    try {
      const rov = await this.getROVById(rovId);
      if (!rov.success || !rov.data) return { success: false, error: 'ROV request not found' };

      const now = new Date();
      const daysUntilDue = now <= newDueDate
        ? this.calculateBusinessDays(now, newDueDate)
        : -this.calculateBusinessDays(newDueDate, now);

      const updatedSLA: ROVSLATracking = {
        ...rov.data.slaTracking,
        dueDate: newDueDate,
        isOverdue: now > newDueDate,
        daysUntilDue,
      };

      const previousDueDate = rov.data.slaTracking.dueDate;
      const updated: Partial<ROVRequest> = {
        slaTracking: updatedSLA,
        updatedAt: new Date(),
        timeline: [
          ...rov.data.timeline,
          {
            id: this.generateId(),
            timestamp: new Date(),
            action: 'DEADLINE_UPDATED',
            performedBy: updatedBy,
            details: `SLA deadline updated to ${newDueDate.toISOString()}`,
            metadata: { previousDueDate, newDueDate },
          },
        ],
      };

      return await this.dbService.updateROVRequest(rovId, updated);
    } catch (error) {
      this.logger.error('Error updating ROV deadline', { error, rovId });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
   * Perform AI-powered triage on a submitted ROV request.
   *
   * Uses UniversalAIService (Azure OpenAI / fallback) to:
   *   1. Analyse the challenge description and supporting evidence
   *   2. Assess prima-facie merit against the original appraisal value
   *   3. Identify the strongest comparable arguments
   *   4. Suggest priority and next-step evidence requests
   *
   * The analysis is persisted as an internalNotes block and a timeline entry.
   * It does NOT change the ROV status — assignment and review remain human decisions.
   *
   * @throws if the ROV is not found; AI errors are caught and returned in the result.
   */
  async performAITriage(
    rovId: string,
    requestedBy: string = 'system',
  ): Promise<{ success: boolean; analysis?: ROVAITriageResult; error?: string }> {
    const rov = await this.getROVById(rovId);
    if (!rov.success || !rov.data) {
      return { success: false, error: `ROV ${rovId} not found` };
    }

    const rovData = rov.data;
    this.logger.info('Starting AI triage for ROV', { rovId, rovNumber: rovData.rovNumber });

    const systemPrompt = `You are an expert in real estate appraisal reconsideration of value (ROV) disputes.
You analyze challenge requests on their technical merit against USPAP guidelines, market evidence, and comparable sales.
Return ONLY valid JSON matching the schema below — no markdown, no extra text.

Schema:
{
  "meritScore": <0–100, where 100 = overwhelming evidence for reconsideration>,
  "recommendedPriority": "NORMAL" | "HIGH" | "URGENT",
  "challengeMerit": "strong" | "moderate" | "weak" | "frivolous",
  "primaryChallengeIssues": [<string>, ...],
  "evidenceGaps": [<what additional evidence would strengthen the challenge>, ...],
  "suggestedComparableSearch": {
    "distanceMiles": <number>,
    "saleDateWindowMonths": <number>,
    "minSquareFeet": <number>,
    "maxSquareFeet": <number>,
    "requiredFeatures": [<string>, ...]
  },
  "complianceRisk": "none" | "low" | "medium" | "high",
  "complianceNotes": "<string or empty string>",
  "triageSummary": "<2–4 sentence plain-language summary for the reviewer>"
}`;

    const userPrompt = `ROV Request: ${rovData.rovNumber}
Property: ${rovData.propertyAddress}
Borrower: ${rovData.borrowerName ?? 'N/A'}
Challenge Reason: ${rovData.challengeReason}
Original Appraised Value: $${rovData.originalAppraisalValue.toLocaleString()}
Requested Value: ${rovData.requestedValue ? '$' + rovData.requestedValue.toLocaleString() : 'Not specified'}
Value Difference: ${rovData.requestedValue ? ((rovData.requestedValue - rovData.originalAppraisalValue) / rovData.originalAppraisalValue * 100).toFixed(1) + '%' : 'N/A'}

Challenge Description:
${rovData.challengeDescription}

Supporting Evidence Count: ${rovData.supportingEvidence.length}
Evidence Types: ${rovData.supportingEvidence.map(e => e.type).join(', ') || 'None provided'}

Existing Internal Notes: ${rovData.internalNotes || 'None'}`;

    let rawAnalysis: ROVAITriageResult;
    try {
      const aiResponse = await this.aiService.generateCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens: 1200,
        provider: 'auto',
      });

      const parsed = JSON.parse(aiResponse.content) as unknown;
      const validated = this.validateTriageResult(parsed);
      if (!validated.valid) {
        this.logger.error('ROV AI triage returned invalid schema', { rovId, error: validated.error });
        return { success: false, error: `AI triage schema error: ${validated.error}` };
      }
      rawAnalysis = validated.result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error('ROV AI triage failed', { rovId, error: errMsg });
      return { success: false, error: `AI triage failed: ${errMsg}` };
    }

    // Persist — append triage block to internalNotes + add timeline entry
    const triageBlock = `\n\n--- AI Triage (${new Date().toISOString()}) ---\n` +
      `Merit Score: ${rawAnalysis.meritScore}/100 | Challenge Merit: ${rawAnalysis.challengeMerit}\n` +
      `Recommended Priority: ${rawAnalysis.recommendedPriority}\n` +
      `Summary: ${rawAnalysis.triageSummary}\n` +
      (rawAnalysis.complianceNotes ? `Compliance: ${rawAnalysis.complianceNotes}\n` : '') +
      `Evidence Gaps: ${rawAnalysis.evidenceGaps.join('; ') || 'None identified'}`;

    const updatedNotes = (rovData.internalNotes || '') + triageBlock;

    const timelineEntry: ROVTimelineEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      action: 'AI_TRIAGE_COMPLETED',
      performedBy: requestedBy,
      details: `AI triage completed — merit score ${rawAnalysis.meritScore}/100 (${rawAnalysis.challengeMerit})`,
      metadata: { meritScore: rawAnalysis.meritScore, recommendedPriority: rawAnalysis.recommendedPriority },
    };

    // Update complianceFlags based on AI-detected compliance risk.
    // 'medium' or 'high' risk → flag for legal review.
    // 'high' risk → also flag for regulatory escalation.
    const existingFlags = rovData.complianceFlags ?? {
      possibleBias: false,
      discriminationClaim: false,
      regulatoryEscalation: false,
      legalReview: false,
    };
    const updatedComplianceFlags = {
      ...existingFlags,
      legalReview: existingFlags.legalReview ||
        rawAnalysis.complianceRisk === 'medium' ||
        rawAnalysis.complianceRisk === 'high',
      regulatoryEscalation: existingFlags.regulatoryEscalation ||
        rawAnalysis.complianceRisk === 'high',
    };

    await this.dbService.updateROVRequest(rovId, {
      internalNotes: updatedNotes,
      priority: rawAnalysis.recommendedPriority,
      complianceFlags: updatedComplianceFlags,
      timeline: [...rovData.timeline, timelineEntry],
      updatedAt: new Date(),
    });

    this.logger.info('ROV AI triage persisted', {
      rovId,
      meritScore: rawAnalysis.meritScore,
      recommendedPriority: rawAnalysis.recommendedPriority,
    });

    return { success: true, analysis: rawAnalysis };
  }

  /**
   * Helper: Validate the raw object returned by the AI against ROVAITriageResult schema.
   * LLMs can hallucinate missing fields or wrong types; we catch that here rather than
   * propagating garbage into the database.
   */
  private validateTriageResult(
    raw: unknown,
  ): { valid: true; result: ROVAITriageResult } | { valid: false; error: string } {
    if (typeof raw !== 'object' || raw === null) {
      return { valid: false, error: 'Expected JSON object, got ' + typeof raw };
    }

    const r = raw as Record<string, unknown>;

    if (typeof r.meritScore !== 'number' || r.meritScore < 0 || r.meritScore > 100) {
      return { valid: false, error: `meritScore must be a number 0–100, got ${r.meritScore}` };
    }
    if (!['NORMAL', 'HIGH', 'URGENT'].includes(r.recommendedPriority as string)) {
      return { valid: false, error: `Invalid recommendedPriority: ${r.recommendedPriority}` };
    }
    if (!['strong', 'moderate', 'weak', 'frivolous'].includes(r.challengeMerit as string)) {
      return { valid: false, error: `Invalid challengeMerit: ${r.challengeMerit}` };
    }
    if (!Array.isArray(r.primaryChallengeIssues)) {
      return { valid: false, error: 'primaryChallengeIssues must be an array' };
    }
    if (!Array.isArray(r.evidenceGaps)) {
      return { valid: false, error: 'evidenceGaps must be an array' };
    }
    if (typeof r.suggestedComparableSearch !== 'object' || r.suggestedComparableSearch === null) {
      return { valid: false, error: 'suggestedComparableSearch must be an object' };
    }
    if (!['none', 'low', 'medium', 'high'].includes(r.complianceRisk as string)) {
      return { valid: false, error: `Invalid complianceRisk: ${r.complianceRisk}` };
    }
    if (typeof r.complianceNotes !== 'string') {
      return { valid: false, error: 'complianceNotes must be a string' };
    }
    if (typeof r.triageSummary !== 'string' || r.triageSummary.trim() === '') {
      return { valid: false, error: 'triageSummary must be a non-empty string' };
    }

    return { valid: true, result: r as unknown as ROVAITriageResult };
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
