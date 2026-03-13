/**
 * @file tests/scope-lock-validation.test.ts
 * @description Tests for Phase 2.1 — Scope Lock-in Validation Service
 *
 * Validates that the delivered appraisal report conforms to the locked engagement scope.
 * Detects mismatches in report type, property rights, intended use/users, value types,
 * effective dates, property type, and unauthorized scope changes after lock-in.
 *
 * References: USPAP SR 1-2, Fannie Mae B4-1.1, FHFA guidance
 */
import { describe, it, expect } from 'vitest';
import {
  checkReportTypeAlignment,
  checkPropertyRightsAlignment,
  checkIntendedUseAlignment,
  checkValueTypeAlignment,
  checkEffectiveDateAlignment,
  checkPropertyTypeConsistency,
  checkScopeChangeApproval,
  SCOPE_LOCK_EVALUATORS,
  ScopeLockValidationService,
  type ScopeLockInput,
} from '../src/services/scope-lock-validation.service';

function makeInput(overrides?: Partial<ScopeLockInput>): ScopeLockInput {
  return {
    engagementScope: {
      reportType: '1004',
      productType: 'FULL_APPRAISAL',
      propertyRightsAppraised: 'Fee Simple',
      intendedUse: 'Mortgage lending decision by the lender/client',
      intendedUsers: ['ABC Mortgage Co.'],
      valueTypes: ['AS_IS'],
      effectiveDate: '2026-03-10',
      propertyType: 'SINGLE_FAMILY',
      useCase: 'origination',
      lockInTimestamp: '2026-03-01T12:00:00Z',
    },
    reportScope: {
      reportType: '1004',
      propertyRightsAppraised: 'Fee Simple',
      intendedUse: 'Mortgage lending decision by the lender/client',
      intendedUsers: ['ABC Mortgage Co.'],
      valueTypes: ['AS_IS'],
      effectiveDate: '2026-03-10',
      propertyType: 'SINGLE_FAMILY',
    },
    ...overrides,
  };
}

