/**
 * Unit tests for AppraisalDraftService.validateSection  (R-22b)
 *
 * `validateSection` load the order → gets EffectiveReportConfig → evaluates
 * required/requiredWhen for the requested section → returns DraftValidationError[].
 *
 * We stub the CosmosDbService container queries and ReportConfigMergerService
 * to keep tests fast and hermetic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppraisalDraftService } from '../../src/services/appraisal-draft.service.js';
import type { EffectiveReportConfig } from '../../src/types/report-config.types.js';
import { VENDOR_ORDER_TYPE_PREDICATE } from '../../src/types/vendor-order.types.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const FAKE_ORDER = {
  id: 'order-1',
  type: 'vendor-order',
  clientId: 'client-a',
  productType: 'URAR_1073',
};

function makeConfig(fields: Partial<EffectiveReportConfig['sections'][0]['fields'][0]>[]): EffectiveReportConfig {
  return {
    orderId: 'order-1', productId: 'URAR_1073', clientId: 'client-a',
    schemaVersion: '1.0.0', mergedAt: new Date().toISOString(), templateBlocks: {},
    sections: [{
      key: 'subject_property', label: 'Subject', order: 1,
      required: true, visible: true, templateBlockKey: 'tmpl',
      fields: fields.map((f, i) => ({
        key: `field_${i}`, label: `Field ${i}`, type: 'text' as const,
        required: false, visible: true, order: i + 1,
        ...f,
      })),
    }],
  };
}

// Build a minimal CosmosDbService stub that returns FAKE_ORDER for order queries.
function makeDbStub() {
  return {
    getContainer: vi.fn(() => ({
      items: {
        query: vi.fn(() => ({
          fetchAll: vi.fn(async () => ({ resources: [FAKE_ORDER] })),
        })),
      },
    })),
    getDocument: vi.fn(async () => null),
    queryDocuments: vi.fn(async () => []),
    upsertDocument: vi.fn(async (c: string, d: unknown) => d),
    initialize: vi.fn(),
  };
}

function makeMergerStub(config: EffectiveReportConfig) {
  return {
    getEffectiveConfig: vi.fn(async () => config),
    invalidateCache: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppraisalDraftService.validateSection (R-22b)', () => {
  it('returns empty array when section is not in config', async () => {
    const config = makeConfig([]);
    const svc = new AppraisalDraftService(
      makeDbStub() as any,
      makeMergerStub(config) as any,
    );
    const errors = await svc.validateSection('order-1', 'nonexistent_section', {});
    expect(errors).toHaveLength(0);
  });

  it('returns empty array when all required fields are present', async () => {
    const config = makeConfig([
      { key: 'address', required: true },
      { key: 'city', required: true },
    ]);
    const svc = new AppraisalDraftService(
      makeDbStub() as any,
      makeMergerStub(config) as any,
    );
    const errors = await svc.validateSection(
      'order-1',
      'subject_property',
      { address: '123 Main St', city: 'Atlanta' },
    );
    expect(errors).toHaveLength(0);
  });

  it('flags absent required fields', async () => {
    const config = makeConfig([
      { key: 'address', label: 'Street Address', required: true },
      { key: 'city',    label: 'City',           required: true },
      { key: 'state',   label: 'State',          required: false },
    ]);
    const svc = new AppraisalDraftService(
      makeDbStub() as any,
      makeMergerStub(config) as any,
    );
    const errors = await svc.validateSection(
      'order-1',
      'subject_property',
      { address: '123 Main St' }, // city absent, state not required
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fieldPath).toBe('city');
    expect(errors[0]!.severity).toBe('error');
    expect(errors[0]!.sectionId).toBe('subject_property');
  });

  it('evaluates requiredWhen JSON Logic against submitted data', async () => {
    const config = makeConfig([
      {
        key: 'hoa_fee',
        label: 'HOA Monthly Fee',
        required: false,
        requiredWhen: { '==': [{ var: 'has_hoa' }, true] },
      },
    ]);
    const svc = new AppraisalDraftService(
      makeDbStub() as any,
      makeMergerStub(config) as any,
    );

    // has_hoa true → hoa_fee required → absent → error
    const withHoa = await svc.validateSection(
      'order-1', 'subject_property', { has_hoa: true },
    );
    expect(withHoa).toHaveLength(1);
    expect(withHoa[0]!.fieldPath).toBe('hoa_fee');

    // has_hoa false → hoa_fee not required → no error
    const withoutHoa = await svc.validateSection(
      'order-1', 'subject_property', { has_hoa: false },
    );
    expect(withoutHoa).toHaveLength(0);
  });

  it('returns empty array gracefully when config load fails', async () => {
    const mergerStub = {
      getEffectiveConfig: vi.fn(async () => { throw new Error('Cosmos unavailable'); }),
      invalidateCache: vi.fn(),
    };
    const svc = new AppraisalDraftService(
      makeDbStub() as any,
      mergerStub as any,
    );
    const errors = await svc.validateSection('order-1', 'subject_property', {});
    expect(errors).toHaveLength(0);
  });

  it('skips invisible fields even if required', async () => {
    const config = makeConfig([
      { key: 'hidden_field', label: 'Hidden', required: true, visible: false },
    ]);
    const svc = new AppraisalDraftService(
      makeDbStub() as any,
      makeMergerStub(config) as any,
    );
    const errors = await svc.validateSection('order-1', 'subject_property', {});
    expect(errors).toHaveLength(0);
  });
});

// Keep the import to avoid unused-variable lint error on VENDOR_ORDER_TYPE_PREDICATE
void VENDOR_ORDER_TYPE_PREDICATE;
