/**
 * Comp Tiering Configuration
 *
 * Five-tier classification of a comparable property relative to a subject,
 * ported from onelend-backend's `selectComps.js`. Used by the tiered-AI
 * selection strategy to drive its "waterfall" — try tier 1 first, then 2,
 * etc., until enough comps are picked.
 *
 * Tier 1 = best match (very tight thresholds), tier 5 = catch-all.
 *
 * Pure module — no I/O, no logging side effects beyond an explicit warn
 * when distance is null (which signals an upstream data gap).
 */

import { Logger } from '../utils/logger.js';

const logger = new Logger('CompTiering');

/**
 * Threshold row for a single tier. ALL constraints must hold for a candidate
 * to qualify for that tier.
 */
export interface CompTierThresholds {
  /** Maximum distance from subject (miles), inclusive. */
  distanceMi: number;
  /** Maximum days since the comp's last sale, inclusive. */
  daysSinceSale: number;
  /** Maximum |GLA% diff| from subject, inclusive (e.g. 5 = ±5%). */
  glaPct: number;
  /** Maximum |bedroom diff|, inclusive. */
  bedDiff: number;
  /** Maximum |bathroom diff|, inclusive. Tier 1 uses strict `<` (see assignCompTier). */
  bathDiff: number;
}

/**
 * Five-tier matrix — index 0 = tier 1.
 *
 * Tier 5 is a catch-all (no thresholds applied). Values match onelend's
 * `selectComps.js` exactly for v1; tune per market once we have data.
 */
export const COMP_TIER_MATRIX: ReadonlyArray<CompTierThresholds> = [
  { distanceMi: 0.5, daysSinceSale: 90,  glaPct: 5,  bedDiff: 0, bathDiff: 1 },
  { distanceMi: 1,   daysSinceSale: 180, glaPct: 10, bedDiff: 1, bathDiff: 1 },
  { distanceMi: 3,   daysSinceSale: 365, glaPct: 15, bedDiff: 2, bathDiff: 2 },
  { distanceMi: 10,  daysSinceSale: 730, glaPct: 25, bedDiff: 3, bathDiff: 3 },
];

/**
 * Minimal subject view needed for tiering. Anything that exposes these
 * three numbers can be used (PropertyRecord.building satisfies it).
 */
export interface CompTieringSubjectView {
  gla: number;
  bedrooms: number;
  bathrooms: number;
}

/**
 * Minimal candidate view needed for tiering. A `CollectedCompCandidate`'s
 * `propertyRecord.building` plus a sale date satisfies it.
 */
export interface CompTieringCandidateView {
  gla: number;
  bedrooms: number;
  bathrooms: number;
  /** ISO date string of the comp's last sale. Required for tiers 1–4. */
  lastSaleDate: string | null;
}

/**
 * Assign a tier (1–5) for one candidate.
 *
 * Returns:
 *   - 1..4 when the candidate satisfies the corresponding row's thresholds.
 *   - 5 when no row matches (catch-all).
 *   - null ONLY when `distanceMi` is null/undefined — the caller has no
 *     coordinate to score from. Logs a WARN so the data gap is visible.
 *
 * Note on tier 1's bath constraint: onelend uses STRICT `< 1` for tier 1
 * but `<= 1` for tier 2. We preserve both behaviors.
 *
 * Subject GLA must be > 0 — throws otherwise (caller bug, not silent).
 */
export function assignCompTier(
  subject: CompTieringSubjectView,
  candidate: CompTieringCandidateView,
  distanceMi: number | null | undefined,
): number | null {
  if (subject.gla <= 0) {
    throw new Error(
      `assignCompTier: subject.gla must be > 0 (received ${subject.gla})`,
    );
  }

  if (distanceMi == null) {
    logger.warn('assignCompTier: distance is null — returning null tier', {
      candidateGla: candidate.gla,
      candidateBedrooms: candidate.bedrooms,
    });
    return null;
  }

  const diffBed = Math.abs(candidate.bedrooms - subject.bedrooms);
  const diffBath = Math.abs(candidate.bathrooms - subject.bathrooms);
  const diffGlaPct =
    (100 * Math.abs(candidate.gla - subject.gla)) / subject.gla;

  const daysSinceSale =
    candidate.lastSaleDate != null ? daysSince(candidate.lastSaleDate) : Infinity;

  // Tier 1 — strict bath comparison ("< 1" — i.e. exact match on whole baths).
  const t1 = COMP_TIER_MATRIX[0]!;
  if (
    distanceMi <= t1.distanceMi &&
    daysSinceSale <= t1.daysSinceSale &&
    diffGlaPct <= t1.glaPct &&
    diffBed === t1.bedDiff &&
    diffBath < t1.bathDiff
  ) {
    return 1;
  }

  // Tiers 2–4 — inclusive comparisons across the board.
  for (let i = 1; i < COMP_TIER_MATRIX.length; i++) {
    const row = COMP_TIER_MATRIX[i]!;
    if (
      distanceMi <= row.distanceMi &&
      daysSinceSale <= row.daysSinceSale &&
      diffGlaPct <= row.glaPct &&
      diffBed <= row.bedDiff &&
      diffBath <= row.bathDiff
    ) {
      return i + 1;
    }
  }

  return 5;
}

/** Whole-day count from `dateStr` to "now". Returns Infinity for unparseable dates. */
function daysSince(dateStr: string): number {
  const dt = new Date(dateStr).getTime();
  if (Number.isNaN(dt)) return Infinity;
  const diffMs = Date.now() - dt;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