// ─── checkReportTypeAlignment ─────────────────────────────────────────
describe('checkReportTypeAlignment', () => {
  it('passes when report type matches engagement', () => {
    const result = checkReportTypeAlignment(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when report type differs from engagement', () => {
    const result = checkReportTypeAlignment(makeInput({
      reportScope: { ...makeInput().reportScope, reportType: '1073' },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('1004');
    expect(result.message).toContain('1073');
  });

  it('fails when report type is missing from report', () => {
    const input = makeInput();
    delete (input.reportScope as Record<string, unknown>).reportType;
    const result = checkReportTypeAlignment(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('passes when engagement scope has no report type defined', () => {
    const input = makeInput();
    delete (input.engagementScope as Record<string, unknown>).reportType;
    const result = checkReportTypeAlignment(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkPropertyRightsAlignment ─────────────────────────────────────
describe('checkPropertyRightsAlignment', () => {
  it('passes when property rights match', () => {
    const result = checkPropertyRightsAlignment(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when property rights differ', () => {
    const result = checkPropertyRightsAlignment(makeInput({
      reportScope: { ...makeInput().reportScope, propertyRightsAppraised: 'Leasehold' },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('Fee Simple');
    expect(result.message).toContain('Leasehold');
  });

  it('passes when engagement has no property rights specified', () => {
    const input = makeInput();
    delete (input.engagementScope as Record<string, unknown>).propertyRightsAppraised;
    const result = checkPropertyRightsAlignment(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkIntendedUseAlignment ────────────────────────────────────────
describe('checkIntendedUseAlignment', () => {
  it('passes when intended use and users match', () => {
    const result = checkIntendedUseAlignment(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when intended use differs', () => {
    const result = checkIntendedUseAlignment(makeInput({
      reportScope: { ...makeInput().reportScope, intendedUse: 'Estate settlement' },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('fails when intended users differ', () => {
    const result = checkIntendedUseAlignment(makeInput({
      reportScope: { ...makeInput().reportScope, intendedUsers: ['XYZ Bank'] },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('fails when report adds extra intended users not in engagement', () => {
    const result = checkIntendedUseAlignment(makeInput({
      reportScope: {
        ...makeInput().reportScope,
        intendedUsers: ['ABC Mortgage Co.', 'Unknown Party'],
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('passes when engagement has no intended use/users defined', () => {
    const input = makeInput();
    delete (input.engagementScope as Record<string, unknown>).intendedUse;
    delete (input.engagementScope as Record<string, unknown>).intendedUsers;
    const result = checkIntendedUseAlignment(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkValueTypeAlignment ──────────────────────────────────────────
describe('checkValueTypeAlignment', () => {
  it('passes when value types match', () => {
    const result = checkValueTypeAlignment(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when value types differ', () => {
    const result = checkValueTypeAlignment(makeInput({
      reportScope: {
        ...makeInput().reportScope,
        valueTypes: ['PROSPECTIVE_AS_COMPLETED'],
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('fails when report includes extra value types beyond engagement', () => {
    const result = checkValueTypeAlignment(makeInput({
      reportScope: {
        ...makeInput().reportScope,
        valueTypes: ['AS_IS', 'PROSPECTIVE_AS_COMPLETED'],
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('fails when report omits value types specified in engagement', () => {
    const result = checkValueTypeAlignment(makeInput({
      engagementScope: {
        ...makeInput().engagementScope,
        valueTypes: ['AS_IS', 'PROSPECTIVE_AS_COMPLETED'],
      },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('passes when engagement has no value types defined', () => {
    const input = makeInput();
    delete (input.engagementScope as Record<string, unknown>).valueTypes;
    const result = checkValueTypeAlignment(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkEffectiveDateAlignment ──────────────────────────────────────
describe('checkEffectiveDateAlignment', () => {
  it('passes when effective dates match', () => {
    const result = checkEffectiveDateAlignment(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when effective dates differ', () => {
    const result = checkEffectiveDateAlignment(makeInput({
      reportScope: { ...makeInput().reportScope, effectiveDate: '2026-04-15' },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('2026-03-10');
    expect(result.message).toContain('2026-04-15');
  });

  it('passes when engagement has no effective date defined', () => {
    const input = makeInput();
    delete (input.engagementScope as Record<string, unknown>).effectiveDate;
    const result = checkEffectiveDateAlignment(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkPropertyTypeConsistency ─────────────────────────────────────
describe('checkPropertyTypeConsistency', () => {
  it('passes when property types match', () => {
    const result = checkPropertyTypeConsistency(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when property type differs', () => {
    const result = checkPropertyTypeConsistency(makeInput({
      reportScope: { ...makeInput().reportScope, propertyType: 'CONDO' },
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('SINGLE_FAMILY');
    expect(result.message).toContain('CONDO');
  });

  it('passes when engagement has no property type defined', () => {
    const input = makeInput();
    delete (input.engagementScope as Record<string, unknown>).propertyType;
    const result = checkPropertyTypeConsistency(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkScopeChangeApproval ─────────────────────────────────────────
describe('checkScopeChangeApproval', () => {
  it('passes when no scope changes occurred', () => {
    const result = checkScopeChangeApproval(makeInput());
    expect(result.passed).toBe(true);
  });

  it('passes when scope changes are approved with fee/time reset', () => {
    const result = checkScopeChangeApproval(makeInput({
      scopeChanges: [
        {
          field: 'reportType',
          originalValue: '1004',
          newValue: '1073',
          changeTimestamp: '2026-03-05T10:00:00Z',
          clientApproved: true,
          feeAdjusted: true,
          dueDateAdjusted: true,
        },
      ],
    }));
    expect(result.passed).toBe(true);
  });

  it('fails when scope change lacks client approval', () => {
    const result = checkScopeChangeApproval(makeInput({
      scopeChanges: [
        {
          field: 'reportType',
          originalValue: '1004',
          newValue: '1073',
          changeTimestamp: '2026-03-05T10:00:00Z',
          clientApproved: false,
          feeAdjusted: true,
          dueDateAdjusted: true,
        },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('client approval');
  });

  it('warns when scope change has no fee adjustment', () => {
    const result = checkScopeChangeApproval(makeInput({
      scopeChanges: [
        {
          field: 'reportType',
          originalValue: '1004',
          newValue: '1073',
          changeTimestamp: '2026-03-05T10:00:00Z',
          clientApproved: true,
          feeAdjusted: false,
          dueDateAdjusted: true,
        },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('fee');
  });

  it('warns when scope change has no due date adjustment', () => {
    const result = checkScopeChangeApproval(makeInput({
      scopeChanges: [
        {
          field: 'propertyRightsAppraised',
          originalValue: 'Fee Simple',
          newValue: 'Leasehold',
          changeTimestamp: '2026-03-05T10:00:00Z',
          clientApproved: true,
          feeAdjusted: true,
          dueDateAdjusted: false,
        },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('medium');
    expect(result.message).toContain('due date');
  });

  it('flags multiple unapproved changes', () => {
    const result = checkScopeChangeApproval(makeInput({
      scopeChanges: [
        {
          field: 'reportType',
          originalValue: '1004',
          newValue: '1073',
          changeTimestamp: '2026-03-05T10:00:00Z',
          clientApproved: false,
          feeAdjusted: false,
          dueDateAdjusted: false,
        },
        {
          field: 'valueTypes',
          originalValue: 'AS_IS',
          newValue: 'PROSPECTIVE_AS_COMPLETED',
          changeTimestamp: '2026-03-06T10:00:00Z',
          clientApproved: false,
          feeAdjusted: false,
          dueDateAdjusted: false,
        },
      ],
    }));
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.details?.unapprovedChanges).toHaveLength(2);
  });
});

// ─── SCOPE_LOCK_EVALUATORS registry ──────────────────────────────────
describe('SCOPE_LOCK_EVALUATORS registry', () => {
  it('contains all 7 evaluators', () => {
    expect(Object.keys(SCOPE_LOCK_EVALUATORS)).toHaveLength(7);
  });

  it('all evaluators are functions', () => {
    for (const [name, fn] of Object.entries(SCOPE_LOCK_EVALUATORS)) {
      expect(typeof fn).toBe('function');
    }
  });
});

// ─── Aggregate report ─────────────────────────────────────────────────
describe('ScopeLockValidationService.performValidation', () => {
  const service = new ScopeLockValidationService();

  it('returns pass for fully aligned engagement and report', () => {
    const report = service.performValidation('ORD-100', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
    expect(report.checks).toHaveLength(7);
    expect(report.orderId).toBe('ORD-100');
    expect(report.reportDate).toBeInstanceOf(Date);
  });

  it('returns fail for critical scope mismatches', () => {
    const report = service.performValidation('ORD-101', makeInput({
      reportScope: { ...makeInput().reportScope, reportType: '2055' },
    }));
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThanOrEqual(1);
  });

  it('returns warnings for non-critical issues only', () => {
    const report = service.performValidation('ORD-102', makeInput({
      reportScope: { ...makeInput().reportScope, propertyType: 'TOWNHOME' },
    }));
    expect(report.overallStatus).toBe('warnings');
    expect(report.criticalIssues).toBe(0);
    expect(report.highIssues).toBeGreaterThanOrEqual(1);
  });

  it('aggregates issues across multiple evaluators', () => {
    const report = service.performValidation('ORD-103', makeInput({
      reportScope: {
        ...makeInput().reportScope,
        reportType: '1073',
        propertyRightsAppraised: 'Leasehold',
        effectiveDate: '2026-05-01',
      },
    }));
    expect(report.totalIssues).toBeGreaterThanOrEqual(3);
    expect(report.criticalIssues).toBeGreaterThanOrEqual(2);
  });
});
