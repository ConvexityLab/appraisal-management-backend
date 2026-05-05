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
import type { CanonicalReportDocument } from '../types/canonical-schema.js';
import {
    CanonicalAddressZod,
    CanonicalLoanRatiosZod,
    CanonicalLoanZod,
    CanonicalRiskFlagsZod,
} from '../types/canonical-schema.zod.js';

export interface CanonicalIngressIssue {
    /** Dotted path identifying the branch that failed (e.g. "subject.address", "comps[2].address"). */
    branch: string;
    /** The Zod issue path WITHIN the branch (e.g. "zipCode"). */
    path: string;
    code: string;
    message: string;
}

export interface CanonicalIngressValidation {
    /** True iff every checked branch validated cleanly. */
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
}

function issuesFromZod(branch: string, zodIssues: readonly ZodIssue[]): CanonicalIngressIssue[] {
    return zodIssues.map((i) => ({
        branch,
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
    }));
}

export function validateCanonicalIngress(
    fragment: Partial<CanonicalReportDocument> | null | undefined,
): CanonicalIngressValidation {
    const issues: CanonicalIngressIssue[] = [];
    const branchesChecked: CanonicalIngressValidation['branchesChecked'] = {
        subjectAddress: false,
        compAddresses: 0,
        loan: false,
        ratios: false,
        riskFlags: false,
    };

    if (!fragment) {
        return { ok: true, issues, branchesChecked };
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

    return {
        ok: issues.length === 0,
        issues,
        branchesChecked,
    };
}
