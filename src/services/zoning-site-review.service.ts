/**
 * @file src/services/zoning-site-review.service.ts
 * @description Phase 2.5 — Zoning & Site Analysis Review Service
 *
 * Validates zoning compliance, flood zone documentation, HBU analysis,
 * utility documentation, and site dimension consistency.
 *
 * References: USPAP SR 1-3(b), Fannie Mae B4-1.3-04
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

export interface SiteData {
  lotSizeSqFt?: number;
  siteDimensions?: string | null;
  siteShape?: string | null;
  zoningDescription?: string | null;
  locationRating?: string;
  siteAreaUnit?: 'sf' | 'acres' | null;
}

export interface ZoningData {
  zoning?: string | null;
  zoningCompliance?: 'Legal' | 'LegalNonConforming' | 'Illegal' | null;
  zoningDescription?: string | null;
  propertyType?: string;
}

export interface FloodData {
  floodZone?: string | null;
  floodMapNumber?: string | null;
  floodMapDate?: string | null;
}

export interface HbuData {
  highestAndBestUseAnalysis?: {
    asVacant: HbuTestSetInput | null;
    asImproved: HbuTestSetInput | null;
    conclusion: string | null;
    currentUseIsHbu: boolean | null;
    alternativeUse?: string | null;
  } | null;
}

export interface HbuTestSetInput {
  legallyPermissible: HbuTestInput | null;
  physicallyPossible: HbuTestInput | null;
  financiallyFeasible: HbuTestInput | null;
  maximallyProductive: HbuTestInput | null;
}

export interface HbuTestInput {
  passed: boolean;
  narrative: string | null;
  supportingEvidence?: string | null;
}

export interface UtilityData {
  utilities?: {
    electricity?: string;
    gas?: string;
    water?: string;
    sewer?: string;
  } | null;
}

export interface ZoningSiteReviewInput {
  site: SiteData;
  zoning: ZoningData;
  flood: FloodData;
  hbu: HbuData;
  utilities: UtilityData;
}

export interface ZoningSiteResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface ZoningSiteCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface ZoningSiteReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: ZoningSiteCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

export type ZoningSiteEvaluator = (input: ZoningSiteReviewInput) => ZoningSiteResult;

// ── Constants ────────────────────────────────────────────────────────

const HIGH_RISK_FLOOD_ZONES = ['A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE'];
const HBU_TEST_NAMES = ['legallyPermissible', 'physicallyPossible', 'financiallyFeasible', 'maximallyProductive'] as const;

// ── Evaluators ───────────────────────────────────────────────────────

export function checkZoningCompliance(input: ZoningSiteReviewInput): ZoningSiteResult {
  const { zoning } = input;

  if (!zoning.zoning && !zoning.zoningDescription) {
    return {
      passed: false,
      message: 'Zoning classification and description are both missing. Zoning must be documented per Fannie Mae B4-1.3-04.',
      severity: 'high',
      details: { zoning: zoning.zoning, description: zoning.zoningDescription },
    };
  }

  if (zoning.zoningCompliance === 'Illegal') {
    return {
      passed: false,
      message: 'Property use is classified as illegal under current zoning. This is a critical finding that affects marketability and lendability.',
      severity: 'critical',
      details: { zoningCompliance: zoning.zoningCompliance },
    };
  }

  if (zoning.zoningCompliance === 'LegalNonConforming') {
    return {
      passed: false,
      message: 'Property is legal non-conforming. Appraiser must address impact on marketability, insurability, and ability to rebuild.',
      severity: 'medium',
      details: { zoningCompliance: zoning.zoningCompliance },
    };
  }

  return { passed: true, message: 'Zoning is documented and compliant.', severity: 'high' };
}

export function checkFloodZoneDocumentation(input: ZoningSiteReviewInput): ZoningSiteResult {
  const { flood } = input;
  const issues: string[] = [];

  if (!flood.floodZone) {
    issues.push('Flood zone designation is missing');
  }

  if (!flood.floodMapNumber) {
    issues.push('FEMA flood map panel number is not documented');
  }

  if (!flood.floodMapDate) {
    issues.push('Flood map effective date is not documented');
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Flood zone documentation incomplete: ${issues.join('; ')}. All FEMA flood zone data is required per Fannie Mae guidelines.`,
      severity: 'high',
      details: { issues },
    };
  }

  if (flood.floodZone && HIGH_RISK_FLOOD_ZONES.includes(flood.floodZone.toUpperCase())) {
    return {
      passed: false,
      message: `Property is in high-risk flood zone ${flood.floodZone}. Flood insurance is required and impacts marketability analysis.`,
      severity: 'medium',
      details: { floodZone: flood.floodZone, isHighRisk: true },
    };
  }

  return { passed: true, message: 'Flood zone documentation is complete.', severity: 'high' };
}

export function checkHbuAnalysis(input: ZoningSiteReviewInput): ZoningSiteResult {
  const hbu = input.hbu.highestAndBestUseAnalysis;

  if (!hbu) {
    return {
      passed: false,
      message: 'Highest and Best Use analysis is missing. USPAP requires HBU analysis in all appraisal reports.',
      severity: 'critical',
    };
  }

  const issues: string[] = [];

  // Check as-improved tests (most common for existing improvements)
  if (hbu.asImproved) {
    for (const testName of HBU_TEST_NAMES) {
      const test = hbu.asImproved[testName];
      if (!test) {
        issues.push(`As-improved: ${testName} test not performed`);
      } else if (!test.narrative || test.narrative.trim().length < 10) {
        issues.push(`As-improved: ${testName} test lacks narrative support`);
      }
    }
  } else {
    issues.push('As-improved HBU analysis is missing');
  }

  if (!hbu.conclusion || hbu.conclusion.trim().length < 10) {
    issues.push('HBU conclusion is missing or insufficient');
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `HBU analysis deficiencies: ${issues.join('; ')}. Per USPAP SR 1-3(b), the appraiser must analyze the HBU of the property.`,
      severity: issues.some(i => i.includes('missing')) ? 'high' : 'medium',
      details: { issues, currentUseIsHbu: hbu.currentUseIsHbu },
    };
  }

  return { passed: true, message: 'Highest and Best Use analysis is complete with four-test framework.', severity: 'critical' };
}

export function checkUtilityDocumentation(input: ZoningSiteReviewInput): ZoningSiteResult {
  const utils = input.utilities.utilities;

  if (!utils) {
    return {
      passed: false,
      message: 'Utility information is not documented. Electric, gas, water, and sewer must be reported.',
      severity: 'medium',
    };
  }

  const missing: string[] = [];
  if (!utils.electricity) missing.push('electricity');
  if (!utils.water) missing.push('water');
  if (!utils.sewer) missing.push('sewer');

  if (missing.length > 0) {
    return {
      passed: false,
      message: `Utility documentation incomplete: ${missing.join(', ')} not specified.`,
      severity: 'medium',
      details: { missing },
    };
  }

  return { passed: true, message: 'Utility documentation is complete.', severity: 'medium' };
}

export function checkSiteDimensionConsistency(input: ZoningSiteReviewInput): ZoningSiteResult {
  const { site } = input;

  if (!site.lotSizeSqFt || site.lotSizeSqFt <= 0) {
    return {
      passed: false,
      message: 'Lot size is missing or zero. Site area must be documented.',
      severity: 'high',
    };
  }

  // If lot size > 5 acres and site area unit is 'sf', flag potential unit confusion
  if (site.lotSizeSqFt > 217800 && site.siteAreaUnit === 'sf') {
    return {
      passed: false,
      message: `Lot size is ${site.lotSizeSqFt.toLocaleString()} sq ft (${(site.lotSizeSqFt / 43560).toFixed(2)} acres). For lots over 5 acres, verify area unit and consider if property is residential.`,
      severity: 'medium',
      details: { lotSizeSqFt: site.lotSizeSqFt, acres: Math.round(site.lotSizeSqFt / 43560 * 100) / 100 },
    };
  }

  return { passed: true, message: 'Site dimensions are documented and reasonable.', severity: 'high' };
}

export function checkLegalDescriptionPresence(input: ZoningSiteReviewInput): ZoningSiteResult {
  // Legal description check uses zoning.zoningDescription as proxy for now
  // In production, this would check the CanonicalSubject.legalDescription field
  const { zoning } = input;

  if (!zoning.zoningDescription || zoning.zoningDescription.trim().length < 5) {
    return {
      passed: false,
      message: 'Zoning description is missing or too brief. A clear description of the zoning classification and permitted uses should be provided.',
      severity: 'medium',
    };
  }

  return { passed: true, message: 'Zoning description is documented.', severity: 'medium' };
}

// ── Registry ─────────────────────────────────────────────────────────

export const ZONING_SITE_EVALUATORS: Record<string, ZoningSiteEvaluator> = {
  checkZoningCompliance,
  checkFloodZoneDocumentation,
  checkHbuAnalysis,
  checkUtilityDocumentation,
  checkSiteDimensionConsistency,
  checkLegalDescriptionPresence,
};

// ── Aggregate Service ────────────────────────────────────────────────

export class ZoningSiteReviewService {
  performReview(orderId: string, input: ZoningSiteReviewInput): ZoningSiteReport {
    const checks: ZoningSiteCheck[] = [];

    for (const [name, evaluator] of Object.entries(ZONING_SITE_EVALUATORS)) {
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
