/**
 * AirDNA Market Data Service
 *
 * Thin HTTP wrapper for the AirDNA Rentalizer / Market API.
 * Documentation: https://developer.airdna.co/docs
 *
 * Authentication: X-Api-Key header
 * Base URL: https://api.airdna.co/v1
 *
 * Primary endpoints used:
 *   GET /market/search          — find market ID by lat/lng or city name
 *   GET /rentalizer/estimate    — per-property revenue/occupancy projection
 *   GET /market/stats           — aggregate market-level metrics
 *
 * Environment variable required:
 *   AIRDNA_API_KEY — obtain at https://developer.airdna.co
 */

import { Logger } from '../utils/logger.js';
import type { StrProjection } from '../types/str-feasibility.types.js';

const BASE_URL = 'https://api.airdna.co/v1';

// Raw shapes returned by AirDNA — mapped to our canonical types by this service.
interface AirDnaRentalizerResponse {
  property_stats: {
    adr: { ltm: number };
    occupancy: { ltm: number };
    revenue: { ltm: number };
    operating_expenses?: { ltm: number };
  };
  seasonality?: {
    high_months?: string[];
    low_months?: string[];
  };
}

interface AirDnaMarketSearchResult {
  market_id: string;
  name: string;
  country: string;
}

export class AirDnaService {
  private readonly apiKey: string;
  private readonly logger: Logger;

  constructor() {
    const key = process.env.AIRDNA_API_KEY;
    if (!key) {
      throw new Error(
        'AirDnaService: AIRDNA_API_KEY environment variable is not set. ' +
        'Obtain an API key at https://developer.airdna.co and set AIRDNA_API_KEY.',
      );
    }
    this.apiKey = key;
    this.logger = new Logger('AirDnaService');
  }

  /**
   * GET /rentalizer/estimate
   *
   * Returns projected annual revenue, occupancy rate, ADR, and operating
   * expenses for a specific property address.  This is the primary per-property
   * projection endpoint used for STR Feasibility reports.
   *
   * @param latitude   Subject property latitude
   * @param longitude  Subject property longitude
   * @param bedrooms   Number of bedrooms
   * @param bathrooms  Number of bathrooms
   */
  async getRentalizerEstimate(params: {
    latitude: number;
    longitude: number;
    bedrooms: number;
    bathrooms: number;
    accommodates?: number;
  }): Promise<StrProjection> {
    const { latitude, longitude, bedrooms, bathrooms, accommodates } = params;

    const query = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      bedrooms: String(bedrooms),
      bathrooms: String(bathrooms),
      ...(accommodates ? { accommodates: String(accommodates) } : {}),
    });

    const raw = await this.request<AirDnaRentalizerResponse>('/rentalizer/estimate', query);
    return this.mapToProjection(raw);
  }

  /**
   * GET /market/search
   *
   * Resolves a city / zip / lat-lng to an AirDNA market ID.
   * Required before calling market-level stats.
   */
  async searchMarket(params: {
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<AirDnaMarketSearchResult[]> {
    const query = new URLSearchParams();
    if (params.city)       query.set('city', params.city);
    if (params.state)      query.set('state_code', params.state);
    if (params.postalCode) query.set('postal_code', params.postalCode);
    if (params.latitude)   query.set('latitude', String(params.latitude));
    if (params.longitude)  query.set('longitude', String(params.longitude));

    const raw = await this.request<{ results: AirDnaMarketSearchResult[] }>('/market/search', query);
    return raw.results ?? [];
  }

  /**
   * GET /market/stats
   *
   * Returns aggregate market-level STR performance for a given AirDNA market ID.
   * Use after searchMarket() to obtain the market_id.
   */
  async getMarketStats(marketId: string): Promise<unknown> {
    const query = new URLSearchParams({ market_id: marketId });
    return this.request('/market/stats', query);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async request<T>(path: string, params: URLSearchParams): Promise<T> {
    const url = `${BASE_URL}${path}?${params.toString()}`;
    this.logger.debug('AirDnaService: GET', { url });

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)');
      throw new Error(
        `AirDNA API error: HTTP ${response.status} ${response.statusText} — ${body}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private mapToProjection(raw: AirDnaRentalizerResponse): StrProjection {
    const stats = raw.property_stats;
    const revenue       = stats.revenue?.ltm         ?? 0;
    const occupancy     = stats.occupancy?.ltm        ?? 0;
    const adr           = stats.adr?.ltm              ?? 0;
    const opex          = stats.operating_expenses?.ltm ?? revenue * 0.36; // AirDNA default 36% if not provided

    return {
      sourceName:                'AirDNA',
      projectedAnnualRevenue:    Math.round(revenue),
      occupancyRate:             occupancy,          // AirDNA returns 0–1
      averageDailyRate:          Math.round(adr),
      highSeasonMonths:          raw.seasonality?.high_months ?? [],
      lowSeasonMonths:           raw.seasonality?.low_months  ?? [],
      annualOperatingExpenses:   Math.round(opex),
      estimatedNOI:              Math.round(revenue - opex),
      retrievedAt:               new Date().toISOString(),
    };
  }
}
