/**
 * @file src/services/market-analytics.service.ts
 * @description Phase 2.4 — Market Analytics Validation Service
 *
 * Validates appraiser's market condition claims against computed market metrics:
 *   - Market conditions alignment (MOI, absorption rate vs. stated trend)
 *   - DOM consistency (stated marketing time vs. actual DOM data)
 *   - Absorption rate reasonableness
 *   - List-to-sale ratio analysis
 *   - Submarket boundary crossing detection
 *   - Price trend validation (stated vs. computed)
 *
 * Follows the evaluator-registry pattern (see bias-screening.service.ts).
 *
 * References:
 *   - Fannie Mae B4-1.3-05 (market conditions analysis)
 *   - USPAP SR 1-3 (market analysis requirements)
 *   - UAD 3.6 market conditions fields
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

export interface StatedMarketConditions {
  marketTrend?: 'Increasing' | 'Stable' | 'Declining' | string;
  demandSupply?: 'Shortage' | 'In Balance' | 'Over Supply' | string;
  marketingTime?: 'Under 3 months' | '3-6 months' | 'Over 6 months' | string;
  propertyValues?: 'Increasing' | 'Stable' | 'Declining' | string;
}

export interface MarketMetrics {
  monthsOfInventory: number;
  absorptionRatePerMonth: number;
  averageDom: number;
  medianDom?: number;
  listToSaleRatio: number;
  priceCutRate?: number;
  contractRatio?: number;
  priceChangeYoY: number;
}

export interface MarketCompData {
  compId: string;
  address: string;
  zipCode: string;
  city: string;
  county?: string;
  schoolDistrict?: string;
  daysOnMarket?: number;
  listPrice?: number;
  salePrice?: number;
  saleDate?: string;
}

export interface SubjectMarketData {
  zipCode: string;
  city: string;
  county?: string;
  schoolDistrict?: string;
}

export interface MarketAnalyticsInput {
  statedConditions?: StatedMarketConditions;
  marketMetrics?: MarketMetrics;
  comps: MarketCompData[];
  subject: SubjectMarketData;
}

export interface MarketAnalyticsResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface MarketAnalyticsCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface MarketAnalyticsReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: MarketAnalyticsCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

export type MarketAnalyticsEvaluator = (input: MarketAnalyticsInput) => MarketAnalyticsResult;


// ── Constants & Thresholds ───────────────────────────────────────────

/** MOI thresholds for market condition inference (NAR / Fannie Mae guidance) */
const MOI_INCREASING_THRESHOLD = 3;   // < 3 months → seller's/increasing market
const MOI_DECLINING_THRESHOLD = 7;    // > 7 months → buyer's/declining market

/** Absorption rate low warning threshold */
const LOW_ABSORPTION_THRESHOLD = 4;

/** List-to-sale ratio thresholds */
const LIST_SALE_LOW_THRESHOLD = 0.90;   // Below 90% → distressed
const LIST_SALE_HIGH_THRESHOLD = 1.02;  // Above 102% → bidding wars

/** DOM thresholds for marketing time categories (days) */
const DOM_UNDER_3_MONTHS = 90;
const DOM_3_TO_6_MONTHS_HIGH = 180;

/** Price change thresholds */
const PRICE_CHANGE_SIGNIFICANT = 0.02; // ±2% considered not stable


// ── Evaluators ───────────────────────────────────────────────────────

/**
 * Validates that the appraiser's stated market conditions align with
 * quantitative metrics (MOI, absorption, price trend).
 */
