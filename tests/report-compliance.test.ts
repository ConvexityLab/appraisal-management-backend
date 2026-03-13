/**
 * @file tests/report-compliance.test.ts
 * @description Phase 2.13 — Report Compliance Enhancements Tests
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  checkLicenseStatus,
  checkAddendaCompleteness,
  checkCertificationLanguage,
  checkEffectiveDateConsistency,
  checkSupervisoryCompliance,
  checkReportFormAppropriateness,
  REPORT_COMPLIANCE_EVALUATORS,
  ReportComplianceService,
  ReportComplianceInput,
} from '../src/services/report-compliance.service';

beforeAll(() => { console.log('🧪 Setting up test environment...'); console.log('✅ Test environment ready'); });
afterAll(() => { console.log('🧹 Cleaning up test environment...'); console.log('✅ Test cleanup complete'); });

function makeInput(overrides?: Partial<ReportComplianceInput>): ReportComplianceInput {
  return {
    appraiser: {
      name: 'Jane Doe',
      licenseNumber: 'CA-12345',
      licenseState: 'CA',
      licenseType: 'Certified Residential',
      licenseExpirationDate: '2027-12-31',
      signatureDate: '2026-01-20',
    },
    report: {
      reportType: '1004',
      propertyType: 'SFR',
      propertyState: 'CA',
      effectiveDate: '2026-01-15',
      reportDate: '2026-01-20',
    },
    addenda: {
      hasSubjectPhotos: true,
      hasCompPhotos: true,
      hasStreetMap: true,
      hasFloodMap: true,
      hasFloorPlan: true,
      hasMarketConditionsAddendum: true,
    },
    certification: {
      certificationText: 'I certify that I have no present or prospective interest in the property. My compensation is not contingent on the value. My analysis conformity with USPAP is affirmed. I made a personal inspection of the subject property. This report complies with USPAP standards.',
      certificationElements: [],
    },
    ...overrides,
  };
}

// ─── checkLicenseStatus ──────────────────────────────────────────────
describe('checkLicenseStatus', () => {
  it('passes for active license in correct state', () => {
    const result = checkLicenseStatus(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails for expired license', () => {
    const input = makeInput({
      appraiser: { ...makeInput().appraiser, licenseExpirationDate: '2025-06-30' },
    });
    const result = checkLicenseStatus(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('expired');
  });

  it('fails for wrong state license', () => {
    const input = makeInput({
      appraiser: { ...makeInput().appraiser, licenseState: 'TX' },
    });
    const result = checkLicenseStatus(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.message).toContain('TX');
  });
});

// ─── checkAddendaCompleteness ────────────────────────────────────────
describe('checkAddendaCompleteness', () => {
  it('passes when all required addenda present for 1004', () => {
    const result = checkAddendaCompleteness(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when subject photos missing', () => {
    const input = makeInput({ addenda: { ...makeInput().addenda, hasSubjectPhotos: false } });
    const result = checkAddendaCompleteness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('fails when multiple addenda missing', () => {
    const input = makeInput({
      addenda: {
        hasSubjectPhotos: false,
        hasCompPhotos: false,
        hasStreetMap: true,
        hasFloodMap: true,
        hasFloorPlan: true,
        hasMarketConditionsAddendum: false,
      },
    });
    const result = checkAddendaCompleteness(input);
    expect(result.passed).toBe(false);
    const details = result.details as { missing: string[] } | undefined;
    expect(details?.missing.length).toBe(3);
  });

  it('passes for non-1004 report types', () => {
    const input = makeInput({ report: { ...makeInput().report, reportType: '2055' } });
    const result = checkAddendaCompleteness(input);
    expect(result.passed).toBe(true);
  });
});

// ─── checkCertificationLanguage ──────────────────────────────────────
describe('checkCertificationLanguage', () => {
  it('passes when all key cert phrases present', () => {
    const result = checkCertificationLanguage(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when certification is missing entirely', () => {
    const input = makeInput({ certification: { certificationText: null, certificationElements: [] } });
    const result = checkCertificationLanguage(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('flags incomplete certification language', () => {
    const input = makeInput({
      certification: { certificationText: 'I certify that I conducted a personal inspection.', certificationElements: [] },
    });
    const result = checkCertificationLanguage(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('missing key phrases');
  });
});

// ─── checkEffectiveDateConsistency ───────────────────────────────────
describe('checkEffectiveDateConsistency', () => {
  it('passes for consistent dates', () => {
    const result = checkEffectiveDateConsistency(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when signature is before effective date', () => {
    const input = makeInput({
      appraiser: { ...makeInput().appraiser, signatureDate: '2026-01-10' },
    });
    const result = checkEffectiveDateConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Signature date');
  });

  it('fails when report date is more than 120 days after effective date', () => {
    const input = makeInput({
      report: { ...makeInput().report, reportDate: '2026-06-15' },
      appraiser: { ...makeInput().appraiser, signatureDate: '2026-06-15' },
    });
    const result = checkEffectiveDateConsistency(input);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('120');
  });
});

// ─── checkSupervisoryCompliance ──────────────────────────────────────
describe('checkSupervisoryCompliance', () => {
  it('passes for non-trainee — no supervisor needed', () => {
    const result = checkSupervisoryCompliance(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails for trainee without supervisor', () => {
    const input = makeInput({
      appraiser: { ...makeInput().appraiser, licenseType: 'Trainee' },
    });
    const result = checkSupervisoryCompliance(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('passes for trainee with valid supervisor', () => {
    const input = makeInput({
      appraiser: {
        ...makeInput().appraiser,
        licenseType: 'Trainee',
        supervisoryAppraiser: {
          name: 'John Supervisor',
          licenseNumber: 'CA-99999',
          licenseState: 'CA',
          licenseType: 'Certified Residential',
          licenseExpirationDate: '2027-12-31',
          signatureDate: '2026-01-20',
        },
      },
    });
    const result = checkSupervisoryCompliance(input);
    expect(result.passed).toBe(true);
  });

  it('fails when supervisor also has trainee license', () => {
    const input = makeInput({
      appraiser: {
        ...makeInput().appraiser,
        licenseType: 'Trainee',
        supervisoryAppraiser: {
          name: 'Bad Supervisor',
          licenseNumber: 'CA-11111',
          licenseState: 'CA',
          licenseType: 'Trainee',
          licenseExpirationDate: '2027-12-31',
          signatureDate: '2026-01-20',
        },
      },
    });
    const result = checkSupervisoryCompliance(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('critical');
  });
});

// ─── checkReportFormAppropriateness ──────────────────────────────────
describe('checkReportFormAppropriateness', () => {
  it('passes when form matches property type', () => {
    const result = checkReportFormAppropriateness(makeInput());
    expect(result.passed).toBe(true);
  });

  it('fails when wrong form for property type', () => {
    const input = makeInput({
      report: { ...makeInput().report, propertyType: 'Condo', reportType: '1004' },
    });
    const result = checkReportFormAppropriateness(input);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.message).toContain('1073');
  });

  it('passes for unrecognized property type', () => {
    const input = makeInput({
      report: { ...makeInput().report, propertyType: 'Mixed-Use' },
    });
    const result = checkReportFormAppropriateness(input);
    expect(result.passed).toBe(true);
  });
});

// ─── Registry ────────────────────────────────────────────────────────
describe('REPORT_COMPLIANCE_EVALUATORS registry', () => {
  it('contains all 6 evaluators', () => {
    expect(Object.keys(REPORT_COMPLIANCE_EVALUATORS)).toHaveLength(6);
    expect(REPORT_COMPLIANCE_EVALUATORS).toHaveProperty('checkLicenseStatus');
    expect(REPORT_COMPLIANCE_EVALUATORS).toHaveProperty('checkAddendaCompleteness');
    expect(REPORT_COMPLIANCE_EVALUATORS).toHaveProperty('checkCertificationLanguage');
    expect(REPORT_COMPLIANCE_EVALUATORS).toHaveProperty('checkEffectiveDateConsistency');
    expect(REPORT_COMPLIANCE_EVALUATORS).toHaveProperty('checkSupervisoryCompliance');
    expect(REPORT_COMPLIANCE_EVALUATORS).toHaveProperty('checkReportFormAppropriateness');
  });
});

// ─── Aggregate Service ──────────────────────────────────────────────
describe('ReportComplianceService.performReview', () => {
  it('returns pass for fully compliant report', () => {
    const svc = new ReportComplianceService();
    const report = svc.performReview('order-rc-1', makeInput());
    expect(report.overallStatus).toBe('pass');
    expect(report.totalIssues).toBe(0);
  });

  it('returns fail for expired license', () => {
    const input = makeInput({
      appraiser: { ...makeInput().appraiser, licenseExpirationDate: '2025-01-01' },
    });
    const svc = new ReportComplianceService();
    const report = svc.performReview('order-rc-2', input);
    expect(report.overallStatus).toBe('fail');
    expect(report.criticalIssues).toBeGreaterThan(0);
  });
});
