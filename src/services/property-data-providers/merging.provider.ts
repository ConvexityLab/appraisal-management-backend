/**
 * Merging Property Data Provider
 *
 * Fires all configured providers concurrently and merges their results
 * field-by-field. For each field in core / publicRecord / flood, the
 * first non-null value across all results wins, so earlier providers
 * take precedence for fields they supply.
 *
 * Why this exists:
 *   Bridge Interactive has superior MLS-linked building characteristics
 *   (GLA, beds, baths, year built) but its public-records layer is
 *   thinner on APN, tax assessment, flood zone, ownership, and deed data.
 *   ATTOM Data Solutions fills exactly those gaps via its pre-populated
 *   cache (property-data-cache container).
 *
 *   ChainedPropertyDataProvider returns on the first non-null result —
 *   if Bridge succeeds, ATTOM is never consulted and all its data is lost.
 *   This class always consults ALL providers and merges the results.
 *
 * Provider order still matters: for any field present in both results,
 * the earlier provider's value is kept.  Pass providers as:
 *   [BridgePropertyDataProvider, AttomPropertyDataProvider]
 * so Bridge values are preferred for overlapping fields (e.g. grossLivingArea
 * from MLS is more accurate than the assessor's square footage).
 *
 * If every provider returns null the result is null (no match for address).
 * If a provider throws, the error is logged and the provider is skipped (same
 * behaviour as ChainedPropertyDataProvider for fault tolerance).
 */

import type {
  PropertyDataProvider,
  PropertyDataLookupParams,
  PropertyDataResult,
  PropertyDataCore,
  PropertyDataPublicRecord,
  PropertyDataFlood,
} from '../../types/property-data.types.js';
import { Logger } from '../../utils/logger.js';

export class MergingPropertyDataProvider implements PropertyDataProvider {
  private readonly logger: Logger;

  constructor(private readonly providers: PropertyDataProvider[]) {
    if (providers.length === 0) {
      throw new Error('MergingPropertyDataProvider: at least one provider is required');
    }
    this.logger = new Logger('MergingPropertyDataProvider');
  }

  async lookupByAddress(params: PropertyDataLookupParams): Promise<PropertyDataResult | null> {
    const address = `${params.street}, ${params.city}, ${params.state} ${params.zipCode}`;

    // Fire all providers concurrently — we always want data from every source.
    const settled = await Promise.allSettled(
      this.providers.map((p) => p.lookupByAddress(params)),
    );

    const results: PropertyDataResult[] = [];
    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]!;
      const providerName = this.providers[i]!.constructor.name;

      if (outcome.status === 'rejected') {
        this.logger.warn(
          `MergingPropertyDataProvider: provider[${i}] (${providerName}) threw — skipping`,
          {
            address,
            error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
          },
        );
      } else if (outcome.value === null) {
        this.logger.info(
          `MergingPropertyDataProvider: provider[${i}] (${providerName}) returned null`,
          { address },
        );
      } else {
        this.logger.info(
          `MergingPropertyDataProvider: provider[${i}] (${providerName}) returned data`,
          { address, source: outcome.value.source },
        );
        results.push(outcome.value);
      }
    }

    if (results.length === 0) {
      this.logger.info(
        'MergingPropertyDataProvider: all providers returned null or threw — no data found',
        { address },
      );
      return null;
    }

    if (results.length === 1) {
      // No merging needed — return the only result as-is.
      return results[0]!;
    }

    const merged = this.mergeResults(results);
    this.logger.info('MergingPropertyDataProvider: merged results from multiple providers', {
      address,
      providers: results.map((r) => r.source),
      mergedSource: merged.source,
    });
    return merged;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Merges two or more PropertyDataResult objects field-by-field.
   * For each field, the first non-null value encountered wins.
   * Provider order is preserved — earlier entries in `results` take precedence.
   */
  private mergeResults(results: PropertyDataResult[]): PropertyDataResult {
    const mergedCore: PropertyDataCore = {};
    const mergedPublicRecord: PropertyDataPublicRecord = {};
    const mergedFlood: PropertyDataFlood = {};

    for (const r of results) {
      if (r.core) {
        for (const [k, v] of Object.entries(r.core)) {
          if (v != null && (mergedCore as Record<string, unknown>)[k] == null) {
            (mergedCore as Record<string, unknown>)[k] = v;
          }
        }
      }

      if (r.publicRecord) {
        for (const [k, v] of Object.entries(r.publicRecord)) {
          if (v != null && (mergedPublicRecord as Record<string, unknown>)[k] == null) {
            (mergedPublicRecord as Record<string, unknown>)[k] = v;
          }
        }
      }

      if (r.flood) {
        for (const [k, v] of Object.entries(r.flood)) {
          if (v != null && (mergedFlood as Record<string, unknown>)[k] == null) {
            (mergedFlood as Record<string, unknown>)[k] = v;
          }
        }
      }
    }

    return {
      // Join provider names so logs and audit trail show all contributing sources.
      source: results.map((r) => r.source).join(' + '),
      fetchedAt: results[0]!.fetchedAt,
      core: mergedCore,
      publicRecord: mergedPublicRecord,
      flood: mergedFlood,
      // Retain raw data from every provider for traceability.
      rawProviderData: results.map((r) => ({
        source: r.source,
        data: r.rawProviderData,
      })),
    };
  }
}
