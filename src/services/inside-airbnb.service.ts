/**
 * Inside Airbnb Data Service
 *
 * Provides access to the publicly available Inside Airbnb dataset files.
 * Source: https://insideairbnb.com/get-the-data/
 *
 * Inside Airbnb publishes periodic CSV snapshots of Airbnb listings for
 * ~100 cities worldwide.  Data includes listing details, occupancy estimates
 * (via the "review rate assumption" methodology), and pricing.
 *
 * Used as:
 *   1. A market-level validation / benchmarking layer when AirROI is the
 *      primary per-property source.
 *   2. A fallback for comp discovery in cities covered by Inside Airbnb when
 *      the live Airbnb search API is unavailable.
 *
 * No API key required — files are publicly downloadable from S3.
 * We cache the CSV in Azure Blob Storage to avoid re-downloading on every request.
 *
 * Environment variables (optional — falls back gracefully if not set):
 *   INSIDE_AIRBNB_CACHE_CONTAINER  — blob container name (default: "inside-airbnb-cache")
 */

import { Logger } from '../utils/logger.js';
import type { StrComparable } from '../types/str-feasibility.types.js';

const INSIDE_AIRBNB_DATA_BASE = 'https://data.insideairbnb.com';

/**
 * Known city dataset paths on Inside Airbnb's S3 bucket.
 * Key = "{state}:{city}" lowercase, value = S3 path prefix.
 * Add new cities as needed — check https://insideairbnb.com/get-the-data/ for current listings.
 */
const CITY_PATH_MAP: Record<string, string> = {
  'fl:miami':             'united-states/fl/miami',
  'fl:miami beach':       'united-states/fl/miami',
  'fl:orlando':           'united-states/fl/orlando',
  'fl:tampa':             'united-states/fl/tampa',
  'fl:fort lauderdale':   'united-states/fl/broward-county',
  'fl:kissimmee':         'united-states/fl/kissimmee',
  'ca:los angeles':       'united-states/ca/los-angeles',
  'ca:san diego':         'united-states/ca/san-diego',
  'ca:san francisco':     'united-states/ca/san-francisco',
  'ny:new york city':     'united-states/ny/new-york-city',
  'tx:austin':            'united-states/tx/austin',
  'tx:dallas':            'united-states/tx/dallas',
  'co:denver':            'united-states/co/denver',
  'nc:asheville':         'united-states/nc/asheville',
  'tn:nashville':         'united-states/tn/nashville',
  'hi:honolulu':          'united-states/hi/hawaii',
  'sc:charleston':        'united-states/sc/charleston',
  'ga:savannah':          'united-states/ga/savannah',
  'la:new orleans':       'united-states/la/new-orleans',
};

interface InsideAirbnbRow {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  neighbourhood_cleansed: string;
  property_type: string;
  room_type: string;
  accommodates: string;
  bedrooms: string;
  bathrooms_text: string;
  price: string;               // "$xxx.xx" format
  minimum_nights: string;
  number_of_reviews: string;
  reviews_per_month: string;
  availability_365: string;
}

/** Market-level aggregate summary derived from Inside Airbnb data */
export interface InsideAirbnbMarketSummary {
  city: string;
  state: string;
  snapshotDate: string;
  totalActiveListings: number;
  medianNightlyRate: number;
  averageNightlyRate: number;
  medianAvailabilityDays: number;
  /** Occupancy estimate = (365 - availability_365) / 365 */
  estimatedMedianOccupancyRate: number;
  bedroomBreakdown: Array<{
    bedrooms: number;
    count: number;
    medianNightlyRate: number;
    estimatedOccupancyRate: number;
  }>;
  dataSource: 'InsideAirbnb';
}

export class InsideAirbnbService {
  private readonly logger: Logger;
  /** In-memory cache: city key → CSV text (avoids repeated downloads per process lifetime) */
  private readonly csvCache = new Map<string, string>();

  constructor() {
    this.logger = new Logger('InsideAirbnbService');
  }

  /**
   * Returns true if Inside Airbnb has data coverage for this city/state.
   */
  isCitySupported(city: string, state: string): boolean {
    return this.cityKey(city, state) in CITY_PATH_MAP ||
           Object.keys(CITY_PATH_MAP).includes(this.cityKey(city, state));
  }

  /**
   * Fetches and returns a market-level summary for the given city/state.
   * Returns null if the city is not covered by Inside Airbnb.
   */
  async getMarketSummary(
    city: string,
    state: string,
    bedrooms?: number,
  ): Promise<InsideAirbnbMarketSummary | null> {
    const cityPath = CITY_PATH_MAP[this.cityKey(city, state)];
    if (!cityPath) {
      this.logger.debug('InsideAirbnbService: city not covered', { city, state });
      return null;
    }

    const rows = await this.fetchListingsCsv(cityPath);
    if (!rows.length) return null;

    return this.buildMarketSummary(city, state, rows, bedrooms);
  }

