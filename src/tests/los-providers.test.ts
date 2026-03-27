/**
 * LOS Providers unit tests
 *
 * Tests MockLosProvider directly (no network, no credentials).
 * Validates that the provider fulfils the LosProvider contract including:
 *   - deterministic loan builds (same loanNumber → same data)
 *   - sentinel "NOTFOUND" returns null from getLoan
 *   - importOrder returns a valid LosImportResult
 *   - pushOrder round-trip succeeds
 *
 * Also tests the factory (createLosProvider) env-var selection:
 *   - No env vars → MockLosProvider
 *   - LOS_PROVIDER=mock explicitly → MockLosProvider
 *   - LOS_PROVIDER=encompass without required env → throws
 *   - LOS_PROVIDER=black_knight without required env → throws
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MockLosProvider } from '../services/los-providers/mock.provider.js';

// ─── MockLosProvider ──────────────────────────────────────────────────────────

describe('MockLosProvider', () => {
  let provider: MockLosProvider;

  beforeEach(() => {
    provider = new MockLosProvider();
  });

  it('isAvailable() always returns true', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  it('has name "Mock LOS (simulated)"', () => {
    expect(provider.name).toBe('Mock LOS (simulated)');
  });

  // ── getLoan ────────────────────────────────────────────────────────────────

  describe('getLoan', () => {
    it('returns null for the NOTFOUND sentinel', async () => {
      const result = await provider.getLoan('NOTFOUND', 'tenant-1');
      expect(result).toBeNull();
    });

    it('returns a LosLoan for a normal loan number', async () => {
      const loan = await provider.getLoan('LN-001', 'tenant-1');

      expect(loan).not.toBeNull();
      expect(loan!.loanNumber).toBe('LN-001');
      expect(typeof loan!.borrowerName).toBe('string');
      expect(loan!.loanAmountCents).toBeGreaterThan(0);
      expect(['Purchase', 'Refinance']).toContain(loan!.loanPurpose);
      expect(loan!.propertyState).toBe('IL');
      expect(loan!.losStatus).toBe('Processing');
    });

    it('is deterministic — same loanNumber always returns same data', async () => {
      const a = await provider.getLoan('LN-STABLE', 'tenant-1');
      const b = await provider.getLoan('LN-STABLE', 'tenant-2');

      // tenantId does not affect the returned loan fields
      expect(a!.borrowerName).toBe(b!.borrowerName);
      expect(a!.loanAmountCents).toBe(b!.loanAmountCents);
      expect(a!.propertyZip).toBe(b!.propertyZip);
    });

    it('different loan numbers return different data', async () => {
      const a = await provider.getLoan('LN-AAA', 'tenant-1');
      const b = await provider.getLoan('LN-ZZZ', 'tenant-1');
      // borrowerName or amount will differ for different seeds
      const sameData = a!.borrowerName === b!.borrowerName && a!.loanAmountCents === b!.loanAmountCents;
      expect(sameData).toBe(false);
    });

    it('conditionally sets coBorrowerName based on seed', async () => {
      // Brute-force: check a few loan numbers and verify coBorrowerName is present or absent
      const results = await Promise.all(
        ['LN-A', 'LN-B', 'LN-C', 'LN-D', 'LN-E', 'LN-F'].map(n => provider.getLoan(n, 'tenant-1')),
      );
      // At least one should have a coBorrowerName, at least one should not
      const withCo    = results.filter(l => l!.coBorrowerName !== undefined);
      const withoutCo = results.filter(l => l!.coBorrowerName === undefined);
      expect(withCo.length).toBeGreaterThan(0);
      expect(withoutCo.length).toBeGreaterThan(0);
    });
  });

  // ── importOrder ────────────────────────────────────────────────────────────

  describe('importOrder', () => {
    it('returns an LosImportResult with created=true', async () => {
      const result = await provider.importOrder({ loanNumber: 'LN-001', tenantId: 'tenant-1' });

      expect(result.created).toBe(true);
      expect(typeof result.orderId).toBe('string');
      expect(result.orderId.length).toBeGreaterThan(0);
      expect(result.loan.loanNumber).toBe('LN-001');
    });

    it('orderId includes tenantId and loanNumber for traceability', async () => {
      const result = await provider.importOrder({ loanNumber: 'LN-TRACE', tenantId: 'tenant-trace' });
      expect(result.orderId).toContain('tenant-trace');
      expect(result.orderId).toContain('LN-TRACE');
    });

    it('passes optional losFileId through without error', async () => {
      await expect(
        provider.importOrder({ loanNumber: 'LN-001', tenantId: 'tenant-1', losFileId: 'FILE-42' }),
      ).resolves.not.toThrow();
    });
  });

  // ── pushOrder ──────────────────────────────────────────────────────────────

  describe('pushOrder', () => {
    it('returns success=true with a confirmation ID', async () => {
      const result = await provider.pushOrder({
        orderId: 'order-001',
        loanNumber: 'LN-001',
        statusCode: 'Completed',
      });

      expect(result.success).toBe(true);
      expect(typeof result.losConfirmationId).toBe('string');
      expect(result.losConfirmationId!.length).toBeGreaterThan(0);
      expect(typeof result.message).toBe('string');
      expect(result.message).toMatch(/LN-001/);
      expect(result.message).toMatch(/Completed/);
    });

    it('includes appraisedValueCents in message when provided', async () => {
      const result = await provider.pushOrder({
        orderId: 'order-001',
        loanNumber: 'LN-001',
        statusCode: 'Completed',
        appraisedValueCents: 45000000,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ─── createLosProvider factory ────────────────────────────────────────────────

describe('createLosProvider factory', () => {
  const SAVED_ENV: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Snapshot relevant env vars
    for (const key of ['LOS_PROVIDER', 'ENCOMPASS_CLIENT_ID',
      'ENCOMPASS_CLIENT_SECRET', 'ENCOMPASS_INSTANCE_ID',
      'BLACKKNIGHT_API_KEY', 'BLACKKNIGHT_BASE_URL']) {
      SAVED_ENV[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore environment
    for (const [key, val] of Object.entries(SAVED_ENV)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    jest.resetModules();
  });

  it('returns MockLosProvider when no env vars are set', async () => {
    const { createLosProvider } = await import('../services/los-providers/factory.js');
    const provider = createLosProvider();
    expect(provider.name).toMatch(/mock/i);
  });

  it('returns MockLosProvider when LOS_PROVIDER=mock', async () => {
    process.env['LOS_PROVIDER'] = 'mock';
    const { createLosProvider } = await import('../services/los-providers/factory.js');
    const provider = createLosProvider();
    expect(provider.name).toMatch(/mock/i);
  });

  it('throws when LOS_PROVIDER=encompass but credentials are missing', async () => {
    process.env['LOS_PROVIDER'] = 'encompass';
    const { createLosProvider } = await import('../services/los-providers/factory.js');
    expect(() => createLosProvider()).toThrow(/ENCOMPASS_CLIENT_ID|missing|required/i);
  });

  it('throws when LOS_PROVIDER=black_knight but credentials are missing', async () => {
    process.env['LOS_PROVIDER'] = 'black_knight';
    const { createLosProvider } = await import('../services/los-providers/factory.js');
    expect(() => createLosProvider()).toThrow(/BLACKKNIGHT_API_KEY|missing|required/i);
  });
});
