/**
 * QC Execution Controller
 * REST API endpoints for executing QC reviews, monitoring progress, and retrieving execution results
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger';
import { QCExecutionEngine } from '../services/qc-execution.engine';
import { QCChecklistManagementService } from '../services/qc-checklist-management.service';
import { createApiError, createApiResponse } from '../utils/api-response.util';
import {
  QCExecutionStatus,
  QCExecutionMode,
  QCExecutionConfig
} from '../types/qc-management';
import { QCExecutionContext, QCChecklist } from '../types/qc-checklist.types';
import { ApiResponse } from '../types/index';

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

export interface QCExecutionSession {
  id: string;
  checklistId: string;
  targetId: string;
  documentData: any;
  status: QCExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  executedBy: string;
  results?: any;
  error?: string;
  progress: {
    totalCategories: number;
    completedCategories: number;
    totalQuestions: number;
    completedQuestions: number;
    currentCategory: string;
    currentSubcategory: string;
    estimatedTimeRemaining: number;
  };
}

export class QCExecutionController {
  private logger: Logger;
  private executionEngine: QCExecutionEngine;
  private checklistService: QCChecklistManagementService;
  private router: Router;
  private activeSessions: Map<string, QCExecutionSession>;

  constructor() {
    this.logger = new Logger('QCExecutionController');
    this.executionEngine = new QCExecutionEngine();
    this.checklistService = new QCChecklistManagementService();
    this.router = Router();
    this.activeSessions = new Map();
    this.initializeRoutes();
  }

  /**
   * Initialize all routes for QC execution management
   */
  private initializeRoutes(): void {
    // Single execution operations
    this.router.post('/execute',
      this.validateExecuteQC(),
      this.handleValidation,
      this.executeQCReview.bind(this)
    );

    this.router.post('/execute/async',
      this.validateExecuteQCAsync(),
      this.handleValidation,
      this.executeQCReviewAsync.bind(this)
    );

    // Batch execution operations
    this.router.post('/batch/execute',
      this.validateBatchExecuteQC(),
      this.handleValidation,
      this.executeBatchQCReview.bind(this)
    );

    // Execution monitoring
    this.router.get('/sessions/:sessionId/status',
      this.validateGetExecutionStatus(),
      this.handleValidation,
      this.getExecutionStatus.bind(this)
    );

    this.router.get('/sessions/:sessionId/progress',
      this.validateGetExecutionProgress(),
      this.handleValidation,
      this.getExecutionProgress.bind(this)
    );

    this.router.get('/sessions/:sessionId/results',
      this.validateGetExecutionResults(),
      this.handleValidation,
      this.getExecutionResults.bind(this)
    );

    // Session management
    this.router.get('/sessions',
      this.validateGetExecutionSessions(),
      this.handleValidation,
      this.getExecutionSessions.bind(this)
    );

    this.router.delete('/sessions/:sessionId',
      this.validateCancelExecution(),
      this.handleValidation,
      this.cancelExecution.bind(this)
    );

    // Execution configuration and preview
    this.router.post('/preview',
      this.validatePreviewExecution(),
      this.handleValidation,
      this.previewExecution.bind(this)
    );

    this.router.post('/validate-config',
      this.validateExecutionConfig(),
      this.handleValidation,
      this.validateExecutionConfiguration.bind(this)
    );

    // Execution history and analytics
    this.router.get('/history',
      this.validateGetExecutionHistory(),
      this.handleValidation,
      this.getExecutionHistory.bind(this)
    );

    this.router.get('/analytics',
      this.validateGetExecutionAnalytics(),
      this.handleValidation,
      this.getExecutionAnalytics.bind(this)
    );
  }

  // ============================================================================
  // SINGLE EXECUTION OPERATIONS
  // ============================================================================

  /**
   * Execute QC review synchronously
   */
  private async executeQCReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { checklistId, targetId, documentData, executionMode = QCExecutionMode.STANDARD, executionConfig } = req.body;

      this.logger.debug('Starting QC review execution', {
        checklistId: executionRequest.checklistId,
        targetId: executionRequest.targetId,
        executionMode: executionRequest.executionMode,
        userId: req.user?.id
      });

      // Validate checklist exists and user has access
      const checklist = await this.checklistService.getChecklist(executionRequest.checklistId);
      if (!checklist) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_CHECKLIST_NOT_FOUND', `QC checklist ${executionRequest.checklistId} not found`)
        });
        return;
      }

      if (!this.hasChecklistExecuteAccess(req.user, checklist)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_EXECUTE_ACCESS_DENIED', 'Access denied to execute this checklist')
        });
        return;
      }

      // Create execution session
      const sessionId = this.generateSessionId();
      const session: QCExecutionSession = {
        id: sessionId,
        checklistId: executionRequest.checklistId,
        targetId: executionRequest.targetId,
        documentData: executionRequest.documentData,
        status: QCExecutionStatus.RUNNING,
        progress: {
          totalCategories: checklist.categories.length,
          completedCategories: 0,
          totalQuestions: this.getTotalQuestions(checklist),
          completedQuestions: 0,
          currentCategory: checklist.categories[0]?.name || '',
          currentSubcategory: '',
          estimatedTimeRemaining: 0
        },
        startedAt: new Date(),
        executedBy: req.user?.id || 'system'
      };

      this.activeSessions.set(sessionId, session);

      // Execute QC review
      const executionContext = {
        checklistId: executionRequest.checklistId,
        documentId: executionRequest.targetId,
        documentType: checklist.documentType,
        executionId: sessionId,
        documentData: executionRequest.documentData,
        userId: req.user?.id || 'system',
        clientId: req.user?.clientId,
        organizationId: req.user?.organizationId,
        autoExecute: true,
        requireHumanReview: false
      };

      const result = await this.executionEngine.executeQCReview(
        checklist,
        executionRequest.documentData,
        executionContext
      );

      // Update session with results
      session.status = QCExecutionStatus.COMPLETED;
      session.completedAt = new Date();
      session.results = result;
      this.activeSessions.set(sessionId, session);

      this.logger.info('QC review execution completed', {
        sessionId,
        checklistId: executionRequest.checklistId,
        targetId: executionRequest.targetId,
        totalIssues: result.summary.totalIssues,
        overallScore: result.summary.overallScore,
        userId: req.user?.id
      });

      res.json(createApiResponse({
        sessionId,
        results: result,
        executionTime: session.completedAt.getTime() - session.startedAt.getTime()
      }, 'QC review executed successfully'));

    } catch (error) {
      this.logger.error('Failed to execute QC review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checklistId: req.body.checklistId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_EXECUTION_FAILED', 'Failed to execute QC review')
      });
    }
  }

  /**
   * Execute QC review asynchronously
   */
  private async executeQCReviewAsync(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const executionRequest: QCExecutionRequest = {
        ...req.body,
        executedBy: req.user?.id || 'system',
        executionMode: req.body.executionMode || QCExecutionMode.COMPREHENSIVE
      };

      this.logger.debug('Starting async QC review execution', {
        checklistId: executionRequest.checklistId,
        targetId: executionRequest.targetId,
        userId: req.user?.id
      });

      // Validate checklist
      const checklist = await this.checklistService.getChecklist(executionRequest.checklistId);
      if (!checklist) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_CHECKLIST_NOT_FOUND', `QC checklist ${executionRequest.checklistId} not found`)
        });
        return;
      }

      if (!this.hasChecklistExecuteAccess(req.user, checklist)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_EXECUTE_ACCESS_DENIED', 'Access denied to execute this checklist')
        });
        return;
      }

      // Create execution session
      const sessionId = this.generateSessionId();
      const session: QCExecutionSession = {
        id: sessionId,
        checklistId: executionRequest.checklistId,
        targetId: executionRequest.targetId,
        documentData: executionRequest.documentData,
        status: QCExecutionStatus.QUEUED,
        progress: {
          totalCategories: checklist.categories.length,
          completedCategories: 0,
          totalQuestions: this.getTotalQuestions(checklist),
          completedQuestions: 0,
          currentCategory: '',
          currentSubcategory: '',
          estimatedTimeRemaining: 0
        },
        startedAt: new Date(),
        executedBy: req.user?.id || 'system'
      };

      this.activeSessions.set(sessionId, session);

      // Return session ID immediately for async tracking
      res.status(202).json(createApiResponse({
        sessionId,
        status: QCExecutionStatus.QUEUED,
        message: 'QC review execution queued. Use the session ID to check progress.'
      }, 'QC review execution started'));

      // Execute asynchronously
      this.executeQCReviewInBackground(session, checklist, executionRequest);

    } catch (error) {
      this.logger.error('Failed to start async QC review execution', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checklistId: req.body.checklistId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_EXECUTION_START_FAILED', 'Failed to start QC review execution')
      });
    }
  }

  // ============================================================================
  // BATCH EXECUTION OPERATIONS
  // ============================================================================

  /**
   * Execute batch QC reviews
   */
  private async executeBatchQCReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const batchRequest: QCBatchExecutionRequest = {
        ...req.body,
        executedBy: req.user?.id || 'system'
      };

      this.logger.debug('Starting batch QC review execution', {
        totalRequests: batchRequest.requests.length,
        userId: req.user?.id
      });

      // Validate all checklists exist and user has access
      const validationResults: Array<{ index: number; valid: boolean; error?: string }> = [];

      for (let i = 0; i < batchRequest.requests.length; i++) {
        const request = batchRequest.requests[i];
        try {
          const checklist = await this.checklistService.getChecklist(request.checklistId);
          if (!checklist) {
            validationResults.push({
              index: i,
              valid: false,
              error: `Checklist ${request.checklistId} not found`
            });
            continue;
          }

          if (!this.hasChecklistExecuteAccess(req.user, checklist)) {
            validationResults.push({
              index: i,
              valid: false,
              error: `Access denied to checklist ${request.checklistId}`
            });
            continue;
          }

          validationResults.push({ index: i, valid: true });
        } catch (error) {
          validationResults.push({
            index: i,
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown validation error'
          });
        }
      }

      const invalidRequests = validationResults.filter(r => !r.valid);
      if (invalidRequests.length > 0) {
        res.status(400).json({
          success: false,
          error: createApiError('QC_BATCH_VALIDATION_FAILED', 'Some batch requests are invalid', {
            invalidRequests
          })
        });
        return;
      }

      // Create batch execution session
      const batchSessionId = this.generateSessionId();
      const batchResults: any[] = [];

      // Execute each request
      for (let i = 0; i < batchRequest.requests.length; i++) {
        const request = batchRequest.requests[i];
        
        try {
          this.logger.debug(`Executing batch request ${i + 1}/${batchRequest.requests.length}`, {
            checklistId: request.checklistId,
            targetId: request.targetId
          });

          const checklist = await this.checklistService.getChecklist(request.checklistId);
          const result = await this.executionEngine.executeQCReview(
            checklist!,
            request.documentData,
            request.executionConfig
          );

          batchResults.push({
            index: i,
            request: {
              checklistId: request.checklistId,
              targetId: request.targetId
            },
            success: true,
            result
          });

        } catch (error) {
          batchResults.push({
            index: i,
            request: {
              checklistId: request.checklistId,
              targetId: request.targetId
            },
            success: false,
            error: error instanceof Error ? error.message : 'Unknown execution error'
          });
        }
      }

      const successfulExecutions = batchResults.filter(r => r.success);
      const failedExecutions = batchResults.filter(r => !r.success);

      this.logger.info('Batch QC review execution completed', {
        batchSessionId,
        totalRequests: batchRequest.requests.length,
        successful: successfulExecutions.length,
        failed: failedExecutions.length,
        userId: req.user?.id
      });

      res.json(createApiResponse({
        batchSessionId,
        summary: {
          totalRequests: batchRequest.requests.length,
          successful: successfulExecutions.length,
          failed: failedExecutions.length
        },
        results: batchResults
      }, 'Batch QC review execution completed'));

    } catch (error) {
      this.logger.error('Failed to execute batch QC review', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_BATCH_EXECUTION_FAILED', 'Failed to execute batch QC review')
      });
    }
  }

  // ============================================================================
  // EXECUTION MONITORING
  // ============================================================================

  /**
   * Get execution status
   */
  private async getExecutionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      this.logger.debug('Getting execution status', {
        sessionId,
        userId: req.user?.id
      });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_SESSION_NOT_FOUND', `Execution session ${sessionId} not found`)
        });
        return;
      }

      // Check access
      if (!this.hasSessionAccess(req.user, session)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_SESSION_ACCESS_DENIED', 'Access denied to this execution session')
        });
        return;
      }

      res.json(createApiResponse({
        sessionId: session.id,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        executionTime: session.completedAt 
          ? session.completedAt.getTime() - session.startedAt.getTime()
          : Date.now() - session.startedAt.getTime(),
        hasResults: !!session.results,
        hasError: !!session.error
      }, 'Execution status retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get execution status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.params.sessionId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_STATUS_GET_FAILED', 'Failed to retrieve execution status')
      });
    }
  }

  /**
   * Get execution progress
   */
  private async getExecutionProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      this.logger.debug('Getting execution progress', {
        sessionId,
        userId: req.user?.id
      });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_SESSION_NOT_FOUND', `Execution session ${sessionId} not found`)
        });
        return;
      }

      if (!this.hasSessionAccess(req.user, session)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_SESSION_ACCESS_DENIED', 'Access denied to this execution session')
        });
        return;
      }

      const progressPercentage = session.progress.totalQuestions > 0
        ? (session.progress.completedQuestions / session.progress.totalQuestions) * 100
        : 0;

      res.json(createApiResponse({
        sessionId: session.id,
        progress: {
          ...session.progress,
          progressPercentage: Math.round(progressPercentage * 100) / 100
        },
        status: session.status
      }, 'Execution progress retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get execution progress', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.params.sessionId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_PROGRESS_GET_FAILED', 'Failed to retrieve execution progress')
      });
    }
  }

  /**
   * Get execution results
   */
  private async getExecutionResults(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      this.logger.debug('Getting execution results', {
        sessionId,
        userId: req.user?.id
      });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_SESSION_NOT_FOUND', `Execution session ${sessionId} not found`)
        });
        return;
      }

      if (!this.hasSessionAccess(req.user, session)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_SESSION_ACCESS_DENIED', 'Access denied to this execution session')
        });
        return;
      }

      if (session.status !== QCExecutionStatus.COMPLETED) {
        res.status(409).json({
          success: false,
          error: createApiError('QC_EXECUTION_NOT_COMPLETED', 'Execution not yet completed')
        });
        return;
      }

      if (!session.results) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_RESULTS_NOT_FOUND', 'Execution results not available')
        });
        return;
      }

      res.json(createApiResponse({
        sessionId: session.id,
        results: session.results,
        executionInfo: {
          checklistId: session.checklistId,
          targetId: session.targetId,
          executedBy: session.executedBy,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          executionTime: session.completedAt!.getTime() - session.startedAt.getTime()
        }
      }, 'Execution results retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get execution results', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.params.sessionId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_RESULTS_GET_FAILED', 'Failed to retrieve execution results')
      });
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Get execution sessions
   */
  private async getExecutionSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = req.query.status as QCExecutionStatus;
      const checklistId = req.query.checklistId as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      this.logger.debug('Getting execution sessions', {
        status,
        checklistId,
        limit,
        offset,
        userId: req.user?.id
      });

      let sessions = Array.from(this.activeSessions.values());

      // Filter by user access
      sessions = sessions.filter(session => this.hasSessionAccess(req.user, session));

      // Apply filters
      if (status) {
        sessions = sessions.filter(session => session.status === status);
      }

      if (checklistId) {
        sessions = sessions.filter(session => session.checklistId === checklistId);
      }

      // Sort by start time (most recent first)
      sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

      // Apply pagination
      const paginatedSessions = sessions.slice(offset, offset + limit);

      const sessionSummaries = paginatedSessions.map(session => ({
        sessionId: session.id,
        checklistId: session.checklistId,
        targetId: session.targetId,
        status: session.status,
        progress: session.progress,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        executedBy: session.executedBy,
        hasResults: !!session.results,
        hasError: !!session.error
      }));

      res.json(createApiResponse({
        sessions: sessionSummaries,
        pagination: {
          total: sessions.length,
          limit,
          offset,
          hasMore: offset + limit < sessions.length
        }
      }, 'Execution sessions retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get execution sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_SESSIONS_GET_FAILED', 'Failed to retrieve execution sessions')
      });
    }
  }

  /**
   * Cancel execution
   */
  private async cancelExecution(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      this.logger.debug('Cancelling execution', {
        sessionId,
        userId: req.user?.id
      });

      const session = this.activeSessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_SESSION_NOT_FOUND', `Execution session ${sessionId} not found`)
        });
        return;
      }

      if (!this.hasSessionAccess(req.user, session)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_SESSION_ACCESS_DENIED', 'Access denied to cancel this execution')
        });
        return;
      }

      if (session.status === QCExecutionStatus.COMPLETED) {
        res.status(409).json({
          success: false,
          error: createApiError('QC_EXECUTION_ALREADY_COMPLETED', 'Cannot cancel completed execution')
        });
        return;
      }

      // Update session status
      session.status = QCExecutionStatus.CANCELLED;
      session.completedAt = new Date();
      this.activeSessions.set(sessionId, session);

      this.logger.info('Execution cancelled', {
        sessionId,
        userId: req.user?.id
      });

      res.json(createApiResponse({
        sessionId,
        status: QCExecutionStatus.CANCELLED,
        cancelledAt: session.completedAt
      }, 'Execution cancelled successfully'));

    } catch (error) {
      this.logger.error('Failed to cancel execution', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: req.params.sessionId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_EXECUTION_CANCEL_FAILED', 'Failed to cancel execution')
      });
    }
  }

  // ============================================================================
  // CONFIGURATION AND PREVIEW
  // ============================================================================

  /**
   * Preview execution without running
   */
  private async previewExecution(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { checklistId, documentData, executionConfig } = req.body;

      this.logger.debug('Previewing QC execution', {
        checklistId,
        userId: req.user?.id
      });

      const checklist = await this.checklistService.getChecklist(checklistId);
      if (!checklist) {
        res.status(404).json({
          success: false,
          error: createApiError('QC_CHECKLIST_NOT_FOUND', `QC checklist ${checklistId} not found`)
        });
        return;
      }

      if (!this.hasChecklistExecuteAccess(req.user, checklist)) {
        res.status(403).json({
          success: false,
          error: createApiError('QC_EXECUTE_ACCESS_DENIED', 'Access denied to execute this checklist')
        });
        return;
      }

      // Generate preview information
      const preview = {
        checklistInfo: {
          id: checklist.id,
          name: checklist.name,
          version: checklist.version,
          documentTypes: checklist.documentTypes
        },
        executionPlan: {
          totalCategories: checklist.categories.length,
          totalQuestions: this.getTotalQuestions(checklist),
          estimatedExecutionTime: this.estimateExecutionTime(checklist),
          executionMode: executionConfig?.mode || QCExecutionMode.COMPREHENSIVE
        },
        categories: checklist.categories.map(category => ({
          name: category.name,
          description: category.description,
          subcategories: category.subcategories.length,
          questions: category.subcategories.reduce((total, sub) => total + sub.questions.length, 0),
          hasConditionalLogic: category.subcategories.some(sub => 
            sub.questions.some(q => q.conditionalLogic)
          )
        })),
        dataAvailability: this.analyzeDataAvailability(checklist, documentData)
      };

      res.json(createApiResponse(preview, 'Execution preview generated successfully'));

    } catch (error) {
      this.logger.error('Failed to generate execution preview', {
        error: error instanceof Error ? error.message : 'Unknown error',
        checklistId: req.body.checklistId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_PREVIEW_FAILED', 'Failed to generate execution preview')
      });
    }
  }

  /**
   * Validate execution configuration
   */
  private async validateExecutionConfiguration(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const config: QCExecutionConfig = req.body;

      this.logger.debug('Validating execution configuration', {
        userId: req.user?.id
      });

      const validationResults: any[] = [];

      // Validate required fields
      if (!config.mode || !Object.values(QCExecutionMode).includes(config.mode)) {
        validationResults.push({
          field: 'mode',
          error: 'Invalid or missing execution mode',
          severity: 'error'
        });
      }

      // Validate AI configuration
      if (config.aiConfig) {
        if (config.aiConfig.temperature !== undefined && (config.aiConfig.temperature < 0 || config.aiConfig.temperature > 2)) {
          validationResults.push({
            field: 'aiConfig.temperature',
            error: 'Temperature must be between 0 and 2',
            severity: 'error'
          });
        }

        if (config.aiConfig.maxTokens !== undefined && config.aiConfig.maxTokens < 1) {
          validationResults.push({
            field: 'aiConfig.maxTokens',
            error: 'Max tokens must be positive',
            severity: 'error'
          });
        }
      }

      // Validate timeout settings
      if (config.timeoutSettings) {
        if (config.timeoutSettings.questionTimeout !== undefined && config.timeoutSettings.questionTimeout < 1000) {
          validationResults.push({
            field: 'timeoutSettings.questionTimeout',
            error: 'Question timeout must be at least 1000ms',
            severity: 'warning'
          });
        }

        if (config.timeoutSettings.categoryTimeout !== undefined && config.timeoutSettings.categoryTimeout < 5000) {
          validationResults.push({
            field: 'timeoutSettings.categoryTimeout',
            error: 'Category timeout must be at least 5000ms',
            severity: 'warning'
          });
        }
      }

      const hasErrors = validationResults.some(r => r.severity === 'error');

      res.json(createApiResponse({
        isValid: !hasErrors,
        validationResults,
        summary: {
          totalIssues: validationResults.length,
          errors: validationResults.filter(r => r.severity === 'error').length,
          warnings: validationResults.filter(r => r.severity === 'warning').length
        }
      }, 'Configuration validation completed'));

    } catch (error) {
      this.logger.error('Failed to validate execution configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_CONFIG_VALIDATION_FAILED', 'Failed to validate execution configuration')
      });
    }
  }

  // ============================================================================
  // EXECUTION HISTORY AND ANALYTICS
  // ============================================================================

  /**
   * Get execution history
   */
  private async getExecutionHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const checklistId = req.query.checklistId as string;
      const targetId = req.query.targetId as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      this.logger.debug('Getting execution history', {
        checklistId,
        targetId,
        startDate,
        endDate,
        limit,
        offset,
        userId: req.user?.id
      });

      let sessions = Array.from(this.activeSessions.values());

      // Filter by user access
      sessions = sessions.filter(session => this.hasSessionAccess(req.user, session));

      // Apply filters
      if (checklistId) {
        sessions = sessions.filter(session => session.checklistId === checklistId);
      }

      if (targetId) {
        sessions = sessions.filter(session => session.targetId === targetId);
      }

      if (startDate) {
        sessions = sessions.filter(session => session.startedAt >= startDate);
      }

      if (endDate) {
        sessions = sessions.filter(session => session.startedAt <= endDate);
      }

      // Sort by start time (most recent first)
      sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

      // Apply pagination
      const paginatedSessions = sessions.slice(offset, offset + limit);

      const historyItems = paginatedSessions.map(session => ({
        sessionId: session.id,
        checklistId: session.checklistId,
        targetId: session.targetId,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        executedBy: session.executedBy,
        executionTime: session.completedAt 
          ? session.completedAt.getTime() - session.startedAt.getTime()
          : null,
        summary: session.results?.summary || null
      }));

      res.json(createApiResponse({
        history: historyItems,
        pagination: {
          total: sessions.length,
          limit,
          offset,
          hasMore: offset + limit < sessions.length
        }
      }, 'Execution history retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get execution history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_HISTORY_GET_FAILED', 'Failed to retrieve execution history')
      });
    }
  }

  /**
   * Get execution analytics
   */
  private async getExecutionAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const timeRange = req.query.timeRange as string || '30d';
      const checklistId = req.query.checklistId as string;

      this.logger.debug('Getting execution analytics', {
        timeRange,
        checklistId,
        userId: req.user?.id
      });

      const cutoffDate = this.calculateCutoffDate(timeRange);
      let sessions = Array.from(this.activeSessions.values());

      // Filter by user access and time range
      sessions = sessions.filter(session => 
        this.hasSessionAccess(req.user, session) && 
        session.startedAt >= cutoffDate
      );

      if (checklistId) {
        sessions = sessions.filter(session => session.checklistId === checklistId);
      }

      const completedSessions = sessions.filter(s => s.status === QCExecutionStatus.COMPLETED);

      // Calculate analytics
      const analytics = {
        overview: {
          totalExecutions: sessions.length,
          completedExecutions: completedSessions.length,
          failedExecutions: sessions.filter(s => s.status === QCExecutionStatus.FAILED).length,
          averageExecutionTime: this.calculateAverageExecutionTime(completedSessions),
          successRate: sessions.length > 0 ? (completedSessions.length / sessions.length) * 100 : 0
        },
        trends: {
          executionsByDay: this.groupExecutionsByDay(sessions),
          averageScoresByDay: this.groupScoresByDay(completedSessions)
        },
        performance: {
          averageScore: this.calculateAverageScore(completedSessions),
          scoreDistribution: this.calculateScoreDistribution(completedSessions),
          commonIssues: this.identifyCommonIssues(completedSessions)
        },
        checklists: {
          mostUsedChecklists: this.getMostUsedChecklists(sessions),
          checklistPerformance: this.getChecklistPerformance(completedSessions)
        }
      };

      res.json(createApiResponse(analytics, 'Execution analytics retrieved successfully'));

    } catch (error) {
      this.logger.error('Failed to get execution analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: createApiError('QC_ANALYTICS_GET_FAILED', 'Failed to retrieve execution analytics')
      });
    }
  }

  // ============================================================================
  // BACKGROUND EXECUTION
  // ============================================================================

  /**
   * Execute QC review in background
   */
  private async executeQCReviewInBackground(
    session: QCExecutionSession,
    checklist: any,
    executionRequest: QCExecutionRequest
  ): Promise<void> {
    try {
      session.status = QCExecutionStatus.RUNNING;
      this.activeSessions.set(session.id, session);

      const result = await this.executionEngine.executeQCReview(
        checklist,
        executionRequest.documentData,
        executionRequest.executionConfig,
        (progress) => {
          session.progress = progress;
          this.activeSessions.set(session.id, session);
        }
      );

      session.status = QCExecutionStatus.COMPLETED;
      session.completedAt = new Date();
      session.results = result;
      this.activeSessions.set(session.id, session);

      this.logger.info('Background QC execution completed', {
        sessionId: session.id,
        checklistId: session.checklistId,
        totalIssues: result.summary.totalIssues,
        overallScore: result.summary.overallScore
      });

    } catch (error) {
      session.status = QCExecutionStatus.FAILED;
      session.completedAt = new Date();
      session.error = error instanceof Error ? error.message : 'Unknown error';
      this.activeSessions.set(session.id, session);

      this.logger.error('Background QC execution failed', {
        sessionId: session.id,
        checklistId: session.checklistId,
        error: session.error
      });
    }
  }

  // ============================================================================
  // VALIDATION MIDDLEWARE
  // ============================================================================

  private validateExecuteQC() {
    return [
      body('checklistId').notEmpty().withMessage('Checklist ID is required'),
      body('targetId').notEmpty().withMessage('Target ID is required'),
      body('documentData').isObject().withMessage('Document data must be an object'),
      body('executionMode').optional().isIn(Object.values(QCExecutionMode))
    ];
  }

  private validateExecuteQCAsync() {
    return this.validateExecuteQC();
  }

  private validateBatchExecuteQC() {
    return [
      body('requests').isArray().withMessage('Requests must be an array'),
      body('requests.*.checklistId').notEmpty().withMessage('Each request must have a checklist ID'),
      body('requests.*.targetId').notEmpty().withMessage('Each request must have a target ID'),
      body('requests.*.documentData').isObject().withMessage('Each request must have document data')
    ];
  }

  private validateGetExecutionStatus() {
    return [
      param('sessionId').notEmpty().withMessage('Session ID is required')
    ];
  }

  private validateGetExecutionProgress() {
    return [
      param('sessionId').notEmpty().withMessage('Session ID is required')
    ];
  }

  private validateGetExecutionResults() {
    return [
      param('sessionId').notEmpty().withMessage('Session ID is required')
    ];
  }

  private validateGetExecutionSessions() {
    return [
      query('limit').optional().isInt({ min: 1, max: 200 }),
      query('offset').optional().isInt({ min: 0 })
    ];
  }

  private validateCancelExecution() {
    return [
      param('sessionId').notEmpty().withMessage('Session ID is required')
    ];
  }

  private validatePreviewExecution() {
    return [
      body('checklistId').notEmpty().withMessage('Checklist ID is required'),
      body('documentData').isObject().withMessage('Document data must be an object')
    ];
  }

  private validateExecutionConfig() {
    return [
      body('mode').isIn(Object.values(QCExecutionMode)).withMessage('Invalid execution mode')
    ];
  }

  private validateGetExecutionHistory() {
    return [
      query('limit').optional().isInt({ min: 1, max: 500 }),
      query('offset').optional().isInt({ min: 0 })
    ];
  }

  private validateGetExecutionAnalytics() {
    return [
      query('timeRange').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid time range')
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

  private generateSessionId(): string {
    return `qc_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getTotalQuestions(checklist: any): number {
    return checklist.categories.reduce((total: number, category: any) => 
      total + category.subcategories.reduce((subTotal: number, subcategory: any) => 
        subTotal + subcategory.questions.length, 0), 0);
  }

  private estimateExecutionTime(checklist: any): number {
    const totalQuestions = this.getTotalQuestions(checklist);
    // Estimate 2-5 seconds per question based on complexity
    return totalQuestions * 3500; // 3.5 seconds average
  }

  private analyzeDataAvailability(checklist: any, documentData: any): any {
    // Analyze which checklist requirements can be satisfied by available data
    const analysis = {
      availableFields: Object.keys(documentData || {}),
      missingFields: [],
      dataCompleteness: 0
    };

    // This would include more sophisticated analysis
    analysis.dataCompleteness = analysis.availableFields.length > 0 ? 85 : 0;

    return analysis;
  }

  private hasChecklistExecuteAccess(user: any, checklist: any): boolean {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'system') return true;
    if (checklist.clientId && user.clientId && checklist.clientId === user.clientId) return true;
    if (checklist.organizationId && user.organizationId && checklist.organizationId === user.organizationId) return true;
    return false;
  }

  private hasSessionAccess(user: any, session: QCExecutionSession): boolean {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'system') return true;
    if (session.executedBy === user.id) return true;
    // Add additional access logic as needed
    return false;
  }

  private calculateAverageExecutionTime(sessions: QCExecutionSession[]): number {
    if (sessions.length === 0) return 0;
    const totalTime = sessions.reduce((sum, session) => {
      if (session.completedAt) {
        return sum + (session.completedAt.getTime() - session.startedAt.getTime());
      }
      return sum;
    }, 0);
    return Math.round(totalTime / sessions.length);
  }

  private calculateAverageScore(sessions: QCExecutionSession[]): number {
    if (sessions.length === 0) return 0;
    const scores = sessions
      .filter(s => s.results?.summary?.overallScore !== undefined)
      .map(s => s.results!.summary.overallScore);
    
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100;
  }

  private calculateScoreDistribution(sessions: QCExecutionSession[]): any {
    const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
    
    sessions.forEach(session => {
      const score = session.results?.summary?.overallScore;
      if (score !== undefined) {
        if (score >= 90) distribution.excellent++;
        else if (score >= 80) distribution.good++;
        else if (score >= 70) distribution.fair++;
        else distribution.poor++;
      }
    });

    return distribution;
  }

  private identifyCommonIssues(sessions: QCExecutionSession[]): any[] {
    const issueMap = new Map<string, number>();

    sessions.forEach(session => {
      session.results?.categoryResults?.forEach(categoryResult => {
        categoryResult.issues?.forEach(issue => {
          const issueKey = `${issue.category}_${issue.type}`;
          issueMap.set(issueKey, (issueMap.get(issueKey) || 0) + 1);
        });
      });
    });

    return Array.from(issueMap.entries())
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 10)
      .map(([issueKey, count]) => ({ issue: issueKey, occurrences: count }));
  }

  private getMostUsedChecklists(sessions: QCExecutionSession[]): any[] {
    const checklistMap = new Map<string, number>();

    sessions.forEach(session => {
      checklistMap.set(session.checklistId, (checklistMap.get(session.checklistId) || 0) + 1);
    });

    return Array.from(checklistMap.entries())
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 10)
      .map(([checklistId, count]) => ({ checklistId, usageCount: count }));
  }

  private getChecklistPerformance(sessions: QCExecutionSession[]): any[] {
    const performanceMap = new Map<string, { scores: number[], executionTimes: number[] }>();

    sessions.forEach(session => {
      if (session.results?.summary?.overallScore !== undefined && session.completedAt) {
        if (!performanceMap.has(session.checklistId)) {
          performanceMap.set(session.checklistId, { scores: [], executionTimes: [] });
        }
        
        const perf = performanceMap.get(session.checklistId)!;
        perf.scores.push(session.results.summary.overallScore);
        perf.executionTimes.push(session.completedAt.getTime() - session.startedAt.getTime());
      }
    });

    return Array.from(performanceMap.entries()).map(([checklistId, data]) => ({
      checklistId,
      averageScore: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
      averageExecutionTime: data.executionTimes.reduce((sum, time) => sum + time, 0) / data.executionTimes.length,
      executionCount: data.scores.length
    }));
  }

  private groupExecutionsByDay(sessions: QCExecutionSession[]): any[] {
    const dayMap = new Map<string, number>();

    sessions.forEach(session => {
      const day = session.startedAt.toISOString().split('T')[0];
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    });

    return Array.from(dayMap.entries())
      .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
      .map(([day, count]) => ({ date: day, executions: count }));
  }

  private groupScoresByDay(sessions: QCExecutionSession[]): any[] {
    const dayMap = new Map<string, number[]>();

    sessions.forEach(session => {
      if (session.results?.summary?.overallScore !== undefined) {
        const day = session.startedAt.toISOString().split('T')[0];
        if (!dayMap.has(day)) {
          dayMap.set(day, []);
        }
        dayMap.get(day)!.push(session.results.summary.overallScore);
      }
    });

    return Array.from(dayMap.entries())
      .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
      .map(([day, scores]) => ({
        date: day,
        averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
      }));
  }

  private calculateCutoffDate(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Get the router instance
   */
  public getRouter(): Router {
    return this.router;
  }
}

// Create and export router instance
export const qcExecutionRouter = new QCExecutionController().getRouter();