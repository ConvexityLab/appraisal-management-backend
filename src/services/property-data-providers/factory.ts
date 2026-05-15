/**
 * Property Data Provider Factory
 *
 * Selects and composes PropertyDataProvider implementations based on
 * available environment configuration.
 *
 * Composition: when ≥2 providers are enabled they are wrapped in
 * MergingPropertyDataProvider — every configured provider is consulted
 * concurrently and the results are field-merged. Earlier providers in
 * the list win on field overlap; later providers fill gaps. This lets
 * ATTOM contribute APN / tax / flood / owner data even when Bridge
 * already returned a result for the same address (the prior
 * Chained-first-non-null behaviour silently dropped that data).
 *
 * Provider order (ATTOM-first, as it carries the broader public-records
 * dataset; Bridge fills the residual MLS-only gaps):
 *
 *   1. LocalAttomPropertyDataProvider — when COSMOS_ENDPOINT (or
 *      AZURE_COSMOS_ENDPOINT) is set. Bulk-imported ATTOM cache; cheapest.
 *   2. AttomPropertyDataProvider      — when ATTOM_API_KEY is set. Live
 *      ATTOM API; fills addresses the bulk cache missed.
 *   3. BridgePropertyDataProvider     — when BRIDGE_SERVER_TOKEN is set.
 *      MLS-linked data; fills MLS-only fields ATTOM doesn't carry.
 *
 * When exactly one provider is enabled it is returned directly (no
 * Merging wrapper — single-provider results round-trip unchanged).
 * When none are enabled the factory returns NullPropertyDataProvider
 * that logs a warning on every lookup.
 *
 * Per-tenant priority overrides are a planned follow-up
 * (`/admin/property-data-waterfall` — see SCORECARD_VS_VEROSCORE.md).
 * Until that ships, env-var presence determines composition.
 *
 * Usage:
 *   const provider = createPropertyDataProvider(initializedCosmosDbService);
 *   const result = await provider.lookupByAddress({ street, city, state, zipCode });
 *
 * Note: `cosmos` is required when COSMOS_ENDPOINT, AZURE_COSMOS_ENDPOINT,
 * or ATTOM_API_KEY is set. Pass the already-initialized CosmosDbService
 * instance — do not let the factory create its own, as the new instance
 * would never have initialize() called on it.
 *
 * ATTOM requires cosmos for its property-data cache even when LocalAttom
 * is not enabled.
 */

import type { PropertyDataProvider } from '../../types/property-data.types.js';
import { LocalAttomPropertyDataProvider } from './local-attom.provider.js';
import { BridgePropertyDataProvider } from './bridge.provider.js';
import { AttomPropertyDataProvider } from './attom.provider.js';
import { MergingPropertyDataProvider } from './merging.provider.js';
import { NullPropertyDataProvider } from './null.provider.js';
import { CosmosDbService } from '../cosmos-db.service.js';
import { AttomProviderService } from '../attom-provider.service.js';
import { AttomService } from '../attom.service.js';
import { PropertyDataCacheService } from '../property-data-cache.service.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('PropertyDataProviderFactory');

export function createPropertyDataProvider(cosmos?: CosmosDbService): PropertyDataProvider {
  const hasCosmos = Boolean(
    process.env.COSMOS_ENDPOINT || process.env.AZURE_COSMOS_ENDPOINT,
  );
  const hasBridge = Boolean(process.env.BRIDGE_SERVER_TOKEN);
  const hasAttom = Boolean(process.env.ATTOM_API_KEY);

  // ATTOM-first order: LocalAttom (cache) → live ATTOM → Bridge.
  // For shared fields, earlier providers win (so ATTOM fields beat
  // Bridge fields on overlap). Bridge still contributes MLS-only fields
  // ATTOM doesn't carry.
  const chain: PropertyDataProvider[] = [];
  const chainNames: string[] = [];

  if (hasCosmos) {
    if (!cosmos) {
      throw new Error(
        'createPropertyDataProvider: a CosmosDbService instance must be provided when ' +
          'COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT is set',
      );
    }
    chain.push(new LocalAttomPropertyDataProvider(cosmos));
    chainNames.push('LocalAttom (Cosmos)');
  }
  if (hasAttom) {
    // AttomPropertyDataProvider goes through AttomProviderService, which can
    // optionally wrap the live AttomService with a Cosmos-backed cache.
    // When Cosmos isn't configured, run cache-less (degrades to direct
    // AttomService calls) — preserves the legacy "Attom-only without Cosmos"
    // configuration for environments that don't run a Cosmos cache.
    const attomCache = cosmos ? new PropertyDataCacheService(cosmos) : null;
    const attomProviderService = new AttomProviderService(attomCache, new AttomService());
    chain.push(new AttomPropertyDataProvider(attomProviderService));
    chainNames.push(attomCache ? 'ATTOM Data Solutions (cached)' : 'ATTOM Data Solutions');
  }
  if (hasBridge) {
    chain.push(new BridgePropertyDataProvider());
    chainNames.push('Bridge Interactive');
  }

  if (chain.length === 0) {
    logger.warn(
      'Property data provider: None configured (NullPropertyDataProvider). ' +
        'Set COSMOS_ENDPOINT, ATTOM_API_KEY, or BRIDGE_SERVER_TOKEN to enable subject property enrichment.',
    );
    return new NullPropertyDataProvider();
  }

  if (chain.length === 1) {
    logger.info(`Property data provider: ${chainNames[0]}`);
    return chain[0]!;
  }

  logger.info(`Property data provider merge order: ${chainNames.join(' → ')}`);
  return new MergingPropertyDataProvider(chain);
}

