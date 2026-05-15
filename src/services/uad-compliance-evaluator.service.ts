/**
 * UAD-3.6 Compliance Evaluator
 *
 * Runs a per-rule compliance check over the latest canonical extraction
 * snapshot for an order and emits a 0-100 score plus a list of blockers
 * the QC reviewer should resolve before signing off.
 *
 * Scope: a curated set of built-in rules covering the most load-bearing
 * required fields per Fannie Mae UAD 3.6 / URAR v1.3 — subject
 * identification, key property characteristics, the sales-comparison
 * grid backbone, and the value reconciliation. Predicates reference
 * canonical-schema fields by name so field-name typos surface at
 * compile time.
 *
 * Pack overlay: the Decision Engine `uad-compliance` category lets
 * admins layer two kinds of rule on top of the built-ins:
 *
 *   UadOverrideRule — references a BUILT-IN rule id and changes its
 *     enabled state, severity, or remediation message. The predicate
 *     stays in code. This is the 90% case (federal-spec changes are
 *     rare; per-tenant policy nuance is common).
 *
 *   UadCustomRule   — admin-authored rule with its OWN JSONLogic
 *     predicate against the canonical document. Lets tenants enforce
 *     rules outside the federal-spec catalogue (e.g., "require pool
 *     description on every report" for a tenant with a pool-finance
 *     line of business) without a code change. Evaluated via the
 *     shared decision-engine JSONLogic evaluator; throws are caught
 *     and surfaced as rule failures so a broken predicate becomes an
 *     admin task instead of a silent error.
 *
 * Why "stateless compute" instead of persisting: the canonical snapshot
 * already lives in Cosmos. Re-evaluating on demand keeps the verdict in
 * sync with the latest extraction without a third copy of the same data.
 */

import type { CanonicalReportDocument } from '@l1/shared-types';
import { Logger } from '../utils/logger.js';
import { evaluate as evaluateJsonLogic } from './decision-engine/shared/jsonlogic-evaluator.js';

export type UadComplianceSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface UadComplianceRuleResult {
  /** Stable rule identifier — used in logs, audit trails, and future ML joins. */
  id: string;
  /** Short human label for the UI. */
  label: string;
  severity: UadComplianceSeverity;
  passed: boolean;
  /**
   * Empty when passed; otherwise a one-sentence remediation hint. The UI
   * surfaces this in a tooltip on the rule chip.
   */
  message: string;
  /**
   * Dotted path into the canonical schema (e.g., "subject.grossLivingArea")
   * — lets the FE deep-link or scroll to the relevant editor section.
   * Undefined for rules that span multiple fields.
   */
  fieldPath?: string;
}

export interface UadComplianceReport {
  orderId: string;
  generatedAt: string;
  /** 0..100 — share of rules that passed, weighted by severity. */
  overallScore: number;
  passCount: number;
  failCount: number;
  /** Rules that failed at CRITICAL severity (block QC sign-off). */
  blockers: string[];
  rules: UadComplianceRuleResult[];
  /** True when a canonical snapshot was found; false short-circuits all rules. */
  snapshotAvailable: boolean;
}

// ─── Rule definitions ─────────────────────────────────────────────────────────

interface RuleDef {
  id: string;
  label: string;
  severity: UadComplianceSeverity;
  fieldPath?: string;
  /** Returns null when the rule passes, or a remediation message when it fails. */
  check: (doc: CanonicalReportDocument) => string | null;
}

