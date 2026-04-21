/**
 * Geohash utilities for spatial partitioning.
 *
 * Used by the attom-data CosmosDB container to partition property records
 * by geographic location, enabling efficient radius-based comparable search.
 */

import ngeohash from 'ngeohash';

/** Encode a latitude/longitude pair to a geohash string at the given precision. */
export function encodeGeohash(latitude: number, longitude: number, precision: number): string {
  return ngeohash.encode(latitude, longitude, precision);
}

/**
 * Return the 9 geohash cells needed to search around a point:
 * the cell containing the point plus its 8 immediate neighbors.
 *
 * This ensures full coverage for radius queries that span cell boundaries.
 * At precision 5 (~4.9km × 4.9km cells), querying 9 cells covers ~15km × 15km —
 * well beyond a typical 3-mile (4.8km) comp search radius.
 */
export function getSearchGeohashes(latitude: number, longitude: number, precision: number): string[] {
  const center = ngeohash.encode(latitude, longitude, precision);
  const neighbors = ngeohash.neighbors(center);
  return [center, ...neighbors];
}
