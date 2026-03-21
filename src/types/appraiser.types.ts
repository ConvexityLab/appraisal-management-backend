/**
 * Appraiser Types
 * Defines appraiser profiles, licenses, certifications, and assignments
 */

export interface Appraiser {
  id: string;
  type: 'appraiser';
  tenantId: string;
  
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // License Information
  licenses: License[];
  certifications: Certification[];
  
  // Professional Details
  specialties: AppraiserSpecialty[];
  serviceArea: ServiceArea;
  yearsOfExperience: number;
  employmentStatus: 'staff' | 'contract' | 'freelance';
  
  // Performance Metrics
  rating: number;
  completedAppraisals: number;
  averageTurnaroundTime: string;
  qcPassRate: number;
  
  // Availability
  status: 'active' | 'inactive' | 'suspended';
  availability: 'available' | 'busy' | 'on_leave';
  currentWorkload: number;
  maxCapacity: number;
  
  // Calendar & Scheduling limits (Pillar 3)
  outOfOffice?: {
    startDate: string; // ISO 8601
    endDate: string; // ISO 8601
    reason?: string;
  }[];
  dailyCapacitySlots?: number;

  // Conflict of Interest
  conflictProperties: ConflictProperty[];

  // ── Extended profile (Increment 1) ────────────────────────────────────────
  /**
   * Weekly recurring work schedule blocks (same shape as VendorProfile.workSchedule).
   * Used by the supervisor roster "Available now" column and assignment UI.
   */
  workSchedule?: {
    dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    startTime: string;
    endTime: string;
    timezone?: string;
  }[];
  /**
   * Three-zone geographic coverage: licensed / preferred / extended.
   * Takes precedence over the flat `serviceArea` for matching engine scoring.
   */
  geographicCoverage?: {
    licensed:  { states: string[]; counties?: string[]; zipCodes?: string[] };
    preferred?: { states: string[]; counties?: string[]; zipCodes?: string[]; radiusMiles?: number };
    extended?:  { states: string[]; counties?: string[]; travelFeePerMile?: number };
  };
  /** Structured capability flags (mirrors VendorCapability union in index.ts). */
  capabilities?: string[];
  /** Product catalog IDs this appraiser is eligible for. */
  eligibleProductIds?: string[];
  /** Per-product proficiency grades. */
  productGrades?: {
    productId: string;
    grade: 'trainee' | 'proficient' | 'expert' | 'lead';
    certifiedBy: string;
    certifiedAt: string;
    notes?: string;
  }[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastAssignmentAt?: string;
}

export interface License {
  id: string;
  type: 'state_license' | 'certified_residential' | 'certified_general' | 'trainee';
  state: string;
  licenseNumber: string;
  issuedDate: string;
  expirationDate: string;
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  verificationUrl?: string;
  documentUrl?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuingOrganization: string;
  certificationNumber?: string;
  issuedDate: string;
  expirationDate?: string;
  documentUrl?: string;
}

export type AppraiserSpecialty = 
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'agricultural'
  | 'luxury'
  | 'condo'
  | 'multi_family'
  | 'land'
  | 'fha'
  | 'va';

export interface ServiceArea {
  states: string[];
  counties: string[];
  cities: string[];
  zipcodes: string[];
  radiusMiles?: number;
  centerPoint?: {
    lat: number;
    lng: number;
  };
}

export interface ConflictProperty {
  address: string;
  reason: 'ownership' | 'family' | 'financial_interest' | 'prior_appraisal';
  radiusMiles: number;
  notes?: string;
  addedAt: string;
}

export interface AppraiserAssignment {
  id: string;
  type: 'appraiser_assignment';
  tenantId: string;
  
  orderId: string;
  orderNumber: string;
  appraiserId: string;
  
  assignedAt: string;
  assignedBy: string;
  acceptedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  
  // Property Details (for conflict checking)
  propertyAddress: string;
  propertyLat?: number;
  propertyLng?: number;
  
  // Fee & Negotiation
  proposedFee?: number;
  agreedFee?: number;
  counterOfferFee?: number;
  counterOfferNotes?: string;
  negotiationId?: string;
  
  // SLA
  slaDeadline?: string;
  slaStartedAt?: string;
  
  // Timeline
  estimatedCompletionDate?: string;
  actualCompletionDate?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: Array<{
    type: 'distance' | 'property_conflict';
    reason: string;
    distance?: number;
    conflictProperty?: ConflictProperty;
  }>;
}
