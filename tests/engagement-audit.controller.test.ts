import { beforeEach, describe, expect, it } from 'vitest';
import express, { type NextFunction, type Response } from 'express';
import request from 'supertest';

import { createEngagementAuditRouter } from '../src/controllers/engagement-audit.controller.js';
import type { AuthorizationMiddleware } from '../src/middleware/authorization.middleware.js';

function makeDb() {
  return {
    getContainer: () => ({
      items: {
        query: () => ({
          fetchAll: async () => ({ resources: [] }),
        }),
        create: async () => ({ resource: { id: 'created' } }),
      },
      item: () => ({
        replace: async () => undefined,
      }),
    }),
  } as any;
}

function makeAuthzStub(overrides?: {
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
    authorizeResource:
      overrides?.authorizeResource ??
      (() => async (_req: any, _res: Response, next: NextFunction) => {
        next();
      }),
    authorize: () => async (_req: any, _res: Response, next: NextFunction) => {
      next();
    },
    authorizeQuery: () => async (_req: any, _res: Response, next: NextFunction) => {
      next();
    },
  } satisfies Partial<AuthorizationMiddleware>;
}

function makeApp(authz?: Partial<AuthorizationMiddleware>) {
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
  app.use('/api/engagements', createEngagementAuditRouter(makeDb(), authz as AuthorizationMiddleware | undefined));
  return app;
}

describe('EngagementAuditController authorization', () => {
  beforeEach(() => {
    // no-op for symmetry with other controller tests
  });

  it('blocks audit reads when authorizeResource denies access', async () => {
    const app = makeApp(makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    }));

    const res = await request(app).get('/api/engagements/eng-1/audit');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
  });

  it('blocks timeline reads when authorizeResource denies access', async () => {
    const app = makeApp(makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    }));

    const res = await request(app).get('/api/engagements/eng-1/timeline');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
  });

  it('blocks event streams when authorizeResource denies access', async () => {
    const app = makeApp(makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    }));

    const res = await request(app).get('/api/engagements/eng-1/events/stream');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
  });

  it('blocks interventions when authorizeResource denies access', async () => {
    const app = makeApp(makeAuthzStub({
      authorizeResource: () => async (_req: any, res: Response) => {
        res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
      },
    }));

    const res = await request(app)
      .post('/api/engagements/eng-1/intervene')
      .send({ eventId: 'evt-1', action: 'retry' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
  });
});