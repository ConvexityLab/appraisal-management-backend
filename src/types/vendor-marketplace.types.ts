/**
 * Vendor Marketplace Type Definitions
 * Phase 1: Foundation & Core Marketplace
 */

export interface GeographicArea {
  zipCodes: string[];
  counties: string[];
  radius: number;
  homeBase: {
    lat: number;
    lng: number;
  };
}

export interface VendorPerformanceMetrics {
  id: string;
  vendorId: string;
  tenantId: string;
  
  // Quality Metrics (0-100)
  qualityScore: number;
  revisionRate: number;          // % of orders requiring revisions
  complianceScore: number;        // % meeting compliance standards
  accuracyScore: number;          // Compared to final values
  
  // Speed Metrics
  avgTurnaroundTime: number;      // hours
  onTimeDeliveryRate: number;     // %
  acceptanceSpeed: number;        // hours to accept orders
  
  // Reliability Metrics
  completionRate: number;         // % of accepted orders completed
  cancellationRate: number;       // % canceled after acceptance
  communicationScore: number;     // Response time & quality
  
  // Volume Metrics
  totalOrdersCompleted: number;
  ordersInProgress: number;
  ordersLast30Days: number;
  ordersLast90Days: number;
  
  // Certification & Compliance
  certifications: string[];       // License types
  coverageAreas: GeographicArea[];
  propertyTypes: string[];        // Residential, Commercial, etc.
  propertyTypeExpertise?: Record<string, number>;  // Score by property type
  
  // Financial
  avgFeeQuoted: number;
  feeAcceptanceRate: number;      // % of initial fees accepted
  
  // Calculated Fields
  overallScore: number;           // Weighted composite 0-100
  tier: VendorTier;
  
  // Metadata
  lastUpdated: Date;
  calculatedAt: Date;
  dataPointsCount: number;        // Statistical significance
}

export type VendorTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'PROBATION';

export type VendorStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'VACATION';

// ── Phase 1.5.5 — Internal staff classification ───────────────────────────────
export type StaffType = 'internal' | 'external';
export type StaffRole = 'appraiser_internal' | 'inspector_internal' | 'reviewer' | 'supervisor';

/** Capacity snapshot fields present on vendor docs for internal staff members. */
export interface InternalStaffCapacity {
  staffType: StaffType;
  staffRole?: StaffRole;
  maxConcurrentOrders: number;
  activeOrderCount: number;
}
// ─────────────────────────────────────────────────────────────────────────────

export interface VendorAvailability {
  id: string;
  vendorId: string;
  
  // Capacity Management
  currentCapacity: number;        // Max concurrent orders
  currentLoad: number;            // Current active orders
  availableSlots: number;         // Calculated field
  isAcceptingOrders: boolean;     // Whether accepting new work
  maxCapacity: number;            // Maximum capacity limit
  
  // Schedule
  availability: {
    dayOfWeek: number;            // 0-6
    startTime: string;            // HH:mm
    endTime: string;              // HH:mm
  }[];
  
  blackoutDates: {
    startDate: Date;
    endDate: Date;
    reason: string;
  }[];
  
  // Geographic Availability
  serviceAreas: {
    zipCodes: string[];
    counties: string[];
    radius: number;               // miles from home base
    homeBase: {
      lat: number;
      lng: number;
    };
  };
  
  // Real-time Status
  currentStatus: VendorStatus;
  statusUpdatedAt: Date;
  estimatedAvailableDate?: Date;  // When next available
  
  // Auto-accept Settings
  autoAcceptEnabled: boolean;
  autoAcceptCriteria?: {
    minFee: number;
    maxDistance: number;
    propertyTypes: string[];
    maxTurnaroundDays: number;
  };
}

export type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'EXPIRED';

export interface VendorBid {
  id: string;
  orderId: string;
  vendorId: string;
  tenantId: string;
  
  // Bid Details
  proposedFee: number;
  originalFee: number;
  proposedDueDate: Date;
  originalDueDate: Date;
  
