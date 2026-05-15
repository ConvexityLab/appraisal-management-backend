/**
 * Tests for UadComplianceEvaluatorService.
 *
 * Pins down the rule catalogue's semantics:
 *   - CRITICAL failures populate `blockers`
 *   - severity-weighted score is 100 when every rule passes
 *   - missing snapshot short-circuits with snapshotAvailable=false
 *   - per-rule `passed` + `message` reflect the actual failure
 *   - all rule ids are unique (catches accidental duplicates as the
 *     catalogue grows)
 */

import { describe, it, expect } from 'vitest';
import {
  UadComplianceEvaluatorService,
  UAD_COMPLIANCE_RULE_IDS,
  UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS,
  UAD_COMPLIANCE_RULE_METADATA,
  type UadRuleConfigMap,
} from '../uad-compliance-evaluator.service';
import type { CanonicalReportDocument } from '@l1/shared-types';

const svc = new UadComplianceEvaluatorService();

/**
 * Build a fully UAD-3.6-compliant canonical report. Individual tests
 * mutate one section to drive a specific rule into failure.
 */
function compliantDoc(): CanonicalReportDocument {
  return {
    id: 'doc-1',
    reportId: 'rpt-1',
    orderId: 'order-1',
    reportType: '1004',
    status: 'completed',
    schemaVersion: '1.0',
    metadata: {
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      borrowerName: 'Test Borrower',
      ownerOfPublicRecord: 'Owner',
      clientName: 'Client',
      clientCompanyName: null,
      clientAddress: null,
      clientEmail: null,
      loanNumber: 'L-1',
      effectiveDate: '2026-05-01',
      inspectionDate: '2026-04-30',
      isSubjectPurchase: false,
      contractPrice: null,
      contractDate: null,
      subjectPriorSaleDate1: null,
      subjectPriorSalePrice1: null,
      subjectPriorSaleDate2: null,
      subjectPriorSalePrice2: null,
    } as never,
    subject: {
      address: {
        streetAddress: '123 Main St',
        unit: null,
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        county: 'Sangamon',
      },
      grossLivingArea: 2000,
      totalRooms: 7,
      bedrooms: 3,
      bathrooms: 2.5,
      bathsFull: 2,
      bathsHalf: 1,
      stories: 2,
      lotSizeSqFt: 8500,
      propertyType: 'SFR',
      condition: 'C3',
      quality: 'Q3',
      design: 'Colonial',
      yearBuilt: 1995,
      foundationType: 'Full Basement',
      exteriorWalls: 'Brick',
      roofSurface: 'Asphalt Shingle',
      parcelNumber: '1234-567-890',
    } as never,
    comps: [
      makeComp('c1', 425000, '2026-02-15', 1980),
      makeComp('c2', 440000, '2026-03-10', 2050),
      makeComp('c3', 415000, '2026-01-20', 1960),
    ] as never,
    valuation: {
      estimatedValue: 430000,
      lowerBound: 410000,
      upperBound: 450000,
      confidenceScore: 85,
      effectiveDate: '2026-05-01',
      reconciliationNotes: null,
      approachesUsed: ['sales_comparison'],
      avmProvider: null,
      avmModelVersion: null,
    },
    appraiserInfo: {
      name: 'Jane Appraiser',
      licenseNumber: 'IL-12345',
      licenseState: 'IL',
      licenseType: 'Certified Residential',
      licenseExpirationDate: '2027-12-31',
      companyName: 'ACME Appraisal',
      companyAddress: '456 Oak St, Springfield IL 62701',
      phone: '555-0100',
      email: 'jane@example.com',
      signatureDate: '2026-05-01',
    },
  } as CanonicalReportDocument;
}

