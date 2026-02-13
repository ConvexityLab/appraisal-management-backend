/**
 * Vendor Certification Management Controller
 * REST API endpoints for certification lifecycle management
 */

import express, { Request, Response, Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import { VendorCertificationService } from '../services/vendor-certification.service.js';
import { 
  CertificationStatus,
  CertificationType,
  VendorCertification 
} from '../types/certification.types.js';

const logger = new Logger();
const certificationService = new VendorCertificationService();

export const createVendorCertificationRouter = (): Router => {
  const router = express.Router();

  /**
   * POST /api/vendor-certifications/:vendorId
   * Create new certification for vendor
   */
  router.post(
    '/:vendorId',
    [
      param('vendorId').notEmpty().withMessage('Vendor ID is required'),
      body('type').notEmpty().withMessage('Certification type is required'),
      body('licenseNumber').notEmpty().withMessage('License number is required'),
      body('issuingAuthority').notEmpty().withMessage('Issuing authority is required'),
      body('issueDate').isISO8601().withMessage('Valid issue date is required'),
      body('expiryDate').isISO8601().withMessage('Valid expiry date is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ 
            success: false, 
            errors: errors.array() 
          });
          return;
        }

        const { vendorId } = req.params;
        const certificationData = {
          vendorId: vendorId!,
          type: req.body.type,
          licenseNumber: req.body.licenseNumber,
          issuingAuthority: req.body.issuingAuthority,
          issueDate: new Date(req.body.issueDate),
          expiryDate: new Date(req.body.expiryDate),
          status: CertificationStatus.PENDING_VERIFICATION,
          vendorEmail: req.body.vendorEmail,
          vendorPhone: req.body.vendorPhone,
          coverageStates: req.body.coverageStates || [],
          restrictions: req.body.restrictions || [],
          specialConditions: req.body.specialConditions
        };

        const certification = await certificationService.createCertification(
          vendorId!,
          certificationData
        );

        res.status(201).json({
          success: true,
          data: certification,
          message: 'Certification created successfully'
        });

      } catch (error) {
        logger.error('Failed to create certification', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to create certification',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/vendor-certifications/:vendorId
   * Get all certifications for a vendor
   */
  router.get(
    '/:vendorId',
    [
      param('vendorId').notEmpty().withMessage('Vendor ID is required'),
      query('includeExpired').optional().isBoolean()
    ],
    async (req: Request, res: Response) => {
      try {
        const { vendorId } = req.params;
        const includeExpired = req.query.includeExpired === 'true';

        const certifications = await certificationService.getVendorCertifications(
          vendorId!,
          includeExpired
        );

        // Calculate summary statistics
        const summary = {
          total: certifications.length,
          active: certifications.filter(c => c.status === CertificationStatus.VERIFIED).length,
          expired: certifications.filter(c => c.status === CertificationStatus.EXPIRED).length,
          expiringSoon: certifications.filter(c => c.status === CertificationStatus.EXPIRING_SOON).length,
          pendingVerification: certifications.filter(c => c.status === CertificationStatus.PENDING_VERIFICATION).length
        };

        res.json({
          success: true,
          data: certifications,
          summary,
          count: certifications.length
        });

      } catch (error) {
        logger.error('Failed to get vendor certifications', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve certifications'
        });
      }
    }
  );

  /**
   * GET /api/vendor-certifications/:vendorId/:certificationId
   * Get specific certification details
   */
  router.get(
    '/:vendorId/:certificationId',
    [
      param('vendorId').notEmpty(),
      param('certificationId').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const { vendorId, certificationId } = req.params;

        const certification = await certificationService.getCertificationById(
          certificationId!,
          vendorId!
        );

        if (!certification) {
          res.status(404).json({
            success: false,
            error: 'Certification not found'
          });
          return;
        }

        res.json({
          success: true,
          data: certification
        });

      } catch (error) {
        logger.error('Failed to get certification', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve certification'
        });
      }
    }
  );

  /**
   * POST /api/vendor-certifications/:vendorId/:certificationId/upload
   * Upload certification document
   */
  router.post(
    '/:vendorId/:certificationId/upload',
    [
      param('vendorId').notEmpty(),
      param('certificationId').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const { vendorId, certificationId } = req.params;

        // In production, use middleware like multer for file uploads
        // For now, expect base64 encoded file in request body
        if (!req.body.fileName || !req.body.fileData) {
          res.status(400).json({
            success: false,
            error: 'File name and file data are required'
          });
          return;
        }

        const fileBuffer = Buffer.from(req.body.fileData, 'base64');

        const uploadRequest = {
          fileName: req.body.fileName,
          fileSize: fileBuffer.length,
          fileBuffer,
          contentType: req.body.contentType || 'application/pdf',
          uploadedBy: req.body.uploadedBy || 'system'
        };

        const result = await certificationService.uploadCertificationDocument(
          certificationId!,
          vendorId!,
          uploadRequest
        );

        res.json({
          success: true,
          data: result,
          message: 'Document uploaded successfully'
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        logger.error('Failed to upload certification document', { 
          error,
          errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        });
        
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: errorMessage
          });
        }
      }
    }
  );

  /**
   * POST /api/vendor-certifications/:vendorId/:certificationId/verify
   * Verify a certification
   */
  router.post(
    '/:vendorId/:certificationId/verify',
    [
      param('vendorId').notEmpty(),
      param('certificationId').notEmpty(),
      body('verifiedBy').notEmpty().withMessage('Verifier ID is required')
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ 
            success: false, 
            errors: errors.array() 
          });
          return;
        }

        const { vendorId, certificationId } = req.params;
        const { verifiedBy, notes } = req.body;

        const result = await certificationService.verifyCertification(
          certificationId!,
          vendorId!,
          verifiedBy,
          notes
        );

        if (result.success) {
          res.json({
            success: true,
            data: result,
            message: 'Certification verified successfully'
          });
        } else {
          res.status(400).json({
            success: false,
            error: result.error || 'Verification failed'
          });
        }

      } catch (error) {
        logger.error('Failed to verify certification', { error });
        res.status(500).json({
          success: false,
          error: 'Verification failed'
        });
      }
    }
  );

  /**
   * POST /api/vendor-certifications/:vendorId/:certificationId/verify-state
   * Verify license with state licensing board
   */
  router.post(
    '/:vendorId/:certificationId/verify-state',
    [
      param('vendorId').notEmpty(),
      param('certificationId').notEmpty(),
      body('licenseNumber').notEmpty(),
      body('state').notEmpty(),
      body('certificationType').notEmpty()
    ],
    async (req: Request, res: Response) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({ 
            success: false, 
            errors: errors.array() 
          });
          return;
        }

        const { vendorId, certificationId } = req.params;
        const { licenseNumber, state, certificationType } = req.body;

        const result = await certificationService.verifyLicenseWithStateBoard({
          certificationId: certificationId!,
          vendorId: vendorId!,
          licenseNumber,
          state,
          certificationType
        });

        res.json({
          success: result.success,
          data: result,
          message: result.success 
            ? 'License verified with state board' 
            : 'License verification failed'
        });

      } catch (error) {
        logger.error('Failed to verify with state board', { error });
        res.status(500).json({
          success: false,
          error: 'State verification failed'
        });
      }
    }
  );

  /**
   * GET /api/vendor-certifications/alerts/expiring
   * Check for expiring certifications and get alerts
   */
  router.get(
    '/alerts/expiring',
    async (req: Request, res: Response) => {
      try {
        const alerts = await certificationService.checkExpiringCertifications();

        res.json({
          success: true,
          data: alerts,
          count: alerts.length,
          summary: {
            critical: alerts.filter(a => a.alertLevel === 'CRITICAL').length,
            warning: alerts.filter(a => a.alertLevel === 'WARNING').length,
            reminder: alerts.filter(a => a.alertLevel === 'REMINDER').length
          }
        });

      } catch (error) {
        logger.error('Failed to check expiring certifications', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to check expiring certifications'
        });
      }
    }
  );

  /**
   * POST /api/vendor-certifications/maintenance/update-expired
   * Background job: Update expired certifications
   */
  router.post(
    '/maintenance/update-expired',
    async (req: Request, res: Response) => {
      try {
        const updatedCount = await certificationService.updateExpiredCertifications();

        res.json({
          success: true,
          data: { updatedCount },
          message: `${updatedCount} certifications marked as expired`
        });

      } catch (error) {
        logger.error('Failed to update expired certifications', { error });
        res.status(500).json({
          success: false,
          error: 'Failed to update expired certifications'
        });
      }
    }
  );

  return router;
};
