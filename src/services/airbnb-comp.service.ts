/**
 * Airbnb Listing Comp Discovery Service
 *
 * Queries publicly available Airbnb listing data by lat/lng radius to discover
 * comparable active STR listings for the STR Feasibility report.
 *
 * Airbnb exposes listing search via its public search API endpoint (no
 * authentication required for public listing data).  This service targets:
 *   https://www.airbnb.com/api/v3/ExploreSearch
 *
 * NOTE: Airbnb's public search API is not officially documented and may change.
 * If it becomes unavailable, fall back to InsideAirbnbService for covered cities
 * or AirRoiService.getNearbyComps() which is the primary comp source.
 *
 * No API key required — uses Airbnb's public listing search.
 */

import { Logger } from '../utils/logger.js';
import type { StrComparable } from '../types/str-feasibility.types.js';

// Airbnb search API constants — update if Airbnb rotates their client ID.
const AIRBNB_BASE_URL    = 'https://www.airbnb.com';
const AIRBNB_API_VERSION = 'v3';

interface AirbnbListing {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  country: string;
  pricing_quote?: {
    rate?: { amount: number; currency: string };
    cleaning_fee?: { amount: number };
  };
  room_and_property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  person_capacity?: number;
  amenity_ids?: number[];
  listing_url?: string;
  primary_host?: { about?: string };
}

interface AirbnbSearchResponse {
  explore_tabs?: Array<{
    sections?: Array<{
      listings?: Array<{ listing: AirbnbListing }>;
    }>;
  }>;
}

export class AirbnbCompService {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('AirbnbCompService');
  }

  /**
   * Search for nearby active Airbnb listings by lat/lng.
   * Returns up to `limit` comparable listings mapped to StrComparable[].
   *
   * @param latitude   Subject latitude
   * @param longitude  Subject longitude
   * @param bedrooms   Subject bedroom count (used for similarity filtering)
   * @param radiusMiles Radius for comp search (approximate — Airbnb uses bbox)
   * @param limit      Maximum comps to return
   */
  async getNearbyListings(params: {
    latitude: number;
    longitude: number;
    bedrooms?: number;
    radiusMiles?: number;
    limit?: number;
  }): Promise<StrComparable[]> {
    const { latitude, longitude, bedrooms, radiusMiles = 1.0, limit = 5 } = params;

    const bbox = this.buildBbox(latitude, longitude, radiusMiles);

    const query = new URLSearchParams({
      operationName:  'ExploreSearch',
      locale:         'en',
      currency:       'USD',
      'variables[search][neLat]':  String(bbox.neLat),
      'variables[search][neLng]':  String(bbox.neLng),
      'variables[search][swLat]':  String(bbox.swLat),
      'variables[search][swLng]':  String(bbox.swLng),
      'variables[search][minBedrooms]': String(bedrooms ?? 1),
      'variables[search][itemsPerGrid]': String(limit * 2), // over-fetch to allow quality filtering
    });

    let raw: AirbnbSearchResponse;
    try {
      raw = await this.searchListings(query);
    } catch (err) {
      this.logger.warn('AirbnbCompService: search failed — returning empty comp list', { err });
      return [];
    }

    const listings = this.extractListings(raw);
    return listings
      .slice(0, limit)
      .map((l, i) => this.mapListing(l, i + 1, latitude, longitude));
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async searchListings(query: URLSearchParams): Promise<AirbnbSearchResponse> {
    const url = `${AIRBNB_BASE_URL}/api/${AIRBNB_API_VERSION}/ExploreSearch?${query.toString()}`;
    this.logger.debug('AirbnbCompService: GET', { url });

    const response = await fetch(url, {
      headers: {
        'Accept':          'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':      'Mozilla/5.0 (compatible; L1ValuationPlatform/1.0)',
        'X-Airbnb-API-Key': process.env.AIRBNB_API_KEY ?? '', // Optional — improves reliability
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)');
      throw new Error(
        `Airbnb search error: HTTP ${response.status} ${response.statusText} — ${body}`,
      );
    }

    return response.json() as Promise<AirbnbSearchResponse>;
  }

  private extractListings(response: AirbnbSearchResponse): AirbnbListing[] {
    const listings: AirbnbListing[] = [];
    for (const tab of response.explore_tabs ?? []) {
      for (const section of tab.sections ?? []) {
        for (const item of section.listings ?? []) {
          if (item.listing) listings.push(item.listing);
        }
      }
    }
    return listings;
  }

  private mapListing(
    l: AirbnbListing,
    compNumber: number,
    subjectLat: number,
    subjectLng: number,
  ): StrComparable {
    const adr = l.pricing_quote?.rate?.amount ?? 0;

    return {
      compNumber,
      listingName:             l.name,
      address:                 '',  // Airbnb hides exact address on search results
      city:                    l.city  ?? '',
      state:                   l.state ?? '',
      postalCode:              '',
      latitude:                l.latitude,
      longitude:               l.longitude,
      distanceFromSubjectMiles: this.haversineDistanceMiles(
        subjectLat, subjectLng, l.latitude, l.longitude,
      ),
      dataSource:              'Airbnb',
      platformListingId:       l.id,
      platformListingUrl:      `https://www.airbnb.com/rooms/${l.id}`,
      bedrooms:                l.bedrooms  ?? 0,
      bathrooms:               l.bathrooms ?? 0,
      ...(l.person_capacity !== undefined && { maxGuests: l.person_capacity }),
      amenities:               [],  // amenity_ids require a separate lookup
      averageDailyRate:        Math.round(adr),
      occupancyRate:           0,   // Not available from search result — enriched downstream
      estimatedMonthlyRevenue: 0,   // Not available from search result
      ...(l.pricing_quote?.cleaning_fee?.amount !== undefined && { cleaningFee: l.pricing_quote.cleaning_fee.amount }),
    };
  }

  /**
   * Build a bounding box ~radiusMiles around a point.
   * 1 degree latitude ≈ 69 miles; longitude degree varies by latitude.
   */
  private buildBbox(lat: number, lng: number, radiusMiles: number) {
    const latDelta = radiusMiles / 69.0;
    const lngDelta = radiusMiles / (69.0 * Math.cos((lat * Math.PI) / 180));
    return {
      neLat: lat + latDelta,
      neLng: lng + lngDelta,
      swLat: lat - latDelta,
      swLng: lng - lngDelta,
    };
  }

  /** Haversine great-circle distance in miles */
  private haversineDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3958.8; // Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
