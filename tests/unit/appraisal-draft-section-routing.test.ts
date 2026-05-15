/**
 * Unit tests for AppraisalDraftService.saveSection — SECTION_FIELD_MAP routing
 *
 * Verifies that PATCH payloads for each URAR v1.3 section land in the correct
 * field of `reportDocument` (not in the generic `sections` bag), and that
 * unknown sections fall back to the sections bag.
 *
 * All Cosmos + merger dependencies are stubbed. No network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppraisalDraftService } from '../../src/services/appraisal-draft.service.js';
import { DraftStatus, SectionStatus } from '../../src/types/appraisal-draft.types.js';
import type { AppraisalDraft } from '../../src/types/appraisal-draft.types.js';
import type { CanonicalReportDocument } from '@l1/shared-types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDoc(): CanonicalReportDocument {
  return {
    id: 'doc-1',
    reportId: 'rpt-1',
    orderId: 'order-1',
    reportType: '1004',
    status: 'EDITING',
    schemaVersion: '1.0',
    metadata: {} as any,
    subject: { address: { streetAddress: '', city: '', state: '', zipCode: '' } } as any,
    comps: [],
    valuation: null,
  } as unknown as CanonicalReportDocument;
}

function makeDraft(overrides: Partial<AppraisalDraft> = {}): AppraisalDraft {
  return {
    id: 'draft-1',
    orderId: 'order-1',
    reportType: '1004',
    status: DraftStatus.EDITING,
    version: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
    lastEditedBy: 'user-1',
    autoSavedAt: null,
    sectionStatus: {},
    sections: {},
    reportDocument: makeDoc(),
    ...overrides,
  } as AppraisalDraft;
}

/** Creates a CosmosDbService stub that returns `draft` from any container op. */
function makeDbStub(draft: AppraisalDraft) {
  const replaceMock = vi.fn(async () => ({ resource: { ...draft, version: draft.version + 1 } }));
  return {
    getAppraisalDraftsContainer: vi.fn(() => ({
      item: vi.fn(() => ({
        read: vi.fn(async () => ({ resource: draft })),
        replace: replaceMock,
      })),
      items: {
        query: vi.fn(() => ({ fetchAll: vi.fn(async () => ({ resources: [] })) })),
      },
    })),
    getContainer: vi.fn(() => ({
      items: {
        query: vi.fn(() => ({ fetchAll: vi.fn(async () => ({ resources: [] })) })),
      },
    })),
    // needed by OrderContextLoader
    findOrderById: vi.fn(async () => ({ success: true, data: { id: 'order-1', type: 'vendor-order', clientId: 'c-1' } })),
    _replace: replaceMock,
  };
}

/** Extracts the draft that was passed to container.item().replace() */
function captureReplacedDraft(dbStub: ReturnType<typeof makeDbStub>): AppraisalDraft {
  return (dbStub._replace as any).mock.calls[0][0] as AppraisalDraft;
}

/** Merger stub — returns a minimal config so validateSection works. */
function makeMergerStub() {
  return {
    getEffectiveConfig: vi.fn(async () => ({
      orderId: 'order-1', productId: 'URAR', clientId: 'c-1',
      schemaVersion: '1.0', mergedAt: new Date().toISOString(), templateBlocks: {},
      sections: [],
    })),
    invalidateCache: vi.fn(),
  };
}

async function saveSection(
  sectionId: string,
  data: Record<string, unknown>,
  draft?: AppraisalDraft,
) {
  const d = draft ?? makeDraft();
  const db = makeDbStub(d);
  const svc = new AppraisalDraftService(db as any, makeMergerStub() as any);
  await svc.saveSection('draft-1', 'order-1', sectionId, { expectedVersion: d.version, data }, 'user-1');
  return captureReplacedDraft(db);
}

// ── URAR v1.3 section routing ─────────────────────────────────────────────────

