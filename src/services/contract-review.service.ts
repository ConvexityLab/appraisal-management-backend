/**
 * Purchase Contract Review Service
 *
 * Phase 2.3 — Created 2026-03-11
 *
 * Reviews purchase contracts for arm's-length compliance, concession
 * reasonableness, price-vs-value alignment, financing terms, and personal
 * property inclusions. Per USPAP Standards Rule 1-5, Fannie Mae Selling
 * Guide B4-1.2 (Purchase Transactions), and FNMA/FHLMC form 1004 §1.
 *
 * Architecture follows the USPAP evaluator-registry pattern.
 */

import { Logger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ContractReviewResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, any>;
}

export type ContractEvaluator = (input: ContractReviewInput) => ContractReviewResult;

export interface ContractReviewInput {
  contract?: {
    contractPrice: number;
    contractDate?: string;
    fullyExecuted?: boolean;
    buyerName?: string;
    sellerName?: string;
    buyerSignatureDate?: string;
    sellerSignatureDate?: string;
    allAddendaPresent?: boolean;
    addendaCount?: number;
  };
  concessions?: {
    totalAmount: number;
    types?: string[];
    sellerPaidClosingCosts?: number;
    sellerPaidRepairs?: number;
    otherCredits?: number;
  };
  personalProperty?: {
    includedInContract: string[];
    includedInAppraisal: boolean;
    estimatedValue?: number;
  };
  financingTerms?: {
    loanType?: string;
    interestRate?: number;
    loanAmount?: number;
    sellerBuydown?: boolean;
    buydownAmount?: number;
    assumable?: boolean;
  };
  armLengthIndicators?: {
    relatedParty?: boolean;
    employerRelationship?: boolean;
    familyRelationship?: boolean;
    corporateAffiliation?: boolean;
    reo?: boolean;
    shortSale?: boolean;
    courtOrdered?: boolean;
  };
  appraisedValue?: number;
  indicatedValueByApproach?: {
    salesComparison?: number;
    cost?: number;
    income?: number;
  };
  compConcessions?: Array<{
    address?: string;
    concessionAmount: number;
    salePrice: number;
  }>;
}

export interface ContractReviewCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, any>;
}

export interface ContractReviewReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: ContractReviewCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Standard loan types considered conventional/standard
// ═══════════════════════════════════════════════════════════════════════════════

