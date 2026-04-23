/**
 * Tests for geohash utilities.
 *
 * Focused on the helpers used by the order-comparables comp-collection pipeline:
 *   - encodeGeohash precision contract
 *   - getSearchGeohashes (center + 8 neighbors, in any order)
 *   - getGeohashNeighbors (just the 8 neighbors, no center)
 */

import { describe, it, expect } from 'vitest';
import ngeohash from 'ngeohash';
import {
  encodeGeohash,
  getSearchGeohashes,
  getGeohashNeighbors,
} from '../src/utils/geohash.util';

// Subject coordinates used across tests (Jacksonville, FL — known cell `djn4u`)
const LAT = 30.33;
const LON = -81.65;

describe('encodeGeohash', () => {
  it('encodes a coordinate at the requested precision', () => {
    const h = encodeGeohash(LAT, LON, 5);
    expect(h).toHaveLength(5);
  });

  it('produces the same hash that ngeohash would for the same precision', () => {
    expect(encodeGeohash(LAT, LON, 5)).toBe(ngeohash.encode(LAT, LON, 5));
  });
});

describe('getSearchGeohashes', () => {
  it('returns 9 cells: the center plus all 8 neighbors', () => {
    const cells = getSearchGeohashes(LAT, LON, 5);
    expect(cells).toHaveLength(9);
    expect(new Set(cells).size).toBe(9); // all unique
  });

  it('places the center cell first', () => {
    const cells = getSearchGeohashes(LAT, LON, 5);
    expect(cells[0]).toBe(encodeGeohash(LAT, LON, 5));
  });

  it('contains exactly the 8 ngeohash neighbors after the center', () => {
    const cells = getSearchGeohashes(LAT, LON, 5);
    const neighborsFromLib = ngeohash.neighbors(cells[0]!);
    expect(cells.slice(1).sort()).toEqual([...neighborsFromLib].sort());
  });
});

describe('getGeohashNeighbors', () => {
  it('returns exactly 8 cells', () => {
    const neighbors = getGeohashNeighbors(LAT, LON, 5);
    expect(neighbors).toHaveLength(8);
    expect(new Set(neighbors).size).toBe(8);
  });

  it('does NOT include the center cell', () => {
    const center = encodeGeohash(LAT, LON, 5);
    expect(getGeohashNeighbors(LAT, LON, 5)).not.toContain(center);
  });

  it('matches ngeohash.neighbors for the same point and precision', () => {
    const center = encodeGeohash(LAT, LON, 5);
    const neighbors = getGeohashNeighbors(LAT, LON, 5);
    expect(neighbors.sort()).toEqual([...ngeohash.neighbors(center)].sort());
  });
});