function makeComp(id: string, salePrice: number, saleDate: string, gla: number) {
  return {
    id,
    address: {
      streetAddress: `${id} Comp St`,
      unit: null,
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      county: 'Sangamon',
    },
    grossLivingArea: gla,
    totalRooms: 7,
    bedrooms: 3,
    bathrooms: 2,
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

describe('UadComplianceEvaluatorService.evaluate — happy path', () => {
  it('returns overallScore=100, no blockers, no fail count when fully compliant', () => {
    const r = svc.evaluate('order-1', compliantDoc());
    expect(r.snapshotAvailable).toBe(true);
    expect(r.overallScore).toBe(100);
    expect(r.failCount).toBe(0);
    expect(r.blockers).toEqual([]);
    expect(r.passCount).toBe(r.rules.length);
  });

  it('every rule has a unique id', () => {
    const ids = UAD_COMPLIANCE_RULE_IDS;
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('UadComplianceEvaluatorService.evaluate — missing snapshot', () => {
  it('returns snapshotAvailable=false and 0 score when doc is null', () => {
    const r = svc.evaluate('order-1', null);
    expect(r.snapshotAvailable).toBe(false);
    expect(r.overallScore).toBe(0);
    expect(r.passCount).toBe(0);
    expect(r.failCount).toBe(0);
    expect(r.rules).toEqual([]);
  });
});

describe('UadComplianceEvaluatorService.evaluate — CRITICAL failures populate blockers', () => {
  it('flags subject-address-present as CRITICAL when state missing', () => {
    const doc = compliantDoc();
    (doc.subject.address as { state: string }).state = '';
    const r = svc.evaluate('o', doc);
    const rule = r.rules.find((x) => x.id === 'subject-address-present');
    expect(rule?.passed).toBe(false);
    expect(rule?.severity).toBe('CRITICAL');
    expect(r.blockers).toContain('subject-address-present');
  });

  it('flags valuation-final-value when estimatedValue is 0', () => {
    const doc = compliantDoc();
    (doc.valuation as { estimatedValue: number }).estimatedValue = 0;
    const r = svc.evaluate('o', doc);
    expect(r.blockers).toContain('valuation-final-value');
  });

  it('flags comps-minimum-three when only 2 comps present', () => {
    const doc = compliantDoc();
    (doc as { comps: unknown[] }).comps = doc.comps.slice(0, 2);
    const r = svc.evaluate('o', doc);
    const rule = r.rules.find((x) => x.id === 'comps-minimum-three');
    expect(rule?.passed).toBe(false);
    expect(rule?.message).toContain('2');
    expect(r.blockers).toContain('comps-minimum-three');
  });

  it('flags valuation-effective-date when both valuation.effectiveDate and metadata.effectiveDate are missing', () => {
    const doc = compliantDoc();
    (doc.valuation as { effectiveDate: string | null }).effectiveDate = '';
    (doc.metadata as { effectiveDate: string | null }).effectiveDate = null;
    const r = svc.evaluate('o', doc);
    expect(r.blockers).toContain('valuation-effective-date');
  });
});

describe('UadComplianceEvaluatorService.evaluate — HIGH failures do NOT populate blockers', () => {
  it('flags subject-quality-rating as HIGH when invalid grade given', () => {
    const doc = compliantDoc();
    (doc.subject as { quality: string }).quality = 'Q7'; // out of range
    const r = svc.evaluate('o', doc);
    const rule = r.rules.find((x) => x.id === 'subject-quality-rating');
    expect(rule?.passed).toBe(false);
    expect(rule?.severity).toBe('HIGH');
    // CRITICAL-only blocker list — HIGH issues live in the failed-rule list, not the blocker list.
    expect(r.blockers).not.toContain('subject-quality-rating');
  });

  it('flags subject-baths-split when half-baths missing', () => {
    const doc = compliantDoc();
    (doc.subject as { bathsHalf: number | null }).bathsHalf = null;
    const r = svc.evaluate('o', doc);
    expect(r.rules.find((x) => x.id === 'subject-baths-split')?.passed).toBe(false);
  });

  it('flags comps-sale-prices-present when one comp missing salePrice', () => {
    const doc = compliantDoc();
    (doc.comps[0] as { salePrice: number | null }).salePrice = null;
    const r = svc.evaluate('o', doc);
    expect(r.rules.find((x) => x.id === 'comps-sale-prices-present')?.passed).toBe(false);
  });
});

describe('UadComplianceEvaluatorService.evaluate — score weighting', () => {
  it('one MEDIUM fail produces a higher score than one CRITICAL fail', () => {
    const docMed = compliantDoc();
    (docMed.subject as { parcelNumber: string | null }).parcelNumber = null;
    const docCrit = compliantDoc();
    (docCrit.valuation as { estimatedValue: number }).estimatedValue = 0;
    const medScore = svc.evaluate('o', docMed).overallScore;
    const critScore = svc.evaluate('o', docCrit).overallScore;
    expect(medScore).toBeGreaterThan(critScore);
  });

  it('overallScore drops to 0 only when every rule fails', () => {
    // Hard to construct a doc that fails every rule, but failing a CRITICAL +
    // a couple HIGH should clearly cap the score below 90.
    const doc = compliantDoc();
    (doc.valuation as { estimatedValue: number }).estimatedValue = 0;
    (doc.subject as { yearBuilt: number | null }).yearBuilt = null;
    (doc.subject as { grossLivingArea: number | null }).grossLivingArea = null;
    const r = svc.evaluate('o', doc);
    expect(r.overallScore).toBeLessThan(90);
    expect(r.overallScore).toBeGreaterThan(0);
  });
});

describe('UadComplianceEvaluatorService.evaluate — pack config overlay', () => {
  it('drops a rule from output entirely when enabled=false', () => {
    const doc = compliantDoc();
    // Force the rule into a fail state so it would normally show up.
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;

    const map: UadRuleConfigMap = {
      'subject-parcel-number': { id: 'subject-parcel-number', enabled: false },
    };
    const r = svc.evaluate('o', doc, map);
    expect(r.rules.find((x) => x.id === 'subject-parcel-number')).toBeUndefined();
  });

  it('drops disabled rules from the score denominator (does not penalize)', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;

    const enabled = svc.evaluate('o', doc).overallScore; // 1 MEDIUM fails
    const disabled = svc.evaluate('o', doc, {
      'subject-parcel-number': { id: 'subject-parcel-number', enabled: false },
    }).overallScore;
    // With the rule disabled, the failure no longer subtracts from total → 100.
    expect(disabled).toBe(100);
    expect(enabled).toBeLessThan(100);
  });

  it('severityOverride: lower CRITICAL → MEDIUM, failure stops blocking', () => {
    const doc = compliantDoc();
    (doc.valuation as { estimatedValue: number }).estimatedValue = 0;

    const baseline = svc.evaluate('o', doc);
    expect(baseline.blockers).toContain('valuation-final-value');

    const overlay = svc.evaluate('o', doc, {
      'valuation-final-value': {
        id: 'valuation-final-value',
        enabled: true,
        severityOverride: 'MEDIUM',
      },
    });
    expect(overlay.blockers).not.toContain('valuation-final-value');
    // The rule still shows up in the rule list (just at the overridden severity).
    const ruleResult = overlay.rules.find((x) => x.id === 'valuation-final-value');
    expect(ruleResult?.severity).toBe('MEDIUM');
    expect(ruleResult?.passed).toBe(false);
  });

  it('severityOverride: raise MEDIUM → CRITICAL, failure starts blocking', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;

    const overlay = svc.evaluate('o', doc, {
      'subject-parcel-number': {
        id: 'subject-parcel-number',
        enabled: true,
        severityOverride: 'CRITICAL',
      },
    });
    expect(overlay.blockers).toContain('subject-parcel-number');
  });

  it('messageOverride replaces the default failure message', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;
    const overlay = svc.evaluate('o', doc, {
      'subject-parcel-number': {
        id: 'subject-parcel-number',
        enabled: true,
        messageOverride: 'Per Acme Bank policy, APN is mandatory before sign-off.',
      },
    });
    const rule = overlay.rules.find((x) => x.id === 'subject-parcel-number');
    expect(rule?.message).toBe('Per Acme Bank policy, APN is mandatory before sign-off.');
  });

  it('empty-string messageOverride falls back to the code-side default', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;
    const overlay = svc.evaluate('o', doc, {
      'subject-parcel-number': {
        id: 'subject-parcel-number',
        enabled: true,
        messageOverride: '   ',
      },
    });
    const rule = overlay.rules.find((x) => x.id === 'subject-parcel-number');
    expect(rule?.message).toMatch(/APN/i);
  });

  it('unknown rule ids in configMap are silently ignored', () => {
    const doc = compliantDoc();
    const overlay = svc.evaluate('o', doc, {
      'made-up-rule': { id: 'made-up-rule', enabled: false },
    });
    expect(overlay.overallScore).toBe(100); // unaffected
  });

  it('passing absent configMap is identical to passing empty map', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;
    const noMap = svc.evaluate('o', doc);
    const emptyMap = svc.evaluate('o', doc, {});
    expect(emptyMap.overallScore).toBe(noMap.overallScore);
    expect(emptyMap.rules.length).toBe(noMap.rules.length);
  });
});

describe('UAD compliance — exported rule catalogue helpers', () => {
  it('DEFAULT_RULE_CONFIGS covers every rule id and defaults enabled=true', () => {
    expect(UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS).toHaveLength(UAD_COMPLIANCE_RULE_IDS.length);
    for (const cfg of UAD_COMPLIANCE_DEFAULT_RULE_CONFIGS) {
      expect(UAD_COMPLIANCE_RULE_IDS).toContain(cfg.id);
      expect(cfg.enabled).toBe(true);
      expect(cfg.severityOverride).toBeUndefined();
      expect(cfg.messageOverride).toBeUndefined();
    }
  });

  it('RULE_METADATA mirrors the rule catalogue with stable shape', () => {
    expect(UAD_COMPLIANCE_RULE_METADATA).toHaveLength(UAD_COMPLIANCE_RULE_IDS.length);
    for (const meta of UAD_COMPLIANCE_RULE_METADATA) {
      expect(meta.id.length).toBeGreaterThan(0);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(['CRITICAL', 'HIGH', 'MEDIUM']).toContain(meta.defaultSeverity);
    }
  });
});

// ── Custom-rule (JSONLogic predicate) evaluation ────────────────────────────

import type { UadCustomRule } from '../uad-compliance-evaluator.service';

describe('UadComplianceEvaluatorService.evaluate — custom rules (JSONLogic)', () => {
  function customRule(overrides: Partial<UadCustomRule> = {}): UadCustomRule {
    return {
      kind: 'custom',
      id: 'tenant-test-rule',
      enabled: true,
      label: 'Tenant test rule',
      severity: 'HIGH',
      // Default predicate is truthy (rule fails) when subject.parcelNumber
      // is null/empty. Note the operand is passed directly, not array-wrapped
      // — our shared JSONLogic evaluator treats arrays as map-and-collect.
      condition: { '!': { var: 'subject.parcelNumber' } },
      message: 'Tenant requires subject APN on every report.',
      ...overrides,
    };
  }

  it('truthy condition ⇒ rule failed; appears in the rules array with the configured message', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;
    const r = svc.evaluate('o', doc, undefined, [customRule()]);
    const rule = r.rules.find((x) => x.id === 'tenant-test-rule');
    expect(rule).toBeDefined();
    expect(rule!.passed).toBe(false);
    expect(rule!.message).toBe('Tenant requires subject APN on every report.');
    expect(rule!.severity).toBe('HIGH');
    expect(rule!.label).toBe('Tenant test rule');
  });

  it('falsy condition ⇒ rule passes', () => {
    const doc = compliantDoc(); // parcelNumber populated
    const r = svc.evaluate('o', doc, undefined, [customRule()]);
    const rule = r.rules.find((x) => x.id === 'tenant-test-rule');
    expect(rule?.passed).toBe(true);
    expect(rule?.message).toBe('');
  });

  it('CRITICAL custom-rule failure populates the blockers list', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;
    const r = svc.evaluate('o', doc, undefined, [customRule({ severity: 'CRITICAL' })]);
    expect(r.blockers).toContain('tenant-test-rule');
  });

  it('HIGH custom-rule failure does NOT populate blockers (CRITICAL-only)', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;
    const r = svc.evaluate('o', doc, undefined, [customRule({ severity: 'HIGH' })]);
    expect(r.blockers).not.toContain('tenant-test-rule');
  });

  it('enabled=false drops the custom rule from output entirely', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;
    const r = svc.evaluate('o', doc, undefined, [customRule({ enabled: false })]);
    expect(r.rules.find((x) => x.id === 'tenant-test-rule')).toBeUndefined();
  });

  it('malformed JSONLogic ⇒ rule treated as failed with a system-error message', () => {
    const doc = compliantDoc();
    const broken = customRule({
      // 'totally-fake-operator' is not in the evaluator's operator set.
      condition: { 'totally-fake-operator': [1, 2] },
    });
    const r = svc.evaluate('o', doc, undefined, [broken]);
    const rule = r.rules.find((x) => x.id === 'tenant-test-rule');
    expect(rule?.passed).toBe(false);
    expect(rule?.message).toMatch(/evaluation error/i);
  });

  it('custom rules contribute to the score weighting alongside built-ins', () => {
    const doc = compliantDoc();
    const baselineScore = svc.evaluate('o', doc).overallScore; // 100
    // Custom CRITICAL rule that always fails → drops score below 100.
    const alwaysFail = customRule({ severity: 'CRITICAL', condition: true });
    const r = svc.evaluate('o', doc, undefined, [alwaysFail]);
    expect(baselineScore).toBe(100);
    expect(r.overallScore).toBeLessThan(100);
  });

  it('falls back to built-in label when custom rule label is empty', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;
    const r = svc.evaluate('o', doc, undefined, [customRule({ label: '' })]);
    const rule = r.rules.find((x) => x.id === 'tenant-test-rule');
    expect(rule?.label).toBe('tenant-test-rule'); // falls back to id
  });

  it('provides a default failure message when the custom rule has empty message', () => {
    const doc = compliantDoc();
    (doc.subject as { parcelNumber: string | null }).parcelNumber = null;
    const r = svc.evaluate('o', doc, undefined, [customRule({ message: '' })]);
    const rule = r.rules.find((x) => x.id === 'tenant-test-rule');
    expect(rule?.passed).toBe(false);
    expect(rule?.message.length).toBeGreaterThan(0);
  });

  it('mixed built-ins + custom rules: both flow through to the final report', () => {
    const doc = compliantDoc();
    (doc.subject as { yearBuilt: number | null }).yearBuilt = null; // built-in HIGH rule fails
    const r = svc.evaluate(
      'o',
      doc,
      { 'subject-parcel-number': { id: 'subject-parcel-number', enabled: false } },
      [customRule({ severity: 'MEDIUM', condition: { '==': [1, 1] } })], // always-fail MEDIUM custom
    );
    // Built-in yearBuilt rule still fails (HIGH).
    expect(r.rules.some((x) => x.id === 'subject-year-built' && !x.passed)).toBe(true);
    // APN built-in rule was disabled, so not in output.
    expect(r.rules.find((x) => x.id === 'subject-parcel-number')).toBeUndefined();
    // Custom rule fired and is in output.
    expect(r.rules.some((x) => x.id === 'tenant-test-rule' && !x.passed)).toBe(true);
  });
});

