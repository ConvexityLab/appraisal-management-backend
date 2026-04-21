import { describe, it, expect } from 'vitest';
import { encodeGeohash, getSearchGeohashes } from '../../src/utils/geohash.util.js';

describe('geohash.util', () => {
  describe('encodeGeohash', () => {
    it('should encode Jacksonville FL (30.3322, -81.6557) to a 5-char geohash', () => {
      const hash = encodeGeohash(30.3322, -81.6557, 5);
      expect(hash).toHaveLength(5);
      expect(typeof hash).toBe('string');
    });

    it('should return the same hash for the same coordinates', () => {
      const h1 = encodeGeohash(30.3322, -81.6557, 5);
      const h2 = encodeGeohash(30.3322, -81.6557, 5);
      expect(h1).toBe(h2);
    });

    it('should return different hashes for distant locations', () => {
      const jacksonville = encodeGeohash(30.3322, -81.6557, 5);
      const losAngeles = encodeGeohash(34.0522, -118.2437, 5);
      expect(jacksonville).not.toBe(losAngeles);
    });

    it('should return the same hash for nearby points within the same cell', () => {
      // Two points ~100m apart should fall in the same precision-5 cell
      const h1 = encodeGeohash(30.3322, -81.6557, 5);
      const h2 = encodeGeohash(30.3325, -81.6560, 5);
      expect(h1).toBe(h2);
    });

    it('should respect precision parameter', () => {
      const p4 = encodeGeohash(30.3322, -81.6557, 4);
      const p5 = encodeGeohash(30.3322, -81.6557, 5);
      const p6 = encodeGeohash(30.3322, -81.6557, 6);
      expect(p4).toHaveLength(4);
      expect(p5).toHaveLength(5);
      expect(p6).toHaveLength(6);
      // Higher precision hashes should start with the lower precision prefix
      expect(p5.startsWith(p4)).toBe(true);
      expect(p6.startsWith(p5)).toBe(true);
    });
  });

  describe('getSearchGeohashes', () => {
    it('should return exactly 9 geohashes (center + 8 neighbors)', () => {
      const hashes = getSearchGeohashes(30.3322, -81.6557, 5);
      expect(hashes).toHaveLength(9);
    });

    it('should include the center geohash as the first element', () => {
      const center = encodeGeohash(30.3322, -81.6557, 5);
      const hashes = getSearchGeohashes(30.3322, -81.6557, 5);
      expect(hashes[0]).toBe(center);
    });

    it('should return all unique geohashes', () => {
      const hashes = getSearchGeohashes(30.3322, -81.6557, 5);
      const unique = new Set(hashes);
      expect(unique.size).toBe(9);
    });

    it('should return geohashes of the same precision', () => {
      const hashes = getSearchGeohashes(30.3322, -81.6557, 5);
      for (const h of hashes) {
        expect(h).toHaveLength(5);
      }
    });
  });
});
