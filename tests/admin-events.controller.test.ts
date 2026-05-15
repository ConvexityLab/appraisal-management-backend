import { describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Response } from 'express';
import request from 'supertest';

import { createAdminEventsRouter } from '../src/controllers/admin-events.controller.js';
import type { AuthorizationMiddleware } from '../src/middleware/authorization.middleware.js';

function makeApp(authzMiddleware?: Partial<AuthorizationMiddleware>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: Response, next: NextFunction) => {
    req.user = {
      id: 'user-1',
      email: 'user-1@example.test',
      role: 'manager',
      tenantId: 'tenant-a',
    };
    next();
  });

  const dbService = {
    getContainer: vi.fn(() => ({
      items: {
        query: vi.fn(),
      },
    })),
  };

  app.use('/api/admin', createAdminEventsRouter(dbService as any, authzMiddleware as AuthorizationMiddleware | undefined));
  return { app, dbService };
}

describe('createAdminEventsRouter authorization', () => {
  it('uses canonical admin_panel manage authz middleware when provided', async () => {
    const authorize = vi.fn(() => async (_req: any, res: Response) => {
      res.status(403).json({ code: 'AUTHORIZATION_DENIED' });
    });
    const authz = {
      loadUserProfile: vi.fn(() => async (req: any, _res: Response, next: NextFunction) => {
        req.userProfile = { role: 'manager' };
        next();
      }),
      authorize,
    } satisfies Partial<AuthorizationMiddleware>;
    const { app, dbService } = makeApp(authz);

    const res = await request(app)
      .post('/api/admin/events/event-1/replay')
      .send({ reason: 'retry' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTHORIZATION_DENIED');
    expect(authz.loadUserProfile).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledWith('admin_panel', 'manage');
    expect(dbService.getContainer).not.toHaveBeenCalled();
  });
});
