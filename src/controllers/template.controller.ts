/**
 * Template Management API Controller
 * Handles CRUD operations for document templates (ROV responses, appraisal reports, etc.)
 */

import express, { Request, Response, NextFunction } from 'express';
import { TemplateService } from '../services/template.service';
import { Logger } from '../utils/logger';
import {
  CreateTemplateInput,
  UpdateTemplateInput,
  RenderTemplateRequest,
  TemplateFilters,
  TemplateCategory,
  AppraisalFormType,
  TemplateFormat,
  TemplateStatus
} from '../types/template.types';

export class TemplateController {
  private templateService: TemplateService;
  private logger: Logger;

  constructor() {
    this.templateService = new TemplateService();
    this.logger = new Logger();
  }

  /**
   * POST /api/templates
   * Create a new template
   */
  createTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id || 'system';
      const tenantId = (req as any).user?.tenantId || 'default-tenant';
      
      this.logger.info('Creating template', { userId, category: req.body.category });

      const input: CreateTemplateInput = {
        name: req.body.name,
        description: req.body.description,
        category: req.body.category,
        formType: req.body.formType,
        content: req.body.content,
        sections: req.body.sections,
        format: req.body.format,
        placeholders: req.body.placeholders,
        styles: req.body.styles,
        requiresApproval: req.body.requiresApproval,
        tags: req.body.tags
      };

      // Create access control (inherit from user's tenant)
      const accessControl = {
        tenantId,
        teamId: (req as any).user?.teamId,
        clientId: (req as any).user?.clientId,
        ownerId: userId,
        assignedUserIds: [userId]
      };

      const result = await this.templateService.createTemplate(input, userId, tenantId, accessControl);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: result.data,
          message: 'Template created successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in createTemplate endpoint', { error });
      next(error);
    }
  };

  /**
   * GET /api/templates
   * List templates with filtering
   */
  listTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: TemplateFilters = {};
      
      if (req.query.category) {
        filters.category = (req.query.category as string).split(',') as TemplateCategory[];
      }
      if (req.query.formType) {
        filters.formType = (req.query.formType as string).split(',') as AppraisalFormType[];
      }
      if (req.query.format) {
        filters.format = (req.query.format as string).split(',') as TemplateFormat[];
      }
      if (req.query.status) {
        filters.status = (req.query.status as string).split(',') as TemplateStatus[];
      }
      if (req.query.isDefault) {
        filters.isDefault = req.query.isDefault === 'true';
      }
      if (req.query.tags) {
        filters.tags = (req.query.tags as string).split(',');
      }
      if (req.query.search) {
        filters.search = req.query.search as string;
      }
      if (req.query.createdBy) {
        filters.createdBy = req.query.createdBy as string;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      this.logger.info('Listing templates', { filters, page, limit });

      const result = await this.templateService.listTemplates(filters, page, limit);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      this.logger.error('Error in listTemplates endpoint', { error });
      next(error);
    }
  };

  /**
   * GET /api/templates/:id
   * Get template by ID
   */
  getTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Template ID is required'
        });
        return;
      }

      this.logger.info('Fetching template', { templateId: id });

      const result = await this.templateService.getTemplateById(id);

      if (result.success && result.data) {
        res.json({
          success: true,
          data: result.data
        });
      } else if (!result.data) {
        res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in getTemplate endpoint', { error, templateId: req.params.id });
      next(error);
    }
  };

  /**
   * PUT /api/templates/:id
   * Update template
   */
  updateTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || 'system';

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Template ID is required'
        });
        return;
      }

      this.logger.info('Updating template', { templateId: id, userId });

      const input: UpdateTemplateInput = {
        templateId: id,
        name: req.body.name,
        description: req.body.description,
        content: req.body.content,
        sections: req.body.sections,
        status: req.body.status,
        placeholders: req.body.placeholders,
        styles: req.body.styles,
        tags: req.body.tags
      };

      const result = await this.templateService.updateTemplate(input, userId);

      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          message: 'Template updated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in updateTemplate endpoint', { error, templateId: req.params.id });
      next(error);
    }
  };

  /**
   * POST /api/templates/:id/render
   * Render template with data
   */
  renderTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Template ID is required'
        });
        return;
      }

      this.logger.info('Rendering template', { templateId: id });

      const renderRequest: RenderTemplateRequest = {
        templateId: id,
        data: req.body.data || {},
        format: req.body.format,
        options: req.body.options
      };

      const result = await this.templateService.renderTemplate(renderRequest);

      if (result.success) {
        // If PDF or DOCX, return file
        if (result.file) {
          res.json({
            success: true,
            file: result.file,
            metadata: result.metadata,
            message: 'Template rendered successfully'
          });
        } else {
          res.json({
            success: true,
            content: result.content,
            metadata: result.metadata,
            message: 'Template rendered successfully'
          });
        }
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in renderTemplate endpoint', { error, templateId: req.params.id });
      next(error);
    }
  };

  /**
   * POST /api/templates/:id/set-default
   * Set template as default for its category
   */
  setDefaultTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { category } = req.body;

      if (!id || !category) {
        res.status(400).json({
          success: false,
          error: 'Template ID and category are required'
        });
        return;
      }

      this.logger.info('Setting default template', { templateId: id, category });

      const result = await this.templateService.setDefaultTemplate(id, category);

      if (result.success) {
        res.json({
          success: true,
          message: 'Default template set successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in setDefaultTemplate endpoint', { error, templateId: req.params.id });
      next(error);
    }
  };

  /**
   * DELETE /api/templates/:id
   * Delete template
   */
  deleteTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Template ID is required'
        });
        return;
      }

      this.logger.info('Deleting template', { templateId: id });

      const result = await this.templateService.deleteTemplate(id);

      if (result.success) {
        res.json({
          success: true,
          message: 'Template deleted successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error('Error in deleteTemplate endpoint', { error, templateId: req.params.id });
      next(error);
    }
  };

  /**
   * POST /api/templates/validate
   * Validate template syntax
   */
  validateTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { content, placeholders } = req.body;

      if (!content || !placeholders) {
        res.status(400).json({
          success: false,
          error: 'Content and placeholders are required'
        });
        return;
      }

      this.logger.info('Validating template');

      const validation = this.templateService.validateTemplate(content, placeholders);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      this.logger.error('Error in validateTemplate endpoint', { error });
      next(error);
    }
  };
}

/**
 * Create Express router with template endpoints
 */
export function createTemplateRouter(): express.Router {
  const router = express.Router();
  const controller = new TemplateController();

  // Template CRUD operations
  router.post('/', controller.createTemplate);
  router.get('/', controller.listTemplates);
  router.get('/:id', controller.getTemplate);
  router.put('/:id', controller.updateTemplate);
  router.delete('/:id', controller.deleteTemplate);

  // Template operations
  router.post('/:id/render', controller.renderTemplate);
  router.post('/:id/set-default', controller.setDefaultTemplate);
  router.post('/validate', controller.validateTemplate);

  return router;
}
