/**
 * Review-flag-condition evaluator (shared utility — slice 8h).
 *
 * Evaluates a `ReviewFlagCondition` against a partial CanonicalReportDocument.
 * Same semantics as `TapeEvaluationService.evaluateRule` (which remains the
 * authoritative implementation for tape evaluation) but extracted to a pure
 * utility so it can be reused by:
 *   - Order decomposition rules (slice 8h: rule-driven composition)
 *   - Future review-program / criteria evaluators that share the predicate DSL
 *
 * Pure: no I/O, no state, no logging. Returns boolean.
 *
 * Predicate paths use dotted-path lookup into the canonical view. Numeric
 * comparisons are strict (typeof === 'number'); EQ uses strict equality so
 * boolean/string EQ work without coercion. Threshold values come either from
 * a literal `value` or from the optional `thresholds` map keyed by
 * `thresholdKey` (matches the review-program pattern).
 */

import type { CanonicalReportDocument } from '@l1/shared-types';
import type {
    ReviewFlagCondition,
    ReviewFlagOperator,
    ReviewFlagRule,
    ReviewThresholds,
} from '../types/review-tape.types.js';

// ─── Path lookup ─────────────────────────────────────────────────────────────

function getValueByPath(obj: unknown, path: string): unknown {
    if (obj == null || typeof obj !== 'object' || !path) return undefined;
    let cur: any = obj;
    for (const segment of path.split('.')) {
        if (cur == null) return undefined;
        cur = cur[segment];
    }
    return cur;
}

// ─── Operators ───────────────────────────────────────────────────────────────

function isTruthy(v: unknown): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0 && v !== 'false' && v !== '0';
    return v != null;
}

function applyOperator(
    op: ReviewFlagOperator,
    actual: unknown,
    threshold: number | boolean | undefined,
): boolean {
    switch (op) {
        case 'NOT_NULL':
            return actual != null;
        case 'IS_TRUE':
            return isTruthy(actual);
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

// ─── Rule + condition evaluation ─────────────────────────────────────────────

function evaluateRule(
    canonicalView: Partial<CanonicalReportDocument>,
    rule: ReviewFlagRule,
    thresholds: ReviewThresholds | undefined,
): boolean {
    const fieldValue = getValueByPath(canonicalView, rule.field);
    const threshold = rule.thresholdKey != null && thresholds
        ? thresholds[rule.thresholdKey]
        : rule.value;
    return applyOperator(rule.op, fieldValue, threshold);
}

/**
 * Evaluate a `ReviewFlagCondition` against a partial CanonicalReportDocument.
 *
 * @param canonicalView - the canonical view to walk paths against
 * @param condition - the predicate (AND/OR over a list of rules)
 * @param thresholds - optional threshold map; required only when any rule
 *                     uses `thresholdKey`. Pass undefined when conditions
 *                     are literal-only (typical for decomposition rules).
 */
export function evaluateReviewFlagCondition(
    canonicalView: Partial<CanonicalReportDocument>,
    condition: ReviewFlagCondition,
    thresholds?: ReviewThresholds,
): boolean {
    if (condition.rules.length === 0) {
        return false; // empty condition is vacuously false
    }
    if (condition.operator === 'AND') {
        return condition.rules.every((r) => evaluateRule(canonicalView, r, thresholds));
    }
    // 'OR'
    return condition.rules.some((r) => evaluateRule(canonicalView, r, thresholds));
}
