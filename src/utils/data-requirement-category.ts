/**
 * Single source of truth for the keyword-based comp / adjustment / standard
 * categorization of a data requirement path.
 *
 * The compiled-criteria wire contract (CompiledCriteriaResponse) is
 * engine-agnostic and does not carry per-data-path semantic categorization,
 * so the review-requirement resolver computes this classification from the
 * path itself at lookup time. Adding a new comp / adjustment keyword here
 * automatically benefits the resolver.
 */

export const COMP_PATH_KEYWORDS = [
  'comparables',
  'comparable',
  'comp',
  'comps',
  'salescomparisonapproach',
] as const;

export const ADJUSTMENT_PATH_KEYWORDS = [
  'adjustment',
  'adjustments',
  'adjustedsaleprice',
  'grossadjustment',
  'netadjustment',
] as const;

export type DataRequirementCategory = 'comp' | 'adjustment' | 'standard';

function normalizePath(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\[(\d+)\]/g, '')
    .replace(/[^a-z0-9.]+/g, '');
}

function pathContainsKeyword(normalizedPath: string, keyword: string): boolean {
  if (normalizedPath.length === 0 || keyword.length === 0) {
    return false;
  }
  return (
    normalizedPath === keyword
    || normalizedPath.includes(`${keyword}.`)
    || normalizedPath.includes(`.${keyword}`)
    || normalizedPath.includes(keyword)
  );
}

/**
 * Heuristic categorization for a single data requirement path. Adjustment
 * keywords are checked first because they're a strict subset of the comp
 * domain — every "adjustment" path is comp-adjacent, but the reverse is not
 * true and we want the more specific tag to win.
 */
export function deriveDataRequirementCategory(path: string | undefined | null): DataRequirementCategory {
  if (typeof path !== 'string') {
    return 'standard';
  }
  const normalized = normalizePath(path);
  if (normalized.length === 0) {
    return 'standard';
  }

  for (const keyword of ADJUSTMENT_PATH_KEYWORDS) {
    if (pathContainsKeyword(normalized, keyword)) {
      return 'adjustment';
    }
  }
  for (const keyword of COMP_PATH_KEYWORDS) {
    if (pathContainsKeyword(normalized, keyword)) {
      return 'comp';
    }
  }
  return 'standard';
}
