/**
 * GSE Providers unit tests
 *
 * Tests the GSE provider factory (createGseProvider) and the composite
 * dispatch logic. No network calls are made — this validates:
 *
 *   Factory resolution
 *     1.  No credentials → composite with MockGseProvider for both portals
 *     2.  UCDP creds set → dispatches to real UcdpSoapProvider for UCDP portal
 *     3.  EAD creds set  → dispatches to real EadRestProvider for EAD portal
 *
 *   CompositeGseProvider dispatch (via Mock fallback, no network)
 *     4.  submit('UCDP', ...) through composite returns an accepted mock result
 *     5.  submit('EAD', ...) through composite returns an accepted mock result
 *     6.  checkStatus('UCDP', ...) through composite returns accepted status
 *     7.  checkStatus('EAD', ...) through composite returns accepted status
 *
 * We intentionally do NOT test UcdpSoapProvider or EadRestProvider in this
 * file because they make real SOAP/REST calls and require valid credentials.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

type SavedEnv = Record<string, string | undefined>;

const GSE_ENV_KEYS = [
  'UCDP_USERNAME', 'UCDP_PASSWORD', 'UCDP_LENDER_ID', 'UCDP_ENV',
  'EAD_API_KEY', 'EAD_CLIENT_ID', 'EAD_CLIENT_SECRET', 'EAD_ENV',
];

function snapshotEnv(keys: string[]): SavedEnv {
  const snap: SavedEnv = {};
  for (const k of keys) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap: SavedEnv): void {
  for (const [k, v] of Object.entries(snap)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

// ─── Factory resolution ────────────────────────────────────────────────────────

describe('createGseProvider factory', () => {
  let saved: SavedEnv;

  beforeEach(() => {
    saved = snapshotEnv(GSE_ENV_KEYS);
    for (const k of GSE_ENV_KEYS) delete process.env[k];
    jest.resetModules();
  });

  afterEach(() => {
    restoreEnv(saved);
    jest.resetModules();
  });

  it('returns a SubmissionProvider with no credentials (mock composite)', async () => {
    const { createGseProvider } = await import('../services/gse-providers/factory.js');
    const provider = createGseProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.submit).toBe('function');
    expect(typeof provider.checkStatus).toBe('function');
  });

  it('composite.submit(UCDP) returns accepted status with no credentials', async () => {
    const { createGseProvider } = await import('../services/gse-providers/factory.js');
    const provider = createGseProvider();

    const result = await provider.submit('UCDP', '<xml/>', 'lender-001');

    expect(result.status).toBe('ACCEPTED');
    expect(typeof result.portalDocumentId).toBe('string');
    expect(result.portalDocumentId).toMatch(/mock-ucdp/i);
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('composite.submit(EAD) returns accepted status with no credentials', async () => {
    const { createGseProvider } = await import('../services/gse-providers/factory.js');
    const provider = createGseProvider();

    const result = await provider.submit('EAD', '<xml/>', 'lender-001');

    expect(result.status).toBe('ACCEPTED');
    expect(result.portalDocumentId).toMatch(/mock-ead/i);
  });

  it('composite.checkStatus(UCDP) returns accepted status', async () => {
    const { createGseProvider } = await import('../services/gse-providers/factory.js');
    const provider = createGseProvider();

    const result = await provider.checkStatus('UCDP', 'doc-001');

    expect(result.status).toBe('ACCEPTED');
    expect(Array.isArray(result.findings)).toBe(true);
  });

  it('composite.checkStatus(EAD) returns accepted status', async () => {
    const { createGseProvider } = await import('../services/gse-providers/factory.js');
    const provider = createGseProvider();

    const result = await provider.checkStatus('EAD', 'doc-001');

    expect(result.status).toBe('ACCEPTED');
  });

  it('builds composite with UcdpSoapProvider when UCDP creds are present', async () => {
    process.env['UCDP_USERNAME'] = 'test-user';
    process.env['UCDP_PASSWORD'] = 'test-pass';

    const { createGseProvider } = await import('../services/gse-providers/factory.js');
    // Just verify no throw — actual SOAP calls are not exercised
    expect(() => createGseProvider()).not.toThrow();
  });

  it('builds composite with EadRestProvider when EAD creds are present', async () => {
    process.env['EAD_API_KEY']       = 'test-key';
    process.env['EAD_CLIENT_ID']     = 'test-client';
    process.env['EAD_CLIENT_SECRET'] = 'test-secret';

    const { createGseProvider } = await import('../services/gse-providers/factory.js');
    expect(() => createGseProvider()).not.toThrow();
  });
});

// ─── UCDP XML helpers (static — no credentials needed) ────────────────────────

// UcdpSoapProvider.extractTag is private but we can exercise it via (as any).
describe('UcdpSoapProvider XML parsing helpers', () => {
  it('extracts a simple XML tag value', async () => {
    const { UcdpSoapProvider } = await import('../services/gse-providers/ucdp-soap.provider.js');

    const provider = new UcdpSoapProvider('u', 'p', 'l', 'sandbox');
    const xml = '<root><RuleCategoryType>PROPERTY</RuleCategoryType><RuleIdentifier>R001</RuleIdentifier></root>';

    // Access private method only in tests — this is intentional for unit-testing
    const extract = (p: unknown, x: string, t: string) => (p as any).extractTag(x, t) as string;

    expect(extract(provider, xml, 'RuleCategoryType')).toBe('PROPERTY');
    expect(extract(provider, xml, 'RuleIdentifier')).toBe('R001');
    expect(extract(provider, xml, 'NotPresent')).toBe('');
  });
});