const STANDARD_LOAN_TYPES = new Set([
  'conventional',
  'fha',
  'va',
  'usda',
  'jumbo',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Evaluator functions (pure, exported for testability)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 1. Check contract execution status.
 *    Contract must be fully executed with all signatures and addenda.
 */
export function checkContractExecution(input: ContractReviewInput): ContractReviewResult {
  const c = input.contract;
  if (!c) {
    return { passed: true, message: 'Contract data not provided — execution check skipped.', severity: 'critical' };
  }

  const issues: string[] = [];

  if (!c.fullyExecuted) {
    issues.push('Contract is not fully executed');
  }
  if (!c.buyerSignatureDate) {
    issues.push('buyer signature date');
  }
  if (!c.sellerSignatureDate) {
    issues.push('seller signature date');
  }
  if (c.allAddendaPresent === false) {
    issues.push(`Not all addenda present (${c.addendaCount ?? 'unknown'} referenced)`);
  }

  // Separate missing-field issues from status issues
  const missingFields: ReadonlyArray<string> = ['buyer signature date', 'seller signature date'];
  const missing = issues.filter(i => missingFields.includes(i));
  const statusIssues = issues.filter(i => !missingFields.includes(i));

  if (issues.length > 0) {
    const fullMessage = [
      ...statusIssues,
      ...(missing.length > 0 ? [`Missing: ${missing.join(', ')}`] : []),
    ].join('. ');

    return {
      passed: false,
      message: `Contract execution issues: ${fullMessage}. A fully executed contract with all signatures and addenda is required per USPAP SR 1-5.`,
      severity: 'critical',
      details: { missing, statusIssues, allIssues: issues },
    };
  }

  return {
    passed: true,
    message: 'Contract is fully executed with all required signatures and addenda.',
    severity: 'critical',
  };
}

/**
 * 2. Check arm's-length transaction indicators.
 *    Flags related-party, family, employer, corporate, or distressed-sale indicators.
 */
export function checkArmLengthTransaction(input: ContractReviewInput): ContractReviewResult {
  const ind = input.armLengthIndicators;
  if (!ind) {
    return { passed: true, message: 'Arm\'s-length indicators not provided — check skipped.', severity: 'critical' };
  }

  const violations: string[] = [];

  if (ind.relatedParty) violations.push('Related party transaction');
  if (ind.familyRelationship) violations.push('Family relationship between parties');
  if (ind.employerRelationship) violations.push('Employer/employee relationship');
  if (ind.corporateAffiliation) violations.push('Corporate affiliation between parties');
  if (ind.reo) violations.push('REO/bank-owned sale');
  if (ind.shortSale) violations.push('Short sale');
  if (ind.courtOrdered) violations.push('Court-ordered sale');

  if (violations.length > 0) {
    // REO/short-sale/court-ordered are high severity; others are critical
    const hasCritical = violations.some(v =>
      v.includes('Related party') || v.includes('Family') || v.includes('Employer') || v.includes('Corporate'),
    );

    return {
      passed: false,
      message: `Non-arm's-length indicators identified: ${violations.join('; ')}. Per USPAP SR 1-5, the appraiser must analyze and report non-arm's-length conditions.`,
      severity: hasCritical ? 'critical' : 'high',
      details: { violations },
    };
  }

  return {
    passed: true,
    message: 'Transaction appears to be arm\'s-length with no related-party indicators.',
    severity: 'critical',
  };
}

/**
 * 3. Analyze seller concessions for reasonableness.
 *    Fannie Mae caps interested-party contributions at 3-9% depending on
 *    LTV/occupancy. We use a 6% general threshold as a flag trigger.
 *    Also compares subject concessions to comp concessions for consistency.
 */
export function analyzeConcessions(input: ContractReviewInput): ContractReviewResult {
  const conc = input.concessions;
  if (!conc) {
    return { passed: true, message: 'Concession data not provided — check skipped.', severity: 'high' };
  }

  if (conc.totalAmount === 0) {
    return { passed: true, message: 'No seller concessions reported.', severity: 'high' };
  }

  const contractPrice = input.contract?.contractPrice;
  if (!contractPrice || contractPrice <= 0) {
    return { passed: true, message: 'Contract price not available — concession percentage check skipped.', severity: 'high' };
  }

  const concessionPct = (conc.totalAmount / contractPrice) * 100;
  const issues: string[] = [];

  // Absolute threshold check (Fannie Mae 6% general cap)
  if (concessionPct > 6) {
    issues.push(`Seller concessions of $${conc.totalAmount.toLocaleString()} represent ${concessionPct.toFixed(1)}% of contract price, exceeding the 6% Fannie Mae interested-party contribution threshold.`);
  }

  // Comp concession comparison
  const compConcs = input.compConcessions;
  let avgCompConcessionPct = 0;
  if (compConcs && compConcs.length > 0) {
    const compPcts = compConcs
      .filter(c => c.salePrice > 0)
      .map(c => (c.concessionAmount / c.salePrice) * 100);
    if (compPcts.length > 0) {
      avgCompConcessionPct = compPcts.reduce((sum, p) => sum + p, 0) / compPcts.length;
      // Flag if subject concessions exceed comp average by >3x
      if (concessionPct > avgCompConcessionPct * 3 && concessionPct > 3) {
        issues.push(`Subject concessions (${concessionPct.toFixed(1)}%) are ${(concessionPct / avgCompConcessionPct).toFixed(1)}x the comp average (${avgCompConcessionPct.toFixed(1)}%).`);
      }
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: issues.join(' '),
      severity: 'high',
      details: {
        concessionPct: Math.round(concessionPct * 10) / 10,
        subjectConcessionPct: Math.round(concessionPct * 10) / 10,
        avgCompConcessionPct: Math.round(avgCompConcessionPct * 10) / 10,
        totalAmount: conc.totalAmount,
        types: conc.types,
      },
    };
  }

  return {
    passed: true,
    message: `Seller concessions of $${conc.totalAmount.toLocaleString()} (${concessionPct.toFixed(1)}%) are within acceptable limits.`,
    severity: 'high',
    details: { concessionPct: Math.round(concessionPct * 10) / 10 },
  };
}

/**
 * 4. Check contract price vs appraised/indicated value.
 *    Flags >5% variance in either direction. Exact match (0%) triggers a
 *    low-severity confirmation-bias advisory.
 */
export function checkPriceReasonableness(input: ContractReviewInput): ContractReviewResult {
  const contractPrice = input.contract?.contractPrice;
  const appraisedValue = input.appraisedValue;

  if (!contractPrice || !appraisedValue || contractPrice <= 0 || appraisedValue <= 0) {
    return { passed: true, message: 'Contract price or appraised value not available — price reasonableness check skipped.', severity: 'high' };
  }

  const variance = contractPrice - appraisedValue;
  const variancePct = Math.abs(variance / appraisedValue) * 100;
  const direction = variance > 0 ? 'above' : variance < 0 ? 'below' : 'equal';

  // Exact match: confirmation bias advisory
  if (variancePct < 0.01) {
    return {
      passed: true,
      message: `Contract price ($${contractPrice.toLocaleString()}) exactly equals appraised value ($${appraisedValue.toLocaleString()}). While not inherently wrong, exact matches may indicate confirmation bias — verify that the value conclusion was independently derived.`,
      severity: 'low',
      details: { contractPrice, appraisedValue, variancePct: 0, direction: 'equal' },
    };
  }

  // >5% variance is flagged
  if (variancePct > 5) {
    return {
      passed: false,
      message: `Contract price ($${contractPrice.toLocaleString()}) is ${variancePct.toFixed(1)}% ${direction} appraised value ($${appraisedValue.toLocaleString()}). Variance exceeds 5% — verify that the indicated value credibly explains the contract price, not the other way around.`,
      severity: 'high',
      details: { contractPrice, appraisedValue, variancePct: Math.round(variancePct * 10) / 10, direction },
    };
  }

  return {
    passed: true,
    message: `Contract price ($${contractPrice.toLocaleString()}) is within ${variancePct.toFixed(1)}% of appraised value ($${appraisedValue.toLocaleString()}).`,
    severity: 'high',
    details: { contractPrice, appraisedValue, variancePct: Math.round(variancePct * 10) / 10, direction },
  };
}

/**
 * 5. Check financing terms for non-standard conditions.
 *    Flags seller buydowns, assumption financing, and high LTV.
 */
export function checkFinancingTerms(input: ContractReviewInput): ContractReviewResult {
  const fin = input.financingTerms;
  if (!fin) {
    return { passed: true, message: 'Financing terms not provided — check skipped.', severity: 'medium' };
  }

  const flags: string[] = [];

  if (fin.sellerBuydown) {
    flags.push('seller buydown');
  }

  if (fin.loanType && !STANDARD_LOAN_TYPES.has(fin.loanType.toLowerCase())) {
    flags.push('non-standard loan type');
  }

  if (fin.assumable) {
    flags.push('assumable financing');
  }

  // Check LTV
  const contractPrice = input.contract?.contractPrice;
  if (fin.loanAmount && contractPrice && contractPrice > 0) {
    const ltv = (fin.loanAmount / contractPrice) * 100;
    if (ltv > 100) {
      flags.push(`LTV exceeds 100% (${ltv.toFixed(1)}%)`);
    }

    if (flags.length > 0) {
      return {
        passed: false,
        message: `Non-standard financing conditions: ${flags.join(', ')}. These may affect value and should be analyzed per USPAP SR 1-5.`,
        severity: 'medium',
        details: {
          flags,
          loanType: fin.loanType,
          ltv: Math.round(ltv * 10) / 10,
          sellerBuydown: fin.sellerBuydown,
          buydownAmount: fin.buydownAmount,
        },
      };
    }
  }

  if (flags.length > 0) {
    return {
      passed: false,
      message: `Non-standard financing conditions: ${flags.join(', ')}. These may affect value and should be analyzed per USPAP SR 1-5.`,
      severity: 'medium',
      details: { flags, loanType: fin.loanType },
    };
  }

  return {
    passed: true,
    message: 'Financing terms are standard with no flags.',
    severity: 'medium',
  };
}

/**
 * 6. Check for personal property included in contract but not properly
 *    handled in the appraisal. Per FNMA 1004 instructions, personal
 *    property must be excluded from the appraised value.
 */
export function checkPersonalPropertyInclusion(input: ContractReviewInput): ContractReviewResult {
  const pp = input.personalProperty;
  if (!pp) {
    return { passed: true, message: 'Personal property data not provided — check skipped.', severity: 'high' };
  }

  if (!pp.includedInContract || pp.includedInContract.length === 0) {
    return { passed: true, message: 'No personal property included in contract.', severity: 'high' };
  }

  // Personal property IS in the contract — verify the appraisal addresses it
  if (!pp.includedInAppraisal) {
    return {
      passed: false,
      message: `Personal property included in contract (${pp.includedInContract.join(', ')}) but not acknowledged/excluded in the appraisal. Per FNMA form 1004, personal property must be identified and excluded from appraised value.`,
      severity: 'high',
      details: {
        items: pp.includedInContract,
        estimatedValue: pp.estimatedValue,
      },
    };
  }

  return {
    passed: true,
    message: `Personal property in contract (${pp.includedInContract.join(', ')}) is properly acknowledged in the appraisal.`,
    severity: 'high',
    details: {
      items: pp.includedInContract,
      estimatedValue: pp.estimatedValue,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Evaluator Registry
// ═══════════════════════════════════════════════════════════════════════════════

export const CONTRACT_EVALUATORS: Record<string, ContractEvaluator> = {
  checkContractExecution,
  checkArmLengthTransaction,
  analyzeConcessions,
  checkPriceReasonableness,
  checkFinancingTerms,
  checkPersonalPropertyInclusion,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Service Class
// ═══════════════════════════════════════════════════════════════════════════════

export class ContractReviewService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Run all contract review evaluators against the input data.
   * Returns an aggregate report with severity counts and individual check results.
   */
  performReview(orderId: string, input: ContractReviewInput): ContractReviewReport {
    this.logger.info('Starting purchase contract review', { orderId });

    const checks: ContractReviewCheck[] = [];

    for (const [name, evaluator] of Object.entries(CONTRACT_EVALUATORS)) {
      try {
        const result = evaluator(input);
        checks.push({
          evaluatorName: name,
          passed: result.passed,
          message: result.message,
          severity: result.severity,
          ...(result.details !== undefined && { details: result.details }),
        });
      } catch (error) {
        this.logger.error(`Contract evaluator "${name}" threw an error`, { error, orderId });
        checks.push({
          evaluatorName: name,
          passed: false,
          message: `Evaluator "${name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'high',
        });
      }
    }

    const failedChecks = checks.filter(c => !c.passed);
    const criticalIssues = failedChecks.filter(c => c.severity === 'critical').length;
    const highIssues = failedChecks.filter(c => c.severity === 'high').length;
    const mediumIssues = failedChecks.filter(c => c.severity === 'medium').length;
    const lowIssues = failedChecks.filter(c => c.severity === 'low').length;
    const totalIssues = failedChecks.length;

    let overallStatus: 'pass' | 'fail' | 'warnings';
    if (criticalIssues > 0) {
      overallStatus = 'fail';
    } else if (highIssues > 0 || mediumIssues > 0) {
      overallStatus = 'warnings';
    } else {
      overallStatus = 'pass';
    }

    const report: ContractReviewReport = {
      orderId,
      reportDate: new Date(),
      overallStatus,
      checks,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      totalIssues,
    };

    this.logger.info('Contract review complete', {
      orderId,
      overallStatus,
      totalIssues,
      criticalIssues,
    });

    return report;
  }
}
