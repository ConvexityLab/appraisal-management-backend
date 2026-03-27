/**
 * Construction Finance Module — Contractor Service
 *
 * Manages ContractorProfile documents in the `contractors` Cosmos container.
 * Partition key: /tenantId
 *
 * Responsibilities:
 *   - CRUD for ContractorProfile documents
 *   - Recording manual license verification (sets licenseVerificationStatus = MANUAL_VERIFIED)
 *   - Listing / filtering contractors for assignment workflows
 *
 * License verification via third-party API is intentionally out of scope here —
 * that will be a separate async job (Pillar 2 / Phase 3).
 *
 * This service does NOT create Cosmos infrastructure — all containers must be
 * provisioned via Bicep before this service runs.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { ContractorProfile, ConstructionLoan } from '../types/construction-loan.types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTAINER = 'contractors';

// ─── Input / Filter Types ─────────────────────────────────────────────────────

export interface CreateContractorInput {
  tenantId: string;
  name: string;
  role: ContractorProfile['role'];
  licenseNumber: string;
  licenseState: string;
  licenseExpiry: string;
  insuranceCertExpiry: string;
  createdBy: string;
  yearsInBusiness?: number;
  completedProjects?: number;
  bondAmount?: number;
  notes?: string;
}

export type ContractorUpdateFields = Partial<
  Pick<
    ContractorProfile,
    | 'name'
    | 'role'
    | 'licenseNumber'
    | 'licenseState'
    | 'licenseExpiry'
    | 'insuranceCertExpiry'
    | 'bondAmount'
    | 'yearsInBusiness'
    | 'completedProjects'
    | 'riskTier'
    | 'notes'
    | 'apiVerificationAt'
    | 'apiVerificationSource'
    | 'licenseVerificationStatus'
  >
>;

export interface ContractorListFilter {
  riskTier?: ContractorProfile['riskTier'];
}

// ─── ContractorService ────────────────────────────────────────────────────────

export class ContractorService {
  private readonly logger = new Logger('ContractorService');

  constructor(private readonly cosmosService: CosmosDbService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private generateId(): string {
    return `contractor-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // ── getContractorById ────────────────────────────────────────────────────────

  /**
   * Retrieves a contractor profile by ID.
   *
   * @throws if contractorId or tenantId is empty
   * @throws if the contractor is not found
   */
  async getContractorById(contractorId: string, tenantId: string): Promise<ContractorProfile> {
    if (!contractorId) {
      throw new Error('ContractorService.getContractorById: contractorId is required');
    }
    if (!tenantId) {
      throw new Error('ContractorService.getContractorById: tenantId is required');
    }

    const contractor = await this.cosmosService.getDocument<ContractorProfile>(
      CONTAINER,
      contractorId,
      tenantId
    );

    if (!contractor) {
      throw new Error(
        `ContractorService.getContractorById: contractor "${contractorId}" not found for tenant "${tenantId}"`
      );
    }

    return contractor;
  }

  // ── createContractor ─────────────────────────────────────────────────────────

  /**
   * Creates a new ContractorProfile with licenseVerificationStatus = PENDING.
   * riskTier defaults to APPROVED — the lender must explicitly downgrade if needed.
   *
   * @throws if tenantId, name, or licenseNumber is empty
   */
  async createContractor(input: CreateContractorInput): Promise<ContractorProfile> {
    if (!input.tenantId) {
      throw new Error('ContractorService.createContractor: tenantId is required');
    }
    if (!input.name) {
      throw new Error('ContractorService.createContractor: name is required');
    }
    if (!input.licenseNumber) {
      throw new Error('ContractorService.createContractor: licenseNumber is required');
    }

    const now = new Date().toISOString();

    const contractor: ContractorProfile = {
      id: this.generateId(),
      tenantId: input.tenantId,
      name: input.name,
      role: input.role,
      licenseNumber: input.licenseNumber,
      licenseState: input.licenseState,
      licenseExpiry: input.licenseExpiry,
      licenseVerificationStatus: 'PENDING',
      insuranceCertExpiry: input.insuranceCertExpiry,
      riskTier: 'APPROVED',
      ...(input.yearsInBusiness !== undefined && { yearsInBusiness: input.yearsInBusiness }),
      ...(input.completedProjects !== undefined && { completedProjects: input.completedProjects }),
      ...(input.bondAmount !== undefined && { bondAmount: input.bondAmount }),
      ...(input.notes !== undefined && { notes: input.notes }),
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.cosmosService.createDocument<ContractorProfile>(CONTAINER, contractor);

    this.logger.info('ContractorProfile created', {
      contractorId: created.id,
      tenantId: created.tenantId,
      name: created.name,
      licenseNumber: created.licenseNumber,
    });

    return created;
  }

  // ── updateContractor ─────────────────────────────────────────────────────────

  /**
   * Applies a partial update to an existing ContractorProfile.
   *
   * @throws if the contractor is not found
   */
  async updateContractor(
    contractorId: string,
    tenantId: string,
    updates: ContractorUpdateFields,
    updatedBy: string
  ): Promise<ContractorProfile> {
    const existing = await this.getContractorById(contractorId, tenantId);

    const updated: ContractorProfile = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const result = await this.cosmosService.upsertDocument<ContractorProfile>(CONTAINER, updated);

    this.logger.info('ContractorProfile updated', { contractorId, tenantId, updatedBy });

    return result;
  }

  // ── listContractors ──────────────────────────────────────────────────────────

  /**
   * Lists contractor profiles for the given tenant, with optional riskTier filter.
   */
  async listContractors(
    tenantId: string,
    filters: ContractorListFilter = {}
  ): Promise<ContractorProfile[]> {
    const conditions: string[] = ['c.tenantId = @tenantId'];
    const parameters: { name: string; value: string }[] = [
      { name: '@tenantId', value: tenantId },
    ];

    if (filters.riskTier) {
      conditions.push('c.riskTier = @riskTier');
      parameters.push({ name: '@riskTier', value: filters.riskTier });
    }

    const query = `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.name ASC`;

    return this.cosmosService.queryDocuments<ContractorProfile>(CONTAINER, query, parameters);
  }

  // ── recordManualVerification ──────────────────────────────────────────────────

  /**
   * Records that a human reviewer has manually verified the contractor's license.
   * Sets licenseVerificationStatus = MANUAL_VERIFIED and stamps who verified and when.
   *
   * @throws if the contractor is not found
   */
  async recordManualVerification(
    contractorId: string,
    tenantId: string,
    verifiedBy: string
  ): Promise<ContractorProfile> {
    const existing = await this.getContractorById(contractorId, tenantId);
    const now = new Date().toISOString();

    const updated: ContractorProfile = {
      ...existing,
      licenseVerificationStatus: 'MANUAL_VERIFIED',
      licenseVerifiedBy: verifiedBy,
      licenseVerifiedAt: now,
      updatedAt: now,
    };

    const result = await this.cosmosService.upsertDocument<ContractorProfile>(CONTAINER, updated);

    this.logger.info('ContractorProfile manual license verification recorded', {
      contractorId,
      tenantId,
      verifiedBy,
    });

    return result;
  }

  // ── verifyLicenseManual ───────────────────────────────────────────────────────

  /**
   * Records a manual license verification with an uploaded document URL.
   * Stamps licenseVerificationStatus = MANUAL_VERIFIED and stores the document URL.
   *
   * @throws if the contractor is not found, or if docUrl or verifiedBy is empty
   */
  async verifyLicenseManual(
    contractorId: string,
    tenantId: string,
    docUrl: string,
    verifiedBy: string
  ): Promise<ContractorProfile> {
    if (!docUrl) {
      throw new Error('ContractorService.verifyLicenseManual: docUrl is required');
    }
    if (!verifiedBy) {
      throw new Error('ContractorService.verifyLicenseManual: verifiedBy is required');
    }

    const existing = await this.getContractorById(contractorId, tenantId);
    const now = new Date().toISOString();

    const updated: ContractorProfile = {
      ...existing,
      licenseVerificationStatus: 'MANUAL_VERIFIED',
      licenseVerifiedBy: verifiedBy,
      licenseVerifiedAt: now,
      manualVerificationDocUrl: docUrl,
      updatedAt: now,
    };

    const result = await this.cosmosService.upsertDocument<ContractorProfile>(CONTAINER, updated);

    this.logger.info('ContractorProfile manual license verification recorded with doc', {
      contractorId,
      tenantId,
      verifiedBy,
      docUrl,
    });

    return result;
  }

  // ── verifyLicenseApi ──────────────────────────────────────────────────────────

  /**
   * Attempts API-based license verification against a state licensing board registry.
   *
   * Implementation note: actual external API call is abstracted via the protected
   * `callLicenseRegistryApi` method, which is overridable in tests.
   *
   * Rules:
   *   - If API returns positive: set API_VERIFIED
   *   - If license is expired (licenseExpiry in the past): API result is API_NOT_FOUND;
   *     combined status is FAILED only if no MANUAL_VERIFIED status exists.
   *   - If API is unreachable / error: do not change existing status; log and rethrow.
   *
   * @throws if the contractor is not found
   * @throws if the API call throws
   */
  async verifyLicenseApi(contractorId: string, tenantId: string): Promise<ContractorProfile> {
    const existing = await this.getContractorById(contractorId, tenantId);
    const now = new Date().toISOString();

    const apiResult = await this.callLicenseRegistryApi(existing);

    const hasManualVerification = existing.licenseVerificationStatus === 'MANUAL_VERIFIED';
    const newStatus =
      apiResult.verified
        ? 'API_VERIFIED'
        : hasManualVerification
          ? 'MANUAL_VERIFIED'  // Keep manual if API fails but manual is good
          : 'FAILED';

    const updated: ContractorProfile = {
      ...existing,
      licenseVerificationStatus: newStatus,
      apiVerificationAt: now,
      apiVerificationSource: apiResult.source,
      updatedAt: now,
    };

    const result = await this.cosmosService.upsertDocument<ContractorProfile>(CONTAINER, updated);

    this.logger.info('ContractorProfile API license verification completed', {
      contractorId,
      tenantId,
      apiVerified: apiResult.verified,
      newStatus,
    });

    return result;
  }

  /**
   * Calls an external state licensing board API to verify the contractor's license.
   *
   * This method is extracted for testability — override in subclasses or tests.
   *
   * Current stub: verifies as valid if the licenseExpiry is in the future and the
   * licenseNumber matches a non-empty string (real impl would call an HTTP endpoint).
   */
  protected async callLicenseRegistryApi(
    contractor: ContractorProfile
  ): Promise<{ verified: boolean; source: string }> {
    const isExpired = contractor.licenseExpiry < new Date().toISOString().slice(0, 10);
    return {
      verified: !isExpired && contractor.licenseNumber.length > 0,
      source: `${contractor.licenseState} State License Registry (stub)`,
    };
  }

  // ── getContractorProjects ─────────────────────────────────────────────────────

  /**
   * Returns all ConstructionLoans assigned to this contractor as general contractor,
   * where the loan status is ACTIVE, SUBSTANTIALLY_COMPLETE, or APPROVED.
   *
   * Used for contractor capacity checks during loan assignment.
   *
   * @throws if contractorId or tenantId is empty
   */
  async getContractorProjects(
    contractorId: string,
    tenantId: string
  ): Promise<ConstructionLoan[]> {
    if (!contractorId) {
      throw new Error('ContractorService.getContractorProjects: contractorId is required');
    }
    if (!tenantId) {
      throw new Error('ContractorService.getContractorProjects: tenantId is required');
    }

    const query = `
      SELECT * FROM c
      WHERE c.tenantId = @tenantId
        AND c.generalContractorId = @contractorId
        AND c.status IN (@s0, @s1, @s2)
    `;
    const parameters = [
      { name: '@tenantId',      value: tenantId },
      { name: '@contractorId',  value: contractorId },
      { name: '@s0',            value: 'ACTIVE' },
      { name: '@s1',            value: 'SUBSTANTIALLY_COMPLETE' },
      { name: '@s2',            value: 'APPROVED' },
    ];

    return this.cosmosService.queryDocuments<ConstructionLoan>(
      'construction-loans',
      query,
      parameters
    );
  }

  // ── addContractorToLoan ───────────────────────────────────────────────────────

  /**
   * Links a ContractorProfile as the general contractor on a ConstructionLoan.
   * Validates that:
   *   - The contractor exists and belongs to the tenant
   *   - The loan exists and belongs to the tenant
   *   - The contractor is not DISQUALIFIED
   *
   * Sets ConstructionLoan.generalContractorId = contractorId.
   *
   * @throws if either document is not found
   * @throws if the contractor's riskTier is DISQUALIFIED
   */
  async addContractorToLoan(
    loanId: string,
    contractorId: string,
    tenantId: string
  ): Promise<ConstructionLoan> {
    if (!loanId) {
      throw new Error('ContractorService.addContractorToLoan: loanId is required');
    }

    const [contractor, loan] = await Promise.all([
      this.getContractorById(contractorId, tenantId),
      this.cosmosService.getDocument<ConstructionLoan>('construction-loans', loanId, tenantId),
    ]);

    if (!loan) {
      throw new Error(
        `ContractorService.addContractorToLoan: loan "${loanId}" not found for tenant "${tenantId}"`
      );
    }

    if (contractor.riskTier === 'DISQUALIFIED') {
      throw new Error(
        `ContractorService.addContractorToLoan: contractor "${contractorId}" is DISQUALIFIED ` +
        `and may not be assigned to loans.`
      );
    }

    const updatedLoan: ConstructionLoan = {
      ...loan,
      generalContractorId: contractorId,
      updatedAt: new Date().toISOString(),
    };

    const result = await this.cosmosService.upsertDocument<ConstructionLoan>(
      'construction-loans',
      updatedLoan
    );

    this.logger.info('Contractor linked to loan', {
      loanId,
      contractorId,
      tenantId,
      contractorName: contractor.name,
    });

    return result;
  }
}
