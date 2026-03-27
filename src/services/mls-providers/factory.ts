/**
 * MLS Provider Factory
 *
 * Selects the appropriate MlsDataProvider implementation based on available
 * environment configuration.  Callers never need to import a concrete provider
 * directly — wire this factory and swap providers by changing env vars.
 *
 * Resolution order:
 *   1. BRIDGE_SERVER_TOKEN set → BridgeInteractiveMlsProvider (live MLS data)
 *   2. Otherwise             → SeededMlsDataProvider (deterministic seed data)
 *
 * Usage:
 *   const provider = createMlsProvider();
 *   const listings = await provider.searchSoldListings({ ... });
 */

import type { MlsDataProvider } from '../../types/mls-data.types.js';
import { BridgeInteractiveMlsProvider } from './bridge.provider.js';
import { SeededMlsDataProvider } from '../seeded-mls-data-provider.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('MlsProviderFactory');

/**
 * Return a configured MlsDataProvider.
 * This is a factory function (not a singleton) so callers that need different
 * configurations can call it multiple times.
 */
export function createMlsProvider(): MlsDataProvider {
  if (process.env.BRIDGE_SERVER_TOKEN) {
    logger.info('MLS provider: Bridge Interactive (live data)');
    return new BridgeInteractiveMlsProvider();
  }

  logger.info('MLS provider: SeededMlsDataProvider (no BRIDGE_SERVER_TOKEN configured)');
  return new SeededMlsDataProvider();
}
