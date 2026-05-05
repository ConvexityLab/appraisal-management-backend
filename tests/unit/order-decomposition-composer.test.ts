/**
 * OrderDecomposition composer — slice 8h tests
 *
 * Exercises the rule-driven composition pipeline end-to-end at the pure
 * function level (no Cosmos). composeFromRule is the load-bearing entry;
 * we stress static + selector + conditional + dedup paths.
 */

import { describe, expect, it } from 'vitest';
import { composeFromRule } from '../../src/services/order-decomposition.service.js';
import {
  DECOMPOSITION_RULE_DOC_TYPE,
  GLOBAL_DEFAULT_TENANT,
  type DecompositionRule,
} from '../../src/types/decomposition-rule.types.js';
import { ProductType } from '../../src/types/product-catalog.js';

function baseRule(overrides?: Partial<DecompositionRule>): DecompositionRule {
  return {
    id: 'rule-test',
    tenantId: GLOBAL_DEFAULT_TENANT,
    type: DECOMPOSITION_RULE_DOC_TYPE,
    productType: ProductType.DVR,
    default: true,
    autoApply: false,
    vendorOrders: [],
    createdAt: '2026-05-05T00:00:00.000Z',
    updatedAt: '2026-05-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('composeFromRule (slice 8h)', () => {
  // ── Static-only mode (parity with pre-8h) ─────────────────────────────────

  describe('static templates', () => {
    it('returns static vendorOrders[] when no selectors/conditionals are defined', () => {
      const rule = baseRule({
        vendorOrders: [
          { vendorWorkType: ProductType.FULL_APPRAISAL, templateKey: 'appraisal' },
          { vendorWorkType: ProductType.AVM, templateKey: 'avm' },
        ],
      });
      const out = composeFromRule(rule, {});
      expect(out.map((t) => t.templateKey)).toEqual(['appraisal', 'avm']);
    });

    it('returns [] when rule.vendorOrders is empty and nothing else matches', () => {
      const rule = baseRule({ vendorOrders: [] });
      expect(composeFromRule(rule, {})).toEqual([]);
    });
  });

  // ── Selector mode (parameterised on productOptions) ───────────────────────

  describe('selectors (parameterised on productOptions)', () => {
    it('includes selector templates when its when clause matches', () => {
      const rule = baseRule({
        vendorOrders: [
          { vendorWorkType: ProductType.FULL_APPRAISAL, templateKey: 'appraisal' },
        ],
        selectors: [
          {
            when: { loanPurpose: 'Refinance' },
            include: [{ vendorWorkType: ProductType.DESK_REVIEW, templateKey: 'refi-desk-review' }],
          },
        ],
      });
      const out = composeFromRule(rule, {
        productOptions: { loanPurpose: 'Refinance' },
      });
      expect(out.map((t) => t.templateKey)).toEqual(['appraisal', 'refi-desk-review']);
    });

    it('skips selector templates when its when clause does not match', () => {
      const rule = baseRule({
        vendorOrders: [{ vendorWorkType: ProductType.FULL_APPRAISAL, templateKey: 'appraisal' }],
        selectors: [
          {
            when: { loanPurpose: 'Refinance' },
            include: [{ vendorWorkType: ProductType.DESK_REVIEW, templateKey: 'refi-desk-review' }],
          },
        ],
      });
      const out = composeFromRule(rule, {
        productOptions: { loanPurpose: 'Purchase' },
      });
      expect(out.map((t) => t.templateKey)).toEqual(['appraisal']);
    });

    it('matches case-insensitively for string options', () => {
      const rule = baseRule({
        selectors: [
          {
            when: { loanPurpose: 'Refinance' },
            include: [{ vendorWorkType: ProductType.AVM, templateKey: 'avm' }],
          },
        ],
      });
      const out = composeFromRule(rule, { productOptions: { loanPurpose: 'REFINANCE' } });
      expect(out.map((t) => t.templateKey)).toEqual(['avm']);
    });

    it('AND-matches across multiple when keys (all must match)', () => {
      const rule = baseRule({
        selectors: [
          {
            when: { loanPurpose: 'Refinance', isRush: true },
            include: [{ vendorWorkType: ProductType.AVM, templateKey: 'rush-avm' }],
          },
        ],
      });
      // Both match → include
      expect(composeFromRule(rule, { productOptions: { loanPurpose: 'Refinance', isRush: true } }))
        .toHaveLength(1);
      // Only one matches → exclude
      expect(composeFromRule(rule, { productOptions: { loanPurpose: 'Refinance', isRush: false } }))
        .toHaveLength(0);
      // Missing key → exclude (selectors are explicit, not permissive)
      expect(composeFromRule(rule, { productOptions: { loanPurpose: 'Refinance' } }))
        .toHaveLength(0);
    });

    it('multiple matching selectors union their includes', () => {
      const rule = baseRule({
        selectors: [
          {
            when: { loanPurpose: 'Refinance' },
            include: [{ vendorWorkType: ProductType.DESK_REVIEW, templateKey: 'review' }],
          },
          {
            when: { isRush: true },
            include: [{ vendorWorkType: ProductType.AVM, templateKey: 'rush-avm' }],
          },
        ],
      });
      const out = composeFromRule(rule, {
        productOptions: { loanPurpose: 'Refinance', isRush: true },
      });
      expect(out.map((t) => t.templateKey).sort()).toEqual(['review', 'rush-avm']);
    });
  });

  // ── Conditional mode (rule-driven against canonical) ──────────────────────

  describe('conditional templates (rule-driven against canonical)', () => {
    it('includes when the predicate evaluates true', () => {
      const rule = baseRule({
        conditionalTemplates: [
          {
            condition: {
              operator: 'AND',
              rules: [
                { field: 'valuation.estimatedValue', op: 'GT', value: 1_000_000 },
              ],
            },
            include: [
              { vendorWorkType: ProductType.INSPECTION, templateKey: 'high-value-inspection' },
            ],
          },
        ],
      });
      const out = composeFromRule(rule, {
        canonical: { valuation: { estimatedValue: 1_500_000 } as any },
      });
      expect(out.map((t) => t.templateKey)).toEqual(['high-value-inspection']);
    });

    it('excludes when the predicate evaluates false', () => {
      const rule = baseRule({
        conditionalTemplates: [
          {
            condition: {
              operator: 'AND',
              rules: [{ field: 'valuation.estimatedValue', op: 'GT', value: 1_000_000 }],
            },
            include: [{ vendorWorkType: ProductType.INSPECTION, templateKey: 'high-value-inspection' }],
          },
        ],
      });
      const out = composeFromRule(rule, {
        canonical: { valuation: { estimatedValue: 500_000 } as any },
      });
      expect(out).toEqual([]);
    });

    it('OR conditions match when ANY rule fires', () => {
      const rule = baseRule({
        conditionalTemplates: [
          {
            condition: {
              operator: 'OR',
              rules: [
                { field: 'valuation.estimatedValue', op: 'GT', value: 1_000_000 },
                { field: 'riskFlags.chainOfTitleRedFlags', op: 'IS_TRUE' },
              ],
            },
            include: [{ vendorWorkType: ProductType.QC_REVIEW, templateKey: 'enhanced-qc' }],
          },
        ],
      });
      // Only chain-of-title flag fires
      expect(
        composeFromRule(rule, {
          canonical: {
            valuation: { estimatedValue: 200_000 } as any,
            riskFlags: { chainOfTitleRedFlags: true } as any,
          },
        }),
      ).toHaveLength(1);
      // Neither fires
      expect(
        composeFromRule(rule, {
          canonical: {
            valuation: { estimatedValue: 200_000 } as any,
            riskFlags: { chainOfTitleRedFlags: false } as any,
          },
        }),
      ).toHaveLength(0);
    });

    it('handles nested paths (e.g. loan.loanPurposeType)', () => {
      const rule = baseRule({
        conditionalTemplates: [
          {
            condition: {
              operator: 'AND',
              rules: [{ field: 'loan.loanPurposeType', op: 'EQ', value: true as any }],
            },
            include: [{ vendorWorkType: ProductType.AVM, templateKey: 'whatever' }],
          },
        ],
      });
      // EQ with value=true compared against loanPurposeType string === true → false
      expect(composeFromRule(rule, { canonical: { loan: { loanPurposeType: 'Refinance' } as any } }))
        .toHaveLength(0);
    });
  });

  // ── Dedup ─────────────────────────────────────────────────────────────────

  describe('templateKey dedup — first occurrence wins', () => {
    it('a selector cannot shadow a static template with the same templateKey', () => {
      const rule = baseRule({
        vendorOrders: [
          { vendorWorkType: ProductType.FULL_APPRAISAL, templateKey: 'appraisal', instructions: 'static' },
        ],
        selectors: [
          {
            when: { loanPurpose: 'Refinance' },
            include: [
              { vendorWorkType: ProductType.AVM, templateKey: 'appraisal', instructions: 'shadowed' },
            ],
          },
        ],
      });
      const out = composeFromRule(rule, { productOptions: { loanPurpose: 'Refinance' } });
      expect(out).toHaveLength(1);
      expect(out[0]!.instructions).toBe('static');
    });

    it('templates without templateKey are not deduped', () => {
      const rule = baseRule({
        vendorOrders: [
          { vendorWorkType: ProductType.FULL_APPRAISAL }, // no key
          { vendorWorkType: ProductType.FULL_APPRAISAL }, // no key — kept
        ],
      });
      expect(composeFromRule(rule, {})).toHaveLength(2);
    });
  });

  // ── Combined static + selector + conditional ──────────────────────────────

  describe('all three modes combined', () => {
    it('unions static + selector + conditional templates', () => {
      const rule = baseRule({
        vendorOrders: [
          { vendorWorkType: ProductType.FULL_APPRAISAL, templateKey: 'appraisal' },
        ],
        selectors: [
          {
            when: { loanPurpose: 'Refinance' },
            include: [{ vendorWorkType: ProductType.DESK_REVIEW, templateKey: 'refi-review' }],
          },
        ],
        conditionalTemplates: [
          {
            condition: {
              operator: 'AND',
              rules: [{ field: 'valuation.estimatedValue', op: 'GT', value: 1_000_000 }],
            },
            include: [{ vendorWorkType: ProductType.INSPECTION, templateKey: 'high-value-inspection' }],
          },
        ],
      });
      const out = composeFromRule(rule, {
        productOptions: { loanPurpose: 'Refinance' },
        canonical: { valuation: { estimatedValue: 1_500_000 } as any },
      });
      expect(out.map((t) => t.templateKey)).toEqual([
        'appraisal',
        'refi-review',
        'high-value-inspection',
      ]);
    });
  });
});
