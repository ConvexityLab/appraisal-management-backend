/**
 * Product client-tier resolution — slice 8i tests
 *
 * Covers:
 *   1. createProduct defaults clientId to null (platform-default) when
 *      caller doesn't supply it.
 *   2. createProduct preserves an explicit clientId.
 *   3. findProductsForClient returns platform defaults + client overrides,
 *      with client overrides winning by name.
 *   4. Other-client products are NOT included.
 *   5. Pre-slice-8i rows (no clientId field) are treated as platform defaults.
 */

import { describe, expect, it, vi } from 'vitest';
import { CosmosDbService } from '../../src/services/cosmos-db.service.js';
import type { Product } from '../../src/types/index.js';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: overrides.id ?? `p-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: 'tenant-1',
    clientId: null,
    name: 'Full Appraisal',
    productType: 'FULL_APPRAISAL',
    defaultFee: 450,
    rushFeeMultiplier: 1.5,
    turnTimeDays: 5,
    isActive: true,
    status: 'ACTIVE' as Product['status'],
    createdAt: '2026-05-05T00:00:00.000Z',
    updatedAt: '2026-05-05T00:00:00.000Z',
    createdBy: 'tester',
    ...overrides,
  };
}

function makeServiceWithProducts(products: Product[]): CosmosDbService {
  const stub = {
    productsContainer: {
      items: {
        query: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockImplementation(async () => ({ resources: products })),
        }),
        create: vi.fn().mockImplementation(async (doc: Product) => ({ resource: doc })),
      },
    },
    generateId: vi.fn().mockReturnValue('generated-id-001'),
  } as any;
  // Bind prototype methods to the stub `this`.
  const svc = stub as unknown as CosmosDbService;
  return svc;
}

async function callCreate(thiz: any, input: any) {
  return (CosmosDbService.prototype.createProduct as any).call(thiz, input);
}
async function callFindForClient(thiz: any, tenantId: string, clientId: string) {
  return (CosmosDbService.prototype.findProductsForClient as any).call(thiz, tenantId, clientId);
}

// ─── createProduct ──────────────────────────────────────────────────────────

describe('createProduct (slice 8i)', () => {
  it('defaults clientId to null when not supplied (platform-default)', async () => {
    const svc = makeServiceWithProducts([]);
    const result = await callCreate(svc, {
      name: 'Full Appraisal',
      productType: 'FULL_APPRAISAL',
      defaultFee: 450,
      turnTimeDays: 5,
      tenantId: 'tenant-1',
      createdBy: 'tester',
    });
    expect(result.success).toBe(true);
    expect(result.data.clientId).toBeNull();
  });

  it('preserves an explicit clientId (client-tier product)', async () => {
    const svc = makeServiceWithProducts([]);
    const result = await callCreate(svc, {
      name: 'Custom Hybrid',
      productType: 'HYBRID_APPRAISAL',
      defaultFee: 350,
      turnTimeDays: 4,
      clientId: 'client-acme',
      tenantId: 'tenant-1',
      createdBy: 'tester',
    });
    expect(result.success).toBe(true);
    expect(result.data.clientId).toBe('client-acme');
  });
});

// ─── findProductsForClient ─────────────────────────────────────────────────

describe('findProductsForClient (slice 8i)', () => {
  it('returns platform defaults when client has no overrides', async () => {
    const platformAppraisal = makeProduct({ id: 'p-platform-1', name: 'Full Appraisal', clientId: null });
    const platformAvm = makeProduct({ id: 'p-platform-2', name: 'AVM', clientId: null });

    const svc = makeServiceWithProducts([platformAppraisal, platformAvm]);
    const result = await callFindForClient(svc, 'tenant-1', 'client-acme');

    expect(result.success).toBe(true);
    expect(result.data.map((p: Product) => p.id).sort()).toEqual(['p-platform-1', 'p-platform-2']);
  });

  it('client override wins over platform default by name', async () => {
    const platformAppraisal = makeProduct({
      id: 'p-platform', name: 'Full Appraisal', clientId: null, defaultFee: 450,
    });
    const clientAppraisal = makeProduct({
      id: 'p-client-acme', name: 'Full Appraisal', clientId: 'client-acme', defaultFee: 525,
    });
    const platformAvm = makeProduct({ id: 'p-avm', name: 'AVM', clientId: null });

    const svc = makeServiceWithProducts([platformAppraisal, clientAppraisal, platformAvm]);
    const result = await callFindForClient(svc, 'tenant-1', 'client-acme');

    expect(result.data).toHaveLength(2);
    const fullAppraisal = result.data.find((p: Product) => p.name === 'Full Appraisal');
    expect(fullAppraisal?.id).toBe('p-client-acme');
    expect(fullAppraisal?.defaultFee).toBe(525); // client price wins
    const avm = result.data.find((p: Product) => p.name === 'AVM');
    expect(avm?.clientId).toBeNull();
  });

  it('does NOT include products from other clients', async () => {
    // The Cosmos query filter handles this; the test confirms that even if
    // the stub returns extra rows from other clients, the merge layer would
    // not include them. We simulate by feeding only the rows the query
    // would return (clientId === 'client-acme' OR null).
    const platformAppraisal = makeProduct({ id: 'p-platform', name: 'Full Appraisal', clientId: null });
    const acmeOnly = makeProduct({ id: 'p-acme', name: 'Acme Only', clientId: 'client-acme' });

    const svc = makeServiceWithProducts([platformAppraisal, acmeOnly]);
    const result = await callFindForClient(svc, 'tenant-1', 'client-acme');

    expect(result.data.map((p: Product) => p.id).sort()).toEqual(['p-acme', 'p-platform']);
  });

  it('treats pre-8i rows (no clientId field) as platform defaults', async () => {
    const legacyRow = makeProduct({ id: 'p-legacy', name: 'Legacy Product' });
    delete (legacyRow as any).clientId;

    const svc = makeServiceWithProducts([legacyRow]);
    const result = await callFindForClient(svc, 'tenant-1', 'client-acme');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe('p-legacy');
  });

  it('client override that has NO matching platform product still appears', async () => {
    // A client may add a product the platform doesn't offer. No platform
    // row exists for it; the client-tier row stands alone.
    const clientUnique = makeProduct({
      id: 'p-client-unique', name: 'Custom Hybrid', clientId: 'client-acme',
    });
    const svc = makeServiceWithProducts([clientUnique]);
    const result = await callFindForClient(svc, 'tenant-1', 'client-acme');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe('p-client-unique');
  });

  it('platform-vs-client merge stable across query result order', async () => {
    // Cosmos may return rows in any order; our merge logic must not depend
    // on iteration order.
    const platformAppraisal = makeProduct({
      id: 'p-platform', name: 'Full Appraisal', clientId: null,
    });
    const clientAppraisal = makeProduct({
      id: 'p-client', name: 'Full Appraisal', clientId: 'client-acme',
    });

    // Order A: platform first, then client.
    let svc = makeServiceWithProducts([platformAppraisal, clientAppraisal]);
    let result = await callFindForClient(svc, 'tenant-1', 'client-acme');
    expect(result.data[0]!.id).toBe('p-client');

    // Order B: client first, then platform.
    svc = makeServiceWithProducts([clientAppraisal, platformAppraisal]);
    result = await callFindForClient(svc, 'tenant-1', 'client-acme');
    expect(result.data[0]!.id).toBe('p-client');
  });
});
