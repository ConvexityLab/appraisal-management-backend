import { describe, expect, it } from 'vitest';
import { normalizeAxiomPropertyRequestBody } from '../../src/controllers/axiom-request-normalizer.js';

describe('normalizeAxiomPropertyRequestBody', () => {
  it('returns canonical payload unchanged', () => {
    const normalized = normalizeAxiomPropertyRequestBody({
      orderId: 'ord-1',
      propertyInfo: { propertyAddress: '123 Main St', propertyType: 'SFR' },
    });

    expect(normalized.orderId).toBe('ord-1');
    expect(normalized.propertyInfo).toEqual({ propertyAddress: '123 Main St', propertyType: 'SFR' });
  });

  it('maps legacy flat payload into propertyInfo', () => {
    const normalized = normalizeAxiomPropertyRequestBody({
      orderId: 'ord-2',
      address: '500 Oak Ave',
      propertyType: 'CONDO',
      estimatedValue: 400000,
      loanAmount: 320000,
    });

    expect(normalized.orderId).toBe('ord-2');
    expect(normalized.propertyInfo).toEqual({
      address: '500 Oak Ave',
      propertyType: 'CONDO',
      estimatedValue: 400000,
      loanAmount: 320000,
    });
  });

  it('returns only orderId when no property fields are present', () => {
    const normalized = normalizeAxiomPropertyRequestBody({ orderId: 'ord-3' });

    expect(normalized).toEqual({ orderId: 'ord-3' });
  });

  it('returns empty object for non-object payload', () => {
    expect(normalizeAxiomPropertyRequestBody(undefined)).toEqual({});
    expect(normalizeAxiomPropertyRequestBody(null)).toEqual({});
    expect(normalizeAxiomPropertyRequestBody('bad')).toEqual({});
  });
});
