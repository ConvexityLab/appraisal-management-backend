/**
 * QC API Validation Middleware
 * Comprehensive request validation, authentication, and error handling for QC API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from '../utils/logger';
import { createApiError } from '../utils/api-response.util';
import {
  QCExecutionMode,
  QCExecutionStatus,
  RiskLevel,
  ComplianceStatus,
  QCDecision
} from '../types/qc-management';

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

export interface QCApiConfig {
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests?: boolean;
  };
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    optionsSuccessStatus: number;
  };
  security: {
    enableHelmet: boolean;
    contentSecurityPolicy?: boolean;
    crossOriginEmbedderPolicy?: boolean;
  };
  validation: {
    strictMode: boolean;
    sanitizeInput: boolean;
    maxPayloadSize: string;
  };
}

export class QCApiValidationMiddleware {
  private logger: Logger;
  private config: QCApiConfig;

  constructor(config?: Partial<QCApiConfig>) {
    this.logger = new Logger('QCApiValidationMiddleware');
    this.config = {
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100, // 100 requests per window
        skipSuccessfulRequests: true
      },
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
        optionsSuccessStatus: 200
      },
      security: {
        enableHelmet: true,
        contentSecurityPolicy: false, // Disable for API-only usage
        crossOriginEmbedderPolicy: false
      },
      validation: {
        strictMode: true,
        sanitizeInput: true,
        maxPayloadSize: '10mb'
      },
      ...config
    };
  }

  // ============================================================================
  // SECURITY MIDDLEWARE
  // ============================================================================

  /**
   * Get security headers middleware (Helmet)
   */
  public getSecurityMiddleware() {
    if (!this.config.security.enableHelmet) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return helmet({
      contentSecurityPolicy: this.config.security.contentSecurityPolicy,
      crossOriginEmbedderPolicy: this.config.security.crossOriginEmbedderPolicy,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      }
    });
  }

  /**
   * Get CORS middleware
   */
  public getCorsMiddleware() {
    return cors({
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials,
      optionsSuccessStatus: this.config.cors.optionsSuccessStatus,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-client-id']
    });
  }

  /**
   * Get rate limiting middleware
   */
  public getRateLimitMiddleware() {
    return rateLimit({
      windowMs: this.config.rateLimiting.windowMs,
      max: this.config.rateLimiting.maxRequests,
      skipSuccessfulRequests: this.config.rateLimiting.skipSuccessfulRequests,
      message: {
        success: false,
        error: createApiError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later')
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl
        });
        
        res.status(429).json({
          success: false,
          error: createApiError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later')
        });
      }
    });
  }

  // ============================================================================
  // AUTHENTICATION MIDDLEWARE
  // ============================================================================

  /**
   * JWT Authentication middleware
   */
  public authenticateJWT() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
          return res.status(401).json({
            success: false,
            error: createApiError('AUTHENTICATION_REQUIRED', 'Authentication token required')
          });
        }

        // Mock JWT validation - replace with actual JWT verification
        const user = await this.validateJWT(token);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            error: createApiError('INVALID_TOKEN', 'Invalid or expired authentication token')
          });
        }

        req.user = user;
        next();

      } catch (error) {
        this.logger.error('Authentication failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          endpoint: req.originalUrl
        });

        res.status(401).json({
          success: false,
          error: createApiError('AUTHENTICATION_FAILED', 'Authentication failed')
        });
      }
    };
  }

  /**
   * API Key authentication middleware
   */
  public authenticateApiKey() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;

        if (!apiKey) {
          return res.status(401).json({
            success: false,
            error: createApiError('API_KEY_REQUIRED', 'API key required')
          });
        }

        const user = await this.validateApiKey(apiKey);
        
        if (!user) {
          return res.status(401).json({
            success: false,
            error: createApiError('INVALID_API_KEY', 'Invalid API key')
          });
        }

        req.user = user;
        next();

      } catch (error) {
        this.logger.error('API key authentication failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          endpoint: req.originalUrl
        });

        res.status(401).json({
          success: false,
          error: createApiError('API_KEY_AUTHENTICATION_FAILED', 'API key authentication failed')
        });
      }
    };
  }

  /**
   * Optional authentication middleware (allows both authenticated and anonymous access)
   */
  public optionalAuth() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'] as string;

        if (authHeader) {
          const token = authHeader.split(' ')[1];
          if (token) {
            req.user = await this.validateJWT(token);
          }
        } else if (apiKey) {
          req.user = await this.validateApiKey(apiKey);
        }

        // Continue regardless of authentication status
        next();

      } catch (error) {
        // Log error but continue without authentication
        this.logger.debug('Optional authentication failed, continuing without auth', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        next();
      }
    };
  }

  // ============================================================================
  // AUTHORIZATION MIDDLEWARE
  // ============================================================================

  /**
   * Role-based authorization middleware
   */
  public requireRole(roles: string | string[]) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: createApiError('AUTHENTICATION_REQUIRED', 'Authentication required')
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        this.logger.warn('Access denied - insufficient role', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          error: createApiError('INSUFFICIENT_PERMISSIONS', `Required role: ${allowedRoles.join(' or ')}`)
        });
      }

      next();
    };
  }

  /**
   * Permission-based authorization middleware
   */
  public requirePermission(permissions: string | string[]) {
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: createApiError('AUTHENTICATION_REQUIRED', 'Authentication required')
        });
      }

      const hasPermission = requiredPermissions.some(permission =>
        req.user!.permissions.includes(permission)
      );

      if (!hasPermission) {
        this.logger.warn('Access denied - insufficient permissions', {
          userId: req.user.id,
          userPermissions: req.user.permissions,
          requiredPermissions,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          error: createApiError('INSUFFICIENT_PERMISSIONS', `Required permission: ${requiredPermissions.join(' or ')}`)
        });
      }

      next();
    };
  }

  /**
   * Organization/Client access control
   */
  public requireOrganizationAccess() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: createApiError('AUTHENTICATION_REQUIRED', 'Authentication required')
        });
      }

      const organizationId = req.params.organizationId || req.body.organizationId || req.query.organizationId;
      const clientId = req.params.clientId || req.body.clientId || req.query.clientId;

      // System admin has access to all organizations/clients
      if (req.user.role === 'admin' || req.user.role === 'system') {
        return next();
      }

      // Check organization access
      if (organizationId && req.user.organizationId !== organizationId) {
        return res.status(403).json({
          success: false,
          error: createApiError('ORGANIZATION_ACCESS_DENIED', 'Access denied to this organization')
        });
      }

      // Check client access
      if (clientId && req.user.clientId !== clientId) {
        return res.status(403).json({
          success: false,
          error: createApiError('CLIENT_ACCESS_DENIED', 'Access denied to this client')
        });
      }

      next();
    };
  }

  // ============================================================================
  // VALIDATION MIDDLEWARE
  // ============================================================================

  /**
   * Input sanitization middleware
   */
  public sanitizeInput() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.validation.sanitizeInput) {
        return next();
      }

      try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeObject(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          req.query = this.sanitizeObject(req.query);
        }

        next();
      } catch (error) {
        this.logger.error('Input sanitization failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(400).json({
          success: false,
          error: createApiError('INPUT_SANITIZATION_FAILED', 'Invalid input data')
        });
      }
    };
  }

  /**
   * Generic validation error handler
   */
  public handleValidationErrors() {
    return (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const validationErrors = errors.array().map(error => ({
          field: (error as any).param || (error as any).path || 'unknown',
          message: error.msg,
          value: (error as any).value || 'unknown'
        }));

        this.logger.debug('Validation errors', {
          errors: validationErrors,
          endpoint: req.originalUrl
        });

        return res.status(400).json({
          success: false,
          error: createApiError('VALIDATION_ERROR', 'Request validation failed', {
            validationErrors
          })
        });
      }

      next();
    };
  }

  // ============================================================================
  // QC-SPECIFIC VALIDATORS
  // ============================================================================

  /**
   * QC Checklist validation rules
   */
  public validateQCChecklistRequest() {
    return [
      body('name')
        .notEmpty()
        .withMessage('Checklist name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Checklist name must be 3-100 characters'),
      
      body('documentType')
        .notEmpty()
        .withMessage('Document type is required')
        .isIn(['appraisal', 'inspection', 'review', 'analysis'])
        .withMessage('Invalid document type'),

      body('categories')
        .isArray()
        .withMessage('Categories must be an array')
        .notEmpty()
        .withMessage('At least one category is required'),

      body('categories.*.name')
        .notEmpty()
        .withMessage('Category name is required'),

      body('categories.*.subcategories')
        .isArray()
        .withMessage('Subcategories must be an array'),

      body('version')
        .optional()
        .isString()
        .withMessage('Version must be a string'),

      body('isTemplate')
        .optional()
        .isBoolean()
        .withMessage('isTemplate must be a boolean'),

      body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean')
    ];
  }

  /**
   * QC Execution validation rules
   */
  public validateQCExecutionRequest() {
    return [
      body('checklistId')
        .notEmpty()
        .withMessage('Checklist ID is required')
        .isUUID()
        .withMessage('Invalid checklist ID format'),

      body('targetId')
        .notEmpty()
        .withMessage('Target ID is required')
        .isString()
        .withMessage('Target ID must be a string'),

      body('documentData')
        .isObject()
        .withMessage('Document data must be an object')
        .notEmpty()
        .withMessage('Document data cannot be empty'),

      body('executionMode')
        .optional()
        .isIn(Object.values(QCExecutionMode))
        .withMessage('Invalid execution mode'),

      body('executionConfig')
        .optional()
        .isObject()
        .withMessage('Execution config must be an object'),

      body('executionConfig.aiConfig.temperature')
        .optional()
        .isFloat({ min: 0, max: 2 })
        .withMessage('AI temperature must be between 0 and 2'),

      body('executionConfig.aiConfig.maxTokens')
        .optional()
        .isInt({ min: 1, max: 8000 })
        .withMessage('Max tokens must be between 1 and 8000')
    ];
  }

  /**
   * QC Results query validation rules
   */
  public validateQCResultsQuery() {
    return [
      query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),

      query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be 0 or greater'),

      query('sortBy')
        .optional()
        .isIn(['startedAt', 'completedAt', 'score', 'status', 'riskLevel'])
        .withMessage('Invalid sort field'),

      query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc'),

      query('status')
        .optional()
        .isIn(Object.values(QCExecutionStatus))
        .withMessage('Invalid execution status'),

      query('riskLevel')
        .optional()
        .isIn(Object.values(RiskLevel))
        .withMessage('Invalid risk level'),

      query('complianceStatus')
        .optional()
        .isIn(Object.values(ComplianceStatus))
        .withMessage('Invalid compliance status'),

      query('minScore')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Min score must be between 0 and 100'),

      query('maxScore')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Max score must be between 0 and 100'),

      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),

      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date')
    ];
  }

  /**
   * Report generation validation rules
   */
  public validateReportGeneration() {
    return [
      body('title')
        .notEmpty()
        .withMessage('Report title is required')
        .isLength({ min: 3, max: 200 })
        .withMessage('Report title must be 3-200 characters'),

      body('description')
        .optional()
        .isString()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters'),

      body('format')
        .optional()
        .isIn(['json', 'csv', 'excel', 'pdf'])
        .withMessage('Invalid report format'),

      body('filters')
        .isObject()
        .withMessage('Filters must be an object'),

      body('includeCharts')
        .optional()
        .isBoolean()
        .withMessage('includeCharts must be a boolean'),

      body('includeDetails')
        .optional()
        .isBoolean()
        .withMessage('includeDetails must be a boolean')
    ];
  }

  // ============================================================================
  // ERROR HANDLING MIDDLEWARE
  // ============================================================================

  /**
   * Global error handler
   */
  public errorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error', {
        error: error.message || 'Unknown error',
        stack: error.stack,
        endpoint: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: createApiError('VALIDATION_ERROR', 'Request validation failed', 
            isDevelopment ? { details: error.message } : undefined
          )
        });
      }

      if (error.name === 'UnauthorizedError') {
        return res.status(401).json({
          success: false,
          error: createApiError('UNAUTHORIZED', 'Authentication failed')
        });
      }

      if (error.name === 'ForbiddenError') {
        return res.status(403).json({
          success: false,
          error: createApiError('FORBIDDEN', 'Access denied')
        });
      }

      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          error: createApiError('SERVICE_UNAVAILABLE', 'External service unavailable')
        });
      }

      // Default server error
      res.status(500).json({
        success: false,
        error: createApiError('INTERNAL_SERVER_ERROR', 
          isDevelopment ? error.message : 'Internal server error',
          isDevelopment ? { stack: error.stack } : undefined
        )
      });
    };
  }

  /**
   * 404 Not Found handler
   */
  public notFoundHandler() {
    return (req: Request, res: Response) => {
      this.logger.debug('Endpoint not found', {
        endpoint: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(404).json({
        success: false,
        error: createApiError('ENDPOINT_NOT_FOUND', `Endpoint ${req.method} ${req.originalUrl} not found`)
      });
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Mock JWT validation (replace with actual implementation)
   */
  private async validateJWT(token: string): Promise<any> {
    try {
      // Mock implementation - replace with actual JWT verification
      // const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      
      // For demo purposes, return a mock user
      if (token === 'valid-token') {
        return {
          id: 'user-123',
          email: 'user@example.com',
          role: 'user',
          permissions: ['qc:read', 'qc:execute'],
          organizationId: 'org-123',
          clientId: 'client-123'
        };
      }
      
      return null;
    } catch (error) {
      this.logger.debug('JWT validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Mock API key validation (replace with actual implementation)
   */
  private async validateApiKey(apiKey: string): Promise<any> {
    try {
      // Mock implementation - replace with actual API key validation
      // const keyInfo = await this.apiKeyService.validate(apiKey);
      
      // For demo purposes, return a mock user for valid API keys
      if (apiKey.startsWith('qc-api-')) {
        return {
          id: 'api-user-123',
          email: 'api@example.com',
          role: 'api',
          permissions: ['qc:read', 'qc:execute', 'qc:admin'],
          organizationId: 'org-123',
          clientId: 'client-123'
        };
      }
      
      return null;
    } catch (error) {
      this.logger.debug('API key validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip potentially dangerous keys
        if (key.startsWith('__') || key.includes('prototype')) {
          continue;
        }
        sanitized[key] = this.sanitizeObject(value);
      }
      return sanitized;
    }
    
    if (typeof obj === 'string') {
      // Basic HTML/Script tag removal
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    
    return obj;
  }

  /**
   * Create middleware pipeline for QC API routes
   */
  public createQCApiPipeline() {
    return [
      this.getSecurityMiddleware(),
      this.getCorsMiddleware(),
      this.getRateLimitMiddleware(),
      this.sanitizeInput()
    ];
  }

  /**
   * Create authenticated pipeline for protected routes
   */
  public createAuthenticatedPipeline(options: {
    authType?: 'jwt' | 'apikey' | 'both';
    roles?: string[];
    permissions?: string[];
    requireOrganization?: boolean;
  } = {}) {
    const pipeline = [...this.createQCApiPipeline()];

    // Add authentication
    if (options.authType === 'apikey') {
      pipeline.push(this.authenticateApiKey());
    } else if (options.authType === 'both') {
      // Custom middleware to handle both JWT and API key
      pipeline.push(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'];

        if (authHeader) {
          return this.authenticateJWT()(req, res, next);
        } else if (apiKey) {
          return this.authenticateApiKey()(req, res, next);
        } else {
          return res.status(401).json({
            success: false,
            error: createApiError('AUTHENTICATION_REQUIRED', 'JWT token or API key required')
          });
        }
      });
    } else {
      // Default to JWT
      pipeline.push(this.authenticateJWT());
    }

    // Add role-based authorization
    if (options.roles && options.roles.length > 0) {
      pipeline.push(this.requireRole(options.roles));
    }

    // Add permission-based authorization
    if (options.permissions && options.permissions.length > 0) {
      pipeline.push(this.requirePermission(options.permissions));
    }

    // Add organization access control
    if (options.requireOrganization) {
      pipeline.push(this.requireOrganizationAccess());
    }

    return pipeline;
  }
}

// Create default instance with environment-based configuration
export const qcApiValidation = new QCApiValidationMiddleware({
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL === 'true'
  },
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
    optionsSuccessStatus: 200
  },
  security: {
    enableHelmet: process.env.ENABLE_HELMET !== 'false',
    contentSecurityPolicy: process.env.CSP_ENABLED === 'true',
    crossOriginEmbedderPolicy: process.env.COEP_ENABLED === 'true'
  },
  validation: {
    strictMode: process.env.VALIDATION_STRICT_MODE !== 'false',
    sanitizeInput: process.env.SANITIZE_INPUT !== 'false',
    maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '10mb'
  }
});

// Export individual middleware functions for convenience
export const {
  authenticateJWT,
  authenticateApiKey,
  optionalAuth,
  requireRole,
  requirePermission,
  requireOrganizationAccess,
  sanitizeInput,
  handleValidationErrors,
  validateQCChecklistRequest,
  validateQCExecutionRequest,
  validateQCResultsQuery,
  validateReportGeneration,
  errorHandler,
  notFoundHandler,
  createQCApiPipeline,
  createAuthenticatedPipeline
} = qcApiValidation;