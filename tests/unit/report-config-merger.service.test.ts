/**
 * Unit tests for _mergeConfigs (R-25)
 *
 * We test the exported pure function directly — no CosmosDbService mock needed
 * for the merge logic itself.  The class-level getEffectiveConfig (Cosmos calls,
 * cache TTL) is covered by integration tests.
 */

import { describe, it, expect } from 'vitest';
import { _mergeConfigs } from '../../src/services/report-config-merger.service.js';
import type {
  ReportConfigBaseDocument,
  ReportConfigDeltaDocument,
  ReportSectionDef,
} from '../../src/types/report-config.types.js';

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

function makeBase(overrides?: Partial<ReportConfigBaseDocument>): ReportConfigBaseDocument {
  const sections: ReportSectionDef[] = [
    {
      key: 'subject_property',
      label: 'Subject Property',
      order: 1,
      required: true,
      visible: true,
      fields: [
        { key: 'address', label: 'Address', type: 'text', required: true, visible: true, order: 1 },
        { key: 'city',    label: 'City',    type: 'text', required: true, visible: true, order: 2 },
      ],
    },
    {
      key: 'cost_approach',
      label: 'Cost Approach',
      order: 5,
      required: false,
      visible: true,
      fields: [
        { key: 'site_value', label: 'Site Value', type: 'currency', required: false, visible: true, order: 1 },
      ],
    },
  ];

  return {
    id: 'report-config-base-v1',
    schemaVersion: '1.0.0',
    sections,
    templateBlocks: { subject_property: 'templates/blocks/subject-property.html' },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDelta(
  partial: Partial<ReportConfigDeltaDocument> & Pick<ReportConfigDeltaDocument, 'id' | 'tier'>,
): ReportConfigDeltaDocument {
  return {
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...partial,
  };
}

const ORDER_ARGS = [
  'order-1',        // orderId
  'FULL_APPRAISAL', // productId
  'client-a',       // clientId
  undefined,        // subClientId
  '1.0.0',          // schemaVersion
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('_mergeConfigs', () => {
  it('1. identity — empty delta list returns sections and templateBlocks equal to base', () => {
    const base = makeBase();
    const result = _mergeConfigs(base, [], ...ORDER_ARGS);

    expect(result.sections).toHaveLength(base.sections.length);
    expect(result.sections[0]!.key).toBe('subject_property');
    expect(result.sections[0]!.fields).toHaveLength(2);
    expect(result.templateBlocks).toEqual(base.templateBlocks);
    expect(result.reportBranding).toBeUndefined();
  });

  it('2. tier precedence — product (later) wins over client (earlier) on visible toggle', () => {
    // client tier hides cost_approach (index 0 = applied first)
    // product tier re-shows it (index 2 = applied second, wins)
    const clientDelta = makeDelta({
      id: 'delta-client-a',
      tier: 'client',
      clientId: 'client-a',
      sections: [{ key: 'cost_approach', visible: false }],
    });
    const productDelta = makeDelta({
      id: 'delta-product-fa',
      tier: 'product',
      productId: 'FULL_APPRAISAL',
      sections: [{ key: 'cost_approach', visible: true }],
    });

    const result = _mergeConfigs(
      makeBase(),
      [clientDelta, productDelta], // already sorted client→product
      ...ORDER_ARGS,
    );

    const section = result.sections.find(s => s.key === 'cost_approach');
    expect(section).toBeDefined();
    expect(section!.visible).toBe(true); // product tier wins
  });

  it('3. addFields at client tier appends to existing section', () => {
    const clientDelta = makeDelta({
      id: 'delta-client-a-fields',
      tier: 'client',
      clientId: 'client-a',
      addFields: {
        subject_property: [
          { key: 'client_loan_ref', label: 'Loan Reference', type: 'text', required: false, visible: true, order: 100 },
          { key: 'client_program',  label: 'Program Code',   type: 'text', required: false, visible: true, order: 101 },
        ],
      },
    });

    const result = _mergeConfigs(makeBase(), [clientDelta], ...ORDER_ARGS);

    const section = result.sections.find(s => s.key === 'subject_property');
    expect(section).toBeDefined();
    // Base had 2 fields; two new ones appended
    expect(section!.fields).toHaveLength(4);
    expect(section!.fields.map(f => f.key)).toContain('client_loan_ref');
    expect(section!.fields.map(f => f.key)).toContain('client_program');
  });

  it('3b. addFields overwrites on key collision instead of duplicating', () => {
    const delta = makeDelta({
      id: 'delta-overwrite-field',
      tier: 'client',
      clientId: 'client-a',
      addFields: {
        subject_property: [
          { key: 'address', label: 'Full Street Address', type: 'text', required: true, visible: true, order: 1 },
        ],
      },
    });

    const result = _mergeConfigs(makeBase(), [delta], ...ORDER_ARGS);
    const section = result.sections.find(s => s.key === 'subject_property')!;
    // Still 2 fields — no duplicate
    expect(section.fields).toHaveLength(2);
    expect(section.fields.find(f => f.key === 'address')!.label).toBe('Full Street Address');
  });

  it('4. addSections at product tier appended after base sections', () => {
    const productDelta = makeDelta({
      id: 'delta-product-bpo',
      tier: 'product',
      productId: 'FULL_APPRAISAL',
      addSections: [
        {
          key: 'bpo_pricing_section',
          label: 'BPO Pricing',
          order: 20,
          required: true,
          visible: true,
          fields: [
            { key: 'as_is_value', label: 'As-Is Value', type: 'currency', required: true, visible: true, order: 1 },
          ],
        },
      ],
    });

    const result = _mergeConfigs(makeBase(), [productDelta], ...ORDER_ARGS);

    expect(result.sections.map(s => s.key)).toContain('bpo_pricing_section');
    expect(result.sections).toHaveLength(3); // 2 base + 1 new
  });

  it('5. templateBlocks override at client tier replaces base entry', () => {
    const delta = makeDelta({
      id: 'delta-client-blocks',
      tier: 'client',
      clientId: 'client-a',
      templateBlocks: { subject_property: 'templates/blocks/client-a-subject.html' },
    });

    const result = _mergeConfigs(makeBase(), [delta], ...ORDER_ARGS);

    expect(result.templateBlocks['subject_property']).toBe('templates/blocks/client-a-subject.html');
  });

  it('6. reportBranding from client tier lands on effectiveConfig.reportBranding', () => {
    const branding = {
      logoUrl: 'https://acme.example.com/logo.png',
      primaryColor: '#FF0000',
      footerText: 'Confidential — Acme Corp',
    };
    const delta = makeDelta({
      id: 'delta-client-branding',
      tier: 'client',
      clientId: 'client-a',
      reportBranding: branding,
    });

    const result = _mergeConfigs(makeBase(), [delta], ...ORDER_ARGS);

    expect(result.reportBranding).toEqual(branding);
  });

  it('7. precedence chain: version pin overrides product overrides subClient overrides client', () => {
    const clientDelta = makeDelta({
      id: 'delta-client',
      tier: 'client',
      clientId: 'client-a',
      sections: [{ key: 'cost_approach', label: 'Client label', visible: false }],
    });
    const subClientDelta = makeDelta({
      id: 'delta-sub',
      tier: 'subClient',
      subClientId: 'sub-a',
      sections: [{ key: 'cost_approach', label: 'SubClient label', visible: true }],
    });
    const productDelta = makeDelta({
      id: 'delta-product',
      tier: 'product',
      productId: 'FULL_APPRAISAL',
      sections: [{ key: 'cost_approach', label: 'Product label', visible: false }],
    });
    const versionDelta = makeDelta({
      id: 'delta-version',
      tier: 'version',
      schemaVersion: '1.0.0',
      sections: [{ key: 'cost_approach', label: 'Version label', visible: true }],
    });

    const result = _mergeConfigs(
      makeBase(),
      [clientDelta, subClientDelta, productDelta, versionDelta],
      'order-1', 'FULL_APPRAISAL', 'client-a', 'sub-a', '1.0.0',
    );

    const section = result.sections.find(s => s.key === 'cost_approach');
    expect(section).toBeDefined();
    expect(section!.visible).toBe(true);           // version wins
    expect(section!.label).toBe('Version label');  // version wins
  });
});
