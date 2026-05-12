/**
 * TapeEvaluationService
 *
 * Generic tape evaluation engine.  Evaluates a batch of RiskTapeItem rows
 * against any versioned ReviewProgram and produces a ReviewTapeResult per row.
 *
 * The service is completely agnostic to programType (FRAUD, QC, 1033, etc.) —
 * the evaluation logic is driven entirely by the program's flag definitions
 * and thresholds.  Only the ReviewProgram seed data differs per type.
 *
 * Responsibilities:
 *   1. Recompute all calculated fields from source inputs (server-authoritative)
 *   2. Evaluate each auto-flag using the program's condition DSL
 *   3. Evaluate each manual (boolean) flag
 *   4. Sum weighted risk score (capped at 100)
 *   5. Derive the overall decision (Accept / Conditional / Reject)
 *   6. Collect data quality issues for missing critical source fields
 *
 * All methods are `public` for direct unit-testing.  The service is pure
 * (no I/O, no side-effects) — callers are responsible for persistence.
 *
 * IMPORTANT: Calculated fields on the incoming item are ALWAYS replaced by
 * server-computed values.  The tape-provided values are treated as hints for
 * display purposes only and are not used in evaluation.
 *
 * Special cases:
 *   - appraiserGeoCompetency is an INVERTED boolean flag:
 *       true  = appraiser IS competent → flag does NOT fire
 *       false = appraiser is NOT competent → flag FIRES
 *     ("No" / "N" string values for the competency question are treated as
 *      false; "Yes" / "Y" / "true" are treated as true.)
 *   - All other manual flags use normal semantics: true/Yes = risk = fires.
 */

import type {
  RiskTapeItem,
  ReviewProgram,
  ReviewTapeResult,
  ReviewAutoFlag,
  ReviewProgramAutoFlagDef,
  ReviewProgramManualFlagDef,
  ReviewThresholds,
  ReviewFlagRule,
  ReviewFlagOperator,
  ReviewConditionOperator,
  ReviewDecision,
  ReviewDecisionRules,
} from '../types/review-tape.types.js';
import type {
  CanonicalCompStatistics,
  CanonicalReportDocument,
} from '@l1/shared-types';
import { mapLoanFromTape, computeLoanRatios } from '../mappers/loan-tape.mapper.js';
import { mapTransactionHistoryFromTape } from '../mappers/transaction-history.mapper.js';
import { mapAvmCrossCheckFromTape } from '../mappers/avm.mapper.js';
import { mapRiskFlagsFromTape } from '../mappers/risk-flags.mapper.js';

/**
 * Project a RiskTapeItem onto a canonical-schema view used by tape evaluation.
 *
 * Tape rows carry pre-computed comp statistics (avgNetAdjPct, nonMlsPct, etc.)
 * as flat fields rather than full comp arrays — those are projected directly
 * onto compStatistics. Loan, ratios, transactionHistory, AVM, and riskFlags
 * branches use the per-source mappers in src/mappers/.
 */
