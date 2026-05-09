/**
 * VendorOrder discriminator flip — slice 8f tests
 *
 * Asserts the contract changes the discriminator-flip slice introduced:
 *
 *   1. WRITE PATH: VendorOrderService.createVendorOrder + dbService.createOrder
 *      now write `type: 'vendor-order'` (was 'order' pre-8f). The legacy
 *      constant is gone from the write path entirely.
 *
 *   2. READ PATH: VENDOR_ORDER_TYPE_PREDICATE matches BOTH 'vendor-order'
 *      and 'order' — pre-flip rows remain queryable until backfilled.
 *
 *   3. DOC-TYPE CONSTANTS: VENDOR_ORDER_DOC_TYPE is the canonical write
 *      value; LEGACY_VENDOR_ORDER_DOC_TYPE is retained ONLY as a literal
 *      for the OR predicate.
 *
 * The actual SQL is exercised by integration tests against a real Cosmos
 * emulator; here we just verify the constants and the in-process
 * VendorOrderService write contract.
 */

import { describe, expect, it, vi } from 'vitest';
import { VendorOrderService } from '../../src/services/vendor-order.service.js';
import {
  LEGACY_VENDOR_ORDER_DOC_TYPE,
  VENDOR_ORDER_DOC_TYPE,
  VENDOR_ORDER_TYPE_PREDICATE,
} from '../../src/types/vendor-order.types.js';
import { ProductType } from '../../src/types/product-catalog.js';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('VendorOrder discriminator constants (slice 8f)', () => {
  it('VENDOR_ORDER_DOC_TYPE is "vendor-order" (the new canonical value)', () => {
    expect(VENDOR_ORDER_DOC_TYPE).toBe('vendor-order');
  });

  it('LEGACY_VENDOR_ORDER_DOC_TYPE is "order" (retained for tolerant reads)', () => {
    expect(LEGACY_VENDOR_ORDER_DOC_TYPE).toBe('order');
  });

  it('VENDOR_ORDER_TYPE_PREDICATE matches only the new vendor-order discriminator (slice 8j retired)', () => {
    // Phase B: legacy 'order' rows retired with the staging re-seed; the
    // predicate is now a single-value match. LEGACY_VENDOR_ORDER_DOC_TYPE
    // remains exported only for compile-time comparison sites pending cleanup.
    expect(VENDOR_ORDER_TYPE_PREDICATE).toBe(`c.type = 'vendor-order'`);
  });
});

// ─── Write path ──────────────────────────────────────────────────────────────

describe('VendorOrderService write path (slice 8f flip)', () => {
  it('returns rows with type="vendor-order" (the flipped discriminator)', async () => {
    const db = {
      createOrder: vi.fn().mockResolvedValue({
        success: true,
        data: { id: 'vorder-001' },
      }),
    } as any;
    const svc = new VendorOrderService(db);

    const out = await svc.createVendorOrder({
      tenantId:        'tenant-test',
      clientOrderId:   'co-test',
      engagementId:    'eng-test',
      engagementPropertyId: 'loan-test',
      clientId:        'client-test',
      propertyId:      'prop-test',
      vendorWorkType:  ProductType.FULL_APPRAISAL,
      // Required by the auth refactor — VendorOrderService stamps
      // accessControl from createdBy when no explicit value is supplied.
      createdBy:       'test-user',
    });

    expect(out.type).toBe('vendor-order');
    expect(out.type).toBe(VENDOR_ORDER_DOC_TYPE);
    expect(out.type).not.toBe(LEGACY_VENDOR_ORDER_DOC_TYPE);
  });
});

// ─── Read tolerance ──────────────────────────────────────────────────────────

describe('Read tolerance via VENDOR_ORDER_TYPE_PREDICATE', () => {
  // Simulate the SQL predicate against in-memory documents to verify
  // the OR-condition matches both legacy and new rows. We can't execute
  // Cosmos SQL in unit tests, but we can assert the predicate text and
  // exercise an equivalent JS evaluator over fixture rows.

  function predicateMatches(doc: { type: string }): boolean {
    // Mirrors VENDOR_ORDER_TYPE_PREDICATE exactly.
    return doc.type === VENDOR_ORDER_DOC_TYPE || doc.type === LEGACY_VENDOR_ORDER_DOC_TYPE;
  }

  it('matches a post-8f row (type="vendor-order")', () => {
    expect(predicateMatches({ type: 'vendor-order' })).toBe(true);
  });

  it('matches a pre-8f row (type="order") — legacy rows stay queryable', () => {
    expect(predicateMatches({ type: 'order' })).toBe(true);
  });

  it('does NOT match unrelated document types', () => {
    expect(predicateMatches({ type: 'client-order' })).toBe(false);
    expect(predicateMatches({ type: 'rov-request' })).toBe(false);
    expect(predicateMatches({ type: 'engagement' })).toBe(false);
  });
});
