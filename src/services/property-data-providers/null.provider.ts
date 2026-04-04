/**
 * Null Property Data Provider
 *
 * Returns null for every lookup (no data available).
 * Used as a safe fallback when no real provider is configured.
 * Emits a warning so the absence of enrichment is visible in logs.
 */

import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
} from '../../types/property-data.types.js';
import { Logger } from '../../utils/logger.js';

export class NullPropertyDataProvider implements PropertyDataProvider {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('NullPropertyDataProvider');
  }

  async lookupByAddress(params: PropertyDataLookupParams): Promise<PropertyDataResult | null> {
    this.logger.warn(
      'NullPropertyDataProvider: no property data provider is configured. ' +
      'Set BRIDGE_SERVER_TOKEN to enable Bridge Interactive lookups, or ' +
      'ATTOM_API_KEY to enable ATTOM Data Solutions lookups. ' +
      'Property data enrichment will be skipped for this order.',
      { address: `${params.street}, ${params.city}, ${params.state} ${params.zipCode}` },
    );
    return null;
  }
}
