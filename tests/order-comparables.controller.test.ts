/**
 * Tests for OrderComparablesController — read-only API exposing the
 * `order-comparables` Cosmos container to the UI.
 *
 * Two mount points share one controller class:
 *   GET /api/orders/:orderId/comparables                  (orderId === clientOrderId)
 *   GET /api/vendor-orders/:vendorOrderId/comparables     (resolves clientOrderId from VO doc)
 *
 * Both return the same shape:
 *   {
 *     clientOrderId,
 *     vendorOrderId?,        // only when fetched via vendor-order
 *     latestCollection,      // OrderCompCollectionDoc | null
 *     latestRanking,         // raw RANKING doc | null
 *     candidates,            // CollectedCompCandidate[] flattened from latest stage
 *   }
 *
 * `candidates` prefers RANKING when present, otherwise sold+active from
 * COLLECTION. The controller does NOT invent data: empty container → empty
 * candidates with nulls for both stage fields.
 */
import { describe, it, expect, vi } from 'vitest';
import express, { type Response, type NextFunction } from 'express';
import request from 'supertest';

import { OrderComparablesController } from '../src/controllers/order-comparables.controller';
import {
  ORDER_COMPARABLES_CONTAINER,
  type OrderCompCollectionDoc,
  type CollectedCompCandidate,
} from '../src/types/order-comparables.types';
import {
  VENDOR_ORDERS_CONTAINER,
  VENDOR_ORDER_DOC_TYPE,
  LEGACY_VENDOR_ORDER_DOC_TYPE,
} from '../src/types/vendor-order.types';
import type { AuthorizationMiddleware } from '../src/middleware/authorization.middleware';

interface AnyDoc {
  id: string;
  tenantId: string;
  [k: string]: unknown;
}

function makeMockDb(stores: {
  comparables?: AnyDoc[];
  vendorOrders?: AnyDoc[];
  propertyRecords?: AnyDoc[];
}) {
  const comparables = new Map<string, AnyDoc>();
  (stores.comparables ?? []).forEach((d) => comparables.set(d.id, d));
  const vendorOrders = new Map<string, AnyDoc>();
  (stores.vendorOrders ?? []).forEach((d) => vendorOrders.set(d.id, d));
  const propertyRecords = new Map<string, AnyDoc>();
  (stores.propertyRecords ?? []).forEach((d) => propertyRecords.set(d.id, d));

  function compsContainer() {
    return {
      items: {
        query: vi.fn(
          (spec: { query: string; parameters: Array<{ name: string; value: unknown }> }) => {
            const params = Object.fromEntries(spec.parameters.map((p) => [p.name, p.value]));
            return {
              fetchAll: async () => {
                const matches = Array.from(comparables.values()).filter((doc) => {
                  if (params['@orderId'] !== undefined && doc.orderId !== params['@orderId'])
                    return false;
                  if (params['@tenantId'] !== undefined && doc.tenantId !== params['@tenantId'])
                    return false;
                  return true;
                });
                // Mimic Cosmos ORDER BY c.createdAt DESC
                matches.sort((a, b) =>
                  String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
                );
                return { resources: matches };
              },
            };
          }
        ),
      },
    };
  }

  function vosContainer() {
    return {
      item: vi.fn((id: string, _pk: string) => ({
        read: vi.fn(async () => ({
          resource: vendorOrders.get(id) ?? undefined,
        })),
      })),
    };
  }

  const db = {
    getContainer: vi.fn((name: string) => {
      if (name === ORDER_COMPARABLES_CONTAINER) return compsContainer();
      if (name === VENDOR_ORDERS_CONTAINER) return vosContainer();
      if (name === 'property-records') {
        return {
          item: vi.fn((id: string, _pk: string) => ({
            read: vi.fn(async () => ({ resource: propertyRecords.get(id) ?? undefined })),
          })),
        };
      }
      throw new Error(`Unexpected container request: ${name}`);
    }),
  };
  return { db };
}

