/**
 * Construction Finance Module — Construction Loan Service
 *
 * Manages ConstructionLoan documents in the `construction-loans` Cosmos container.
 * Partition key: /tenantId
 *
 * Responsibilities:
 *   - CRUD for ConstructionLoan documents
 *   - Enforcing status transition rules (prevents invalid lifecycle moves)
 *   - Listing / filtering loans for portfolio views
 *
 * This service does NOT create Cosmos infrastructure — all containers must be
 * provisioned via Bicep before this service runs.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { PropertyRecordService } from './property-record.service.js';
import { Logger } from '../utils/logger.js';
import type {
  ConstructionLoan,
  ConstructionLoanStatus,
  ConstructionLoanType,
  LinkedOrder,
  LinkedOrderRole,
} from '../types/construction-loan.types.js';

export type { LinkedOrder, LinkedOrderRole };

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER = 'construction-loans';

// ─── Valid Status Transitions ─────────────────────────────────────────────────

/**
 * Allowed status transitions map.
 * Key: current status — Value: set of statuses that may follow.
 *
 * Includes IN_DEFAULT → ACTIVE to support workout / cure scenarios.
 */
const VALID_TRANSITIONS: Record<ConstructionLoanStatus, Set<ConstructionLoanStatus>> = {
  UNDERWRITING:           new Set(['APPROVED', 'CLOSED']),
  APPROVED:               new Set(['ACTIVE', 'CLOSED']),
  ACTIVE:                 new Set(['SUBSTANTIALLY_COMPLETE', 'IN_DEFAULT', 'CLOSED']),
  SUBSTANTIALLY_COMPLETE: new Set(['COMPLETED', 'IN_DEFAULT']),
  COMPLETED:              new Set(['CLOSED']),
  IN_DEFAULT:             new Set(['ACTIVE', 'CLOSED']),   // ACTIVE = cure / workout
  CLOSED:                 new Set(),                         // terminal state
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateConstructionLoanInput {
  tenantId: string;
  loanNumber: string;
  loanType: ConstructionLoanType;
  loanAmount: number;
  interestRate: number;
  maturityDate: string;
  interestReserveAmount: number;
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    county: string;
  };
  propertyType: string;
  borrowerId: string;
  borrowerName: string;
  expectedCompletionDate: string;
  retainagePercent: number;
  createdBy: string;
  constructionStartDate?: string;
  generalContractorId?: string;
  linkedOrders?: LinkedOrder[];
  /** @deprecated Pass linkedOrders instead. */
  orderId?: string;
  /** @deprecated Pass linkedOrders instead. */
  relatedAppraisalIds?: string[];
}

export interface LinkOrderInput {
  orderId: string;
  role: LinkedOrderRole;
  orderNumber?: string;
  orderStatus?: string;
  notes?: string;
}

export interface LoanListFilter {
  status?: ConstructionLoanStatus;
  loanType?: ConstructionLoanType;
}

// ─── ConstructionLoanService ──────────────────────────────────────────────────

export class ConstructionLoanService {
  private readonly logger = new Logger('ConstructionLoanService');