const RULES: RuleDef[] = [
  // ── CRITICAL — report is unusable without these ──────────────────────────────
  {
    id: 'subject-address-present',
    label: 'Subject address present',
    severity: 'CRITICAL',
    fieldPath: 'subject.address',
    check: (doc) => {
      const a = doc.subject?.address;
      if (!a || !a.streetAddress?.trim() || !a.city?.trim() || !a.state?.trim() || !a.zipCode?.trim()) {
        return 'Subject street, city, state, and ZIP must all be present.';
      }
      return null;
    },
  },
  {
    id: 'valuation-effective-date',
    label: 'Effective date',
    severity: 'CRITICAL',
    fieldPath: 'valuation.effectiveDate',
    check: (doc) => {
      const ed = doc.valuation?.effectiveDate ?? doc.metadata?.effectiveDate;
      return ed ? null : 'Effective date is required on the valuation.';
    },
  },
  {
    id: 'valuation-final-value',
    label: 'Reconciled final value',
    severity: 'CRITICAL',
    fieldPath: 'valuation.estimatedValue',
    check: (doc) => {
      const v = doc.valuation?.estimatedValue;
      if (typeof v !== 'number' || v <= 0) {
        return 'Final reconciled value must be a positive number.';
      }
      return null;
    },
  },
  {
    id: 'comps-minimum-three',
    label: 'At least 3 comparable sales',
    severity: 'CRITICAL',
    fieldPath: 'comps',
    check: (doc) => {
      const n = doc.comps?.length ?? 0;
      if (n < 3) return `Only ${n} comp${n === 1 ? '' : 's'} present — UAD requires at least 3.`;
      return null;
    },
  },

  // ── HIGH — present-but-incomplete cases that the reviewer must resolve ──────
  {
    id: 'subject-gla',
    label: 'Subject GLA',
    severity: 'HIGH',
    fieldPath: 'subject.grossLivingArea',
    check: (doc) => {
      const v = doc.subject?.grossLivingArea;
      return typeof v === 'number' && v > 0 ? null : 'Subject gross living area is missing.';
    },
  },
  {
    id: 'subject-year-built',
    label: 'Subject year built',
    severity: 'HIGH',
    fieldPath: 'subject.yearBuilt',
    check: (doc) => {
      const v = doc.subject?.yearBuilt;
      return typeof v === 'number' && v > 0 ? null : 'Subject year built is missing.';
    },
  },
  {
    id: 'subject-bedrooms',
    label: 'Subject bedrooms',
    severity: 'HIGH',
    fieldPath: 'subject.bedrooms',
    check: (doc) => {
      const v = doc.subject?.bedrooms;
      return typeof v === 'number' && v >= 0 ? null : 'Subject bedroom count is missing.';
    },
  },
  {
    id: 'subject-baths-split',
    label: 'Subject baths (full + half)',
    severity: 'HIGH',
    fieldPath: 'subject.bathsFull',
    check: (doc) => {
      const f = doc.subject?.bathsFull;
      const h = doc.subject?.bathsHalf;
      // URAR v1.3 requires the split; legacy bathrooms total alone fails.
      if (typeof f !== 'number' || typeof h !== 'number') {
        return 'UAD 3.6 requires separate bathsFull and bathsHalf counts.';
      }
      return null;
    },
  },
  {
    id: 'subject-condition-rating',
    label: 'Subject condition (C1–C6)',
    severity: 'HIGH',
    fieldPath: 'subject.condition',
    check: (doc) => {
      const c = doc.subject?.condition;
      if (!c || !/^C[1-6]$/.test(c.trim())) {
        return 'UAD condition rating must be one of C1..C6.';
      }
      return null;
    },
  },
  {
    id: 'subject-quality-rating',
    label: 'Subject quality (Q1–Q6)',
    severity: 'HIGH',
    fieldPath: 'subject.quality',
    check: (doc) => {
      const q = doc.subject?.quality;
      if (!q || !/^Q[1-6]$/.test(q.trim())) {
        return 'UAD quality rating must be one of Q1..Q6.';
      }
      return null;
    },
  },
  {
    id: 'subject-lot-size',
    label: 'Subject lot size',
    severity: 'HIGH',
    fieldPath: 'subject.lotSizeSqFt',
    check: (doc) => {
      const v = doc.subject?.lotSizeSqFt;
      return typeof v === 'number' && v > 0 ? null : 'Subject lot size (sq ft) is missing.';
    },
  },
  {
    id: 'comps-sale-prices-present',
    label: 'All comps have sale prices',
    severity: 'HIGH',
    fieldPath: 'comps[].salePrice',
    check: (doc) => {
      const comps = doc.comps ?? [];
      const missing = comps.filter((c) => typeof c.salePrice !== 'number' || c.salePrice <= 0);
      if (missing.length > 0) {
        return `${missing.length} of ${comps.length} comp${comps.length === 1 ? '' : 's'} missing salePrice.`;
      }
      return null;
    },
  },
  {
    id: 'comps-sale-dates-present',
    label: 'All comps have sale dates',
    severity: 'HIGH',
    fieldPath: 'comps[].saleDate',
    check: (doc) => {
      const comps = doc.comps ?? [];
      const missing = comps.filter((c) => !c.saleDate);
      if (missing.length > 0) {
        return `${missing.length} of ${comps.length} comp${comps.length === 1 ? '' : 's'} missing saleDate.`;
      }
      return null;
    },
  },

  // ── MEDIUM — flag in summary but don't block sign-off ────────────────────────
  {
    id: 'subject-parcel-number',
    label: 'Subject APN',
    severity: 'MEDIUM',
    fieldPath: 'subject.parcelNumber',
    check: (doc) => {
      const v = doc.subject?.parcelNumber;
      return typeof v === 'string' && v.trim().length > 0 ? null : 'Subject APN missing — verify with assessor.';
    },
  },
  {
    id: 'comps-gla-present',
    label: 'All comps have GLA',
    severity: 'MEDIUM',
    fieldPath: 'comps[].grossLivingArea',
    check: (doc) => {
      const comps = doc.comps ?? [];
      const missing = comps.filter((c) => typeof c.grossLivingArea !== 'number' || c.grossLivingArea <= 0);
      if (missing.length > 0) {
        return `${missing.length} comp${missing.length === 1 ? '' : 's'} missing GLA.`;
      }
      return null;
    },
  },
  {
    id: 'appraiser-license',
    label: 'Appraiser license info',
    severity: 'MEDIUM',
    fieldPath: 'appraiserInfo.licenseNumber',
    check: (doc) => {
      const info = doc.appraiserInfo;
      if (!info?.name?.trim() || !info?.licenseNumber?.trim() || !info?.licenseState?.trim()) {
        return 'Appraiser name, license number, and license state are required.';
      }
      return null;
    },
  },
];

