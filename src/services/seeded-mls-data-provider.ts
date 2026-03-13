/**
 * Seeded MLS Data Provider
 *
 * In-memory implementation of MlsDataProvider backed by a static seed of
 * realistic sold-listing records. Used for development, testing, and demos
 * until a production MLS integration (Bridge, CoreLogic, etc.) is wired.
 *
 * Filtering mirrors MLS API behavior:
 *   - Haversine radius filter
 *   - Bed/bath/sqft/date ranges
 *   - Result limit
 *
 * Phase 0.8 — created 2026-03-11
 */

import type { MlsDataProvider, MlsListing, MlsSearchParams } from '../types/mls-data.types.js';

// ─── Haversine distance (miles) ──────────────────────────────────────────────

function haversineDistanceMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Seed data — 20 realistic sold listings (Dallas / Fort Worth metro area)
// ═══════════════════════════════════════════════════════════════════════════════

function daysAgo(n: number): string {
  const iso = new Date(Date.now() - n * 86_400_000).toISOString();
  return iso.slice(0, 10);
}

const SEED_LISTINGS: MlsListing[] = [
  // ── Dallas core (32.78 N, -96.80 W) ───────────────────────────────────────
  { id: 'SEED-001', address: '1420 Elm St', city: 'Dallas', state: 'TX', zipCode: '75201', latitude: 32.7815, longitude: -96.7985, salePrice: 425000, saleDate: daysAgo(15), squareFootage: 1850, bedrooms: 3, bathrooms: 2, yearBuilt: 2005, lotSize: 6200, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-002', address: '2108 Commerce St', city: 'Dallas', state: 'TX', zipCode: '75201', latitude: 32.7828, longitude: -96.7952, salePrice: 395000, saleDate: daysAgo(22), squareFootage: 1650, bedrooms: 3, bathrooms: 2, yearBuilt: 2002, lotSize: 5800, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-003', address: '3015 Ross Ave', city: 'Dallas', state: 'TX', zipCode: '75204', latitude: 32.7890, longitude: -96.7910, salePrice: 465000, saleDate: daysAgo(35), squareFootage: 2100, bedrooms: 4, bathrooms: 2.5, yearBuilt: 2010, lotSize: 7200, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-004', address: '910 Swiss Ave', city: 'Dallas', state: 'TX', zipCode: '75204', latitude: 32.7872, longitude: -96.7868, salePrice: 510000, saleDate: daysAgo(48), squareFootage: 2350, bedrooms: 4, bathrooms: 3, yearBuilt: 2015, lotSize: 8400, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-005', address: '4525 Gaston Ave', city: 'Dallas', state: 'TX', zipCode: '75246', latitude: 32.7950, longitude: -96.7735, salePrice: 355000, saleDate: daysAgo(62), squareFootage: 1520, bedrooms: 3, bathrooms: 2, yearBuilt: 1998, lotSize: 5400, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-006', address: '707 Peak St', city: 'Dallas', state: 'TX', zipCode: '75204', latitude: 32.7840, longitude: -96.7875, salePrice: 440000, saleDate: daysAgo(75), squareFootage: 1900, bedrooms: 3, bathrooms: 2.5, yearBuilt: 2008, lotSize: 6500, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-007', address: '2301 Live Oak St', city: 'Dallas', state: 'TX', zipCode: '75204', latitude: 32.7855, longitude: -96.7820, salePrice: 380000, saleDate: daysAgo(88), squareFootage: 1680, bedrooms: 3, bathrooms: 2, yearBuilt: 2001, lotSize: 5850, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-008', address: '1816 N Haskell Ave', city: 'Dallas', state: 'TX', zipCode: '75204', latitude: 32.7910, longitude: -96.7845, salePrice: 475000, saleDate: daysAgo(30), squareFootage: 2050, bedrooms: 4, bathrooms: 2, yearBuilt: 2012, lotSize: 7000, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-009', address: '3400 Knight St', city: 'Dallas', state: 'TX', zipCode: '75219', latitude: 32.7980, longitude: -96.8110, salePrice: 520000, saleDate: daysAgo(18), squareFootage: 2400, bedrooms: 4, bathrooms: 3, yearBuilt: 2018, lotSize: 8100, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-010', address: '5412 Lemmon Ave', city: 'Dallas', state: 'TX', zipCode: '75209', latitude: 32.8070, longitude: -96.8215, salePrice: 365000, saleDate: daysAgo(105), squareFootage: 1580, bedrooms: 3, bathrooms: 2, yearBuilt: 1995, lotSize: 5200, propertyType: 'Residential', source: 'Seed Data' },

  // ── Richardson / Plano (further out, ~15 mi from core) ─────────────────────
  { id: 'SEED-011', address: '520 W Arapaho Rd', city: 'Richardson', state: 'TX', zipCode: '75080', latitude: 32.9480, longitude: -96.7300, salePrice: 340000, saleDate: daysAgo(42), squareFootage: 1750, bedrooms: 3, bathrooms: 2, yearBuilt: 1999, lotSize: 7500, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-012', address: '4100 Spring Valley Rd', city: 'Richardson', state: 'TX', zipCode: '75080', latitude: 32.9400, longitude: -96.7450, salePrice: 310000, saleDate: daysAgo(55), squareFootage: 1600, bedrooms: 3, bathrooms: 2, yearBuilt: 1996, lotSize: 6800, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-013', address: '815 E 15th St', city: 'Plano', state: 'TX', zipCode: '75074', latitude: 33.0200, longitude: -96.6980, salePrice: 420000, saleDate: daysAgo(28), squareFootage: 2200, bedrooms: 4, bathrooms: 2.5, yearBuilt: 2006, lotSize: 8000, propertyType: 'Residential', source: 'Seed Data' },

  // ── Fort Worth (further west, ~30 mi from core) ────────────────────────────
  { id: 'SEED-014', address: '1010 Magnolia Ave', city: 'Fort Worth', state: 'TX', zipCode: '76104', latitude: 32.7350, longitude: -97.3200, salePrice: 290000, saleDate: daysAgo(65), squareFootage: 1450, bedrooms: 3, bathrooms: 2, yearBuilt: 1992, lotSize: 5500, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-015', address: '2801 Lipscomb St', city: 'Fort Worth', state: 'TX', zipCode: '76110', latitude: 32.7210, longitude: -97.3350, salePrice: 315000, saleDate: daysAgo(38), squareFootage: 1580, bedrooms: 3, bathrooms: 2, yearBuilt: 1997, lotSize: 6000, propertyType: 'Residential', source: 'Seed Data' },

  // ── Condo / Townhome (Dallas core) ─────────────────────────────────────────
  { id: 'SEED-016', address: '1200 Main St #400', city: 'Dallas', state: 'TX', zipCode: '75202', latitude: 32.7802, longitude: -96.7985, salePrice: 285000, saleDate: daysAgo(20), squareFootage: 1100, bedrooms: 2, bathrooms: 2, yearBuilt: 2016, propertyType: 'Condo', source: 'Seed Data' },
  { id: 'SEED-017', address: '1908 Olive St #210', city: 'Dallas', state: 'TX', zipCode: '75201', latitude: 32.7835, longitude: -96.7935, salePrice: 330000, saleDate: daysAgo(45), squareFootage: 1250, bedrooms: 2, bathrooms: 2, yearBuilt: 2019, propertyType: 'Condo', source: 'Seed Data' },

  // ── Older / cheaper — trend anchor ─────────────────────────────────────────
  { id: 'SEED-018', address: '6100 Denton Dr', city: 'Dallas', state: 'TX', zipCode: '75235', latitude: 32.8200, longitude: -96.8550, salePrice: 245000, saleDate: daysAgo(150), squareFootage: 1300, bedrooms: 2, bathrooms: 1, yearBuilt: 1978, lotSize: 4800, propertyType: 'Residential', source: 'Seed Data' },
  { id: 'SEED-019', address: '6820 Harry Hines Blvd', city: 'Dallas', state: 'TX', zipCode: '75235', latitude: 32.8240, longitude: -96.8580, salePrice: 255000, saleDate: daysAgo(140), squareFootage: 1350, bedrooms: 3, bathrooms: 1, yearBuilt: 1982, lotSize: 5000, propertyType: 'Residential', source: 'Seed Data' },

  // ── Luxury — high end of range ─────────────────────────────────────────────
  { id: 'SEED-020', address: '4500 Travis St', city: 'Dallas', state: 'TX', zipCode: '75205', latitude: 32.8030, longitude: -96.7910, salePrice: 875000, saleDate: daysAgo(10), squareFootage: 3200, bedrooms: 5, bathrooms: 4, yearBuilt: 2022, lotSize: 10500, propertyType: 'Residential', source: 'Seed Data' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Provider implementation
// ═══════════════════════════════════════════════════════════════════════════════

export class SeededMlsDataProvider implements MlsDataProvider {
  private listings: MlsListing[];

  /**
   * @param additionalListings Extra listings to append (e.g. test-specific data).
   *                           Pass `null` to use only the default seed set.
   */
  constructor(additionalListings?: MlsListing[] | null) {
    this.listings = [...SEED_LISTINGS, ...(additionalListings ?? [])];
  }

  async searchSoldListings(params: MlsSearchParams): Promise<MlsListing[]> {
    const {
      latitude,
      longitude,
      radiusMiles = 1.0,
      limit = 25,
      minBeds,
      maxBeds,
      minBaths,
      maxBaths,
      minSqft,
      maxSqft,
      soldWithinDays = 180,
      propertyType,
    } = params;

    const cutoffDate = new Date(Date.now() - soldWithinDays * 86_400_000);

    let results = this.listings.filter(l => {
      // Radius
      const dist = haversineDistanceMiles(latitude, longitude, l.latitude, l.longitude);
      if (dist > radiusMiles) return false;

      // Sale date window
      if (new Date(l.saleDate) < cutoffDate) return false;

      // Bed/bath/sqft ranges
      if (minBeds !== undefined && l.bedrooms < minBeds) return false;
      if (maxBeds !== undefined && l.bedrooms > maxBeds) return false;
      if (minBaths !== undefined && l.bathrooms < minBaths) return false;
      if (maxBaths !== undefined && l.bathrooms > maxBaths) return false;
      if (minSqft !== undefined && l.squareFootage < minSqft) return false;
      if (maxSqft !== undefined && l.squareFootage > maxSqft) return false;

      // Property type
      if (propertyType && l.propertyType !== propertyType) return false;

      return true;
    });

    // Sort by sale date descending (most recent first)
    results.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

    // Limit
    return results.slice(0, limit);
  }
}
