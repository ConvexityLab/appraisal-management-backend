/**
 * OrderPlacementOrchestrator — Unit Tests
 *
 * Verifies the universal funnel's decomposition integration:
 *
 *   resolveSpecs()
 *     1. No rule → returns undefined
 *     2. Rule with autoApply=false → returns undefined (suggestions-only)
 *     3. Rule with autoApply=true, templates present → returns templates
 *     4. Rule with autoApply=true, compose() returns empty → returns undefined
 *     5. findRule() throws → returns undefined (graceful degradation, no hard fail)
 *     6. compose() throws → returns undefined (graceful degradation)
 *
 *   orchestrateClientOrder()
 *     7. Passes resolved specs to placeClientOrder when autoApply rule exists
 *     8. Passes undefined specs to placeClientOrder when no rule (bare ClientOrder)
 *     9. Propagates placeClientOrder errors — never swallows them
 *    10. Throws when clientId is missing from input
 *    11. Throws when productType is missing from input
 *
 *   addDecomposedVendorOrders()
 *    12. Uses decomposed specs when autoApply rule exists
 *    13. Falls back to fallbackSpecs when no autoApply rule
 *    14. Falls back to fallbackSpecs when findRule throws (degradation)
 *    15. Logs a warning and returns [] when no specs at all
 *    16. Propagates addVendorOrders errors — never swallows them
 *
 * All Cosmos DB is mocked. No network calls or credentials required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderPlacementOrchestrator } from '../../src/services/order-placement-orchestrator.service.js';
import type { ClientOrderService, PlaceClientOrderInput, PlaceClientOrderResult, VendorOrderSpec } from '../../src/services/client-order.service.js';
import type { OrderDecompositionService } from '../../src/services/order-decomposition.service.js';
import type { DecompositionRule, VendorOrderTemplate } from '../../src/types/decomposition-rule.types.js';
import type { ClientOrder } from '../../src/types/client-order.types.js';
import type { VendorOrder } from '../../src/types/vendor-order.types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<DecompositionRule> = {}): DecompositionRule {
  return {
    id: 'rule-001',
    type: 'decomposition-rule',
    tenantId: 'tenant-001',
    productType: 'FULL_APPRAISAL' as any,
    vendorOrders: [
      { vendorWorkType: 'FULL_APPRAISAL' as any, templateKey: 'field-review' },
      { vendorWorkType: 'DESK_REVIEW' as any, templateKey: 'desk-review' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as DecompositionRule;
}

function makeClientOrder(): ClientOrder {
  return {
    id: 'co-001',
    type: 'client-order',
    tenantId: 'tenant-001',
    clientOrderNumber: 'co-001',
    engagementId: 'eng-001',
    engagementPropertyId: 'loan-001',
    clientId: 'client-001',
    productType: 'FULL_APPRAISAL' as any,
    clientOrderStatus: 'PLACED' as any,
    placedAt: new Date().toISOString(),
    vendorOrderIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user-001',
  };
}

function makeVendorOrder(): VendorOrder {
  return {
    id: 'vo-001',
    orderNumber: 'ORD-001',
    tenantId: 'tenant-001',
    engagementId: 'eng-001',
    engagementClientOrderId: 'co-001',
  } as VendorOrder;
}

function makePlaceResult(): PlaceClientOrderResult {
  return {
    clientOrder: makeClientOrder(),
    vendorOrders: [makeVendorOrder()],
  };
}

function makePlaceInput(): PlaceClientOrderInput {
  return {
    tenantId: 'tenant-001',
    createdBy: 'user-001',
    engagementId: 'eng-001',
    engagementPropertyId: 'loan-001',
    clientId: 'client-001',
    productType: 'FULL_APPRAISAL' as any,
    propertyId: 'prop-001',
  };
}

function makeOrchestrator(
  clientOrderOverrides: Partial<InstanceType<typeof ClientOrderService>> = {},
  decompositionOverrides: Partial<InstanceType<typeof OrderDecompositionService>> = {},
): OrderPlacementOrchestrator {
  const clientOrderService = {
    placeClientOrder: vi.fn().mockResolvedValue(makePlaceResult()),
    addVendorOrders: vi.fn().mockResolvedValue([makeVendorOrder()]),
    ...clientOrderOverrides,
  } as unknown as ClientOrderService;

  const decompositionService = {
    findRule: vi.fn().mockResolvedValue(null),
    compose: vi.fn().mockResolvedValue([]),
    ...decompositionOverrides,
  } as unknown as OrderDecompositionService;

  return new OrderPlacementOrchestrator(clientOrderService, decompositionService);
}

// ── resolveSpecs ──────────────────────────────────────────────────────────────

describe('resolveSpecs', () => {
  it('1. returns undefined when no rule is found', async () => {
    const orch = makeOrchestrator({ }, { findRule: vi.fn().mockResolvedValue(null) });
    const result = await orch.resolveSpecs('tenant-001', 'client-001', 'FULL_APPRAISAL' as any);
    expect(result).toBeUndefined();
  });

  it('2. returns undefined when rule.autoApply is false (suggestions-only mode)', async () => {
    const orch = makeOrchestrator({ }, {
      findRule: vi.fn().mockResolvedValue(makeRule({ autoApply: false })),
    });
    const result = await orch.resolveSpecs('tenant-001', 'client-001', 'FULL_APPRAISAL' as any);
    expect(result).toBeUndefined();
  });

  it('2b. returns undefined when rule.autoApply is undefined', async () => {
    const rule = makeRule();
    delete (rule as any).autoApply;
    const orch = makeOrchestrator({ }, { findRule: vi.fn().mockResolvedValue(rule) });
    const result = await orch.resolveSpecs('tenant-001', 'client-001', 'FULL_APPRAISAL' as any);
    expect(result).toBeUndefined();
  });

  it('3. returns templates when rule.autoApply=true and compose() returns templates', async () => {
    const templates: VendorOrderTemplate[] = [
      { vendorWorkType: 'FULL_APPRAISAL' as any, templateKey: 'primary' },
      { vendorWorkType: 'DESK_REVIEW' as any, templateKey: 'desk' },
    ];
    const orch = makeOrchestrator({ }, {
      findRule: vi.fn().mockResolvedValue(makeRule({ autoApply: true })),
      compose: vi.fn().mockResolvedValue(templates),
    });
    const result = await orch.resolveSpecs('tenant-001', 'client-001', 'FULL_APPRAISAL' as any);
    expect(result).toEqual(templates);
    expect(result).toHaveLength(2);
  });

  it('4. returns undefined when autoApply=true but compose() returns empty array', async () => {
    const orch = makeOrchestrator({ }, {
      findRule: vi.fn().mockResolvedValue(makeRule({ autoApply: true })),
      compose: vi.fn().mockResolvedValue([]),
    });
    const result = await orch.resolveSpecs('tenant-001', 'client-001', 'FULL_APPRAISAL' as any);
    expect(result).toBeUndefined();
  });

  it('5. returns undefined when findRule() throws (graceful degradation)', async () => {
    const orch = makeOrchestrator({ }, {
      findRule: vi.fn().mockRejectedValue(new Error('Cosmos timeout')),
    });
    // MUST NOT throw — degrade gracefully
    const result = await orch.resolveSpecs('tenant-001', 'client-001', 'FULL_APPRAISAL' as any);
    expect(result).toBeUndefined();
  });

  it('6. returns undefined when compose() throws (graceful degradation)', async () => {
    const orch = makeOrchestrator({ }, {
      findRule: vi.fn().mockResolvedValue(makeRule({ autoApply: true })),
      compose: vi.fn().mockRejectedValue(new Error('Cosmos read failed')),
    });
    // MUST NOT throw — degrade gracefully
    const result = await orch.resolveSpecs('tenant-001', 'client-001', 'FULL_APPRAISAL' as any);
    expect(result).toBeUndefined();
  });

  it('passes context through to compose()', async () => {
    const composeMock = vi.fn().mockResolvedValue([{ vendorWorkType: 'FULL_APPRAISAL' as any }]);
    const orch = makeOrchestrator({ }, {
      findRule: vi.fn().mockResolvedValue(makeRule({ autoApply: true })),
      compose: composeMock,
    });
    const context = { productOptions: { rushOrder: true } };
    await orch.resolveSpecs('tenant-001', 'client-001', 'FULL_APPRAISAL' as any, context);
    expect(composeMock).toHaveBeenCalledWith('tenant-001', 'client-001', 'FULL_APPRAISAL', context);
  });
});

// ── orchestrateClientOrder ────────────────────────────────────────────────────

describe('orchestrateClientOrder', () => {
  it('7. passes resolved specs to placeClientOrder when autoApply rule exists', async () => {
    const templates: VendorOrderTemplate[] = [
      { vendorWorkType: 'FULL_APPRAISAL' as any },
      { vendorWorkType: 'DESK_REVIEW' as any },
    ];
    const placeClientOrderMock = vi.fn().mockResolvedValue(makePlaceResult());
    const orch = makeOrchestrator(
      { placeClientOrder: placeClientOrderMock },
      {
        findRule: vi.fn().mockResolvedValue(makeRule({ autoApply: true })),
        compose: vi.fn().mockResolvedValue(templates),
      },
    );

    const input = makePlaceInput();
    await orch.orchestrateClientOrder(input);

    expect(placeClientOrderMock).toHaveBeenCalledOnce();
    const [calledInput, calledSpecs] = placeClientOrderMock.mock.calls[0]!;
    expect(calledInput).toBe(input);
    expect(calledSpecs).toEqual(templates);
  });

  it('8. passes undefined specs to placeClientOrder when no rule (bare ClientOrder)', async () => {
    const placeClientOrderMock = vi.fn().mockResolvedValue(makePlaceResult());
    const orch = makeOrchestrator(
      { placeClientOrder: placeClientOrderMock },
      { findRule: vi.fn().mockResolvedValue(null) },
    );

    await orch.orchestrateClientOrder(makePlaceInput());

    expect(placeClientOrderMock).toHaveBeenCalledOnce();
    const [, calledSpecs] = placeClientOrderMock.mock.calls[0]!;
    expect(calledSpecs).toBeUndefined();
  });

  it('9. propagates placeClientOrder errors — never swallows them', async () => {
    const orch = makeOrchestrator(
      { placeClientOrder: vi.fn().mockRejectedValue(new Error('Cosmos write failed')) },
      { findRule: vi.fn().mockResolvedValue(null) },
    );
    await expect(orch.orchestrateClientOrder(makePlaceInput())).rejects.toThrow('Cosmos write failed');
  });

  it('10. throws when clientId is missing from input', async () => {
    const orch = makeOrchestrator();
    const input = { ...makePlaceInput(), clientId: undefined as any };
    await expect(orch.orchestrateClientOrder(input)).rejects.toThrow('clientId is required');
  });

  it('11. throws when productType is missing from input', async () => {
    const orch = makeOrchestrator();
    const input = { ...makePlaceInput(), productType: undefined as any };
    await expect(orch.orchestrateClientOrder(input)).rejects.toThrow('productType is required');
  });

  it('returns the PlaceClientOrderResult from placeClientOrder verbatim', async () => {
    const expected = makePlaceResult();
    const orch = makeOrchestrator(
      { placeClientOrder: vi.fn().mockResolvedValue(expected) },
      { findRule: vi.fn().mockResolvedValue(null) },
    );
    const result = await orch.orchestrateClientOrder(makePlaceInput());
    expect(result).toBe(expected);
  });
});

// ── addDecomposedVendorOrders ─────────────────────────────────────────────────

describe('addDecomposedVendorOrders', () => {
  const CLIENT_ORDER_ID = 'co-001';
  const TENANT_ID = 'tenant-001';
  const CLIENT_ID = 'client-001';
  const PRODUCT_TYPE = 'FULL_APPRAISAL' as any;
  const FALLBACK: VendorOrderSpec[] = [{ vendorWorkType: 'FULL_APPRAISAL' as any }];

  it('12. uses decomposed specs when autoApply rule exists', async () => {
    const decomposedTemplates: VendorOrderTemplate[] = [
      { vendorWorkType: 'FULL_APPRAISAL' as any, templateKey: 'primary' },
      { vendorWorkType: 'DESK_REVIEW' as any, templateKey: 'desk' },
    ];
    const addVendorOrdersMock = vi.fn().mockResolvedValue([makeVendorOrder(), makeVendorOrder()]);
    const orch = makeOrchestrator(
      { addVendorOrders: addVendorOrdersMock },
      {
        findRule: vi.fn().mockResolvedValue(makeRule({ autoApply: true })),
        compose: vi.fn().mockResolvedValue(decomposedTemplates),
      },
    );

    const inherited = { orderNumber: 'ORD-001' };
    await orch.addDecomposedVendorOrders(CLIENT_ORDER_ID, TENANT_ID, CLIENT_ID, PRODUCT_TYPE, FALLBACK, inherited as any);

    expect(addVendorOrdersMock).toHaveBeenCalledOnce();
    const [id, tid, specs] = addVendorOrdersMock.mock.calls[0]!;
    expect(id).toBe(CLIENT_ORDER_ID);
    expect(tid).toBe(TENANT_ID);
    expect(specs).toEqual(decomposedTemplates);  // NOT the fallback
  });

  it('13. falls back to fallbackSpecs when no autoApply rule', async () => {
    const addVendorOrdersMock = vi.fn().mockResolvedValue([makeVendorOrder()]);
    const orch = makeOrchestrator(
      { addVendorOrders: addVendorOrdersMock },
      { findRule: vi.fn().mockResolvedValue(null) },
    );

    await orch.addDecomposedVendorOrders(CLIENT_ORDER_ID, TENANT_ID, CLIENT_ID, PRODUCT_TYPE, FALLBACK);

    expect(addVendorOrdersMock).toHaveBeenCalledOnce();
    const [, , specs] = addVendorOrdersMock.mock.calls[0]!;
    expect(specs).toEqual(FALLBACK);
  });

  it('14. falls back to fallbackSpecs when findRule() throws (degradation)', async () => {
    const addVendorOrdersMock = vi.fn().mockResolvedValue([makeVendorOrder()]);
    const orch = makeOrchestrator(
      { addVendorOrders: addVendorOrdersMock },
      { findRule: vi.fn().mockRejectedValue(new Error('Cosmos timeout')) },
    );

    await orch.addDecomposedVendorOrders(CLIENT_ORDER_ID, TENANT_ID, CLIENT_ID, PRODUCT_TYPE, FALLBACK);

    expect(addVendorOrdersMock).toHaveBeenCalledOnce();
    const [, , specs] = addVendorOrdersMock.mock.calls[0]!;
    expect(specs).toEqual(FALLBACK);
  });

  it('15. returns [] and does not call addVendorOrders when fallbackSpecs is empty and no rule', async () => {
    const addVendorOrdersMock = vi.fn();
    const orch = makeOrchestrator(
      { addVendorOrders: addVendorOrdersMock },
      { findRule: vi.fn().mockResolvedValue(null) },
    );

    const result = await orch.addDecomposedVendorOrders(CLIENT_ORDER_ID, TENANT_ID, CLIENT_ID, PRODUCT_TYPE, []);
    expect(result).toEqual([]);
    expect(addVendorOrdersMock).not.toHaveBeenCalled();
  });

  it('16. propagates addVendorOrders errors — never swallows them', async () => {
    const orch = makeOrchestrator(
      { addVendorOrders: vi.fn().mockRejectedValue(new Error('Cosmos write failed')) },
      { findRule: vi.fn().mockResolvedValue(null) },
    );
    await expect(
      orch.addDecomposedVendorOrders(CLIENT_ORDER_ID, TENANT_ID, CLIENT_ID, PRODUCT_TYPE, FALLBACK),
    ).rejects.toThrow('Cosmos write failed');
  });

  it('passes inheritedFields through to addVendorOrders', async () => {
    const addVendorOrdersMock = vi.fn().mockResolvedValue([makeVendorOrder()]);
    const orch = makeOrchestrator(
      { addVendorOrders: addVendorOrdersMock },
      { findRule: vi.fn().mockResolvedValue(null) },
    );
    const inherited = { orderNumber: 'ORD-BULK-001', loanInformation: { loanNumber: 'LN-X' } } as any;
    await orch.addDecomposedVendorOrders(CLIENT_ORDER_ID, TENANT_ID, CLIENT_ID, PRODUCT_TYPE, FALLBACK, inherited);
    const [, , , passedInherited] = addVendorOrdersMock.mock.calls[0]!;
    expect(passedInherited).toBe(inherited);
  });

  it('passes context through to resolveSpecs / compose when autoApply rule exists', async () => {
    const composeMock = vi.fn().mockResolvedValue([{ vendorWorkType: 'FULL_APPRAISAL' as any }]);
    const addVendorOrdersMock = vi.fn().mockResolvedValue([makeVendorOrder()]);
    const orch = makeOrchestrator(
      { addVendorOrders: addVendorOrdersMock },
      {
        findRule: vi.fn().mockResolvedValue(makeRule({ autoApply: true })),
        compose: composeMock,
      },
    );
    const context = { productOptions: { rushOrder: true } };
    await orch.addDecomposedVendorOrders(CLIENT_ORDER_ID, TENANT_ID, CLIENT_ID, PRODUCT_TYPE, FALLBACK, {}, context);
    expect(composeMock).toHaveBeenCalledWith(TENANT_ID, CLIENT_ID, PRODUCT_TYPE, context);
  });
});

// ── fromDb factory ────────────────────────────────────────────────────────────

describe('OrderPlacementOrchestrator.fromDb', () => {
  it('creates an instance without throwing when given a CosmosDbService', () => {
    const fakeDb = {
      getContainer: vi.fn(),
    } as any;
    // Should not throw — just validate the factory signature
    expect(() => OrderPlacementOrchestrator.fromDb(fakeDb)).not.toThrow();
  });
});
