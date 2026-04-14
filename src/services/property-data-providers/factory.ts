/**
 * Property Data Provider Factory
 *
 * Selects the appropriate PropertyDataProvider implementation based on
 * available environment configuration.
 *
 * Resolution order:
 *   1. BRIDGE_SERVER_TOKEN + ATTOM_API_KEY → MergingPropertyDataProvider
 *        (Bridge + ATTOM run concurrently; results merged field-by-field so
 *        Bridge's MLS characteristics are preferred but ATTOM fills in APN,
 *        tax assessment, flood zone, ownership, and deed data that Bridge misses)
 *   2. BRIDGE_SERVER_TOKEN only            → BridgePropertyDataProvider
 *   3. ATTOM_API_KEY or cache present      → AttomPropertyDataProvider (cache-first)
 *   4. Neither                             → NullPropertyDataProvider (logs warning)
 *
 * AttomPropertyDataProvider always uses the property-data-cache as its primary
 * source and falls back to the live ATTOM API only when ATTOM_API_KEY is set.
 *
 * NOTE: MergingPropertyDataProvider is used (not ChainedPropertyDataProvider) when both
 * keys are present.  The chain short-circuits on the first non-null result, which means
 * ATTOM data (APN, tax, flood, ownership) would be silently discarded whenever Bridge
 * found ANY match — even a thin one with no public-record fields.
 *
 * Usage:
 *   const provider = createPropertyDataProvider(cosmosService);
 *   const result = await provider.lookupByAddress({ street, city, state, zipCode });
 */

import type { PropertyDataProvider } from '../../types/property-data.types.js';
import type { CosmosDbService } from '../cosmos-db.service.js';
import { BridgePropertyDataProvider } from './bridge.provider.js';
import { AttomPropertyDataProvider } from './attom.provider.js';
import { MergingPropertyDataProvider } from './merging.provider.js';
import { NullPropertyDataProvider } from './null.provider.js';
import { PropertyDataCacheService } from '../property-data-cache.service.js';
import { AttomProviderService } from '../attom-provider.service.js';
import { AttomService } from '../attom.service.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('PropertyDataProviderFactory');

export function createPropertyDataProvider(cosmos: CosmosDbService): PropertyDataProvider {
  const hasBridge = Boolean(process.env.BRIDGE_SERVER_TOKEN);
  const hasAttom = Boolean(process.env.ATTOM_API_KEY);

  // Always build the cache-backed ATTOM provider; live fallback is optional.
  const cache = new PropertyDataCacheService(cosmos);
  const attomService = hasAttom ? new AttomService() : null;
  const attomProvider = new AttomProviderService(cache, attomService);

  if (hasBridge && hasAttom) {
    logger.info(
      'Property data provider: Merging (Bridge Interactive ⊕ ATTOM Data Solutions — ' +
      'concurrent lookup, field-level merge; Bridge preferred for physical characteristics)',
    );
    return new MergingPropertyDataProvider([
      new BridgePropertyDataProvider(),
      new AttomPropertyDataProvider(attomProvider),
    ]);
  }

  if (hasBridge) {
    logger.info('Property data provider: Bridge Interactive (live data)');
    return new BridgePropertyDataProvider();
  }

  // Use ATTOM provider (cache-first) whenever the cache is available, regardless
  // of whether the live API key is also configured.
  logger.info(
    hasAttom
      ? 'Property data provider: ATTOM Data Solutions (cache-first, live fallback enabled)'
      : 'Property data provider: ATTOM Data Solutions (cache-only — ATTOM_API_KEY not set)',
  );
  return new AttomPropertyDataProvider(attomProvider);
}

