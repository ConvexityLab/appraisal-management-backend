/**
 * Tests for VendorOrderService.createVendorOrder
 *
 * Focus: accessControl stamping (AUTH_PRODUCTION_READINESS_PLAN.md § 1.3)
 *   - G1/G2 gap fix: every VendorOrder write must carry an accessControl block
 *   - If the caller already stamped it (e.g. BulkPortfolioService), it is
 *     preserved verbatim.
 *   - If createdBy is present but accessControl is absent, the service
 *     generates it.
 *   - If neither is present, the service throws a descriptive error rather
 *     than silently creating an unscoped document.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VendorOrderService,
  type CreateVendorOrderInput,
} from '../src/services/vendor-order.service';
import { ProductType } from '../src/types/product-catalog';
import { VENDOR_ORDER_DOC_TYPE } from '../src/types/vendor-order.types';

// ── Mock CosmosDbService ─────────────────────────────────────────────────────

function makeMockDb() {
  let idCounter = 0;
  const written: any[] = [];

  const db = {
    createOrder: vi.fn(async (order: any) => {
      idCounter += 1;
      const id = `vo-${idCounter}`;
      const doc = { ...order, id, type: 'order' };
      written.push(doc);
      return { success: true, data: doc };
    }),
  } as any;

  return { db, written };
}

// ── Base input ───────────────────────────────────────────────────────────────

function baseInput(overrides: Partial<CreateVendorOrderInput> = {}): CreateVendorOrderInput {
  return {
    tenantId: 'tenant-a',
    clientOrderId: 'co-1',
    engagementId: 'eng-1',
    engagementLoanId: 'loan-1',
    clientId: 'client-1',
    propertyId: 'prop-1',
    vendorWorkType: ProductType.FULL_APPRAISAL as any,
    createdBy: 'user-manager-1',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('VendorOrderService.createVendorOrder — accessControl stamping', () => {
  let mock: ReturnType<typeof makeMockDb>;
  let svc: VendorOrderService;

  beforeEach(() => {
    mock = makeMockDb();
    svc = new VendorOrderService(mock.db);
  });

  it('stamps accessControl from createdBy when none is provided', async () => {
    const result = await svc.createVendorOrder(baseInput());

    // Service returns a VendorOrder
    expect(result.id).toBe('vo-1');
    expect(result.type).toBe(VENDOR_ORDER_DOC_TYPE);

    // dbService.createOrder was called once with an accessControl block
    expect(mock.db.createOrder).toHaveBeenCalledOnce();
    const written = mock.db.createOrder.mock.calls[0][0] as any;
    expect(written.accessControl).toBeDefined();
    expect(written.accessControl.ownerId).toBe('user-manager-1');
    expect(written.accessControl.tenantId).toBe('tenant-a');
    expect(written.accessControl.clientId).toBe('client-1');
  });

  it('preserves pre-built accessControl from upstream caller (bulk-portfolio path)', async () => {
    const upstream = {
      ownerId: 'bulk-submitter',
      ownerEmail: 'bulk@example.com',
      tenantId: 'tenant-a',
      clientId: 'client-1',
      assignedUserIds: [],
      visibilityScope: 'TEAM' as const,
    };
    const result = await svc.createVendorOrder(
      baseInput({ accessControl: upstream } as any),
    );

    expect(result.id).toBe('vo-1');
    const written = mock.db.createOrder.mock.calls[0][0] as any;
    // Upstream accessControl must be passed through unchanged.
    expect(written.accessControl.ownerId).toBe('bulk-submitter');
    expect(written.accessControl.ownerEmail).toBe('bulk@example.com');
  });

  it('throws a descriptive error when neither createdBy nor accessControl is present', async () => {
    const input = baseInput();
    delete (input as any).createdBy;

    await expect(svc.createVendorOrder(input)).rejects.toThrow(
      /cannot stamp accessControl.*input\.createdBy is present/,
    );

    // dbService.createOrder must NOT have been called
    expect(mock.db.createOrder).not.toHaveBeenCalled();
  });

  it('propagates linkage fields (clientOrderId, engagementId, tenantId) onto the returned VendorOrder', async () => {
    const result = await svc.createVendorOrder(baseInput());

    expect(result.clientOrderId).toBe('co-1');
    expect(result.engagementId).toBe('eng-1');
    expect(result.tenantId).toBe('tenant-a');
    expect(result.vendorWorkType).toBe(ProductType.FULL_APPRAISAL);
  });
});
