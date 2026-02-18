/**
 * Vendor Certification Management Service
 * 
 * Handles certification lifecycle: tracking, expiry monitoring, 
 * document storage, renewal alerts, and license verification
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { BlobStorageService } from './blob-storage.service';
import { NotificationService } from './notification.service.js';
import { 
  VendorCertification, 
  CertificationStatus,
  CertificationAlert,
  CertificationUploadRequest,
  CertificationVerificationResult,
  LicenseVerificationRequest
} from '../types/certification.types.js';

export class VendorCertificationService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private blobService: BlobStorageService;
  private notificationService: NotificationService;

  // Alert thresholds (days before expiry)
  private readonly ALERT_THRESHOLDS = {
    CRITICAL: 30,  // 30 days
    WARNING: 60,   // 60 days
    REMINDER: 90   // 90 days
  };

  constructor(dbService?: CosmosDbService) {
    this.logger = new Logger();
    this.dbService = dbService || new CosmosDbService();
    this.blobService = new BlobStorageService();
    this.notificationService = new NotificationService();
  }

  /**
   * Create or update vendor certification
   */
  async createCertification(
    vendorId: string,
    certificationData: Omit<VendorCertification, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VendorCertification> {
    try {
      this.logger.info('Creating vendor certification', { vendorId, type: certificationData.type });

      const certification: VendorCertification = {
        ...certificationData,
        id: `cert-${vendorId}-${Date.now()}`,
        vendorId,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: this.calculateCertificationStatus(certificationData.expiryDate)
      };

      // Store in Cosmos DB
      await this.dbService.createItem('certifications', {
        ...certification,
        type: 'vendor-certification',
        partitionKey: vendorId
      });

      // Schedule expiry alerts
      await this.scheduleExpiryAlerts(certification);

      this.logger.info('Certification created successfully', { 
        certificationId: certification.id,
        vendorId 
      });

      return certification;

    } catch (error) {
      this.logger.error('Failed to create certification', { error, vendorId });
      throw error;
    }
  }

  /**
   * Upload certification document to Azure Blob Storage
   */
  async uploadCertificationDocument(
    certificationId: string,
    vendorId: string,
    request: CertificationUploadRequest
  ): Promise<{ documentUrl: string; uploadedAt: Date }> {
    try {
      this.logger.info('Uploading certification document', { certificationId, vendorId });

      // Validate file
      if (!this.isValidDocumentType(request.fileName)) {
        throw new Error('Invalid document type. Allowed: PDF, JPG, PNG');
      }

      if (request.fileSize > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File size exceeds 10MB limit');
      }

      // Upload to blob storage
      const blobPath = `certifications/${vendorId}/${certificationId}/${request.fileName}`;
      const uploadResult = await this.blobService.uploadFile({
        containerName: 'vendor-documents',
        blobName: blobPath,
        data: request.fileBuffer,
        contentType: request.contentType,
        metadata: {
          vendorId,
          certificationId,
          uploadedBy: request.uploadedBy,
          uploadedAt: new Date().getTime().toString()
        }
      });

      // Update certification record with document URL
      await this.dbService.updateItem('certifications', certificationId, {
        documentUrl: uploadResult.url,
        documentUploadedAt: new Date(),
        status: CertificationStatus.PENDING_VERIFICATION
      }, vendorId);

      this.logger.info('Certification document uploaded', { 
        certificationId, 
        documentUrl: uploadResult.url 
      });

      return {
        documentUrl: uploadResult.url,
        uploadedAt: new Date()
      };

    } catch (error) {
      this.logger.error('Failed to upload certification document', { error, certificationId });
      throw error;
    }
  }

  /**
   * Verify certification (manual or automated)
   */
  async verifyCertification(
    certificationId: string,
    vendorId: string,
    verifiedBy: string,
    notes?: string
  ): Promise<CertificationVerificationResult> {
    try {
      this.logger.info('Verifying certification', { certificationId, verifiedBy });

      const certification = await this.getCertificationById(certificationId, vendorId);
      
      if (!certification) {
        throw new Error('Certification not found');
      }

      // Update certification status
      const updatedCertification = await this.dbService.updateItem(
        'certifications',
        certificationId,
        {
          status: CertificationStatus.VERIFIED,
          verifiedBy,
          verifiedAt: new Date(),
          verificationNotes: notes
        },
        vendorId
      );

      // Send notification to vendor
      await this.notificationService.sendEmail({
        to: certification.vendorEmail || '',
        subject: `Certification Verified: ${certification.type}`,
        body: `Your ${certification.type} certification has been verified and is now active.`,
        priority: 'normal'
      });

      return {
        success: true,
        certificationId,
        status: CertificationStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedBy,
        message: 'Certification verified successfully'
      };

    } catch (error) {
      this.logger.error('Failed to verify certification', { error, certificationId });
      return {
        success: false,
        certificationId,
        status: CertificationStatus.PENDING_VERIFICATION,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  /**
   * Get all certifications for a vendor
   */
  async getVendorCertifications(
    vendorId: string,
    includeExpired: boolean = false
  ): Promise<VendorCertification[]> {
    try {
      // TEMPORARY: Fetch certifications from vendor record until separate collection is populated
      const vendorResult = await this.dbService.findVendorById(vendorId);
      
      if (!vendorResult.success || !vendorResult.data) {
        this.logger.warn('Vendor not found', { vendorId });
        return [];
      }

      const vendor = vendorResult.data;
      const certifications: VendorCertification[] = [];

      // Transform vendor.certifications[] to VendorCertification[]
      if (vendor.certifications && Array.isArray(vendor.certifications)) {
        const now = Date.now(); // Cache current time
        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        
        for (const cert of vendor.certifications) {
          const expiryDate = new Date(cert.expiryDate);
          const daysUntilExpiry = Math.floor((expiryDate.getTime() - now) / MS_PER_DAY);
          
          let status = CertificationStatus.VERIFIED;
          if (daysUntilExpiry < 0) {
            status = CertificationStatus.EXPIRED;
          } else if (daysUntilExpiry <= 60) {
            status = CertificationStatus.EXPIRING_SOON;
          }

          // Skip expired if not requested
          if (!includeExpired && status === CertificationStatus.EXPIRED) {
            continue;
          }

          const issueDate = new Date(cert.issueDate);
          certifications.push({
            id: `${vendorId}-cert-${cert.type.toLowerCase().replace(/\s+/g, '-')}-${cert.number}`,
            vendorId: vendorId,
            type: cert.type as CertificationType,
            licenseNumber: cert.number,
            issuingAuthority: cert.issuingAuthority,
            issueDate: issueDate,
            expiryDate: expiryDate,
            status: status,
            verifiedAt: issueDate,
            verifiedBy: 'system',
            createdAt: issueDate,
            updatedAt: new Date()
          });
        }
      }

      return certifications.sort((a, b) => b.expiryDate.getTime() - a.expiryDate.getTime());

    } catch (error) {
      this.logger.error('Failed to get vendor certifications', { error, vendorId });
      return [];
    }
  }

  /**
   * Get certification by ID
   */
  async getCertificationById(
    certificationId: string,
    vendorId: string
  ): Promise<VendorCertification | null> {
    try {
      const result = await this.dbService.getItem('certifications', certificationId, vendorId);
      return (result as any)?.data || result || null;
    } catch (error) {
      this.logger.error('Failed to get certification', { error, certificationId });
      return null;
    }
  }

  /**
   * Check for expiring certifications and send alerts
   */
  async checkExpiringCertifications(): Promise<CertificationAlert[]> {
    try {
      this.logger.info('Checking for expiring certifications');

      const alerts: CertificationAlert[] = [];
      const now = new Date();

      // Query certifications expiring in next 90 days
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const query = `
        SELECT * FROM c 
        WHERE c.type = 'vendor-certification' 
        AND c.status = @activeStatus
        AND c.expiryDate <= @ninetyDays
        AND c.expiryDate > @now
      `;

      const result = await this.dbService.queryItems('certifications', query, [
        { name: '@activeStatus', value: CertificationStatus.VERIFIED },
        { name: '@ninetyDays', value: ninetyDaysFromNow.toISOString() },
        { name: '@now', value: now.toISOString() }
      ]) as any;

      const certifications: VendorCertification[] = result.resources || [];

      // Create alerts based on days until expiry
      for (const cert of certifications) {
        const daysUntilExpiry = this.calculateDaysUntilExpiry(cert.expiryDate);
        
        let alertLevel: 'CRITICAL' | 'WARNING' | 'REMINDER' | null = null;
        
        if (daysUntilExpiry <= this.ALERT_THRESHOLDS.CRITICAL) {
          alertLevel = 'CRITICAL';
        } else if (daysUntilExpiry <= this.ALERT_THRESHOLDS.WARNING) {
          alertLevel = 'WARNING';
        } else if (daysUntilExpiry <= this.ALERT_THRESHOLDS.REMINDER) {
          alertLevel = 'REMINDER';
        }

        if (alertLevel) {
          const alert: CertificationAlert = {
            certificationId: cert.id,
            vendorId: cert.vendorId,
            certificationType: cert.type,
            expiryDate: cert.expiryDate,
            daysUntilExpiry,
            alertLevel,
            message: `${cert.type} certification expires in ${daysUntilExpiry} days`,
            sentAt: new Date()
          };

          alerts.push(alert);

          // Send notification
          await this.sendExpiryAlert(cert, alertLevel, daysUntilExpiry);
        }
      }

      this.logger.info('Expiry check completed', { alertsGenerated: alerts.length });
      return alerts;

    } catch (error) {
      this.logger.error('Failed to check expiring certifications', { error });
      return [];
    }
  }

  /**
   * Verify license with state licensing board (stub for external API)
   */
  async verifyLicenseWithStateBoard(
    request: LicenseVerificationRequest
  ): Promise<CertificationVerificationResult> {
    try {
      this.logger.info('Verifying license with state board', { 
        licenseNumber: request.licenseNumber,
        state: request.state 
      });

      // TODO: Integrate with state licensing board APIs
      // For now, return mock verification

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock verification result
      const isValid = Math.random() > 0.1; // 90% success rate for demo

      return {
        success: isValid,
        certificationId: request.certificationId,
        status: isValid ? CertificationStatus.VERIFIED : CertificationStatus.REJECTED,
        verifiedAt: new Date(),
        verifiedBy: 'STATE_LICENSING_BOARD',
        message: isValid 
          ? `License ${request.licenseNumber} verified with ${request.state} licensing board`
          : `License ${request.licenseNumber} could not be verified`,
        externalVerificationId: `EXT-${Date.now()}`
      };

    } catch (error) {
      this.logger.error('License verification failed', { error, request });
      return {
        success: false,
        certificationId: request.certificationId,
        status: CertificationStatus.PENDING_VERIFICATION,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  /**
   * Update certification status based on expiry
   */
  async updateExpiredCertifications(): Promise<number> {
    try {
      this.logger.info('Updating expired certifications');

      const now = new Date();
      const query = `
        SELECT * FROM c 
        WHERE c.type = 'vendor-certification'
        AND c.status = @activeStatus
        AND c.expiryDate < @now
      `;

      const result = await this.dbService.queryItems('certifications', query, [
        { name: '@activeStatus', value: CertificationStatus.VERIFIED },
        { name: '@now', value: now.toISOString() }
      ]) as any;

      const expiredCerts: VendorCertification[] = result.resources || [];

      // Update each to EXPIRED status
      for (const cert of expiredCerts) {
        await this.dbService.updateItem('certifications', cert.id, {
          status: CertificationStatus.EXPIRED,
          expiredAt: now
        }, cert.vendorId);

        // Notify vendor
        await this.notificationService.sendEmail({
          to: cert.vendorEmail || '',
          subject: `URGENT: Certification Expired - ${cert.type}`,
          body: `Your ${cert.type} certification has expired. Please renew immediately to continue accepting orders.`,
          priority: 'high'
        });
      }

      this.logger.info('Expired certifications updated', { count: expiredCerts.length });
      return expiredCerts.length;

    } catch (error) {
      this.logger.error('Failed to update expired certifications', { error });
      return 0;
    }
  }

  // ===========================
  // PRIVATE HELPER METHODS
  // ===========================

  /**
   * Calculate certification status based on expiry date
   */
  private calculateCertificationStatus(expiryDate: Date): CertificationStatus {
    const now = new Date();
    const expiry = new Date(expiryDate);

    if (expiry < now) {
      return CertificationStatus.EXPIRED;
    }

    const daysUntilExpiry = this.calculateDaysUntilExpiry(expiryDate);

    if (daysUntilExpiry <= this.ALERT_THRESHOLDS.CRITICAL) {
      return CertificationStatus.EXPIRING_SOON;
    }

    return CertificationStatus.PENDING_VERIFICATION;
  }

  /**
   * Calculate days until expiry
   */
  private calculateDaysUntilExpiry(expiryDate: Date): number {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Schedule expiry alerts for certification
   */
  private async scheduleExpiryAlerts(certification: VendorCertification): Promise<void> {
    try {
      // Store alert schedule in database for background job processing
      await this.dbService.createItem('certification-alert-schedule', {
        id: `alert-schedule-${certification.id}`,
        certificationId: certification.id,
        vendorId: certification.vendorId,
        expiryDate: certification.expiryDate,
        alertThresholds: this.ALERT_THRESHOLDS,
        type: 'certification-alert-schedule',
        createdAt: new Date()
      });

      this.logger.info('Expiry alerts scheduled', { certificationId: certification.id });

    } catch (error) {
      this.logger.error('Failed to schedule expiry alerts', { error, certificationId: certification.id });
    }
  }

  /**
   * Send expiry alert notification
   */
  private async sendExpiryAlert(
    certification: VendorCertification,
    alertLevel: 'CRITICAL' | 'WARNING' | 'REMINDER',
    daysUntilExpiry: number
  ): Promise<void> {
    try {
      const urgency = alertLevel === 'CRITICAL' ? 'high' : 'normal';
      const subject = `${alertLevel}: ${certification.type} Expiring in ${daysUntilExpiry} Days`;
      const body = `
Your ${certification.type} certification is expiring soon.

Certification Details:
- Type: ${certification.type}
- License Number: ${certification.licenseNumber}
- Issuing Authority: ${certification.issuingAuthority}
- Expiry Date: ${new Date(certification.expiryDate).toLocaleDateString()}
- Days Remaining: ${daysUntilExpiry}

Please renew your certification to avoid service interruption.
`;

      await this.notificationService.sendEmail({
        to: certification.vendorEmail || '',
        subject,
        body,
        priority: urgency
      });

      this.logger.info('Expiry alert sent', { 
        certificationId: certification.id,
        alertLevel,
        daysUntilExpiry 
      });

    } catch (error) {
      this.logger.error('Failed to send expiry alert', { error, certificationId: certification.id });
    }
  }

  /**
   * Validate document file type
   */
  private isValidDocumentType(fileName: string): boolean {
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return allowedExtensions.includes(extension);
  }
}