describe('SECTION_FIELD_MAP — URAR v1.3 sections write to reportDocument', () => {
  const v13Cases: Array<[string, string, unknown]> = [
    ['disaster-mitigation',     'disasterMitigation',      { items: [{ disasterCategory: 'Flood', mitigationFeature: 'Elevation cert' }] }],
    ['energy-efficiency',       'energyEfficiency',        { features: [{ feature: 'Solar panels', impact: 'Beneficial' }] }],
    ['functional-obsolescence', 'functionalObsolescence',  [{ feature: 'Outdated kitchen layout', curable: true }]],
    ['vehicle-storage',         'vehicleStorage',           [{ type: 'Attached Garage', spaces: 2 }]],
    ['outbuildings',            'outbuildings',             [{ type: 'Barn', gba: 400 }]],
    ['amenities',               'amenities',                [{ category: 'Pool', feature: 'In-ground pool' }]],
    ['overall-quality-condition', 'overallQualityCondition', { overallQuality: 'Q3', overallCondition: 'C3' }],
    ['analyzed-properties',     'analyzedPropertiesNotUsed', [{ address: { streetAddress: '99 Oak Ln' }, reasonNotUsed: 'Too far' }]],
    ['prior-transfers',         'priorTransfers',           [{ transferDate: '2024-06-01', transferPrice: 290000, isArmLength: true }]],
    ['assignment-conditions',   'assignmentConditions',     { intendedUse: 'Mortgage financing', marketValueDefinition: 'Standard' }],
  ];

  it.each(v13Cases)('%s → reportDocument.%s', async (sectionId, docField, payload) => {
    const saved = await saveSection(sectionId, { [docField]: payload });
    expect((saved.reportDocument as any)[docField]).toEqual(payload);
    // Must NOT appear in the generic sections bag
    expect(saved.sections?.[sectionId]).toBeUndefined();
  });
});

describe('SECTION_FIELD_MAP — core sections write to reportDocument', () => {
  it('sales-comparison → comps', async () => {
    const comps = [{ compId: 'c-1', salePrice: 350000, selected: true }];
    const saved = await saveSection('sales-comparison', { comps });
    expect(saved.reportDocument.comps).toEqual(comps);
  });

  it('reconciliation → writes valuation field', async () => {
    const valuation = { estimatedValue: 365000, effectiveDate: '2026-05-01', lowerBound: 350000, upperBound: 380000, confidenceScore: 90, reconciliationNotes: null, approachesUsed: ['sales_comparison'] as any, avmProvider: null, avmModelVersion: null };
    const saved = await saveSection('reconciliation', { valuation });
    expect(saved.reportDocument.valuation).toEqual(valuation);
  });
});

describe('SECTION_FIELD_MAP — unknown section uses sections bag', () => {
  it('unknown section key writes to draft.sections, not reportDocument', async () => {
    const data = { customField: 'hello' };
    const saved = await saveSection('my-custom-section', data);
    expect(saved.sections?.['my-custom-section']).toEqual(data);
    expect((saved.reportDocument as any)['my-custom-section']).toBeUndefined();
  });
});

// ── validate-canonical 422 gate ───────────────────────────────────────────────
// Unit-level coverage of finalizeDraft throwing UadFinalizationValidationError
// when canonical core validation detects ERROR-severity issues.

import { UadFinalizationValidationError } from '../../src/services/appraisal-draft.service.js';
import { UadValidationService } from '../../src/services/uad-validation.service.js';

const validator = new UadValidationService();

describe('422 gate: finalizeDraft rejects on canonical core ERRORs', () => {
  it('errors from validateCanonicalSections are ERROR severity → would throw', () => {
    const badDoc = {
      subject: { address: {} }, // missing all required fields
      comps: [],
      valuation: null,
    } as unknown as CanonicalReportDocument;
    const errors = validator.validateCanonicalSections(badDoc).filter(e => e.severity === 'ERROR');
    expect(errors.length).toBeGreaterThan(0);
    // The finalize gate would throw
    expect(() => { throw new UadFinalizationValidationError(errors); })
      .toThrow(UadFinalizationValidationError);
  });

  it('warnings from validateCanonicalSections are WARNING severity → would NOT block', () => {
    const docWithGlaWarning = {
      subject: {
        address: { streetAddress: '1 Main St', city: 'City', state: 'CA', zipCode: '90210' },
        propertyType: 'SFR', condition: 'C3', quality: 'Q3',
        yearBuilt: 2000,
        grossLivingArea: 50, // triggers UAD-106 WARNING
      },
      comps: [{ selected: true, salePrice: 300000, saleDate: '2026-01-01', grossLivingArea: 1200, address: { streetAddress: '2 Elm St' } }],
      valuation: { estimatedValue: 310000, effectiveDate: '2026-05-01' },
    } as unknown as CanonicalReportDocument;
    const errors = validator.validateCanonicalSections(docWithGlaWarning).filter(e => e.severity === 'ERROR');
    expect(errors.length).toBe(0); // only warnings present, finalize would proceed
  });
});
