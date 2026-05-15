/**
 * Unit tests for createPropertyDataProvider (factory)
 *
 * Verifies that the factory composes the correct provider stack based
 * on which env vars are set:
 *   COSMOS_ENDPOINT       → LocalAttomPropertyDataProvider
 *   ATTOM_API_KEY         → AttomPropertyDataProvider
 *   BRIDGE_SERVER_TOKEN   → BridgePropertyDataProvider
 *
 * Composition: when ≥2 providers are enabled they are wrapped in a
 * MergingPropertyDataProvider so every provider is consulted and results
 * are field-merged (earlier providers win on overlap). Order is
 * ATTOM-first: LocalAttom → live ATTOM → Bridge — so ATTOM fields beat
 * Bridge fields where both supply them, and Bridge contributes MLS-only
 * fields ATTOM doesn't carry.
 *
 * Single provider → returned directly (no merging wrapper).
 * Zero providers → NullPropertyDataProvider.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock the constructors so we don't instantiate real CosmosDbService etc. ──
vi.mock('../../src/services/property-data-providers/local-attom.provider.js', () => ({
  LocalAttomPropertyDataProvider: vi.fn().mockImplementation(() => ({
    __kind: 'local-attom',
    lookupByAddress: vi.fn(),
  })),
}));
vi.mock('../../src/services/property-data-providers/bridge.provider.js', () => ({
  BridgePropertyDataProvider: vi.fn().mockImplementation(() => ({
    __kind: 'bridge',
    lookupByAddress: vi.fn(),
  })),
}));
vi.mock('../../src/services/property-data-providers/attom.provider.js', () => ({
  AttomPropertyDataProvider: vi.fn().mockImplementation(() => ({
    __kind: 'attom',
    lookupByAddress: vi.fn(),
  })),
}));
vi.mock('../../src/utils/logger.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  })),
}));

import { createPropertyDataProvider } from '../../src/services/property-data-providers/factory.js';
import { MergingPropertyDataProvider } from '../../src/services/property-data-providers/merging.provider.js';
import { NullPropertyDataProvider } from '../../src/services/property-data-providers/null.provider.js';

const ENV_KEYS = [
  'COSMOS_ENDPOINT',
  'AZURE_COSMOS_ENDPOINT',
  'BRIDGE_SERVER_TOKEN',
  'ATTOM_API_KEY',
] as const;

function clearProviderEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe('createPropertyDataProvider', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
    clearProviderEnv();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it('returns NullPropertyDataProvider when no env vars are set', () => {
    const provider = createPropertyDataProvider();
    expect(provider).toBeInstanceOf(NullPropertyDataProvider);
  });

  it('returns LocalAttom alone when only COSMOS_ENDPOINT is set', () => {
    process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com';

    const provider = createPropertyDataProvider({} as never) as { __kind?: string };

    expect(provider).not.toBeInstanceOf(MergingPropertyDataProvider);
    expect(provider.__kind).toBe('local-attom');
  });

  it('also accepts AZURE_COSMOS_ENDPOINT as the Cosmos enable flag', () => {
    process.env.AZURE_COSMOS_ENDPOINT = 'https://example.documents.azure.com';

    const provider = createPropertyDataProvider({} as never) as { __kind?: string };

    expect(provider.__kind).toBe('local-attom');
  });

  it('returns Bridge alone when only BRIDGE_SERVER_TOKEN is set', () => {
    process.env.BRIDGE_SERVER_TOKEN = 'bridge-token';

    const provider = createPropertyDataProvider() as { __kind?: string };

    expect(provider).not.toBeInstanceOf(MergingPropertyDataProvider);
    expect(provider.__kind).toBe('bridge');
  });

  it('returns Attom alone when only ATTOM_API_KEY is set', () => {
    process.env.ATTOM_API_KEY = 'attom-key';

    // ATTOM requires a CosmosDbService instance for its property-data cache.
    const provider = createPropertyDataProvider({} as never) as { __kind?: string };

    expect(provider).not.toBeInstanceOf(MergingPropertyDataProvider);
    expect(provider.__kind).toBe('attom');
  });

  it('merges LocalAttom → Attom → Bridge (ATTOM-first) when all three are configured', () => {
    process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com';
    process.env.BRIDGE_SERVER_TOKEN = 'bridge-token';
    process.env.ATTOM_API_KEY = 'attom-key';

    const provider = createPropertyDataProvider({} as never);

    expect(provider).toBeInstanceOf(MergingPropertyDataProvider);
    // Use the private `providers` field via cast — it's the public contract
    // expressed as readonly state that we need to assert ordering on.
    const inner = (provider as unknown as {
      providers: Array<{ __kind: string }>;
    }).providers;
    // ATTOM-first: LocalAttom (cached ATTOM) → live ATTOM → Bridge. Bridge
    // is last so its values lose to ATTOM on field overlap but it still
    // contributes MLS-only fields ATTOM doesn't carry.
    expect(inner.map((p) => p.__kind)).toEqual(['local-attom', 'attom', 'bridge']);
  });

  it('merges LocalAttom → Bridge when COSMOS + BRIDGE are set (Attom omitted)', () => {
    process.env.COSMOS_ENDPOINT = 'https://example.documents.azure.com';
    process.env.BRIDGE_SERVER_TOKEN = 'bridge-token';

    const provider = createPropertyDataProvider({} as never);

    expect(provider).toBeInstanceOf(MergingPropertyDataProvider);
    const inner = (provider as unknown as {
      providers: Array<{ __kind: string }>;
    }).providers;
    expect(inner.map((p) => p.__kind)).toEqual(['local-attom', 'bridge']);
  });

  it('merges Attom → Bridge (ATTOM ahead of Bridge) when COSMOS is not set', () => {
    process.env.BRIDGE_SERVER_TOKEN = 'bridge-token';
    process.env.ATTOM_API_KEY = 'attom-key';

    // ATTOM always requires a CosmosDbService instance for its property-data cache.
    // COSMOS_ENDPOINT is not set, so LocalAttom is excluded from the merge.
    const provider = createPropertyDataProvider({} as never);

    expect(provider).toBeInstanceOf(MergingPropertyDataProvider);
    const inner = (provider as unknown as {
      providers: Array<{ __kind: string }>;
    }).providers;
    expect(inner.map((p) => p.__kind)).toEqual(['attom', 'bridge']);
  });
});