// Severity weights for the 0-100 score. CRITICAL failures dominate;
// MEDIUM failures barely move the needle but still register.
const WEIGHTS: Record<UadComplianceSeverity, number> = {
  CRITICAL: 10,
  HIGH: 4,
  MEDIUM: 1,
};

/**
 * Per-rule pack configuration for a BUILT-IN rule. Admins author one of
 * these per existing rule via the Decision Engine workspace; the
 * evaluator layers the config on top of the code-side defaults at
 * compute time.
 *
 * Why config-only and not full JSONLogic predicates: the predicates
 * for built-in rules are typed against CanonicalReportDocument, so
 * field-name typos get caught at compile time. UAD 3.6 is a federal
 * spec — built-in "new rules" are rare. Admins overwhelmingly need to
 * turn rules off (per-client carve-outs), re-weight (push a
 * critical-to-this-tenant rule higher), or rewrite the remediation
 * message in the tenant's vocabulary.
 *
 * For genuinely new tenant-specific rules (outside the federal-spec
 * catalogue), use UadCustomRule instead — that one DOES carry a
 * JSONLogic predicate.
 *
 * `kind: 'override'` is optional for back-compat with packs persisted
 * before custom rules shipped (those entries have no kind field).
 * Absence is treated as 'override'.
 */
export interface UadRuleConfig {
  kind?: 'override';
  id: string;
  /** When false the rule is skipped entirely (not present in output). */
  enabled: boolean;
  /** Override the code-side default severity (e.g., bump APN to HIGH per-client). */
  severityOverride?: UadComplianceSeverity;
  /** Custom remediation message shown to the reviewer when the rule fails. */
  messageOverride?: string;
}

/**
 * Admin-authored compliance rule with its OWN JSONLogic predicate. The
 * predicate runs against the canonical report document; a truthy result
 * means the rule FAILED (the predicate is a "matches-when-broken"
 * expression so it reads naturally: e.g., `{"missing": ["subject.pool"]}`
 * fails when the pool description is absent).
 *
 * Evaluation errors (malformed JSONLogic, unsupported operator, etc.)
 * are caught and surfaced as a failure with a system-error message —
 * never propagate to the order-level compliance call. The pack's
 * validateRules catches obvious shape errors before persistence; this
 * is a runtime safety net for cases that slip through (e.g., a
 * field-path typo that's only invalid against this specific doc).
 *
 * Pack validation enforces:
 *   - id is unique within the pack and does not collide with built-in ids
 *   - label, message are non-empty strings
 *   - severity is a valid UadComplianceSeverity
 *   - condition is a plain JSON value (object/array/scalar)
 *   - condition depth <= MAX_CONDITION_DEPTH (DoS guard against deeply
 *     nested expressions that could stack-overflow the recursive
 *     evaluator)
 */
export interface UadCustomRule {
  kind: 'custom';
  id: string;
  enabled: boolean;
  label: string;
  severity: UadComplianceSeverity;
  /**
   * JSONLogic AST. Truthy ⇒ rule fails. The shared evaluator at
   * decision-engine/shared/jsonlogic-evaluator handles a curated
   * operator set; unsupported operators throw, which we catch.
   */
  condition: unknown;
  /** Remediation copy shown when the rule fails. */
  message: string;
  /**
   * Optional dotted-path hint surfaced in the FE for deep-linking. Has
   * no effect on evaluation; informational only.
   */
  fieldPath?: string;
}

