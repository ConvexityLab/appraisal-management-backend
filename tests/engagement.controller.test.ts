import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Response } from 'express';
import request from 'supertest';

const mockEngagementService = vi.hoisted(() => ({
  listEngagements: vi.fn(),
  getEngagement: vi.fn(),
  updateEngagement: vi.fn(),
  addClientOrderToLoan: vi.fn(),
}));

vi.mock('../src/services/engagement.service.js', () => ({
  EngagementService: class EngagementService {
    async listEngagements(...args: unknown[]) {
      return mockEngagementService.listEngagements(...args);
    }
    async getEngagement(...args: unknown[]) {
      return mockEngagementService.getEngagement(...args);
    }
    async updateEngagement(...args: unknown[]) {
      return mockEngagementService.updateEngagement(...args);
    }
    async addClientOrderToLoan(...args: unknown[]) {
      return mockEngagementService.addClientOrderToLoan(...args);
    }
  },
}));

import { createEngagementRouter } from '../src/controllers/engagement.controller.js';
import type { AuthorizationMiddleware } from '../src/middleware/authorization.middleware.js';

function makeEngagement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'eng-1',
    engagementNumber: 'ENG-2026-1',
    tenantId: 'tenant-a',
    engagementType: 'SINGLE',
    loansStoredExternally: false,
    client: { clientId: 'client-1', clientName: 'Alpha Lending' },
    properties: [
      {
        id: 'loan-1',
        loanNumber: 'LN-1',
        borrowerName: 'Borrower One',
        property: { address: '1 Main', city: 'Austin', state: 'TX', zipCode: '78701' },
        status: 'PENDING',
        clientOrders: [],
      },
    ],
    status: 'RECEIVED',
    priority: 'ROUTINE',
    receivedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user-1',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function resetMocks() {
  mockEngagementService.listEngagements.mockReset();
  mockEngagementService.getEngagement.mockReset();
  mockEngagementService.updateEngagement.mockReset();
  mockEngagementService.addClientOrderToLoan.mockReset();

  mockEngagementService.listEngagements.mockResolvedValue({
    engagements: [makeEngagement()],
    totalCount: 1,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  });
  mockEngagementService.getEngagement.mockResolvedValue(makeEngagement());
  mockEngagementService.updateEngagement.mockResolvedValue(makeEngagement({ status: 'ACCEPTED' }));
  mockEngagementService.addClientOrderToLoan.mockResolvedValue(makeEngagement());
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
    authorize:
      () => async (_req: any, _res: Response, next: NextFunction) => {
        next();
      },
    authorizeQuery:
      overrides?.authorizeQuery ??
      (() => async (req: any, _res: Response, next: NextFunction) => {
        req.authorizationFilter = {
          sql: 'c.client.clientId = @clientId',
          parameters: [{ name: '@clientId', value: 'client-1' }],
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

function makeApp(authzMiddleware?: Partial<AuthorizationMiddleware>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'u@example.com',
    };
    next();
  });
  app.use('/api/engagements', createEngagementRouter({} as any, authzMiddleware as AuthorizationMiddleware | undefined));
  return app;
}

describe('EngagementController authorization', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('passes authorizationFilter into engagement list queries', async () => {
    const app = makeApp(makeAuthzStub());

    const res = await request(app).get('/api/engagements').query({ clientId: 'client-1' });

    expect(res.status).toBe(200);
    expect(mockEngagementService.listEngagements).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        clientId: 'client-1',
        authorizationFilter: expect.objectContaining({ sql: 'c.client.clientId = @clientId' }),
      }),
    );
  });

  it('blocks engagement reads when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(authz);

    const res = await request(app).get('/api/engagements/eng-1');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockEngagementService.getEngagement).not.toHaveBeenCalled();
  });

  it('blocks engagement updates when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(authz);

    const res = await request(app)
      .put('/api/engagements/eng-1')
      .send({ priority: 'RUSH' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockEngagementService.updateEngagement).not.toHaveBeenCalled();
  });

  it('blocks engagement child-order mutations when authorizeResource denies access', async () => {
    const authz = makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    });
    const app = makeApp(authz);

    const res = await request(app)
      .post('/api/engagements/eng-1/loans/loan-1/client-orders')
      .send({ productType: 'FULL_APPRAISAL' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(mockEngagementService.addClientOrderToLoan).not.toHaveBeenCalled();
  });
});