export function validateMarketConditionsAlignment(input: MarketAnalyticsInput): MarketAnalyticsResult {
  if (!input.statedConditions || !input.marketMetrics) {
    return { passed: true, message: 'No stated conditions or market metrics — skipping alignment check.', severity: 'high' };
  }

  const stated = input.statedConditions;
  const metrics = input.marketMetrics;
  const issues: string[] = [];

  // Infer market condition from MOI
  if (stated.marketTrend) {
    const statedLower = stated.marketTrend.toLowerCase();

    if (metrics.monthsOfInventory < MOI_INCREASING_THRESHOLD && statedLower !== 'increasing') {
      issues.push(`MOI is ${metrics.monthsOfInventory} (< ${MOI_INCREASING_THRESHOLD}) suggesting increasing market, but stated as "${stated.marketTrend}"`);
    }
    if (metrics.monthsOfInventory > MOI_DECLINING_THRESHOLD && statedLower !== 'declining') {
      issues.push(`MOI is ${metrics.monthsOfInventory} (> ${MOI_DECLINING_THRESHOLD}) suggesting declining market, but stated as "${stated.marketTrend}"`);
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Market conditions misalignment: ${issues.join('; ')}. Per Fannie Mae B4-1.3-05, market conditions must be supported by quantitative data.`,
      severity: 'high',
      details: { issues, moi: metrics.monthsOfInventory, statedTrend: stated.marketTrend },
    };
  }

  return {
    passed: true,
    message: 'Stated market conditions align with quantitative metrics.',
    severity: 'high',
  };
}

/**
 * Validates that stated marketing time is consistent with DOM data.
 */
export function validateDomConsistency(input: MarketAnalyticsInput): MarketAnalyticsResult {
  const marketingTime = input.statedConditions?.marketingTime;
  if (!marketingTime) {
    return { passed: true, message: 'No stated marketing time — skipping DOM check.', severity: 'medium' };
  }

  const avgDom = input.marketMetrics?.averageDom;
  if (avgDom === undefined) {
    return { passed: true, message: 'No average DOM data available — skipping.', severity: 'medium' };
  }

  const timeLower = marketingTime.toLowerCase();
  const issues: string[] = [];

  if (timeLower.includes('under 3') && avgDom > DOM_UNDER_3_MONTHS) {
    issues.push(`Stated "Under 3 months" but average DOM is ${avgDom} days`);
  }
  if (timeLower.includes('3-6') && (avgDom < 30 || avgDom > DOM_3_TO_6_MONTHS_HIGH + 30)) {
    issues.push(`Stated "3-6 months" but average DOM is ${avgDom} days`);
  }
  if (timeLower.includes('over 6') && avgDom < DOM_3_TO_6_MONTHS_HIGH - 30) {
    issues.push(`Stated "Over 6 months" but average DOM is ${avgDom} days`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `DOM inconsistency: ${issues.join('; ')}.`,
      severity: 'medium',
      details: { issues, statedMarketingTime: marketingTime, averageDom: avgDom },
    };
  }

  return {
    passed: true,
    message: `Stated marketing time "${marketingTime}" is consistent with average DOM of ${avgDom} days.`,
    severity: 'medium',
  };
}

/**
 * Validates absorption rate reasonableness.
 * Very low absorption rates indicate a stagnant market that may affect value stability.
 */
export function validateAbsorptionRate(input: MarketAnalyticsInput): MarketAnalyticsResult {
  if (!input.marketMetrics) {
    return { passed: true, message: 'No market metrics — skipping absorption rate check.', severity: 'medium' };
  }

  const rate = input.marketMetrics.absorptionRatePerMonth;

  if (rate < LOW_ABSORPTION_THRESHOLD) {
    return {
      passed: false,
      message: `Low absorption rate: ${rate} sales/month (threshold: ${LOW_ABSORPTION_THRESHOLD}). This may indicate limited market activity requiring additional support for value conclusions.`,
      severity: 'medium',
      details: { absorptionRate: rate, threshold: LOW_ABSORPTION_THRESHOLD },
    };
  }

  return {
    passed: true,
    message: `Absorption rate of ${rate} sales/month is reasonable.`,
    severity: 'medium',
  };
}

/**
 * Validates list-to-sale ratio against normal market thresholds.
 * Also computes from comp data if aggregate metric not provided.
 */
export function validateListToSaleRatio(input: MarketAnalyticsInput): MarketAnalyticsResult {
  let ratio = input.marketMetrics?.listToSaleRatio;

  // Compute from comp data if not provided
  if (ratio === undefined) {
    const compsWithPrices = input.comps.filter(c => c.listPrice && c.salePrice && c.listPrice > 0);
    if (compsWithPrices.length === 0) {
      return { passed: true, message: 'No list-to-sale ratio data available — skipping.', severity: 'medium' };
    }
    ratio = compsWithPrices.reduce((sum, c) => sum + (c.salePrice! / c.listPrice!), 0) / compsWithPrices.length;
  }

  const issues: string[] = [];

  if (ratio < LIST_SALE_LOW_THRESHOLD) {
    issues.push(`List-to-sale ratio is ${(ratio * 100).toFixed(1)}% (< ${LIST_SALE_LOW_THRESHOLD * 100}%), indicating distressed or declining market conditions`);
  }
  if (ratio > LIST_SALE_HIGH_THRESHOLD) {
    issues.push(`List-to-sale ratio is ${(ratio * 100).toFixed(1)}% (> ${LIST_SALE_HIGH_THRESHOLD * 100}%), indicating bidding war conditions or under-pricing`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `List-to-sale ratio concern: ${issues.join('; ')}.`,
      severity: 'medium',
      details: { ratio: Math.round(ratio * 1000) / 1000, issues },
    };
  }

  return {
    passed: true,
    message: `List-to-sale ratio of ${(ratio * 100).toFixed(1)}% is within normal range.`,
    severity: 'medium',
  };
}

/**
 * Detects when comps cross meaningful submarket boundaries relative to the subject.
 * Checks: zip code, county, and school district.
 */
export function checkSubmarketBoundaryCrossing(input: MarketAnalyticsInput): MarketAnalyticsResult {
  if (input.comps.length === 0) {
    return { passed: true, message: 'No comps — boundary check skipped.', severity: 'medium' };
  }

  const subj = input.subject;
  const crossings: Array<{ compId: string; boundaries: string[] }> = [];

  for (const comp of input.comps) {
    const boundaries: string[] = [];

    if (comp.zipCode && subj.zipCode && comp.zipCode !== subj.zipCode) {
      boundaries.push(`zip code (subject: ${subj.zipCode}, comp: ${comp.zipCode})`);
    }
    if (comp.county && subj.county && comp.county.toLowerCase() !== subj.county.toLowerCase()) {
      boundaries.push(`county (subject: ${subj.county}, comp: ${comp.county})`);
    }
    if (comp.schoolDistrict && subj.schoolDistrict && comp.schoolDistrict.toLowerCase() !== subj.schoolDistrict.toLowerCase()) {
      boundaries.push(`school district (subject: ${subj.schoolDistrict}, comp: ${comp.schoolDistrict})`);
    }

    if (boundaries.length > 0) {
      crossings.push({ compId: comp.compId, boundaries });
    }
  }

  if (crossings.length > 0) {
    // County crossing is higher severity than zip/school
    const hasCountyCrossing = crossings.some(c => c.boundaries.some(b => b.includes('county')));
    const severity = hasCountyCrossing ? 'high' : 'medium';

    const summary = crossings.map(c => `${c.compId}: ${c.boundaries.join(', ')}`).join('; ');

    return {
      passed: false,
      message: `Submarket boundary crossings detected: ${summary}. Verify that location adjustments adequately account for these boundary differences.`,
      severity,
      details: { crossings },
    };
  }

  return {
    passed: true,
    message: 'All comps are within the same submarket boundaries as the subject.',
    severity: 'medium',
  };
}

/**
 * Validates that the stated property value trend aligns with computed YoY price change.
 */
export function validatePriceTrend(input: MarketAnalyticsInput): MarketAnalyticsResult {
  const statedValues = input.statedConditions?.propertyValues;
  if (!statedValues) {
    return { passed: true, message: 'No stated property values trend — skipping.', severity: 'high' };
  }

  const priceChange = input.marketMetrics?.priceChangeYoY;
  if (priceChange === undefined) {
    return { passed: true, message: 'No YoY price change data — skipping.', severity: 'high' };
  }

  const statedLower = statedValues.toLowerCase();
  const issues: string[] = [];

  if (statedLower === 'increasing' && priceChange < -PRICE_CHANGE_SIGNIFICANT) {
    issues.push(`Stated "Increasing" but YoY price change is ${(priceChange * 100).toFixed(1)}%`);
  }
  if (statedLower === 'declining' && priceChange > PRICE_CHANGE_SIGNIFICANT) {
    issues.push(`Stated "Declining" but YoY price change is +${(priceChange * 100).toFixed(1)}%`);
  }
  if (statedLower === 'stable' && Math.abs(priceChange) > 0.05) {
    issues.push(`Stated "Stable" but YoY price change is ${(priceChange * 100).toFixed(1)}% (> ±5%)`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Price trend mismatch: ${issues.join('; ')}. Property value trends must be supported by market data per USPAP SR 1-3.`,
      severity: 'high',
      details: { statedTrend: statedValues, priceChangeYoY: priceChange, issues },
    };
  }

  return {
    passed: true,
    message: `Stated property values "${statedValues}" aligns with ${(priceChange * 100).toFixed(1)}% YoY change.`,
    severity: 'high',
  };
}


