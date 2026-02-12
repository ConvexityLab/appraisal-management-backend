/**
 * Vendor Certification Management Types
 */

export enum CertificationStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  EXPIRING_SOON = 'EXPIRING_SOON',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED'
}

export enum CertificationType {
  APPRAISER_LICENSE = 'APPRAISER_LICENSE',
  STATE_CERTIFICATION = 'STATE_CERTIFICATION',
  SRA = 'SRA',  // Senior Residential Appraiser
  MAI = 'MAI',  // Member Appraisal Institute
  FHA_APPROVAL = 'FHA_APPROVAL',
  VA_APPROVAL = 'VA_APPROVAL',
  USPAP_COMPLIANCE = 'USPAP_COMPLIANCE',
  E_AND_O_INSURANCE = 'E_AND_O_INSURANCE',
  GENERAL_LIABILITY = 'GENERAL_LIABILITY',
  OTHER = 'OTHER'
}

export interface VendorCertification {
  id: string;
  vendorId: string;
  type: CertificationType | string;
  licenseNumber: string;
  issuingAuthority: string;
  issueDate: Date;
  expiryDate: Date;
  status: CertificationStatus;
  
  // Document storage
  documentUrl?: string;
  documentUploadedAt?: Date;
  
  // Verification
  verifiedBy?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
  externalVerificationId?: string;
  
  // Contact
  vendorEmail?: string;
  vendorPhone?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  expiredAt?: Date;
  
  // Additional info
  restrictions?: string[];
  coverageStates?: string[];
  specialConditions?: string;
}

export interface CertificationUploadRequest {
  fileName: string;
  fileSize: number;
  fileBuffer: Buffer;
  contentType: string;
  uploadedBy: string;
}

export interface CertificationVerificationResult {
  success: boolean;
  certificationId: string;
  status: CertificationStatus;
  verifiedAt?: Date;
  verifiedBy?: string;
  message?: string;
  error?: string;
  externalVerificationId?: string;
}

export interface LicenseVerificationRequest {
  certificationId: string;
  licenseNumber: string;
  state: string;
  certificationType: CertificationType | string;
  vendorId: string;
}

export interface CertificationAlert {
  certificationId: string;
  vendorId: string;
  certificationType: CertificationType | string;
  expiryDate: Date;
  daysUntilExpiry: number;
  alertLevel: 'CRITICAL' | 'WARNING' | 'REMINDER';
  message: string;
  sentAt: Date;
}

export interface CertificationSummary {
  vendorId: string;
  totalCertifications: number;
  activeCertifications: number;
  expiredCertifications: number;
  expiringSoon: number;
  pendingVerification: number;
  nextExpiryDate?: Date;
  nextExpiringCertification?: string;
}

export interface CertificationSearchFilters {
  vendorId?: string;
  status?: CertificationStatus[];
  certificationType?: CertificationType[];
  expiringInDays?: number;
  state?: string;
  issuingAuthority?: string;
}

export interface BulkCertificationUploadRequest {
  vendorId: string;
  certifications: Array<{
    type: CertificationType | string;
    licenseNumber: string;
    issuingAuthority: string;
    issueDate: Date;
    expiryDate: Date;
    documentFile?: {
      fileName: string;
      fileBuffer: Buffer;
      contentType: string;
    };
  }>;
  uploadedBy: string;
}

export interface BulkCertificationUploadResult {
  success: boolean;
  totalUploaded: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    certificationType: string;
    success: boolean;
    certificationId?: string;
    error?: string;
  }>;
}
