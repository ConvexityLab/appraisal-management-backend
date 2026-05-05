/**
 * Shared CSV value parsing helpers.
 *
 * Used by ATTOM CSV ingestion scripts to convert raw string fields
 * into typed values (numbers, booleans).
 */

/** Parse a string as a float, returning null for empty/invalid values. */
export function toFloat(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/** Parse a string as an integer, returning null for empty/invalid values. */
export function toInt(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

/** Return true if the value is a single-character "Y" (case-insensitive). */
export function boolY(val: string | undefined): boolean {
  return val?.trim().toUpperCase() === 'Y';
}