  constructor(
    private readonly cosmosService: CosmosDbService,
    private readonly propertyRecordService: PropertyRecordService,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private generateId(): string {
    return `loan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // ── getLoanById ──────────────────────────────────────────────────────────────

  /**
   * Retrieves a construction loan by ID.
   *
   * @throws if loanId or tenantId is empty
   * @throws if the loan is not found
   */
  async getLoanById(loanId: string, tenantId: string): Promise<ConstructionLoan> {
    if (!loanId) {
      throw new Error('ConstructionLoanService.getLoanById: loanId is required');
    }
    if (!tenantId) {
      throw new Error('ConstructionLoanService.getLoanById: tenantId is required');
    }

    const loan = await this.cosmosService.getDocument<ConstructionLoan>(CONTAINER, loanId, tenantId);

    if (!loan) {
      throw new Error(
        `ConstructionLoanService.getLoanById: construction loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    // Normalize: documents created before linkedOrders support won't have the field
    if (!loan.linkedOrders) {
      loan.linkedOrders = [];
    }

    return loan;
  }

  // ── createLoan ───────────────────────────────────────────────────────────────

  /**
   * Creates a new ConstructionLoan document in UNDERWRITING status.
   * The caller is responsible for creating the corresponding ConstructionBudget separately.
   * The budgetId on the created loan will be an empty string — update it after budget creation.
   */
  async createLoan(input: CreateConstructionLoanInput): Promise<ConstructionLoan> {
    const now = new Date().toISOString();
    const id = this.generateId();

    // Resolve canonical PropertyRecord from the supplied property address (Phase R2).
    const resolution = await this.propertyRecordService.resolveOrCreate({
      address: {
        street: input.propertyAddress.street,
        city: input.propertyAddress.city,
        state: input.propertyAddress.state,
        zip: input.propertyAddress.zipCode,
      },
      tenantId: input.tenantId,
      createdBy: input.createdBy,
    });

    const loan: ConstructionLoan = {
      id,
      tenantId: input.tenantId,
      propertyId: resolution.propertyId,
      loanNumber: input.loanNumber,
      loanType: input.loanType,
      status: 'UNDERWRITING',
      loanAmount: input.loanAmount,
      interestRate: input.interestRate,
      maturityDate: input.maturityDate,
      interestReserveAmount: input.interestReserveAmount,
      interestReserveDrawn: 0,
      propertyAddress: input.propertyAddress,
      propertyType: input.propertyType,
      borrowerId: input.borrowerId,
      borrowerName: input.borrowerName,
      ...(input.generalContractorId !== undefined && { generalContractorId: input.generalContractorId }),
      budgetId: '',   // Caller sets this after creating the ConstructionBudget
      totalDrawsApproved: 0,
      totalDrawsDisbursed: 0,
      percentComplete: 0,
      retainagePercent: input.retainagePercent,
      retainageHeld: 0,
      retainageReleased: 0,
      ...(input.constructionStartDate !== undefined && { constructionStartDate: input.constructionStartDate }),
      expectedCompletionDate: input.expectedCompletionDate,
      milestones: [],
      linkedOrders: input.linkedOrders ?? [],
      // migrate legacy single-link if caller still passes the deprecated fields
      ...(input.orderId !== undefined && { orderId: input.orderId }),
      relatedAppraisalIds: input.relatedAppraisalIds ?? [],
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.cosmosService.createDocument<ConstructionLoan>(CONTAINER, loan);

    this.logger.info('ConstructionLoan created', {
      loanId: created.id,
      tenantId: created.tenantId,
      loanType: created.loanType,
      createdBy: created.createdBy,
    });

    return created;
  }

  // ── updateLoanStatus ─────────────────────────────────────────────────────────

  /**
   * Advances or changes the loan's status, enforcing valid transition rules.
   *
   * @throws if the requested transition is not valid from the current status
   */
  async updateLoanStatus(
    loanId: string,
    tenantId: string,
    newStatus: ConstructionLoanStatus,
    updatedBy: string
  ): Promise<ConstructionLoan> {
    const loan = await this.getLoanById(loanId, tenantId);
    const allowed = VALID_TRANSITIONS[loan.status];

    if (!allowed.has(newStatus)) {
      throw new Error(
        `ConstructionLoanService.updateLoanStatus: invalid transition "${loan.status}" → "${newStatus}" ` +
        `for loan "${loanId}". Allowed transitions from ${loan.status}: [${[...allowed].join(', ') || 'none'}]`
      );
    }

    const updated: ConstructionLoan = {
      ...loan,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    const result = await this.cosmosService.upsertDocument<ConstructionLoan>(CONTAINER, updated);

    this.logger.info('ConstructionLoan status updated', {
      loanId,
      tenantId,
      fromStatus: loan.status,
      toStatus: newStatus,
      updatedBy,
    });

    return result;
  }

  // ── linkOrder ────────────────────────────────────────────────────────────────

  /**
   * Links an order to a construction loan.
   *
   * Idempotent: if an entry with the same orderId already exists it is replaced
   * (role or notes may have changed).
   *
   * @throws if loanId or tenantId is empty, or if the loan is not found
   */
  async linkOrder(
    loanId: string,
    tenantId: string,
    input: LinkOrderInput,
    linkedBy: string
  ): Promise<ConstructionLoan> {
    if (!loanId)   throw new Error('ConstructionLoanService.linkOrder: loanId is required');
    if (!tenantId) throw new Error('ConstructionLoanService.linkOrder: tenantId is required');
    if (!input.orderId) throw new Error('ConstructionLoanService.linkOrder: orderId is required');

    const loan = await this.getLoanById(loanId, tenantId);

    const newEntry: LinkedOrder = {
      orderId:     input.orderId,
      role:        input.role,
      ...(input.orderNumber  !== undefined && { orderNumber:  input.orderNumber }),
      ...(input.orderStatus  !== undefined && { orderStatus:  input.orderStatus }),
      ...(input.notes        !== undefined && { notes:        input.notes }),
      linkedAt: new Date().toISOString(),
      linkedBy,
    };

    // Replace existing entry for same orderId (idempotent)
    const existing = (loan.linkedOrders ?? []).filter(lo => lo.orderId !== input.orderId);

    const updated: ConstructionLoan = {
      ...loan,
      linkedOrders: [...existing, newEntry],
      updatedAt: new Date().toISOString(),
    };

    const result = await this.cosmosService.upsertDocument<ConstructionLoan>(CONTAINER, updated);

    this.logger.info('ConstructionLoan order linked', {
      loanId,
      tenantId,
      orderId: input.orderId,
      role: input.role,
      linkedBy,
    });

    return result;
  }

  // ── unlinkOrder ──────────────────────────────────────────────────────────────

  /**
   * Removes an order link from a construction loan by orderId.
   *
   * No-op (and returns the current loan) if the orderId is not in linkedOrders.
   *
   * @throws if loanId or tenantId is empty, or if the loan is not found
   */
  async unlinkOrder(
    loanId: string,
    tenantId: string,
    orderId: string,
    unlinkedBy: string
  ): Promise<ConstructionLoan> {
    if (!loanId)   throw new Error('ConstructionLoanService.unlinkOrder: loanId is required');
    if (!tenantId) throw new Error('ConstructionLoanService.unlinkOrder: tenantId is required');
    if (!orderId)  throw new Error('ConstructionLoanService.unlinkOrder: orderId is required');

    const loan = await this.getLoanById(loanId, tenantId);

    const filtered = (loan.linkedOrders ?? []).filter(lo => lo.orderId !== orderId);

    // If nothing changed, skip the write
    if (filtered.length === (loan.linkedOrders ?? []).length) {
      return loan;
    }

    const updated: ConstructionLoan = {
      ...loan,
      linkedOrders: filtered,
      updatedAt: new Date().toISOString(),
    };

    const result = await this.cosmosService.upsertDocument<ConstructionLoan>(CONTAINER, updated);

    this.logger.info('ConstructionLoan order unlinked', { loanId, tenantId, orderId, unlinkedBy });

    return result;
  }

  // ── getLoansByOrderId ────────────────────────────────────────────────────────

  /**
   * Returns all construction loans (for a tenant) that have a specific orderId
   * in their linkedOrders array.
   *
   * Useful for the order detail view to show "linked construction loan" context.
   *
   * @throws if orderId or tenantId is empty
   */
  async getLoansByOrderId(orderId: string, tenantId: string): Promise<ConstructionLoan[]> {
    if (!orderId)  throw new Error('ConstructionLoanService.getLoansByOrderId: orderId is required');
    if (!tenantId) throw new Error('ConstructionLoanService.getLoansByOrderId: tenantId is required');

    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
        AND c.type = 'construction-loan'
        AND EXISTS (
          SELECT VALUE lo FROM lo IN c.linkedOrders WHERE lo.orderId = @orderId
        )
    `;

    return this.cosmosService.queryDocuments<ConstructionLoan>(CONTAINER, query, [
      { name: '@tenantId', value: tenantId },
      { name: '@orderId',  value: orderId  },
    ]);
  }

  // ── listLoans ─────────────────────────────────────────────────────────────────

  /**
   * Lists construction loans for the given tenant, with optional status and type filters.
   */
  async listLoans(tenantId: string, filters: LoanListFilter = {}): Promise<ConstructionLoan[]> {
    const conditions: string[] = ['c.tenantId = @tenantId'];
    const parameters: { name: string; value: string }[] = [
      { name: '@tenantId', value: tenantId },
    ];

    if (filters.status) {
      conditions.push('c.status = @status');
      parameters.push({ name: '@status', value: filters.status });
    }

    if (filters.loanType) {
      conditions.push('c.loanType = @loanType');
      parameters.push({ name: '@loanType', value: filters.loanType });
    }

    const query = `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.createdAt DESC`;

    return this.cosmosService.queryDocuments<ConstructionLoan>(CONTAINER, query, parameters);
  }
}