function projectTapeItemToCanonicalView(item: RiskTapeItem): Partial<CanonicalReportDocument> {
  const view: Partial<CanonicalReportDocument> = {};
  const appraisedValue = typeof item.appraisedValue === 'number' ? item.appraisedValue : null;

  const loan = mapLoanFromTape(item);
  if (loan) view.loan = loan;

  const ratios = computeLoanRatios(loan, appraisedValue, item);
  if (ratios) view.ratios = ratios;

  const transactionHistory = mapTransactionHistoryFromTape({
    tape: item,
    appraisedValue,
    effectiveDate: typeof item.appraisalEffectiveDate === 'string' ? item.appraisalEffectiveDate : null,
  });
  if (transactionHistory) view.transactionHistory = transactionHistory;

  const avmCrossCheck = mapAvmCrossCheckFromTape({
    tape: item,
    appraisedValue,
    avmProviderData: null,
  });
  if (avmCrossCheck) view.avmCrossCheck = avmCrossCheck;

  const riskFlags = mapRiskFlagsFromTape({ tape: item });
  if (riskFlags) view.riskFlags = riskFlags;

  // Comp statistics — RiskTapeItem carries these as precomputed flat fields,
  // not as a comp array. Project them directly. RiskTapeItem stores
  // percentages as FRACTIONS (0.20 for 20%) per legacy bulk-tape convention;
  // CanonicalCompStatistics uses MISMO PERCENTAGE form (e.g. 20). Multiply
  // every fraction-form field by 100 when copying. Counts and miles pass
  // through unchanged.
  const toPct = (v: unknown): number | null => (typeof v === 'number' ? v * 100 : null);
  const compStats: CanonicalCompStatistics = {
    selectedCompCount: typeof item.numComps === 'number' ? item.numComps : null,
    averageNetAdjustmentPercent: toPct(item.avgNetAdjPct),
    averageGrossAdjustmentPercent: toPct(item.avgGrossAdjPct),
    maxNetAdjustmentPercent: null,
    maxGrossAdjustmentPercent: null,
    averageDistanceMiles: typeof item.avgDistanceMi === 'number' ? item.avgDistanceMi : null,
    maxDistanceMiles: typeof item.maxDistanceMi === 'number' ? item.maxDistanceMi : null,
    saleDateRangeMonths: typeof item.compsDateRangeMonths === 'number' ? item.compsDateRangeMonths : null,
    nonMlsCompCount: typeof item.nonMlsCount === 'number' ? item.nonMlsCount : null,
    nonMlsCompPercent: toPct(item.nonMlsPct),
    averagePricePerSqFt: typeof item.avgPricePerSf === 'number' ? item.avgPricePerSf : null,
    comparablePriceRangeLow: typeof item.compPriceRangeLow === 'number' ? item.compPriceRangeLow : null,
    comparablePriceRangeHigh: typeof item.compPriceRangeHigh === 'number' ? item.compPriceRangeHigh : null,
  };
  // Only attach if at least one field is populated.
  if (Object.values(compStats).some((v) => v != null)) {
    view.compStatistics = compStats;
  }

  return view;
}

// ─── Critical source fields — absence triggers a data quality issue ───────────
const CRITICAL_SOURCE_FIELDS: (keyof RiskTapeItem)[] = [
  'loanAmount',
  'appraisedValue',
  'firstLienBalance',
];

/**
 * Subset of CRITICAL_SOURCE_FIELDS for which a zero value is also an error.
 * firstLienBalance = 0 is a legitimate state (free-and-clear / no first lien),
 * so it is intentionally excluded here.
 */
const ZERO_INVALID_SOURCE_FIELDS = new Set<keyof RiskTapeItem>([
  'loanAmount',
  'appraisedValue',
]);

// ─── Inverted-boolean manual flag fields ─────────────────────────────────────
// For these fields, a truthy value means "no risk" and falsy means "risk".
// Keys are canonical-schema dotted paths (post-UAD-alignment). Add a path
// here if a new manual flag follows the inverted convention.
const INVERTED_BOOLEAN_FLAGS = new Set<string>([
  'riskFlags.appraiserGeoCompetency',
]);

/**
 * Walk a dotted path on a record graph. Returns undefined when any segment
 * doesn't exist. Mirrors getFieldValue in bulk-ingestion-criteria-worker.
 */
