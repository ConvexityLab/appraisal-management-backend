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

export interface VendorAvailability {
  id: string;
  vendorId: string;
  
  // Capacity Management
  currentCapacity: number;        // Max concurrent orders
  currentLoad: number;            // Current active orders
  availableSlots: number;         // Calculated field
  
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
  orderId: string;
  propertyAddress: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    county: string;
    lat?: number;
    lng?: number;
  };
  propertyType: string;
  loanAmount: number;
  dueDate: Date;
  urgency: 'STANDARD' | 'RUSH' | 'SUPER_RUSH';
  specialRequirements?: string[];
  clientPreferences?: {
    preferredVendors?: string[];
    blacklistedVendors?: string[];
    minQualityScore?: number;
    maxFee?: number;
  };
}

export interface VendorMatchResult {
  vendorId: string;
  matchScore: number;              // 0-100
  
  // Score Breakdown
  scoreBreakdown: {
    qualityScore: number;          // 30%
    availabilityScore: number;     // 25%
    proximityScore: number;        // 20%
    experienceScore: number;       // 15%
    costScore: number;             // 10%
  };
  
  // Predictions
  estimatedFee: number;
  estimatedTurnaround: number;      // hours
  completionProbability: number;    // %
  
  // Reasoning
  matchReasons: string[];           // Why this vendor was selected
  warnings?: string[];              // Potential concerns
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
