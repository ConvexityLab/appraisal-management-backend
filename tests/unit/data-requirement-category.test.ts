import { describe, expect, it } from 'vitest';
import {
  deriveDataRequirementCategory,
  enrichCriteriaWithCategories,
} from '../../src/utils/data-requirement-category.js';

describe('deriveDataRequirementCategory', () => {
  it('classifies clearly comp-related paths as comp', () => {
    expect(deriveDataRequirementCategory('comparables.saleDate')).toBe('comp');
    expect(deriveDataRequirementCategory('subjectProperty.salesComparisonApproach.value')).toBe('comp');
    expect(deriveDataRequirementCategory('comp.saleDate')).toBe('comp');
  });

  it('classifies adjustment-keyword paths as adjustment (more specific than comp)', () => {
    expect(deriveDataRequirementCategory('comparables.netAdjustment')).toBe('adjustment');
    expect(deriveDataRequirementCategory('subjectProperty.adjustedSalePrice')).toBe('adjustment');
    expect(deriveDataRequirementCategory('grossAdjustment')).toBe('adjustment');
  });

  it('classifies non-comp / non-adjustment paths as standard', () => {
    expect(deriveDataRequirementCategory('subjectProperty.address')).toBe('standard');
    expect(deriveDataRequirementCategory('order.loanAmount')).toBe('standard');
    expect(deriveDataRequirementCategory('borrowerName')).toBe('standard');
  });

  it('returns standard for null / undefined / empty input', () => {
    expect(deriveDataRequirementCategory(null)).toBe('standard');
    expect(deriveDataRequirementCategory(undefined)).toBe('standard');
    expect(deriveDataRequirementCategory('')).toBe('standard');
    expect(deriveDataRequirementCategory('   ')).toBe('standard');
  });
});

describe('enrichCriteriaWithCategories', () => {
  it('fills in category on every dataRequirement that does not already have one', () => {
    const criteria = [
      {
        id: 'c1',
        dataRequirements: [
          { path: 'comparables.foo', required: true },
          { path: 'subjectProperty.adjustedSalePrice', required: true },
          { path: 'subjectProperty.address', required: false },
        ],
      },
    ];

    const enriched = enrichCriteriaWithCategories(criteria);
    expect(enriched[0].dataRequirements).toEqual([
      { path: 'comparables.foo', required: true, category: 'comp' },
      { path: 'subjectProperty.adjustedSalePrice', required: true, category: 'adjustment' },
      { path: 'subjectProperty.address', required: false, category: 'standard' },
    ]);
  });

  it('preserves an explicit upstream category and does not overwrite it', () => {
    const criteria = [
      {
        id: 'c1',
        dataRequirements: [
          // Path looks comp-y but upstream marked it standard explicitly.
          { path: 'comparables.specialCase', required: true, category: 'standard' as const },
        ],
      },
    ];

    const enriched = enrichCriteriaWithCategories(criteria);
    expect(enriched[0].dataRequirements?.[0]?.category).toBe('standard');
  });

  it('does not mutate the input criteria or their dataRequirements', () => {
    const criteria = [
      {
        id: 'c1',
        dataRequirements: [{ path: 'comparables.foo', required: true }],
      },
    ];
    const beforeJson = JSON.stringify(criteria);

    enrichCriteriaWithCategories(criteria);

    expect(JSON.stringify(criteria)).toBe(beforeJson);
    expect(criteria[0].dataRequirements?.[0]).not.toHaveProperty('category');
  });

  it('skips criteria with no dataRequirements without crashing', () => {
    const criteria = [
      { id: 'c-empty' },
      { id: 'c-null', dataRequirements: undefined },
      { id: 'c-zero', dataRequirements: [] },
    ];
    const enriched = enrichCriteriaWithCategories(criteria);
    expect(enriched).toHaveLength(3);
    expect(enriched[2].dataRequirements).toEqual([]);
  });
});
