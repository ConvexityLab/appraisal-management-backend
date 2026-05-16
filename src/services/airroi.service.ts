/**
 * AirROI Pricing API Service
 *
 * Thin HTTP wrapper for the AirROI STR pricing and revenue API.
 * Documentation: https://www.airroi.com/api/pricing
 *
 * Authentication: Authorization: Bearer <token>
 * Base URL: https://api.airroi.com
 *
 * This is the PRIMARY projection source for STR Feasibility reports.
 * AirROI is purpose-built for lender underwriting and allows property-level
 * revenue/occupancy projections by address or lat/lng with comparable
 * filtering — producing more underwriter-defensible figures than AirDNA's
 * market-aggregate estimates.
 *
 * Environment variable required:
 *   AIRROI_API_KEY — obtain at https://www.airroi.com
 */

import { Logger } from '../utils/logger.js';
import type { StrProjection, StrComparable } from '../types/str-feasibility.types.js';

const BASE_URL = 'https://api.airroi.com';

// Raw shapes from AirROI API — mapped to our canonical types.
interface AirRoiPropertyEstimate {
  annual_revenue: number;       // gross projected annual revenue USD
  monthly_revenue: number;
  occupancy_rate: number;       // 0.0–1.0
  average_daily_rate: number;
  annual_expenses: number;
  peak_months: string[];
  off_peak_months: string[];
  comp_count: number;
  confidence_score?: number;    // 0–100
}

interface AirRoiComparable {
  listing_id: string;
  listing_url?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  bedrooms: number;
  bathrooms: number;
  max_guests?: number;
  sqft?: number;
  amenities?: string[];
  average_daily_rate: number;
  occupancy_rate: number;
  monthly_revenue: number;
  cleaning_fee?: number;
  management_fee_pct?: number;
  listing_name?: string;
  design?: string;
}

interface AirRoiCompsResponse {
  comps: AirRoiComparable[];
  total: number;
}

export class AirRoiService {
  private readonly apiKey: string;
  private readonly logger: Logger;

  constructor() {
    const key = process.env.AIRROI_API_KEY;
    if (!key) {
      throw new Error(
        'AirRoiService: AIRROI_API_KEY environment variable is not set. ' +
        'Obtain an API key at https://www.airroi.com and set AIRROI_API_KEY.',
      );
    }
    this.apiKey = key;
    this.logger = new Logger('AirRoiService');
  }

  /**
   * POST /pricing/estimate
   *
   * Returns a property-level STR revenue projection for use as the primary
   * underwriting figure.  AirROI allows analyst-controlled comp filtering
   * which produces more defensible numbers than market-aggregate tools.
   *
   * @param address   Full street address
   * @param city      City
   * @param state     Two-letter state code
   * @param zip       Postal code
   * @param bedrooms  Bedroom count
   * @param bathrooms Bathroom count
   */
  async getPropertyEstimate(params: {
    address: string;
    city: string;
    state: string;
    zip: string;
    bedrooms: number;
    bathrooms: number;
    maxGuests?: number;
    amenities?: string[];
    compRadiusMiles?: number;
  }): Promise<StrProjection> {
    const body = {
      address: params.address,
      city:    params.city,
      state:   params.state,
      zip:     params.zip,
      bedrooms:   params.bedrooms,
      bathrooms:  params.bathrooms,
      ...(params.maxGuests       ? { max_guests: params.maxGuests }           : {}),
      ...(params.amenities?.length ? { amenities: params.amenities }          : {}),
      ...(params.compRadiusMiles  ? { comp_radius_miles: params.compRadiusMiles } : {}),
    };

    const raw = await this.post<AirRoiPropertyEstimate>('/pricing/estimate', body);
    return this.mapEstimateToProjection(raw);
  }

  /**
   * POST /pricing/comps
   *
   * Returns nearby comparable active STR listings for the subject property.
   * These become the StrComparable[] in the feasibility order.
   */
  async getNearbyComps(params: {
    address: string;
    city: string;
    state: string;
    zip: string;
    bedrooms: number;
    bathrooms: number;
    radiusMiles?: number;
    limit?: number;
  }): Promise<StrComparable[]> {
    const body = {
      address:   params.address,
      city:      params.city,
      state:     params.state,
      zip:       params.zip,
      bedrooms:  params.bedrooms,
      bathrooms: params.bathrooms,
      radius_miles: params.radiusMiles ?? 1.0,
      limit:        params.limit       ?? 5,
    };

    const raw = await this.post<AirRoiCompsResponse>('/pricing/comps', body);
    return raw.comps.map((c, i) => this.mapComp(c, i + 1));
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`;
    this.logger.debug('AirRoiService: POST', { url });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept':        'application/json',
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '(unreadable)');
      throw new Error(
        `AirROI API error: HTTP ${response.status} ${response.statusText} — ${text}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private mapEstimateToProjection(raw: AirRoiPropertyEstimate): StrProjection {
    const revenue = raw.annual_revenue;
    const opex    = raw.annual_expenses;

    return {
      sourceName:             'AirROI',
      projectedAnnualRevenue:  Math.round(revenue),
      occupancyRate:           raw.occupancy_rate,       // 0.0–1.0
      averageDailyRate:        Math.round(raw.average_daily_rate),
      highSeasonMonths:        raw.peak_months    ?? [],
      lowSeasonMonths:         raw.off_peak_months ?? [],
      annualOperatingExpenses: Math.round(opex),
      estimatedNOI:            Math.round(revenue - opex),
      retrievedAt:             new Date().toISOString(),
    };
  }

  private mapComp(raw: AirRoiComparable, compNumber: number): StrComparable {
    return {
      compNumber,
      ...(raw.listing_name !== undefined && { listingName: raw.listing_name }),
      address:                    raw.address,
      city:                       raw.city,
      state:                      raw.state,
      postalCode:                  raw.zip,
      latitude:                   raw.latitude,
      longitude:                  raw.longitude,
      distanceFromSubjectMiles:   raw.distance_miles,
      dataSource:                 'AirROI',
      platformListingId:          raw.listing_id,
      ...(raw.listing_url !== undefined && { platformListingUrl: raw.listing_url }),
      bedrooms:                   raw.bedrooms,
      bathrooms:                  raw.bathrooms,
      ...(raw.max_guests !== undefined && { maxGuests: raw.max_guests }),
      ...(raw.sqft !== undefined && { squareFeet: raw.sqft }),
      amenities:                  raw.amenities ?? [],
      averageDailyRate:           Math.round(raw.average_daily_rate),
      occupancyRate:              raw.occupancy_rate,
      estimatedMonthlyRevenue:    Math.round(raw.monthly_revenue),
      ...(raw.cleaning_fee !== undefined && { cleaningFee: raw.cleaning_fee }),
      ...(raw.management_fee_pct !== undefined && { managementFeePercent: raw.management_fee_pct }),
    };
  }
}
