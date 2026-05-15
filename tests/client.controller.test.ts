import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Response, type NextFunction } from 'express';
import request from 'supertest';

import { ClientController } from '../src/controllers/client.controller.js';
import type { AuthorizationMiddleware } from '../src/middleware/authorization.middleware.js';

function makeMockDb() {
  return {
    findClients: vi.fn(async () => ({ success: true, data: [{ id: 'client-1', clientName: 'Alpha Lending' }] })),
    findClientById: vi.fn(async (id: string) => ({
      success: true,
      data:
        id === 'missing'
          ? null
          : {
              id,
              tenantId: 'tenant-a',
              clientName: 'Alpha Lending',
              clientType: 'LENDER',
              contactName: 'Alice',
              contactEmail: 'alice@example.com',
              status: 'ACTIVE',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              createdBy: 'user-1',
            },
    })),
    createClient: vi.fn(async (payload: any) => ({ success: true, data: { id: 'client-new', ...payload, status: 'ACTIVE' } })),
    updateClient: vi.fn(async (id: string, tenantId: string, updates: any) => ({
      success: true,
      data: { id, tenantId, clientName: 'Alpha Lending', clientType: 'LENDER', contactName: 'Alice', contactEmail: 'alice@example.com', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', createdBy: 'user-1', ...updates },
    })),
    deleteClient: vi.fn(async () => ({ success: true, data: undefined })),
  } as any;
}

function makeAuthzStub(overrides?: {
  authorizeQuery?: () => any;
  authorizeResource?: () => any;
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
    authorize: () => async (_req: any, _res: Response, next: NextFunction) => {
      next();
    },
    authorizeQuery:
      overrides?.authorizeQuery ??
      (() => async (req: any, _res: Response, next: NextFunction) => {
        req.authorizationFilter = {
          sql: 'c.ownerId = @ownerId',
          parameters: [{ name: '@ownerId', value: 'user-1' }],
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
      azureAdObjectId: 'aad-1',
    };
    next();
  });

  const controller = new ClientController(db, authzMiddleware as AuthorizationMiddleware | undefined);
  app.use('/api/clients', controller.router);
  return app;
}

describe('ClientController authorization', () => {
  let db: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    db = makeMockDb();
  });

  it('passes authorizationFilter into list queries', async () => {
    const app = makeApp(db, makeAuthzStub());

    const res = await request(app).get('/api/clients').query({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(db.findClients).toHaveBeenCalledWith(
      'tenant-a',
      'ACTIVE',
      expect.objectContaining({ sql: 'c.ownerId = @ownerId' }),
    );
  });

  it('returns the client when authorizeResource allows access', async () => {
    const app = makeApp(db, makeAuthzStub());

    const res = await request(app).get('/api/clients/client-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('client-1');
    expect(db.findClientById).toHaveBeenCalledWith('client-1', 'tenant-a');
  });

  it('blocks resource reads when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(db, authz);

    const res = await request(app).get('/api/clients/client-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(db.findClientById).not.toHaveBeenCalled();
  });

  it('uses authorizeResource for updates before calling the database', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(db, authz);

    const res = await request(app)
      .put('/api/clients/client-1')
      .send({ contactEmail: 'new@example.com' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(db.updateClient).not.toHaveBeenCalled();
  });
});
