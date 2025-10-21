/**
 * Minimal API Server - Core Functionality Only
 * Focuses on property intelligence and dynamic code execution
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Import only working services
import { EnhancedPropertyIntelligenceController } from '../controllers/enhanced-property-intelligence.controller';
import { DynamicCodeExecutionService } from '../services/dynamic-code-execution.service';

interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export class MinimalAPIServer {
  private app: express.Application;
  private propertyIntelligenceController: EnhancedPropertyIntelligenceController;
  private dynamicCodeService: DynamicCodeExecutionService;
  private port: number;

  constructor(port = 3000) {
    this.app = express();
    this.port = port;
    this.propertyIntelligenceController = new EnhancedPropertyIntelligenceController();
    this.dynamicCodeService = new DynamicCodeExecutionService();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' }
    });
    this.app.use('/api/', limiter);

    this.app.use(compression());
    this.app.use(morgan('combined'));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          propertyIntelligence: 'active',
          dynamicCodeExecution: 'active'
        }
      });
    });

    // Simple authentication (for demo purposes)
    this.app.post('/api/auth/login', this.validateLogin(), this.login.bind(this));

    // Property Intelligence routes (working)
    this.app.post('/api/property-intelligence/address/geocode',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.geocodeAddress
    );

    this.app.post('/api/property-intelligence/analyze/comprehensive',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.comprehensiveAnalysis
    );

    this.app.get('/api/property-intelligence/health',
      this.propertyIntelligenceController.healthCheck
    );

    // Dynamic Code Execution (working)
    this.app.post('/api/code/execute',
      this.authenticateToken.bind(this),
      this.validateCodeExecution(),
      this.executeCode.bind(this)
    );
  }

  private setupErrorHandling(): void {
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('API Error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    });

    this.app.use((req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: req.path,
        method: req.method
      });
    });
  }

  // Authentication middleware
  private authenticateToken(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Access token required', code: 'TOKEN_REQUIRED' });
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-secret') as any;
      req.user = decoded;
      next();
    } catch (error) {
      res.status(403).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
    }
  }

  // Validation middleware
  private validateLogin() {
    return [
      body('email').isEmail().normalizeEmail(),
      body('password').isLength({ min: 6 }),
      this.handleValidationErrors
    ];
  }

  private validateCodeExecution() {
    return [
      body('code').isLength({ min: 1, max: 10000 }).trim(),
      body('context').isObject().optional(),
      body('timeout').isInt({ min: 100, max: 30000 }).optional(),
      this.handleValidationErrors
    ];
  }

  private handleValidationErrors(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
      return;
    }
    next();
  }

  // Route handlers
  private async login(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email, password } = req.body;
      
      // Simple demo user validation
      if (email === 'demo@example.com' && password === 'demo123') {
        const token = jwt.sign(
          {
            id: '1',
            email,
            role: 'admin',
            permissions: ['property_intelligence', 'code_execute']
          },
          process.env.JWT_SECRET || 'demo-secret',
          { expiresIn: '24h' }
        );

        res.json({
          token,
          user: { id: '1', email, role: 'admin' },
          expiresIn: '24h'
        });
      } else {
        res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }

  private async executeCode(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { code, context = {}, timeout = 5000 } = req.body;
      
      const executionContext = {
        event: context.event || {},
        context: context.context || {},
        rule: context.rule || {},
        timestamp: new Date(),
        user: req.user,
        utils: {
          date: Date,
          math: Math,
          json: JSON,
          regex: RegExp,
          console: {
            log: console.log,
            warn: console.warn,
            error: console.error
          }
        }
      };

      const result = await this.dynamicCodeService.executeCode(code, executionContext, {
        timeout
      });

      res.json({
        success: result.success,
        result: result.result,
        executionTime: result.executionTime,
        error: result.error,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Code execution failed',
        code: 'CODE_EXECUTION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  public async start(): Promise<void> {
    try {
      this.app.listen(this.port, () => {
        console.log(`🚀 Minimal API Server running on port ${this.port}`);
        console.log(`❤️  Health check: http://localhost:${this.port}/health`);
        console.log(`🏠 Property Intelligence APIs available`);
        console.log(`⚡ Dynamic Code Execution available`);
        console.log(`\n📋 Demo credentials: demo@example.com / demo123`);
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  public getExpressApp(): express.Application {
    return this.app;
  }
}

export default MinimalAPIServer;