// ── Evaluator Registry ───────────────────────────────────────────────

export const MARKET_ANALYTICS_EVALUATORS: Record<string, MarketAnalyticsEvaluator> = {
  validateMarketConditionsAlignment,
  validateDomConsistency,
  validateAbsorptionRate,
  validateListToSaleRatio,
  checkSubmarketBoundaryCrossing,
  validatePriceTrend,
};


// ── Aggregate Service ────────────────────────────────────────────────

export class MarketAnalyticsService {
  performValidation(orderId: string, input: MarketAnalyticsInput): MarketAnalyticsReport {
    const checks: MarketAnalyticsCheck[] = [];

    for (const [name, evaluator] of Object.entries(MARKET_ANALYTICS_EVALUATORS)) {
      try {
        const result = evaluator(input);
        checks.push({
          evaluatorName: name,
          passed: result.passed,
          message: result.message,
          severity: result.severity,
          ...(result.details !== undefined && { details: result.details }),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        checks.push({
          evaluatorName: name,
          passed: false,
          message: `Evaluator threw an error: ${message}`,
          severity: 'critical',
        });
      }
    }

    const failedChecks = checks.filter(c => !c.passed);
    let criticalIssues = 0;
    let highIssues = 0;
    let mediumIssues = 0;
    let lowIssues = 0;

    for (const check of failedChecks) {
      switch (check.severity) {
        case 'critical': criticalIssues++; break;
        case 'high': highIssues++; break;
        case 'medium': mediumIssues++; break;
        case 'low': lowIssues++; break;
      }
    }

    const totalIssues = criticalIssues + highIssues + mediumIssues + lowIssues;
    let overallStatus: 'pass' | 'fail' | 'warnings' = 'pass';
    if (criticalIssues > 0) {
      overallStatus = 'fail';
    } else if (totalIssues > 0) {
      overallStatus = 'warnings';
    }

    return {
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
  }
}
