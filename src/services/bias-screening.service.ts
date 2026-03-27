/**
 * ECOA/Fair Lending Bias Screening Service
 *
 * Phase 2.2 — Created 2026-03-11
 *
 * Scans appraisal report text for prohibited factors and inadvertent bias
 * language per ECOA (Equal Credit Opportunity Act, 15 U.S.C. § 1691),
 * Fair Housing Act (42 U.S.C. § 3604-3606), FHFA Appraisal Bias guidance,
 * and Fannie Mae Selling Guide B4-1.4-08.
 *
 * Architecture follows the USPAP evaluator-registry pattern:
 *   - Pure-function evaluators in a named registry (BIAS_EVALUATORS)
 *   - Aggregate BiasScreeningReport with severity-counted checks
 *   - Designed to plug into QC engine's performComplianceQC()
 */

import { Logger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface BiasScreeningResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, any>;
}

export type BiasEvaluator = (input: BiasScreeningInput) => BiasScreeningResult;

export interface BiasScreeningInput {
  /** Full narrative text from the appraisal report */
  narrative?: string;
  /** Neighborhood description section */
  neighborhoodDescription?: string;
  /** Market conditions commentary */
  marketConditionsCommentary?: string;
  /** Condition/quality ratings text */
  conditionQualityCommentary?: string;
  /** Subject property details */
  subjectProperty?: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  };
  /** Comparable properties used in the report */
  comparables?: Array<{
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
    locationAdjustment?: number;
    salePrice?: number;
  }>;
  /** Engagement/assignment details (what was ordered) */
  engagement?: {
    client?: string;
    intendedUse?: string;
    intendedUsers?: string[];
    valueType?: string;
    effectiveDate?: string;
  };
  /** Report-stated details (what the appraiser delivered) */
  reportStated?: {
    client?: string;
    intendedUse?: string;
    intendedUsers?: string[];
    valueType?: string;
    effectiveDate?: string;
  };
}

export interface BiasScreeningCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, any>;
}

export interface BiasScreeningReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: BiasScreeningCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Prohibited term lists (Fair Housing Act + ECOA protected bases)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Racial/ethnic demographic terms that must not appear in appraisal
 * neighborhood descriptions, condition narratives, or market commentary.
 * Per Fannie Mae Selling Guide B4-1.4-08 and ECOA Reg B.
 */
const PROHIBITED_DEMOGRAPHIC_TERMS: readonly string[] = [
  'african american',
  'african-american',
  'black neighborhood',
  'black area',
  'white neighborhood',
  'white area',
  'caucasian',
  'hispanic neighborhood',
  'hispanic area',
  'latino neighborhood',
  'latino area',
  'asian neighborhood',
  'asian area',
  'arab neighborhood',
  'arab area',
  'predominantly black',
  'predominantly white',
  'predominantly hispanic',
  'predominantly asian',
  'predominantly latino',
  'racially mixed',
  'racial composition',
  'ethnic composition',
  'ethnic makeup',
  'racial makeup',
  'minority area',
  'minority neighborhood',
  'minority concentration',
];

/**
 * Coded phrases identified by fair lending regulators as potential bias
 * indicators. Per FHFA Appraisal Bias guidance and Fannie Mae quality alerts.
 */
const CODED_BIAS_PHRASES: readonly string[] = [
  'pride of ownership',
  'lack of pride',
  'undesirable element',
  'undesirable',
  'crime-ridden',
  'crime ridden',
  'high crime area',
  'bad neighborhood',
  'bad area',
  'ghetto',
  'barrio',
  'wrong side of the tracks',
  'rough area',
  'sketchy area',
  'sketchy neighborhood',
  'not safe',
  'unsafe area',
  'unsafe neighborhood',
];

/**
 * Trend/characterization phrases that require supporting market data.
 * Without data support (DOM, absorption rate, etc.) these are flagged
 * as potentially unsupported bias characterizations.
 */
const UNSUPPORTED_TREND_PHRASES: readonly string[] = [
  'declining neighborhood',
  'declining area',
  'deteriorating neighborhood',
  'deteriorating area',
  'changing neighborhood',
  'in transition',
  'up and coming',
  'up-and-coming',
  'gentrifying',
  'going downhill',
  'seen better days',
  'past its prime',
];

/**
 * Protected class references beyond race/ethnicity.
 * Fair Housing Act: familial status, disability, religion, national origin, sex.
 * ECOA adds: age, marital status, receipt of public assistance.
 */