describe('partitionPackRules', () => {
  it('back-compat: rules without `kind` are treated as overrides', async () => {
    const { partitionPackRules } = await import('../uad-compliance-evaluator.service');
    const r = partitionPackRules([
      { id: 'subject-parcel-number', enabled: false },
    ]);
    expect(r.configMap['subject-parcel-number']?.enabled).toBe(false);
    expect(r.customRules).toEqual([]);
  });

  it('splits a mixed array into configMap + customRules', async () => {
    const { partitionPackRules } = await import('../uad-compliance-evaluator.service');
    const r = partitionPackRules([
      { id: 'subject-parcel-number', enabled: false },
      {
        kind: 'custom',
        id: 'tenant-rule',
        enabled: true,
        label: 'Tenant rule',
        severity: 'HIGH',
        condition: {},
        message: 'Tenant rule failed.',
      },
    ]);
    expect(r.configMap['subject-parcel-number']?.enabled).toBe(false);
    expect(r.customRules).toHaveLength(1);
    expect(r.customRules[0]!.id).toBe('tenant-rule');
  });

  it('drops malformed entries silently (defensive — validator catches them upstream)', async () => {
    const { partitionPackRules } = await import('../uad-compliance-evaluator.service');
    const r = partitionPackRules([
      null as never,
      'not-an-object' as never,
      { id: 'subject-parcel-number', enabled: true },
    ]);
    expect(r.configMap['subject-parcel-number']?.enabled).toBe(true);
    expect(r.customRules).toEqual([]);
  });
});

describe('conditionDepth (DoS guard helper)', () => {
  it('returns 1 for a primitive node', async () => {
    const { conditionDepth } = await import('../uad-compliance-evaluator.service');
    expect(conditionDepth(true)).toBe(1);
    expect(conditionDepth('hello')).toBe(1);
    expect(conditionDepth(42)).toBe(1);
  });

  it('counts AST nesting depth for object + array nodes', async () => {
    const { conditionDepth } = await import('../uad-compliance-evaluator.service');
    // {"==": [{"var": "x"}, 1]} → root(1) → "==" array(2) → object {"var": "x"}(3) → "x"(4)
    const node = { '==': [{ var: 'x' }, 1] };
    expect(conditionDepth(node)).toBeGreaterThanOrEqual(3);
  });

  it('short-circuits beyond MAX_CONDITION_DEPTH + 1', async () => {
    const { conditionDepth, MAX_CONDITION_DEPTH } = await import('../uad-compliance-evaluator.service');
    let cond: unknown = 1;
    for (let i = 0; i < MAX_CONDITION_DEPTH * 2; i++) cond = { and: [cond] };
    const d = conditionDepth(cond);
    expect(d).toBeGreaterThan(MAX_CONDITION_DEPTH);
  });
});
