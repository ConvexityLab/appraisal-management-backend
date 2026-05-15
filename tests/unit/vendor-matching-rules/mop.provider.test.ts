import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MopVendorMatchingRulesProvider } from '../../../src/services/vendor-matching-rules/mop.provider.js';
import type { RuleEvaluationContext } from '../../../src/services/vendor-matching-rules.service.js';

function ctx(id: string): RuleEvaluationContext {
  return { vendor: { id, capabilities: [] }, order: {} };
}

const BASE_URL = 'http://mop.test:8090';

describe('MopVendorMatchingRulesProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('throws on empty baseUrl', () => {
      expect(() => new MopVendorMatchingRulesProvider({ baseUrl: '' })).toThrow(/non-empty baseUrl/);
      expect(() => new MopVendorMatchingRulesProvider({ baseUrl: '   ' })).toThrow(/non-empty baseUrl/);
    });

    it('strips trailing slash from baseUrl', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] }] }),
      });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: `${BASE_URL}/` });
      await provider.evaluateForVendors('t1', [ctx('a')]);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/api/v1/vendor-matching/evaluate`,
        expect.any(Object),
      );
    });
  });

  describe('evaluateForVendors', () => {
    it('returns empty array for empty contexts (no fetch)', async () => {
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      const results = await provider.evaluateForVendors('t1', []);
      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('posts the contract shape to /api/v1/vendor-matching/evaluate', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] }] }),
      });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      await provider.evaluateForVendors('tenant-9', [ctx('v1')]);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${BASE_URL}/api/v1/vendor-matching/evaluate`);
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        tenantId: 'tenant-9',
        program: 'vendor-matching',
        evaluations: [{ vendor: { id: 'v1' }, order: {} }],
      });
    });

    it('attaches Authorization header when configured', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] }] }),
      });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL, authHeader: 'Bearer xyz' });
      await provider.evaluateForVendors('t1', [ctx('a')]);
      const [, init] = fetchMock.mock.calls[0]!;
      expect(init.headers['Authorization']).toBe('Bearer xyz');
    });

    it('attaches X-Service-Auth header when serviceAuthToken is configured', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] }] }),
      });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL, serviceAuthToken: 'shared-secret-123' });
      await provider.evaluateForVendors('t1', [ctx('a')]);
      const [, init] = fetchMock.mock.calls[0]!;
      expect(init.headers['X-Service-Auth']).toBe('shared-secret-123');
      expect(init.headers['Authorization']).toBeUndefined();
    });

    it('attaches both Authorization and X-Service-Auth when both configured', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] }] }),
      });
      const provider = new MopVendorMatchingRulesProvider({
        baseUrl: BASE_URL,
        authHeader: 'Bearer xyz',
        serviceAuthToken: 'shared-secret-123',
      });
      await provider.evaluateForVendors('t1', [ctx('a')]);
      const [, init] = fetchMock.mock.calls[0]!;
      expect(init.headers['Authorization']).toBe('Bearer xyz');
      expect(init.headers['X-Service-Auth']).toBe('shared-secret-123');
    });

    it('parses results array preserving order and length', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [
          { eligible: true,  scoreAdjustment: 5,  appliedRuleIds: ['r1'], denyReasons: [] },
          { eligible: false, scoreAdjustment: 0,  appliedRuleIds: ['r2'], denyReasons: ['blocked'] },
        ] }),
      });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      const results = await provider.evaluateForVendors('t1', [ctx('a'), ctx('b')]);
      expect(results).toEqual([
        { eligible: true,  scoreAdjustment: 5, appliedRuleIds: ['r1'], denyReasons: [] },
        { eligible: false, scoreAdjustment: 0, appliedRuleIds: ['r2'], denyReasons: ['blocked'] },
      ]);
    });

    it('throws on non-2xx response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      await expect(provider.evaluateForVendors('t1', [ctx('a')])).rejects.toThrow(/500/);
    });

    it('throws when results array length does not match input', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [
          { eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] },
        ] }),
      });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      await expect(provider.evaluateForVendors('t1', [ctx('a'), ctx('b')]))
        .rejects.toThrow(/expected results\[\] of length 2/);
    });

    it('throws when results is not an array', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: 'oops' }) });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      await expect(provider.evaluateForVendors('t1', [ctx('a')])).rejects.toThrow(/malformed/);
    });

    it('normalizes missing fields defensively', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{}] }), // missing every field
      });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      const [r] = await provider.evaluateForVendors('t1', [ctx('a')]);
      expect(r).toEqual({ eligible: true, scoreAdjustment: 0, appliedRuleIds: [], denyReasons: [] });
    });

    it('filters non-string entries from appliedRuleIds and denyReasons', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{
          eligible: false,
          scoreAdjustment: 0,
          appliedRuleIds: ['r1', 42, null, 'r2'],
          denyReasons: ['ok', 99, undefined, 'also-ok'],
        }] }),
      });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      const [r] = await provider.evaluateForVendors('t1', [ctx('a')]);
      expect(r?.appliedRuleIds).toEqual(['r1', 'r2']);
      expect(r?.denyReasons).toEqual(['ok', 'also-ok']);
    });

    it('throws an explanatory error on timeout', async () => {
      fetchMock.mockImplementation(async (_url: string, init: any) => {
        // Simulate a hung request that respects the abort signal.
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            (err as any).name = 'AbortError';
            reject(err);
          });
        });
      });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL, timeoutMs: 50 });
      await expect(provider.evaluateForVendors('t1', [ctx('a')]))
        .rejects.toThrow(/timed out after 50ms/);
    });
  });

  describe('isHealthy', () => {
    it('returns true on /health 200', async () => {
      fetchMock.mockResolvedValue({ ok: true });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      expect(await provider.isHealthy()).toBe(true);
      const [url] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${BASE_URL}/health`);
    });

    it('returns false on /health 503', async () => {
      fetchMock.mockResolvedValue({ ok: false });
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      expect(await provider.isHealthy()).toBe(false);
    });

    it('returns false when /health throws', async () => {
      fetchMock.mockRejectedValue(new Error('connection refused'));
      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      expect(await provider.isHealthy()).toBe(false);
    });
  });
});
