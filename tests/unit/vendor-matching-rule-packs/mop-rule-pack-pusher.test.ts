/**
 * Tests for MopRulePackPusher — the AMS → MOP push path that fires when a
 * new rule-pack version is committed to AMS storage.
 *
 * Phase 3 T22/T24 of docs/AUTO_ASSIGNMENT_REVIEW.md §13.4.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MopRulePackPusher } from '../../../src/services/mop-rule-pack-pusher.service.js';
import type { RulePackDocument } from '../../../src/types/vendor-matching-rule-pack.types.js';

const BASE_URL = 'http://mop.test:8080';

function makePack(overrides: Partial<RulePackDocument> = {}): RulePackDocument {
  return {
    id: 't-acme__default__v1',
    type: 'vendor-matching-rule-pack',
    tenantId: 't-acme',
    packId: 'default',
    version: 1,
    parentVersion: null,
    status: 'active',
    rules: [
      {
        name: 'R1',
        pattern_id: 'vendor_evaluation',
        salience: 100,
        conditions: { '==': [{ var: 'vendor_id' }, 'X'] },
        actions: [{
          type: 'assert',
          fact_id: 'vendor_score_adjustment',
          source: 'R1',
          data: { rule_id: 'R1', points: 5, reason: 'test' },
        }],
      },
    ],
    metadata: { name: 'Acme default', description: 'Initial pack' },
    createdAt: '2026-05-09T00:00:00Z',
    createdBy: 'alice',
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as any;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('MopRulePackPusher.push — wire format', () => {
  it('PUTs to /api/v1/vendor-matching/tenants/:tid/rules with the correct body shape', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', text: async () => '{}' });

    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    await pusher.push(makePack());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;

    expect(url).toBe(`${BASE_URL}/api/v1/vendor-matching/tenants/t-acme/rules`);
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string);
    expect(body.program.programId).toBe('vendor-matching');
    expect(body.program.version).toBe('1');
    expect(body.rules).toHaveLength(1);
    expect(body.rules[0].name).toBe('R1');
    expect(body.__amsVersion).toBe(1);
  });

  it('encodes the tenantId as a URL path segment (handles slashes / special chars)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', text: async () => '{}' });

    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    await pusher.push(makePack({ tenantId: 'tenant/with slashes' }));

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/vendor-matching/tenants/tenant%2Fwith%20slashes/rules`);
  });

  it('attaches X-Service-Auth when serviceAuthToken is configured', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', text: async () => '{}' });

    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL, serviceAuthToken: 'shh' });
    await pusher.push(makePack());

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers['X-Service-Auth']).toBe('shh');
  });

  it('attaches Authorization when authHeader is configured', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', text: async () => '{}' });

    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL, authHeader: 'Bearer xyz' });
    await pusher.push(makePack());

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers['Authorization']).toBe('Bearer xyz');
  });

  it('throws on non-2xx (caller decides whether to retry / fail-open)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => '{"error":"schema validation failed"}',
    });

    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    await expect(pusher.push(makePack())).rejects.toThrow(/400.*Bad Request.*schema validation/);
  });

  it('throws a clear timeout error after timeoutMs', async () => {
    fetchMock.mockImplementation(
      () => new Promise((_, reject) => {
        setTimeout(() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), 5);
      })
    );

    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL, timeoutMs: 10 });
    await expect(pusher.push(makePack())).rejects.toThrow(/timed out/);
  });

  it('rejects empty baseUrl at construction', () => {
    expect(() => new MopRulePackPusher({ baseUrl: '' }))
      .toThrow(/non-empty baseUrl/);
  });

  it('strips a trailing slash from baseUrl so URLs don\'t have //', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', text: async () => '{}' });

    const pusher = new MopRulePackPusher({ baseUrl: `${BASE_URL}/` });
    await pusher.push(makePack());

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/vendor-matching/tenants/t-acme/rules`);
  });
});

describe('MopRulePackPusher.preview', () => {
  const samplePreviewInput = {
    rulePack: {
      program: { name: 'P', programId: 'vendor-matching', version: 'preview', description: 'd' },
      rules: [{ name: 'R1', pattern_id: 'vendor_evaluation', salience: 100, conditions: {}, actions: [] }] as unknown[],
    },
    evaluations: [{ vendor: { id: 'v1', capabilities: [], states: [] }, order: {} }],
  };

  it('POSTs to /api/v1/vendor-matching/preview with the input body', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: async () => JSON.stringify({ results: [{ eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] }] }),
    });
    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    const result = await pusher.preview(samplePreviewInput);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/vendor-matching/preview`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(samplePreviewInput);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.eligible).toBe(true);
  });

  it('attaches X-Service-Auth when configured', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: async () => JSON.stringify({ results: [] }),
    });
    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL, serviceAuthToken: 'shh' });
    await pusher.preview({ ...samplePreviewInput, evaluations: [] });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers['X-Service-Auth']).toBe('shh');
  });

  it('bubbles MOP 400 message verbatim (validator output)', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 400, statusText: 'Bad Request',
      text: async () => '{"error":"rules[0].name missing or not a non-empty string"}',
    });
    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    await expect(pusher.preview(samplePreviewInput)).rejects.toThrow(/400.*name missing/);
  });

  it('throws when MOP returns non-JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: async () => 'not json',
    });
    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    await expect(pusher.preview(samplePreviewInput)).rejects.toThrow(/non-JSON/);
  });

  it('throws when MOP response is missing results[]', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: async () => '{"data":[]}',
    });
    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    await expect(pusher.preview(samplePreviewInput)).rejects.toThrow(/results/);
  });
});

describe('MopRulePackPusher.getSeed', () => {
  it('GETs /api/v1/vendor-matching/seed and returns the parsed pack', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: async () => JSON.stringify({
        program: { name: 'Seed', programId: 'vendor-matching', version: '0.1.0' },
        rules: [{ name: 'R1', pattern_id: 'vendor_evaluation', salience: 100, conditions: {}, actions: [] }],
      }),
    });
    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL, serviceAuthToken: 'shh' });
    const seed = await pusher.getSeed();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/vendor-matching/seed`);
    expect(init.method).toBe('GET');
    expect(init.headers['X-Service-Auth']).toBe('shh');
    expect(seed.program).toBeDefined();
    expect(seed.rules).toHaveLength(1);
  });

  it('throws on non-2xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 404, statusText: 'Not Found',
      text: async () => '{"error":"seed missing"}',
    });
    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    await expect(pusher.getSeed()).rejects.toThrow(/404.*Not Found.*seed missing/);
  });

  it('throws when seed response missing rules[]', async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: async () => JSON.stringify({ program: { name: 'X' } }),  // no rules
    });
    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    await expect(pusher.getSeed()).rejects.toThrow(/rules/);
  });
});

describe('MopRulePackPusher.drop', () => {
  it('DELETEs the tenant route', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL, serviceAuthToken: 'shh' });
    await pusher.drop('t-acme');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/vendor-matching/tenants/t-acme/rules`);
    expect(init.method).toBe('DELETE');
    expect(init.headers['X-Service-Auth']).toBe('shh');
  });

  it('throws on non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal' });

    const pusher = new MopRulePackPusher({ baseUrl: BASE_URL });
    await expect(pusher.drop('t-acme')).rejects.toThrow(/500/);
  });
});
