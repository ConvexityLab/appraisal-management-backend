/**
 * Tests for Duplicate Order Detection Service (Phase 1.12)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DuplicateOrderDetectionService,
  normalizeAddress,
  normalizeName,
} from '../src/services/duplicate-order-detection.service';
import type { DuplicateCheckRequest } from '../src/services/duplicate-order-detection.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'order-100',
    orderNumber: overrides.orderNumber ?? 'ORD-100',
    type: 'order',
    tenantId: overrides.tenantId ?? 'tenant-1',
    status: overrides.status ?? 'NEW',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    propertyAddress: overrides.propertyAddress ?? {
      streetAddress: '123 Main Street',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    },
    borrowerInformation: overrides.borrowerInformation ?? {
      firstName: 'John',
      lastName: 'Smith',
    },
    ...overrides,
  };
}

function makeMockDbService(orders: any[] = []) {
  return {
    ordersContainer: {
      items: {
        query: vi.fn().mockReturnValue({
          fetchAll: vi.fn().mockResolvedValue({ resources: orders }),
        }),
      },
    },
  } as any;
}

// ── Unit: normalizeAddress ───────────────────────────────────────────────────

describe('normalizeAddress', () => {
  it('lowercases and trims', () => {
    expect(normalizeAddress('  123 MAIN ST  ')).toBe('123 main st');
  });

  it('normalizes common abbreviations', () => {
    expect(normalizeAddress('123 Main Street')).toBe('123 main st');
    expect(normalizeAddress('456 Oak Avenue')).toBe('456 oak ave');
    expect(normalizeAddress('789 Pine Boulevard')).toBe('789 pine blvd');
  });

  it('strips punctuation', () => {
    expect(normalizeAddress('123 Main St., Apt. #4')).toBe('123 main st apt 4');
  });

  it('collapses whitespace', () => {
    expect(normalizeAddress('123   Main    St')).toBe('123 main st');
  });

  it('normalizes directionals', () => {
    expect(normalizeAddress('100 North Main Street')).toBe('100 n main st');
    expect(normalizeAddress('200 Southwest Park Drive')).toBe('200 sw park dr');
  });
});

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  JOHN  SMITH  ')).toBe('john smith');
  });
});

// ── Integration: DuplicateOrderDetectionService ──────────────────────────────

describe('DuplicateOrderDetectionService', () => {
  let service: DuplicateOrderDetectionService;

  const baseRequest: DuplicateCheckRequest = {
    propertyAddress: '123 Main Street',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    borrowerFirstName: 'Jane',
    borrowerLastName: 'Doe',
    tenantId: 'tenant-1',
  };

  describe('checkForDuplicates', () => {
    it('returns no duplicates when no orders match', async () => {
      const db = makeMockDbService([]);
      service = new DuplicateOrderDetectionService(db);

      const result = await service.checkForDuplicates(baseRequest);
      expect(result.hasPotentialDuplicates).toBe(false);
      expect(result.matches).toHaveLength(0);
      expect(result.checkedAt).toBeTruthy();
    });

    it('detects exact address match', async () => {
      const existing = makeOrder({
        id: 'order-999',
        orderNumber: 'ORD-999',
        propertyAddress: { streetAddress: '123 Main Street', city: 'Austin', state: 'TX', zipCode: '78701' },
        borrowerInformation: { firstName: 'Bob', lastName: 'Jones' },
      });
      const db = makeMockDbService([existing]);
      service = new DuplicateOrderDetectionService(db);

      const result = await service.checkForDuplicates(baseRequest);
      expect(result.hasPotentialDuplicates).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matchType).toBe('ADDRESS');
      expect(result.matches[0].matchScore).toBe(75);
      expect(result.matches[0].orderId).toBe('order-999');
    });

    it('detects address + borrower match with higher score', async () => {
      const existing = makeOrder({
        id: 'order-888',
        orderNumber: 'ORD-888',
        propertyAddress: { streetAddress: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701' },
        borrowerInformation: { firstName: 'Jane', lastName: 'Doe' },
      });
      const db = makeMockDbService([existing]);
      service = new DuplicateOrderDetectionService(db);

      const result = await service.checkForDuplicates(baseRequest);
      expect(result.hasPotentialDuplicates).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matchType).toBe('ADDRESS_AND_BORROWER');
      expect(result.matches[0].matchScore).toBe(95);
    });

    it('does not match different address', async () => {
      const existing = makeOrder({
        propertyAddress: { streetAddress: '999 Elm Road', city: 'Austin', state: 'TX', zipCode: '78701' },
      });
      const db = makeMockDbService([existing]);
      service = new DuplicateOrderDetectionService(db);

      const result = await service.checkForDuplicates(baseRequest);
      expect(result.hasPotentialDuplicates).toBe(false);
    });

    it('handles case-insensitive and abbreviation-tolerant matching', async () => {
      const existing = makeOrder({
        propertyAddress: { streetAddress: '123 MAIN ST', city: 'Austin', state: 'TX', zipCode: '78701' },
      });
      const db = makeMockDbService([existing]);
      service = new DuplicateOrderDetectionService(db);

      const result = await service.checkForDuplicates(baseRequest);
      expect(result.hasPotentialDuplicates).toBe(true);
    });

    it('excludes specified order ID', async () => {
      const existing = makeOrder({ id: 'order-to-exclude' });
      const db = makeMockDbService([existing]);
      service = new DuplicateOrderDetectionService(db);

      const result = await service.checkForDuplicates({
        ...baseRequest,
        excludeOrderId: 'order-to-exclude',
      });
      expect(result.hasPotentialDuplicates).toBe(false);
    });

    it('returns multiple matches sorted by score', async () => {
      const addressOnly = makeOrder({
        id: 'order-addr',
        orderNumber: 'ORD-ADDR',
        propertyAddress: { streetAddress: '123 Main Street', city: 'Austin', state: 'TX', zipCode: '78701' },
        borrowerInformation: { firstName: 'Bob', lastName: 'Other' },
      });
      const addressAndBorrower = makeOrder({
        id: 'order-both',
        orderNumber: 'ORD-BOTH',
        propertyAddress: { streetAddress: '123 Main St.', city: 'Austin', state: 'TX', zipCode: '78701' },
        borrowerInformation: { firstName: 'Jane', lastName: 'Doe' },
      });
      const db = makeMockDbService([addressOnly, addressAndBorrower]);
      service = new DuplicateOrderDetectionService(db);

      const result = await service.checkForDuplicates(baseRequest);
      expect(result.matches).toHaveLength(2);
      // ADDRESS_AND_BORROWER (95) should come first
      expect(result.matches[0].matchScore).toBe(95);
      expect(result.matches[1].matchScore).toBe(75);
    });

    it('returns empty results when no address provided', async () => {
      const db = makeMockDbService([]);
      service = new DuplicateOrderDetectionService(db);

      const result = await service.checkForDuplicates({
        ...baseRequest,
        propertyAddress: '',
      });
      expect(result.hasPotentialDuplicates).toBe(false);
      expect(result.matches).toHaveLength(0);
    });

    it('does not throw on DB error (advisory only)', async () => {
      const db = {
        ordersContainer: {
          items: {
            query: vi.fn().mockReturnValue({
              fetchAll: vi.fn().mockRejectedValue(new Error('Cosmos error')),
            }),
          },
        },
      } as any;
      service = new DuplicateOrderDetectionService(db);

      const result = await service.checkForDuplicates(baseRequest);
      expect(result.hasPotentialDuplicates).toBe(false);
      expect(result.matches).toHaveLength(0);
    });
  });
});
