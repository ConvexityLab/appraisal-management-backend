/**
 * HMAC-SHA256 signature verification for inbound Axiom webhook calls.
 *
 * Axiom signs every webhook request with:
 *   X-Axiom-Signature: hmac-sha256=<hex-digest>
 *
 * The digest is computed over the raw request body using the shared secret
 * stored in AXIOM_WEBHOOK_SECRET.
 *
 * IMPORTANT: This middleware must run AFTER a body-capture middleware that
 * stores the raw body buffer on `req.rawBody`.  In api-server.ts the JSON
 * parser is configured with a `verify` callback to do exactly that:
 *
 *   express.json({
 *     verify: (req, _res, buf) => { (req as any).rawBody = buf; },
 *   })
 *
 * If rawBody is not present the request is rejected with 400.
 * If the secret is not configured the middleware rejects with 500 in
 * production and passes through in development/test so local testing works
 * without the secret.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const SIGNATURE_HEADER = 'x-axiom-signature';
const SCHEME_PREFIX = 'hmac-sha256=';

export function verifyAxiomWebhook(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env['AXIOM_WEBHOOK_SECRET'];

  if (!secret) {
    if (process.env['NODE_ENV'] === 'production') {
      res.status(500).json({
        error: 'AXIOM_WEBHOOK_SECRET is not configured. Set it via Key Vault / environment before deploying.',
      });
      return;
    }
    // Non-production: skip verification so local azurite / mock testing works.
    next();
    return;
  }

  const signatureHeader = req.headers[SIGNATURE_HEADER] as string | undefined;
  if (!signatureHeader) {
    res.status(401).json({ error: `Missing ${SIGNATURE_HEADER} header` });
    return;
  }

  if (!signatureHeader.startsWith(SCHEME_PREFIX)) {
    res.status(401).json({ error: `Unrecognised signature scheme — expected ${SCHEME_PREFIX}<hex>` });
    return;
  }

  const rawBody: Buffer | undefined = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    // The JSON middleware must be configured with verify to populate rawBody.
    res.status(400).json({ error: 'Raw request body not available — check express.json() verify config' });
    return;
  }

  const expected = SCHEME_PREFIX + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signatureHeader;

  // Constant-time comparison to prevent timing attacks.
  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expected, 'utf8'))
  ) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  next();
}
