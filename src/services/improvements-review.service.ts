/**
 * @file src/services/improvements-review.service.ts
 * @description Phase 2.7 — Improvements & Condition Review Service
 *
 * Validates building improvements data: condition/quality ratings,
 * GLA consistency, room count logic, basement details, and functional utility.
 *
 * References: USPAP SR 1-4, Fannie Mae B4-1.3-05
 *
 * @version 1.0.0
 * @created 2026-03-12
 */

// ── Types ────────────────────────────────────────────────────────────

export interface ImprovementsData {
  grossLivingArea: number;
  totalRooms: number;
  bedrooms: number;
  bathrooms: number;
  stories: number;
  condition: string;
  quality: string;
  yearBuilt: number;
  effectiveAge?: number | null;
  foundationType?: string;
  basement?: string;
  basementSqFt?: number | null;
  basementFinishedSqFt?: number | null;
  exteriorWalls?: string;
  roofSurface?: string;
  heating?: string;
  cooling?: string;
  garageType?: string;
  garageSpaces?: number;
  pool?: boolean;
  conditionDescription?: string | null;
}

export interface CompImprovementsData {
  grossLivingArea: number;
  condition: string;
  quality: string;
  yearBuilt: number;
  bedrooms: number;
  bathrooms: number;
  glaDifferencePct?: number;
}

export interface ImprovementsReviewInput {
  subject: ImprovementsData;
  comps?: CompImprovementsData[];
}

