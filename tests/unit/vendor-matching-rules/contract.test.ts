/**
 * Wire-contract test for the MOP vendor-matching evaluator.
 *
 * Asserts both directions of the BE↔MOP contract:
 *
 *   1. Request shape: when MopVendorMatchingRulesProvider builds a request
 *      from RuleEvaluationContext[], the resulting body deep-equals the
 *      "request" example in the contract fixture. If the BE renames a field
 *      (e.g. capabilities → caps), this test goes red.
 *
 *   2. Response shape: when MOP returns the "response" example shape,
 *      MopVendorMatchingRulesProvider.evaluateForVendors normalizes it
 *      into RuleEvaluationResult[] losslessly (every field round-trips
 *      with the right type). If MOP renames a field, this test goes red
 *      (after the C++ side updates the fixture, both repos surface the
 *      drift on next CI).
 *
 * The same fixture lives in mortgage-origination-platform/tests/fixtures/
 * vendor-matching-contract.json (mirror); the C++ Catch2 test asserts MOP's
 * actual output for a fixed input matches the fixture. Drift in either
 * direction surfaces as a test failure.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MopVendorMatchingRulesProvider } from '../../../src/services/vendor-matching-rules/mop.provider.js';
import type { RuleEvaluationContext } from '../../../src/services/vendor-matching-rules/provider.types.js';

interface Contract {
  request: {
    tenantId: string;
    program: string;
    evaluations: Array<{
      vendor: Record<string, unknown>;
      order: Record<string, unknown>;
    }>;
  };
  response: {
    results: Array<{
      eligible: boolean;
      scoreAdjustment: number;
      appliedRuleIds: string[];
      denyReasons: string[];
    }>;
  };
}

const CONTRACT_PATH = join(__dirname, '..', '..', 'fixtures', 'mop-vendor-matching-contract.json');

/**
 * Recursively drop _comment* keys from the loaded fixture so the wire-shape
 * comparison ignores the inline documentation. Comments are part of the file
 * for human readers, not part of the contract.
 */
function stripComments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripComments);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_comment')) continue;
      out[k] = stripComments(v);
    }
    return out;
  }
  return value;
}

const contract: Contract = stripComments(
  JSON.parse(readFileSync(CONTRACT_PATH, 'utf-8')),
) as Contract;

const BASE_URL = 'http://mop.test';

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as any;
});
afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Reverse-engineer RuleEvaluationContext[] from the contract's request.evaluations[].
 * The provider's input shape is the "domain" version; the wire shape is what
 * the request body looks like. This test asserts the provider's serialization
 * matches the wire shape exactly — same keys, same types, same nesting.
 */
function contextsFromContract(): RuleEvaluationContext[] {
  return contract.request.evaluations.map(e => ({
    vendor: e.vendor as RuleEvaluationContext['vendor'],
    order: e.order as RuleEvaluationContext['order'],
  }));
}

describe('Wire contract: MopVendorMatchingRulesProvider ↔ VendorMatchingService', () => {
  describe('request shape', () => {
    it('serializes RuleEvaluationContext[] into the exact body MOP expects', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => contract.response,
      });

      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      await provider.evaluateForVendors(contract.request.tenantId, contextsFromContract());

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;

      // URL must be the canonical evaluator path.
      expect(url).toBe(`${BASE_URL}/api/v1/vendor-matching/evaluate`);

      // Method + content type are not negotiable parts of the contract.
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');

      // Body deep-equals the fixture's request.
      const sentBody = JSON.parse(init.body as string);
      expect(sentBody).toEqual(contract.request);
    });

    it('preserves evaluations[] order (results map by index)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => contract.response,
      });

      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      await provider.evaluateForVendors(contract.request.tenantId, contextsFromContract());

      const sentBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      const sentIds = sentBody.evaluations.map((e: any) => e.vendor.id);
      const fixtureIds = contract.request.evaluations.map(e => (e.vendor as any).id);
      expect(sentIds).toEqual(fixtureIds);
    });
  });

  describe('response shape', () => {
    it('parses MOP response into RuleEvaluationResult[] losslessly', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => contract.response,
      });

      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      const results = await provider.evaluateForVendors(
        contract.request.tenantId,
        contextsFromContract(),
      );

      // Length and per-index correspondence.
      expect(results).toHaveLength(contract.response.results.length);

      // Field-by-field equality (types matter — an int returned as string would slip past
      // a shallow equal but break downstream score arithmetic).
      contract.response.results.forEach((expected, i) => {
        expect(results[i]!.eligible).toBe(expected.eligible);
        expect(typeof results[i]!.eligible).toBe('boolean');

        expect(results[i]!.scoreAdjustment).toBe(expected.scoreAdjustment);
        expect(typeof results[i]!.scoreAdjustment).toBe('number');

        expect(results[i]!.appliedRuleIds).toEqual(expected.appliedRuleIds);
        expect(Array.isArray(results[i]!.appliedRuleIds)).toBe(true);

        expect(results[i]!.denyReasons).toEqual(expected.denyReasons);
        expect(Array.isArray(results[i]!.denyReasons)).toBe(true);
      });
    });

    it('throws on length mismatch (would cause silent index misalignment downstream)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results: contract.response.results.slice(0, 1) }),
      });

      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      await expect(
        provider.evaluateForVendors(contract.request.tenantId, contextsFromContract()),
      ).rejects.toThrow(/results.*length/);
    });

    it('rejects responses missing the results[] envelope', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ data: contract.response.results }),  // wrong key
      });

      const provider = new MopVendorMatchingRulesProvider({ baseUrl: BASE_URL });
      await expect(
        provider.evaluateForVendors(contract.request.tenantId, contextsFromContract()),
      ).rejects.toThrow(/results/);
    });
  });

  describe('contract fixture sanity', () => {
    it('has matching evaluations[] and results[] lengths (wire requires this)', () => {
      expect(contract.request.evaluations.length).toBe(contract.response.results.length);
    });

    it('uses the canonical program identifier "vendor-matching"', () => {
      expect(contract.request.program).toBe('vendor-matching');
    });
  });
});
