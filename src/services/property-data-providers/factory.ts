/**
 * Property Data Provider Factory
 *
 * Selects and composes PropertyDataProvider implementations based on
 * available environment configuration.
 *
 * Resolution order (highest priority first):
 *   1. LocalAttomPropertyDataProvider — when COSMOS_ENDPOINT (or
 *      AZURE_COSMOS_ENDPOINT) is set, queries the bulk-imported `attom-data`
 *      Cosmos container before any live API call.
 *   2. BridgePropertyDataProvider     — when BRIDGE_SERVER_TOKEN is set.
 *   3. AttomPropertyDataProvider      — when ATTOM_API_KEY is set.
 *
 * Active providers are wrapped in a ChainedPropertyDataProvider when more
 * than one is enabled (first non-null result wins). When none are enabled
 * the factory returns a NullPropertyDataProvider that logs a warning on
 * every lookup.
 *
 * Usage:
 *   const provider = createPropertyDataProvider(initializedCosmosDbService);
 *   const result = await provider.lookupByAddress({ street, city, state, zipCode });
 *
 * Note: `cosmos` is required when COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT is set.
 * Pass the already-initialized CosmosDbService instance — do not let the factory
 * create its own, as the new instance would never have initialize() called on it.
 */

import type { PropertyDataProvider } from '../../types/property-data.types.js';
import { LocalAttomPropertyDataProvider } from './local-attom.provider.js';
import { BridgePropertyDataProvider } from './bridge.provider.js';
import { AttomPropertyDataProvider } from './attom.provider.js';
import { ChainedPropertyDataProvider } from './chained.provider.js';
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

  // Build the ordered chain of enabled providers. Order is intentional:
  // Cosmos first to avoid live API calls when the bulk-imported cache
  // already has the subject.
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
  if (hasBridge) {
    chain.push(new BridgePropertyDataProvider());
    chainNames.push('Bridge Interactive');
  }
  if (hasAttom) {
    // AttomPropertyDataProvider now goes through AttomProviderService, which
    // wraps the live AttomService with a Cosmos-backed cache. Cosmos is therefore
    // required when ATTOM_API_KEY is set. Fail loudly rather than silently
    // skipping ATTOM, so misconfiguration is obvious.
    if (!cosmos) {
      throw new Error(
        'createPropertyDataProvider: a CosmosDbService instance must be provided when ' +
          'ATTOM_API_KEY is set (required by the cached AttomProviderService chain)',
      );
    }
    const attomCache = new PropertyDataCacheService(cosmos);
    const attomProviderService = new AttomProviderService(attomCache, new AttomService());
    chain.push(new AttomPropertyDataProvider(attomProviderService));
    chainNames.push('ATTOM Data Solutions');
  }

  if (chain.length === 0) {
    logger.warn(
      'Property data provider: None configured (NullPropertyDataProvider). ' +
        'Set COSMOS_ENDPOINT, BRIDGE_SERVER_TOKEN, or ATTOM_API_KEY to enable subject property enrichment.',
    );
    return new NullPropertyDataProvider();
  }

  if (chain.length === 1) {
    logger.info(`Property data provider: ${chainNames[0]}`);
    return chain[0]!;
  }

  logger.info(`Property data provider chain: ${chainNames.join(' → ')}`);
  return new ChainedPropertyDataProvider(chain);
}

