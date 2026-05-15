/**
 * Canonical-snapshot ingress validator
 *
 * Runs at canonical-snapshot.service after all mappers have produced their
 * fragments and the merge has produced a candidate `Partial<CanonicalReportDocument>`.
 * Validates the high-leverage branches (address / loan / ratios / riskFlags)
 * and returns a list of structured issues. The snapshot service logs these
 * as warnings and persists anyway — this is observability into mapper drift,
 * not a gate.
 *
 * Why warn-only: the canonical schema is large and evolving; mapper output
 * occasionally drifts (e.g. an Axiom field rename). Hard-rejecting at the
 * snapshot would block all downstream evaluation while we ship a fix. The
 * upstream adapters (slices 2/4/5) already strict-validate at the wire
 * boundary; this layer catches drift introduced by INTERNAL mapper bugs
 * and logs ops-actionable warnings.
 *
 * What's checked:
 *   - subject.address shape (when present)
 *   - comps[*].address shape (when present)
 *   - loan shape (MISMO enums + non-negative amounts)
 *   - ratios shape (finite numbers)
 *   - riskFlags shape (booleans + strings)
 *
 * What's intentionally NOT checked (to keep this slice focused):
 *   - Deep subject improvements / utilities / quality fields
 *   - Comparable adjustments grid
 *   - Reconciliation / valuation deep structure
 */

import type { ZodIssue } from 'zod';
import type { CanonicalReportDocument } from '@l1/shared-types';
import {
    CanonicalAddressZod,
    CanonicalLoanRatiosZod,
    CanonicalLoanZod,
    CanonicalRiskFlagsZod,
} from '../types/canonical-schema.zod.js';
import type { EffectiveReportConfig, JsonLogicRule } from '@l1/shared-types';

export interface CanonicalIngressIssue {
    /** Dotted path identifying the branch that failed (e.g. "subject.address", "comps[2].address"). */
    branch: string;
    /** The Zod issue path WITHIN the branch (e.g. "zipCode"). */
    path: string;
    code: string;
    message: string;
}

/**
 * A required-field-absent flag surfaced when an `EffectiveReportConfig` is
 * passed to `validateCanonicalIngress` and a required field is missing from
 * the provided `fieldData` map.  These are soft-logged risk flags; extraction
 * never fails on them.
 */
export interface ConfigRequiredFieldFlag {
    sectionKey: string;
    fieldKey: string;
    fieldLabel: string;
    /** Human-readable explanation of why the field is required. */
    message: string;
}

export interface CanonicalIngressValidation {
    /** True iff every checked branch validated cleanly AND no config required fields are absent. */
    ok: boolean;
    /** Empty when ok=true. */
    issues: CanonicalIngressIssue[];
    /** Counts of branches that were CHECKED (i.e. present in the input). */
    branchesChecked: {
        subjectAddress: boolean;
        compAddresses: number;
        loan: boolean;
        ratios: boolean;
        riskFlags: boolean;
    };
    /**
     * Required-field-absent flags derived from the `EffectiveReportConfig`.
     * Only populated when `opts.config` + `opts.fieldData` are provided.
     */
    configRiskFlags: ConfigRequiredFieldFlag[];
}

function issuesFromZod(branch: string, zodIssues: readonly ZodIssue[]): CanonicalIngressIssue[] {
    return zodIssues.map((i) => ({
        branch,
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
    }));
}

// ---------------------------------------------------------------------------
// Minimal JSON Logic evaluator (subset: var, comparisons, and/or/!)
// Used for `requiredWhen` rule evaluation in config-driven validation.
// ---------------------------------------------------------------------------

function resolveValue(v: unknown, data: Record<string, unknown>): unknown {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return applyLogic(v as Record<string, unknown>, data);
    }
    return v;
}

function applyLogic(rule: Record<string, unknown>, data: Record<string, unknown>): unknown {
    const entries = Object.entries(rule);
    if (entries.length !== 1) return undefined;
    const [op, rawArgs] = entries[0]!;
    const a: unknown[] = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

    switch (op) {
        case 'var': {
            const key = String(a[0] ?? '');
            const val = data[key];
            return val !== undefined ? val : (a[1] ?? null);
        }
        case '==':  return resolveValue(a[0], data) == resolveValue(a[1], data); // intentional ==
        case '===': return resolveValue(a[0], data) === resolveValue(a[1], data);
        case '!=':  return resolveValue(a[0], data) != resolveValue(a[1], data); // intentional !=
        case '!==': return resolveValue(a[0], data) !== resolveValue(a[1], data);
        case '>':   return Number(resolveValue(a[0], data)) > Number(resolveValue(a[1], data));
        case '>=':  return Number(resolveValue(a[0], data)) >= Number(resolveValue(a[1], data));
        case '<':   return a.length === 3
            ? Number(resolveValue(a[0], data)) < Number(resolveValue(a[1], data)) &&
              Number(resolveValue(a[1], data)) < Number(resolveValue(a[2], data))
            : Number(resolveValue(a[0], data)) < Number(resolveValue(a[1], data));
        case '<=': return Number(resolveValue(a[0], data)) <= Number(resolveValue(a[1], data));
        case '!':  return !resolveValue(a[0], data);
        case '!!': return !!resolveValue(a[0], data);
        case 'and': return a.every(v => applyLogic(v as Record<string, unknown>, data));
        case 'or':  return a.some(v => applyLogic(v as Record<string, unknown>, data));
        default:    return undefined;
    }
}

