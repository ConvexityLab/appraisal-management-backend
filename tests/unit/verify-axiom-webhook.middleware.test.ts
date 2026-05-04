import crypto from 'crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { verifyAxiomWebhook } from '../../src/middleware/verify-axiom-webhook.middleware.js';

describe('verifyAxiomWebhook middleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.AXIOM_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'test';
  });

  it('passes through in non-production when secret is not configured', () => {
    const req: any = { headers: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyAxiomWebhook(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 in production when secret is not configured', () => {
    process.env.NODE_ENV = 'production';

    const req: any = { headers: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyAxiomWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when signature header is missing', () => {
    process.env.AXIOM_WEBHOOK_SECRET = 'top-secret';

    const req: any = { headers: {}, rawBody: Buffer.from('{"x":1}') };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyAxiomWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when signature scheme is invalid', () => {
    process.env.AXIOM_WEBHOOK_SECRET = 'top-secret';

    const req: any = {
      headers: { 'x-axiom-signature': 'sha256=abc123' },
      rawBody: Buffer.from('{"x":1}'),
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyAxiomWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when raw body is missing', () => {
    process.env.AXIOM_WEBHOOK_SECRET = 'top-secret';

    const req: any = {
      headers: { 'x-axiom-signature': 'hmac-sha256=abc123' },
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyAxiomWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when signature does not match payload', () => {
    process.env.AXIOM_WEBHOOK_SECRET = 'top-secret';

    const req: any = {
      headers: { 'x-axiom-signature': 'hmac-sha256=deadbeef' },
      rawBody: Buffer.from('{"x":1}'),
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyAxiomWebhook(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when signature matches payload', () => {
    process.env.AXIOM_WEBHOOK_SECRET = 'top-secret';
    const rawBody = Buffer.from('{"status":"completed"}');
    const digest = crypto.createHmac('sha256', 'top-secret').update(rawBody).digest('hex');

    const req: any = {
      headers: { 'x-axiom-signature': `hmac-sha256=${digest}` },
      rawBody,
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    verifyAxiomWebhook(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
