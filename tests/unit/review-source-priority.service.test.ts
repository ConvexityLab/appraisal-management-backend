import { describe, expect, it } from 'vitest';
import { ReviewSourcePriorityService } from '../../src/services/review-source-priority.service.js';
import type { ReviewContext } from '../../src/types/review-context.types.js';

interface SnapshotPaths {
  subjectProperty?: string[];
  extraction?: string[];
  providerData?: string[];
  provenance?: string[];
}

function buildContext(snapshotPaths: SnapshotPaths = {}, order: Record<string, unknown> = {}): ReviewContext {
  return {
    identity: { orderId: 'order-1', tenantId: 'tenant-1' },
    order: { id: 'order-1', ...order } as any,
    reviewPrograms: [],
    documents: [],
    latestSnapshot: {
      id: 'snap-1',
      createdAt: '2026-04-29T00:00:00.000Z',
      hasNormalizedData: true,
      availableDataPaths: [],
      availableDataPathsBySource: {
        subjectProperty: snapshotPaths.subjectProperty ?? [],
        extraction: snapshotPaths.extraction ?? [],
        providerData: snapshotPaths.providerData ?? [],
        provenance: snapshotPaths.provenance ?? [],
      },
    },
    runs: [],
    runSummary: { totalRuns: 0, extractionRuns: 0, criteriaRuns: 0 },
    evidenceRefs: [],
    warnings: [],
    assembledAt: '2026-04-29T00:00:00.000Z',
    assembledBy: 'user-1',
    contextVersion: 'review-context:order-1:1',
  };
}

describe('ReviewSourcePriorityService.resolveRequirementPath', () => {
  const service = new ReviewSourcePriorityService();

  it('returns a single binding without competingMatches when only one source has the path', () => {
    const ctx = buildContext({ extraction: ['extraction.propertyAddress'] });

    const result = service.resolveRequirementPath(ctx, 'propertyAddress');

    expect(result).toEqual({
      requirementPath: 'propertyAddress',
      resolvedPath: 'extraction.propertyAddress',
      sourceType: 'extraction',
    });
    expect(result).not.toHaveProperty('competingMatches');
  });

  it('returns highest-priority source as primary and lists lower-priority sources in competingMatches in priority order', () => {
    const ctx = buildContext({
      subjectProperty: ['subjectProperty.propertyAddress'],
      extraction: ['extraction.propertyAddress'],
      providerData: ['providerData.propertyAddress'],
    });

    const result = service.resolveRequirementPath(ctx, 'propertyAddress');

    expect(result).toMatchObject({
      requirementPath: 'propertyAddress',
      resolvedPath: 'subjectProperty.propertyAddress',
      sourceType: 'subjectProperty',
      competingMatches: [
        { sourceType: 'extraction', resolvedPath: 'extraction.propertyAddress' },
        { sourceType: 'providerData', resolvedPath: 'providerData.propertyAddress' },
      ],
    });
  });

  it('does not include the chosen source in its own competingMatches', () => {
    const ctx = buildContext({
      subjectProperty: ['subjectProperty.occupancyType'],
      extraction: ['extraction.occupancyType'],
    });

    const result = service.resolveRequirementPath(ctx, 'occupancyType');

    expect(result?.sourceType).toBe('subjectProperty');
    expect(result?.competingMatches?.every((match) => match.sourceType !== 'subjectProperty')).toBe(true);
  });

  it('detects ambiguity through path aliases', () => {
    const ctx = buildContext({
      subjectProperty: ['subjectProperty.propertyAddress'],
      extraction: ['extraction.propertyAddress'],
    });

    const result = service.resolveRequirementPath(ctx, 'subject.address');

    expect(result?.sourceType).toBe('subjectProperty');
    expect(result?.competingMatches).toEqual([
      { sourceType: 'extraction', resolvedPath: 'extraction.propertyAddress' },
    ]);
  });

  it('surfaces competingMatches across snapshot and order sources', () => {
    const ctx = buildContext(
      { extraction: ['extraction.loanAmount'] },
      { loanAmount: 250000 },
    );

    const result = service.resolveRequirementPath(ctx, 'loanAmount');

    expect(result?.sourceType).toBe('extraction');
    expect(result?.competingMatches).toEqual([
      { sourceType: 'order', resolvedPath: 'order.loanAmount' },
    ]);
  });

  it('returns null when no source has the path', () => {
    const ctx = buildContext();

    expect(service.resolveRequirementPath(ctx, 'somethingMissing')).toBeNull();
  });

  it('does not duplicate competing matches when multiple aliases map to the same source path', () => {
    const ctx = buildContext({
      subjectProperty: ['subjectProperty.propertyAddress'],
      extraction: ['extraction.propertyAddress'],
    });

    const result = service.resolveRequirementPath(ctx, 'property.address');

    expect(result?.competingMatches).toHaveLength(1);
    expect(result?.competingMatches?.[0]).toEqual({
      sourceType: 'extraction',
      resolvedPath: 'extraction.propertyAddress',
    });
  });
});