  // Status
  status: BidStatus;
  
  // Negotiation Trail
  negotiationHistory: {
    timestamp: Date;
    actor: 'VENDOR' | 'CLIENT';
    action: string;
    fee: number;
    dueDate: Date;
    notes: string;
  }[];
  
  // Terms
  specialConditions: string[];
  rushFeeApplied: boolean;
  
  // Timestamps
  submittedAt: Date;
  respondedAt?: Date;
  expiresAt: Date;
}

export interface VendorMatchRequest {
  orderId?: string;
  tenantId: string;
  propertyAddress: string;  // Simplified - just full address string
  propertyType: string;
  dueDate?: Date;
  urgency?: 'STANDARD' | 'RUSH' | 'SUPER_RUSH';
  budget?: number;
  /** Product being ordered — used for eligibility hard-gate and grade bonus */
  productId?: string;
  /** Vendor must have ALL listed capabilities or is scored 0 */
  requiredCapabilities?: string[];
  clientPreferences?: {
    preferredVendors?: string[];
    excludedVendors?: string[];
    minTier?: VendorTier;
    maxDistance?: number;
    maxFee?: number;
  };
}

export interface VendorMatchResult {
  vendorId: string;
  matchScore: number;              // 0-100
  recentOrders?: number;           // recent completed orders used by AI bid analysis

  // Score Breakdown
  scoreBreakdown: {
    performance: number;           // 30%
    availability: number;          // 25%
    proximity: number;             // 20%
    experience: number;            // 15%
    cost: number;                  // 10%
  };

  // Predictions
  estimatedFee: number | null;
  estimatedTurnaround: number;      // hours
  completionProbability?: number;   // %

  // Geographic
  distance: number | null;          // miles

  // Vendor Details
  vendor: {
    id: string;
    name: string;
    tier: VendorTier;
    overallScore: number;
  };

  // Reasoning
  matchReasons: string[];           // Why this vendor was selected
  warnings?: string[];              // Potential concerns

  /**
   * Full deterministic explanation of how this match was scored — surfaced
   * to operators in the FE and persisted on the order for audit (T6/F9).
   * Always populated by VendorMatchingEngine.scoreVendor.
   */
  explanation: MatchExplanation;
}

/**
 * Audit-grade record of how a vendor was scored for an assignment decision.
 * Persisted onto the order in autoVendorAssignment so disputes ("why was vendor
 * B picked over vendor A?") are answerable from the order document alone.
 */
export interface MatchExplanation {
  vendorId: string;
  scoreComponents: {
    performance: number;
    availability: number;
    proximity: number;
    experience: number;
    cost: number;
  };
  ruleResult: {
    appliedRuleIds: string[];
    denyReasons: string[];
    scoreAdjustment: number;
  };
  baseScore: number;     // weighted sum before rule adjustment
  finalScore: number;    // post-adjustment, clamped to [0,100]
  /**
   * Tag identifying the scoring weights/bands version used. Bumped when scoring
   * becomes data-driven in Phase 3 so historical decisions are replayable.
   */
  weightsVersion: string;
}

/**
 * A vendor that was considered but excluded by a deny rule. Surfaced in the
 * FSM state so operators can answer "why didn't vendor X get considered?"
 */
export interface DeniedVendorEntry {
  vendorId: string;
  vendorName: string;
  denyReasons: string[];
  appliedRuleIds: string[];
}

export interface VendorMatchCriteria {
  minMatchScore?: number;           // Minimum acceptable match score (0-100)
  maxDistance?: number;             // Maximum distance in miles
  requiredTier?: VendorTier;        // Minimum vendor tier
  requireAvailability?: boolean;    // Must have available capacity
  excludedVendors?: string[];       // Vendor IDs to exclude
}

