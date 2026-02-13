/**
 * Inspection Types
 * Property inspection scheduling and appointment management
 */

/**
 * Inspection status lifecycle
 */
export type InspectionStatus = 
  | 'scheduled'     // Appointment confirmed
  | 'confirmed'     // Homeowner/tenant confirmed availability
  | 'in_progress'   // Inspection currently happening
  | 'completed'     // Inspection finished
  | 'cancelled'     // Cancelled by any party
  | 'rescheduled'   // Needs new time slot
  | 'no_access';    // Could not access property

/**
 * Who requested the inspection
 */
export type InspectionRequestedBy = 
  | 'appraiser' 
  | 'client' 
  | 'system' 
  | 'homeowner';

/**
 * Inspection appointment time slot
 */
export interface TimeSlot {
  date: string;           // ISO date: "2026-02-15"
  startTime: string;      // 24h format: "09:00"
  endTime: string;        // 24h format: "11:00"
  timezone: string;       // IANA timezone: "America/Chicago"
}

/**
 * Property access information
 */
export interface PropertyAccess {
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  accessInstructions?: string;      // Gate codes, lockbox, etc.
  requiresEscort: boolean;
  petWarning?: string;
  parkingInstructions?: string;
  specialRequirements?: string[];   // ["Occupied", "Tenant present", "After 5pm only"]
}

/**
 * Inspection appointment
 */
export interface InspectionAppointment {
  id: string;
  type: 'inspection';                 // Cosmos document type
  tenantId: string;
  
  // Order relationship
  orderId: string;
  orderNumber: string;
  
  // Appraiser assignment
  appraiserId: string;
  appraiserName: string;
  appraiserPhone: string;
  
  // Property details
  propertyAddress: string;
  propertyType: string;
  propertyAccess: PropertyAccess;
  
  // Scheduling
  status: InspectionStatus;
  scheduledSlot: TimeSlot;
  alternateSlots?: TimeSlot[];        // Proposed alternatives if rescheduling
  
  // Confirmation tracking
  requestedBy: InspectionRequestedBy;
  requestedAt: string;                // ISO timestamp
  confirmedAt?: string;
  confirmedBy?: string;               // userId who confirmed
  
  // Completion tracking
  startedAt?: string;                 // When inspection began
  completedAt?: string;               // When inspection finished
  durationMinutes?: number;           // Actual time spent
  
  // Cancellation/Rescheduling
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  rescheduledFrom?: TimeSlot;         // Original slot if rescheduled
  rescheduledReason?: string;
  
  // Notes and issues
  inspectionNotes?: string;
  accessIssues?: string;
  photoCount?: number;
  
  // Notifications
  reminderSentAt?: string;
  confirmationEmailSentAt?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Request to schedule an inspection
 */
export interface ScheduleInspectionRequest {
  orderId: string;
  appraiserId: string;
  scheduledSlot: TimeSlot;
  propertyAccess: PropertyAccess;
  requestedBy: InspectionRequestedBy;
  inspectionNotes?: string;
}

/**
 * Request to reschedule an inspection
 */
export interface RescheduleInspectionRequest {
  newSlot: TimeSlot;
  reason: string;
  alternateSlots?: TimeSlot[];
}

/**
 * Appraiser availability for date range
 */
export interface AppraiserAvailability {
  appraiserId: string;
  appraiserName: string;
  date: string;
  availableSlots: TimeSlot[];
  bookedSlots: TimeSlot[];
  travelTimeMinutes: number;          // To property from previous appointment
}

/**
 * Conflict check result
 */
export interface SchedulingConflict {
  hasConflict: boolean;
  conflictType?: 'double_booked' | 'travel_time' | 'outside_hours' | 'holiday';
  conflictingAppointment?: {
    inspectionId: string;
    orderId: string;
    scheduledSlot: TimeSlot;
  };
  message?: string;
}

/**
 * Inspection statistics
 */
export interface InspectionStats {
  totalScheduled: number;
  totalCompleted: number;
  totalCancelled: number;
  averageDurationMinutes: number;
  onTimePercentage: number;
  accessIssuesCount: number;
}
