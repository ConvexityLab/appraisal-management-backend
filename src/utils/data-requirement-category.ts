/**
 * Single source of truth for the keyword-based comp / adjustment / standard
 * categorization of a data requirement path.
 *
 * Used by:
 *   - ReviewRequirementResolutionService when an upstream-supplied category
 *     is absent (legacy compiled programs).
 *   - AxiomService at compiled-criteria ingestion time, to pre-fill
 *     `category` on every dataRequirement that doesn't already have one,
 *     so all downstream consumers (resolver, dispatch payloads, audit
 *     records) see explicit categories instead of having to recompute the
 *     keyword heuristic on every read.
 *
 * Keep this list in sync with whatever the resolver expects. Adding a new
 * comp / adjustment keyword here automatically benefits both paths.
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

interface DataRequirementLike {
  path?: string;
  category?: DataRequirementCategory;
}

interface CriterionLike {
  dataRequirements?: DataRequirementLike[];
}

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

/**
 * Walk every dataRequirement of every criterion and stamp `category` when
 * absent. Existing explicit categories are preserved (the upstream contract
 * is authoritative; we only fill in gaps).
 *
 * Returns a NEW array — does not mutate the input criteria.
 */
export function enrichCriteriaWithCategories<T extends CriterionLike>(criteria: ReadonlyArray<T>): T[] {
  return criteria.map((criterion) => {
    const requirements = criterion.dataRequirements;
    if (!requirements || requirements.length === 0) {
      return criterion;
    }
    return {
      ...criterion,
      dataRequirements: requirements.map((requirement) => {
        if (requirement.category) {
          return requirement;
        }
        return {
          ...requirement,
          category: deriveDataRequirementCategory(requirement.path ?? null),
        };
      }),
    };
  });
}
