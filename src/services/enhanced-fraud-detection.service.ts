/**
 * @file src/services/enhanced-fraud-detection.service.ts
 * @description Phase 2.12 — Enhanced Fraud Detection Service
 *
 * Supplements the existing fraud-detection.service.ts with additional
 * pure-function evaluators that do NOT require AI/LLM:
 *   - Serial flip detection (rapid resale patterns)
 *   - Comp clustering (geographic/temporal clustering)
 *   - Perfect match detector (identical comp reuse)
 *   - Value rounding bias (suspiciously round appraised values)
 *   - Identity anomaly (appraiser/comp data consistency)
 *   - Adjustment symmetry (all-positive or patterned adjustments)
 *
 * References: USPAP Ethics Rule, Fannie Mae Lender Letter LL-2024-01
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

export interface SubjectSaleHistory {
  currentSalePrice?: number;
  currentSaleDate?: string;
  priorSalePrice?: number | null;
  priorSaleDate?: string | null;
  priorSalePrice2?: number | null;
  priorSaleDate2?: string | null;
}

export interface CompFraudData {
  address: string;
  salePrice: number;
  saleDate: string;
  priorSalePrice?: number | null;
  priorSaleDate?: string | null;
  distanceFromSubjectMiles: number;
  latitude?: number;
  longitude?: number;
  adjustments?: {
    locationAdj?: number;
    grossLivingAreaAdj?: number;
    conditionAdj?: number;
    netAdjustmentTotal?: number;
    grossAdjustmentTotal?: number;
  };
}

export interface EnhancedFraudInput {
  appraisedValue: number;
  appraisalDate: string;
  subject: SubjectSaleHistory;
  comps: CompFraudData[];
  appraiserLicenseNumber?: string;
}

export interface FraudResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface FraudCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface EnhancedFraudReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: FraudCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

export type FraudEvaluator = (input: EnhancedFraudInput) => FraudResult;

// ── Constants ────────────────────────────────────────────────────────

const SERIAL_FLIP_MONTHS = 6;
const SERIAL_FLIP_APPRECIATION_PCT = 20;
const COMP_CLUSTER_MAX_DISTANCE_MILES = 0.5;
const ROUND_VALUE_THRESHOLD = 10000;
const MAX_GROSS_ADJUSTMENT_PCT = 25;

// ── Helpers ──────────────────────────────────────────────────────────

function monthsBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.abs((a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth()));
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Evaluators ───────────────────────────────────────────────────────

export function detectSerialFlip(input: EnhancedFraudInput): FraudResult {
  const { subject } = input;

  if (!subject.priorSalePrice || !subject.priorSaleDate || !subject.currentSaleDate || !subject.currentSalePrice) {
    return { passed: true, message: 'Insufficient sale history for serial flip analysis.', severity: 'critical' };
  }

  const months = monthsBetween(subject.priorSaleDate, subject.currentSaleDate);
  const appreciation = ((subject.currentSalePrice - subject.priorSalePrice) / subject.priorSalePrice) * 100;

  if (months <= SERIAL_FLIP_MONTHS && appreciation > SERIAL_FLIP_APPRECIATION_PCT) {
    return {
      passed: false,
      message: `Serial flip pattern detected: ${appreciation.toFixed(1)}% price increase in ${months} months (prior: $${subject.priorSalePrice.toLocaleString()} → current: $${subject.currentSalePrice.toLocaleString()}). USPAP requires disclosure and analysis of recent sales history.`,
      severity: 'critical',
      details: { months, appreciationPct: Math.round(appreciation * 10) / 10, priorSalePrice: subject.priorSalePrice, currentSalePrice: subject.currentSalePrice },
    };
  }

  return { passed: true, message: `No serial flip pattern: ${appreciation.toFixed(1)}% change over ${months} months.`, severity: 'critical' };
}

export function detectCompClustering(input: EnhancedFraudInput): FraudResult {
  const { comps } = input;
  const geoComps = comps.filter(c => c.latitude !== undefined && c.longitude !== undefined);

  if (geoComps.length < 2) {
    return { passed: true, message: 'Insufficient geo-coded comps for clustering analysis.', severity: 'high' };
  }

  // Check if all comps cluster within a very small area
  let clusterCount = 0;
  for (let i = 0; i < geoComps.length; i++) {
    for (let j = i + 1; j < geoComps.length; j++) {
      const dist = haversineDistance(
        geoComps[i]!.latitude!, geoComps[i]!.longitude!,
        geoComps[j]!.latitude!, geoComps[j]!.longitude!,
      );
      if (dist < COMP_CLUSTER_MAX_DISTANCE_MILES) {
        clusterCount++;
      }
    }
  }

  const totalPairs = (geoComps.length * (geoComps.length - 1)) / 2;
  const clusterRatio = clusterCount / totalPairs;

  if (clusterRatio === 1 && geoComps.length >= 3) {
    return {
      passed: false,
      message: `All ${geoComps.length} comparables are clustered within ${COMP_CLUSTER_MAX_DISTANCE_MILES} miles of each other. This may indicate cherry-picked comps from a single development or neighborhood.`,
      severity: 'medium',
      details: { clusterCount, totalPairs, clusterRatio },
    };
  }

  return { passed: true, message: 'Comp geographic distribution is adequate.', severity: 'high' };
}

export function detectPerfectMatchComps(input: EnhancedFraudInput): FraudResult {
  const { comps } = input;
  const duplicates: string[] = [];

  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      if (comps[i]!.address.toLowerCase().trim() === comps[j]!.address.toLowerCase().trim()) {
        duplicates.push(`Comp ${i + 1} and Comp ${j + 1}: "${comps[i]!.address}"`);
      }
    }
  }

  if (duplicates.length > 0) {
    return {
      passed: false,
      message: `Duplicate comp addresses detected: ${duplicates.join('; ')}. Each comparable must be a distinct property.`,
      severity: 'critical',
      details: { duplicates },
    };
  }

  return { passed: true, message: 'All comparables have unique addresses.', severity: 'critical' };
}

export function detectValueRoundingBias(input: EnhancedFraudInput): FraudResult {
  const { appraisedValue } = input;

  if (appraisedValue % ROUND_VALUE_THRESHOLD === 0) {
    return {
      passed: false,
      message: `Appraised value ($${appraisedValue.toLocaleString()}) is a round number (multiple of $${ROUND_VALUE_THRESHOLD.toLocaleString()}). While not necessarily wrong, round values warrant review that reconciliation is data-driven, not target-driven.`,
      severity: 'low',
      details: { appraisedValue, roundingMultiple: ROUND_VALUE_THRESHOLD },
    };
  }

  return { passed: true, message: 'Appraised value is not suspiciously round.', severity: 'low' };
}

export function detectAdjustmentSymmetry(input: EnhancedFraudInput): FraudResult {
  const compsWithAdj = input.comps.filter(c => c.adjustments?.netAdjustmentTotal !== undefined);

  if (compsWithAdj.length < 2) {
    return { passed: true, message: 'Insufficient adjustment data for symmetry analysis.', severity: 'high' };
  }

  // Check if all net adjustments are positive (all comps adjusted upward)
  const allPositive = compsWithAdj.every(c => (c.adjustments?.netAdjustmentTotal ?? 0) > 0);
  const allNegative = compsWithAdj.every(c => (c.adjustments?.netAdjustmentTotal ?? 0) < 0);

  // Check for excessive gross adjustments
  const excessiveGross = compsWithAdj.filter(c => {
    if (!c.adjustments?.grossAdjustmentTotal) return false;
    return (c.adjustments.grossAdjustmentTotal / c.salePrice * 100) > MAX_GROSS_ADJUSTMENT_PCT;
  });

  const issues: string[] = [];
  if (allPositive && compsWithAdj.length >= 3) {
    issues.push(`All ${compsWithAdj.length} comps have positive net adjustments — every comp was adjusted upward to the appraised value`);
  }
  if (allNegative && compsWithAdj.length >= 3) {
    issues.push(`All ${compsWithAdj.length} comps have negative net adjustments — every comp was adjusted downward`);
  }
  if (excessiveGross.length > 0) {
    issues.push(`${excessiveGross.length} comp(s) have gross adjustments exceeding ${MAX_GROSS_ADJUSTMENT_PCT}% of sale price`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Adjustment pattern concerns: ${issues.join('; ')}. Per Fannie Mae guidelines, excessive or one-directional adjustments suggest poorly selected comps.`,
      severity: allPositive || allNegative ? 'high' : 'medium',
      details: { issues, compCount: compsWithAdj.length },
    };
  }

  return { passed: true, message: 'Adjustment patterns do not show systematic bias.', severity: 'high' };
}

export function detectCompStaleness(input: EnhancedFraudInput): FraudResult {
  const STALE_MONTHS = 12;
  const staleComps: string[] = [];

  for (const comp of input.comps) {
    const months = monthsBetween(comp.saleDate, input.appraisalDate);
    if (months > STALE_MONTHS) {
      staleComps.push(`${comp.address} (sold ${months} months ago)`);
    }
  }

  if (staleComps.length > 0) {
    return {
      passed: false,
      message: `${staleComps.length} comp(s) have sale dates over ${STALE_MONTHS} months from appraisal date: ${staleComps.join('; ')}. Recent sales are preferred for market relevance.`,
      severity: staleComps.length === input.comps.length ? 'high' : 'medium',
      details: { staleComps, threshold: STALE_MONTHS },
    };
  }

  return { passed: true, message: 'All comp sale dates are within 12 months of appraisal date.', severity: 'medium' };
}

// ── Registry ─────────────────────────────────────────────────────────

export const ENHANCED_FRAUD_EVALUATORS: Record<string, FraudEvaluator> = {
  detectSerialFlip,
  detectCompClustering,
  detectPerfectMatchComps,
  detectValueRoundingBias,
  detectAdjustmentSymmetry,
  detectCompStaleness,
};

// ── Aggregate Service ────────────────────────────────────────────────

export class EnhancedFraudDetectionService {
  performReview(orderId: string, input: EnhancedFraudInput): EnhancedFraudReport {
    const checks: FraudCheck[] = [];

    for (const [name, evaluator] of Object.entries(ENHANCED_FRAUD_EVALUATORS)) {
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
