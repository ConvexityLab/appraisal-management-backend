/**
 * Tests for UadComplianceCategory — the Decision Engine plugin that lets
 * admins author per-tenant UAD-3.6 compliance overrides via the rules
 * workspace.
 *
 * Covers:
 *   - validateRules: enforces array shape, known rule ids, no duplicates,
 *     valid severityOverride values, boolean enabled. Emits a warning
 *     when every rule is disabled.
 *   - preview: evaluates the proposed config against the supplied
 *     canonical doc + maps the report into the generic CategoryPreviewResult.
 *   - getSeed: returns the code-default catalogue as the starting point.
 */

import { describe, it, expect } from 'vitest';
import {
  buildUadComplianceCategory,
  UAD_COMPLIANCE_CATEGORY_ID,
  buildConfigMap,
} from '../uad-compliance.category';
import {
  UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS,
  UAD_COMPLIANCE_RULE_IDS,
} from '../../../uad-compliance-evaluator.service';

describe('buildUadComplianceCategory.validateRules', () => {
  const cat = buildUadComplianceCategory();

  it('accepts the default rule configs as valid', () => {
    const r = cat.validateRules(UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS as unknown[]);
    expect(r.errors).toEqual([]);
  });

  it('rejects non-array input', () => {
    const r = cat.validateRules({} as unknown as unknown[]);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects unknown rule id', () => {
    const r = cat.validateRules([{ id: 'totally-fake-rule', enabled: true }]);
    expect(r.errors.some((e) => e.includes('totally-fake-rule'))).toBe(true);
  });

  it('rejects duplicate rule id', () => {
    const sample = UAD_COMPLIANCE_RULE_IDS[0]!;
    const r = cat.validateRules([
      { id: sample, enabled: true },
      { id: sample, enabled: false },
    ]);
    expect(r.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('rejects non-boolean enabled', () => {
    const sample = UAD_COMPLIANCE_RULE_IDS[0]!;
    const r = cat.validateRules([{ id: sample, enabled: 'yes' as unknown as boolean }]);
    expect(r.errors.some((e) => e.includes('enabled'))).toBe(true);
  });

  it('rejects invalid severityOverride', () => {
    const sample = UAD_COMPLIANCE_RULE_IDS[0]!;
    const r = cat.validateRules([
      { id: sample, enabled: true, severityOverride: 'EXTREME' as unknown as 'CRITICAL' },
    ]);
    expect(r.errors.some((e) => e.includes('severityOverride'))).toBe(true);
  });

  it('warns (not errors) when every rule is disabled', () => {
    const r = cat.validateRules(
      UAD_COMPLIANCE_RULE_IDS.map((id) => ({ id, enabled: false })),
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('accepts a sparse pack (only some rules configured)', () => {
    const r = cat.validateRules([
      { id: UAD_COMPLIANCE_RULE_IDS[0]!, enabled: false },
      { id: UAD_COMPLIANCE_RULE_IDS[1]!, enabled: true, severityOverride: 'CRITICAL' },
    ]);
    expect(r.errors).toEqual([]);
  });
});

describe('buildUadComplianceCategory.preview', () => {
  const cat = buildUadComplianceCategory();

  it('returns one result per evaluation', async () => {
    const results = await cat.preview!({
      rules: UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS,
      evaluations: [{ canonical: null }, { canonical: null }],
    });
    expect(results).toHaveLength(2);
  });

  it('null doc → eligible=true (no blockers possible without data)', async () => {
    const [result] = await cat.preview!({
      rules: UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS,
      evaluations: [{ canonical: null }],
    });
    expect(result!.eligible).toBe(true);
    expect((result!.extras as { snapshotAvailable: boolean }).snapshotAvailable).toBe(false);
  });

  it('honors enabled=false in the proposed config (disabled rule does not show as failed)', async () => {
    // Synthesize a doc that fails subject-parcel-number (MEDIUM severity).
    const docMissingApn = makePartialDoc({ withApn: false });

    const enabled = await cat.preview!({
      rules: UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS,
      evaluations: [{ canonical: docMissingApn }],
    });
    const disabled = await cat.preview!({
      rules: UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS.map((c) =>
        c.id === 'subject-parcel-number' ? { ...c, enabled: false } : c,
      ),
      evaluations: [{ canonical: docMissingApn }],
    });

    expect(enabled[0]!.appliedRuleIds).toContain('subject-parcel-number');
    expect(disabled[0]!.appliedRuleIds).not.toContain('subject-parcel-number');
  });
});

describe('buildUadComplianceCategory.getSeed', () => {
  const cat = buildUadComplianceCategory();

  it('returns the code-default rule configs as the seed', async () => {
    const seed = await cat.getSeed!();
    expect(seed.rules).toEqual(UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS);
    expect((seed.program as { id: string }).id).toBe(UAD_COMPLIANCE_CATEGORY_ID);
  });
});

describe('buildConfigMap helper', () => {
  it('keys rules by id', () => {
    const map = buildConfigMap([
      { id: 'subject-parcel-number', enabled: false },
      { id: UAD_COMPLIANCE_RULE_IDS[0]!, enabled: true },
    ]);
    expect(map['subject-parcel-number']?.enabled).toBe(false);
    expect(map[UAD_COMPLIANCE_RULE_IDS[0]!]?.enabled).toBe(true);
  });

  it('returns empty map for empty input', () => {
    expect(buildConfigMap([])).toEqual({});
  });
});

// ─── Local helpers ────────────────────────────────────────────────────────────

function makePartialDoc(opts: { withApn: boolean }) {
  // Minimal canonical doc shape — only the fields the rules we test against
  // actually touch. The evaluator uses optional chaining everywhere, so
  // missing branches cleanly produce per-rule "failed: missing data" results.
  const subject = {
    address: {
      streetAddress: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
    },
    grossLivingArea: 2000,
    totalRooms: 7,
    bedrooms: 3,
    bathrooms: 2.5,
    bathsFull: 2,
    bathsHalf: 1,
    stories: 2,
    lotSizeSqFt: 8000,
    propertyType: 'SFR',
    condition: 'C3',
    quality: 'Q3',
    design: 'Colonial',
    yearBuilt: 1995,
    foundationType: 'Full Basement',
    exteriorWalls: 'Brick',
    roofSurface: 'Asphalt Shingle',
    ...(opts.withApn ? { parcelNumber: '1234-567-890' } : { parcelNumber: null }),
  };
  return {
    id: 'doc',
    reportId: 'r',
    orderId: 'o',
    reportType: '1004',
    status: 'completed',
    schemaVersion: '1.0',
    metadata: { effectiveDate: '2026-05-01' },
    subject,
    comps: [
      mkComp('c1', 425000, '2026-02-15', 1980),
      mkComp('c2', 440000, '2026-03-10', 2050),
      mkComp('c3', 415000, '2026-01-20', 1960),
    ],
    valuation: {
      estimatedValue: 430000,
      effectiveDate: '2026-05-01',
      approachesUsed: ['sales_comparison'],
    },
    appraiserInfo: {
      name: 'Jane Appraiser',
      licenseNumber: 'IL-12345',
      licenseState: 'IL',
      licenseType: 'Certified Residential',
      licenseExpirationDate: '2027-12-31',
      signatureDate: '2026-05-01',
    },
  };
}

function mkComp(id: string, salePrice: number, saleDate: string, gla: number) {
  return {
    id,
    address: { streetAddress: `${id} Comp St`, city: 'Springfield', state: 'IL', zipCode: '62701' },
    grossLivingArea: gla,
    totalRooms: 7,
    bedrooms: 3,
    bathsFull: 2,
    bathsHalf: 0,
    stories: 2,
    lotSizeSqFt: 8000,
    propertyType: 'SFR',
    condition: 'C3',
    quality: 'Q3',
    design: 'Colonial',
    yearBuilt: 1990,
    foundationType: 'Full Basement',
    exteriorWalls: 'Brick',
    roofSurface: 'Asphalt Shingle',
    salePrice,
    saleDate,
  };
}
