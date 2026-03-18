/**
 * Bridge Interactive MLS Provider
 *
 * Adapts BridgeInteractiveService to the generic MlsDataProvider interface,
 * eliminating vendor lock-in for services that consume MLS data.
 *
 * Map notes (Bridge OData → MlsListing):
 *   ListingKey          → id
 *   ListingId           → listingId
 *   UnparsedAddress     → address
 *   City / StateOrProvince / PostalCode → city / state / zipCode
 *   Coordinates         → GeoJSON [longitude, latitude]  (note reversed order)
 *   ClosePrice          → salePrice  (sold)
 *   ListPrice           → salePrice  (active)
 *   CloseDate           → saleDate   (sold)
 *   ListingContractDate → saleDate   (active — contract/list date)
 *   BedroomsTotal       → bedrooms
 *   BathroomsTotalDecimal → bathrooms
 *   LivingArea          → squareFootage
 *   LotSizeArea         → lotSize
 *   YearBuilt           → yearBuilt
 *   PropertyType/SubType → propertyType / propertySubType
 */

import type { MlsDataProvider, MlsListing, MlsSearchParams } from '../../types/mls-data.types.js';
import { BridgeInteractiveService } from '../bridge-interactive.service.js';
import { Logger } from '../../utils/logger.js';

export class BridgeInteractiveMlsProvider implements MlsDataProvider {
  private readonly bridge: BridgeInteractiveService;
  private readonly logger: Logger;

  constructor() {
    this.bridge = new BridgeInteractiveService();
    this.logger = new Logger('BridgeInteractiveMlsProvider');
  }

  async searchSoldListings(params: MlsSearchParams): Promise<MlsListing[]> {
    try {
      const raw = await this.bridge.getSoldComps({
        latitude: params.latitude,
        longitude: params.longitude,
        ...(params.radiusMiles !== undefined ? { radiusMiles: params.radiusMiles } : {}),
        ...(params.minPrice !== undefined ? { minPrice: params.minPrice } : {}),
        ...(params.maxPrice !== undefined ? { maxPrice: params.maxPrice } : {}),
        ...(params.minBeds !== undefined ? { minBeds: params.minBeds } : {}),
        ...(params.maxBeds !== undefined ? { maxBeds: params.maxBeds } : {}),
        ...(params.minBaths !== undefined ? { minBaths: params.minBaths } : {}),
        ...(params.maxBaths !== undefined ? { maxBaths: params.maxBaths } : {}),
        ...(params.minSqft !== undefined ? { minSqft: params.minSqft } : {}),
        ...(params.maxSqft !== undefined ? { maxSqft: params.maxSqft } : {}),
        ...(params.soldWithinDays !== undefined ? { soldWithinDays: params.soldWithinDays } : {}),
        ...(params.propertyType !== undefined ? { propertyType: params.propertyType } : {}),
        ...(params.limit !== undefined ? { limit: params.limit } : {}),
        ...(params.datasetId !== undefined ? { datasetId: params.datasetId } : {}),
      });

      return (raw as any[]).map(r => this.mapBridgePropertyToListing(r, 'sold'));
    } catch (error) {
      this.logger.error('BridgeInteractiveMlsProvider.searchSoldListings failed', { error, params });
      throw error;
    }
  }

  // ─── Internal mapper ────────────────────────────────────────────────────────

  private mapBridgePropertyToListing(
    raw: Record<string, unknown>,
    status: 'sold' | 'active',
  ): MlsListing {
    // Bridge Coordinates field is GeoJSON Point: [longitude, latitude]
    const coords = raw['Coordinates'] as [number, number] | undefined;
    const longitude = coords?.[0] ?? 0;
    const latitude = coords?.[1] ?? 0;

    const salePrice = status === 'sold'
      ? (raw['ClosePrice'] as number ?? 0)
      : (raw['ListPrice'] as number ?? 0);

    const saleDate = status === 'sold'
      ? ((raw['CloseDate'] as string | undefined) ?? new Date(0).toISOString().slice(0, 10))
      : ((raw['ListingContractDate'] as string | undefined) ?? new Date(0).toISOString().slice(0, 10));

    const listing: MlsListing = {
      id: (raw['ListingKey'] as string | undefined) ?? String(Math.random()),
      address: (raw['UnparsedAddress'] as string | undefined) ?? '',
      city: (raw['City'] as string | undefined) ?? '',
      state: (raw['StateOrProvince'] as string | undefined) ?? '',
      zipCode: (raw['PostalCode'] as string | undefined) ?? '',
      latitude,
      longitude,
      salePrice,
      saleDate,
      squareFootage: (raw['LivingArea'] as number | undefined) ?? 0,
      bedrooms: (raw['BedroomsTotal'] as number | undefined) ?? 0,
      bathrooms: (raw['BathroomsTotalDecimal'] as number | undefined) ?? 0,
      yearBuilt: (raw['YearBuilt'] as number | undefined) ?? 0,
      propertyType: (raw['PropertyType'] as string | undefined) ?? 'Residential',
      source: 'Bridge Interactive',
    };

    // Optional fields — only include when present to satisfy exactOptionalPropertyTypes
    const listingId = raw['ListingId'] as string | undefined;
    if (listingId !== undefined) listing.listingId = listingId;

    const lotSize = raw['LotSizeArea'] as number | undefined;
    if (lotSize !== undefined) listing.lotSize = lotSize;

    const subType = raw['PropertySubType'] as string | undefined;
    if (subType !== undefined) listing.propertySubType = subType;

    return listing;
  }
}
