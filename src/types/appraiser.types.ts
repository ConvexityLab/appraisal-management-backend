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
  
  // Conflict of Interest
  conflictProperties: ConflictProperty[];
  
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