/** Discriminated union of pack rules. */
export type UadPackRule = UadRuleConfig | UadCustomRule;

/**
 * Resolved BUILT-IN rule configs map — produced by the per-tenant overlay
 * resolver and handed to evaluate(). One entry per built-in rule id.
 * Absent entries fall back to the code-side defaults (enabled=true,
 * severity as declared, no message override).
 *
 * Custom rules are not part of this map — they're carried alongside
 * via the `customRules` parameter on evaluate().
 */
export type UadRuleConfigMap = Record<string, UadRuleConfig>;

/**
 * Maximum nesting depth allowed in a custom rule's condition AST.
 * 32 is comfortably above any condition the FE editor would ever
 * produce; deeper than that is almost certainly a malformed payload.
 * Enforced by the category validator before write so the evaluator
 * runtime never sees the malformed input.
 */
export const MAX_CONDITION_DEPTH = 32;

/**
 * Partition a mixed pack rules array into (configMap, customRules).
 * Entries without an explicit `kind` field default to 'override' for
 * back-compat with packs persisted before custom rules shipped.
 *
 * Exported so the controller can run the resolver's layered rule list
 * through here once and hand the two halves to evaluate().
 */
export function partitionPackRules(rules: UadPackRule[]): {
  configMap: UadRuleConfigMap;
  customRules: UadCustomRule[];
} {
  const configMap: UadRuleConfigMap = {};
  const customRules: UadCustomRule[] = [];
  for (const r of rules) {
    if (!r || typeof r !== 'object') continue;
    if (r.kind === 'custom') {
      customRules.push(r);
    } else if (typeof (r as UadRuleConfig).id === 'string') {
      configMap[(r as UadRuleConfig).id] = r as UadRuleConfig;
    }
  }
  return { configMap, customRules };
}

export class UadComplianceEvaluatorService {
  private readonly logger = new Logger('UadComplianceEvaluatorService');

  /**
   * Evaluate a canonical report against the rule set. Pure function:
   * same (doc, configMap, customRules) inputs always produce the same
   * verdict (modulo `generatedAt`).
   *
   * Returns an empty/zero report with snapshotAvailable=false when the
   * caller passes null — lets the controller distinguish "extraction
   * pending" from "extraction done, fails everything" cleanly.
   *
   * Inputs:
   *   - `configMap`   — per-built-in-rule overrides from the resolved
   *                     Decision Engine pack (BASE → CLIENT layered).
   *                     Disabled rules drop out of the output entirely;
   *                     severityOverride bumps the rule's contribution
   *                     to score + blocker list; messageOverride
   *                     replaces the code-default remediation copy.
   *   - `customRules` — tenant-authored rules with their own JSONLogic
   *                     predicates. Each appended to the rules array
   *                     with `kind: 'custom'` rule.id namespacing. A
   *                     predicate that throws is caught and treated as
   *                     a failure with a system-error message so a
   *                     malformed admin rule never blocks the
   *                     compliance call.
   *
   * Both inputs are optional; calling with neither preserves the MVP
   * code-default behaviour for tenants that haven't authored a pack.
   */
  evaluate(
    orderId: string,
    doc: CanonicalReportDocument | null,
    configMap?: UadRuleConfigMap,
    customRules?: UadCustomRule[],
  ): UadComplianceReport {
    if (!doc) {
      return {
        orderId,
        generatedAt: new Date().toISOString(),
        overallScore: 0,
        passCount: 0,
        failCount: 0,
        blockers: [],
        rules: [],
        snapshotAvailable: false,
      };
    }

    const rules: UadComplianceRuleResult[] = [];

    // ─── Built-in rules (configurable via overrides) ─────────────────────────
    for (const rule of RULES) {
      const cfg = configMap?.[rule.id];
      if (cfg && cfg.enabled === false) continue;
      const severity: UadComplianceSeverity = cfg?.severityOverride ?? rule.severity;
      const failure = rule.check(doc);
      const result: UadComplianceRuleResult = failure
        ? {
            id: rule.id,
            label: rule.label,
            severity,
            passed: false,
            message: cfg?.messageOverride?.trim() || failure,
          }
        : {
            id: rule.id,
            label: rule.label,
            severity,
            passed: true,
            message: '',
          };
      if (rule.fieldPath) result.fieldPath = rule.fieldPath;
      rules.push(result);
    }

    // ─── Custom (admin-authored JSONLogic) rules ────────────────────────────
    if (customRules && customRules.length > 0) {
      for (const custom of customRules) {
        if (custom.enabled === false) continue;
        // Defensive — partitionPackRules already filtered malformed rows,
        // but evaluate() is also called directly from tests + the preview
        // path so guard one more time here.
        if (!custom.id || typeof custom.id !== 'string') continue;

        let passed = true;
        let failureMessage = '';
        try {
          const matched = evaluateJsonLogic(custom.condition, doc as unknown as Record<string, unknown>);
          // Truthy ⇒ the FAILURE predicate matched ⇒ rule failed.
          passed = !this.truthy(matched);
          if (!passed) {
            failureMessage = custom.message?.trim()
              || `${custom.label || custom.id} failed (no message configured).`;
          }
        } catch (err) {
          passed = false;
          const errMsg = err instanceof Error ? err.message : String(err);
          this.logger.warn('Custom UAD compliance rule evaluation failed', {
            orderId,
            ruleId: custom.id,
            error: errMsg,
          });
          // Surface the error in the report so admins see it instead of
          // silently passing the rule. The reviewer sees this and pings
          // the platform admin to fix the predicate.
          failureMessage = `Custom rule evaluation error: ${errMsg}. Edit this rule in /admin/decision-engine.`;
        }

        const result: UadComplianceRuleResult = {
          id: custom.id,
          label: custom.label || custom.id,
          severity: custom.severity,
          passed,
          message: passed ? '' : failureMessage,
        };
        if (custom.fieldPath) result.fieldPath = custom.fieldPath;
        rules.push(result);
      }
    }

    const passCount = rules.filter((r) => r.passed).length;
    const failCount = rules.length - passCount;
    const blockers = rules.filter((r) => !r.passed && r.severity === 'CRITICAL').map((r) => r.id);

    // Severity-weighted score: sum(weight if passed) / sum(weight) * 100
    let earned = 0;
    let total = 0;
    for (const r of rules) {
      const w = WEIGHTS[r.severity];
      total += w;
      if (r.passed) earned += w;
    }
    const overallScore = total > 0 ? Math.round((earned / total) * 100) : 0;

    return {
      orderId,
      generatedAt: new Date().toISOString(),
      overallScore,
      passCount,
      failCount,
      blockers,
      rules,
      snapshotAvailable: true,
    };
  }