export interface ImprovementsResult {
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface ImprovementsCheck {
  evaluatorName: string;
  passed: boolean;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
}

export interface ImprovementsReport {
  orderId: string;
  reportDate: Date;
  overallStatus: 'pass' | 'fail' | 'warnings';
  checks: ImprovementsCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalIssues: number;
}

export type ImprovementsEvaluator = (input: ImprovementsReviewInput) => ImprovementsResult;

// ── Constants ────────────────────────────────────────────────────────

const VALID_CONDITIONS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
const VALID_QUALITIES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
const POOR_CONDITIONS = ['C5', 'C6'];
const MAX_REASONABLE_GLA = 10000;
const MIN_REASONABLE_GLA = 400;
const MAX_EFFECTIVE_AGE_RATIO = 2.0;
const MAX_GLA_COMP_DIVERGENCE_PCT = 50;

// ── Evaluators ───────────────────────────────────────────────────────

export function checkConditionQualityRatings(input: ImprovementsReviewInput): ImprovementsResult {
  const { subject } = input;
  const issues: string[] = [];

  if (!VALID_CONDITIONS.includes(subject.condition)) {
    issues.push(`Condition rating '${subject.condition}' is not a valid UAD C1-C6 rating`);
  }

  if (!VALID_QUALITIES.includes(subject.quality)) {
    issues.push(`Quality rating '${subject.quality}' is not a valid UAD Q1-Q6 rating`);
  }

  if (POOR_CONDITIONS.includes(subject.condition) && (!subject.conditionDescription || subject.conditionDescription.trim().length < 20)) {
    issues.push(`Condition is ${subject.condition} (poor/unsound) but condition description is missing or too brief — must explain deficiencies`);
  }

  if (issues.length > 0) {
    const hasInvalid = issues.some(i => i.includes('not a valid'));
    return {
      passed: false,
      message: `Condition/quality rating issues: ${issues.join('; ')}.`,
      severity: hasInvalid ? 'critical' : 'high',
      details: { issues, condition: subject.condition, quality: subject.quality },
    };
  }

  return { passed: true, message: `Condition (${subject.condition}) and quality (${subject.quality}) ratings are valid.`, severity: 'critical' };
}

export function checkGlaReasonableness(input: ImprovementsReviewInput): ImprovementsResult {
  const { subject, comps } = input;
  const issues: string[] = [];

  if (subject.grossLivingArea < MIN_REASONABLE_GLA) {
    issues.push(`GLA of ${subject.grossLivingArea} sq ft is below ${MIN_REASONABLE_GLA} sq ft minimum — verify measurement`);
  }

  if (subject.grossLivingArea > MAX_REASONABLE_GLA) {
    issues.push(`GLA of ${subject.grossLivingArea.toLocaleString()} sq ft exceeds ${MAX_REASONABLE_GLA.toLocaleString()} sq ft — verify this is a single-family residence`);
  }

  // Check GLA divergence from comps
  if (comps && comps.length > 0) {
    const avgCompGla = comps.reduce((s, c) => s + c.grossLivingArea, 0) / comps.length;
    const divergence = Math.abs(subject.grossLivingArea - avgCompGla) / avgCompGla * 100;
    if (divergence > MAX_GLA_COMP_DIVERGENCE_PCT) {
      issues.push(`Subject GLA (${subject.grossLivingArea}) diverges ${divergence.toFixed(0)}% from comp average (${Math.round(avgCompGla)}) — comps may not be truly comparable`);
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `GLA concerns: ${issues.join('; ')}.`,
      severity: issues.some(i => i.includes('below') || i.includes('exceeds')) ? 'high' : 'medium',
      details: { issues, subjectGla: subject.grossLivingArea },
    };
  }

  return { passed: true, message: `GLA of ${subject.grossLivingArea} sq ft is reasonable.`, severity: 'high' };
}

export function checkRoomCountLogic(input: ImprovementsReviewInput): ImprovementsResult {
  const { subject } = input;
  const issues: string[] = [];

  // Total rooms should be >= bedrooms + 1 (at least one non-bedroom)
  if (subject.totalRooms < subject.bedrooms + 1) {
    issues.push(`Total rooms (${subject.totalRooms}) should exceed bedrooms (${subject.bedrooms}) — missing living/kitchen/dining rooms`);
  }

  // Bedrooms should be at least 1
  if (subject.bedrooms < 1) {
    issues.push('Zero bedrooms reported — verify this is classified correctly');
  }

  // Bathrooms should be at least 1
  if (subject.bathrooms < 1) {
    issues.push('Zero bathrooms reported — this is highly unusual for a residential property');
  }

  // Stories should be >= 1
  if (subject.stories < 1) {
    issues.push(`Stories reported as ${subject.stories} — must be at least 1`);
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Room count logic issues: ${issues.join('; ')}.`,
      severity: issues.some(i => i.includes('Zero')) ? 'high' : 'medium',
      details: { issues, totalRooms: subject.totalRooms, bedrooms: subject.bedrooms, bathrooms: subject.bathrooms },
    };
  }

  return { passed: true, message: 'Room counts are logically consistent.', severity: 'medium' };
}

export function checkBasementConsistency(input: ImprovementsReviewInput): ImprovementsResult {
  const { subject } = input;

  if (!subject.basement || subject.basement === 'None') {
    // If no basement but basement sq ft reported, flag
    if (subject.basementSqFt && subject.basementSqFt > 0) {
      return {
        passed: false,
        message: `Basement reported as "${subject.basement || 'not specified'}" but basement sq ft is ${subject.basementSqFt}. Data inconsistency.`,
        severity: 'high',
        details: { basement: subject.basement, basementSqFt: subject.basementSqFt },
      };
    }
    return { passed: true, message: 'No basement reported.', severity: 'medium' };
  }

  // If basement exists, basementFinishedSqFt should not exceed basementSqFt
  if (subject.basementSqFt && subject.basementFinishedSqFt) {
    if (subject.basementFinishedSqFt > subject.basementSqFt) {
      return {
        passed: false,
        message: `Finished basement area (${subject.basementFinishedSqFt} sq ft) exceeds total basement area (${subject.basementSqFt} sq ft).`,
        severity: 'high',
        details: { basementSqFt: subject.basementSqFt, basementFinishedSqFt: subject.basementFinishedSqFt },
      };
    }
  }

  return { passed: true, message: 'Basement data is consistent.', severity: 'medium' };
}

export function checkEffectiveAgeReasonableness(input: ImprovementsReviewInput): ImprovementsResult {
  const { subject } = input;

  if (subject.effectiveAge === undefined || subject.effectiveAge === null) {
    return { passed: true, message: 'Effective age not provided — skipping.', severity: 'medium' };
  }

  const currentYear = new Date().getFullYear();
  const actualAge = currentYear - subject.yearBuilt;

  if (subject.effectiveAge < 0) {
    return {
      passed: false,
      message: `Effective age is negative (${subject.effectiveAge}). This is not valid.`,
      severity: 'critical',
      details: { effectiveAge: subject.effectiveAge, actualAge },
    };
  }

  if (actualAge > 0 && subject.effectiveAge === 0) {
    return {
      passed: false,
      message: `Effective age is 0 for a ${actualAge}-year-old property. This requires justification (e.g., complete renovation).`,
      severity: 'medium',
      details: { effectiveAge: subject.effectiveAge, actualAge },
    };
  }

  if (actualAge > 0 && (subject.effectiveAge / actualAge) > MAX_EFFECTIVE_AGE_RATIO) {
    return {
      passed: false,
      message: `Effective age (${subject.effectiveAge}) exceeds ${MAX_EFFECTIVE_AGE_RATIO}x actual age (${actualAge}). This is unusual and should be explained.`,
      severity: 'medium',
      details: { effectiveAge: subject.effectiveAge, actualAge, ratio: subject.effectiveAge / actualAge },
    };
  }

  return { passed: true, message: `Effective age (${subject.effectiveAge}) is reasonable for actual age (${actualAge}).`, severity: 'medium' };
}

export function checkFunctionalUtility(input: ImprovementsReviewInput): ImprovementsResult {
  const { subject } = input;
  const issues: string[] = [];

  // Check heating — None is a red flag for residential
  if (subject.heating === 'None') {
    issues.push('No heating system reported — verify if this is a habitable dwelling');
  }

  // Foundation type should be present
  if (!subject.foundationType) {
    issues.push('Foundation type not documented');
  }

  // Exterior walls should be present
  if (!subject.exteriorWalls) {
    issues.push('Exterior wall material not documented');
  }

  // Roof surface should be present
  if (!subject.roofSurface) {
    issues.push('Roof surface material not documented');
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Functional utility concerns: ${issues.join('; ')}.`,
      severity: issues.some(i => i.includes('heating')) ? 'high' : 'medium',
      details: { issues },
    };
  }

  return { passed: true, message: 'Functional utility and building components are documented.', severity: 'medium' };
}

// ── Registry ─────────────────────────────────────────────────────────

export const IMPROVEMENTS_EVALUATORS: Record<string, ImprovementsEvaluator> = {
  checkConditionQualityRatings,
  checkGlaReasonableness,
  checkRoomCountLogic,
  checkBasementConsistency,
  checkEffectiveAgeReasonableness,
  checkFunctionalUtility,
};

// ── Aggregate Service ────────────────────────────────────────────────

export class ImprovementsReviewService {
  performReview(orderId: string, input: ImprovementsReviewInput): ImprovementsReport {
    const checks: ImprovementsCheck[] = [];

    for (const [name, evaluator] of Object.entries(IMPROVEMENTS_EVALUATORS)) {
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
