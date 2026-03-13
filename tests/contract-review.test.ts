/**
 * Purchase Contract Review Service — Phase 2.3 Tests
 *
 * Tests the 6 contract review evaluators and aggregate report:
 *   1. checkContractExecution — fully-executed status + all parties signed
 *   2. checkArmLengthTransaction — related-party, employer/family, unusual terms
 *   3. analyzeConcessions — seller concessions reasonableness + comp consistency
 *   4. checkPriceReasonableness — contract price vs appraised/indicated value
 *   5. checkFinancingTerms — conventional vs non-standard, buydowns, assumptions
 *   6. checkPersonalPropertyInclusion — personal property in contract vs appraisal
 *
 * Run: pnpm vitest run tests/contract-review.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

import {
  ContractReviewService,
  checkContractExecution,
  checkArmLengthTransaction,
  analyzeConcessions,
  checkPriceReasonableness,
  checkFinancingTerms,
  checkPersonalPropertyInclusion,
  CONTRACT_EVALUATORS,
  type ContractReviewInput,
} from '../src/services/contract-review.service';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeInput(overrides: Partial<ContractReviewInput> = {}): ContractReviewInput {
  return {
    contract: {
      contractPrice: 425000,
      contractDate: '2026-02-01',
      fullyExecuted: true,
      buyerName: 'John Smith',
      sellerName: 'Jane Doe',
      buyerSignatureDate: '2026-02-01',
      sellerSignatureDate: '2026-02-01',
      allAddendaPresent: true,
      addendaCount: 2,
    },
    concessions: {
      totalAmount: 8000,
      types: ['closing costs'],
      sellerPaidClosingCosts: 8000,
    },
    personalProperty: {
      includedInContract: [],
      includedInAppraisal: false,
      estimatedValue: 0,
    },
    financingTerms: {
      loanType: 'conventional',
      interestRate: 6.5,
      loanAmount: 340000,
      sellerBuydown: false,
    },
    armLengthIndicators: {
      relatedParty: false,
      employerRelationship: false,
      familyRelationship: false,
      corporateAffiliation: false,
      reo: false,
    },
    appraisedValue: 430000,
    indicatedValueByApproach: {
      salesComparison: 428000,
      cost: 440000,
    },
    compConcessions: [
      { address: 'Comp 1', concessionAmount: 5000, salePrice: 400000 },
      { address: 'Comp 2', concessionAmount: 10000, salePrice: 420000 },
      { address: 'Comp 3', concessionAmount: 7000, salePrice: 410000 },
    ],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. checkContractExecution
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkContractExecution', () => {
  it('passes when contract is fully executed with all signatures', () => {
    const result = checkContractExecution(makeInput());
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('critical');
  });

  it('fails when contract is not fully executed', () => {
    const result = checkContractExecution(makeInput({
      contract: { ...makeInput().contract, fullyExecuted: false },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('not fully executed');
  });

  it('fails when buyer signature date is missing', () => {
    const result = checkContractExecution(makeInput({
      contract: { ...makeInput().contract, buyerSignatureDate: undefined },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.missing).toContain('buyer signature date');
  });

  it('fails when seller signature date is missing', () => {
    const result = checkContractExecution(makeInput({
      contract: { ...makeInput().contract, sellerSignatureDate: undefined },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.missing).toContain('seller signature date');
  });

  it('flags missing addenda', () => {
    const result = checkContractExecution(makeInput({
      contract: { ...makeInput().contract, allAddendaPresent: false, addendaCount: 3 },
    }));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('addenda');
  });

  it('passes when contract data is not provided', () => {
    const result = checkContractExecution(makeInput({ contract: undefined }));
    expect(result.passed).toBe(true);
    expect(result.message).toContain('not provided');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. checkArmLengthTransaction
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkArmLengthTransaction', () => {
  it('passes with no related-party indicators', () => {
    const result = checkArmLengthTransaction(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when related-party flag is true', () => {
    const result = checkArmLengthTransaction(makeInput({
      armLengthIndicators: { ...makeInput().armLengthIndicators, relatedParty: true },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.details?.violations).toContain('Related party transaction');
  });

  it('fails when family relationship is flagged', () => {
    const result = checkArmLengthTransaction(makeInput({
      armLengthIndicators: { ...makeInput().armLengthIndicators, familyRelationship: true },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.violations).toContain('Family relationship between parties');
  });

  it('fails when employer relationship is flagged', () => {
    const result = checkArmLengthTransaction(makeInput({
      armLengthIndicators: { ...makeInput().armLengthIndicators, employerRelationship: true },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.violations).toContain('Employer/employee relationship');
  });

  it('detects multiple arm-length violations', () => {
    const result = checkArmLengthTransaction(makeInput({
      armLengthIndicators: {
        relatedParty: true,
        familyRelationship: true,
        employerRelationship: false,
        corporateAffiliation: true,
        reo: false,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.violations).toHaveLength(3);
  });

  it('flags REO sales', () => {
    const result = checkArmLengthTransaction(makeInput({
      armLengthIndicators: { ...makeInput().armLengthIndicators, reo: true },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.details?.violations).toContain('REO/bank-owned sale');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. analyzeConcessions
// ═══════════════════════════════════════════════════════════════════════════════

describe('analyzeConcessions', () => {
  it('passes when concessions are within market norms', () => {
    const result = analyzeConcessions(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when concessions exceed 6% of contract price (Fannie Mae limit)', () => {
    const result = analyzeConcessions(makeInput({
      concessions: { totalAmount: 30000, types: ['closing costs', 'repairs'], sellerPaidClosingCosts: 30000 },
      contract: { ...makeInput().contract, contractPrice: 400000 },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.details?.concessionPct).toBeGreaterThan(6);
  });

  it('flags when subject concessions far exceed comp concessions', () => {
    const result = analyzeConcessions(makeInput({
      concessions: { totalAmount: 25000, types: ['closing costs'], sellerPaidClosingCosts: 25000 },
      contract: { ...makeInput().contract, contractPrice: 425000 },
      compConcessions: [
        { address: 'Comp 1', concessionAmount: 2000, salePrice: 400000 },
        { address: 'Comp 2', concessionAmount: 3000, salePrice: 420000 },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.subjectConcessionPct).toBeGreaterThan(result.details?.avgCompConcessionPct);
  });

  it('passes with zero concessions', () => {
    const result = analyzeConcessions(makeInput({
      concessions: { totalAmount: 0, types: [], sellerPaidClosingCosts: 0 },
    }));
    expect(result.passed).toBe(true);
  });

  it('passes when concession data is not provided', () => {
    const result = analyzeConcessions(makeInput({ concessions: undefined }));
    expect(result.passed).toBe(true);
    expect(result.message).toContain('not provided');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. checkPriceReasonableness
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkPriceReasonableness', () => {
  it('passes when contract price is within 5% of appraised value', () => {
    const result = checkPriceReasonableness(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags when contract price exceeds appraised value by more than 5%', () => {
    const result = checkPriceReasonableness(makeInput({
      contract: { ...makeInput().contract, contractPrice: 500000 },
      appraisedValue: 430000,
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.details?.variancePct).toBeGreaterThan(5);
  });

  it('flags when contract price is well below appraised value', () => {
    const result = checkPriceReasonableness(makeInput({
      contract: { ...makeInput().contract, contractPrice: 350000 },
      appraisedValue: 430000,
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.direction).toBe('below');
  });

  it('warns when price exactly equals appraised value (confirmation bias risk)', () => {
    const result = checkPriceReasonableness(makeInput({
      contract: { ...makeInput().contract, contractPrice: 430000 },
      appraisedValue: 430000,
    }));
    // Exact match is a warning, not a failure — it's suspicious but not necessarily wrong
    expect(result.severity).toBe('low');
  });

  it('passes when appraised value is not available', () => {
    const result = checkPriceReasonableness(makeInput({ appraisedValue: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. checkFinancingTerms
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkFinancingTerms', () => {
  it('passes with conventional financing', () => {
    const result = checkFinancingTerms(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags seller buydown', () => {
    const result = checkFinancingTerms(makeInput({
      financingTerms: { ...makeInput().financingTerms, sellerBuydown: true, buydownAmount: 12000 },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.details?.flags).toContain('seller buydown');
  });

  it('flags assumption financing', () => {
    const result = checkFinancingTerms(makeInput({
      financingTerms: { ...makeInput().financingTerms, loanType: 'assumption' },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.flags).toContain('non-standard loan type');
  });

  it('flags LTV exceeding 100%', () => {
    const result = checkFinancingTerms(makeInput({
      financingTerms: { ...makeInput().financingTerms, loanAmount: 450000 },
      contract: { ...makeInput().contract, contractPrice: 425000 },
    }));
    expect(result.passed).toBe(false);
    expect(result.details?.ltv).toBeGreaterThan(100);
  });

  it('passes when financing data not provided', () => {
    const result = checkFinancingTerms(makeInput({ financingTerms: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. checkPersonalPropertyInclusion
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkPersonalPropertyInclusion', () => {
  it('passes when no personal property in contract', () => {
    const result = checkPersonalPropertyInclusion(makeInput());
    expect(result.passed).toBe(true);
  });

  it('flags personal property included in contract but not separated in appraisal', () => {
    const result = checkPersonalPropertyInclusion(makeInput({
      personalProperty: {
        includedInContract: ['washer/dryer', 'refrigerator', 'riding mower'],
        includedInAppraisal: false,
        estimatedValue: 3500,
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.details?.items).toHaveLength(3);
    expect(result.details?.estimatedValue).toBe(3500);
  });

  it('passes when personal property is in contract AND acknowledged in appraisal', () => {
    const result = checkPersonalPropertyInclusion(makeInput({
      personalProperty: {
        includedInContract: ['washer/dryer'],
        includedInAppraisal: true,
        estimatedValue: 1200,
      },
    }));
    expect(result.passed).toBe(true);
  });

  it('passes when personal property data not provided', () => {
    const result = checkPersonalPropertyInclusion(makeInput({ personalProperty: undefined }));
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Evaluator registry
// ═══════════════════════════════════════════════════════════════════════════════

describe('CONTRACT_EVALUATORS registry', () => {
  it('contains all 6 evaluators', () => {
    expect(Object.keys(CONTRACT_EVALUATORS)).toHaveLength(6);
  });

  it('all evaluators are functions', () => {
    for (const evaluator of Object.values(CONTRACT_EVALUATORS)) {
      expect(typeof evaluator).toBe('function');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ContractReviewService.performReview (aggregate)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ContractReviewService.performReview', () => {
  let service: ContractReviewService;

  beforeEach(() => {
    service = new ContractReviewService();
  });

  it('returns pass for a clean purchase transaction', () => {
    const report = service.performReview('ORD-001', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
    expect(report.orderId).toBe('ORD-001');
    expect(report.reportDate).toBeInstanceOf(Date);
    expect(report.checks).toHaveLength(6);
  });

  it('returns fail for critical arm-length violation', () => {
    const report = service.performReview('ORD-002', makeInput({
      armLengthIndicators: { ...makeInput().armLengthIndicators, relatedParty: true },
    }));
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThanOrEqual(1);
  });

  it('returns warnings for non-critical issues', () => {
    const report = service.performReview('ORD-003', makeInput({
      financingTerms: { ...makeInput().financingTerms, sellerBuydown: true, buydownAmount: 8000 },
    }));
    expect(report.overallStatus).toBe('warnings');
    expect(report.mediumIssues).toBeGreaterThanOrEqual(1);
  });

  it('aggregates multiple issues across evaluators', () => {
    const report = service.performReview('ORD-004', makeInput({
      contract: { ...makeInput().contract, fullyExecuted: false },
      armLengthIndicators: { ...makeInput().armLengthIndicators, familyRelationship: true },
      concessions: { totalAmount: 40000, types: ['closing costs'], sellerPaidClosingCosts: 40000 },
      contract: { ...makeInput().contract, fullyExecuted: false, contractPrice: 425000 },
    }));
    expect(report.totalIssues).toBeGreaterThanOrEqual(2);
  });
});
