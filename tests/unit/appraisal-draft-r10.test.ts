/**
 * Unit tests for R-10 — Draft persistence generalized for all product types.
 *
 * Covers:
 * 1. `saveDraft()`: sectionStatus is recomputed for product-agnostic sections
 *    stored in the `sections` bag, not just the URAR DRAFT_SECTION_IDS.
 * 2. `finalizeDraft()`: required-section gate uses EffectiveReportConfig
 *    (visible + required) instead of the hardcoded DRAFT_SECTION_IDS list,
 *    so drive-by / desktop-review products don't require cost/income sections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppraisalDraftService } from '../../src/services/appraisal-draft.service.js';
import type { EffectiveReportConfig } from '../../src/types/report-config.types.js';
import {
  type AppraisalDraft,
  DraftStatus,
  SectionStatus,
  DRAFT_SECTION_IDS,
  createInitialSectionStatus,
} from '../../src/types/appraisal-draft.types.js';
import type { CanonicalReportDocument } from '@l1/shared-types';
import { SCHEMA_VERSION } from '@l1/shared-types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const FAKE_ORDER = {
  id: 'order-1',
  type: 'vendor-order',
  clientId: 'client-a',
  productType: 'DRIVE_BY_2055',
};

/** Minimal CanonicalReportDocument satisfying the type */
function makeReportDoc(overrides: Partial<CanonicalReportDocument> = {}): CanonicalReportDocument {
  return {
    id: 'rpt-1',
    reportId: 'rpt-1',
    orderId: 'order-1',
    reportType: 'FORM_1004' as any,
    status: 'draft' as any,
    schemaVersion: SCHEMA_VERSION,
    metadata: {} as any,
    // Fully valid subject so validateCanonicalCore (UAD-100) does not fire
    subject: {
      address: {
        streetAddress: '123 Main St',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30301',
      },
      parcelNumber: 'ABC-123',
      propertyType: 'SFR',
      condition: 'C3',
      quality: 'Q3',
      yearBuilt: 2005,
      grossLivingArea: 1800,
    } as any,
    // Valid comps with one selected so UAD-200 does not fire
    comps: [
      {
        selected: true,
        salePrice: 350000,
        saleDate: '2025-01-15',
        grossLivingArea: 1750,
        address: { streetAddress: '456 Oak Ave' },
      },
    ] as any,
    // Valid valuation so UAD-500 does not fire
    valuation: {
      estimatedValue: 360000,
      effectiveDate: '2025-02-01',
    } as any,
    ...overrides,
  } as CanonicalReportDocument;
}

/** Minimal AppraisalDraft with a clean sectionStatus */
function makeDraft(overrides: Partial<AppraisalDraft> = {}): AppraisalDraft {
  return {
    id: 'draft-1',
    orderId: 'order-1',
    reportType: 'FORM_1004' as any,
    status: DraftStatus.EDITING,
    reportDocument: makeReportDoc(),
    sections: {},
    sectionStatus: createInitialSectionStatus(),
    validationErrors: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    lastEditedBy: 'user-1',
    autoSavedAt: null,
    version: 1,
    ...overrides,
  };
}

/** Minimal EffectiveReportConfig with given required-sections */
function makeConfig(sections: Array<{ key: string; required: boolean; visible: boolean }>): EffectiveReportConfig {
  return {
    orderId: 'order-1',
    productId: 'DRIVE_BY_2055',
    clientId: 'client-a',
    schemaVersion: '1.0.0',
    mergedAt: new Date().toISOString(),
    templateBlocks: {},
    sections: sections.map((s, i) => ({
      key: s.key,
      label: s.key,
      order: i + 1,
      required: s.required,
      visible: s.visible,
      templateBlockKey: `tmpl-${s.key}`,
      fields: [],
    })),
  };
}

/** Container stub that returns `draft` on read and captures the replaced value */
function makeContainerStub(draft: AppraisalDraft) {
  let stored = { ...draft };
  return {
    _stored: () => stored,
    item: vi.fn(() => ({
      read: vi.fn(async () => ({ resource: { ...stored } })),
      replace: vi.fn(async (updated: AppraisalDraft) => {
        stored = { ...updated };
        return { resource: { ...stored } };
      }),
    })),
  };
}

/** CosmosDbService stub */
function makeDbStub(draft: AppraisalDraft, order = FAKE_ORDER) {
  const container = makeContainerStub(draft);
  return {
    _container: container,
    getAppraisalDraftsContainer: vi.fn(() => container),
    getContainer: vi.fn(() => ({
      items: {
        query: vi.fn(() => ({
          fetchAll: vi.fn(async () => ({ resources: [order] })),
        })),
      },
    })),
    initialize: vi.fn(),
    queryDocuments: vi.fn(async () => []),
    upsertDocument: vi.fn(async () => ({})),
  };
}

