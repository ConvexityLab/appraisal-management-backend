/**
 * Final Working API Server
 * Only includes endpoints that work without external dependencies
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
import { body, validationResult } from 'express-validator';

// Import only the dynamic code service (doesn't need external APIs)
import { DynamicCodeExecutionService } from '../services/dynamic-code-execution.service';

interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export class WorkingAPIServer {
  private app: express.Application;
  private dynamicCodeService: DynamicCodeExecutionService;
  private port: number;

  constructor(port = 3000) {
    this.app = express();
    this.port = port;
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
    // Health check - always works
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          dynamicCodeExecution: 'active',
          authentication: 'demo-mode'
        },
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // API info endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Appraisal Management API - Working Core',
        version: '1.0.0',
        description: 'Core functionality without external dependencies',
        endpoints: {
          'GET /health': 'System health check',
          'POST /api/auth/login': 'User authentication (demo)',
          'POST /api/code/execute': 'Dynamic code execution',
          'GET /api': 'This endpoint'
        },
        demoCredentials: {
          email: 'demo@example.com',
          password: 'demo123'
        }
      });
    });

    // Simple authentication (demo mode - no database needed)
    this.app.post('/api/auth/login', this.validateLogin(), this.login.bind(this));

    // Dynamic Code Execution (core functionality)
    this.app.post('/api/code/execute',
      this.authenticateToken.bind(this),
      this.validateCodeExecution(),
      this.executeCode.bind(this)
    );

    // Placeholder for future property intelligence (when APIs are configured)
    this.app.post('/api/property/placeholder', this.authenticateToken.bind(this), (req, res) => {
      res.json({
        message: 'Property intelligence endpoints available when Google Maps API is configured',
        status: 'pending_configuration',
        requiredEnvVars: ['GOOGLE_MAPS_API_KEY']
      });
    });
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
        method: req.method,
        availableEndpoints: ['/health', '/api', '/api/auth/login', '/api/code/execute']
      });
    });
  }

  // Authentication (demo implementation)
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
      body('password').isLength({ min: 3 }),
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
      
      // Demo authentication - no database required
      if (email === 'demo@example.com' && password === 'demo123') {
        const token = jwt.sign(
          {
            id: '1',
            email,
            role: 'admin',
            permissions: ['code_execute', 'property_intelligence']
          },
          process.env.JWT_SECRET || 'demo-secret',
          { expiresIn: '24h' }
        );

        res.json({
          success: true,
          token,
          user: { id: '1', email, role: 'admin' },
          expiresIn: '24h',
          message: 'Demo authentication successful'
        });
      } else {
        res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
          hint: 'Use demo@example.com / demo123'
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
        timestamp: new Date().toISOString(),
        codeLength: code.length
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
        console.log(`\n🚀 Working API Server Started Successfully!`);
        console.log(`📡 Port: ${this.port}`);
        console.log(`❤️  Health: http://localhost:${this.port}/health`);
        console.log(`📚 API Info: http://localhost:${this.port}/api`);
        console.log(`\n✅ Available Endpoints:`);
        console.log(`   POST /api/auth/login - Demo authentication`);
        console.log(`   POST /api/code/execute - Dynamic code execution`);
        console.log(`\n🔑 Demo Credentials:`);
        console.log(`   Email: demo@example.com`);
        console.log(`   Password: demo123`);
        console.log(`\n🎯 This server includes only working functionality`);
        console.log(`   No external API dependencies required!`);
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

export default WorkingAPIServer;