function makeApp(db: unknown, authzMiddleware?: Partial<AuthorizationMiddleware>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'u@example.com',
      name: 'U',
    };
    next();
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctrl = new OrderComparablesController(db as any, authzMiddleware as AuthorizationMiddleware | undefined);
  app.use('/api/orders/:orderId/comparables', ctrl.routerByClientOrder);
  app.use('/api/vendor-orders/:vendorOrderId/comparables', ctrl.routerByVendorOrder);
  return app;
}

function makeAuthzStub(overrides?: {
  authorizeResource?: (resourceType: string, action: string, options?: any) => any;
}) {
  return {
    loadUserProfile: () => (req: any, _res: Response, next: NextFunction) => {
      req.userProfile = {
        id: req.user.id,
        email: req.user.email,
        role: 'manager',
        tenantId: req.user.tenantId,
      };
      next();
    },
    authorizeResource:
      overrides?.authorizeResource ??
      (() => (_req: any, _res: Response, next: NextFunction) => next()),
  } satisfies Partial<AuthorizationMiddleware>;
}

function makeCandidate(vendorRef: string): CollectedCompCandidate {
  return {
    source: 'SOLD',
    distanceMiles: 0.4,
    geohash5: 'dr5r9',
    propertyRecord: { id: `prop-${vendorRef}`, dataSourceRecordId: vendorRef } as any,
    dataCompleteness: { score: 1, missingRequiredFields: [] } as any,
    lastSalePrice: null,
    lastSaleDate: null,
  };
}

function makeCollectionDoc(
  overrides: Partial<OrderCompCollectionDoc> & { id: string; orderId: string; createdAt: string }
): OrderCompCollectionDoc {
  return {
    id: overrides.id,
    stage: 'COLLECTION',
    orderId: overrides.orderId,
    tenantId: 'tenant-a',
    propertyId: 'prop-subject',
    productType: 'DVR',
    subjectLatitude: 40,
    subjectLongitude: -73,
    subjectGeohash5: 'dr5r9',
    geohash5CellsQueried: ['dr5r9'],
    soldCandidates: [],
    activeCandidates: [],
    config: {} as any,
    createdAt: overrides.createdAt,
    ...overrides,
  };
}