/** Evaluate a JSON Logic rule against a flat field-value map. */
export function evaluateJsonLogic(rule: JsonLogicRule, data: Record<string, unknown>): boolean {
    return Boolean(applyLogic(rule, data));
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export interface ValidateCanonicalIngressOpts {
    /**
     * When provided, the validator will check that all required fields (where
     * `required=true` or `requiredWhen` evaluates true against `fieldData`) are
     * present in `fieldData`.  Missing fields are reported in `configRiskFlags`.
     */
    config?: EffectiveReportConfig;
    /**
     * Flat map of extracted field key→value.  Required when `config` is set;
     * if absent, config-driven field checks are skipped.
     */
    fieldData?: Record<string, unknown>;
}

export function validateCanonicalIngress(
    fragment: Partial<CanonicalReportDocument> | null | undefined,
    opts?: ValidateCanonicalIngressOpts,
): CanonicalIngressValidation {
    const issues: CanonicalIngressIssue[] = [];
    const configRiskFlags: ConfigRequiredFieldFlag[] = [];
    const branchesChecked: CanonicalIngressValidation['branchesChecked'] = {
        subjectAddress: false,
        compAddresses: 0,
        loan: false,
        ratios: false,
        riskFlags: false,
    };

    if (!fragment) {
        return { ok: true, issues, branchesChecked, configRiskFlags };
    }

    const subject = fragment.subject as { address?: unknown } | undefined;
    if (subject?.address != null) {
        branchesChecked.subjectAddress = true;
        const result = CanonicalAddressZod.safeParse(subject.address);
        if (!result.success) {
            issues.push(...issuesFromZod('subject.address', result.error.issues));
        }
    }

    const comps = fragment.comps;
    if (Array.isArray(comps)) {
        for (let i = 0; i < comps.length; i++) {
            const comp = comps[i] as { address?: unknown } | undefined;
            if (comp?.address != null) {
                branchesChecked.compAddresses++;
                const result = CanonicalAddressZod.safeParse(comp.address);
                if (!result.success) {
                    issues.push(...issuesFromZod(`comps[${i}].address`, result.error.issues));
                }
            }
        }
    }

    if (fragment.loan != null) {
        branchesChecked.loan = true;
        const result = CanonicalLoanZod.safeParse(fragment.loan);
        if (!result.success) {
            issues.push(...issuesFromZod('loan', result.error.issues));
        }
    }

    if (fragment.ratios != null) {
        branchesChecked.ratios = true;
        const result = CanonicalLoanRatiosZod.safeParse(fragment.ratios);
        if (!result.success) {
            issues.push(...issuesFromZod('ratios', result.error.issues));
        }
    }

    if (fragment.riskFlags != null) {
        branchesChecked.riskFlags = true;
        const result = CanonicalRiskFlagsZod.safeParse(fragment.riskFlags);
        if (!result.success) {
            issues.push(...issuesFromZod('riskFlags', result.error.issues));
        }
    }

    // ── Config-driven required-field check (R-22) ─────────────────────────────
    // When an EffectiveReportConfig and fieldData are provided, surface any
    // required fields that are absent as soft-logged ConfigRequiredFieldFlags.
    // Extraction is never blocked by these — they are observability signals only.
    if (opts?.config && opts.fieldData) {
        const fieldData = opts.fieldData;
        for (const section of opts.config.sections) {
            if (!section.visible) continue;
            // Skip sections hidden by visibleWhen JSON Logic (treat fieldData as the context).
            if (section.visibleWhen != null && Object.keys(section.visibleWhen).length > 0) {
                if (!evaluateJsonLogic(section.visibleWhen, fieldData)) continue;
            }
            for (const field of section.fields) {
                if (!field.visible) continue;
                // Skip fields hidden by visibleWhen JSON Logic.
                if (field.visibleWhen != null && Object.keys(field.visibleWhen).length > 0) {
                    if (!evaluateJsonLogic(field.visibleWhen, fieldData)) continue;
                }
                const isRequired = field.required ||
                    (field.requiredWhen != null && evaluateJsonLogic(field.requiredWhen, fieldData));
                if (!isRequired) continue;
                const value = fieldData[field.key];
                const isAbsent = value === undefined || value === null || value === '';
                if (isAbsent) {
                    configRiskFlags.push({
                        sectionKey: section.key,
                        fieldKey: field.key,
                        fieldLabel: field.label,
                        message: `Required field '${field.label}' (${field.key}) is absent in extracted data.`,
                    });
                }
            }
        }
    }

    return {
        ok: issues.length === 0 && configRiskFlags.length === 0,
        issues,
        branchesChecked,
        configRiskFlags,
    };
}
