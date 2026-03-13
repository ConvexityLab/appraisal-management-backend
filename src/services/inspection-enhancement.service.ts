/**
 * Inspection Enhancement Service (Phase 1.7)
 *
 * Adds borrower contact tracking and SLA enforcement on top of the existing
 * InspectionService. Tracks contact attempts with borrowers/tenants, enforces
 * scheduling SLA windows, and generates compliance reports.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type ContactMethod = 'PHONE' | 'EMAIL' | 'TEXT' | 'VOICEMAIL' | 'IN_PERSON';
export type ContactOutcome = 'CONNECTED' | 'LEFT_MESSAGE' | 'NO_ANSWER' | 'WRONG_NUMBER' | 'REFUSED' | 'SCHEDULED';

export interface BorrowerContactAttempt {
  id: string;
  inspectionId: string;
  orderId: string;
  tenantId: string;
  /** Who made the contact attempt */
  attemptedBy: string;
  attemptedAt: string;
  method: ContactMethod;
  outcome: ContactOutcome;
  /** Phone/email used */
  contactDetail?: string;
  notes?: string;
  /** If outcome=SCHEDULED, the agreed date/time */
  scheduledDate?: string;
}

export interface BorrowerContactLog {
  orderId: string;
  inspectionId: string;
  attempts: BorrowerContactAttempt[];
  totalAttempts: number;
  successfulContact: boolean;
  firstContactAt?: string;
  lastContactAt?: string;
  scheduledAt?: string;
}

// ── Access Constraints ───────────────────────────────────────────────────────

export interface PropertyAccessConstraints {
  id: string;
  orderId: string;
  inspectionId: string;
  tenantId: string;
  /** Whether property is in a gated community */
  gated: boolean;
  /** Lockbox details */
  lockbox: boolean;
  lockboxCode?: string;
  lockboxLocation?: string;
  /** Pets on property */
  pets: boolean;
  petDetails?: string;
  /** HOA coordination required */
  hoaRequired: boolean;
  hoaContactName?: string;
  hoaContactPhone?: string;
  hoaInstructions?: string;
  /** Elevator required (multi-story buildings) */
  elevatorRequired: boolean;
  elevatorDetails?: string;
  /** Gate or key code */
  gateCode?: string;
  /** Additional special instructions */
  specialInstructions?: string;
  /** Preferred inspection times */
  preferredTimes?: string;
  /** Occupancy status */
  occupancyStatus: 'OWNER_OCCUPIED' | 'TENANT_OCCUPIED' | 'VACANT' | 'UNKNOWN';
  updatedAt: string;
  updatedBy: string;
}

export type PropertyAccessConstraintsInput = Omit<PropertyAccessConstraints, 'id' | 'updatedAt'>;

export interface InspectionSLAConfig {
  /** Hours after assignment to make first contact attempt */
  firstContactDeadlineHours: number;
  /** Hours after assignment to schedule the inspection */
  schedulingDeadlineHours: number;
  /** Minimum contact attempts before escalation */
  minContactAttempts: number;
  /** Maximum days from assignment to completed inspection */
  maxInspectionDays: number;
}

export interface InspectionSLAStatus {
  orderId: string;
  inspectionId?: string;
  /** Hours since order assigned to vendor */
  hoursSinceAssignment: number;
  /** First contact attempt made? */
  firstContactMade: boolean;
  firstContactDeadlineMet: boolean;
  /** Inspection scheduled? */
  inspectionScheduled: boolean;
  schedulingDeadlineMet: boolean;
  /** Contact attempts count */
  contactAttemptCount: number;
  meetsMinContactRequirement: boolean;
  /** Overall SLA status */
  isCompliant: boolean;
  /** Violations */
  violations: string[];
}

// ── Service ──────────────────────────────────────────────────────────────────

export class InspectionEnhancementService {
  private logger: Logger;
  private dbService: CosmosDbService;