const PROTECTED_CLASS_PHRASES: readonly string[] = [
  'no children',
  'child-free',
  'adult only',
  'adult community',
  'families with children',
  'too many children',
  'handicapped area',
  'disabled residents',
  'group home nearby',
  'halfway house',
  'immigrant area',
  'immigrant neighborhood',
  'foreign-born',
  'esl community',
  'non-english',
  'elderly area',
  'old people',
  'young families',
  'single mothers',
  'single parents',
  'welfare',
  'section 8',
  'public housing nearby',
  'near mosque',
  'near synagogue',
  'near temple',
  'church district',
  'religious community',
];

/**
 * Data support indicators — when present alongside trend language, the trend
 * claim is considered supported by objective data and not flagged.
 */
const DATA_SUPPORT_INDICATORS: readonly string[] = [
  'months of inventory',
  'absorption rate',
  'days on market',
  'dom ',
  'list-to-sale',
  'price trend',
  'mls data',
  'market data shows',
  'data indicates',
  'statistics show',
  'per mls',
  'according to',
  'based on data',
  'market analysis shows',
  'supported by',
];

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find all matching terms in text using word-boundary regex.
 * Returns the list of matched terms (lowercased).
 */
function findMatchingTerms(text: string, terms: readonly string[]): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const term of terms) {
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
    if (regex.test(text)) {
      found.push(term);
    }
  }
  return found;
}

/**
 * Combine all text fields from the input into a single string for scanning.
 */
