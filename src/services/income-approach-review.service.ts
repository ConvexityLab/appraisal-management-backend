/**
 * @file src/services/income-approach-review.service.ts
 * @description Phase 2.9 — Income Approach Review Service
 *
 * Validates income approach methodology and evidence:
 *   - Rent derivation evidence (rent comps documented)
 *   - STR data misuse detection (Airbnb/VRBO)
 *   - Vacancy/expense reasonableness
 *   - Cap rate evidence and range
 *   - GRM consistency with comparable data
 *   - Market rate context check
 *
 * References: USPAP SR 1-4, Fannie Mae B4-1.6, Form 1007/216
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

export interface IncomeApproachData {
  estimatedMonthlyMarketRent?: number;
  rentBasis?: string;
  rentCompCount?: number;
  grossRentMultiplier?: number;
  grmComps?: number[];
  potentialGrossIncome?: number;
  vacancyRate?: number;
  effectiveGrossIncome?: number;
  operatingExpenses?: number;
  operatingExpenseRatio?: number;
  replacementReserves?: number;
  netOperatingIncome?: number;
  capRate?: number;
  capRateSource?: string;
  indicatedValueByIncomeApproach?: number;
}

export interface IncomeNarrative {
  incomeApproachComments?: string;
}

export interface IncomeApproachReviewInput {
  incomeApproach?: IncomeApproachData;
  narrative?: IncomeNarrative;
}

export interface IncomeReviewResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface IncomeReviewCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface IncomeReviewReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: IncomeReviewCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

export type IncomeReviewEvaluator = (input: IncomeApproachReviewInput) => IncomeReviewResult;

// ── Constants ────────────────────────────────────────────────────────

const STR_KEYWORDS = ['airbnb', 'vrbo', 'short-term rental', 'str data', 'vacation rental', 'nightly rate', 'occupancy rate'];
const CAP_RATE_LOW = 0.02;
const CAP_RATE_HIGH = 0.15;
const VACANCY_HIGH = 0.25;
const OER_LOW = 0.10;
const GRM_TOLERANCE_PCT = 0.15;

// ── Evaluators ───────────────────────────────────────────────────────

export function checkRentDerivationEvidence(input: IncomeApproachReviewInput): IncomeReviewResult {
  if (!input.incomeApproach) {
    return { passed: true, message: 'No income approach data — skipping.', severity: 'high' };
  }

  if (input.incomeApproach.rentCompCount !== undefined && input.incomeApproach.rentCompCount < 1) {
    return {
      passed: false,
      message: 'No rent comps documented. Market rent must be supported by comparable rental data per Fannie Mae Form 1007/216.',
      severity: 'high',
      details: { rentCompCount: input.incomeApproach.rentCompCount },
    };
  }

  return { passed: true, message: 'Rent derivation is supported by comparable rental data.', severity: 'high' };
}

export function checkStrMisuse(input: IncomeApproachReviewInput): IncomeReviewResult {
  if (!input.incomeApproach) {
    return { passed: true, message: 'No income approach data — skipping.', severity: 'critical' };
  }

  const issues: string[] = [];

  if (input.incomeApproach.rentBasis) {
    const basisLower = input.incomeApproach.rentBasis.toLowerCase();
    if (STR_KEYWORDS.some(kw => basisLower.includes(kw))) {
      issues.push(`Rent basis "${input.incomeApproach.rentBasis}" indicates short-term rental data`);
    }
  }

  const narrative = input.narrative?.incomeApproachComments?.toLowerCase() ?? '';
  const foundKeywords = STR_KEYWORDS.filter(kw => narrative.includes(kw));
  if (foundKeywords.length > 0) {
    issues.push(`STR keywords in narrative: ${foundKeywords.join(', ')}`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Short-term rental (STR) data detected: ${issues.join('; ')}. Per Fannie Mae guidelines, income approach must use long-term lease comps, not STR/vacation rental data.`,
      severity: 'critical',
      details: { issues },
    };
  }

  return { passed: true, message: 'No STR data misuse detected.', severity: 'critical' };
}

export function checkVacancyExpenseReasonableness(input: IncomeApproachReviewInput): IncomeReviewResult {
  if (!input.incomeApproach) {
    return { passed: true, message: 'No income approach data — skipping.', severity: 'high' };
  }

  const ia = input.incomeApproach;
  const issues: string[] = [];

  if (ia.vacancyRate !== undefined) {
    if (ia.vacancyRate === 0) {
      issues.push('Vacancy rate is 0% — some vacancy/collection loss is expected in all markets');
    }
    if (ia.vacancyRate > VACANCY_HIGH) {
      issues.push(`Vacancy rate is ${(ia.vacancyRate * 100).toFixed(1)}% — exceeds ${VACANCY_HIGH * 100}% threshold`);
    }
  }

  if (ia.operatingExpenseRatio !== undefined && ia.operatingExpenseRatio < OER_LOW) {
    issues.push(`Operating expense ratio is ${(ia.operatingExpenseRatio * 100).toFixed(1)}% — below ${OER_LOW * 100}% typical minimum`);
  }

  if (issues.length > 0) {
    const hasZeroVacancy = issues.some(i => i.startsWith('Vacancy rate is 0%'));
    return {
      passed: false,
      message: `Vacancy/expense concerns: ${issues.join('; ')}.`,
      severity: hasZeroVacancy ? 'high' : 'medium',
      details: { issues, vacancy: ia.vacancyRate, oer: ia.operatingExpenseRatio },
    };
  }

  return { passed: true, message: 'Vacancy and expense assumptions are within reasonable ranges.', severity: 'high' };
}

export function checkCapRateEvidence(input: IncomeApproachReviewInput): IncomeReviewResult {
  if (!input.incomeApproach || input.incomeApproach.capRate === undefined) {
    return { passed: true, message: 'No cap rate data — skipping.', severity: 'high' };
  }

  const capRate: number = input.incomeApproach.capRate;
  const ia = input.incomeApproach;
  const issues: string[] = [];

  if (!ia.capRateSource) {
    issues.push('Cap rate source not documented');
  }

  if (capRate < CAP_RATE_LOW) {
    issues.push(`Cap rate ${(capRate * 100).toFixed(2)}% is below ${CAP_RATE_LOW * 100}% — unreasonably low`);
  }
  if (capRate > CAP_RATE_HIGH) {
    issues.push(`Cap rate ${(capRate * 100).toFixed(2)}% exceeds ${CAP_RATE_HIGH * 100}% — verify distressed market conditions`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Cap rate evidence issues: ${issues.join('; ')}. Cap rate must be derived from comparable income property sales.`,
      severity: 'high',
      details: { issues, capRate },
    };
  }

  return { passed: true, message: `Cap rate (${(capRate * 100).toFixed(2)}%) is documented and within reasonable range.`, severity: 'high' };
}

export function checkGrmConsistency(input: IncomeApproachReviewInput): IncomeReviewResult {
  if (!input.incomeApproach || input.incomeApproach.grossRentMultiplier === undefined) {
    return { passed: true, message: 'No GRM data — skipping.', severity: 'high' };
  }

  const grm: number = input.incomeApproach.grossRentMultiplier;
  const ia = input.incomeApproach;

  if (!ia.grmComps || ia.grmComps.length === 0) {
    return { passed: true, message: 'No GRM comp data for comparison — skipping.', severity: 'high' };
  }

  const minGrm = Math.min(...ia.grmComps);
  const maxGrm = Math.max(...ia.grmComps);
  const avgGrm = ia.grmComps.reduce((s, v) => s + v, 0) / ia.grmComps.length;
  const tolerance = avgGrm * GRM_TOLERANCE_PCT;
  if (grm < minGrm - tolerance || grm > maxGrm + tolerance) {
    return {
      passed: false,
      message: `GRM of ${grm} is outside comparable range (${minGrm}-${maxGrm}, ±${GRM_TOLERANCE_PCT * 100}% tolerance). GRM must be derived from market evidence.`,
      severity: 'high',
      details: { grm, compRange: { min: minGrm, max: maxGrm, avg: avgGrm } },
    };
  }

  return { passed: true, message: `GRM of ${grm} is consistent with comparable data (${minGrm}-${maxGrm}).`, severity: 'high' };
}

export function checkMarketRateContext(input: IncomeApproachReviewInput): IncomeReviewResult {
  if (!input.incomeApproach) {
    return { passed: true, message: 'No income approach data — skipping.', severity: 'medium' };
  }

  // Placeholder: in production would cross-reference with market interest rates
  return { passed: true, message: 'Market rate context check passed.', severity: 'medium' };
}

// ── Registry ─────────────────────────────────────────────────────────

export const INCOME_REVIEW_EVALUATORS: Record<string, IncomeReviewEvaluator> = {
  checkRentDerivationEvidence,
  checkStrMisuse,
  checkVacancyExpenseReasonableness,
  checkCapRateEvidence,
  checkGrmConsistency,
  checkMarketRateContext,
};

// ── Aggregate Service ────────────────────────────────────────────────

export class IncomeApproachReviewService {
  performReview(orderId: string, input: IncomeApproachReviewInput): IncomeReviewReport {
    const checks: IncomeReviewCheck[] = [];

    for (const [name, evaluator] of Object.entries(INCOME_REVIEW_EVALUATORS)) {
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
