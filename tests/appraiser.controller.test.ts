import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type NextFunction, type Response } from 'express';
import request from 'supertest';

import { AppraiserController } from '../src/controllers/appraiser.controller.js';
import type { AuthorizationMiddleware } from '../src/middleware/authorization.middleware.js';

function makeAppraiser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appraiser-1',
    tenantId: 'tenant-a',
    type: 'appraiser',
    name: 'Alex Appraiser',
    status: 'active',
    availability: 'available',
    currentWorkload: 1,
    maxCapacity: 5,
    specialties: ['residential'],
    licenses: [
      {
        licenseNumber: 'LIC-1',
        state: 'TX',
        status: 'active',
        expirationDate: '2099-12-31T00:00:00.000Z',
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockCosmos() {
  const query = vi.fn((querySpec: { query: string; parameters: Array<{ name: string; value: unknown }> }) => ({
    fetchAll: async () => ({
      resources: [makeAppraiser()],
    }),
  }));
  const read = vi.fn(async (id?: string) => {
    if (id === 'assignment-1') {
      return {
        resource: {
          id: 'assignment-1',
          type: 'appraiser_assignment',
          tenantId: 'tenant-a',
          orderId: 'order-1',
          appraiserId: 'appraiser-1',
          status: 'pending',
          propertyAddress: '123 Main St',
          orderNumber: 'ORD-1',
          assignedAt: '2026-01-01T00:00:00.000Z',
          assignedBy: 'user-2',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      };
    }

    if (id === 'order-1') {
      return { resource: { id: 'order-1', tenantId: 'tenant-a' } };
    }

    return { resource: null };
  });
  const replace = vi.fn(async (doc: any) => ({ resource: doc }));
  const item = vi.fn((id?: string) => ({ read: () => read(id), replace }));
  const container = {
    items: {
      query,
      create: vi.fn(async (doc: any) => ({ resource: doc })),
    },
    item,
  };

  return {
    cosmos: {
      getContainer: vi.fn(() => container),
    } as any,
    container,
    query,
    item,
    read,
    replace,
  };
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
          sql: 'c.id = @appraiserId',
          parameters: [{ name: '@appraiserId', value: 'appraiser-1' }],
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

function makeApp(cosmos: any, authzMiddleware?: Partial<AuthorizationMiddleware>) {
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

  const controller = new AppraiserController(cosmos, authzMiddleware as AuthorizationMiddleware | undefined);
  app.use('/api/appraisers', controller.router);
  return app;
}

describe('AppraiserController authorization', () => {
  let mock: ReturnType<typeof makeMockCosmos>;

  beforeEach(() => {
    mock = makeMockCosmos();
  });

  it('passes authorizationFilter into appraiser list queries', async () => {
    const app = makeApp(mock.cosmos, makeAuthzStub());

    const res = await request(app).get('/api/appraisers');

    expect(res.status).toBe(200);
    const querySpec = mock.query.mock.calls[0]?.[0];
    expect(querySpec.query).toContain('AND (c.id = @appraiserId)');
    expect(querySpec.parameters).toEqual(
      expect.arrayContaining([{ name: '@appraiserId', value: 'appraiser-1' }]),
    );
  });

  it('passes authorizationFilter into available appraiser queries', async () => {
    const app = makeApp(mock.cosmos, makeAuthzStub());

    const res = await request(app).get('/api/appraisers/available').query({ specialty: 'residential' });

    expect(res.status).toBe(200);
    const querySpec = mock.query.mock.calls[0]?.[0];
    expect(querySpec.query).toContain('AND (c.id = @appraiserId)');
    expect(res.body.count).toBe(1);
  });

  it('blocks appraiser detail reads when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(mock.cosmos, authz);

    const res = await request(app).get('/api/appraisers/appraiser-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mock.query).not.toHaveBeenCalled();
  });

  it('blocks appraiser updates when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(mock.cosmos, authz);

    const res = await request(app)
      .put('/api/appraisers/appraiser-1')
      .send({ phone: '5555551212' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mock.replace).not.toHaveBeenCalled();
  });

  it('blocks appraiser assignment when parent order authorization denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: (resourceType?: string) => async (_req: any, res: Response, next: NextFunction) => {
        if (resourceType === 'order') {
          res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
          return;
        }
        next();
      },
    });
    const app = makeApp(mock.cosmos, authz);

    const res = await request(app)
      .post('/api/appraisers/appraiser-1/assign')
      .send({ orderId: 'order-1', propertyAddress: '123 Main St' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mock.read).not.toHaveBeenCalled();
    expect(mock.replace).not.toHaveBeenCalled();
  });

  it('blocks pending assignment reads when appraiser resource authorization denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(mock.cosmos, authz);

    const res = await request(app).get('/api/appraisers/appraiser-1/assignments/pending');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mock.query).not.toHaveBeenCalled();
  });

  it('blocks assignment acceptance when parent order authorization denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: (resourceType?: string) => async (_req: any, res: Response, next: NextFunction) => {
        if (resourceType === 'order') {
          res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
          return;
        }
        next();
      },
    });
    const app = makeApp(mock.cosmos, authz);

    const res = await request(app)
      .post('/api/appraisers/appraiser-1/assignments/assignment-1/accept')
      .send({ notes: 'Looks good' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mock.read).toHaveBeenCalled();
    expect(mock.replace).not.toHaveBeenCalled();
  });

  it('blocks assignment rejection when parent order authorization denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: (resourceType?: string) => async (_req: any, res: Response, next: NextFunction) => {
        if (resourceType === 'order') {
          res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
          return;
        }
        next();
      },
    });
    const app = makeApp(mock.cosmos, authz);

    const res = await request(app)
      .post('/api/appraisers/appraiser-1/assignments/assignment-1/reject')
      .send({ reason: 'Conflict' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mock.read).toHaveBeenCalled();
    expect(mock.replace).not.toHaveBeenCalled();
  });
});
