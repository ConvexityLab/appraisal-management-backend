/**
 * Advanced Auto-Matching & Routing Engine Types
 * 
 * Pillar 1: The Auto-Assign & Matching Engine
 * Defines models for Scorecards, Predictive acceptance, and Capacity Tracking
 */

export interface VendorScorecard {
  vendorId: string;
  tenantId: string;
  
  // 1.1 Multi-Factor Dynamic Scores (0-100)
  overallMatchScore: number;
  proximityScore: number; // based on drive time to subject property
  onTimePerformanceScore: number; 
  revisionRateScore: number; 
  underwritingQualityScore: number; // historically passed manual QA
  
  // 1.2 Competency Match (Boolean flags evaluating the property)
  isFhaCompliant: boolean;
  isVaCompliant: boolean;
  isCommercialCapable: boolean;
  hasComplexPropertyExperience: boolean;
  
  // 1.3 Predictive Variables
  predictedAcceptanceProbability: number; // % chance they accept fee/SLA
  historicalAverageFeeForZip: number; 

  lastCalculatedAt: string;
}

export type ExclusionTier = 'CLIENT_PREFERRED' | 'PLATFORM_PREFERRED' | 'GENERAL_POOL' | 'DNU_DO_NOT_USE';

/**
 * Pillar 2: Intelligent Routing & Cascading Broadcasts
 */
export type RoutingStrategyType = 'SEQUENTIAL_WATERFALL' | 'TIERED_BROADCAST' | 'DIRECT_EXCEPTIONS';

export interface CascadingRoutingRule {
  id: string;
  strategy: RoutingStrategyType;
  
  // Fallbacks: e.g. "Wait 2 hours before broadening to General Pool"
  timeoutWindowMinutes: number;
  
  // E.g., blast to 3 vendors, or try individually
  batchSize: number; 
  
  tierTarget: ExclusionTier;
  fallbackRuleId?: string; // pointer to the next rule to execute
}

export interface RoutingEngineState {
  orderId: string;
  currentRuleId: string;
  vendorsPinged: string[]; // array of vendorIds already attempted
  currentPingStartAt: string; // ISO time of the active broadcast
  status: 'EVALUATING' | 'BROADCASTING' | 'WAITING_ACCEPTANCE' | 'FAILED_ESCALATED' | 'ASSIGNED';
}

/**
 * Pillar 3: Advanced Scheduling & Capacity Management
 */
export interface VendorCapacityThrottle {
  vendorId: string;
  // Dynamic limits
  maxActiveOrdersLimit: number;
  currentActiveOrders: number;
  
  // O365 / Google synced calendar windows
  calendarSyncEnabled: boolean;
  outOfOfficeStart?: string; // ISO
  outOfOfficeEnd?: string; // ISO
  
  // Working hours
  typicalAvailableDays: string[]; // e.g. ["Mon", "Tue", "Wed", "Thu", "Fri"]
  dailyCapacitySlots: number;
}
