import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import {
  QCApiValidationMiddleware,
  type AuthenticatedRequest,
} from '../../src/middleware/qc-api-validation.middleware.js';

function createResponseMock() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function createRequest(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    originalUrl: '/api/qc/test',
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as AuthenticatedRequest;
}

describe('QCApiValidationMiddleware auth helpers', () => {
  it('normalizes legacy QC analyst role aliases before evaluating role requirements', () => {
    const middleware = new QCApiValidationMiddleware();
    const req = createRequest({
      user: {
        id: 'user-1',
        email: 'analyst@test.dev',
        role: 'qc_analyst',
        permissions: ['qc:execute'],
      },
    });
    const res = createResponseMock();
    const next = vi.fn() as unknown as NextFunction;

    middleware.requireRole('analyst')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('honors wildcard permissions for elevated QC middleware users', () => {
    const middleware = new QCApiValidationMiddleware();
    const req = createRequest({
      user: {
        id: 'user-1',
        email: 'admin@test.dev',
        role: 'admin',
        permissions: ['*'],
      },
    });
    const res = createResponseMock();
    const next = vi.fn() as unknown as NextFunction;

    middleware.requirePermission('qc:admin')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('uses normalized admin-equivalent roles for organization access checks', () => {
    const middleware = new QCApiValidationMiddleware();
    const req = createRequest({
      params: { organizationId: 'other-org' },
      user: {
        id: 'user-1',
        email: 'system@test.dev',
        role: 'system',
        permissions: ['*'],
        organizationId: 'org-123',
      },
    });
    const res = createResponseMock();
    const next = vi.fn() as unknown as NextFunction;

    middleware.requireOrganizationAccess()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fails closed when a request carries an unsupported role', () => {
    const middleware = new QCApiValidationMiddleware();
    const req = createRequest({
      user: {
        id: 'user-1',
        email: 'mystery@test.dev',
        role: 'mystery-role',
        permissions: ['qc:read'],
      },
    });
    const res = createResponseMock();
    const next = vi.fn() as unknown as NextFunction;

    middleware.requireRole('analyst')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: 'INVALID_USER_ROLE' }),
    }));
  });
});