#!/usr/bin/env tsx
/** Decode and print all claims from the live-fire bearer token. */
import jwt from 'jsonwebtoken';
import { loadLiveFireContext } from './_axiom-live-fire-common.js';

void (async () => {
  const ctx = await loadLiveFireContext();
  const token = ctx.authHeader.Authorization.replace(/^Bearer\s+/i, '');
  const claims = jwt.decode(token) as Record<string, unknown> | null;

  if (!claims) {
    console.error('❌ Failed to decode token — not a valid JWT?');
    process.exit(1);
  }

  console.log('\n══ Raw claims ══════════════════════════════════════════════════════════');
  console.log(JSON.stringify(claims, null, 2));

  console.log('\n══ Key fields ══════════════════════════════════════════════════════════');
  const exp = typeof claims['exp'] === 'number' ? claims['exp'] : undefined;
  const iat = typeof claims['iat'] === 'number' ? claims['iat'] : undefined;
  console.log('tid (tenantId) :', claims['tid'] ?? '⚠ MISSING');
  console.log('oid            :', claims['oid'] ?? '⚠ MISSING');
  console.log('upn / email    :', claims['upn'] ?? claims['preferred_username'] ?? claims['email'] ?? '⚠ MISSING');
  console.log('name           :', claims['name'] ?? '⚠ MISSING');
  console.log('roles          :', JSON.stringify(claims['roles']) ?? '⚠ MISSING');
  console.log('role           :', claims['role'] ?? '⚠ MISSING');
  console.log('clientId       :', claims['clientId'] ?? '⚠ MISSING');
  console.log('subClientId    :', claims['subClientId'] ?? '⚠ MISSING');
  console.log('scp            :', claims['scp'] ?? '⚠ MISSING');
  console.log('appid/azp      :', claims['appid'] ?? claims['azp'] ?? '⚠ MISSING');
  console.log('iss            :', claims['iss'] ?? '⚠ MISSING');
  console.log('aud            :', claims['aud'] ?? '⚠ MISSING');
  console.log('iat            :', iat ? new Date(iat * 1000).toISOString() : '⚠ MISSING');
  console.log('exp            :', exp ? new Date(exp * 1000).toISOString() : '⚠ MISSING');

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (exp !== undefined) {
    const ttlMinutes = Math.round((exp - nowSeconds) / 60);
    console.log('ttl            :', ttlMinutes > 0 ? `${ttlMinutes} min remaining` : '❌ EXPIRED');
  }
})();
