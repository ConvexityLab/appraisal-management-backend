/**
 * Vendor Onboarding Service
 * Manages multi-step vendor onboarding workflow
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { BlobStorageService } from './blob-storage.service';
import { NotificationService } from './notification.service.js';
import {
  OnboardingApplication,
  OnboardingStatus,
  OnboardingStep,
  OnboardingStepType,
  OnboardingStepStatus,
  OnboardingCreateRequest,
  OnboardingDocumentUploadRequest,
  OnboardingStepCompleteRequest,
  OnboardingReviewRequest,
  OnboardingReviewResult,
  DocumentRequirement,
  UploadedDocument,
  BackgroundCheckRequest,
  BackgroundCheckResult
} from '../types/onboarding.types.js';

export class VendorOnboardingService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private blobService: BlobStorageService;
  private notificationService: NotificationService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.blobService = new BlobStorageService();
    this.notificationService = new NotificationService();
  }

  /**
   * Create new onboarding application
   */
  async createApplication(request: OnboardingCreateRequest): Promise<OnboardingApplication> {
    try {
      this.logger.info('Creating onboarding application', { 
        businessName: request.businessInfo.businessName 
      });

      const applicationId = `onboard-${Date.now()}`;
      
      // Create workflow steps
      const steps = this.createOnboardingSteps();

      const application: OnboardingApplication = {
        id: applicationId,
        applicantInfo: request.applicantInfo,
        businessInfo: request.businessInfo,
        serviceInfo: request.serviceInfo,
        status: OnboardingStatus.IN_PROGRESS,
        currentStep: OnboardingStepType.APPLICATION_FORM,
        completedSteps: [OnboardingStepType.APPLICATION_FORM], // First step auto-completed
        steps,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in database
      const createResult = await this.dbService.createItem('vendor-onboarding', {
        ...application,
        type: 'onboarding-application',
        partitionKey: applicationId
      });

      if (!createResult.success) {
        this.logger.error('Failed to store onboarding application in Cosmos', { 
          error: createResult.error,
          applicationId 
        });
        throw new Error('Failed to store application');
      }

      // Send confirmation email
      await this.notificationService.sendEmail({
        to: request.applicantInfo.email,
        subject: 'Vendor Onboarding Application Received',
        body: this.generateWelcomeEmail(application),
        priority: 'normal'
      });

      this.logger.info('Onboarding application created', { applicationId });
      return application;

    } catch (error) {
      this.logger.error('Failed to create onboarding application', { error });
      throw error;
    }
  }

  /**
   * Get application by ID
   */
  async getApplication(applicationId: string): Promise<OnboardingApplication | null> {
    try {
      const result = await this.dbService.getItem('vendor-onboarding', applicationId, applicationId);
      
      if (!result.success || !result.data) {
        this.logger.warn('Application not found', { applicationId, error: result.error });
        return null;
      }
      
      const app = result.data as any;
      
      // Ensure steps array exists
      if (!app.steps || !Array.isArray(app.steps)) {
        app.steps = this.createOnboardingSteps();
      }
      
      return app as OnboardingApplication;
    } catch (error) {
      this.logger.error('Failed to get application', { error, applicationId });
      return null;
    }
  }

  /**
   * Upload document for onboarding step
   */
  async uploadDocument(request: OnboardingDocumentUploadRequest): Promise<UploadedDocument> {
    try {
      this.logger.info('Uploading onboarding document', { 
        applicationId: request.applicationId,
        stepType: request.stepType 
      });

      // Get application
      const application = await this.getApplication(request.applicationId);
      if (!application) {
        throw new Error('Application not found');
      }

      // Upload to blob storage
      const blobPath = `onboarding/${request.applicationId}/${request.stepType}/${request.fileName}`;
      const uploadResult = await this.blobService.uploadFile({
        containerName: 'vendor-documents',
        blobName: blobPath,
        data: request.fileData,
        contentType: request.contentType,
        metadata: {
          applicationId: request.applicationId,
          stepType: request.stepType,
          requirementId: request.requirementId,
          uploadedBy: request.uploadedBy,
          uploadedAt: new Date().getTime().toString()
        }
      });

      // Create uploaded document record
      const uploadedDoc: UploadedDocument = {
        id: `doc-${Date.now()}`,
        requirementId: request.requirementId,
        fileName: request.fileName,
        fileUrl: uploadResult.url,
        fileSize: request.fileData.length,
        contentType: request.contentType,
        uploadedAt: new Date(),
        uploadedBy: request.uploadedBy,
        verified: false
      };

      // Update application with uploaded document
      const step = application.steps.find(s => s.type === request.stepType);
      if (step) {
        step.documentsUploaded = [...(step.documentsUploaded || []), uploadedDoc];
        
        // Check if all required documents are uploaded
        const allDocsUploaded = step.documentsRequired?.every(req => 
          step.documentsUploaded?.some(doc => doc.requirementId === req.id)
        );

        if (allDocsUploaded) {
          step.status = OnboardingStepStatus.COMPLETED;
          step.completedAt = new Date();
        }
      }

      await this.updateApplication(application);

      this.logger.info('Document uploaded successfully', { 
        applicationId: request.applicationId,
        documentId: uploadedDoc.id 
      });

      return uploadedDoc;

    } catch (error) {
      this.logger.error('Failed to upload document', { error, request });
      throw error;
    }
  }

  /**
   * Complete onboarding step
   */
  async completeStep(request: OnboardingStepCompleteRequest): Promise<OnboardingApplication> {
    try {
      this.logger.info('Completing onboarding step', { 
        applicationId: request.applicationId,
        stepType: request.stepType 
      });

      const application = await this.getApplication(request.applicationId);
      if (!application) {
        throw new Error('Application not found');
      }

      // Update step
      const step = application.steps.find(s => s.type === request.stepType);
      if (!step) {
        throw new Error('Step not found');
      }

      step.status = OnboardingStepStatus.COMPLETED;
      step.completedAt = new Date();
      step.completedBy = request.completedBy;
      if (request.dataCollected) {
        step.dataCollected = request.dataCollected;
      }

      // Add to completed steps
      if (!application.completedSteps.includes(request.stepType)) {
        application.completedSteps.push(request.stepType);
      }

      // Move to next step
      const nextStep = this.getNextStep(application.steps, step.order);
      if (nextStep) {
        application.currentStep = nextStep.type;
        nextStep.status = OnboardingStepStatus.IN_PROGRESS;
        nextStep.startedAt = new Date();
      } else {
        // All steps completed - ready for review
        application.status = OnboardingStatus.UNDER_REVIEW;
      }

      application.updatedAt = new Date();

      await this.updateApplication(application);

      // Send progress notification
      await this.notificationService.sendEmail({
        to: application.applicantInfo.email,
        subject: `Onboarding Step Completed: ${step.title}`,
        body: this.generateStepCompleteEmail(application, step),
        priority: 'normal'
      });

      this.logger.info('Onboarding step completed', { 
        applicationId: request.applicationId,
        stepType: request.stepType 
      });

      return application;

    } catch (error) {
      this.logger.error('Failed to complete step', { error, request });
      throw error;
    }
  }

  /**
   * Review and approve/reject onboarding application
   */
  async reviewApplication(request: OnboardingReviewRequest): Promise<OnboardingReviewResult> {
    try {
      this.logger.info('Reviewing onboarding application', { 
        applicationId: request.applicationId,
        approved: request.approved 
      });

      const application = await this.getApplication(request.applicationId);
      if (!application) {
        return {
          success: false,
          applicationId: request.applicationId,
          status: OnboardingStatus.NOT_STARTED,
          message: 'Application not found',
          error: 'Application not found'
        };
      }

      if (request.approved) {
        // Approve - create vendor profile
        const vendorId = await this.createVendorFromApplication(application);
        
        application.status = OnboardingStatus.APPROVED;
        application.approvedAt = new Date();
        application.vendorId = vendorId;
        application.reviewedBy = request.reviewedBy;
        application.reviewedAt = new Date();
        if (request.reviewNotes) {
          application.reviewNotes = request.reviewNotes;
        }

        await this.updateApplication(application);

        // Send approval notification
        await this.notificationService.sendEmail({
          to: application.applicantInfo.email,
          subject: 'Vendor Application Approved - Welcome!',
          body: this.generateApprovalEmail(application, vendorId),
          priority: 'normal'
        });

        this.logger.info('Application approved', { 
          applicationId: request.applicationId,
          vendorId 
        });

        return {
          success: true,
          applicationId: request.applicationId,
          status: OnboardingStatus.APPROVED,
          vendorId,
          message: 'Application approved successfully'
        };

      } else {
        // Reject
        application.status = OnboardingStatus.REJECTED;
        application.rejectedAt = new Date();
        application.reviewedBy = request.reviewedBy;
        application.reviewedAt = new Date();
        if (request.reviewNotes) {
          application.reviewNotes = request.reviewNotes;
        }
        if (request.rejectionReason) {
          application.rejectionReason = request.rejectionReason;
        }

        await this.updateApplication(application);

        // Send rejection notification
        await this.notificationService.sendEmail({
          to: application.applicantInfo.email,
          subject: 'Vendor Application Status Update',
          body: this.generateRejectionEmail(application, request.rejectionReason),
          priority: 'normal'
        });

        this.logger.info('Application rejected', { 
          applicationId: request.applicationId,
          reason: request.rejectionReason 
        });

        return {
          success: true,
          applicationId: request.applicationId,
          status: OnboardingStatus.REJECTED,
          message: 'Application rejected'
        };
      }

    } catch (error) {
      this.logger.error('Failed to review application', { error, request });
      return {
        success: false,
        applicationId: request.applicationId,
        status: OnboardingStatus.UNDER_REVIEW,
        message: 'Review failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all applications with optional status filter
   */
  async getApplications(status?: OnboardingStatus): Promise<OnboardingApplication[]> {
    try {
      let query = `SELECT * FROM c WHERE c.type = 'onboarding-application'`;
      const parameters: any[] = [];

      if (status) {
        query += ` AND c.status = @status`;
        parameters.push({ name: '@status', value: status });
      }

      query += ` ORDER BY c.createdAt DESC`;

      const result = await this.dbService.queryItems('vendor-onboarding', query, parameters) as any;
      return result.resources || [];

    } catch (error) {
      this.logger.error('Failed to get applications', { error });
      return [];
    }
  }

  /**
   * Request background check for applicant
   */
  async requestBackgroundCheck(request: BackgroundCheckRequest): Promise<BackgroundCheckResult> {
    try {
      this.logger.info('Requesting background check', { applicationId: request.applicationId });

      // TODO: Integrate with background check service (Checkr, Sterling, etc.)
      
      // Simulate background check
      await new Promise(resolve => setTimeout(resolve, 1000));

      const result: BackgroundCheckResult = {
        success: true,
        checkId: `bgcheck-${Date.now()}`,
        status: 'CLEAR',
        completedAt: new Date(),
        findings: [],
        reportUrl: `https://storage.example.com/background-checks/report-${Date.now()}.pdf`
      };

      // Update application step
      const application = await this.getApplication(request.applicationId);
      if (application) {
        const step = application.steps.find(s => s.type === OnboardingStepType.BACKGROUND_CHECK);
        if (step) {
          step.status = OnboardingStepStatus.COMPLETED;
          step.completedAt = new Date();
          step.dataCollected = { backgroundCheckResult: result };
          await this.updateApplication(application);
        }
      }

      return result;

    } catch (error) {
      this.logger.error('Background check failed', { error });
      return {
        success: false,
        checkId: `bgcheck-${Date.now()}`,
        status: 'FAILED',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Background check failed'
      };
    }
  }

  // ===========================
  // PRIVATE HELPER METHODS
  // ===========================

  /**
   * Create standard onboarding steps
   */
  private createOnboardingSteps(): OnboardingStep[] {
    return [
      {
        type: OnboardingStepType.APPLICATION_FORM,
        status: OnboardingStepStatus.COMPLETED,
        title: 'Application Form',
        description: 'Complete initial application',
        required: true,
        order: 1,
        requiresVerification: false,
        completedAt: new Date()
      },
      {
        type: OnboardingStepType.BUSINESS_INFORMATION,
        status: OnboardingStepStatus.PENDING,
        title: 'Business Information',
        description: 'Provide detailed business information',
        required: true,
        order: 2,
        requiresVerification: true
      },
      {
        type: OnboardingStepType.LICENSE_UPLOAD,
        status: OnboardingStepStatus.PENDING,
        title: 'License Documentation',
        description: 'Upload appraiser licenses and certifications',
        required: true,
        order: 3,
        requiresVerification: true,
        documentsRequired: [
          {
            id: 'license-1',
            type: 'APPRAISER_LICENSE',
            name: 'State Appraiser License',
            description: 'Current state appraiser license',
            required: true,
            acceptedFormats: ['PDF', 'JPG', 'PNG'],
            maxSizeMB: 5
          }
        ]
      },
      {
        type: OnboardingStepType.INSURANCE_UPLOAD,
        status: OnboardingStepStatus.PENDING,
        title: 'Insurance Documentation',
        description: 'Upload E&O insurance and general liability',
        required: true,
        order: 4,
        requiresVerification: true,
        documentsRequired: [
          {
            id: 'insurance-1',
            type: 'EO_INSURANCE',
            name: 'E&O Insurance Certificate',
            description: 'Current E&O insurance certificate',
            required: true,
            acceptedFormats: ['PDF'],
            maxSizeMB: 5
          }
        ]
      },
      {
        type: OnboardingStepType.W9_FORM,
        status: OnboardingStepStatus.PENDING,
        title: 'W9 Tax Form',
        description: 'Upload completed W9 form',
        required: true,
        order: 5,
        requiresVerification: true,
        documentsRequired: [
          {
            id: 'w9',
            type: 'W9_FORM',
            name: 'W9 Form',
            description: 'Completed and signed W9 form',
            required: true,
            acceptedFormats: ['PDF'],
            maxSizeMB: 2
          }
        ]
      },
      {
        type: OnboardingStepType.BANK_INFORMATION,
        status: OnboardingStepStatus.PENDING,
        title: 'Payment Information',
        description: 'Provide bank account for payments',
        required: true,
        order: 6,
        requiresVerification: true
      },
      {
        type: OnboardingStepType.BACKGROUND_CHECK,
        status: OnboardingStepStatus.PENDING,
        title: 'Background Check',
        description: 'Complete background verification',
        required: true,
        order: 7,
        requiresVerification: true
      },
      {
        type: OnboardingStepType.AGREEMENT_SIGNATURE,
        status: OnboardingStepStatus.PENDING,
        title: 'Vendor Agreement',
        description: 'Review and sign vendor agreement',
        required: true,
        order: 8,
        requiresVerification: false
      },
      {
        type: OnboardingStepType.FINAL_APPROVAL,
        status: OnboardingStepStatus.PENDING,
        title: 'Final Review',
        description: 'Final approval by management',
        required: true,
        order: 9,
        requiresVerification: true
      }
    ];
  }

  /**
   * Get next step in workflow
   */
  private getNextStep(steps: OnboardingStep[], currentOrder: number): OnboardingStep | null {
    const sortedSteps = steps.sort((a, b) => a.order - b.order);
    return sortedSteps.find(s => s.order > currentOrder) || null;
  }

  /**
   * Create vendor profile from approved application
   */
  private async createVendorFromApplication(application: OnboardingApplication): Promise<string> {
    try {
      const vendorId = `vendor-${Date.now()}`;

      // TODO: Create actual vendor profile using VendorManagementService
      // For now, just return the generated ID

      this.logger.info('Vendor profile created from application', { 
        vendorId,
        applicationId: application.id 
      });

      return vendorId;

    } catch (error) {
      this.logger.error('Failed to create vendor from application', { error });
      throw error;
    }
  }

  /**
   * Update application in database
   */
  private async updateApplication(application: OnboardingApplication): Promise<void> {
    try {
      await this.dbService.updateItem(
        'vendor-onboarding',
        application.id,
        {
          ...application,
          updatedAt: new Date()
        },
        application.id
      );
    } catch (error) {
      this.logger.error('Failed to update application', { error });
      throw error;
    }
  }

  /**
   * Generate welcome email
   */
  private generateWelcomeEmail(application: OnboardingApplication): string {
    return `
Dear ${application.applicantInfo.firstName},

Thank you for applying to join our vendor network!

We've received your application for ${application.businessInfo.businessName}.

Next Steps:
${application.steps
  .filter(s => s.status === OnboardingStepStatus.PENDING)
  .map(s => `• ${s.title}: ${s.description}`)
  .join('\n')}

You can track your application progress at any time.

Application ID: ${application.id}

Best regards,
Vendor Management Team
    `.trim();
  }

  /**
   * Generate step complete email
   */
  private generateStepCompleteEmail(application: OnboardingApplication, step: OnboardingStep): string {
    const completionPercentage = Math.round((application.completedSteps.length / application.steps.length) * 100);
    
    return `
Great progress! You've completed: ${step.title}

Your application is ${completionPercentage}% complete.

Next Step: ${application.currentStep}

Keep going - you're almost there!
    `.trim();
  }

  /**
   * Generate approval email
   */
  private generateApprovalEmail(application: OnboardingApplication, vendorId: string): string {
    return `
Congratulations ${application.applicantInfo.firstName}!

Your vendor application has been approved!

Vendor ID: ${vendorId}
Business: ${application.businessInfo.businessName}

You can now start accepting orders through our platform.

Welcome to our vendor network!
    `.trim();
  }

  /**
   * Generate rejection email
   */
  private generateRejectionEmail(application: OnboardingApplication, reason?: string): string {
    return `
Dear ${application.applicantInfo.firstName},

Thank you for your interest in joining our vendor network.

Unfortunately, we are unable to approve your application at this time.

${reason ? `Reason: ${reason}` : ''}

If you have questions, please contact our vendor management team.

Best regards,
Vendor Management Team
    `.trim();
  }
}
