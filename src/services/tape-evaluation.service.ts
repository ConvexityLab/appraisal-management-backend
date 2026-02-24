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
  ReviewDecision,
  ReviewDecisionRules,
} from '../types/review-tape.types.js';

// ─── Critical source fields — absence triggers a data quality issue ───────────
const CRITICAL_SOURCE_FIELDS: (keyof RiskTapeItem)[] = [
  'loanAmount',
  'appraisedValue',
  'firstLienBalance',
];

// ─── Inverted-boolean manual flag fields ─────────────────────────────────────
// For these fields, a truthy value means "no risk" and falsy means "risk".
const INVERTED_BOOLEAN_FLAGS = new Set<keyof RiskTapeItem>([
  'appraiserGeoCompetency',
]);

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
  evaluateAutoFlags(item: RiskTapeItem, program: ReviewProgram): ReviewAutoFlag[] {
    return program.autoFlags.map(def => this.evaluateAutoFlag(item, def, program.thresholds));
  }

  // ─── Manual flag evaluation ──────────────────────────────────────────────────

  /**
   * Evaluate all manual-flag definitions against the item's boolean fields.
   * Returns one ReviewAutoFlag per definition.
   */
  evaluateManualFlags(item: RiskTapeItem, program: ReviewProgram): ReviewAutoFlag[] {
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

    const autoFlagResults = this.evaluateAutoFlags(item, program);
    const manualFlagResults = this.evaluateManualFlags(item, program);
    const overallRiskScore = this.computeRiskScore(autoFlagResults, manualFlagResults);
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
    item: RiskTapeItem,
    def: ReviewProgramAutoFlagDef,
    thresholds: ReviewThresholds,
  ): ReviewAutoFlag {
    const { operator, rules } = def.condition;
    let isFired: boolean;

    if (operator === 'AND') {
      isFired = rules.every(rule => this.evaluateRule(item, rule, thresholds));
    } else {
      // OR
      isFired = rules.some(rule => this.evaluateRule(item, rule, thresholds));
    }

    // Surface the first fired rule's actual value for display
    const firedRule = isFired ? rules.find(r => this.evaluateRule(item, r, thresholds)) : undefined;
    const actualValue = firedRule ? (item[firedRule.field] as number | string | boolean | null | undefined) : undefined;
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
    item: RiskTapeItem,
    rule: ReviewFlagRule,
    thresholds: ReviewThresholds,
  ): boolean {
    const fieldValue = item[rule.field];
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

  private evaluateManualFlag(
    item: RiskTapeItem,
    def: ReviewProgramManualFlagDef,
  ): ReviewAutoFlag {
    const raw = item[def.field];
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
      } else if (typeof value === 'number' && value === 0) {
        issues.push(
          `Field '${field}' is 0 — this may indicate a data entry error and will prevent accurate LTV/CLTV calculation.`,
        );
      }
    }

    return issues;
  }
}
