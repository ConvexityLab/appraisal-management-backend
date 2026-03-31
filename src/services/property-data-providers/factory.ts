/**
 * Property Data Provider Factory
 *
 * Selects the appropriate PropertyDataProvider implementation based on
 * available environment configuration.
 *
 * Resolution order:
 *   1. BRIDGE_SERVER_TOKEN set → BridgePropertyDataProvider (live MLS + public records)
 *   2. Otherwise              → NullPropertyDataProvider  (logs warning, skips enrichment)
 *
 * ATTOM slot is reserved — set ATTOM_API_KEY and uncomment the block below
 * once the ATTOM implementation is complete.
 *
 * Usage:
 *   const provider = createPropertyDataProvider();
 *   const result = await provider.lookupByAddress({ street, city, state, zipCode });
 */

import type { PropertyDataProvider } from '../../types/property-data.types.js';
import { BridgePropertyDataProvider } from './bridge.provider.js';
import { NullPropertyDataProvider } from './null.provider.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('PropertyDataProviderFactory');

export function createPropertyDataProvider(): PropertyDataProvider {
  if (process.env.BRIDGE_SERVER_TOKEN) {
    logger.info('Property data provider: Bridge Interactive (live data)');
    return new BridgePropertyDataProvider();
  }

  // ATTOM slot — uncomment when AttomPropertyDataProvider is implemented:
  // if (process.env.ATTOM_API_KEY) {
  //   logger.info('Property data provider: ATTOM Data Solutions');
  //   return new AttomPropertyDataProvider();
  // }

  logger.warn(
    'Property data provider: None configured (NullPropertyDataProvider). ' +
    'Set BRIDGE_SERVER_TOKEN to enable live subject property enrichment.',
  );
  return new NullPropertyDataProvider();
}
