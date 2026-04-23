/**
 * Geohash utilities for spatial partitioning.
 *
 * Used by the attom-data CosmosDB container to partition property records
 * by geographic location, enabling efficient radius-based comparable search.
 */

import ngeohash from 'ngeohash';

/**
 * How geohash cells are queried when searching for properties around a point.
 *
 * - NONE       Query only the subject's geohash cell. Cheapest (1 partition),
 *              may under-fill in sparse rural areas.
 * - ADAPTIVE   Query the subject cell first; expand to the 8 neighbor cells
 *              only when the first query returns fewer than the configured
 *              minimum. Best RU/coverage trade-off for mixed urban/rural data.
 * - ALWAYS_9   Always query the subject cell + 8 neighbors. Most coverage,
 *              highest RU. This is the historical default behavior.
 */
export type GeohashExpansion = 'NONE' | 'ADAPTIVE' | 'ALWAYS_9';

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
 *
 * The center cell is always at index 0; callers that need it separated from
 * its neighbors can rely on that ordering.
 */
export function getSearchGeohashes(latitude: number, longitude: number, precision: number): string[] {
  const center = ngeohash.encode(latitude, longitude, precision);
  const neighbors = ngeohash.neighbors(center);
  return [center, ...neighbors];
}

/**
 * Return only the 8 neighboring geohash cells around a point (NOT the center).
 *
 * Used by adaptive cell-expansion strategies that query the subject's cell
 * first and only fan out to neighbors when results are sparse.
 */
export function getGeohashNeighbors(latitude: number, longitude: number, precision: number): string[] {
  const center = ngeohash.encode(latitude, longitude, precision);
  return ngeohash.neighbors(center);
}