function getValueByPath(root: unknown, path: string): unknown {
  if (root == null || typeof root !== 'object') return undefined;
  if (!path) return undefined;
  const parts = path.split('.');
  let cursor: unknown = root;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

export class TapeEvaluationService {
  // ─── Public entry point ──────────────────────────────────────────────────────

  /**
   * Evaluate a batch of tape items against a review program.
   * Returns one ReviewTapeResult per input item in the same order.
   */
  evaluate(items: RiskTapeItem[], program: ReviewProgram): ReviewTapeResult[] {
    return items.map(item => this.evaluateOne(item, program));
  }

  // ─── Calculated fields ───────────────────────────────────────────────────────

  /**
   * Recompute all derived/calculated fields from source inputs.
   * Returns a new object — never mutates the input.
   * Fields that cannot be computed (missing source data) are left undefined.
   */
  computeCalculatedFields(item: RiskTapeItem): RiskTapeItem {
    const out: RiskTapeItem = { ...item };

    // LTV = loanAmount / appraisedValue
    if (out.loanAmount != null && out.appraisedValue != null && out.appraisedValue > 0) {
      out.ltv = out.loanAmount / out.appraisedValue;
    } else {
      delete out.ltv;
    }

    // CLTV = (firstLienBalance + secondLienBalance) / appraisedValue
    if (out.firstLienBalance != null && out.appraisedValue != null && out.appraisedValue > 0) {
      const secondLien = out.secondLienBalance ?? 0;
      out.cltv = (out.firstLienBalance + secondLien) / out.appraisedValue;
    } else {
      delete out.cltv;
    }

    // appreciation24m = (appraisedValue - priorSale24mPrice) / priorSale24mPrice
    if (out.priorSale24mPrice != null && out.priorSale24mPrice > 0 && out.appraisedValue != null) {
      out.appreciation24m = (out.appraisedValue - out.priorSale24mPrice) / out.priorSale24mPrice;
    } else {
      delete out.appreciation24m;
    }

    // appreciation36m = (appraisedValue - priorSale36mPrice) / priorSale36mPrice
    if (out.priorSale36mPrice != null && out.priorSale36mPrice > 0 && out.appraisedValue != null) {
      out.appreciation36m = (out.appraisedValue - out.priorSale36mPrice) / out.priorSale36mPrice;
    } else {
      delete out.appreciation36m;
    }

    // avmGapPct = |appraisedValue - avmValue| / avmValue
    if (out.avmValue != null && out.avmValue > 0 && out.appraisedValue != null) {
      out.avmGapPct = Math.abs(out.appraisedValue - out.avmValue) / out.avmValue;
    } else {
      delete out.avmGapPct;
    }

    // nonMlsPct = nonMlsCount / numComps  (only when numComps > 0)
    if (out.numComps != null && out.numComps > 0 && out.nonMlsCount != null) {
      out.nonMlsPct = out.nonMlsCount / out.numComps;
    } else {
      delete out.nonMlsPct;
    }

    // cashOutRefi: derived from loanPurpose
    if (out.loanPurpose != null) {
      out.cashOutRefi = /cash.?out\s+refi/i.test(out.loanPurpose);
    }

    return out;
  }

  // ─── Auto-flag evaluation ────────────────────────────────────────────────────

  /**
   * Evaluate all auto-flag definitions against the (already-calculated) item.
   * Returns one ReviewAutoFlag per definition in the program's autoFlags array,
   * whether fired or not.
   */
  evaluateAutoFlags(item: Partial<CanonicalReportDocument>, program: ReviewProgram): ReviewAutoFlag[] {
    if (!program.autoFlags || !program.thresholds) {
      throw new Error(
        `ReviewProgram '${program.id}' has no inline autoFlags/thresholds. ` +
        'Use MopCriteriaService.getCompiledCriteria() to resolve rulesetRefs before calling TapeEvaluationService.',
      );
    }
    return program.autoFlags.map(def => this.evaluateAutoFlag(item, def, program.thresholds!));
  }

  // ─── Manual flag evaluation ──────────────────────────────────────────────────

  /**
   * Evaluate all manual-flag definitions against the item's boolean fields.
   * Returns one ReviewAutoFlag per definition.
   */
  evaluateManualFlags(item: Partial<CanonicalReportDocument>, program: ReviewProgram): ReviewAutoFlag[] {
    if (!program.manualFlags) {
      throw new Error(
        `ReviewProgram '${program.id}' has no inline manualFlags. ` +
        'Use MopCriteriaService.getCompiledCriteria() to resolve rulesetRefs before calling TapeEvaluationService.',
      );
    }
    return program.manualFlags.map(def => this.evaluateManualFlag(item, def));
  }

  // ─── Risk score ──────────────────────────────────────────────────────────────

  /**
   * Sum the weights of all fired flags (auto + manual), capped at 100.
   */
  computeRiskScore(autoFlags: ReviewAutoFlag[], manualFlags: ReviewAutoFlag[]): number {
    const raw = [...autoFlags, ...manualFlags]
      .filter(f => f.isFired)
      .reduce((sum, f) => sum + f.weight, 0);
    return Math.min(raw, 100);
  }

  // ─── Decision ────────────────────────────────────────────────────────────────

  /**
   * Derive the overall decision from the risk score using program decision rules.
   * Score >= reject.minScore → Reject
   * Score >= conditional.minScore → Conditional
   * Otherwise → Accept
   */
  deriveDecision(score: number, rules: ReviewDecisionRules): ReviewDecision {
    if (score >= rules.reject.minScore) return 'Reject';
    if (score >= rules.conditional.minScore) return 'Conditional';
    return 'Accept';
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private evaluateOne(raw: RiskTapeItem, program: ReviewProgram): ReviewTapeResult {
    const item = this.computeCalculatedFields(raw);
    const dataQualityIssues = this.collectDataQualityIssues(item);

    // Project the tape item onto a canonical-schema view ONCE per evaluation —
    // rule fields are dotted canonical paths, walked via getValueByPath below.
    const canonicalView = projectTapeItemToCanonicalView(item);

    const autoFlagResults = this.evaluateAutoFlags(canonicalView, program);
    const manualFlagResults = this.evaluateManualFlags(canonicalView, program);
    const overallRiskScore = this.computeRiskScore(autoFlagResults, manualFlagResults);
    if (!program.decisionRules) {
      throw new Error(
        `ReviewProgram '${program.id}' has no inline decisionRules. ` +
        'Use MopCriteriaService.getCompiledCriteria() to resolve rulesetRefs before calling TapeEvaluationService.',
      );
    }
    const computedDecision = this.deriveDecision(overallRiskScore, program.decisionRules);

    return {
      ...item,
      overallRiskScore,
      computedDecision,
      autoFlagResults,
      manualFlagResults,
      dataQualityIssues,
      evaluatedAt: new Date().toISOString(),
      programId: program.id,
      programVersion: program.version,
    };
  }

  private evaluateAutoFlag(
    canonicalView: Partial<CanonicalReportDocument>,
    def: ReviewProgramAutoFlagDef,
    thresholds: ReviewThresholds,
  ): ReviewAutoFlag {
    const { operator, rules } = def.condition;
    let isFired: boolean;

    if (operator === 'AND') {
      isFired = rules.every(rule => this.evaluateRule(canonicalView, rule, thresholds));
    } else {
      // OR
      isFired = rules.some(rule => this.evaluateRule(canonicalView, rule, thresholds));
    }

    // Surface the "interesting" (comparison) rule's value for display.
    // For AND conditions the guard rules (NOT_NULL / GT>0) come first;
    // the actual comparison rule is last — so we walk backwards.
    const firedRule = isFired ? this.findDisplayRule(operator, rules, canonicalView, thresholds) : undefined;
    const actualValue = firedRule
      ? (getValueByPath(canonicalView, firedRule.field) as number | string | boolean | null | undefined)
      : undefined;
    const thresholdValue = firedRule?.thresholdKey != null
      ? thresholds[firedRule.thresholdKey]
      : firedRule?.value;

    return {
      id: def.id,
      label: def.label,
      description: def.description,
      severity: def.severity,
      weight: def.weight,
      isFired,
      actualValue: actualValue ?? null,
      thresholdValue: thresholdValue ?? null,
    };
  }

  private evaluateRule(
    canonicalView: Partial<CanonicalReportDocument>,
    rule: ReviewFlagRule,
    thresholds: ReviewThresholds,
  ): boolean {
    const fieldValue = getValueByPath(canonicalView, rule.field);
    const threshold = rule.thresholdKey != null ? thresholds[rule.thresholdKey] : rule.value;

    return this.applyOperator(rule.op, fieldValue, threshold);
  }

  private applyOperator(
    op: ReviewFlagOperator,
    actual: unknown,
    threshold: number | boolean | undefined,
  ): boolean {
    switch (op) {
      case 'NOT_NULL':
        return actual != null;
      case 'IS_TRUE':
        return this.isTruthy(actual);
      case 'GT':
        return typeof actual === 'number' && typeof threshold === 'number' && actual > threshold;
      case 'GTE':
        return typeof actual === 'number' && typeof threshold === 'number' && actual >= threshold;
      case 'LT':
        return typeof actual === 'number' && typeof threshold === 'number' && actual < threshold;
      case 'LTE':
        return typeof actual === 'number' && typeof threshold === 'number' && actual <= threshold;
      case 'EQ':
        return actual === threshold;
      default: {
        const _exhaustive: never = op;
        return false;
      }
    }
  }

  /**
   * Find the rule whose field + threshold should be surfaced in the UI.
   *
   * For AND conditions the first rules are typically guards (NOT_NULL / GT>0);
   * the last rule is the meaningful comparison.  Walking backwards ensures we
   * return the comparison rule, so the UI shows the actual value and threshold
   * that caused the flag to fire (e.g. ltv=0.85, threshold=0.80) rather than
   * the guard field's value (ltv=0.85, threshold=null).
   *
   * For OR conditions the first matching rule is used as-is.
   */
  private findDisplayRule(
    operator: ReviewConditionOperator,
    rules: ReviewFlagRule[],
    canonicalView: Partial<CanonicalReportDocument>,
    thresholds: ReviewThresholds,
  ): ReviewFlagRule | undefined {
    if (operator === 'AND') {
      for (let i = rules.length - 1; i >= 0; i--) {
        if (this.evaluateRule(canonicalView, rules[i]!, thresholds)) return rules[i];
      }
      return undefined;
    }
    return rules.find(r => this.evaluateRule(canonicalView, r, thresholds));
  }

  private evaluateManualFlag(
    canonicalView: Partial<CanonicalReportDocument>,
    def: ReviewProgramManualFlagDef,
  ): ReviewAutoFlag {
    const raw = getValueByPath(canonicalView, def.field);
    const isInverted = INVERTED_BOOLEAN_FLAGS.has(def.field);

    let isFired: boolean;
    if (isInverted) {
      // Flag fires when the field is falsy (not competent / not compliant)
      isFired = !this.isTruthy(raw);
    } else {
      // Flag fires when the field is truthy (risk is present)
      isFired = this.isTruthy(raw);
    }

    return {
      id: def.id,
      label: def.label,
      description: def.description,
      severity: def.severity,
      weight: def.weight,
      isFired,
      actualValue: raw as number | string | boolean | null | undefined ?? null,
      thresholdValue: null,
    };
  }

  /**
   * Normalize a boolean-like value to true/false.
   * Accepts: true, "Yes", "yes", "Y", "y", "true", "1", 1
   * Everything else is falsy (including undefined/null).
   */
  private isTruthy(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      return /^(yes|y|true|1)$/i.test(value.trim());
    }
    return false;
  }

  /**
   * Collect data quality issues for critical source fields that are missing or
   * zero — these fields are required for the evaluation to be reliable.
   */
  private collectDataQualityIssues(item: RiskTapeItem): string[] {
    const issues: string[] = [];

    for (const field of CRITICAL_SOURCE_FIELDS) {
      const value = item[field];
      if (value == null) {
        issues.push(
          `Missing critical field: '${field}' — LTV, CLTV and related flags cannot be computed without it.`,
        );
      } else if (typeof value === 'number' && value === 0 && ZERO_INVALID_SOURCE_FIELDS.has(field)) {
        issues.push(
          `Field '${field}' is 0 — this may indicate a data entry error and will prevent accurate LTV/CLTV calculation.`,
        );
      }
    }

    return issues;
  }
}
