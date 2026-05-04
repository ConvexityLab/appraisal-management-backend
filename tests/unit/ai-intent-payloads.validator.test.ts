import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  safeValidateAiIntentPayload,
  validateAiIntentPayload,
} from '../../src/validators/ai-intent-payloads.validator.js';

describe('ai-intent-payloads.validator', () => {
  it('accepts a fully shaped CREATE_ORDER payload', () => {
    const parsed = validateAiIntentPayload('CREATE_ORDER', {
      clientId: 'client-1',
      orderNumber: 'ORD-123',
      propertyAddress: {
        streetAddress: '123 Main St',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75001',
        county: 'Dallas',
      },
      propertyDetails: {
        propertyType: 'single_family_residential',
        occupancy: 'owner_occupied',
        features: ['garage'],
      },
      orderType: 'FULL_APPRAISAL',
      productType: 'FULL_APPRAISAL',
      dueDate: '2030-01-01T00:00:00.000Z',
      rushOrder: false,
      borrowerInformation: {
        firstName: 'Jane',
        lastName: 'Doe',
      },
      loanInformation: {
        loanAmount: 450000,
        loanType: 'conventional',
        loanPurpose: 'purchase',
      },
      contactInformation: {
        name: 'Jane Doe',
        role: 'borrower',
        preferredMethod: 'email',
      },
      priority: 'normal',
      tags: [],
      metadata: {},
    });

    expect(parsed.orderNumber).toBe('ORD-123');
  });

  it('rejects CREATE_ORDER when required fields are missing', () => {
    expect(() => validateAiIntentPayload('CREATE_ORDER', {
      clientId: 'client-1',
      propertyAddress: {
        city: 'Dallas',
        state: 'TX',
      },
    })).toThrow(ZodError);
  });

  it('accepts ASSIGN_VENDOR with a single orderId and appraiserId alias', () => {
    const parsed = validateAiIntentPayload('ASSIGN_VENDOR', {
      orderId: 'order-1',
      appraiserId: 'vendor-1',
    });

    expect(parsed.orderId).toBe('order-1');
    expect(parsed.appraiserId).toBe('vendor-1');
  });

  it('returns detailed validation issues for invalid ASSIGN_VENDOR payloads', () => {
    const parsed = safeValidateAiIntentPayload('ASSIGN_VENDOR', {});

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          'ASSIGN_VENDOR requires orderId or orderIds.',
          'ASSIGN_VENDOR requires vendorId or appraiserId.',
        ]),
      );
    }
  });
});