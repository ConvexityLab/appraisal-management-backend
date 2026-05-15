/**
 * UAD-3.6 Compliance Evaluator
 *
 * Runs a per-rule compliance check over the latest canonical extraction
 * snapshot for an order and emits a 0-100 score plus a list of blockers
 * the QC reviewer should resolve before signing off.
 *
 * Scope (MVP): the most load-bearing required fields per Fannie Mae UAD
 * 3.6 / URAR v1.3 — subject identification, key property characteristics,
 * the sales-comparison grid backbone, and the value reconciliation.
 *
 * Why hard-coded rules instead of a Decision Engine pack: the rule set is
 * tight (~15 rules), each rule references canonical-schema fields by
 * name (compile-time-checked), and the catalogue isn't supposed to
 * differ per tenant the way matching criteria do. When admin authoring
 * is genuinely needed we'll lift this into a Decision Engine category
 * — the rule shape (id, severity, predicate, message) is already
 * Decision-Engine-shaped to make that migration straightforward.
 *
 * Why "stateless compute" instead of persisting: the canonical snapshot
 * already lives in Cosmos. Re-evaluating on demand keeps the verdict in
 * sync with the latest extraction without a third copy of the same data.
 */

import type { CanonicalReportDocument } from '@l1/shared-types';

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
 * Per-rule pack configuration. Admins author one of these per built-in
 * rule via the Decision Engine workspace; the evaluator layers the
 * config on top of the code-side defaults at compute time.
 *
 * Why config-only and not full JSONLogic predicates: the predicates
 * are typed against CanonicalReportDocument, so field-name typos get
 * caught at compile time. UAD 3.6 is a federal spec — "new rules" are
 * rare. Admins overwhelmingly need to turn rules off (per-client
 * carve-outs), re-weight (push a critical-to-this-tenant rule higher),
 * or rewrite the remediation message in the tenant's vocabulary.
 *
 * Unknown rule ids are filtered out by the category's validateRules
 * before the pack is persisted — so the resolver here can assume every
 * config keys to a real rule.
 */
export interface UadRuleConfig {
  id: string;
  /** When false the rule is skipped entirely (not present in output). */
  enabled: boolean;
  /** Override the code-side default severity (e.g., bump APN to HIGH per-client). */
  severityOverride?: UadComplianceSeverity;
  /** Custom remediation message shown to the reviewer when the rule fails. */
  messageOverride?: string;
}

/**
 * Resolved rule configs map — produced by the per-tenant overlay
 * resolver and handed to evaluate(). One entry per rule id. Absent
 * entries fall back to the code-side defaults (enabled=true, severity
 * as declared above, no message override).
 */
export type UadRuleConfigMap = Record<string, UadRuleConfig>;

export class UadComplianceEvaluatorService {
  /**
   * Evaluate a canonical report against the rule set. Pure function:
   * same (doc, config) inputs always produce the same verdict.
   *
   * Returns an empty/zero report with snapshotAvailable=false when the
   * caller passes null — lets the controller distinguish "extraction
   * pending" from "extraction done, fails everything" cleanly.
   *
   * The optional `configMap` is the resolved overlay (BASE → CLIENT)
   * from the Decision Engine pack. Rules with `enabled: false` are
   * dropped entirely; severityOverride bumps a rule between
   * CRITICAL/HIGH/MEDIUM (affecting score weight + blocker
   * classification); messageOverride replaces the code-default
   * remediation text on failure. Absent configs fall back to the
   * code-side defaults so callers without a pack still get the MVP
   * behaviour.
   */
  evaluate(
    orderId: string,
    doc: CanonicalReportDocument | null,
    configMap?: UadRuleConfigMap,
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