function getAllText(input: BiasScreeningInput): string {
  return [
    input.narrative,
    input.neighborhoodDescription,
    input.marketConditionsCommentary,
    input.conditionQualityCommentary,
  ].filter(Boolean).join(' ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Evaluator functions (pure, exported for testability)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 1. Scan for explicit prohibited demographic terms in appraisal text.
 *    Fair Housing Act § 3604-3606; ECOA Reg B.
 */
export function scanProhibitedFactors(input: BiasScreeningInput): BiasScreeningResult {
  const text = getAllText(input);
  if (!text.trim()) {
    return { passed: true, message: 'No narrative text to scan.', severity: 'critical' };
  }

  const matches = findMatchingTerms(text, PROHIBITED_DEMOGRAPHIC_TERMS);
  if (matches.length > 0) {
    return {
      passed: false,
      message: `Prohibited demographic references found in appraisal text: ${matches.map(m => `"${m}"`).join(', ')}. Appraisal narratives must not reference racial, ethnic, or demographic composition per ECOA and Fair Housing Act.`,
      severity: 'critical',
      details: { matches, matchCount: matches.length },
    };
  }

  return {
    passed: true,
    message: 'No prohibited demographic references found in appraisal text.',
    severity: 'critical',
  };
}

/**
 * 2. Scan for coded/dog-whistle bias phrases.
 *    Per FHFA Appraisal Bias guidance and Fannie Mae quality alerts.
 */
export function scanSteeringLanguage(input: BiasScreeningInput): BiasScreeningResult {
  const text = getAllText(input);
  if (!text.trim()) {
    return { passed: true, message: 'No narrative text to scan.', severity: 'high' };
  }

  const matches = findMatchingTerms(text, CODED_BIAS_PHRASES);
  if (matches.length > 0) {
    return {
      passed: false,
      message: `Coded bias language found: ${matches.map(m => `"${m}"`).join(', ')}. These phrases have been identified by fair lending regulators as potential bias indicators.`,
      severity: 'high',
      details: { matches, matchCount: matches.length },
    };
  }

  return {
    passed: true,
    message: 'No coded bias language detected.',
    severity: 'high',
  };
}

/**
 * 3. Check for unsupported neighborhood trend claims.
 *    Trend words like "declining" require market data support (DOM, absorption rate, etc.).
 */
export function checkNeighborhoodNarrative(input: BiasScreeningInput): BiasScreeningResult {
  const text = getAllText(input);
  if (!text.trim()) {
    return { passed: true, message: 'No narrative text to scan.', severity: 'medium' };
  }

  const matches = findMatchingTerms(text, UNSUPPORTED_TREND_PHRASES);
  if (matches.length === 0) {
    return {
      passed: true,
      message: 'No unsupported trend characterizations found.',
      severity: 'medium',
    };
  }

  // Check if data support phrases are present alongside the trend claims
  const lowerText = text.toLowerCase();
  const hasDataSupport = DATA_SUPPORT_INDICATORS.some(indicator =>
    lowerText.includes(indicator),
  );

  if (hasDataSupport) {
    return {
      passed: true,
      message: `Trend language found (${matches.map(m => `"${m}"`).join(', ')}) but data support indicators are present.`,
      severity: 'medium',
      details: { matches, dataSupported: true },
    };
  }

  return {
    passed: false,
    message: `Unsupported trend characterizations found: ${matches.map(m => `"${m}"`).join(', ')}. Market trend claims must be supported by objective data (DOM, absorption rate, price trends, etc.).`,
    severity: 'medium',
    details: { matches, dataSupported: false },
  };
}

/**
 * 4. Scan for protected class references beyond race/ethnicity.
 *    Fair Housing Act protected classes + ECOA additions.
 */
export function scanProtectedClassReferences(input: BiasScreeningInput): BiasScreeningResult {
  const text = getAllText(input);
  if (!text.trim()) {
    return { passed: true, message: 'No narrative text to scan.', severity: 'high' };
  }

  const matches = findMatchingTerms(text, PROTECTED_CLASS_PHRASES);
  if (matches.length > 0) {
    return {
      passed: false,
      message: `Protected class references found: ${matches.map(m => `"${m}"`).join(', ')}. Appraisals should not characterize neighborhoods by protected class status.`,
      severity: 'high',
      details: { matches, matchCount: matches.length },
    };
  }

  return {
    passed: true,
    message: 'No protected class references found in appraisal text.',
    severity: 'high',
  };
}

/**
 * 5. Check comparable selection geographic diversity.
 *    Flags if all comps share the same zip code that differs from the subject —
 *    a pattern that may indicate geographic steering.
 */
export function checkCompGeographicDiversity(input: BiasScreeningInput): BiasScreeningResult {
  const comps = input.comparables;
  if (!comps || comps.length < 2) {
    return {
      passed: true,
      message: 'Insufficient comparables to assess geographic diversity.',
      severity: 'medium',
    };
  }

  const subjectZip = input.subjectProperty?.zipCode;
  if (!subjectZip) {
    return {
      passed: true,
      message: 'Subject zip code not available for geographic diversity check.',
      severity: 'medium',
    };
  }

  const compZips = comps.map(c => c.zipCode).filter(Boolean) as string[];
  if (compZips.length === 0) {
    return {
      passed: true,
      message: 'Comparable zip codes not available.',
      severity: 'medium',
    };
  }

  const uniqueZips = new Set(compZips);
  const allSameZip = uniqueZips.size === 1;
  const compZip = compZips[0];
  const allDifferentFromSubject = allSameZip && compZip !== subjectZip;

  if (allDifferentFromSubject) {
    return {
      passed: false,
      message: `All ${comps.length} comparables are from zip ${compZip}, which differs from subject zip ${subjectZip}. This pattern may indicate geographic steering — verify that closer comps in the subject's area were considered.`,
      severity: 'high',
      details: {
        subjectZip,
        compZips,
        uniqueCompZips: [...uniqueZips],
      },
    };
  }

  return {
    passed: true,
    message: 'Comparable selection shows adequate geographic diversity.',
    severity: 'medium',
    details: {
      subjectZip,
      uniqueCompZips: [...uniqueZips],
    },
  };
}

/**
 * 6. Check for suspicious location adjustment patterns.
 *    Flags when all location adjustments are in the same direction and exceed
 *    10% of average sale price — a pattern that may proxy for demographics.
 */
export function checkLocationAdjustments(input: BiasScreeningInput): BiasScreeningResult {
  const comps = input.comparables;
  if (!comps || comps.length < 2) {
    return {
      passed: true,
      message: 'Insufficient comparables to assess location adjustments.',
      severity: 'medium',
    };
  }

  const locAdjs = comps
    .map(c => c.locationAdjustment)
    .filter((adj): adj is number => adj !== undefined && adj !== null);

  if (locAdjs.length < 2) {
    return {
      passed: true,
      message: 'Insufficient location adjustments for pattern analysis.',
      severity: 'medium',
    };
  }

  const allNegative = locAdjs.every(a => a < 0);
  const allPositive = locAdjs.every(a => a > 0);
  const avgAbsAdj = locAdjs.reduce((sum, a) => sum + Math.abs(a), 0) / locAdjs.length;
  const maxAbsAdj = Math.max(...locAdjs.map(Math.abs));

  // Compute average sale price for percentage threshold
  const prices = comps
    .map(c => c.salePrice)
    .filter((p): p is number => p !== undefined && p > 0);
  const avgSalePrice = prices.length > 0
    ? prices.reduce((sum, p) => sum + p, 0) / prices.length
    : 0;
  const adjPctOfPrice = avgSalePrice > 0 ? (avgAbsAdj / avgSalePrice) * 100 : 0;

  // Flag: all adjustments same direction AND average > 10% of avg sale price
  if ((allNegative || allPositive) && adjPctOfPrice > 10) {
    return {
      passed: false,
      message: `All ${locAdjs.length} location adjustments are ${allNegative ? 'negative' : 'positive'} with avg magnitude ${adjPctOfPrice.toFixed(1)}% of sale price. Uniform large location adjustments may proxy for demographic factors — verify with objective location data.`,
      severity: 'high',
      details: {
        adjustments: locAdjs,
        direction: allNegative ? 'all-negative' : 'all-positive',
        avgAbsAdjustment: Math.round(avgAbsAdj),
        avgAbsPctOfPrice: Math.round(adjPctOfPrice * 10) / 10,
        maxAbsAdjustment: maxAbsAdj,
      },
    };
  }

  return {
    passed: true,
    message: 'Location adjustment pattern does not indicate potential bias.',
    severity: 'medium',
    details: {
      adjustmentCount: locAdjs.length,
      avgAbsAdjustment: Math.round(avgAbsAdj),
    },
  };
}

/**
 * 7. Validate engagement-vs-report alignment.
 *    ECOA requires that the delivered report matches the engagement terms.
 *    Mismatches may indicate scope drift or unauthorized assignment changes.
 */
export function validateEngagementAlignment(input: BiasScreeningInput): BiasScreeningResult {
  const eng = input.engagement;
  const rpt = input.reportStated;

  if (!eng || !rpt) {
    return {
      passed: true,
      message: 'Engagement or report data not provided — alignment check skipped.',
      severity: 'low',
    };
  }

  const mismatches: string[] = [];

  if (eng.client && rpt.client && eng.client.toLowerCase() !== rpt.client.toLowerCase()) {
    mismatches.push(`Client: engagement="${eng.client}" vs report="${rpt.client}"`);
  }
  if (eng.intendedUse && rpt.intendedUse && eng.intendedUse.toLowerCase() !== rpt.intendedUse.toLowerCase()) {
    mismatches.push(`Intended use: engagement="${eng.intendedUse}" vs report="${rpt.intendedUse}"`);
  }
  if (eng.valueType && rpt.valueType && eng.valueType.toLowerCase() !== rpt.valueType.toLowerCase()) {
    mismatches.push(`Value type: engagement="${eng.valueType}" vs report="${rpt.valueType}"`);
  }
  if (eng.effectiveDate && rpt.effectiveDate && eng.effectiveDate !== rpt.effectiveDate) {
    mismatches.push(`Effective date: engagement="${eng.effectiveDate}" vs report="${rpt.effectiveDate}"`);
  }

  if (mismatches.length > 0) {
    return {
      passed: false,
      message: `Engagement-to-report mismatches found: ${mismatches.join('; ')}. The delivered report must align with the engagement terms.`,
      severity: 'high',
      details: { mismatches },
    };
  }

  return {
    passed: true,
    message: 'Report aligns with engagement terms.',
    severity: 'high',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Evaluator Registry
// ═══════════════════════════════════════════════════════════════════════════════

export const BIAS_EVALUATORS: Record<string, BiasEvaluator> = {
  scanProhibitedFactors,
  scanSteeringLanguage,
  checkNeighborhoodNarrative,
  scanProtectedClassReferences,
  checkCompGeographicDiversity,
  checkLocationAdjustments,
  validateEngagementAlignment,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Service Class
// ═══════════════════════════════════════════════════════════════════════════════

export class BiasScreeningService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Run all bias screening evaluators against the input data.
   * Returns an aggregate report with severity counts and individual check results.
   */
  performScreening(orderId: string, input: BiasScreeningInput): BiasScreeningReport {
    this.logger.info('Starting ECOA/Fair Lending bias screening', { orderId });

    const checks: BiasScreeningCheck[] = [];

    for (const [name, evaluator] of Object.entries(BIAS_EVALUATORS)) {
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
        this.logger.error(`Bias evaluator "${name}" threw an error`, { error, orderId });
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

    const report: BiasScreeningReport = {
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

    this.logger.info('Bias screening complete', {
      orderId,
      overallStatus,
      totalIssues,
      criticalIssues,
    });

    return report;
  }
}
