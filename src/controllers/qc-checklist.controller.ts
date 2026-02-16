/**
 * QC Checklist Controller
 * 
 * REST API endpoints for QC checklist management:
 * - Get all checklists
 * - Get checklist by ID
 * - Filter checklists
 * - Get questions by document category
 * - Checklist statistics
 */

import express, { Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { QCChecklistService } from '../services/qc-checklist.service.js';
import { Logger } from '../utils/logger.js';

const router = express.Router();
const logger = new Logger();
const checklistService = new QCChecklistService();

// Middleware to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: Function): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

/**
 * GET /api/qc-checklists
 * Get all active QC checklists
 */
router.get(
  '/',
  [query('clientId').optional().isString()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const clientId = (req.query.clientId as string) || 'default-client';
      const checklists = await checklistService.getAllChecklists(clientId);

      return res.json({
        success: true,
        data: checklists,
        count: checklists.length
      });
    } catch (error) {
      logger.error('Failed to get checklists', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve checklists',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * GET /api/qc-checklists/filter
 * Get checklists by filter criteria
 */
router.get(
  '/filter',
  [
    query('propertyType').optional().isString(),
    query('checklistType').optional().isString(),
    query('tags').optional().isString(),
    query('clientId').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const filters: any = {
        propertyType: req.query.propertyType as string | undefined,
        checklistType: req.query.checklistType as string | undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        clientId: req.query.clientId as string | undefined
      };

      const checklists = await checklistService.getChecklistsByFilter(filters);

      return res.json({
        success: true,
        data: checklists,
        count: checklists.length,
        filters
      });
    } catch (error) {
      logger.error('Failed to filter checklists', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to filter checklists',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * GET /api/qc-checklists/statistics
 * Get checklist statistics
 */
router.get(
  '/statistics',
  [query('clientId').optional().isString()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const clientId = (req.query.clientId as string) || 'default-client';
      const stats = await checklistService.getChecklistStatistics(clientId);

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get checklist statistics', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve checklist statistics',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * GET /api/qc-checklists/:id
 * Get a specific checklist by ID
 */
router.get(
  '/:id',
  [
    param('id').isString().notEmpty(),
    query('clientId').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      
      const checklist = await checklistService.getChecklistById(
        id,
        (req.query.clientId as string) || 'default-client'
      );

      if (!checklist) {
        return res.status(404).json({
          success: false,
          error: 'Checklist not found',
          checklistId: id
        });
      }

      return res.json({
        success: true,
        data: checklist
      });
    } catch (error) {
      logger.error('Failed to get checklist', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve checklist',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * GET /api/qc-checklists/:id/questions
 * Get all questions from a checklist
 */
router.get(
  '/:id/questions',
  [
    param('id').isString().notEmpty(),
    query('clientId').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      
      const questions = await checklistService.getChecklistQuestions(
        id,
        (req.query.clientId as string) || 'default-client'
      );

      return res.json({
        success: true,
        data: questions,
        count: questions.length
      });
    } catch (error) {
      logger.error('Failed to get checklist questions', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve checklist questions',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

/**
 * GET /api/qc-checklists/:id/questions-by-document/:category
 * Get questions that require a specific document category
 */
router.get(
  '/:id/questions-by-document/:category',
  [
    param('id').isString().notEmpty(),
    param('category').isString().notEmpty(),
    query('clientId').optional().isString()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { id, category } = req.params as { id: string; category: string };
      
      const questions = await checklistService.getQuestionsByDocumentCategory(
        id,
        category,
        (req.query.clientId as string) || 'default-client'
      );

      return res.json({
        success: true,
        data: questions,
        count: questions.length,
        documentCategory: category
      });
    } catch (error) {
      logger.error('Failed to get questions by document category', { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve questions',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;
