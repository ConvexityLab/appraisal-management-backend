/**
 * Tests for the Decision Engine CategoryRegistry + the VendorMatchingCategory
 * definition (Phase B of DECISION_ENGINE_RULES_SURFACE.md).
 *
 * The registry is the contract between the generic controller and
 * category-specific behaviour. These tests pin:
 *   - registration / lookup invariants (id required, no duplicates)
 *   - VendorMatchingCategory's pre-write validator catches the mistakes
 *     that would have otherwise reached MOP and surfaced as 400s
 *   - VendorMatchingCategory's optional methods (push/preview/getSeed/drop)
 *     correctly forward to the underlying MopRulePackPusher
 *   - When no pusher is supplied (local dev), the optional methods are
 *     absent so the controller surfaces 501 — not a confusing 500
 */

import { describe, expect, it, vi } from 'vitest';
import {
  CategoryRegistry,
  buildVendorMatchingCategory,
  VENDOR_MATCHING_CATEGORY_ID,
  wireRegistryHooks,
} from '../../src/services/decision-engine/index.js';
import type { MopRulePackPusher } from '../../src/services/mop-rule-pack-pusher.service.js';
import { DecisionRulePackService } from '../../src/services/decision-rule-pack.service.js';

function rule(name: string, extra?: Record<string, unknown>) {
  return {
    name,
    salience: 100,
    pattern_id: 'p',
    conditions: { '==': [1, 1] },
    actions: [{ type: 'assert', fact_id: 'x', source: 'y', data: {} }],
    ...extra,
  };
}

describe('CategoryRegistry', () => {
  it('register + get round-trip', () => {
    const r = new CategoryRegistry();
    const def = buildVendorMatchingCategory({ pusher: null });
    r.register(def);
    expect(r.get(VENDOR_MATCHING_CATEGORY_ID)).toBe(def);
    expect(r.has(VENDOR_MATCHING_CATEGORY_ID)).toBe(true);
    expect(r.ids()).toContain(VENDOR_MATCHING_CATEGORY_ID);
  });

  it('rejects duplicate registration with a clear error', () => {
    const r = new CategoryRegistry();
    r.register(buildVendorMatchingCategory({ pusher: null }));
    expect(() => r.register(buildVendorMatchingCategory({ pusher: null })))
      .toThrow(/already registered/);
  });

  it('rejects definitions without an id', () => {
    const r = new CategoryRegistry();
    expect(() => r.register({ ...buildVendorMatchingCategory({ pusher: null }), id: '' }))
      .toThrow(/id is required/);
  });

  it('get returns undefined for unknown ids (controller turns this into 404)', () => {
    const r = new CategoryRegistry();
    expect(r.get('not-a-category')).toBeUndefined();
    expect(r.has('not-a-category')).toBe(false);
  });
});

describe('VendorMatchingCategory.validateRules', () => {
  const def = buildVendorMatchingCategory({ pusher: null });

  it('accepts a well-formed rule', () => {
    const result = def.validateRules([rule('a')]);
    expect(result.errors).toEqual([]);
  });

  it('rejects empty array', () => {
    const result = def.validateRules([]);
    expect(result.errors[0]).toMatch(/at least one rule/);
  });

  it('rejects duplicate names', () => {
    const result = def.validateRules([rule('dup'), rule('dup')]);
    expect(result.errors.some(e => /Duplicate rule name/.test(e))).toBe(true);
  });

  it('rejects rule missing pattern_id / salience / conditions / actions', () => {
    // Carefully omit each field one at a time so we get one error per missing piece.
    const r1 = { ...rule('a'), pattern_id: undefined };
    const r2 = { ...rule('b'), salience: 'not-a-number' };
    const r3 = { ...rule('c'), conditions: null };
    const r4 = { ...rule('d'), actions: [] };
    const result = def.validateRules([r1, r2, r3, r4]);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    expect(result.errors.some(e => /pattern_id is required/.test(e))).toBe(true);
    expect(result.errors.some(e => /salience must be a number/.test(e))).toBe(true);
    expect(result.errors.some(e => /conditions must be an object/.test(e))).toBe(true);
    expect(result.errors.some(e => /actions must be a non-empty array/.test(e))).toBe(true);
  });

  it('rejects non-object entries in the array', () => {
    const result = def.validateRules([null as unknown as Record<string, unknown>]);
    expect(result.errors[0]).toMatch(/must be an object/);
  });
});