function makeMergerStub(config: EffectiveReportConfig) {
  return {
    getEffectiveConfig: vi.fn(async () => config),
    invalidateCache: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// R-10a: saveDraft — sectionStatus widened to include sections-bag keys
// ---------------------------------------------------------------------------

describe('AppraisalDraftService.saveDraft (R-10)', () => {
  it('computes sectionStatus for product-agnostic sections in the sections bag', async () => {
    // Draft already has a product-agnostic section with some data saved
    const draft = makeDraft({
      sections: { 'rov_response': { narrative: 'ROV narrative text' } },
    });
    const db = makeDbStub(draft);
    const config = makeConfig([{ key: 'subject', required: true, visible: true }]);
    const svc = new AppraisalDraftService(db as any, makeMergerStub(config) as any);

    const result = await svc.saveDraft(
      'draft-1',
      'order-1',
      makeReportDoc(),
      1,
      'user-1',
    );

    // rov_response was in sections bag with data → should be IN_PROGRESS (not absent)
    expect(result.sectionStatus['rov_response']).toBeDefined();
    expect(result.sectionStatus['rov_response']).not.toBe(SectionStatus.NOT_STARTED);
  });

  it('still computes sectionStatus for all DRAFT_SECTION_IDS', async () => {
    const draft = makeDraft();
    const db = makeDbStub(draft);
    const config = makeConfig([{ key: 'subject', required: true, visible: true }]);
    const svc = new AppraisalDraftService(db as any, makeMergerStub(config) as any);

    const result = await svc.saveDraft(
      'draft-1',
      'order-1',
      makeReportDoc({ subject: { address: { streetAddress: '1 Elm', city: 'Atlanta', state: 'GA', zipCode: '30301' }, parcelNumber: 'ABC-123' } as any }),
      1,
      'user-1',
    );

    // All DRAFT_SECTION_IDS should be present in sectionStatus
    for (const sid of DRAFT_SECTION_IDS) {
      expect(result.sectionStatus[sid]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// R-10b: finalizeDraft — config-driven required-section gate
// ---------------------------------------------------------------------------

describe('AppraisalDraftService.finalizeDraft (R-10)', () => {
  it('does NOT require invisible/optional sections from config (drive-by: cost-approach hidden)', async () => {
    // Config: only 'subject' and 'reconciliation' are required+visible.
    // 'cost-approach' is visible=false, required=false.
    const config = makeConfig([
      { key: 'subject', required: true, visible: true },
      { key: 'reconciliation', required: true, visible: true },
      { key: 'cost-approach', required: false, visible: false },
    ]);

    const sectionStatus = createInitialSectionStatus();
    sectionStatus['subject'] = SectionStatus.COMPLETE;
    sectionStatus['reconciliation'] = SectionStatus.COMPLETE;
    // cost-approach is NOT_STARTED — but it's not required by config

    const draft = makeDraft({ status: DraftStatus.EDITING, sectionStatus });
    const db = makeDbStub(draft);
    const svc = new AppraisalDraftService(db as any, makeMergerStub(config) as any);

    // Should resolve without throwing
    const result = await svc.finalizeDraft('draft-1', 'order-1', 'user-1');
    expect(result.draft.status).toBe(DraftStatus.FINALIZED);
  });

  it('fails if a config-required visible section is incomplete', async () => {
    const config = makeConfig([
      { key: 'subject', required: true, visible: true },
      { key: 'income-approach', required: true, visible: true },
    ]);

    const sectionStatus = createInitialSectionStatus();
    sectionStatus['subject'] = SectionStatus.COMPLETE;
    // income-approach left as NOT_STARTED

    const draft = makeDraft({ status: DraftStatus.EDITING, sectionStatus });
    const db = makeDbStub(draft);
    const svc = new AppraisalDraftService(db as any, makeMergerStub(config) as any);

    await expect(svc.finalizeDraft('draft-1', 'order-1', 'user-1')).rejects.toThrow(
      /income-approach/,
    );
  });

  it('succeeds when all config-required visible sections are COMPLETE', async () => {
    const config = makeConfig([
      { key: 'subject', required: true, visible: true },
      { key: 'cost-approach', required: true, visible: true },
    ]);

    const sectionStatus = createInitialSectionStatus();
    sectionStatus['subject'] = SectionStatus.COMPLETE;
    sectionStatus['cost-approach'] = SectionStatus.COMPLETE;

    const draft = makeDraft({ status: DraftStatus.EDITING, sectionStatus });
    const db = makeDbStub(draft);
    const svc = new AppraisalDraftService(db as any, makeMergerStub(config) as any);

    const result = await svc.finalizeDraft('draft-1', 'order-1', 'user-1');
    expect(result.draft.status).toBe(DraftStatus.FINALIZED);
  });

  it('ignores required=true sections that are visible=false', async () => {
    // Edge case: a section marked required=true but visible=false in the merged config.
    // The section should NOT block finalization (hidden sections can't be edited).
    const config = makeConfig([
      { key: 'subject', required: true, visible: true },
      { key: 'hidden-required', required: true, visible: false },
    ]);

    const sectionStatus = createInitialSectionStatus();
    sectionStatus['subject'] = SectionStatus.COMPLETE;
    // hidden-required is NOT_STARTED

    const draft = makeDraft({ status: DraftStatus.EDITING, sectionStatus });
    const db = makeDbStub(draft);
    const svc = new AppraisalDraftService(db as any, makeMergerStub(config) as any);

    // Should succeed — hidden section cannot be completed so it must not block
    const result = await svc.finalizeDraft('draft-1', 'order-1', 'user-1');
    expect(result.draft.status).toBe(DraftStatus.FINALIZED);
  });
});
