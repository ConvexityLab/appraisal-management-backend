/**
 * Confidential-fields stripper
 *
 * Removes fields gated by the `confidential:read` scope from outbound payloads
 * when the caller doesn't hold that scope. Used by vendor controllers to
 * enforce the David/Doug-only trusted-vendor visibility — see
 * docs/screens/Appraiser_Scorecard_Definitions_files/VendorAssignemtnMeetignNotes.md.
 *
 * Treats absence of the scope as deny-by-default: anyone without an explicit
 * grant gets the fields stripped. Admins automatically hold every scope, so
 * admin reads always include the fields.
 *
 * IMPORTANT: this is a serializer, not an authorization gate. The vendor
 * controller's existing `vendor:read` check still gates the broader resource;
 * this just decides whether the confidential subset is included in the
 * response shape.
 */

import { getScopesForUser } from './ai-scopes.js';
import type { Vendor } from '../types/index.js';

/** Fields on Vendor that are gated by `confidential:read`. */
const CONFIDENTIAL_VENDOR_FIELDS = [
  'trustedVendor',
  'confidentialClassifications',
] as const;

interface UserLike {
  role?: string | string[] | null;
  accessScope?: { extraScopes?: string[] } | null;
}

function callerHasConfidentialRead(user: UserLike | null | undefined): boolean {
  if (!user) return false;
  const scopes = getScopesForUser(user);
  return scopes.includes('confidential:read');
}

/**
 * Return a copy of `vendor` with confidential fields removed iff the caller
 * lacks `confidential:read`. Returns the vendor unchanged when the caller has
 * the scope (or when `vendor` is null/undefined).
 */
export function stripConfidentialVendorFields<T extends Partial<Vendor> | null | undefined>(
  vendor: T,
  user: UserLike | null | undefined,
): T {
  if (!vendor) return vendor;
  if (callerHasConfidentialRead(user)) return vendor;
  const stripped: Record<string, unknown> = { ...vendor };
  for (const field of CONFIDENTIAL_VENDOR_FIELDS) {
    if (field in stripped) delete stripped[field];
  }
  return stripped as T;
}

/**
 * Apply stripping to an array of vendors. Short-circuits when the caller
 * already has the scope — no allocations in that path.
 */
export function stripConfidentialFieldsFromVendorList<T extends Partial<Vendor>>(
  vendors: T[],
  user: UserLike | null | undefined,
): T[] {
  if (!vendors || vendors.length === 0) return vendors;
  if (callerHasConfidentialRead(user)) return vendors;
  return vendors.map((v) => stripConfidentialVendorFields(v, user));
}

/**
 * Recursive, defense-in-depth stripper for payloads with opaque shape that
 * MIGHT contain nested vendor objects (e.g. vendor-bid-analysis caches
 * `rankedCandidates: Array<Record<string, unknown>>`).
 *
 * Walks the object/array tree and deletes any property whose KEY matches
 * one of the confidential field names. Short-circuits (returns the input
 * unchanged) when the caller holds `confidential:read`. Returns a deep
 * clone on the strip path so the source data is not mutated.
 *
 * Use this on response payloads where you can't guarantee the shape
 * doesn't carry a raw Vendor anywhere down the tree. The cost is one
 * deep clone per response; only paid when scope is missing.
 */
export function stripConfidentialFieldsDeep<T>(
  payload: T,
  user: UserLike | null | undefined,
): T {
  if (payload === null || payload === undefined) return payload;
  if (callerHasConfidentialRead(user)) return payload;
  return walk(payload) as T;
}

function walk(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(walk);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (CONFIDENTIAL_VENDOR_FIELDS.includes(k as never)) continue;
      out[k] = walk(v);
    }
    return out;
  }
  return value;
}
