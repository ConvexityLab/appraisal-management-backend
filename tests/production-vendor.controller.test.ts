import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type NextFunction, type Response } from 'express';
import request from 'supertest';

import { VendorController } from '../src/controllers/production-vendor.controller.js';
import type { AuthorizationMiddleware } from '../src/middleware/authorization.middleware.js';

function makeVendor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vendor-1',
    tenantId: 'tenant-a',
    name: 'Alpha Appraisals',
    email: 'alpha@example.com',
    phone: '5555555555',
    status: 'ACTIVE',
    onboardingDate: '2026-01-01T00:00:00.000Z',
    lastActive: '2026-01-02T00:00:00.000Z',
    serviceAreas: [],
    productTypes: [],
    performance: {
      totalOrders: 12,
      qualityScore: 4.5,
      averageTurnTime: 96,
      onTimeDeliveryRate: 0.92,
      revisionRate: 0.05,
      clientSatisfactionScore: 4.6,
    },
    ...overrides,
  };
}

function makeMockDb() {
  return {
    findAllVendors: vi.fn(async () => ({ success: true, data: [makeVendor()] })),
    searchVendors: vi.fn(async () => ({ success: true, data: [makeVendor()] })),
    findVendorById: vi.fn(async (id: string) => ({
      success: true,
      data: id === 'missing' ? null : makeVendor({ id }),
    })),
    createVendor: vi.fn(async (payload: any) => ({ success: true, data: makeVendor({ id: 'vendor-new', ...payload }) })),
    updateVendor: vi.fn(async (id: string, updates: any) => ({ success: true, data: makeVendor({ id, ...updates }) })),
    getVendorPerformance: vi.fn(async (id: string) => ({ success: true, data: { vendorId: id, score: 98 } })),
    findOrderById: vi.fn(async (id: string) => ({ success: true, data: { id } })),
    updateOrder: vi.fn(async (_id: string, _updates: any) => ({ success: true, data: {} })),
  } as any;
}

function makeAuthzStub(overrides?: {
  authorize?: (resourceType?: string, action?: string) => any;
  authorizeQuery?: () => any;
  authorizeResource?: (resourceType?: string, action?: string, options?: any) => any;
}) {
  return {
    loadUserProfile: () => async (req: any, _res: Response, next: NextFunction) => {
      req.userProfile = {
        id: req.user.id,
        email: req.user.email,
        role: 'manager',
        tenantId: req.user.tenantId,
      };
      next();
    },
    authorize:
      overrides?.authorize ??
      (() => async (_req: any, _res: Response, next: NextFunction) => {
        next();
      }),
    authorizeQuery:
      overrides?.authorizeQuery ??
      (() => async (req: any, _res: Response, next: NextFunction) => {
        req.authorizationFilter = {
          sql: 'c.id = @vendorId',
          parameters: [{ name: '@vendorId', value: 'vendor-1' }],
        };
        next();
      }),
    authorizeResource:
      overrides?.authorizeResource ??
      (() => async (_req: any, _res: Response, next: NextFunction) => {
        next();
      }),
  } satisfies Partial<AuthorizationMiddleware>;
}

function makeApp(db: any, authzMiddleware?: Partial<AuthorizationMiddleware>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'u@example.com',
      name: 'User One',
    };
    next();
  });

  const controller = new VendorController(db, authzMiddleware as AuthorizationMiddleware | undefined);
  app.use('/api/vendors', controller.router);
  return app;
}

describe('VendorController authorization', () => {
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    db = makeMockDb();
  });

  it('passes authorizationFilter into vendor list queries', async () => {
    const app = makeApp(db, makeAuthzStub());

    const res = await request(app).get('/api/vendors');

    expect(res.status).toBe(200);
    expect(db.findAllVendors).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationFilter: expect.objectContaining({ sql: 'c.id = @vendorId' }),
      }),
    );
  });

  it('passes authorizationFilter into vendor search queries', async () => {
    const app = makeApp(db, makeAuthzStub());

    const res = await request(app).get('/api/vendors').query({ q: 'alpha' });

    expect(res.status).toBe(200);
    expect(db.searchVendors).toHaveBeenCalledWith(
      'alpha',
      50,
      expect.objectContaining({
        authorizationFilter: expect.objectContaining({ sql: 'c.id = @vendorId' }),
      }),
    );
  });

  it('blocks vendor detail reads when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(db, authz);

    const res = await request(app).get('/api/vendors/vendor-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(db.findVendorById).not.toHaveBeenCalled();
  });

  it('blocks vendor updates when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(db, authz);

    const res = await request(app)
      .put('/api/vendors/vendor-1')
      .send({ email: 'new@example.com' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(db.updateVendor).not.toHaveBeenCalled();
  });

  it('blocks vendor assignment when parent order authorization denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(db, authz);

    const res = await request(app)
      .post('/api/vendors/assign/order-1')
      .send({ vendorId: 'vendor-1' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(db.findOrderById).not.toHaveBeenCalled();
    expect(db.updateOrder).not.toHaveBeenCalled();
  });

  it('blocks vendor performance when analytics capability denies access', async () => {
    const authz = makeAuthzStub({
      authorize: (resourceType?: string) => async (_req: any, res: Response, next: NextFunction) => {
        if (resourceType === 'analytics') {
          res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
          return;
        }
        next();
      },
    });
    const app = makeApp(db, authz);

    const res = await request(app).get('/api/vendors/performance/vendor-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(db.getVendorPerformance).not.toHaveBeenCalled();
  });

  it('blocks vendor performance when vendor resource authorization denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: (resourceType?: string) => async (_req: any, res: Response, next: NextFunction) => {
        if (resourceType === 'vendor') {
          res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
          return;
        }
        next();
      },
    });
    const app = makeApp(db, authz);

    const res = await request(app).get('/api/vendors/performance/vendor-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(db.getVendorPerformance).not.toHaveBeenCalled();
  });
});