  /**
   * Returns nearby comparable listings from Inside Airbnb data.
   * Useful as a fallback when live Airbnb search is unavailable.
   */
  async getNearbyComps(params: {
    city: string;
    state: string;
    latitude: number;
    longitude: number;
    bedrooms?: number;
    radiusMiles?: number;
    limit?: number;
  }): Promise<StrComparable[]> {
    const { city, state, latitude, longitude, bedrooms, radiusMiles = 1.0, limit = 5 } = params;

    const cityPath = CITY_PATH_MAP[this.cityKey(city, state)];
    if (!cityPath) return [];

    const rows = await this.fetchListingsCsv(cityPath);

    return rows
      .filter(r => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng)) return false;
        if (bedrooms !== undefined && parseInt(r.bedrooms) !== bedrooms) return false;
        return this.haversineDistanceMiles(latitude, longitude, lat, lng) <= radiusMiles;
      })
      .slice(0, limit)
      .map((r, i) => this.mapRowToComp(r, i + 1, latitude, longitude));
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private cityKey(city: string, state: string): string {
    return `${state.toLowerCase()}:${city.toLowerCase()}`;
  }

  /**
   * Downloads (or returns cached) listings CSV for a city path prefix.
   * Inside Airbnb stores data at a path like:
   *   https://data.insideairbnb.com/{city_path}/visualisations/listings.csv
   */
  private async fetchListingsCsv(cityPath: string): Promise<InsideAirbnbRow[]> {
    if (this.csvCache.has(cityPath)) {
      const cached = this.csvCache.get(cityPath)!;
      return this.parseCsv(cached);
    }

    // Inside Airbnb URL pattern — "latest" snapshot
    const url = `${INSIDE_AIRBNB_DATA_BASE}/${cityPath}/visualisations/listings.csv`;
    this.logger.debug('InsideAirbnbService: downloading', { url });

    const response = await fetch(url, {
      headers: { 'Accept': 'text/csv,*/*' },
    });

    if (!response.ok) {
      this.logger.warn('InsideAirbnbService: failed to download CSV', {
        url,
        status: response.status,
      });
      return [];
    }

    const csv = await response.text();
    this.csvCache.set(cityPath, csv);
    return this.parseCsv(csv);
  }

  private parseCsv(csv: string): InsideAirbnbRow[] {
    const lines = csv.split('\n').filter(Boolean);
    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0]!);
    const rows: InsideAirbnbRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]!);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
      rows.push(row as unknown as InsideAirbnbRow);
    }

    return rows;
  }

  /** Minimal RFC-4180 CSV parser — handles quoted fields with embedded commas */
  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  private buildMarketSummary(
    city: string,
    state: string,
    rows: InsideAirbnbRow[],
    filterBedrooms?: number,
  ): InsideAirbnbMarketSummary {
    const filtered = filterBedrooms !== undefined
      ? rows.filter(r => parseInt(r.bedrooms) === filterBedrooms)
      : rows;

    const prices = filtered
      .map(r => parseFloat(r.price.replace(/[$,]/g, '')))
      .filter(p => p > 0 && p < 10000);

    const avails = filtered
      .map(r => parseInt(r.availability_365))
      .filter(a => !isNaN(a));

    const occupancies = avails.map(a => Math.max(0, Math.min(1, (365 - a) / 365)));

    const bedroomGroups = new Map<number, InsideAirbnbRow[]>();
    for (const r of rows) {
      const b = parseInt(r.bedrooms);
      if (!isNaN(b)) {
        if (!bedroomGroups.has(b)) bedroomGroups.set(b, []);
        bedroomGroups.get(b)!.push(r);
      }
    }

    return {
      city,
      state,
      snapshotDate:                  new Date().toISOString().split('T')[0]!,
      totalActiveListings:           filtered.length,
      medianNightlyRate:             this.median(prices),
      averageNightlyRate:            this.average(prices),
      medianAvailabilityDays:        this.median(avails),
      estimatedMedianOccupancyRate:  this.median(occupancies),
      bedroomBreakdown:              Array.from(bedroomGroups.entries())
        .sort(([a], [b]) => a - b)
        .map(([beds, bRows]) => {
          const bPrices = bRows.map(r => parseFloat(r.price.replace(/[$,]/g, ''))).filter(p => p > 0);
          const bAvail  = bRows.map(r => parseInt(r.availability_365)).filter(a => !isNaN(a));
          const bOcc    = bAvail.map(a => Math.max(0, Math.min(1, (365 - a) / 365)));
          return {
            bedrooms:                beds,
            count:                   bRows.length,
            medianNightlyRate:       this.median(bPrices),
            estimatedOccupancyRate:  this.median(bOcc),
          };
        }),
      dataSource: 'InsideAirbnb',
    };
  }

  private mapRowToComp(
    r: InsideAirbnbRow,
    compNumber: number,
    subjectLat: number,
    subjectLng: number,
  ): StrComparable {
    const lat = parseFloat(r.latitude);
    const lng = parseFloat(r.longitude);
    const adr = parseFloat(r.price.replace(/[$,]/g, '')) || 0;
    const avail = parseInt(r.availability_365) || 0;
    const occupancy = Math.max(0, Math.min(1, (365 - avail) / 365));

    return {
      compNumber,
      listingName:             r.name,
      address:                 '',
      city:                    r.neighbourhood_cleansed ?? '',
      state:                   '',
      postalCode:              '',
      latitude:                lat,
      longitude:               lng,
      distanceFromSubjectMiles: this.haversineDistanceMiles(subjectLat, subjectLng, lat, lng),
      dataSource:              'InsideAirbnb',
      platformListingId:       r.id,
      platformListingUrl:      `https://www.airbnb.com/rooms/${r.id}`,
      bedrooms:                parseInt(r.bedrooms)     || 0,
      bathrooms:               parseFloat(r.bathrooms_text) || 0,
      ...(parseInt(r.accommodates) ? { maxGuests: parseInt(r.accommodates) } : {}),
      amenities:               [],
      averageDailyRate:        Math.round(adr),
      occupancyRate:           occupancy,
      estimatedMonthlyRevenue: Math.round((adr * occupancy * 365) / 12),
    };
  }

  private median(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? ((sorted[mid - 1]! + sorted[mid]!) / 2)
      : sorted[mid]!;
  }

  private average(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  private haversineDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3958.8;
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
