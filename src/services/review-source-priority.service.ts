import type { ReviewContext } from '../types/review-context.types.js';

type ReviewSourceType = 'canonical' | 'order' | 'subjectProperty' | 'extraction' | 'providerData' | 'provenance';

export interface CompetingDataBindingMatch {
  resolvedPath: string;
  sourceType: ReviewSourceType;
}

export interface ResolvedDataBinding {
  requirementPath: string;
  resolvedPath: string;
  sourceType: ReviewSourceType;
  competingMatches?: CompetingDataBindingMatch[];
}

// `canonical` is the AMP canonical-schema (UAD 3.6 / URAR / MISMO 3.4 aligned)
// projection of extraction data. It is the authoritative shape for review-program
// criteria; everything else is fallback for legacy or partial data.
const SOURCE_PRIORITY: ReadonlyArray<ReviewSourceType> = [
  'canonical',
  'subjectProperty',
  'extraction',
  'providerData',
  'order',
  'provenance',
];

const PATH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  propertyaddress: ['propertyAddress', 'subjectProperty.propertyAddress', 'extraction.propertyAddress', 'order.propertyAddress'],
  'property.address': ['propertyAddress', 'subjectProperty.propertyAddress', 'extraction.propertyAddress', 'order.propertyAddress'],
  'subject.address': ['propertyAddress', 'subjectProperty.propertyAddress', 'extraction.propertyAddress', 'order.propertyAddress'],
  occupancytype: ['occupancyType', 'subjectProperty.occupancyType', 'extraction.occupancyType', 'providerData.occupancyType', 'order.occupancyType'],
  loanamount: ['loanAmount', 'order.loanAmount', 'extraction.loanAmount', 'subjectProperty.loanAmount'],
  'comparables.saledate': ['comparables.saleDate', 'extraction.comparables.saleDate', 'subjectProperty.comparables.saleDate'],
  'comparables.date': ['comparables.saleDate', 'extraction.comparables.saleDate', 'subjectProperty.comparables.saleDate'],
  appraisedvalue: ['appraisedValue', 'subjectProperty.appraisedValue', 'extraction.appraisedValue', 'order.appraisedValue'],
  propertytype: ['propertyType', 'subjectProperty.propertyType', 'extraction.propertyType', 'providerData.propertyType', 'order.propertyType'],
};

export class ReviewSourcePriorityService {
  resolveRequirementPath(context: ReviewContext, requirementPath: string): ResolvedDataBinding | null {
    const availablePaths = this.getAvailablePathLookup(context);
    const candidatePaths = this.buildCandidatePaths(requirementPath);

    const scopedMatches = this.collectMatches(availablePaths, (sourcePaths) => {
      for (const candidatePath of candidatePaths) {
        const normalizedCandidate = this.normalizePath(candidatePath);
        const matchedPath = sourcePaths.get(normalizedCandidate);
        if (matchedPath) {
          return matchedPath;
        }
      }
      return null;
    });
    if (scopedMatches.length > 0) {
      return this.buildResolvedBinding(requirementPath, scopedMatches);
    }

    const unscopedCandidates = candidatePaths
      .map((path) => this.normalizePath(path).replace(/^(canonical|subjectproperty|extraction|providerdata|order|provenance)\./, ''));
    const unscopedMatches = this.collectMatches(availablePaths, (sourcePaths) => {
      for (const normalizedCandidate of unscopedCandidates) {
        for (const [normalizedAvailable, actualPath] of sourcePaths.entries()) {
          if (normalizedAvailable.replace(/^(canonical|subjectproperty|extraction|providerdata|order|provenance)\./, '') === normalizedCandidate) {
            return actualPath;
          }
        }
      }
      return null;
    });
    if (unscopedMatches.length > 0) {
      return this.buildResolvedBinding(requirementPath, unscopedMatches);
    }

    return null;
  }

  private collectMatches(
    availablePaths: Record<ReviewSourceType, Map<string, string>>,
    findInSource: (sourcePaths: Map<string, string>) => string | null,
  ): Array<{ sourceType: ReviewSourceType; resolvedPath: string }> {
    const matches: Array<{ sourceType: ReviewSourceType; resolvedPath: string }> = [];
    for (const sourceType of SOURCE_PRIORITY) {
      const matchedPath = findInSource(availablePaths[sourceType]);
      if (matchedPath) {
        matches.push({ sourceType, resolvedPath: matchedPath });
      }
    }
    return matches;
  }

  private buildResolvedBinding(
    requirementPath: string,
    matches: Array<{ sourceType: ReviewSourceType; resolvedPath: string }>,
  ): ResolvedDataBinding {
    const [primary, ...competing] = matches;
    if (!primary) {
      throw new Error('buildResolvedBinding requires at least one match');
    }

    return {
      requirementPath,
      resolvedPath: primary.resolvedPath,
      sourceType: primary.sourceType,
      ...(competing.length > 0 ? { competingMatches: competing } : {}),
    };
  }

  private buildCandidatePaths(requirementPath: string): string[] {
    const normalizedRequirement = this.normalizePath(requirementPath);
    const aliases = PATH_ALIASES[normalizedRequirement] ?? [requirementPath];
    const candidates = new Set<string>();

    for (const alias of aliases) {
      candidates.add(alias);
      for (const sourceType of SOURCE_PRIORITY) {
        if (alias.includes('.')) {
          candidates.add(alias);
        } else {
          candidates.add(`${sourceType}.${alias}`);
        }
      }
    }

    return [...candidates];
  }

  private getAvailablePathLookup(context: ReviewContext): Record<ReviewSourceType, Map<string, string>> {
    const snapshotPaths = context.latestSnapshot?.availableDataPathsBySource;
    return {
      canonical: this.buildLookup(snapshotPaths?.canonical ?? []),
      subjectProperty: this.buildLookup(snapshotPaths?.subjectProperty ?? []),
      extraction: this.buildLookup(snapshotPaths?.extraction ?? []),
      providerData: this.buildLookup(snapshotPaths?.providerData ?? []),
      provenance: this.buildLookup(snapshotPaths?.provenance ?? []),
      order: this.buildLookup(this.collectOrderPaths(context.order)),
    };
  }

  private buildLookup(paths: string[]): Map<string, string> {
    const lookup = new Map<string, string>();
    for (const path of paths) {
      lookup.set(this.normalizePath(path), path);
    }
    return lookup;
  }

  private collectOrderPaths(value: unknown, prefix = 'order', result = new Set<string>()): string[] {
    if (value === null || value === undefined) {
      return [...result];
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectOrderPaths(item, prefix, result);
      }
      return [...result];
    }

    if (typeof value !== 'object') {
      result.add(prefix);
      return [...result];
    }

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      result.add(nextPrefix);
      this.collectOrderPaths(child, nextPrefix, result);
    }

    return [...result];
  }

  private normalizePath(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\[(\d+)\]/g, '')
      .replace(/[^a-z0-9.]+/g, '');
  }
}