describe('GET /api/orders/:orderId/comparables', () => {
  it('returns 401 when caller is unauthenticated', async () => {
    const { db } = makeMockDb({});
    // app without auth-injecting middleware
    const app = express();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctrl = new OrderComparablesController(db as any);
    app.use('/api/orders/:orderId/comparables', ctrl.routerByClientOrder);
    const res = await request(app).get('/api/orders/co-1/comparables');
    expect(res.status).toBe(401);
  });

  it('returns empty payload when no docs exist for the order', async () => {
    const { db } = makeMockDb({ comparables: [] });
    const app = makeApp(db);
    const res = await request(app).get('/api/orders/co-1/comparables');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      clientOrderId: 'co-1',
      latestCollection: null,
      latestRanking: null,
      latestSelection: null,
      candidates: [],
    });
  });

  it('returns the latest COLLECTION doc and flattens sold+active into candidates', async () => {
    const older = makeCollectionDoc({
      id: 'collection-co-1-2026-04-01T00:00:00Z',
      orderId: 'co-1',
      createdAt: '2026-04-01T00:00:00Z',
      soldCandidates: [makeCandidate('old-sold')],
    });
    const newer = makeCollectionDoc({
      id: 'collection-co-1-2026-04-20T00:00:00Z',
      orderId: 'co-1',
      createdAt: '2026-04-20T00:00:00Z',
      soldCandidates: [makeCandidate('s1'), makeCandidate('s2')],
      activeCandidates: [{ ...makeCandidate('a1'), source: 'ACTIVE' }],
    });
    const { db } = makeMockDb({ comparables: [older, newer] });
    const app = makeApp(db);
    const res = await request(app).get('/api/orders/co-1/comparables');
    expect(res.status).toBe(200);
    expect(res.body.clientOrderId).toBe('co-1');
    expect(res.body.latestCollection.id).toBe(newer.id);
    expect(res.body.latestRanking).toBeNull();
    expect(
      res.body.candidates.map((c: CollectedCompCandidate) => c.propertyRecord.dataSourceRecordId),
    ).toEqual(['s1', 's2', 'a1']);
  });

  it('prefers RANKING candidates over COLLECTION when both exist', async () => {
    const collection = makeCollectionDoc({
      id: 'collection-co-1-2026-04-20T00:00:00Z',
      orderId: 'co-1',
      createdAt: '2026-04-20T00:00:00Z',
      soldCandidates: [makeCandidate('s1')],
    });
    const ranking: AnyDoc = {
      id: 'ranking-co-1-2026-04-21T00:00:00Z',
      stage: 'RANKING',
      orderId: 'co-1',
      tenantId: 'tenant-a',
      createdAt: '2026-04-21T00:00:00Z',
      candidates: [makeCandidate('r1'), makeCandidate('r2')],
    };
    const { db } = makeMockDb({ comparables: [collection, ranking] });
    const app = makeApp(db);
    const res = await request(app).get('/api/orders/co-1/comparables');
    expect(res.status).toBe(200);
    expect(res.body.latestCollection.id).toBe(collection.id);
    expect(res.body.latestRanking.id).toBe(ranking.id);
    expect(
      res.body.candidates.map((c: CollectedCompCandidate) => c.propertyRecord.dataSourceRecordId),
    ).toEqual(['r1', 'r2']);
  });

  it('does not return docs for other tenants', async () => {
    const otherTenant = makeCollectionDoc({
      id: 'collection-co-1-2026-04-20T00:00:00Z',
      orderId: 'co-1',
      createdAt: '2026-04-20T00:00:00Z',
      tenantId: 'tenant-b',
      soldCandidates: [makeCandidate('leak')],
    });
    const { db } = makeMockDb({ comparables: [otherTenant] });
    const app = makeApp(db);
    const res = await request(app).get('/api/orders/co-1/comparables');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toEqual([]);
    expect(res.body.latestCollection).toBeNull();
  });

  it('skips a SKIPPED collection doc and returns empty candidates', async () => {
    const skipped = makeCollectionDoc({
      id: 'collection-co-1-2026-04-20T00:00:00Z-skipped',
      orderId: 'co-1',
      createdAt: '2026-04-20T00:00:00Z',
      skipped: true,
      skipReason: 'NO_COORDINATES',
    });
    const { db } = makeMockDb({ comparables: [skipped] });
    const app = makeApp(db);
    const res = await request(app).get('/api/orders/co-1/comparables');
    expect(res.status).toBe(200);
    // skipped doc IS the latest collection; we still expose it so the UI can
    // show "collection skipped: NO_COORDINATES" instead of a misleading "no data".
    expect(res.body.latestCollection.skipped).toBe(true);
    expect(res.body.candidates).toEqual([]);
  });
});