// ─── Matching Criteria Profiles (David/Doug meeting — Phase B) ───────────────
//
// Doug's requirement: each criterion (performance, availability, proximity,
// experience, cost, licensure) should be toggleable per product. Example:
// proximity OFF for DVR/desktop review (reviewer in CA can do an FL desktop),
// licensure ON whenever the work-product requires state licensing.
//
// George's overlay model: canonical defaults at the base, overlay by client,
// overlay by product, overlay by phase (original vs. review). Each overlay
// is versioned. Resolution at match-time merges from base → most-specific.
//
// Phase B (this PR) delivers the data model + storage; the matcher behaviour
// changes (consuming these toggles, proximity expansion, why-no-match reason)
// land in the follow-up since they require a deeper rewrite of
// VendorMatchingEngine.scoreVendor / getEligibleVendors.

export type MatchingCriterionKey =
  | 'performance'
  | 'availability'
  | 'proximity'
  | 'experience'
  | 'cost'
  | 'licensure';

export interface MatchingCriterionConfig {
  /** Whether this criterion participates in the match decision. */
  enabled: boolean;
  /**
   * Weight for the criterion in the blended match score, 0..1.
   * Ignored when `enabled` is false. Sum across enabled criteria should equal 1.0;
   * the matcher renormalizes if not.
   */
  weight: number;
  /**
   * Hard-gate behaviour. When 'HARD_GATE' (e.g. licensure), a failing vendor is
   * removed from candidates entirely. When 'SCORED' (the default), a failing
   * vendor is just penalised by its contribution to the weighted score.
   */
  mode: 'SCORED' | 'HARD_GATE';
}

export interface ProximityCriterionConfig extends MatchingCriterionConfig {
  /** Primary radius in miles. */
  primaryRadiusMiles: number;
  /**
   * Fallback radius for Doug's "expand from 30 to 50 if no match" pattern.
   * Matcher first tries primaryRadiusMiles; if zero candidates, expands.
   * Omit to disable expansion.
   */
  expansionRadiusMiles?: number;
}

export interface VendorMatchingCriteriaProfile {
  /** Cosmos id. Convention: `mcp-<scope>-<scopeId>-<phase>`. */
  id: string;
  tenantId: string;
  /** Discriminator. */
  type: 'vendor-matching-criteria-profile';

  /**
   * Scope hierarchy — at resolution time the matcher walks from BASE to the
   * most-specific overlay (BASE → CLIENT → PRODUCT → CLIENT+PRODUCT) and
   * merges. Phase modifier ('ORIGINAL' vs 'REVIEW') is independent.
   */
  scope: {
    kind: 'BASE' | 'CLIENT' | 'PRODUCT' | 'CLIENT_PRODUCT';
    clientId?: string;        // present when kind ∈ CLIENT, CLIENT_PRODUCT
    productType?: string;     // present when kind ∈ PRODUCT, CLIENT_PRODUCT
  };

  /** ORIGINAL = first appraisal/BPO. REVIEW = secondary review pass. */
  phase: 'ORIGINAL' | 'REVIEW' | 'ANY';

  /** Monotonically increasing version per (scope, phase) pair. */
  version: number;
  /** Whether this is the live version; older versions retained for replay. */
  active: boolean;

  criteria: {
    performance: MatchingCriterionConfig;
    availability: MatchingCriterionConfig;
    proximity: ProximityCriterionConfig;
    experience: MatchingCriterionConfig;
    cost: MatchingCriterionConfig;
    licensure: MatchingCriterionConfig;
  };

  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Top-level reason for an empty match result. Surfaced to assigners per Doug's
 * "tell me why you can't find anyone" requirement. Sanitised — does not list
 * the full criteria set (Doug: "don't want assigners gaming the system").
 */
export type NoMatchReasonCode =
  | 'NO_LICENSED_VENDOR_IN_STATE'
  | 'NO_VENDOR_WITHIN_RADIUS'
  | 'NO_VENDOR_WITH_CAPACITY'
  | 'NO_VENDOR_MEETS_TIER'
  | 'ALL_VENDORS_EXCLUDED_BY_RULES'
  | 'UNKNOWN';

export interface NoMatchReason {
  code: NoMatchReasonCode;
  /** Human-readable, e.g. "No vendor licensed in FL within 50 miles". */
  message: string;
  /** Hints for the assigner — what would unblock the match. */
  hints?: string[];
}

export type NegotiationStatus = 
  | 'PENDING_VENDOR' 
  | 'VENDOR_COUNTERED' 
  | 'CLIENT_COUNTERED' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'EXPIRED' 
  | 'WITHDRAWN';

export interface OrderNegotiation {
  id: string;
  orderId: string;
  vendorId: string;
  clientId: string;
  tenantId: string;
  