describe('VendorMatchingCategory.push / preview / getSeed / drop', () => {
  function fakePusher() {
    return {
      push: vi.fn(async () => {}),
      preview: vi.fn(async () => ({
        results: [{ eligible: true, scoreAdjustment: 5, appliedRuleIds: ['r1'], denyReasons: [] }],
      })),
      getSeed: vi.fn(async () => ({
        program: { name: 'seed' },
        rules: [{ name: 'seed-rule' }],
      })),
      drop: vi.fn(async () => {}),
    } as unknown as MopRulePackPusher & {
      push: ReturnType<typeof vi.fn>;
      preview: ReturnType<typeof vi.fn>;
      getSeed: ReturnType<typeof vi.fn>;
      drop: ReturnType<typeof vi.fn>;
    };
  }

  it('forwards push/preview/getSeed/drop to the supplied pusher', async () => {
    const pusher = fakePusher();
    const def = buildVendorMatchingCategory({ pusher });

    expect(def.push).toBeTypeOf('function');
    expect(def.preview).toBeTypeOf('function');
    expect(def.getSeed).toBeTypeOf('function');
    expect(def.drop).toBeTypeOf('function');

    await def.push!({
      id: 'x', type: 'decision-rule-pack', category: 'vendor-matching',
      tenantId: 't', packId: 'default', version: 1, parentVersion: null,
      status: 'active', rules: [rule('a')], metadata: {}, createdAt: '', createdBy: 'u',
    });
    expect(pusher.push).toHaveBeenCalledTimes(1);

    const previewOut = await def.preview!({
      rules: [rule('a')],
      evaluations: [{ vendor: { id: 'v1' }, order: {} }],
    });
    expect(pusher.preview).toHaveBeenCalledTimes(1);
    expect(previewOut).toEqual([
      { eligible: true, scoreAdjustment: 5, appliedRuleIds: ['r1'], denyReasons: [] },
    ]);

    const seed = await def.getSeed!();
    expect(pusher.getSeed).toHaveBeenCalledTimes(1);
    expect(seed.rules).toEqual([{ name: 'seed-rule' }]);

    await def.drop!('tenant-1');
    expect(pusher.drop).toHaveBeenCalledWith('tenant-1');
  });

  it('omits the optional methods when no pusher is supplied (controller surfaces 501)', () => {
    const def = buildVendorMatchingCategory({ pusher: null });
    expect(def.push).toBeUndefined();
    expect(def.preview).toBeUndefined();
    expect(def.getSeed).toBeUndefined();
    expect(def.drop).toBeUndefined();
  });
});

describe('wireRegistryHooks', () => {
  function makeFakeDb() {
    const containers: Record<string, unknown[]> = {
      'decision-rule-packs': [],
      'decision-rule-audit': [],
    };
    return {
      containers,
      createDocument: vi.fn(async (cn: string, doc: { id: string }) => {
        (containers[cn] ?? []).push(doc);
        containers[cn] = containers[cn] ?? [];
      }),
      upsertDocument: vi.fn(async () => {}),
      getItem: vi.fn(async () => ({ success: false, data: null })),
      queryDocuments: vi.fn(async () => []),
    };
  }

  it('registers each category\'s push as an onNewActivePack hook', async () => {
    const db = makeFakeDb();
    const packs = new DecisionRulePackService(db as never);

    const pushSpy = vi.fn(async () => {});
    const fakePush = {
      push: pushSpy,
    } as unknown as MopRulePackPusher;

    const registry = new CategoryRegistry();
    registry.register(buildVendorMatchingCategory({ pusher: fakePush }));
    wireRegistryHooks(registry, packs);

    await packs.createVersion({
      category: 'vendor-matching',
      tenantId: 't1',
      packId: 'default',
      rules: [rule('a')],
      createdBy: 'tester',
    });

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('does not register a hook for categories that omit push', async () => {
    const db = makeFakeDb();
    const packs = new DecisionRulePackService(db as never);

    const registry = new CategoryRegistry();
    registry.register(buildVendorMatchingCategory({ pusher: null }));
    wireRegistryHooks(registry, packs);

    // Should not throw, no hook fires.
    const pack = await packs.createVersion({
      category: 'vendor-matching',
      tenantId: 't1',
      packId: 'default',
      rules: [rule('a')],
      createdBy: 'tester',
    });
    expect(pack.version).toBe(1);
  });
});
