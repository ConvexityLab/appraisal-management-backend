/**
 * Waiver Screening Service (Phase 1.13)
 *
 * PIW (Property Inspection Waiver), ACE (Appraisal Cost Estimator),
 * and other appraisal waiver eligibility screening.
 *
 * Checks whether an order might qualify for a reduced-scope product
 * (desktop, hybrid, waiver) based on configurable client rules,
 * LTV, property type, loan type, and prior appraisal history.
 *
 * Results are advisory — stored on the order record for reviewer reference.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type WaiverProgram = 'PIW' | 'ACE' | 'VALUE_ACCEPTANCE' | 'HYBRID_ELIGIBLE' | 'DESKTOP_ELIGIBLE';

export interface WaiverScreeningRequest {
  tenantId: string;
  clientId: string;
  /** Loan-to-value ratio (0–100) */
  ltv?: number;
  /** Loan purpose */
  loanPurpose?: string;
  /** Loan type (conventional, FHA, VA, etc.) */
  loanType?: string;
  /** Property type */
  propertyType?: string;
  /** Occupancy type */
  occupancyType?: string;
  /** Loan amount */
  loanAmount?: number;
  /** State (2-letter) */
  state?: string;
  /** Is this a refinance? */
  isRefinance?: boolean;
  /** Has prior appraisal within 36 months? */
  hasPriorAppraisal?: boolean;
  /** Prior appraisal value */
  priorAppraisalValue?: number;
  /** AVM confidence score (0–100) if available */
  avmConfidence?: number;
  /** AVM estimated value if available */
  avmValue?: number;
}

export interface WaiverEligibility {
  program: WaiverProgram;
  eligible: boolean;
  reason: string;
  /** Conditions that must be met for waiver to apply */
  conditions?: string[];
  /** Estimated cost savings vs. full appraisal */
  estimatedSavings?: number;
}

export interface WaiverScreeningResult {
  screened: boolean;
  screenedAt: string;
  eligiblePrograms: WaiverEligibility[];
  recommendedAction: 'PROCEED_FULL' | 'CONSIDER_WAIVER' | 'CONSIDER_DESKTOP' | 'CONSIDER_HYBRID';
  /** Why this recommendation was made */
  recommendationReason: string;
  /** Client waiver configuration used for screening — empty when no config found */
  configSource: string;
}

export interface ClientWaiverConfig {
  clientId: string;
  /** Which waiver programs the client participates in */
  enabledPrograms: WaiverProgram[];
  /** Maximum LTV for waiver eligibility (e.g. 80) */
  maxLtvForWaiver: number;
  /** Maximum loan amount for waiver */
  maxLoanAmountForWaiver: number;
  /** Eligible loan types */
  eligibleLoanTypes: string[];
  /** Eligible property types */
  eligiblePropertyTypes: string[];
  /** Eligible occupancy types */
  eligibleOccupancyTypes: string[];
  /** Minimum AVM confidence required */
  minAvmConfidence: number;
  /** Excluded states (regulatory or business reasons) */
  excludedStates: string[];
}

// ── Service ─────────────────────────────────────────────────────────────────

