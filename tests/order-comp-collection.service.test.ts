/**
 * OrderCompCollectionService — unit tests
 *
 * Verifies trigger gating, SKIPPED audit-doc paths (no propertyId, no
 * coordinates, property-not-found), and the happy path (SOLD + ACTIVE
 * candidates persisted to the order-comparables container).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderCompCollectionService } from '../src/services/order-comp-collection.service';
import { ProductType } from '../src/types/product-catalog';
import {
  ORDER_COMPARABLES_CONTAINER,
  type OrderCompCollectionDoc,
} from '../src/types/order-comparables.types';
import { ACTIVE_LISTING_STATUS } from '../src/config/comp-collection-config';
import { EventCategory, type ClientOrderCreatedEvent } from '../src/types/events';
import type { CompSearchParams, CompSearchResult } from '../src/types/attom-data.types';
import { PropertyRecordType } from '../src/types/property-record.types';

// ── helpers ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<ClientOrderCreatedEvent['data']> = {}): ClientOrderCreatedEvent {
  return {
    id: 'evt-1',
    type: 'client-order.created',
    category: EventCategory.ORDER,
    timestamp: new Date(),
    source: 'ClientOrderService',
    version: '1.0',
    data: {
      clientOrderId: 'co-1',
      tenantId: 'tenant-a',
      propertyId: 'prop-1',
      productType: ProductType.BPO,
      placedAt: '2026-04-26T00:00:00.000Z',
      ...overrides,
    },
  };
}

function makePropertyRecord(overrides: Partial<{ latitude: number; longitude: number }> = {}) {
  return {
    id: 'prop-1',
    tenantId: 'tenant-a',
    propertyType: PropertyRecordType.SINGLE_FAMILY,
    address: {
      street: '123 MAIN ST',
      city: 'DALLAS',
      state: 'TX',
      zip: '75225',
      latitude: 32.85,
      longitude: -96.78,
      ...overrides,
    },
    building: { gla: 2000, yearBuilt: 1995, bedrooms: 3, bathrooms: 2 },
  } as any;
}

function makeCompResult(attomId: string, distMeters = 500): CompSearchResult {
  return {
    document: {
      id: attomId,
      type: 'attom-data',
      geohash5: '9vk1q',
      attomId,
      apnFormatted: '',
      ingestedAt: '',
      sourcedAt: '',
      address: {} as any,
      location: { type: 'Point', coordinates: [-96.78, 32.85] } as any,
      propertyDetail: {} as any,
      assessment: {} as any,
      salesHistory: { lastSaleDate: '2025-06-01' } as any,
      mlsData: { listingStatus: 'A' } as any,
      rawData: {},
    },
    distanceMeters: distMeters,
  };
}

function makeMocks() {
  const created: OrderCompCollectionDoc[] = [];
  const cosmos = {
    createDocument: vi.fn(async (container: string, doc: OrderCompCollectionDoc) => {
      if (container !== ORDER_COMPARABLES_CONTAINER) {
        throw new Error(`Unexpected container: ${container}`);
      }
      created.push(doc);
      return doc;
    }),
  } as any;

  const propertyRecords = {
    getById: vi.fn(),
  } as any;

  const compSearch = {
    searchComps: vi.fn(),
  } as any;

  return { cosmos, propertyRecords, compSearch, created };
}

// ── tests ───────────────────────────────────────────────────────────────────

describe('OrderCompCollectionService.runForOrder', () => {
  let m: ReturnType<typeof makeMocks>;
  let svc: OrderCompCollectionService;

  beforeEach(() => {
    m = makeMocks();
    svc = new OrderCompCollectionService(m.cosmos, m.propertyRecords, m.compSearch);
  });

  describe('NOT_TRIGGERED — product type outside trigger set', () => {
    it('returns NOT_TRIGGERED for FULL_APPRAISAL with no Cosmos write', async () => {
      const result = await svc.runForOrder(
        makeEvent({ productType: ProductType.FULL_APPRAISAL }),
      );

      expect(result).toEqual({ status: 'NOT_TRIGGERED', reason: 'PRODUCT_TYPE_NOT_IN_TRIGGER_SET' });
      expect(m.cosmos.createDocument).not.toHaveBeenCalled();
      expect(m.propertyRecords.getById).not.toHaveBeenCalled();
      expect(m.compSearch.searchComps).not.toHaveBeenCalled();
    });
  });

  describe('SKIPPED paths', () => {
    it('writes a SKIPPED doc with NO_PROPERTY_ID when propertyId is missing', async () => {
      const result = await svc.runForOrder(makeEvent({ propertyId: undefined }));

      expect(result.status).toBe('SKIPPED');
      expect((result as any).reason).toBe('NO_PROPERTY_ID');
      expect(m.cosmos.createDocument).toHaveBeenCalledTimes(1);
      const [, doc] = m.cosmos.createDocument.mock.calls[0];
      expect(doc.skipped).toBe(true);
      expect(doc.skipReason).toBe('NO_PROPERTY_ID');
      expect(doc.orderId).toBe('co-1');
      expect(doc.tenantId).toBe('tenant-a');
      expect(doc.soldCandidates).toEqual([]);
      expect(doc.activeCandidates).toEqual([]);
      expect(doc.id).toMatch(/^collection-co-1-.*-skipped$/);
    });

    it('writes a SKIPPED doc with PROPERTY_NOT_FOUND when getById throws', async () => {
      m.propertyRecords.getById.mockRejectedValueOnce(new Error('not found'));

      const result = await svc.runForOrder(makeEvent());

      expect(result.status).toBe('SKIPPED');
      expect((result as any).reason).toBe('PROPERTY_NOT_FOUND');
      const [, doc] = m.cosmos.createDocument.mock.calls[0];
      expect(doc.skipReason).toBe('PROPERTY_NOT_FOUND');
      expect(m.compSearch.searchComps).not.toHaveBeenCalled();
    });

    it('writes a SKIPPED doc with NO_COORDINATES when lat/lng missing', async () => {
      m.propertyRecords.getById.mockResolvedValueOnce(
        makePropertyRecord({ latitude: undefined as any, longitude: undefined as any }),
      );

      const result = await svc.runForOrder(makeEvent());

      expect(result.status).toBe('SKIPPED');
      expect((result as any).reason).toBe('NO_COORDINATES');
      const [, doc] = m.cosmos.createDocument.mock.calls[0];
      expect(doc.skipReason).toBe('NO_COORDINATES');
      expect(m.compSearch.searchComps).not.toHaveBeenCalled();
    });
  });

  describe('COLLECTED — happy path', () => {
    beforeEach(() => {
      m.propertyRecords.getById.mockResolvedValue(makePropertyRecord());
    });

    it('queries SOLD and ACTIVE separately, writes one doc with both arrays', async () => {
      m.compSearch.searchComps
        .mockResolvedValueOnce([makeCompResult('a-1'), makeCompResult('a-2', 800)]) // SOLD
        .mockResolvedValueOnce([makeCompResult('a-3', 1200)]); // ACTIVE

      const result = await svc.runForOrder(makeEvent({ productType: ProductType.BPO }));

      expect(result.status).toBe('COLLECTED');
      expect((result as any).soldCount).toBe(2);
      expect((result as any).activeCount).toBe(1);

      // Two searchComps calls — first SOLD (with minSaleDate), second ACTIVE (with listingStatus).
      expect(m.compSearch.searchComps).toHaveBeenCalledTimes(2);
      const soldCall = m.compSearch.searchComps.mock.calls[0][0] as CompSearchParams;
      const activeCall = m.compSearch.searchComps.mock.calls[1][0] as CompSearchParams;

      expect(soldCall.minSaleDate).toBeDefined();
      expect(soldCall.listingStatus).toBeUndefined();

      expect(activeCall.listingStatus).toBe(ACTIVE_LISTING_STATUS);
      expect(activeCall.minSaleDate).toBeUndefined();

      // Same lat/lng/radius for both queries.
      expect(soldCall.latitude).toBe(32.85);
      expect(soldCall.longitude).toBe(-96.78);
      expect(activeCall.latitude).toBe(32.85);
      expect(activeCall.longitude).toBe(-96.78);
      expect(soldCall.radiusMeters).toBeGreaterThan(0);

      // One doc written.
      expect(m.cosmos.createDocument).toHaveBeenCalledTimes(1);
      const [container, doc] = m.cosmos.createDocument.mock.calls[0];
      expect(container).toBe(ORDER_COMPARABLES_CONTAINER);
      expect(doc.stage).toBe('COLLECTION');
      expect(doc.skipped).toBeUndefined();
      expect(doc.orderId).toBe('co-1');
      expect(doc.tenantId).toBe('tenant-a');
      expect(doc.propertyId).toBe('prop-1');
      expect(doc.productType).toBe(ProductType.BPO);
      expect(doc.subjectLatitude).toBe(32.85);
      expect(doc.subjectLongitude).toBe(-96.78);
      expect(doc.subjectGeohash5).toMatch(/^[0-9a-z]{5}$/);
      expect(doc.soldCandidates).toHaveLength(2);
      expect(doc.activeCandidates).toHaveLength(1);
      expect(doc.soldCandidates[0]!.source).toBe('SOLD');
      expect(doc.soldCandidates[0]!.attomId).toBe('a-1');
      expect(doc.activeCandidates[0]!.source).toBe('ACTIVE');
      expect(doc.activeCandidates[0]!.attomId).toBe('a-3');
      expect(doc.soldCandidates[0]!.distanceMiles).toBeCloseTo(500 / 1609.344, 3);
      expect(doc.id).toMatch(/^collection-co-1-/);
    });

    it('uses the per-product config for DESKTOP_APPRAISAL (tighter radius/counts)', async () => {
      m.compSearch.searchComps.mockResolvedValue([]);

      await svc.runForOrder(makeEvent({ productType: ProductType.DESKTOP_APPRAISAL }));

      const soldCall = m.compSearch.searchComps.mock.calls[0][0] as CompSearchParams;
      // Default desktop config in comp-collection-config.ts: radius 0.5mi, soldCount 6.
      expect(soldCall.maxResults).toBe(6);
      expect(soldCall.radiusMeters).toBeCloseTo(0.5 * 1609.344, 1);
    });

    it('throws (not catches) when the cosmos write fails', async () => {
      m.compSearch.searchComps.mockResolvedValue([]);
      m.cosmos.createDocument.mockRejectedValueOnce(new Error('cosmos down'));

      await expect(svc.runForOrder(makeEvent())).rejects.toThrow(/cosmos down/);
    });
  });
});