  /**
   * Mirror of jsonlogic-evaluator's `truthy` semantics so callers don't
   * need to import a private helper. Kept private; tests exercise it
   * through evaluate().
   */
  private truthy(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0 && !Number.isNaN(v);
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }
}

/**
 * Walk a JSONLogic AST and return its maximum nesting depth. Used by
 * the category validator to enforce MAX_CONDITION_DEPTH before the
 * pack is persisted. Pure function; no side effects.
 *
 * Depth counts the AST node nesting (object/array nodes), not raw
 * Object.keys() — a node like `{"and": [...]}` is depth 1 + max
 * depth of its operands.
 */
export function conditionDepth(node: unknown, current = 1): number {
  if (current > MAX_CONDITION_DEPTH + 1) return current; // short-circuit; caller treats overflow as invalid
  if (node === null || typeof node !== 'object') return current;
  if (Array.isArray(node)) {
    let max = current;
    for (const item of node) {
      const d = conditionDepth(item, current + 1);
      if (d > max) max = d;
    }
    return max;
  }
  let max = current;
  for (const value of Object.values(node as Record<string, unknown>)) {
    const d = conditionDepth(value, current + 1);
    if (d > max) max = d;
  }
  return max;
}

/** Exposed for tests + the category's validateRules — every config in a pack must key to one of these. */
export const UAD_COMPLIANCE_RULE_IDS: string[] = RULES.map((r) => r.id);

/**
 * Code-side defaults for the rule catalogue. Returned by the category's
 * `getSeed` so the FE workspace can render "all enabled at default
 * severity" as the starting point when an admin authors their first
 * tenant pack.
 */
export const UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS: UadRuleConfig[] = RULES.map((r) => ({
  id: r.id,
  enabled: true,
}));

/**
 * Code-side rule metadata exposed for the FE workspace (label + default
 * severity + fieldPath). Static; doesn't change per tenant or per pack.
 */
export interface UadComplianceRuleMetadata {
  id: string;
  label: string;
  defaultSeverity: UadComplianceSeverity;
  fieldPath?: string;
}

export const UAD_COMPLIANCE_RULE_METADATA: UadComplianceRuleMetadata[] = RULES.map((r) => {
  const meta: UadComplianceRuleMetadata = {
    id: r.id,
    label: r.label,
    defaultSeverity: r.severity,
  };
  if (r.fieldPath) meta.fieldPath = r.fieldPath;
  return meta;
});