export class WaiverScreeningService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger('WaiverScreeningService');
  }

  /**
   * Screen an order for waiver/reduced-scope eligibility.
   * Returns advisory results — never blocks order creation.
   */
  async screenOrder(request: WaiverScreeningRequest): Promise<WaiverScreeningResult> {
    const screenedAt = new Date().toISOString();
    const eligiblePrograms: WaiverEligibility[] = [];

    try {
      // Attempt to load client-specific waiver config
      const config = await this.loadClientConfig(request.clientId, request.tenantId);

      if (!config) {
        return {
          screened: false,
          screenedAt,
          eligiblePrograms: [],
          recommendedAction: 'PROCEED_FULL',
          recommendationReason: `No waiver configuration found for client "${request.clientId}". Configure client waiver settings to enable PIW/ACE screening.`,
          configSource: 'none',
        };
      }

      // Screen each enabled program
      for (const program of config.enabledPrograms) {
        const result = this.screenProgram(program, request, config);
        eligiblePrograms.push(result);
      }

      const anyEligible = eligiblePrograms.some(p => p.eligible);
      const piwEligible = eligiblePrograms.find(p => p.program === 'PIW' && p.eligible);
      const desktopEligible = eligiblePrograms.find(p => p.program === 'DESKTOP_ELIGIBLE' && p.eligible);
      const hybridEligible = eligiblePrograms.find(p => p.program === 'HYBRID_ELIGIBLE' && p.eligible);

      let recommendedAction: WaiverScreeningResult['recommendedAction'] = 'PROCEED_FULL';
      let recommendationReason = 'No waiver programs are eligible for this order.';

      if (piwEligible) {
        recommendedAction = 'CONSIDER_WAIVER';
        recommendationReason = 'Order may qualify for Property Inspection Waiver (PIW). Review eligibility conditions before proceeding.';
      } else if (desktopEligible) {
        recommendedAction = 'CONSIDER_DESKTOP';
        recommendationReason = 'Order may qualify for desktop appraisal. Review eligibility conditions before proceeding.';
      } else if (hybridEligible) {
        recommendedAction = 'CONSIDER_HYBRID';
        recommendationReason = 'Order may qualify for hybrid appraisal. Review eligibility conditions before proceeding.';
      } else if (!anyEligible && eligiblePrograms.length > 0) {
        recommendationReason = 'All waiver programs were screened but none are eligible for this order.';
      }

      this.logger.info('Waiver screening completed', {
        clientId: request.clientId,
        programsScreened: eligiblePrograms.length,
        eligibleCount: eligiblePrograms.filter(p => p.eligible).length,
        recommendedAction,
      });

      return {
        screened: true,
        screenedAt,
        eligiblePrograms,
        recommendedAction,
        recommendationReason,
        configSource: `client:${request.clientId}`,
      };
    } catch (error) {
      // Screening is advisory — never fail the intake flow
      this.logger.error('Waiver screening failed (non-blocking)', { error });
      return {
        screened: false,
        screenedAt,
        eligiblePrograms: [],
        recommendedAction: 'PROCEED_FULL',
        recommendationReason: 'Screening encountered an error. Proceeding with full appraisal.',
        configSource: 'error',
      };
    }
  }

  /**
   * Screen a single waiver program against order parameters.
   */
  private screenProgram(
    program: WaiverProgram,
    request: WaiverScreeningRequest,
    config: ClientWaiverConfig,
  ): WaiverEligibility {
    const failReasons: string[] = [];
    const conditions: string[] = [];

    // Common checks across all programs
    // LTV check
    if (request.ltv !== undefined && request.ltv > config.maxLtvForWaiver) {
      failReasons.push(`LTV ${request.ltv}% exceeds maximum ${config.maxLtvForWaiver}% for waiver eligibility`);
    }

    // Loan amount check
    if (request.loanAmount !== undefined && request.loanAmount > config.maxLoanAmountForWaiver) {
      failReasons.push(`Loan amount $${request.loanAmount.toLocaleString()} exceeds maximum $${config.maxLoanAmountForWaiver.toLocaleString()}`);
    }

    // Property type check
    if (request.propertyType && config.eligiblePropertyTypes.length > 0) {
      if (!config.eligiblePropertyTypes.includes(request.propertyType)) {
        failReasons.push(`Property type "${request.propertyType}" is not eligible for ${program}`);
      }
    }

    // Loan type check
    if (request.loanType && config.eligibleLoanTypes.length > 0) {
      if (!config.eligibleLoanTypes.includes(request.loanType)) {
        failReasons.push(`Loan type "${request.loanType}" is not eligible for ${program}`);
      }
    }

    // Occupancy check
    if (request.occupancyType && config.eligibleOccupancyTypes.length > 0) {
      if (!config.eligibleOccupancyTypes.includes(request.occupancyType)) {
        failReasons.push(`Occupancy type "${request.occupancyType}" is not eligible for ${program}`);
      }
    }

    // State exclusion
    if (request.state && config.excludedStates.includes(request.state.toUpperCase())) {
      failReasons.push(`State "${request.state}" is excluded from ${program} program`);
    }

    // Program-specific checks
    switch (program) {
      case 'PIW':
      case 'ACE':
      case 'VALUE_ACCEPTANCE':
        // GSE waivers require AVM confidence
        if (request.avmConfidence !== undefined && request.avmConfidence < config.minAvmConfidence) {
          failReasons.push(`AVM confidence ${request.avmConfidence} below minimum ${config.minAvmConfidence}`);
        }
        if (request.avmConfidence === undefined) {
          conditions.push('AVM confidence score required for final eligibility determination');
        }
        // Typically limited to purchase and rate-term refinance
        if (request.loanPurpose === 'cash_out_refinance') {
          failReasons.push('Cash-out refinance is generally ineligible for GSE waivers');
        }
        break;

      case 'DESKTOP_ELIGIBLE':
        conditions.push('Subject to desktop appraisal scope requirements');
        if (request.loanPurpose === 'construction') {
          failReasons.push('Construction loans are not eligible for desktop appraisal');
        }
        break;

      case 'HYBRID_ELIGIBLE':
        conditions.push('Requires third-party property data collection');
        conditions.push('Interior inspection by non-appraiser allowed');
        break;
    }

    const eligible = failReasons.length === 0;
    const reason = eligible
      ? `Order appears eligible for ${program}`
      : failReasons.join('; ');

    return {
      program,
      eligible,
      reason,
      ...(conditions.length > 0 && { conditions }),
      ...(eligible && { estimatedSavings: this.estimateSavings(program) }),
    };
  }

  private estimateSavings(program: WaiverProgram): number {
    // Approximate savings vs. full appraisal (typical $500 base)
    switch (program) {
      case 'PIW':
      case 'ACE':
      case 'VALUE_ACCEPTANCE':
        return 500; // Full waiver — saves entire appraisal fee
      case 'DESKTOP_ELIGIBLE':
        return 200; // Desktop is cheaper than full
      case 'HYBRID_ELIGIBLE':
        return 100; // Hybrid is slightly cheaper
      default:
        return 0;
    }
  }

  /**
   * Load client-specific waiver configuration from Cosmos.
   * Returns null if no configuration exists (screening not configured for this client).
   */
  private async loadClientConfig(
    clientId: string,
    tenantId: string,
  ): Promise<ClientWaiverConfig | null> {
    try {
      const container = (this.dbService as any).ordersContainer;
      if (!container) return null;

      const { resources } = await container.items.query({
        query: `SELECT * FROM c WHERE c.type = 'client_waiver_config' AND c.clientId = @clientId AND c.tenantId = @tenantId`,
        parameters: [
          { name: '@clientId', value: clientId },
          { name: '@tenantId', value: tenantId },
        ],
      }).fetchAll();

      return resources.length > 0 ? resources[0] as ClientWaiverConfig : null;
    } catch (error) {
      this.logger.warn('Failed to load client waiver config', { clientId, error });
      return null;
    }
  }
}
