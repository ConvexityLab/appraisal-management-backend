/**
 * VendorOrderService — unit tests (slice 8e)
 *
 * Establishes the canonical vendor-side write path. Tests assert:
 *   - createVendorOrder routes through dbService.createOrder
 *   - The persisted row gets the legacy discriminator (`type: 'order'`) per
 *     Phase A; the discriminator flip is slice 8f.
 *   - Linkage fields (clientOrderId, engagementId, engagementLoanId,
 *     clientId, propertyId, vendorWorkType) are stamped on the result.
 *   - Persistence failures throw with a contextual message.
 */

import { describe, expect, it, vi } from 'vitest';
import { VendorOrderService } from '../../src/services/vendor-order.service.js';
import type { CreateVendorOrderInput } from '../../src/services/vendor-order.service.js';
import { VENDOR_ORDER_DOC_TYPE } from '../../src/types/vendor-order.types.js';
import { ProductType } from '../../src/types/product-catalog.js';

function makeDbServiceWithSuccess(returnedId = 'vorder-001') {
  return {
    createOrder: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: returnedId,
        // dbService normally fills in createdAt/updatedAt etc — irrelevant for
        // these tests.
      },
    }),
  } as any;
}

function makeDbServiceWithFailure(message = 'Cosmos throughput throttle') {
  return {
    createOrder: vi.fn().mockResolvedValue({
      success: false,
      error: { code: 'CREATE_ORDER_FAILED', message },
    }),
  } as any;
}

function makeInput(overrides: Partial<CreateVendorOrderInput> = {}): CreateVendorOrderInput {
  return {
    tenantId:        'tenant-test',
    clientOrderId:   'co-test',
    engagementId:    'eng-test',
    engagementLoanId: 'loan-test',
    clientId:        'client-test',
    propertyId:      'prop-test',
    vendorWorkType:  ProductType.FULL_APPRAISAL,
    // The parallel auth refactor stamps accessControl onto every VendorOrder
    // write. VendorOrderService throws when it can't resolve an owner for the
    // stamp (no caller-supplied accessControl AND no createdBy). Supply a
    // test user so each createVendorOrder call has a stamping path.
    createdBy:       'test-user',
    ...overrides,
  };
}

describe('VendorOrderService.createVendorOrder', () => {
  it('routes the write through dbService.createOrder', async () => {
    const db = makeDbServiceWithSuccess();
    const svc = new VendorOrderService(db);
    await svc.createVendorOrder(makeInput());
    expect(db.createOrder).toHaveBeenCalledTimes(1);
  });

  it('returns a VendorOrder with the new discriminator (slice 8f flipped)', async () => {
    const db = makeDbServiceWithSuccess();
    const svc = new VendorOrderService(db);
    const out = await svc.createVendorOrder(makeInput());
    // Slice 8f flipped the write from LEGACY_VENDOR_ORDER_DOC_TYPE ('order')
    // to VENDOR_ORDER_DOC_TYPE ('vendor-order'). Reads tolerate both via
    // VENDOR_ORDER_TYPE_PREDICATE for back-compat with pre-flip rows.
    expect(out.type).toBe(VENDOR_ORDER_DOC_TYPE);
    expect(out.type).toBe('vendor-order');
  });

  it('stamps linkage fields onto the returned VendorOrder', async () => {
    const db = makeDbServiceWithSuccess('vorder-007');
    const svc = new VendorOrderService(db);
    const out = await svc.createVendorOrder(makeInput({
      clientOrderId:    'co-007',
      engagementId:     'eng-007',
      engagementLoanId: 'loan-007',
      clientId:         'client-007',
      propertyId:       'prop-007',
      vendorWorkType:   ProductType.AVM,
    }));
    expect(out).toMatchObject({
      id:               'vorder-007',
      clientOrderId:    'co-007',
      engagementId:     'eng-007',
      engagementLoanId: 'loan-007',
      clientId:         'client-007',
      propertyId:       'prop-007',
      vendorWorkType:   ProductType.AVM,
    });
  });

  it('forwards passthrough fields (vendorFee, instructions) to the dbService write', async () => {
    const db = makeDbServiceWithSuccess();
    const svc = new VendorOrderService(db);
    await svc.createVendorOrder(makeInput({
      vendorFee:    450,
      instructions: 'Interior + comparable grid; 5 business days.',
    }));
    const writtenRow = db.createOrder.mock.calls[0]![0];
    expect(writtenRow.vendorFee).toBe(450);
    expect(writtenRow.instructions).toBe('Interior + comparable grid; 5 business days.');
  });

  it('defaults productType to vendorWorkType when caller did not supply it', async () => {
    const db = makeDbServiceWithSuccess();
    const svc = new VendorOrderService(db);
    const out = await svc.createVendorOrder(makeInput({ vendorWorkType: ProductType.AVM }));
    // Caller didn't pass productType — VendorOrder.productType mirrors vendorWorkType.
    expect(out.productType).toBe(ProductType.AVM);
  });

  it('preserves caller-supplied productType when different from vendorWorkType', async () => {
    // After future multi-step decomposition, the parent ClientOrder's productType
    // (e.g. 'DVR') may differ from a child VendorOrder's vendorWorkType
    // (e.g. 'FULL_APPRAISAL'). Verify the input's explicit productType wins.
    const db = makeDbServiceWithSuccess();
    const svc = new VendorOrderService(db);
    const out = await svc.createVendorOrder(makeInput({
      productType:    ProductType.DVR,
      vendorWorkType: ProductType.FULL_APPRAISAL,
    }));
    expect(out.productType).toBe(ProductType.DVR);
    expect(out.vendorWorkType).toBe(ProductType.FULL_APPRAISAL);
  });

  it('throws with contextual message on dbService failure', async () => {
    const db = makeDbServiceWithFailure('Cosmos throughput throttle');
    const svc = new VendorOrderService(db);
    await expect(svc.createVendorOrder(makeInput({
      clientOrderId:  'co-fail',
      vendorWorkType: ProductType.AVM,
    }))).rejects.toThrow(/clientOrderId="co-fail".*vendorWorkType="AVM".*Cosmos throughput throttle/);
  });

  it('throws on missing dbService.data even when success=true', async () => {
    // Defensive: API returns success: true but no data. Should not silently
    // produce a degenerate VendorOrder.
    const db = { createOrder: vi.fn().mockResolvedValue({ success: true, data: undefined }) } as any;
    const svc = new VendorOrderService(db);
    await expect(svc.createVendorOrder(makeInput())).rejects.toThrow(/VendorOrderService\.createVendorOrder failed/);
  });
});
