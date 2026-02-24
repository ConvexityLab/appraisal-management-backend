/**
 * Provider Matching Criteria & RFB (Request for Bid) Types
 *
 * These types drive the matching engine that evaluates vendor/appraiser
 * eligibility against a configured criteria set, and then manages the
 * lifecycle of broadcast RFB rounds on an order.
 */

// ─── Geo-fence ────────────────────────────────────────────────────────────────

/**
 * Value shape for geo-fence criteria.  Exactly one variant is populated
 * depending on the operator chosen:
 *   within_radius_miles  → center + radiusMiles
 *   within_polygon       → polygon ring (first/last point equal to close)
 *   within_bbox          → bbox
 */
export interface GeoFenceValue {
  // within_radius_miles
  center?: { lat: number; lng: number };
  radiusMiles?: number;
  // within_polygon
  polygon?: Array<{ lat: number; lng: number }>;
  // within_bbox
  bbox?: { north: number; south: number; east: number; west: number };
}

// ─── Criterion ────────────────────────────────────────────────────────────────

export type CriterionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_expired'
  // Geo-fencing operators — field must be 'geo_fence'; value must be GeoFenceValue
  | 'within_radius_miles'
  | 'within_polygon'
  | 'within_bbox';

export interface MatchingCriterion {
  /**
   * Dot-path into VendorProfile / Vendor (e.g. "averageQCScore", "serviceAreas.state")
   * OR the special sentinel "geo_fence" for geo-fencing operators.
   */
  field: string;
  operator: CriterionOperator;
  /**
   * For geo-fence criteria: must be a GeoFenceValue.
   * For scalar criteria: string | number | boolean.
   * For array criteria (in / not_in / contains): string[] | number[].
   */
  value: unknown;
  /** Human-readable label shown in the UI criteria builder. */
  label?: string;
}

// ─── Criteria Set ─────────────────────────────────────────────────────────────

export type ProviderType =
  | 'APPRAISER'
  | 'AMC'
  | 'INSPECTOR'
  | 'INSPECTION_CO'
  | 'NOTARY';

export interface MatchingCriteriaSet {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  /** Whether all criteria must match (AND) or at least one (OR). */
  combinator: 'AND' | 'OR';
  criteria: MatchingCriterion[];
  /** Provider types this set applies to; empty array means "all types". */
  providerTypes: ProviderType[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateMatchingCriteriaSetRequest {
  name: string;
  description?: string;
  combinator: 'AND' | 'OR';
  criteria: MatchingCriterion[];
  providerTypes: ProviderType[];
}

export interface UpdateMatchingCriteriaSetRequest {
  name?: string;
  description?: string;
  combinator?: 'AND' | 'OR';
  criteria?: MatchingCriterion[];
  providerTypes?: ProviderType[];
}

// ─── Matching Engine Result ────────────────────────────────────────────────────

export interface MatchResult {
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  /** Composite match score 0–100; higher = more preferred. */
  score: number;
  matchedCriteria: number;
  totalCriteria: number;
  /** Distance in miles from subject property (populated when geo_fence criterion is present). */
  distanceMiles?: number;
  /** Snapshot of relevant provider fields at time of match. */
  snapshot: {
    performanceScore?: number;
    averageQCScore?: number;
    onTimeDeliveryRate?: number;
    currentActiveOrders?: number;
    maxActiveOrders?: number;
    standardFee?: number;
  };
}

// ─── RFB (Request for Bid) ────────────────────────────────────────────────────

export type RfbStatus =
  | 'DRAFT'
  | 'BROADCAST'
  | 'BIDS_RECEIVED'
  | 'AWARDED'
  | 'EXPIRED'
  | 'CANCELLED';

export type BidStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface RfbBid {
  id: string;
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  proposedFee: number;
  proposedTurnaroundDays: number;
  notes?: string;
  status: BidStatus;
  respondedAt?: string;
}

export interface RfbRequest {
  id: string;
  tenantId: string;
  orderId: string;
  productId: string;
  criteriaSetIds: string[];
  matchedProviderIds: string[];
  /** Snapshot of MatchResult[] at time of broadcast, for audit. */
  matchSnapshot: MatchResult[];
  broadcastAt?: string;
  deadlineAt: string;
  status: RfbStatus;
  /** When true, the first accepted bid automatically awards the order. */
  autoAward: boolean;
  bids: RfbBid[];
  awardedBidId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRfbRequest {
  orderId: string;
  productId: string;
  criteriaSetIds: string[];
  deadlineAt: string;
  autoAward?: boolean;
}

export interface SubmitBidRequest {
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  proposedFee: number;
  proposedTurnaroundDays: number;
  notes?: string;
}
