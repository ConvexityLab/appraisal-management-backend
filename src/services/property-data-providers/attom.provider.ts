/**
 * ATTOM Data Solutions Property Data Provider — STUB
 *
 * Interface-complete placeholder. All methods throw NotImplementedError with
 * clear instructions for wiring in the real implementation.
 *
 * To implement:
 *   1. Set ATTOM_API_KEY in environment (obtain from https://api.attomdata.com)
 *   2. Replace this stub with a real implementation that calls:
 *      GET https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address=...
 *      GET https://api.gateway.attomdata.com/propertyapi/v1.0.0/assessment/detail?...
 *   3. Register the provider in factory.ts alongside Bridge.
 *
 * ATTOM covers 155M+ US property records including:
 *   - Building characteristics (GLA, beds, baths, year built)
 *   - Tax assessment & ownership (APN, assessed value, owner, legal desc)
 *   - FEMA flood zone
 *   - Deed transfer history
 */

import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
} from '../../types/property-data.types.js';
import { Logger } from '../../utils/logger.js';

export class AttomPropertyDataProvider implements PropertyDataProvider {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('AttomPropertyDataProvider');
  }

  async lookupByAddress(_params: PropertyDataLookupParams): Promise<PropertyDataResult | null> {
    const apiKey = process.env.ATTOM_API_KEY;
    if (!apiKey) {
      throw new Error(
        'AttomPropertyDataProvider: ATTOM_API_KEY environment variable is not set. ' +
        'Obtain an API key at https://api.attomdata.com and set ATTOM_API_KEY to use ATTOM data.',
      );
    }

    // TODO: implement real ATTOM API calls
    //   GET https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail
    //       ?address={street}&address2={city} {state} {zip}&accept=application/json
    //       Authorization: apikey {ATTOM_API_KEY}
    throw new Error(
      'AttomPropertyDataProvider is not yet implemented. ' +
      'See src/services/property-data-providers/attom.provider.ts for implementation instructions.',
    );
  }
}
