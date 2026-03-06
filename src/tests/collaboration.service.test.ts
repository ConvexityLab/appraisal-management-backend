/**
 * CollaborationService unit tests
 *
 * Mocks:
 *   - @azure/keyvault-secrets  – SecretClient.getSecret()
 *   - @azure/identity           – DefaultAzureCredential (no-op)
 *   - @fluidframework/azure-service-utils – generateToken (returns a deterministic stub)
 *
 * Tests cover:
 *   - constructor throws when KEY_VAULT_URL is absent
 *   - isConfigured() with / without env vars
 *   - generateToken() happy path
 *   - generateToken() verifies expiresAt is ~now + lifetime
 *   - getTenantKey cache (re-uses cached key within 5 min, re-fetches after expiry)
 *   - getTenantKey throws when secret value is empty
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ─── Mock @azure/keyvault-secrets ─────────────────────────────────────────────

const mockGetSecret = jest.fn();
jest.mock('@azure/keyvault-secrets', () => ({
  SecretClient: jest.fn().mockImplementation(() => ({
    getSecret: mockGetSecret,
  })),
}));

// ─── Mock @azure/identity ─────────────────────────────────────────────────────

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({})),
}));

// ─── Mock @fluidframework/azure-service-utils ─────────────────────────────────

const mockGenerateToken = jest.fn().mockReturnValue('stub-fluid-jwt');
jest.mock('@fluidframework/azure-service-utils/legacy', () => ({
  generateToken: mockGenerateToken,
  ScopeType: {
    DocRead: 'doc:read',
    DocWrite: 'doc:write',
    SummaryWrite: 'summary:write',
  },
}));

// ─── Import AFTER mocks ────────────────────────────────────────────────────────

import { CollaborationService } from '../../services/collaboration.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FAKE_KEY_VAULT_URL = 'https://kv-test.vault.azure.net/';
const FAKE_TENANT_ID = 'test-tenant-123';
const FAKE_KEY = 'super-secret-fluid-key';

function makeService(): CollaborationService {
  process.env.KEY_VAULT_URL = FAKE_KEY_VAULT_URL;
  process.env.AZURE_FLUID_RELAY_TENANT_ID = FAKE_TENANT_ID;
  mockGetSecret.mockResolvedValue({ value: FAKE_KEY });
  return new CollaborationService();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollaborationService', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore env — prevent test pollution
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  // ── constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('throws when KEY_VAULT_URL is not set', () => {
      delete process.env.KEY_VAULT_URL;
      expect(() => new CollaborationService()).toThrow('KEY_VAULT_URL');
    });

    it('constructs successfully when KEY_VAULT_URL is set', () => {
      process.env.KEY_VAULT_URL = FAKE_KEY_VAULT_URL;
      expect(() => new CollaborationService()).not.toThrow();
    });
  });

  // ── isConfigured ─────────────────────────────────────────────────────────

  describe('isConfigured()', () => {
    it('returns true when both env vars are present', () => {
      const svc = makeService();
      expect(svc.isConfigured()).toBe(true);
    });

    it('returns false when AZURE_FLUID_RELAY_TENANT_ID is absent', () => {
      process.env.KEY_VAULT_URL = FAKE_KEY_VAULT_URL;
      delete process.env.AZURE_FLUID_RELAY_TENANT_ID;
      const svc = new CollaborationService();
      expect(svc.isConfigured()).toBe(false);
    });

    it('returns false when KEY_VAULT_URL is the only env var (no tenant id)', () => {
      process.env.KEY_VAULT_URL = FAKE_KEY_VAULT_URL;
      delete process.env.AZURE_FLUID_RELAY_TENANT_ID;
      const svc = new CollaborationService();
      expect(svc.isConfigured()).toBe(false);
    });
  });

  // ── generateToken ─────────────────────────────────────────────────────────

  describe('generateToken()', () => {
    it('calls generateToken with correct scopes and returns a token', async () => {
      const svc = makeService();
      const before = Math.floor(Date.now() / 1_000);

      const result = await svc.generateToken({
        tenantId: FAKE_TENANT_ID,
        containerId: 'order-abc',
        userId: 'user-1',
        userName: 'Alice',
      });

      expect(result.token).toBe('stub-fluid-jwt');
      expect(result.tenantId).toBe(FAKE_TENANT_ID);
      // expiresAt should be ~now + 3600 (default lifetime)
      expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3_600);
      expect(result.expiresAt).toBeLessThanOrEqual(before + 3_600 + 5);
    });

    it('passes custom lifetime to expiresAt calculation', async () => {
      const svc = makeService();
      const before = Math.floor(Date.now() / 1_000);

      const result = await svc.generateToken({
        tenantId: FAKE_TENANT_ID,
        containerId: undefined,
        userId: 'user-2',
        userName: 'Bob',
        lifetime: 300,
      });

      expect(result.expiresAt).toBeGreaterThanOrEqual(before + 300);
      expect(result.expiresAt).toBeLessThanOrEqual(before + 300 + 5);
    });

    it('passes scopes correctly to the underlying generateToken call', async () => {
      const svc = makeService();

      await svc.generateToken({
        tenantId: FAKE_TENANT_ID,
        containerId: 'qc-xyz',
        userId: 'user-3',
        userName: 'Carol',
      });

      expect(mockGenerateToken).toHaveBeenCalledWith(
        FAKE_TENANT_ID,
        FAKE_KEY,
        expect.arrayContaining(['doc:read', 'doc:write', 'summary:write']),
        'qc-xyz',
        { id: 'user-3', name: 'Carol' },
        3_600,
      );
    });
  });

  // ── key caching ───────────────────────────────────────────────────────────

  describe('key caching', () => {
    it('fetches the key only once within the cache window', async () => {
      const svc = makeService();

      await svc.generateToken({ tenantId: FAKE_TENANT_ID, containerId: undefined, userId: 'u', userName: 'U' });
      await svc.generateToken({ tenantId: FAKE_TENANT_ID, containerId: undefined, userId: 'u', userName: 'U' });

      // getSecret should only have been called once — second call hits cache
      expect(mockGetSecret).toHaveBeenCalledTimes(1);
    });

    it('re-fetches when the cache has expired', async () => {
      const svc = makeService();

      await svc.generateToken({ tenantId: FAKE_TENANT_ID, containerId: undefined, userId: 'u', userName: 'U' });

      // Backdate the keyFetchedAt to simulate expiry (access private field via casting)
      (svc as any).keyFetchedAt = Date.now() - 6 * 60 * 1_000; // 6 minutes ago

      await svc.generateToken({ tenantId: FAKE_TENANT_ID, containerId: undefined, userId: 'u', userName: 'U' });

      expect(mockGetSecret).toHaveBeenCalledTimes(2);
    });

    it('throws a clear error when the Key Vault secret value is empty', async () => {
      process.env.KEY_VAULT_URL = FAKE_KEY_VAULT_URL;
      mockGetSecret.mockResolvedValue({ value: '' });
      const svc = new CollaborationService();

      await expect(
        svc.generateToken({ tenantId: FAKE_TENANT_ID, containerId: undefined, userId: 'u', userName: 'U' }),
      ).rejects.toThrow('fluid-relay-key');
    });

    it('throws when getSecret rejects (Key Vault unreachable)', async () => {
      process.env.KEY_VAULT_URL = FAKE_KEY_VAULT_URL;
      mockGetSecret.mockRejectedValue(new Error('Network error'));
      const svc = new CollaborationService();

      await expect(
        svc.generateToken({ tenantId: FAKE_TENANT_ID, containerId: undefined, userId: 'u', userName: 'U' }),
      ).rejects.toThrow('Network error');
    });
  });
});
