/**
 * Decomposition-rule seed structure tests
 *
 * Validates that the seeded rules cover the expected products and atoms,
 * with correct sequencing semantics (dependsOn keys reference real
 * sibling templateKeys).
 *
 * The seed module exports a `run(ctx)` driver; we exercise the rules by
 * intercepting the upsert helper and asserting on the constructed
 * documents in-memory — no Cosmos calls.
 */

import { describe, expect, it, vi } from 'vitest';
import { module as decompositionRulesModule } from '../../src/scripts/seed/modules/decomposition-rules.js';
import {
  DECOMPOSITION_RULE_DOC_TYPE,
  DECOMPOSITION_RULES_CONTAINER,
  GLOBAL_DEFAULT_TENANT,
  type DecompositionRule,
} from '../../src/types/decomposition-rule.types.js';
import { ProductType } from '../../src/types/product-catalog.js';

// ─── Test harness ─────────────────────────────────────────────────────────────

vi.mock('../../src/scripts/seed/seed-types.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/scripts/seed/seed-types.js')>(
    '../../src/scripts/seed/seed-types.js',
  );
  return {
    ...actual,
    upsert: vi.fn(),
    cleanContainer: vi.fn().mockResolvedValue(0),
  };
});

import { upsert, cleanContainer } from '../../src/scripts/seed/seed-types.js';

async function runSeedAndCollectRules(): Promise<DecompositionRule[]> {
  vi.clearAllMocks();
  const ctx = {
    cosmos: {} as any,
    tenantId: 'tenant-test',
    clientId: 'client-test',
    now: '2026-05-05T00:00:00.000Z',
    clean: false,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
  };
  await decompositionRulesModule.run(ctx);

  return (upsert as any).mock.calls
    .filter(([_, container]: [unknown, string]) => container === DECOMPOSITION_RULES_CONTAINER)
    .map(([_, __, doc]: [unknown, unknown, DecompositionRule]) => doc);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('decomposition-rules seed module', () => {
  it('writes to the decomposition-rules container', () => {
    expect(decompositionRulesModule.containers).toEqual([DECOMPOSITION_RULES_CONTAINER]);
    expect(decompositionRulesModule.name).toBe('decomposition-rules');
  });

  it('seeds a rule for every multi-atom client-facing product', async () => {
    const rules = await runSeedAndCollectRules();
    const productTypes = rules.map((r) => r.productType).sort();
    expect(productTypes).toEqual(
      [ProductType.BPO, ProductType.DVR, ProductType.HYBRID_APPRAISAL, ProductType.RAPIDVAL].sort(),
    );
  });

  it('every rule is a global default with the sentinel tenantId', async () => {
    const rules = await runSeedAndCollectRules();
    for (const rule of rules) {
      expect(rule.tenantId).toBe(GLOBAL_DEFAULT_TENANT);
      expect(rule.default).toBe(true);
      expect(rule.type).toBe(DECOMPOSITION_RULE_DOC_TYPE);
    }
  });

  it('every rule is a SUGGESTION (autoApply=false) — Phase 1 posture', async () => {
    const rules = await runSeedAndCollectRules();
    for (const rule of rules) {
      expect(rule.autoApply).toBe(false);
    }
  });

  it('every rule has at least one vendor-order template', async () => {
    const rules = await runSeedAndCollectRules();
    for (const rule of rules) {
      expect(rule.vendorOrders.length).toBeGreaterThan(0);
    }
  });

  describe('per-product compositions', () => {
    it('DVR = FULL_APPRAISAL + AVM + DESK_REVIEW + QC_REVIEW', async () => {
      const rules = await runSeedAndCollectRules();
      const dvr = rules.find((r) => r.productType === ProductType.DVR);
      expect(dvr).toBeDefined();
      expect(dvr!.vendorOrders.map((v) => v.vendorWorkType)).toEqual([
        ProductType.FULL_APPRAISAL,
        ProductType.AVM,
        ProductType.DESK_REVIEW,
        ProductType.QC_REVIEW,
      ]);
    });

    it('BPO = BPO + INSPECTION + DESK_REVIEW', async () => {
      const rules = await runSeedAndCollectRules();
      const bpo = rules.find((r) => r.productType === ProductType.BPO);
      expect(bpo).toBeDefined();
      expect(bpo!.vendorOrders.map((v) => v.vendorWorkType)).toEqual([
        ProductType.BPO,
        ProductType.INSPECTION,
        ProductType.DESK_REVIEW,
      ]);
    });

    it('HYBRID_APPRAISAL = FULL_APPRAISAL + AVM + DESK_REVIEW', async () => {
      const rules = await runSeedAndCollectRules();
      const hybrid = rules.find((r) => r.productType === ProductType.HYBRID_APPRAISAL);
      expect(hybrid).toBeDefined();
      expect(hybrid!.vendorOrders.map((v) => v.vendorWorkType)).toEqual([
        ProductType.FULL_APPRAISAL,
        ProductType.AVM,
        ProductType.DESK_REVIEW,
      ]);
    });

    it('RAPIDVAL = AVM + DESK_REVIEW', async () => {
      const rules = await runSeedAndCollectRules();
      const rapidval = rules.find((r) => r.productType === ProductType.RAPIDVAL);
      expect(rapidval).toBeDefined();
      expect(rapidval!.vendorOrders.map((v) => v.vendorWorkType)).toEqual([
        ProductType.AVM,
        ProductType.DESK_REVIEW,
      ]);
    });
  });

  describe('sequencing — dependsOn references must resolve to siblings', () => {
    it('every dependsOn key references a templateKey that exists in the same rule', async () => {
      const rules = await runSeedAndCollectRules();
      for (const rule of rules) {
        const keys = new Set(
          rule.vendorOrders.map((v) => v.templateKey).filter((k): k is string => Boolean(k)),
        );
        for (const v of rule.vendorOrders) {
          for (const dep of v.dependsOn ?? []) {
            expect(keys.has(dep), `${rule.id}: dependsOn '${dep}' must match a sibling templateKey`).toBe(true);
          }
        }
      }
    });

    it('DVR sequencing: desk-review depends on appraisal; qc-review depends on desk-review', async () => {
      const rules = await runSeedAndCollectRules();
      const dvr = rules.find((r) => r.productType === ProductType.DVR)!;
      const byKey = new Map(dvr.vendorOrders.map((v) => [v.templateKey, v]));
      expect(byKey.get('desk-review')?.dependsOn).toContain('appraisal');
      expect(byKey.get('qc-review')?.dependsOn).toContain('desk-review');
      expect(byKey.get('avm')?.dependsOn ?? []).toEqual([]); // AVM runs in parallel
    });

    it('BPO sequencing: review depends on both realtor-bpo AND inspection', async () => {
      const rules = await runSeedAndCollectRules();
      const bpo = rules.find((r) => r.productType === ProductType.BPO)!;
      const review = bpo.vendorOrders.find((v) => v.templateKey === 'review');
      expect(review?.dependsOn).toEqual(expect.arrayContaining(['realtor-bpo', 'inspection']));
    });
  });

  describe('clean mode', () => {
    it('cleans the container when ctx.clean is true', async () => {
      vi.clearAllMocks();
      const ctx = {
        cosmos: {} as any,
        tenantId: 'tenant-test',
        clientId: 'client-test',
        now: '2026-05-05T00:00:00.000Z',
        clean: true,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
      };
      await decompositionRulesModule.run(ctx);
      expect(cleanContainer).toHaveBeenCalledWith(ctx, DECOMPOSITION_RULES_CONTAINER);
    });
  });
});
