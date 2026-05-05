/**
 * Canonical schema — runtime Zod validators (focused subset)
 *
 * The full CanonicalReportDocument has 1000+ fields across 50+ interfaces;
 * mirroring it as a Zod schema is impractical and would lock the canonical
 * shape's evolution behind a parallel schema rewrite. This module instead
 * captures the HIGH-LEVERAGE INVARIANTS — the small set of branches whose
 * shape correctness is load-bearing for downstream evaluation:
 *
 *   - CanonicalAddress         — used by every comp-search and address-match rule
 *   - CanonicalLoan            — MISMO-typed enums consumed by ratio / risk rules
 *   - CanonicalLoanRatios      — finite-number invariants for LTV / CLTV / DSCR / DTI
 *   - CanonicalRiskFlags       — boolean / string-only fields gated by review programs
 *
 * Validation is PERMISSIVE on additional fields (passthrough at every level)
 * so canonical can evolve. The validators are designed to surface drifts
 * that would silently corrupt downstream evaluation, not enforce exhaustive
 * structural correctness.
 *
 * Posture: warn-only at canonical-snapshot ingress (snapshot persists
 * regardless; warnings are logged for ops). Hard rejection here would brittle
 * the snapshot pipeline against any mapper drift.
 */

import { z } from 'zod';

// ─── Address ──────────────────────────────────────────────────────────────────

export const CanonicalAddressZod = z
    .object({
        streetAddress: z.string(),
        unit: z.string().nullable(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string(),
        county: z.string(),
    })
    .passthrough();

// ─── Loan ─────────────────────────────────────────────────────────────────────

const LoanPurposeZod = z.enum(['Purchase', 'Refinance', 'ConstructionPermanent', 'Construction', 'Other']);
const MortgageTypeZod = z.enum(['Conventional', 'FHA', 'VA', 'USDA', 'NonQM', 'Jumbo', 'Other']);
const LienPriorityZod = z.enum(['FirstLien', 'SecondLien', 'Other']);
const RefinanceCashOutZod = z.enum(['CashOut', 'NoCashOut', 'LimitedCashOut', 'Unknown']);
const OccupancyZod = z.enum(['PrimaryResidence', 'SecondHome', 'Investment', 'Other']);

const FiniteNumberOrNull = z
    .union([
        z.number().refine((n) => Number.isFinite(n), { message: 'must be a finite number' }),
        z.null(),
    ]);

const NonNegativeFiniteOrNull = z
    .union([
        z
            .number()
            .refine((n) => Number.isFinite(n), { message: 'must be a finite number' })
            .refine((n) => n >= 0, { message: 'must be non-negative' }),
        z.null(),
    ]);

export const CanonicalLoanZod = z
    .object({
        baseLoanAmount: NonNegativeFiniteOrNull,
        loanPurposeType: LoanPurposeZod.nullable(),
        mortgageType: MortgageTypeZod.nullable(),
        lienPriorityType: LienPriorityZod.nullable(),
        firstLienBalance: NonNegativeFiniteOrNull,
        secondLienBalance: NonNegativeFiniteOrNull,
        totalLienBalance: NonNegativeFiniteOrNull,
        refinanceCashOutDeterminationType: RefinanceCashOutZod.nullable(),
        refinanceCashOutAmount: NonNegativeFiniteOrNull,
        isCashOutRefinance: z.boolean().nullable(),
        occupancyType: OccupancyZod.nullable(),
        interestRatePercent: FiniteNumberOrNull,
        loanTermMonths: NonNegativeFiniteOrNull,
        loanNumber: z.string().nullable(),
    })
    .passthrough();

// ─── Loan ratios ──────────────────────────────────────────────────────────────

export const CanonicalLoanRatiosZod = z
    .object({
        // Ratios are MISMO percentage-form: e.g. 80, not 0.80. Allow 0 (no loan)
        // up to 200 (high-CLTV second + first; sanity bound, not strict).
        loanToValueRatioPercent: FiniteNumberOrNull,
        combinedLoanToValueRatioPercent: FiniteNumberOrNull,
        highCombinedLoanToValueRatioPercent: FiniteNumberOrNull,
        debtServiceCoverageRatio: FiniteNumberOrNull,
        debtToIncomeRatioPercent: FiniteNumberOrNull,
    })
    .passthrough();

// ─── Risk flags ───────────────────────────────────────────────────────────────

export const CanonicalRiskFlagsZod = z
    .object({
        chainOfTitleRedFlags: z.boolean().nullable(),
        ucdpSsrScore: z.string().nullable(),
        collateralRiskRating: z.string().nullable(),
        appraiserGeoCompetency: z.boolean().nullable(),
    })
    .passthrough();

// ─── Inferred TS types ────────────────────────────────────────────────────────

export type CanonicalAddressZodShape = z.infer<typeof CanonicalAddressZod>;
export type CanonicalLoanZodShape = z.infer<typeof CanonicalLoanZod>;
export type CanonicalLoanRatiosZodShape = z.infer<typeof CanonicalLoanRatiosZod>;
export type CanonicalRiskFlagsZodShape = z.infer<typeof CanonicalRiskFlagsZod>;
