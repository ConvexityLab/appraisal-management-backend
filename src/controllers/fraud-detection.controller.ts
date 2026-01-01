/**
 * Fraud Detection Controller - AI-powered appraisal fraud analysis API
 * 
 * Provides REST endpoints for analyzing appraisals for fraud indicators.
 */

import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { FraudDetectionService } from '../services/fraud-detection.service';
import { Logger } from '../utils/logger';

const router = express.Router();
const logger = new Logger();
const fraudService = new FraudDetectionService();

/**
 * POST /api/fraud-detection/analyze
 * Analyze appraisal for fraud indicators
 */
router.post(
  '/analyze',
  [
    body('appraisalId').notEmpty().withMessage('Appraisal ID is required'),
    body('propertyAddress').notEmpty().withMessage('Property address is required'),
    body('appraisedValue').isNumeric().withMessage('Appraised value must be a number'),
    body('appraisalDate').notEmpty(),
    body('subjectProperty').isObject().withMessage('Subject property details required'),
    body('subjectProperty.squareFootage').isNumeric(),
    body('subjectProperty.yearBuilt').isInt(),
    body('subjectProperty.condition').notEmpty(),
    body('subjectProperty.propertyType').notEmpty(),
    body('comparables').isArray({ min: 1 }).withMessage('At least 1 comparable required'),
    body('comparables.*.address').notEmpty(),
    body('comparables.*.soldPrice').isNumeric(),
    body('comparables.*.distance').isNumeric(),
    body('comparables.*.adjustments.total').isNumeric(),
    body('appraiser').isObject().withMessage('Appraiser information required'),
    body('appraiser.name').notEmpty(),
    body('appraiser.licenseNumber').notEmpty(),
    body('appraiser.licenseState').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      logger.info(`Fraud detection analysis for appraisal ${req.body.appraisalId}`);

      const result = await fraudService.analyzeAppraisal(req.body);

      return res.json({
        success: true,
        analysis: result,
      });
    } catch (error) {
      logger.error(`Fraud detection error: ${error}`);
      return res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/fraud-detection/quick-check
 * Quick fraud risk assessment (rules-based only, no AI)
 */
router.post(
  '/quick-check',
  [
    body('appraisedValue').isNumeric(),
    body('comparables').isArray({ min: 1 }),
    body('comparables.*.soldPrice').isNumeric(),
    body('comparables.*.distance').isNumeric(),
    body('comparables.*.adjustments.total').isNumeric(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { appraisedValue, comparables } = req.body;

      // Quick rule-based checks
      const avgCompPrice = comparables.reduce((sum: number, c: any) => sum + c.soldPrice, 0) / comparables.length;
      const deviation = ((appraisedValue - avgCompPrice) / avgCompPrice) * 100;
      
      const avgDistance = comparables.reduce((sum: number, c: any) => sum + c.distance, 0) / comparables.length;
      
      const excessiveAdjustments = comparables.filter((c: any) => {
        const adjustmentPercent = Math.abs((c.adjustments.total / c.soldPrice) * 100);
        return adjustmentPercent > 25;
      }).length;

      let riskScore = 0;
      const flags = [];

      if (deviation > 20) {
        riskScore += deviation > 30 ? 30 : 20;
        flags.push('Value significantly exceeds comparables');
      }

      if (avgDistance > 5) {
        riskScore += 15;
        flags.push('Comparables are distant');
      }

      if (excessiveAdjustments > 0) {
        riskScore += excessiveAdjustments * 10;
        flags.push(`${excessiveAdjustments} comparables with excessive adjustments`);
      }

      const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';

      return res.json({
        success: true,
        quickCheck: {
          riskScore: Math.min(100, riskScore),
          riskLevel,
          flags,
          valueDeviation: deviation.toFixed(1) + '%',
          avgDistance: avgDistance.toFixed(1) + ' miles',
          excessiveAdjustments,
          recommendation: riskScore >= 60 ? 'Full fraud analysis recommended' : 'Standard review',
        },
      });
    } catch (error) {
      logger.error(`Quick check error: ${error}`);
      return res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/fraud-detection/risk-thresholds
 * Get fraud risk scoring thresholds and criteria
 */
router.get('/risk-thresholds', (req: Request, res: Response) => {
  return res.json({
    riskLevels: {
      minimal: { score: '0-19', action: 'Auto-approve', color: 'green' },
      low: { score: '20-39', action: 'Standard review', color: 'yellow' },
      medium: { score: '40-59', action: 'Enhanced review', color: 'orange' },
      high: { score: '60-79', action: 'Manual review required', color: 'red' },
      critical: { score: '80-100', action: 'Reject or escalate', color: 'darkred' },
    },
    flagCategories: [
      {
        category: 'value-inflation',
        description: 'Appraised value significantly exceeds market data',
        examples: ['20%+ above comps', 'LTV at limit', 'All upward adjustments'],
      },
      {
        category: 'comp-manipulation',
        description: 'Suspicious comparable selection or data',
        examples: ['Distant comps', 'Cherry-picking', 'Stale data'],
      },
      {
        category: 'adjustment-abuse',
        description: 'Excessive or unjustified adjustments',
        examples: ['25%+ adjustments', 'No documentation', 'Inconsistent methodology'],
      },
      {
        category: 'data-inconsistency',
        description: 'Conflicting or illogical data',
        examples: ['Condition mismatch', 'Photo discrepancies', 'Missing information'],
      },
      {
        category: 'collusion',
        description: 'Potential appraiser-agent collusion',
        examples: ['Pattern of over-valuations', 'Repeated agent pairing', 'Pressure tactics'],
      },
    ],
    scoringFactors: {
      ruleBasedFlags: { weight: 40, description: 'Automated rule violations' },
      aiAnalysis: { weight: 30, description: 'AI-powered pattern detection' },
      valuationAssessment: { weight: 20, description: 'Statistical value analysis' },
      comparablesQuality: { weight: 10, description: 'Comp selection quality' },
    },
  });
});

/**
 * POST /api/fraud-detection/batch
 * Batch fraud analysis for multiple appraisals
 */
router.post(
  '/batch',
  [
    body('appraisals').isArray({ min: 1, max: 50 }).withMessage('1-50 appraisals allowed per batch'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { appraisals } = req.body;
      logger.info(`Batch fraud analysis for ${appraisals.length} appraisals`);

      // Process in parallel with concurrency limit
      const batchSize = 3; // 3 concurrent AI calls
      const results = [];

      for (let i = 0; i < appraisals.length; i += batchSize) {
        const batch = appraisals.slice(i, i + batchSize);
        const batchPromises = batch.map((appraisal: any) =>
          fraudService.analyzeAppraisal(appraisal).catch(error => ({
            error: error.message,
            appraisalId: appraisal.appraisalId,
          }))
        );
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const summary = {
        total: appraisals.length,
        critical: results.filter((r: any) => r.riskLevel === 'critical').length,
        high: results.filter((r: any) => r.riskLevel === 'high').length,
        medium: results.filter((r: any) => r.riskLevel === 'medium').length,
        low: results.filter((r: any) => r.riskLevel === 'low').length,
        minimal: results.filter((r: any) => r.riskLevel === 'minimal').length,
        errors: results.filter((r: any) => r.error).length,
      };

      return res.json({
        success: true,
        summary,
        results,
      });
    } catch (error) {
      logger.error(`Batch fraud detection error: ${error}`);
      return res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
