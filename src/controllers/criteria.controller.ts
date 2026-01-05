/**
 * QC Checklist Controller
 * REST API endpoints for QC checklist management, templates, and assignments
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger.js';
import { QCChecklistManagementService } from '../services/qc-checklist-management.service.js';
import { createApiError, createApiResponse } from '../utils/api-response.util.js';
import {
  QCChecklist,
  QCChecklistAssignment,
  CreateQCChecklistRequest,
  QCTemplateConfig
} from '../types/qc-checklist.types.js';
import { ApiResponse } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    organizationId?: string;
    clientId?: string;
  };
}

export class QCChecklistController {
  private logger: Logger;
  private qcService: QCChecklistManagementService;
  private router: Router;

  constructor() {
    this.logger = new Logger('QCChecklistController');
    this.qcService = new QCChecklistManagementService();
    this.router = Router();
    this.initializeRoutes();
  }

  /**
   * Initialize all routes for QC checklist management
   */
  private initializeRoutes(): void {
    // Checklist CRUD operations
    this.router.post('/checklists', 
      this.validateCreateChecklist(), 
      this.handleValidation,
      this.createChecklist.bind(this)
    );

    this.router.get('/checklists/:id',
      this.validateGetChecklist(),
      this.handleValidation,
      this.getChecklist.bind(this)
    );

    this.router.put('/checklists/:id',
      this.validateUpdateChecklist(),
      this.handleValidation,
      this.updateChecklist.bind(this)
    );

    this.router.delete('/checklists/:id',
      this.validateDeleteChecklist(),
      this.handleValidation,
      this.deleteChecklist.bind(this)
    );

    // Search and listing
    this.router.get('/checklists',
      this.validateSearchChecklists(),
      this.handleValidation,
      this.searchChecklists.bind(this)
    );

    // Template operations
    this.router.post('/checklists/from-template',
      this.validateCreateFromTemplate(),
      this.handleValidation,
      this.createFromTemplate.bind(this)
    );

    this.router.post('/checklists/:id/clone',
      this.validateCloneChecklist(),
      this.handleValidation,
      this.cloneChecklist.bind(this)
    );

    // Assignment operations
    this.router.post('/assignments',
      this.validateCreateAssignment(),
      this.handleValidation,
      this.createAssignment.bind(this)
    );

    this.router.get('/assignments',
      this.validateGetAssignments(),
      this.handleValidation,
      this.getAssignments.bind(this)
    );

    this.router.get('/assignments/active/:targetId',
      this.validateGetActiveAssignments(),
      this.handleValidation,
      this.getActiveAssignments.bind(this)
    );

    this.router.delete('/assignments/:id',
      this.validateRemoveAssignment(),
      this.handleValidation,
      this.removeAssignment.bind(this)
    );

    // Template and checklist utilities
    this.router.post('/checklists/:id/validate',
      this.validateChecklistValidation(),
      this.handleValidation,
      this.validateChecklistLogic.bind(this)
    );
  }

  // ============================================================================
  // CHECKLIST CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new QC checklist
   */
  private async createChecklist(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      this.logger.debug('Creating QC checklist', { 
        userId: req.user?.id,
        checklistName: req.body.name 
      });

      const checklistData: CreateQCChecklistRequest = {
        ...req.body,
        createdBy: req.user?.id || 'system',
        clientId: req.body.clientId || req.user?.clientId,
        organizationId: req.body.organizationId || req.user?.organizationId
      };

      const result = await this.qcService.createChecklist(checklistData, req.user?.id || 'system');

      this.logger.info('QC checklist created successfully', {
        checklistId: result.data?.id,
        name: result.data?.name,
        userId: req.user?.id
      });

      res.status(201).json(createApiResponse(result, 'QC checklist created successfully'));

    } catch (error) {
      this.logger.error('Failed to create QC checklist', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_CHECKLIST_CREATE_FAILED', 'Failed to create QC checklist')
      });
    }
  }

  /**
   * Get a QC checklist by ID
   */
  private async getChecklist(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const includeInactive = req.query.includeInactive === 'true';

      if (!id) {
        res.status(400).json({
          success: false,
          error: createApiError('QC_CHECKLIST_ID_REQUIRED', 'Checklist ID is required')
        });
        return;
      }

      this.logger.debug('Getting QC checklist', { 
        checklistId: id, 
        userId: req.user?.id,
        includeInactive 
      });

      const checklist = await this.qcService.getChecklist(id, includeInactive);

      if (!checklist) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_CHECKLIST_NOT_FOUND', `QC checklist ${id} not found`)
        });
        return;
      }

      // Check access permissions
      if (!this.hasChecklistAccess(req.user, checklist)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_CHECKLIST_ACCESS_DENIED', 'Access denied to this checklist')
        });
        return;
      }

      res.json(createApiResponse(checklist, 'QC checklist retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get QC checklist', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checklistId: req.params.id,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_CHECKLIST_GET_FAILED', 'Failed to retrieve QC checklist')
      });
    }
  }

  /**
   * Update an existing QC checklist
   */
  private async updateChecklist(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: createApiError('QC_CHECKLIST_ID_REQUIRED', 'Checklist ID is required')
        });
        return;
      }

      this.logger.debug('Updating QC checklist', { 
        checklistId: id, 
        userId: req.user?.id 
      });

      // Verify checklist exists and user has access
      const existingChecklist = await this.qcService.getChecklist(id);
      if (!existingChecklist) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_CHECKLIST_NOT_FOUND', `QC checklist ${id} not found`)
        });
        return;
      }

      if (!this.hasChecklistAccess(req.user, existingChecklist)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_CHECKLIST_ACCESS_DENIED', 'Access denied to update this checklist')
        });
        return;
      }

      const updates = {
        ...req.body,
        lastModified: new Date(),
        modifiedBy: req.user?.id
      };

      const result = await this.qcService.updateChecklist(id, updates, req.user?.id || 'system');

      this.logger.info('QC checklist updated successfully', {
        checklistId: id,
        version: result.version,
        userId: req.user?.id
      });

      res.json(createApiResponse(result, 'QC checklist updated successfully'));

    } catch (error) {
      this.logger.error('Failed to update QC checklist', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checklistId: req.params.id,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_CHECKLIST_UPDATE_FAILED', 'Failed to update QC checklist')
      });
    }
  }

  /**
   * Delete (deactivate) a QC checklist
   */
  private async deleteChecklist(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: createApiError('QC_CHECKLIST_ID_REQUIRED', 'Checklist ID is required')
        });
        return;
      }

      this.logger.debug('Deleting QC checklist', { 
        checklistId: id, 
        userId: req.user?.id 
      });

      // Verify checklist exists and user has access
      const existingChecklist = await this.qcService.getChecklist(id);
      if (!existingChecklist) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_CHECKLIST_NOT_FOUND', `QC checklist ${id} not found`)
        });
        return;
      }

      if (!this.hasChecklistAccess(req.user, existingChecklist)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_CHECKLIST_ACCESS_DENIED', 'Access denied to delete this checklist')
        });
        return;
      }

      await this.qcService.deleteChecklist(id, req.user?.id || 'system');

      this.logger.info('QC checklist deleted successfully', {
        checklistId: id,
        userId: req.user?.id
      });

      res.json(createApiResponse(null, 'QC checklist deleted successfully'));

    } catch (error) {
      this.logger.error('Failed to delete QC checklist', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checklistId: req.params.id,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_CHECKLIST_DELETE_FAILED', 'Failed to delete QC checklist')
      });
    }
  }

  // ============================================================================
  // SEARCH AND LISTING OPERATIONS
  // ============================================================================

  /**
   * Search QC checklists with filtering and pagination
   */
  private async searchChecklists(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters = {
        documentType: req.query.documentType as string,
        isTemplate: req.query.isTemplate === 'true',
        isActive: req.query.isActive !== 'false', // Default to active only
        createdBy: req.query.createdBy as string,
        ...(req.query.tags && { tags: (req.query.tags as string).split(',') }),
        ...(req.query.clientId && { clientId: req.query.clientId as string }),
        ...(req.user?.clientId && !req.query.clientId && { clientId: req.user.clientId }),
        ...(req.query.organizationId && { organizationId: req.query.organizationId as string }),
        ...(req.user?.organizationId && !req.query.organizationId && { organizationId: req.user.organizationId })
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      this.logger.debug('Searching QC checklists', { 
        filters, 
        limit, 
        offset, 
        userId: req.user?.id 
      });

      const results = await this.qcService.searchChecklists(filters, limit, offset);

      res.json(createApiResponse(results, 'QC checklists retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to search QC checklists', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_CHECKLIST_SEARCH_FAILED', 'Failed to search QC checklists')
      });
    }
  }

  // ============================================================================
  // TEMPLATE OPERATIONS
  // ============================================================================

  /**
   * Create checklist from template
   */
  private async createFromTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { templateId, name, customizations } = req.body;

      this.logger.debug('Creating checklist from template', {
        templateId,
        name,
        userId: req.user?.id
      });

      const result = await this.qcService.createFromTemplate(
        templateId,
        name,
        customizations,
        req.user?.id || 'system'
      );

      this.logger.info('Checklist created from template successfully', {
        checklistId: result.id,
        templateId,
        name,
        userId: req.user?.id
      });

      res.status(201).json(createApiResponse(result, 'Checklist created from template successfully'));

    } catch (error) {
      this.logger.error('Failed to create checklist from template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId: req.body.templateId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_TEMPLATE_CREATE_FAILED', 'Failed to create checklist from template')
      });
    }
  }

  /**
   * Clone an existing checklist
   */
  private async cloneChecklist(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          error: createApiError('QC_CHECKLIST_ID_REQUIRED', 'Checklist ID is required')
        });
        return;
      }

      this.logger.debug('Cloning QC checklist', {
        sourceChecklistId: id,
        newName: name,
        userId: req.user?.id
      });

      const result = await this.qcService.cloneChecklist(id, name, req.user?.id || 'system');

      this.logger.info('QC checklist cloned successfully', {
        sourceChecklistId: id,
        newChecklistId: result.id,
        name,
        userId: req.user?.id
      });

      res.status(201).json(createApiResponse(result, 'QC checklist cloned successfully'));

    } catch (error) {
      this.logger.error('Failed to clone QC checklist', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sourceChecklistId: req.params.id,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_CHECKLIST_CLONE_FAILED', 'Failed to clone QC checklist')
      });
    }
  }

  // ============================================================================
  // ASSIGNMENT OPERATIONS
  // ============================================================================

  /**
   * Create a new checklist assignment
   */
  private async createAssignment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const assignmentData = {
        ...req.body,
        assignedBy: req.user?.id || 'system',
        assignedAt: new Date()
      };

      this.logger.debug('Creating checklist assignment', {
        checklistId: assignmentData.checklistId,
        targetId: assignmentData.targetId,
        assignmentType: assignmentData.assignmentType,
        userId: req.user?.id
      });

      const result = await this.qcService.assignChecklist(assignmentData);

      this.logger.info('Checklist assignment created successfully', {
        assignmentId: result.id,
        checklistId: assignmentData.checklistId,
        targetId: assignmentData.targetId,
        userId: req.user?.id
      });

      res.status(201).json(createApiResponse(result, 'Checklist assignment created successfully'));

    } catch (error) {
      this.logger.error('Failed to create checklist assignment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_ASSIGNMENT_CREATE_FAILED', 'Failed to create checklist assignment')
      });
    }
  }

  /**
   * Get checklist assignments with filtering
   */
  private async getAssignments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters = {
        checklistId: req.query.checklistId as string,
        targetId: req.query.targetId as string,
        assignmentType: req.query.assignmentType as ("user" | "client" | "organization" | "role"),
        isActive: req.query.isActive !== 'false',
        clientId: req.query.clientId as string || req.user?.clientId,
        organizationId: req.query.organizationId as string || req.user?.organizationId
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });

      this.logger.debug('Getting checklist assignments', {
        filters,
        userId: req.user?.id
      });

      const assignments = await this.qcService.getAssignments(filters);

      res.json(createApiResponse(assignments, 'Checklist assignments retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get checklist assignments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_ASSIGNMENT_GET_FAILED', 'Failed to retrieve checklist assignments')
      });
    }
  }

  /**
   * Get active assignments for a specific target
   */
  private async getActiveAssignments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { targetId } = req.params;
      const documentType = req.query.documentType as string;

      if (!targetId) {
        res.status(400).json({
          success: false,
          error: createApiError('TARGET_ID_REQUIRED', 'Target ID is required')
        });
        return;
      }

      this.logger.debug('Getting active assignments', {
        targetId,
        documentType,
        userId: req.user?.id
      });

      const assignments = await this.qcService.getActiveChecklistsForTarget(targetId, documentType);

      res.json(createApiResponse(assignments, 'Active assignments retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get active assignments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetId: req.params.targetId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_ASSIGNMENT_GET_ACTIVE_FAILED', 'Failed to retrieve active assignments')
      });
    }
  }

  /**
   * Remove a checklist assignment
   */
  private async removeAssignment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: createApiError('INVALID_ASSIGNMENT_ID', 'Assignment ID is required')
        });
        return;
      }

      this.logger.debug('Removing checklist assignment', {
        assignmentId: id,
        userId: req.user?.id
      });

      await this.qcService.removeAssignment(id);

      this.logger.info('Checklist assignment removed successfully', {
        assignmentId: id,
        userId: req.user?.id
      });

      res.json(createApiResponse(null, 'Checklist assignment removed successfully'));

    } catch (error) {
      this.logger.error('Failed to remove checklist assignment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        assignmentId: req.params.id,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_ASSIGNMENT_REMOVE_FAILED', 'Failed to remove checklist assignment')
      });
    }
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Validate checklist conditional logic
   */
  private async validateChecklistLogic(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { testData } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          error: createApiError('INVALID_CHECKLIST_ID', 'Checklist ID is required')
        });
        return;
      }

      this.logger.debug('Validating checklist logic', {
        checklistId: id,
        userId: req.user?.id
      });

      const checklist = await this.qcService.getChecklist(id);
      if (!checklist) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_CHECKLIST_NOT_FOUND', `QC checklist ${id} not found`)
        });
        return;
      }

      // Validate conditional logic for each category/question
      const validationResults: any[] = [];

      for (const category of checklist.categories) {
        for (const subcategory of category.subcategories) {
          for (const question of subcategory.questions) {
            if (question.conditionalLogic) {
              try {
                const isValid = await this.qcService.evaluateConditionalLogic(
                  question.conditionalLogic,
                  testData || {}
                );
                validationResults.push({
                  questionId: question.id,
                  question: question.question,
                  conditionalLogic: question.conditionalLogic,
                  isValid,
                  testPassed: true
                });
              } catch (error) {
                validationResults.push({
                  questionId: question.id,
                  question: question.question,
                  conditionalLogic: question.conditionalLogic,
                  isValid: false,
                  testPassed: false,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
          }
        }
      }

      const summary = {
        totalQuestions: validationResults.length,
        passed: validationResults.filter(r => r.testPassed).length,
        failed: validationResults.filter(r => !r.testPassed).length,
        validationResults
      };

      res.json(createApiResponse(summary, 'Checklist logic validation completed'));

    } catch (error) {
      this.logger.error('Failed to validate checklist logic', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checklistId: req.params.id,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_VALIDATION_FAILED', 'Failed to validate checklist logic')
      });
    }
  }

  // ============================================================================
  // VALIDATION MIDDLEWARE
  // ============================================================================

  private validateCreateChecklist() {
    return [
      body('name').notEmpty().withMessage('Checklist name is required'),
      body('documentTypes').isArray().withMessage('Document types must be an array'),
      body('categories').isArray().withMessage('Categories must be an array'),
      body('version').optional().isString()
    ];
  }

  private validateGetChecklist() {
    return [
      param('id').notEmpty().withMessage('Checklist ID is required')
    ];
  }

  private validateUpdateChecklist() {
    return [
      param('id').notEmpty().withMessage('Checklist ID is required'),
      body('name').optional().isString(),
      body('categories').optional().isArray()
    ];
  }

  private validateDeleteChecklist() {
    return [
      param('id').notEmpty().withMessage('Checklist ID is required')
    ];
  }

  private validateSearchChecklists() {
    return [
      query('limit').optional().isInt({ min: 1, max: 200 }),
      query('offset').optional().isInt({ min: 0 })
    ];
  }

  private validateCreateFromTemplate() {
    return [
      body('templateId').notEmpty().withMessage('Template ID is required'),
      body('name').notEmpty().withMessage('Checklist name is required'),
      body('customizations').optional().isObject()
    ];
  }

  private validateCloneChecklist() {
    return [
      param('id').notEmpty().withMessage('Source checklist ID is required'),
      body('name').notEmpty().withMessage('New checklist name is required')
    ];
  }

  private validateCreateAssignment() {
    return [
      body('checklistId').notEmpty().withMessage('Checklist ID is required'),
      body('targetId').notEmpty().withMessage('Target ID is required'),
      body('assignmentType').isIn(['user', 'client', 'organization']).withMessage('Invalid assignment type')
    ];
  }

  private validateGetAssignments() {
    return [
      query('limit').optional().isInt({ min: 1, max: 200 }),
      query('offset').optional().isInt({ min: 0 })
    ];
  }

  private validateGetActiveAssignments() {
    return [
      param('targetId').notEmpty().withMessage('Target ID is required')
    ];
  }

  private validateRemoveAssignment() {
    return [
      param('id').notEmpty().withMessage('Assignment ID is required')
    ];
  }

  private validateChecklistValidation() {
    return [
      param('id').notEmpty().withMessage('Checklist ID is required'),
      body('testData').optional().isObject()
    ];
  }

  /**
   * Handle validation errors
   */
  private handleValidation(req: Request, res: Response, next: NextFunction): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: createApiError('VALIDATION_ERROR', 'Validation failed', {
          validationErrors: errors.array()
        })
      });
      return;
    }
    next();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if user has access to a checklist
   */
  private hasChecklistAccess(user: any, checklist: QCChecklist): boolean {
    if (!user) return false;

    // System admin has access to all checklists
    if (user.role === 'admin' || user.role === 'system') return true;

    // Check client/organization access
    if (checklist.clientId && user.clientId && checklist.clientId === user.clientId) {
      return true;
    }

    if (checklist.organizationId && user.organizationId && checklist.organizationId === user.organizationId) {
      return true;
    }

    // Check if user created the checklist
    if (checklist.createdBy === user.id) return true;

    return false;
  }

  /**
   * Get the router instance
   */
  public getRouter(): Router {
    return this.router;
  }
}

// Create and export router instance
export const qcChecklistRouter = new QCChecklistController().getRouter();