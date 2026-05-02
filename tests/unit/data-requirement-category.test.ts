import { describe, expect, it } from 'vitest';
import { deriveDataRequirementCategory } from '../../src/utils/data-requirement-category.js';

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