  static readonly DEFAULT_SLA: InspectionSLAConfig = {
    firstContactDeadlineHours: 4,
    schedulingDeadlineHours: 24,
    minContactAttempts: 3,
    maxInspectionDays: 7,
  };

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('InspectionEnhancementService');
  }

  /**
   * Record a borrower contact attempt for an inspection.
   */
  async recordContactAttempt(attempt: Omit<BorrowerContactAttempt, 'id'>): Promise<BorrowerContactAttempt> {
    const record: BorrowerContactAttempt = {
      ...attempt,
      id: `bca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      throw new Error('Database container not initialized');
    }

    await container.items.upsert({
      ...record,
      type: 'borrower-contact-attempt',
    });

    this.logger.info('Borrower contact attempt recorded', {
      inspectionId: attempt.inspectionId,
      method: attempt.method,
      outcome: attempt.outcome,
    });

    return record;
  }

  /**
   * Get all contact attempts for an inspection.
   */
  async getContactLog(inspectionId: string, tenantId: string): Promise<BorrowerContactLog> {
    const container = (this.dbService as any).ordersContainer;
    const attempts: BorrowerContactAttempt[] = [];

    if (container) {
      const { resources } = await container.items.query({
        query: `SELECT * FROM c WHERE c.type = 'borrower-contact-attempt' AND c.inspectionId = @iid AND c.tenantId = @tid ORDER BY c.attemptedAt ASC`,
        parameters: [
          { name: '@iid', value: inspectionId },
          { name: '@tid', value: tenantId },
        ],
      }).fetchAll();
      attempts.push(...(resources as BorrowerContactAttempt[]));
    }

    const successfulAttempt = attempts.find(a => a.outcome === 'CONNECTED' || a.outcome === 'SCHEDULED');
    const scheduledAttempt = attempts.find(a => a.outcome === 'SCHEDULED');

    return {
      orderId: attempts[0]?.orderId ?? '',
      inspectionId,
      attempts,
      totalAttempts: attempts.length,
      successfulContact: !!successfulAttempt,
      ...(attempts[0]?.attemptedAt !== undefined && { firstContactAt: attempts[0].attemptedAt }),
      ...(attempts[attempts.length - 1]?.attemptedAt !== undefined && { lastContactAt: attempts[attempts.length - 1]!.attemptedAt }),
      ...(scheduledAttempt?.scheduledDate !== undefined && { scheduledAt: scheduledAttempt.scheduledDate }),
    };
  }

  /**
   * Check inspection SLA compliance for an order.
   */
  async checkSLACompliance(
    orderId: string,
    tenantId: string,
    assignedAt: string,
    slaConfig?: Partial<InspectionSLAConfig>,
  ): Promise<InspectionSLAStatus> {
    const sla: InspectionSLAConfig = {
      ...InspectionEnhancementService.DEFAULT_SLA,
      ...slaConfig,
    };

    const assignedTime = new Date(assignedAt).getTime();
    const now = Date.now();
    const hoursSinceAssignment = (now - assignedTime) / (60 * 60 * 1000);

    // Get inspections for this order
    const container = (this.dbService as any).ordersContainer;
    let inspection: any = null;
    if (container) {
      const { resources } = await container.items.query({
        query: `SELECT * FROM c WHERE c.type = 'inspection' AND c.orderId = @oid AND c.tenantId = @tid`,
        parameters: [
          { name: '@oid', value: orderId },
          { name: '@tid', value: tenantId },
        ],
      }).fetchAll();
      inspection = resources[0] ?? null;
    }

    // Get contact log
    const emptyLog: BorrowerContactLog = { orderId: '', inspectionId: '', attempts: [], totalAttempts: 0, successfulContact: false };
    const contactLog = inspection
      ? await this.getContactLog(inspection.id, tenantId)
      : emptyLog;

    const violations: string[] = [];
    const firstContactMade = contactLog.totalAttempts > 0;
    const firstContactDeadlineMet = firstContactMade
      ? (new Date(contactLog.firstContactAt!).getTime() - assignedTime) / (60 * 60 * 1000) <= sla.firstContactDeadlineHours
      : hoursSinceAssignment <= sla.firstContactDeadlineHours;

    if (!firstContactDeadlineMet && !firstContactMade) {
      violations.push(`First contact not made within ${sla.firstContactDeadlineHours} hours of assignment`);
    }

    const inspectionScheduled = !!inspection && (inspection.status === 'scheduled' || inspection.status === 'confirmed');
    const schedulingDeadlineMet = inspectionScheduled
      ? true // already scheduled
      : hoursSinceAssignment <= sla.schedulingDeadlineHours;

    if (!schedulingDeadlineMet && !inspectionScheduled) {
      violations.push(`Inspection not scheduled within ${sla.schedulingDeadlineHours} hours of assignment`);
    }

    const meetsMinContactRequirement = contactLog.totalAttempts >= sla.minContactAttempts || contactLog.successfulContact;
    if (!meetsMinContactRequirement && hoursSinceAssignment > sla.schedulingDeadlineHours && !inspectionScheduled) {
      violations.push(`Only ${contactLog.totalAttempts} of ${sla.minContactAttempts} required contact attempts made`);
    }

    return {
      orderId,
      inspectionId: inspection?.id,
      hoursSinceAssignment: Math.round(hoursSinceAssignment * 10) / 10,
      firstContactMade,
      firstContactDeadlineMet,
      inspectionScheduled,
      schedulingDeadlineMet,
      contactAttemptCount: contactLog.totalAttempts,
      meetsMinContactRequirement,
      isCompliant: violations.length === 0,
      violations,
    };
  }

  // ── Access Constraint Methods ─────────────────────────────────────────────

  /**
   * Save or update property access constraints for an inspection.
   */
  async upsertAccessConstraints(input: PropertyAccessConstraintsInput): Promise<PropertyAccessConstraints> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) {
      throw new Error('Database container not initialized');
    }

    const record: PropertyAccessConstraints = {
      ...input,
      id: `pac-${input.orderId}-${input.inspectionId}`,
      updatedAt: new Date().toISOString(),
    };

    await container.items.upsert({
      ...record,
      type: 'property-access-constraints',
    });

    this.logger.info('Property access constraints saved', {
      orderId: input.orderId,
      inspectionId: input.inspectionId,
      gated: input.gated,
      lockbox: input.lockbox,
      pets: input.pets,
      hoaRequired: input.hoaRequired,
    });

    return record;
  }

  /**
   * Get property access constraints for an inspection.
   */
  async getAccessConstraints(orderId: string, inspectionId: string, tenantId: string): Promise<PropertyAccessConstraints | null> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return null;

    const { resources } = await container.items.query({
      query: `SELECT * FROM c WHERE c.type = 'property-access-constraints' AND c.orderId = @oid AND c.inspectionId = @iid AND c.tenantId = @tid`,
      parameters: [
        { name: '@oid', value: orderId },
        { name: '@iid', value: inspectionId },
        { name: '@tid', value: tenantId },
      ],
    }).fetchAll();

    return resources.length > 0 ? resources[0] as PropertyAccessConstraints : null;
  }

  /**
   * Get orders with inspection SLA violations for a tenant.
   */
  async getViolations(tenantId: string): Promise<InspectionSLAStatus[]> {
    const container = (this.dbService as any).ordersContainer;
    if (!container) return [];

    // Get all assigned orders that don't have completed inspections
    const { resources: orders } = await container.items.query({
      query: `SELECT c.id, c.assignedAt, c.tenantId FROM c WHERE c.type = 'order' AND c.tenantId = @tid AND c.status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'INSPECTION_SCHEDULED')`,
      parameters: [{ name: '@tid', value: tenantId }],
    }).fetchAll();

    const violations: InspectionSLAStatus[] = [];
    for (const order of orders) {
      if (!order.assignedAt) continue;
      const status = await this.checkSLACompliance(order.id, tenantId, order.assignedAt);
      if (!status.isCompliant) {
        violations.push(status);
      }
    }

    return violations;
  }
}
