import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createOrderRouter } from './controllers/order.controller.js';
import { AIMLController } from './controllers/aiml.controller.js';
import { Logger } from './utils/logger.js';
import { ApiError } from './types/index.js';

/**
 * Enterprise Appraisal Management System - API Server
 * Provides RESTful APIs for order intake, vendor management, and workflow automation
 */
class AppraisalManagementApp {
  private app: express.Application;
  private logger: Logger;
  private port: number;

  constructor() {
    this.app = express();
    this.logger = new Logger();
    this.port = parseInt(process.env.PORT || '3000');
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Initialize Express middleware
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-client-id']
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.info('HTTP Request', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      next();
    });

    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string || this.generateRequestId();
      req.headers['x-request-id'] = requestId;
      res.setHeader('x-request-id', requestId);
      next();
    });
  }

  /**
   * Initialize API routes
   */
  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // API documentation endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'Enterprise Appraisal Management System API',
        version: '1.0.0',
        description: 'RESTful API for comprehensive appraisal order management with AI automation',
        endpoints: {
          orders: {
            'POST /api/orders': 'Create a new appraisal order',
            'GET /api/orders': 'Get orders with filtering and pagination',
            'GET /api/orders/:id': 'Get order by ID',
            'PUT /api/orders/:id': 'Update an existing order',
            'DELETE /api/orders/:id': 'Cancel/delete an order',
            'POST /api/orders/:id/assign': 'Assign order to vendor',
            'GET /api/orders/:id/history': 'Get order audit history'
          },
          ai_ml: {
            'POST /api/ai/valuation/comprehensive': 'Comprehensive property valuation',
            'POST /api/ai/qc/comprehensive': 'AI-powered quality control',
            'GET /api/ai/portfolio/dashboard': 'Portfolio analytics dashboard',
            'POST /api/ai/agents/deploy': 'Deploy Perligo AI agents',
            'POST /api/ai/workflows/complete-analysis': 'Complete AI analysis workflow'
          },
          health: {
            'GET /health': 'System health check'
          }
        },
        features: [
          'Comprehensive order lifecycle management',
          'AI-powered vendor assignment',
          'Advanced valuation engine with ML models',
          'Automated quality control with AI analysis',
          'Portfolio analytics and predictive insights',
          'Real-time event notifications',
          'Comprehensive audit trails',
          'Production-ready Perligo AI agent integration',
          'Multi-layer quality control automation',
          'Advanced reporting and market intelligence'
        ]
      });
    });

    // Order management routes
    this.app.use('/api/orders', createOrderRouter());

    // AI/ML services routes
    const aimlController = new AIMLController();
    this.app.use('/api/ai', aimlController.initializeRoutes());

    // 404 handler for undefined routes
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Route ${req.method} ${req.originalUrl} not found`,
          timestamp: new Date()
        }
      });
    });
  }

  /**
   * Initialize error handling middleware
   */
  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string;
      
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        requestId,
        method: req.method,
        url: req.url
      });

      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      const apiError: ApiError = {
        code: 'INTERNAL_SERVER_ERROR',
        message: isDevelopment ? error.message : 'An internal server error occurred',
        timestamp: new Date(),
        ...(isDevelopment && { stack: error.stack })
      };

      res.status(500).json({
        success: false,
        error: apiError,
        requestId
      });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      this.logger.info('SIGTERM received, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      this.logger.info('SIGINT received, shutting down gracefully');
      this.shutdown();
    });

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled promise rejection', {
        reason: reason?.message || reason,
        promise: promise.toString()
      });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
  }

  /**
   * Start the Express server
   */
  public start(): void {
    const server = this.app.listen(this.port, () => {
      this.logger.info('🚀 Enterprise Appraisal Management System API started', {
        port: this.port,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      });
      
      this.logger.info('📋 Available endpoints:', {
        health: `http://localhost:${this.port}/health`,
        api: `http://localhost:${this.port}/api`,
        orders: `http://localhost:${this.port}/api/orders`
      });
      
      this.logger.info('🤖 AI Integration ready:', {
        perligo: 'Document analysis, workflow automation, quality assurance',
        azure: 'OpenAI integration for intelligent processing'
      });
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        this.logger.error(`Port ${this.port} is already in use`);
        process.exit(1);
      } else {
        this.logger.error('Server error', { error: error.message });
        process.exit(1);
      }
    });
  }

  /**
   * Graceful shutdown
   */
  private shutdown(): void {
    this.logger.info('Shutting down server...');
    process.exit(0);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get Express application instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}

// Start the application if this file is run directly
// Check if this module is the main module
if (process.argv[1] && process.argv[1].endsWith('app.js')) {
  const app = new AppraisalManagementApp();
  app.start();
}

export { AppraisalManagementApp };