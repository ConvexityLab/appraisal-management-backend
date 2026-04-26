/**
 * Tests for OrderDecompositionService — advisory rule lookup.
 *
 * Service is suggestion-only: returns null / [] on miss, never throws.
 */
import { describe, it, expect, vi } from 'vitest';
import { OrderDecompositionService } from '../src/services/order-decomposition.service';
import {
  DECOMPOSITION_RULE_DOC_TYPE,
  GLOBAL_DEFAULT_TENANT,
  type DecompositionRule,
} from '../src/types/decomposition-rule.types';
import { ProductType } from '../src/types/product-catalog';

// ── Helpers ──────────────────────────────────────────────────────────────────

type QueryArgs = { query: string; parameters: Array<{ name: string; value: unknown }> };

/**
 * Build a mock CosmosDbService whose `getContainer().items.query()` returns
 * the supplied tier-resolver in tier1 → tier2 → tier3 order.
 */
function makeMockDb(opts: {
  tier1?: DecompositionRule[];
  tier2?: DecompositionRule[];
  tier3?: DecompositionRule[];
}) {
  const calls: QueryArgs[] = [];
  let callIndex = -1;
  const tiers: Array<DecompositionRule[] | undefined> = [opts.tier1, opts.tier2, opts.tier3];

  const fetchAll = vi.fn(async () => {
    callIndex += 1;
    return { resources: tiers[callIndex] ?? [] };
  });

  return {
    calls,
    db: {
      getContainer: vi.fn().mockReturnValue({
        items: {
          query: vi.fn((q: QueryArgs) => {
            calls.push(q);
            return { fetchAll };
          }),
        },
      }),
    } as any,
  };
}

function makeRule(overrides: Partial<DecompositionRule>): DecompositionRule {
  return {
    id: 'rule-default',
    tenantId: 'tenant-a',
    type: DECOMPOSITION_RULE_DOC_TYPE,
    productType: ProductType.FULL_APPRAISAL,
    vendorOrders: [{ vendorWorkType: ProductType.FULL_APPRAISAL }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OrderDecompositionService.findRule', () => {
  it('returns the tier-1 rule (tenant + client + productType) when one exists', async () => {
    const tier1 = makeRule({ id: 'rule-tier1', clientId: 'client-1' });
    const mock = makeMockDb({ tier1: [tier1] });
    const svc = new OrderDecompositionService(mock.db);

    const result = await svc.findRule('tenant-a', 'client-1', ProductType.FULL_APPRAISAL);

    expect(result?.id).toBe('rule-tier1');
    // Tier-1 hit short-circuits — no tier-2/3 queries.
    expect(mock.calls.length).toBe(1);
  });

  it('falls through to tier 2 (tenant + productType) when no tier-1 match', async () => {
    const tier2 = makeRule({ id: 'rule-tier2' });
    const mock = makeMockDb({ tier1: [], tier2: [tier2] });
    const svc = new OrderDecompositionService(mock.db);

    const result = await svc.findRule('tenant-a', 'client-1', ProductType.FULL_APPRAISAL);

    expect(result?.id).toBe('rule-tier2');
    expect(mock.calls.length).toBe(2);
  });

  it('falls through to tier 3 (global default) when no tenant rule matches', async () => {
    const tier3 = makeRule({
      id: 'rule-tier3',
      tenantId: GLOBAL_DEFAULT_TENANT,
      default: true,
    });
    const mock = makeMockDb({ tier1: [], tier2: [], tier3: [tier3] });
    const svc = new OrderDecompositionService(mock.db);

    const result = await svc.findRule('tenant-a', 'client-1', ProductType.FULL_APPRAISAL);

    expect(result?.id).toBe('rule-tier3');
    expect(mock.calls.length).toBe(3);
  });

  it('returns null when no rule matches at any tier (no throw)', async () => {
    const mock = makeMockDb({ tier1: [], tier2: [], tier3: [] });
    const svc = new OrderDecompositionService(mock.db);

    const result = await svc.findRule('tenant-z', 'client-z', ProductType.BPO);

    expect(result).toBeNull();
    expect(mock.calls.length).toBe(3);
  });

  it('preserves the autoApply flag when present on the matched rule', async () => {
    const tier1 = makeRule({ id: 'auto-1', clientId: 'client-1', autoApply: true });
    const mock = makeMockDb({ tier1: [tier1] });
    const svc = new OrderDecompositionService(mock.db);

    const result = await svc.findRule('tenant-a', 'client-1', ProductType.FULL_APPRAISAL);

    expect(result?.autoApply).toBe(true);
  });
});

describe('OrderDecompositionService.suggestVendorOrders', () => {
  it('returns the matched rule\'s vendorOrders when a rule exists', async () => {
    const rule = makeRule({
      vendorOrders: [
        { vendorWorkType: ProductType.BPO_EXTERIOR },
        { vendorWorkType: ProductType.BPO_INTERIOR, vendorFee: 175 },
      ],
    });
    const mock = makeMockDb({ tier1: [], tier2: [rule] });
    const svc = new OrderDecompositionService(mock.db);

    const templates = await svc.suggestVendorOrders('tenant-a', 'client-1', ProductType.BPO);

    expect(templates).toHaveLength(2);
    expect(templates[0]!.vendorWorkType).toBe(ProductType.BPO_EXTERIOR);
    expect(templates[1]!.vendorFee).toBe(175);
  });

  it('returns [] when no rule matches', async () => {
    const mock = makeMockDb({ tier1: [], tier2: [], tier3: [] });
    const svc = new OrderDecompositionService(mock.db);

    const templates = await svc.suggestVendorOrders('tenant-a', 'client-1', ProductType.BPO);

    expect(templates).toEqual([]);
  });
});
