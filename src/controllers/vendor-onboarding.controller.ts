/**
 * Vendor Onboarding Controller
 * REST API endpoints for multi-step vendor onboarding workflow
 */

import express, { Request, Response, Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import { VendorOnboardingService } from '../services/vendor-onboarding.service.js';
import { OnboardingStatus, OnboardingStepType } from '../types/onboarding.types.js';

const logger = new Logger();
const onboardingService = new VendorOnboardingService();

export const createVendorOnboardingRouter = (): Router => {
  const router = express.Router();

  /**
   * POST /api/vendor-onboarding/applications
   * Submit new vendor onboarding application
   */
  router.post(
    '/applications',
    [
      body('applicantInfo.firstName').notEmpty(),
      body('applicantInfo.lastName').notEmpty(),
      body('applicantInfo.email').isEmail(),
      body('applicantInfo.phone').notEmpty(),
      body('businessInfo.companyName').notEmpty(),
      body('businessInfo.businessType').optional().isIn(['INDIVIDUAL', 'LLC', 'CORPORATION', 'PARTNERSHIP']),
      body('businessInfo.taxId').optional(),
      body('businessInfo.yearsInBusiness').optional().isInt({ min: 0 }),
      body('serviceInfo.serviceTypes').optional().isArray(),
      body('serviceInfo.coverageAreas').optional().isArray(),
      body('serviceInfo.specializations').optional().isArray(),
      body('serviceInfo.certifications').optional().isArray()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ success: false, errors: errors.array() });
          return;
        }

        const application = await onboardingService.createApplication(req.body);

        res.status(201).json({
          success: true,
          data: application,
          message: 'Onboarding application created successfully'
        });

      } catch (error) {
        logger.error('Failed to create onboarding application', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to create application'
        });
      }
    }
  );

  /**
   * GET /api/vendor-onboarding/applications/:applicationId
   * Get onboarding application details
   */
  router.get(
    '/applications/:applicationId',
    [param('applicationId').notEmpty()],
    async (req: Request, res: Response) => {
      try {
        const { applicationId } = req.params;
        const application = await onboardingService.getApplication(applicationId!);

        if (!application) {
          res.status(404).json({
            success: false,
            error: 'Application not found'
          });
          return;
        }

        // Calculate completion percentage
        const completionPercentage = Math.round(
          (application.completedSteps.length / application.steps.length) * 100
        );

        res.json({
          success: true,
          data: {
            ...application,
            completionPercentage,
            pendingSteps: application.steps.filter(s => s.status === 'PENDING').length,
            completedSteps: application.completedSteps.length,
            totalSteps: application.steps.length
          }
        });

      } catch (error) {
        logger.error('Failed to get application', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve application'
        });
      }
    }
  );

  /**
   * GET /api/vendor-onboarding/applications
   * List all applications (with optional status filter)
   */
  router.get(
    '/applications',
    [query('status').optional().isIn(Object.values(OnboardingStatus))],
    async (req: Request, res: Response) => {
      try {
        const status = req.query.status as OnboardingStatus | undefined;
        const applications = await onboardingService.getApplications(status);

        // Calculate summary statistics
        const summary = {
          total: applications.length,
          byStatus: applications.reduce((acc, app) => {
            acc[app.status] = (acc[app.status] || 0) + 1;
            return acc;
          }, {} as Record<OnboardingStatus, number>)
        };

        res.json({
          success: true,
          data: applications,
          summary,
          count: applications.length
        });

      } catch (error) {
        logger.error('Failed to get applications', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve applications'
        });
      }
    }
  );

  /**
   * POST /api/vendor-onboarding/applications/:applicationId/documents
   * Upload document for onboarding step
   */
  router.post(
    '/applications/:applicationId/documents',
    [
      param('applicationId').notEmpty(),
      body('stepType').isIn(Object.values(OnboardingStepType)),
      body('requirementId').notEmpty(),
      body('fileName').notEmpty(),
      body('fileData').notEmpty(), // Base64 encoded
      body('contentType').notEmpty(),
      body('uploadedBy').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ success: false, errors: errors.array() });
          return;
        }

        const { applicationId } = req.params;
        const fileBuffer = Buffer.from(req.body.fileData, 'base64');

        const uploadedDoc = await onboardingService.uploadDocument({
          applicationId: applicationId!,
          stepType: req.body.stepType,
          requirementId: req.body.requirementId,
          fileName: req.body.fileName,
          fileData: fileBuffer,
          contentType: req.body.contentType,
          uploadedBy: req.body.uploadedBy
        });

        res.status(201).json({
          success: true,
          data: uploadedDoc,
          message: 'Document uploaded successfully'
        });

      } catch (error) {
        logger.error('Failed to upload document', { error });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Document upload failed'
        });
      }
    }
  );

  /**
   * POST /api/vendor-onboarding/applications/:applicationId/steps/:stepType/complete
   * Mark onboarding step as complete
   */
  router.post(
    '/applications/:applicationId/steps/:stepType/complete',
    [
      param('applicationId').notEmpty(),
      param('stepType').isIn(Object.values(OnboardingStepType)),
      body('completedBy').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ success: false, errors: errors.array() });
          return;
        }

        const { applicationId, stepType } = req.params;

        const application = await onboardingService.completeStep({
          applicationId: applicationId!,
          stepType: stepType as OnboardingStepType,
          completedBy: req.body.completedBy,
          dataCollected: req.body.dataCollected,
          notes: req.body.notes
        });

        res.json({
          success: true,
          data: application,
          message: 'Step completed successfully'
        });

      } catch (error) {
        logger.error('Failed to complete step', { error });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to complete step'
        });
      }
    }
  );

  /**
   * POST /api/vendor-onboarding/applications/:applicationId/review
   * Review and approve/reject onboarding application
   */
  router.post(
    '/applications/:applicationId/review',
    [
      param('applicationId').notEmpty(),
      body('approved').isBoolean(),
      body('reviewedBy').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ success: false, errors: errors.array() });
          return;
        }

        const { applicationId } = req.params;

        const result = await onboardingService.reviewApplication({
          applicationId: applicationId!,
          approved: req.body.approved,
          reviewedBy: req.body.reviewedBy,
          reviewNotes: req.body.reviewNotes,
          rejectionReason: req.body.rejectionReason
        });

        if (result.success) {
          res.json({
            success: true,
            data: result,
            message: result.message
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error || 'Review failed',
            details: result
          });
        }

      } catch (error) {
        logger.error('Failed to review application', { error });
        res.status(500).json({
          success: false,
          error: 'Review failed'
        });
      }
    }
  );

  /**
   * POST /api/vendor-onboarding/applications/:applicationId/background-check
   * Request background check for applicant
   */
  router.post(
    '/applications/:applicationId/background-check',
    [
      param('applicationId').notEmpty(),
      body('applicantInfo.firstName').notEmpty(),
      body('applicantInfo.lastName').notEmpty(),
      body('applicantInfo.ssn').notEmpty(),
      body('applicantInfo.dateOfBirth').isISO8601(),
      body('requestedBy').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ success: false, errors: errors.array() });
          return;
        }

        const { applicationId } = req.params;

        const result = await onboardingService.requestBackgroundCheck({
          applicationId: applicationId!,
          applicantInfo: {
            ...req.body.applicantInfo,
            dateOfBirth: new Date(req.body.applicantInfo.dateOfBirth)
          },
          requestedBy: req.body.requestedBy
        });

        if (result.success) {
          res.json({
            success: true,
            data: result,
            message: 'Background check completed successfully'
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error || 'Background check failed',
            details: result
          });
        }

      } catch (error) {
        logger.error('Background check failed', { error });
        res.status(500).json({
          success: false,
          error: 'Background check failed'
        });
      }
    }
  );

  return router;
};
