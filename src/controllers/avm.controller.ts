/**
 * AVM Controller - Automated Valuation Model API
 * 
 * Provides REST endpoints for property valuation using cascade strategy.
 */

import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AVMCascadeService } from '../services/avm-cascade.service.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();
const logger = new Logger();
const avmService = new AVMCascadeService();

/**
 * POST /api/avm/valuation
 * Get property valuation using AVM cascade
 */
router.post(
  '/valuation',
  [
    body('address').notEmpty().withMessage('Address is required'),
    body('latitude').optional().isNumeric(),
    body('longitude').optional().isNumeric(),
    body('squareFootage').optional().isNumeric(),
    body('yearBuilt').optional().isInt({ min: 1800, max: 2100 }),
    body('bedrooms').optional().isInt({ min: 0 }),
    body('bathrooms').optional().isNumeric(),
    body('propertyType').optional().isString(),
    body('strategy')
      .optional()
      .isIn(['speed', 'quality', 'cost'])
      .withMessage('Strategy must be speed, quality, or cost'),
    body('forceMethod')
      .optional()
      .isIn(['bridge', 'hedonic', 'cost'])
      .withMessage('Force method must be bridge, hedonic, or cost'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      logger.info(`AVM valuation request for ${req.body.address}`);

      const result = await avmService.getValuation(req.body);

      if (!result.success) {
        return res.status(422).json({
          error: 'Valuation failed',
          message: result.error,
          attempts: result.attempts,
          processingTime: result.processingTime,
        });
      }

      return res.json({
        success: true,
        valuation: result.result,
        attempts: result.attempts,
        processingTime: result.processingTime,
      });
    } catch (error) {
      logger.error(`AVM valuation error: ${error}`);
      return res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/avm/batch
 * Get valuations for multiple properties
 */
router.post(
  '/batch',
  [
    body('properties').isArray({ min: 1, max: 100 }).withMessage('Properties must be an array of 1-100 items'),
    body('properties.*.address').notEmpty(),
    body('strategy').optional().isIn(['speed', 'quality', 'cost']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { properties, strategy } = req.body;
      logger.info(`Batch AVM request for ${properties.length} properties`);

      // Process properties in parallel (with concurrency limit)
      const batchSize = 5;
      const results = [];

      for (let i = 0; i < properties.length; i += batchSize) {
        const batch = properties.slice(i, i + batchSize);
        const batchPromises = batch.map((property: any) =>
          avmService.getValuation({ ...property, strategy })
        );
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.length - successful;

      return res.json({
        success: true,
        total: properties.length,
        successful,
        failed,
        results: results.map((r, idx) => ({
          address: properties[idx].address,
          success: r.success,
          valuation: r.result,
          error: r.error,
          processingTime: r.processingTime,
        })),
      });
    } catch (error) {
      logger.error(`Batch AVM error: ${error}`);
      return res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/avm/methods
 * Get available valuation methods and their characteristics
 */
router.get('/methods', (req: Request, res: Response) => {
  return res.json({
    methods: [
      {
        name: 'bridge',
        displayName: 'Bridge Interactive Zestimate',
        description: 'Fast external AVM using Bridge API with ML models',
        avgConfidence: 75,
        avgProcessingTime: '2-3 seconds',
        requiresData: ['address'],
        pros: ['Fast', 'Widely accepted', 'Includes market trends'],
        cons: ['Requires API access', 'Less accurate in rural areas'],
      },
      {
        name: 'hedonic',
        displayName: 'Hedonic Regression Model',
        description: 'Internal regression model using MLS comparables',
        avgConfidence: 85,
        avgProcessingTime: '3-5 seconds',
        requiresData: ['address', 'latitude', 'longitude', 'squareFootage'],
        pros: ['High accuracy', 'Transparent methodology', 'Local market data'],
        cons: ['Requires recent comps', 'Slower than Bridge'],
      },
      {
        name: 'cost',
        displayName: 'Cost Approach',
        description: 'Replacement cost minus depreciation plus land value',
        avgConfidence: 60,
        avgProcessingTime: '< 1 second',
        requiresData: ['squareFootage', 'yearBuilt'],
        pros: ['Works without comps', 'Fast', 'Good for new construction'],
        cons: ['Lower accuracy', 'Doesn\'t reflect market conditions'],
      },
    ],
    strategies: [
      {
        name: 'speed',
        order: ['bridge', 'hedonic', 'cost'],
        description: 'Prioritizes fastest methods first',
      },
      {
        name: 'quality',
        order: ['hedonic', 'bridge', 'cost'],
        description: 'Prioritizes most accurate methods first',
      },
      {
        name: 'cost',
        order: ['cost', 'hedonic', 'bridge'],
        description: 'Uses simple cost approach first',
      },
    ],
  });
});

export default router;
