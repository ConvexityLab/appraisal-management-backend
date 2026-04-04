/**
 * Property Data Provider Factory
 *
 * Selects the appropriate PropertyDataProvider implementation based on
 * available environment configuration.
 *
 * Resolution order:
 *   1. BRIDGE_SERVER_TOKEN + ATTOM_API_KEY → ChainedPropertyDataProvider
 *        (Bridge as primary MLS source, ATTOM as public-records fallback)
 *   2. BRIDGE_SERVER_TOKEN only            → BridgePropertyDataProvider
 *   3. ATTOM_API_KEY only                  → AttomPropertyDataProvider
 *   4. Neither                             → NullPropertyDataProvider (logs warning)
 *
 * Usage:
 *   const provider = createPropertyDataProvider();
 *   const result = await provider.lookupByAddress({ street, city, state, zipCode });
 */

import type { PropertyDataProvider } from '../../types/property-data.types.js';
import { BridgePropertyDataProvider } from './bridge.provider.js';
import { AttomPropertyDataProvider } from './attom.provider.js';
import { ChainedPropertyDataProvider } from './chained.provider.js';
import { NullPropertyDataProvider } from './null.provider.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('PropertyDataProviderFactory');

export function createPropertyDataProvider(): PropertyDataProvider {
  const hasBridge = Boolean(process.env.BRIDGE_SERVER_TOKEN);
  const hasAttom = Boolean(process.env.ATTOM_API_KEY);

  if (hasBridge && hasAttom) {
    logger.info('Property data provider: Chained (Bridge Interactive → ATTOM Data Solutions)');
    return new ChainedPropertyDataProvider([
      new BridgePropertyDataProvider(),
      new AttomPropertyDataProvider(),
    ]);
  }

  if (hasBridge) {
    logger.info('Property data provider: Bridge Interactive (live data)');
    return new BridgePropertyDataProvider();
  }

  if (hasAttom) {
    logger.info('Property data provider: ATTOM Data Solutions (live data)');
    return new AttomPropertyDataProvider();
  }

  logger.warn(
    'Property data provider: None configured (NullPropertyDataProvider). ' +
    'Set BRIDGE_SERVER_TOKEN, ATTOM_API_KEY, or both to enable live subject property enrichment.',
  );
  return new NullPropertyDataProvider();
}

