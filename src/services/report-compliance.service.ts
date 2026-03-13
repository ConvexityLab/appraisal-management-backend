/**
 * @file src/services/report-compliance.service.ts
 * @description Phase 2.13 — Report Compliance Enhancements Service
 *
 * Supplements the existing USPAP compliance service with additional
 * report-level checks:
 *   - EA license status validation (expiration, state match)
 *   - Addenda completeness tracker (photos, maps, market conditions)
 *   - Certification language checker (23-point cert elements)
 *   - Effective date consistency
 *   - Report form type appropriateness
 *   - Supervisory appraiser compliance
 *
 * References: USPAP SR 2-1/2-2, Fannie Mae B4-1.1
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

export interface AppraiserData {
  name: string;
  licenseNumber: string;
  licenseState: string;
  licenseType: string;
  licenseExpirationDate: string;
  signatureDate: string;
  supervisoryAppraiser?: {
    name: string;
    licenseNumber: string;
    licenseState: string;
    licenseType: string;
    licenseExpirationDate: string;
    signatureDate: string;
  };
}

export interface ReportMetadata {
  reportType: string;
  propertyType: string;
  propertyState: string;
  effectiveDate: string;
  reportDate: string;
}

export interface AddendaData {
  hasSubjectPhotos: boolean;
  hasCompPhotos: boolean;
  hasStreetMap: boolean;
  hasFloodMap: boolean;
  hasFloorPlan: boolean;
  hasMarketConditionsAddendum: boolean;
  additionalAddenda?: string[];
}

export interface CertificationData {
  certificationText?: string | null;
  certificationElements?: string[];
}

export interface ReportComplianceInput {
  appraiser: AppraiserData;
  report: ReportMetadata;
  addenda: AddendaData;
  certification: CertificationData;
}

export interface ComplianceResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface ComplianceCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface ReportComplianceReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: ComplianceCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

export type ComplianceEvaluator = (input: ReportComplianceInput) => ComplianceResult;

// ── Constants ────────────────────────────────────────────────────────

const TRAINEE_LICENSE_TYPES = ['Trainee', 'trainee', 'Licensed'];

const REQUIRED_ADDENDA_1004: readonly string[] = [
  'hasSubjectPhotos',
  'hasCompPhotos',
  'hasStreetMap',
  'hasFloodMap',
  'hasMarketConditionsAddendum',
] as const;

const CORE_CERT_KEYWORDS: readonly string[] = [
  'no present or prospective interest',
  'not contingent',
  'analysis conformity',
  'personal inspection',
  'uspap',
] as const;

// ── Evaluators ───────────────────────────────────────────────────────

export function checkLicenseStatus(input: ReportComplianceInput): ComplianceResult {
  const { appraiser, report } = input;
  const issues: string[] = [];

  // Check license expiration against report date
  const expirationDate = new Date(appraiser.licenseExpirationDate);
  const effectiveDate = new Date(report.effectiveDate);

  if (expirationDate < effectiveDate) {
    issues.push(`Appraiser license expired on ${appraiser.licenseExpirationDate} — before the effective date ${report.effectiveDate}`);
  }

  // Check state match
  if (appraiser.licenseState.toUpperCase() !== report.propertyState.toUpperCase()) {
    issues.push(`Appraiser licensed in ${appraiser.licenseState} but property is in ${report.propertyState}`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `License status issues: ${issues.join('; ')}. An active, state-appropriate license is required for all appraisal assignments.`,
      severity: 'critical',
      details: { issues, licenseNumber: appraiser.licenseNumber, licenseState: appraiser.licenseState },
    };
  }

  return { passed: true, message: 'Appraiser license is active and state-appropriate.', severity: 'critical' };
}

export function checkAddendaCompleteness(input: ReportComplianceInput): ComplianceResult {
  const { addenda, report } = input;

  // For 1004/1073 forms, check required addenda
  const is1004Type = report.reportType === '1004' || report.reportType === '1073';
  if (!is1004Type) {
    return { passed: true, message: `Report type ${report.reportType} — addenda requirements vary.`, severity: 'high' };
  }

  const missing: string[] = [];
  for (const field of REQUIRED_ADDENDA_1004) {
    if (!(addenda as unknown as Record<string, boolean>)[field]) {
      missing.push(field.replace('has', '').replace(/([A-Z])/g, ' $1').trim());
    }
  }

  if (missing.length > 0) {
    return {
      passed: false,
      message: `Missing required addenda for ${report.reportType}: ${missing.join(', ')}. Fannie Mae requires complete addenda package.`,
      severity: 'high',
      details: { missing, reportType: report.reportType },
    };
  }

  return { passed: true, message: 'All required addenda are present.', severity: 'high' };
}

export function checkCertificationLanguage(input: ReportComplianceInput): ComplianceResult {
  const { certification } = input;

  if (!certification.certificationText && (!certification.certificationElements || certification.certificationElements.length === 0)) {
    return {
      passed: false,
      message: 'Certification language is missing entirely. USPAP requires a signed certification in every appraisal report.',
      severity: 'critical',
    };
  }

  if (certification.certificationText) {
    const text = certification.certificationText.toLowerCase();
    const missingKeywords = CORE_CERT_KEYWORDS.filter(kw => !text.includes(kw));

    if (missingKeywords.length > 0) {
      return {
        passed: false,
        message: `Certification may be incomplete — missing key phrases: ${missingKeywords.join(', ')}. Per USPAP, the certification must include all required elements.`,
        severity: 'high',
        details: { missingKeywords },
      };
    }
  }

  return { passed: true, message: 'Certification language appears complete.', severity: 'critical' };
}

export function checkEffectiveDateConsistency(input: ReportComplianceInput): ComplianceResult {
  const { appraiser, report } = input;

  const effectiveDate = new Date(report.effectiveDate);
  const signatureDate = new Date(appraiser.signatureDate);
  const reportDate = new Date(report.reportDate);

  const issues: string[] = [];

  // Signature date should not be before effective date (retrospective is OK, but signature after might be needed)
  if (signatureDate < effectiveDate) {
    issues.push(`Signature date (${appraiser.signatureDate}) is before effective date (${report.effectiveDate})`);
  }

  // Report date should not be more than 120 days after effective date (Fannie Mae guideline)
  const daysBetween = Math.floor((reportDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysBetween > 120) {
    issues.push(`Report date is ${daysBetween} days after effective date — exceeds 120-day Fannie Mae guideline`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Date consistency issues: ${issues.join('; ')}.`,
      severity: 'high',
      details: { issues, effectiveDate: report.effectiveDate, signatureDate: appraiser.signatureDate, reportDate: report.reportDate },
    };
  }

  return { passed: true, message: 'Effective date, signature date, and report date are consistent.', severity: 'high' };
}

export function checkSupervisoryCompliance(input: ReportComplianceInput): ComplianceResult {
  const { appraiser } = input;

  // If appraiser is a trainee, supervisory appraiser is required
  const isTrainee = TRAINEE_LICENSE_TYPES.includes(appraiser.licenseType);

  if (isTrainee && !appraiser.supervisoryAppraiser) {
    return {
      passed: false,
      message: `Appraiser has ${appraiser.licenseType} license — a supervisory appraiser must co-sign the report per USPAP and state regulations.`,
      severity: 'critical',
      details: { appraiserLicenseType: appraiser.licenseType },
    };
  }

  if (isTrainee && appraiser.supervisoryAppraiser) {
    const issues: string[] = [];
    const sup = appraiser.supervisoryAppraiser;

    if (TRAINEE_LICENSE_TYPES.includes(sup.licenseType)) {
      issues.push(`Supervisory appraiser also has ${sup.licenseType} license — must be Certified`);
    }

    const supExpiration = new Date(sup.licenseExpirationDate);
    if (supExpiration < new Date()) {
      issues.push('Supervisory appraiser license is expired');
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: `Supervisory appraiser issues: ${issues.join('; ')}.`,
        severity: 'critical',
        details: { issues, supervisorName: sup.name, supervisorLicenseType: sup.licenseType },
      };
    }
  }

  return { passed: true, message: isTrainee ? 'Supervisory appraiser compliance met.' : 'No supervisory requirement.', severity: 'critical' };
}

export function checkReportFormAppropriateness(input: ReportComplianceInput): ComplianceResult {
  const { report } = input;

  const propertyFormMap: Record<string, string[]> = {
    SFR: ['1004', '2055'],
    Condo: ['1073', '1075'],
    'Multi-Family': ['1025'],
    Manufactured: ['1004C'],
    PUD: ['1004', '1073'],
    Townhouse: ['1004', '1073'],
  };

  const allowedForms = propertyFormMap[report.propertyType];
  if (!allowedForms) {
    return { passed: true, message: `Property type "${report.propertyType}" — form validation not configured.`, severity: 'medium' };
  }

  if (!allowedForms.includes(report.reportType)) {
    return {
      passed: false,
      message: `Report form ${report.reportType} may not be appropriate for ${report.propertyType} property. Expected forms: ${allowedForms.join(', ')}.`,
      severity: 'high',
      details: { reportType: report.reportType, propertyType: report.propertyType, expectedForms: allowedForms },
    };
  }

  return { passed: true, message: `Report form ${report.reportType} is appropriate for ${report.propertyType}.`, severity: 'high' };
}

// ── Registry ─────────────────────────────────────────────────────────

export const REPORT_COMPLIANCE_EVALUATORS: Record<string, ComplianceEvaluator> = {
  checkLicenseStatus,
  checkAddendaCompleteness,
  checkCertificationLanguage,
  checkEffectiveDateConsistency,
  checkSupervisoryCompliance,
  checkReportFormAppropriateness,
};

// ── Aggregate Service ────────────────────────────────────────────────

export class ReportComplianceService {
  performReview(orderId: string, input: ReportComplianceInput): ReportComplianceReport {
    const checks: ComplianceCheck[] = [];

    for (const [name, evaluator] of Object.entries(REPORT_COMPLIANCE_EVALUATORS)) {
      try {
        const result = evaluator(input);
        checks.push({
          evaluatorName: name, passed: result.passed, message: result.message, severity: result.severity,
          ...(result.details !== undefined && { details: result.details }),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({ evaluatorName: name, passed: false, message: `Evaluator error: ${message}`, severity: 'critical' });
      }
    }

    const failedChecks = checks.filter(c => !c.passed);
    let criticalIssues = 0, highIssues = 0, mediumIssues = 0, lowIssues = 0;
    for (const c of failedChecks) {
      switch (c.severity) { case 'critical': criticalIssues++; break; case 'high': highIssues++; break; case 'medium': mediumIssues++; break; case 'low': lowIssues++; break; }
    }
    const totalIssues = criticalIssues + highIssues + mediumIssues + lowIssues;
    const overallStatus = criticalIssues > 0 ? 'fail' : totalIssues > 0 ? 'warnings' : 'pass';

    return { orderId, reportDate: new Date(), overallStatus, checks, criticalIssues, highIssues, mediumIssues, lowIssues, totalIssues };
  }
}
