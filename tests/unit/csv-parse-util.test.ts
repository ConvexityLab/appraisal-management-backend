import { describe, it, expect } from 'vitest';
import { toFloat, toInt, boolY } from '../../src/utils/csv-parse.util.js';

describe('csv-parse.util', () => {
  describe('toFloat', () => {
    it('should parse valid floats', () => {
      expect(toFloat('3.14')).toBe(3.14);
      expect(toFloat('100')).toBe(100);
      expect(toFloat('-0.5')).toBe(-0.5);
    });

    it('should return null for empty/undefined/invalid', () => {
      expect(toFloat(undefined)).toBeNull();
      expect(toFloat('')).toBeNull();
      expect(toFloat('  ')).toBeNull();
      expect(toFloat('abc')).toBeNull();
    });
  });

  describe('toInt', () => {
    it('should parse valid integers', () => {
      expect(toInt('42')).toBe(42);
      expect(toInt('0')).toBe(0);
      expect(toInt('-1')).toBe(-1);
    });

    it('should truncate floats to integers', () => {
      expect(toInt('3.9')).toBe(3);
    });

    it('should return null for empty/undefined/invalid', () => {
      expect(toInt(undefined)).toBeNull();
      expect(toInt('')).toBeNull();
      expect(toInt('abc')).toBeNull();
    });
  });

  describe('boolY', () => {
    it('should return true for Y/y', () => {
      expect(boolY('Y')).toBe(true);
      expect(boolY('y')).toBe(true);
      expect(boolY(' Y ')).toBe(true);
    });

    it('should return false for anything else', () => {
      expect(boolY('N')).toBe(false);
      expect(boolY('')).toBe(false);
      expect(boolY(undefined)).toBe(false);
      expect(boolY('Yes')).toBe(false);
    });
  });
});