  // Current State
  status: NegotiationStatus;
  
  // Original Terms
  originalTerms: {
    fee: number;
    dueDate: Date;
    rushFee: boolean;
    specialInstructions: string;
  };
  
  // Current Terms
  currentTerms: {
    fee: number;
    dueDate: Date;
    additionalConditions: string[];
    vendorNotes?: string;
  };
  
  // Negotiation Timeline
  rounds: {
    roundNumber: number;
    timestamp: Date;
    actor: 'VENDOR' | 'CLIENT' | 'SYSTEM';
    action: 'OFFER' | 'COUNTER' | 'ACCEPT' | 'REJECT';
    proposedTerms: {
      fee: number;
      dueDate: Date;
      notes: string;
    };
    reason?: string;
  }[];
  
  // Business Rules
  maxRounds: number;              // Default: 3
  expirationTime: Date;           // Default: 4 hours
  autoAcceptThreshold?: {
    maxFeeDelta: number;          // Auto-accept if within X%
    maxDateDelta: number;         // Auto-accept if within X days
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  decidedAt?: Date;
  decidedBy?: string;
}

export interface ProposedTerms {
  fee: number;
  dueDate: Date;
  notes?: string;
  additionalConditions?: string[];
}

// Vendor Scorecard Display Types
export interface VendorScorecardSummary {
  vendorId: string;
  vendorName: string;
  overallScore: number;
  tier: VendorTier;
  
  // Key Metrics
  ordersCompleted: number;
  avgTurnaroundTime: number;
  onTimeRate: number;
  qualityScore: number;
  
  // Status
  currentStatus: VendorStatus;
  availableSlots: number;
  
  // Ranking
  rankInTenant?: number;
  rankInRegion?: number;
}

export interface VendorPerformanceHistory {
  vendorId: string;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  
  dataPoints: {
    date: Date;
    overallScore: number;
    ordersCompleted: number;
    avgTurnaround: number;
    qualityScore: number;
  }[];
}

// Request/Response Types for APIs
export interface GetVendorPerformanceRequest {
  vendorId: string;
  includeHistory?: boolean;
  historyPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  historyDays?: number;
}

export interface GetVendorPerformanceResponse {
  success: boolean;
  data: {
    metrics: VendorPerformanceMetrics;
    availability: VendorAvailability;
    history?: VendorPerformanceHistory;
  };
}

export interface SearchVendorsRequest {
  tenantId: string;
  minScore?: number;
  maxScore?: number;
  tiers?: VendorTier[];
  status?: VendorStatus[];
  propertyTypes?: string[];
  serviceArea?: {
    zipCode?: string;
    county?: string;
    state?: string;
  };
  sortBy?: 'score' | 'name' | 'ordersCompleted' | 'turnaroundTime';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchVendorsResponse {
  success: boolean;
  data: {
    vendors: VendorScorecardSummary[];
    total: number;
    offset: number;
    limit: number;
  };
}

export interface CreateNegotiationRequest {
  orderId: string;
  vendorId: string;
  originalFee: number;
  originalDueDate: Date;
  specialInstructions?: string;
  maxRounds?: number;
  expirationHours?: number;
}

export interface CounterOfferRequest {
  negotiationId: string;
  proposedFee: number;
  proposedDueDate: Date;
  notes?: string;
  additionalConditions?: string[];
}