describe('GET /api/vendor-orders/:vendorOrderId/comparables', () => {
  it('resolves clientOrderId from the vendor-order and returns its comparables', async () => {
    const collection = makeCollectionDoc({
      id: 'collection-co-1-2026-04-20T00:00:00Z',
      orderId: 'co-1',
      createdAt: '2026-04-20T00:00:00Z',
      soldCandidates: [makeCandidate('s1')],
    });
    const { db } = makeMockDb({
      comparables: [collection],
      vendorOrders: [
        {
          id: 'vo-1',
          tenantId: 'tenant-a',
          type: VENDOR_ORDER_DOC_TYPE,
          clientOrderId: 'co-1',
        },
      ],
    });
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/vo-1/comparables');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      clientOrderId: 'co-1',
      vendorOrderId: 'vo-1',
    });
    expect(
      res.body.candidates.map((c: CollectedCompCandidate) => c.propertyRecord.dataSourceRecordId),
    ).toEqual(['s1']);
  });

  it('also accepts legacy "order" discriminator on the vendor-order doc', async () => {
    const collection = makeCollectionDoc({
      id: 'collection-co-2-2026-04-20T00:00:00Z',
      orderId: 'co-2',
      createdAt: '2026-04-20T00:00:00Z',
    });
    const { db } = makeMockDb({
      comparables: [collection],
      vendorOrders: [
        {
          id: 'vo-2',
          tenantId: 'tenant-a',
          type: LEGACY_VENDOR_ORDER_DOC_TYPE,
          clientOrderId: 'co-2',
        },
      ],
    });
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/vo-2/comparables');
    expect(res.status).toBe(200);
    expect(res.body.clientOrderId).toBe('co-2');
  });

  it('returns 404 when the vendor order does not exist', async () => {
    const { db } = makeMockDb({ comparables: [], vendorOrders: [] });
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/missing/comparables');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns 404 when the doc is not a vendor-order discriminator', async () => {
    const { db } = makeMockDb({
      comparables: [],
      vendorOrders: [
        { id: 'weird', tenantId: 'tenant-a', type: 'something-else', clientOrderId: 'co-1' },
      ],
    });
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/weird/comparables');
    expect(res.status).toBe(404);
  });

  it('returns 400 when the vendor order is missing clientOrderId', async () => {
    const { db } = makeMockDb({
      comparables: [],
      vendorOrders: [
        { id: 'vo-broken', tenantId: 'tenant-a', type: VENDOR_ORDER_DOC_TYPE },
      ],
    });
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/vo-broken/comparables');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VENDOR_ORDER_MISSING_CLIENT_ORDER_ID');
  });

  it('passes through subject.photos from the property-records doc', async () => {
    const collection = makeCollectionDoc({
      id: 'collection-co-3-2026-04-20T00:00:00Z',
      orderId: 'co-3',
      createdAt: '2026-04-20T00:00:00Z',
    });
    const photos = [
      { url: 'https://photos.example.com/k/1.jpg', source: 'vendor', type: null },
      { url: 'https://photos.example.com/k/2.jpg', source: 'vendor', type: null },
    ];
    const { db } = makeMockDb({
      comparables: [collection],
      vendorOrders: [
        {
          id: 'vo-3',
          tenantId: 'tenant-a',
          type: VENDOR_ORDER_DOC_TYPE,
          clientOrderId: 'co-3',
          propertyId: 'prop-3',
        },
      ],
      propertyRecords: [
        {
          id: 'prop-3',
          tenantId: 'tenant-a',
          propertyType: 'SFR',
          address: { street: '1 Main', city: 'X', state: 'CA', zip: '90001', county: 'LA',
            latitude: 34, longitude: -118 },
          building: { gla: 1500, yearBuilt: 1990, bedrooms: 3, bathrooms: 2 },
          photos,
        },
      ],
    });
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/vo-3/comparables');
    expect(res.status).toBe(200);
    expect(res.body.subject).toBeDefined();
    expect(res.body.subject.photos).toEqual(photos);
  });

  it('omits subject.photos when the property-records doc has no photos', async () => {
    const collection = makeCollectionDoc({
      id: 'collection-co-4-2026-04-20T00:00:00Z',
      orderId: 'co-4',
      createdAt: '2026-04-20T00:00:00Z',
    });
    const { db } = makeMockDb({
      comparables: [collection],
      vendorOrders: [
        {
          id: 'vo-4',
          tenantId: 'tenant-a',
          type: VENDOR_ORDER_DOC_TYPE,
          clientOrderId: 'co-4',
          propertyId: 'prop-4',
        },
      ],
      propertyRecords: [
        {
          id: 'prop-4',
          tenantId: 'tenant-a',
          propertyType: 'SFR',
          address: { street: '2 Main', city: 'X', state: 'CA', zip: '90001', county: 'LA',
            latitude: 34, longitude: -118 },
          building: { gla: 1500, yearBuilt: 1990, bedrooms: 3, bathrooms: 2 },
        },
      ],
    });
    const app = makeApp(db);
    const res = await request(app).get('/api/vendor-orders/vo-4/comparables');
    expect(res.status).toBe(200);
    expect(res.body.subject).toBeDefined();
    expect(res.body.subject).not.toHaveProperty('photos');
  });

  it('blocks vendor-order comparable reads when authorizeResource denies access', async () => {
    const { db } = makeMockDb({ comparables: [], vendorOrders: [] });
    const authz = makeAuthzStub({
      authorizeResource: () => (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(db, authz);

    const res = await request(app).get('/api/vendor-orders/vo-9/comparables');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
  });
});
