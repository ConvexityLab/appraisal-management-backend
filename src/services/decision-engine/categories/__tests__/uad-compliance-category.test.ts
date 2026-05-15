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
} from '../uad-compliance.category';
import {
  UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS,
  UAD_COMPLIANCE_RULE_IDS,
  partitionPackRules,
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

  // ── Custom-rule (kind: 'custom', JSONLogic predicate) validation ──────────

  it('accepts a well-formed custom rule', () => {
    const r = cat.validateRules([
      {
        kind: 'custom',
        id: 'tenant-pool-required',
        enabled: true,
        label: 'Pool description required for pool-finance products',
        severity: 'HIGH',
        condition: { '==': [{ var: 'subject.hasPool' }, true] },
        message: 'Pool field must be populated for this product.',
      },
    ]);
    expect(r.errors).toEqual([]);
  });

  it('rejects custom rule with id colliding with a built-in', () => {
    const r = cat.validateRules([
      {
        kind: 'custom',
        id: UAD_COMPLIANCE_RULE_IDS[0]!,
        enabled: true,
        label: 'X',
        severity: 'HIGH',
        condition: {},
        message: 'X',
      },
    ]);
    expect(r.errors.some((e) => e.includes('collides with a built-in rule id'))).toBe(true);
  });

  it('rejects custom rule with non-slug id', () => {
    const r = cat.validateRules([
      {
        kind: 'custom',
        id: 'has space and !!! chars',
        enabled: true,
        label: 'X',
        severity: 'HIGH',
        condition: {},
        message: 'X',
      },
    ]);
    expect(r.errors.some((e) => e.includes('must match'))).toBe(true);
  });

  it('rejects custom rule missing required fields', () => {
    const r = cat.validateRules([
      {
        kind: 'custom',
        id: 'incomplete-rule',
        enabled: true,
        // label, severity, condition, message all missing
      } as unknown,
    ]);
    expect(r.errors.some((e) => e.includes('.label:'))).toBe(true);
    expect(r.errors.some((e) => e.includes('.severity:'))).toBe(true);
    expect(r.errors.some((e) => e.includes('.condition:'))).toBe(true);
    expect(r.errors.some((e) => e.includes('.message:'))).toBe(true);
  });

  it('rejects custom rule with deeply-nested condition (DoS guard)', () => {
    // Build an AST nested 40 levels deep — well beyond MAX_CONDITION_DEPTH (32).
    let cond: unknown = { '==': [{ var: 'a' }, 1] };
    for (let i = 0; i < 40; i++) {
      cond = { and: [cond] };
    }
    const r = cat.validateRules([
      {
        kind: 'custom',
        id: 'too-deep',
        enabled: true,
        label: 'Too deep',
        severity: 'HIGH',
        condition: cond,
        message: 'X',
      },
    ]);
    expect(r.errors.some((e) => e.includes('nesting depth'))).toBe(true);
  });

  it('rejects custom rule with non-JSON-serialisable condition (circular ref)', () => {
    const circ: Record<string, unknown> = {};
    circ['self'] = circ;
    const r = cat.validateRules([
      {
        kind: 'custom',
        id: 'circular-ref',
        enabled: true,
        label: 'Circular',
        severity: 'HIGH',
        condition: circ,
        message: 'X',
      },
    ]);
    expect(r.errors.some((e) => e.includes('JSON-serialisable'))).toBe(true);
  });

  it('rejects duplicate ids across override + custom shapes', () => {
    const r = cat.validateRules([
      { id: 'tenant-rule', kind: 'custom', enabled: true, label: 'X', severity: 'HIGH', condition: {}, message: 'X' },
      // Second entry with same id (treated as override by default) — collision should still fire.
      { id: 'tenant-rule', enabled: true },
    ]);
    expect(r.errors.some((e) => e.includes('duplicate rule id'))).toBe(true);
  });

  it('accepts mixed override + custom rules in the same pack', () => {
    const r = cat.validateRules([
      { id: UAD_COMPLIANCE_RULE_IDS[0]!, enabled: false },
      {
        kind: 'custom',
        id: 'tenant-rule',
        enabled: true,
        label: 'Tenant rule',
        severity: 'MEDIUM',
        condition: { '==': [1, 1] },
        message: 'Tenant rule failed.',
      },
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

describe('partitionPackRules helper', () => {
  it('keys override rules by id', () => {
    const { configMap, customRules } = partitionPackRules([
      { id: 'subject-parcel-number', enabled: false },
      { id: UAD_COMPLIANCE_RULE_IDS[0]!, enabled: true },
    ]);
    expect(configMap['subject-parcel-number']?.enabled).toBe(false);
    expect(configMap[UAD_COMPLIANCE_RULE_IDS[0]!]?.enabled).toBe(true);
    expect(customRules).toEqual([]);
  });

  it('returns empty configMap + empty customRules for empty input', () => {
    expect(partitionPackRules([])).toEqual({ configMap: {}, customRules: [] });
  });

  it('routes kind:custom into customRules and leaves configMap empty for that entry', () => {
    const result = partitionPackRules([
      {
        kind: 'custom',
        id: 'tenant-pool-required',
        enabled: true,
        label: 'Pool description required',
        severity: 'HIGH',
        condition: { '==': [{ var: 'subject.hasPool' }, true] },
        message: 'Pool field must be populated.',
      },
    ]);
    expect(result.configMap).toEqual({});
    expect(result.customRules).toHaveLength(1);
    expect(result.customRules[0]!.id).toBe('tenant-pool-required');
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
