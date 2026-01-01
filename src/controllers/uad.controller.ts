/**
 * UAD 3.6 API Controller
 * 
 * RESTful endpoints for UAD appraisal validation and MISMO XML generation
 */

import express, { Request, Response } from 'express';
import { UadValidationService } from '../services/uad-validation.service.js';
import { MismoXmlGenerator, SubmissionInfo } from '../services/mismo-xml-generator.service.js';
import { UadAppraisalReport } from '../types/uad-3.6.js';
import { Logger } from '../utils/logger.js';

export const createUadRouter = () => {
  const router = express.Router();
  const validator = new UadValidationService();
  const xmlGenerator = new MismoXmlGenerator();
  const logger = new Logger();

  /**
   * POST /api/uad/validate
   * Validate appraisal report against UAD 3.6 specification
   */
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      logger.info('UAD validation request received');

      const appraisalReport: UadAppraisalReport = req.body;

      // Validate the report
      const validationResult = await validator.validateAppraisalReport(appraisalReport);

      // Return detailed validation results
      res.json({
        success: true,
        validation: {
          isValid: validationResult.isValid,
          summary: validator.getValidationSummary(validationResult),
          uadVersion: validationResult.uadVersion,
          validatedAt: validationResult.validatedAt,
          errorCount: validationResult.errors.length,
          warningCount: validationResult.warnings.length,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        }
      });

    } catch (error) {
      logger.error('UAD validation failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  /**
   * POST /api/uad/quick-validate
   * Quick boolean validation check
   */
  router.post('/quick-validate', async (req: Request, res: Response) => {
    try {
      const appraisalReport: UadAppraisalReport = req.body;
      const isValid = await validator.quickValidate(appraisalReport);

      res.json({
        success: true,
        isValid,
        message: isValid ? 'Appraisal passes UAD 3.6 validation' : 'Appraisal has validation errors'
      });

    } catch (error) {
      logger.error('Quick validation failed', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  /**
   * POST /api/uad/generate-xml
   * Generate MISMO 3.4 XML for UCDP/EAD submission
   */
  router.post('/generate-xml', async (req: Request, res: Response) => {
    try {
      logger.info('MISMO XML generation request received');

      const { appraisalReport, submissionInfo } = req.body;

      if (!appraisalReport) {
        return res.status(400).json({
          success: false,
          error: 'appraisalReport is required'
        });
      }

      // Validate first
      const validationResult = await validator.validateAppraisalReport(appraisalReport);
      
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed - cannot generate XML for invalid appraisal',
          validation: {
            isValid: false,
            summary: validator.getValidationSummary(validationResult),
            errors: validationResult.errors,
            warnings: validationResult.warnings
          }
        });
      }

      // Generate XML
      const xml = submissionInfo 
        ? xmlGenerator.generateMismoXml(appraisalReport, submissionInfo as SubmissionInfo)
        : xmlGenerator.generatePreviewXml(appraisalReport);

      return res.json({
        success: true,
        xml,
        validation: {
          isValid: true,
          summary: validator.getValidationSummary(validationResult),
          warnings: validationResult.warnings
        }
      });

    } catch (error) {
      logger.error('XML generation failed', { error });
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  /**
   * POST /api/uad/preview-xml
   * Generate preview XML without submission info (for testing)
   */
  router.post('/preview-xml', async (req: Request, res: Response) => {
    try {
      const appraisalReport: UadAppraisalReport = req.body;

      // Validate first
      const validationResult = await validator.validateAppraisalReport(appraisalReport);

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          validation: {
            isValid: false,
            errors: validationResult.errors,
            warnings: validationResult.warnings
          }
        });
      }

      // Generate preview XML
      const xml = xmlGenerator.generatePreviewXml(appraisalReport);

      res.set('Content-Type', 'application/xml');
      return res.send(xml);

    } catch (error) {
      logger.error('Preview XML generation failed', { error });
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  /**
   * POST /api/uad/validate-and-generate
   * Combined validation and XML generation endpoint
   */
  router.post('/validate-and-generate', async (req: Request, res: Response) => {
    try {
      logger.info('Combined validation and XML generation request');

      const { appraisalReport, submissionInfo } = req.body;

      if (!appraisalReport) {
        return res.status(400).json({
          success: false,
          error: 'appraisalReport is required'
        });
      }

      // Step 1: Validate
      const validationResult = await validator.validateAppraisalReport(appraisalReport);

      // Step 2: Generate XML if valid
      let xml: string | null = null;
      if (validationResult.isValid) {
        xml = submissionInfo
          ? xmlGenerator.generateMismoXml(appraisalReport, submissionInfo as SubmissionInfo)
          : xmlGenerator.generatePreviewXml(appraisalReport);
      }

      return res.json({
        success: validationResult.isValid,
        validation: {
          isValid: validationResult.isValid,
          summary: validator.getValidationSummary(validationResult),
          uadVersion: validationResult.uadVersion,
          validatedAt: validationResult.validatedAt,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        },
        xml: xml,
        readyForSubmission: validationResult.isValid && xml !== null
      });

    } catch (error) {
      logger.error('Combined operation failed', { error });
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  /**
   * GET /api/uad/spec
   * Get UAD 3.6 specification information
   */
  router.get('/spec', (req: Request, res: Response) => {
    res.json({
      success: true,
      specification: {
        version: '3.6',
        mismoVersion: '3.4',
        supportedForms: ['1004', '1073', '1025', '2055', '1004C', '216'],
        qualityRatings: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'],
        conditionRatings: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
        requiredApproaches: {
          salesComparison: {
            minimumComparables: 3,
            requiredFields: [
              'salePrice',
              'saleDate',
              'dataSource',
              'grossLivingArea',
              'qualityRating',
              'conditionRating',
              'adjustments'
            ]
          }
        },
        gseEndpoints: {
          ucdp: {
            name: 'Fannie Mae UCDP',
            description: 'Uniform Collateral Data Portal',
            documentation: 'https://www.fanniemae.com/singlefamily/uniform-appraisal-dataset'
          },
          ead: {
            name: 'Freddie Mac EAD',
            description: 'Electronic Appraisal Delivery',
            documentation: 'https://sf.freddiemac.com/tools-learning/appraisal-topics'
          }
        }
      }
    });
  });

  /**
   * GET /api/uad/health
   * Health check endpoint
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      service: 'UAD Validation and MISMO XML Generation',
      version: '1.0.0',
      uadVersion: '3.6',
      mismoVersion: '3.4',
      status: 'operational'
    });
  });

  return router;
};

export default createUadRouter;
