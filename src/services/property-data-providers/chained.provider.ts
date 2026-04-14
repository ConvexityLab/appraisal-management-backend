/**
 * Chained Property Data Provider
 *
 * Tries each injected provider in order and returns the first non-null result.
 * Enables layered coverage: e.g. Bridge Interactive (MLS-linked AVM) as
 * primary, ATTOM (public-records only) as fallback.
 *
 * Usage (set both BRIDGE_SERVER_TOKEN and ATTOM_API_KEY):
 *   new ChainedPropertyDataProvider([
 *     new BridgePropertyDataProvider(),
 *     new AttomPropertyDataProvider(),
 *   ])
 *
 * Behaviour:
 *   - Calls providers in array order.
 *   - Returns the first non-null PropertyDataResult.
 *   - If a provider throws, logs a warning and continues to the next provider.
 *   - Returns null only when every provider returns null (or throws).
 */

import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
} from '../../types/property-data.types.js';
import { Logger } from '../../utils/logger.js';

export class ChainedPropertyDataProvider implements PropertyDataProvider {
  private readonly logger: Logger;

  constructor(private readonly providers: PropertyDataProvider[]) {
    if (providers.length === 0) {
      throw new Error('ChainedPropertyDataProvider: at least one provider is required');
    }
    this.logger = new Logger('ChainedPropertyDataProvider');
  }

  async lookupByAddress(params: PropertyDataLookupParams): Promise<PropertyDataResult | null> {
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i]!;
      const providerName = provider.constructor.name;

      let result: PropertyDataResult | null;
      try {
        result = await provider.lookupByAddress(params);
      } catch (err) {
        this.logger.warn(
          `ChainedPropertyDataProvider: provider[${i}] (${providerName}) threw — continuing to next`,
          {
            address: `${params.street}, ${params.city}, ${params.state} ${params.zipCode}`,
            error: err instanceof Error ? err.message : String(err),
          },
        );
        continue;
      }

      if (result !== null) {
        this.logger.info(
          `ChainedPropertyDataProvider: result from provider[${i}] (${providerName})`,
          {
            address: `${params.street}, ${params.city}, ${params.state} ${params.zipCode}`,
            source: result.source,
          },
        );
        return result;
      }

      this.logger.info(
        `ChainedPropertyDataProvider: provider[${i}] (${providerName}) returned null — trying next`,
        { address: `${params.street}, ${params.city}, ${params.state} ${params.zipCode}` },
      );
    }

    this.logger.info('ChainedPropertyDataProvider: all providers exhausted — no data found', {
      address: `${params.street}, ${params.city}, ${params.state} ${params.zipCode}`,
      providerCount: this.providers.length,
    });
    return null;
  }
}
