import { describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.ENFORCE_AUTHORIZATION = 'true';
process.env.AXIOM_CLIENT_ID = process.env.AXIOM_CLIENT_ID ?? 'test-client-id';
process.env.AXIOM_SUB_CLIENT_ID = process.env.AXIOM_SUB_CLIENT_ID ?? 'test-sub-client-id';
process.env.INSPECTION_PROVIDER = process.env.INSPECTION_PROVIDER ?? 'ivueit';
process.env.IVUEIT_API_KEY = process.env.IVUEIT_API_KEY ?? 'test-placeholder-key';
process.env.IVUEIT_SECRET = process.env.IVUEIT_SECRET ?? 'test-placeholder-secret';
process.env.IVUEIT_BASE_URL = process.env.IVUEIT_BASE_URL ?? 'https://test-placeholder.ivueit.local';

import { AppraisalManagementAPIServer } from '../../src/api/api-server.js';

describe('AppraisalManagementAPIServer authz guard helpers', () => {
  it('blocks authorization-protected routes when authz middleware is missing', () => {
    const logger = {
      error: vi.fn(),
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    const middleware = (AppraisalManagementAPIServer.prototype as any).authorize.call(
      { authzMiddleware: undefined, logger },
      'order',
      'read',
    );

    middleware({}, res, next);

    expect(logger.error).toHaveBeenCalledWith('Authorization middleware not initialized - blocking request');
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authorization middleware not initialized',
      code: 'AUTHORIZATION_MIDDLEWARE_NOT_INITIALIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('delegates to the later-initialized authz middleware at request time', () => {
    const logger = {
      error: vi.fn(),
    };
    const req = {};
    const res = {};
    const next = vi.fn();
    const delegate = vi.fn((_req, _res, innerNext) => innerNext());
    const authzMiddleware = {
      authorize: vi.fn().mockReturnValue(delegate),
      loadUserProfile: vi.fn().mockReturnValue(delegate),
    };

    const profileLoaders = (AppraisalManagementAPIServer.prototype as any).loadUserProfileIfAvailable.call({
      authzMiddleware,
      logger,
    });
    const authorize = (AppraisalManagementAPIServer.prototype as any).authorize.call(
      { authzMiddleware, logger },
      'order',
      'qc_execute',
    );

    expect(profileLoaders).toHaveLength(1);

    profileLoaders[0](req, res, next);
    authorize(req, res, next);

    expect(authzMiddleware.loadUserProfile).toHaveBeenCalledTimes(1);
    expect(authzMiddleware.authorize).toHaveBeenCalledWith('order', 'qc_execute');
    expect(delegate).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(2);
    expect(logger.error).not.toHaveBeenCalled();
  });
});