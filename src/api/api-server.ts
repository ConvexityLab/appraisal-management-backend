/**
 * Comprehensive API Server for Appraisal Management Platform
 * Provides REST endpoints with authentication, validation, and comprehensive documentation
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { body, param, query, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Import our services
import { CosmosDbService } from '../services/cosmos-db.service';
import { EnhancedPropertyIntelligenceController } from '../controllers/enhanced-property-intelligence.controller';
import { AIServicesController } from '../controllers/ai-services.controller';
import { DynamicCodeExecutionService } from '../services/dynamic-code-execution.service';
import { Logger } from '../utils/logger';

// Import QC controllers and middleware
import { qcChecklistRouter } from '../controllers/criteria.controller';
import { qcExecutionRouter } from '../controllers/reviews.controller';
import { qcResultsRouter } from '../controllers/results.controller';

// Import Places API (New) controller
import enhancedPropertyIntelligenceV2Router from '../controllers/enhanced-property-intelligence-v2.controller';
import { 
  authenticateJWT, 
  requireRole, 
  sanitizeInput, 
  errorHandler
} from '../middleware/qc-api-validation.middleware';

interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export class AppraisalManagementAPIServer {
  private app: express.Application;
  private dbService: CosmosDbService;
  private propertyIntelligenceController: EnhancedPropertyIntelligenceController;
  private aiServicesController: AIServicesController;
  private dynamicCodeService: DynamicCodeExecutionService;
  private logger: Logger;
  private port: number;
  
  // QC routers
  private qcChecklistRouter: express.Router;
  private qcExecutionRouter: express.Router;
  private qcResultsRouter: express.Router;

  constructor(port = parseInt(process.env.PORT || '3000')) {
    this.app = express();
    this.port = port;
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.propertyIntelligenceController = new EnhancedPropertyIntelligenceController();
    this.aiServicesController = new AIServicesController();
    this.dynamicCodeService = new DynamicCodeExecutionService();
    
    // Initialize QC routers
    this.qcChecklistRouter = qcChecklistRouter;
    this.qcExecutionRouter = qcExecutionRouter;
    this.qcResultsRouter = qcResultsRouter;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    await this.dbService.initialize();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }));

    // Rate limiting - configurable for different environments
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // Default: 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Default: 100 requests per window
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    });
    this.app.use('/api/', limiter);

    // General middleware
    this.app.use(compression());
    this.app.use(morgan('combined'));
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // API documentation
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(this.getSwaggerSpec()));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', this.getHealthCheck.bind(this));

    // Authentication routes
    this.app.post('/api/auth/login', this.validateLogin(), this.login.bind(this));
    this.app.post('/api/auth/register', this.validateRegister(), this.register.bind(this));
    this.app.post('/api/auth/refresh', this.authenticateToken.bind(this), this.refreshToken.bind(this));

    // Order Management routes
    this.app.post('/api/orders', 
      this.authenticateToken.bind(this), 
      this.validateOrderCreation(), 
      this.createOrder.bind(this)
    );
    
    this.app.get('/api/orders', 
      this.authenticateToken.bind(this), 
      this.validateOrderQuery(),
      this.getOrders.bind(this)
    );
    
    this.app.get('/api/orders/:orderId', 
      this.authenticateToken.bind(this), 
      this.validateOrderId(),
      this.getOrder.bind(this)
    );
    
    this.app.put('/api/orders/:orderId/status', 
      this.authenticateToken.bind(this), 
      this.validateOrderId(),
      this.validateStatusUpdate(),
      this.updateOrderStatus.bind(this)
    );

    this.app.post('/api/orders/:orderId/deliver',
      this.authenticateToken.bind(this),
      this.validateOrderId(),
      this.validateDelivery(),
      this.deliverOrder.bind(this)
    );

    this.app.get('/api/orders/dashboard',
      this.authenticateToken.bind(this),
      this.getOrderDashboard.bind(this)
    );

    // QC Validation routes
    this.app.post('/api/qc/validate/:orderId',
      this.authenticateToken.bind(this),
      this.requirePermission('qc_validate'),
      this.validateOrderId(),
      this.performQCValidation.bind(this)
    );

    this.app.get('/api/qc/results/:orderId',
      this.authenticateToken.bind(this),
      this.validateOrderId(),
      this.getQCResults.bind(this)
    );

    this.app.get('/api/qc/metrics',
      this.authenticateToken.bind(this),
      this.requirePermission('qc_metrics'),
      this.getQCMetrics.bind(this)
    );

    // Vendor Management routes
    this.app.get('/api/vendors',
      this.authenticateToken.bind(this),
      this.getVendors.bind(this)
    );

    this.app.post('/api/vendors',
      this.authenticateToken.bind(this),
      this.requirePermission('vendor_manage'),
      this.validateVendorCreation(),
      this.createVendor.bind(this)
    );

    this.app.put('/api/vendors/:vendorId',
      this.authenticateToken.bind(this),
      this.requirePermission('vendor_manage'),
      this.validateVendorId(),
      this.validateVendorUpdate(),
      this.updateVendor.bind(this)
    );

    this.app.post('/api/vendors/assign/:orderId',
      this.authenticateToken.bind(this),
      this.requirePermission('vendor_assign'),
      this.validateOrderId(),
      this.assignVendor.bind(this)
    );

    this.app.get('/api/vendors/performance/:vendorId',
      this.authenticateToken.bind(this),
      this.validateVendorId(),
      this.getVendorPerformance.bind(this)
    );

    // Analytics routes
    this.app.get('/api/analytics/overview',
      this.authenticateToken.bind(this),
      this.requirePermission('analytics_view'),
      this.getAnalyticsOverview.bind(this)
    );

    this.app.get('/api/analytics/performance',
      this.authenticateToken.bind(this),
      this.requirePermission('analytics_view'),
      this.validateAnalyticsQuery(),
      this.getPerformanceAnalytics.bind(this)
    );

    // Property Intelligence routes
    this.app.post('/api/property-intelligence/address/geocode',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.geocodeAddress
    );

    this.app.post('/api/property-intelligence/address/validate',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.validateAddress
    );

    this.app.post('/api/property-intelligence/analyze/comprehensive',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.comprehensiveAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/creative',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.creativeFeatureAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/view',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.viewAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/transportation',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.transportationAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/neighborhood',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.neighborhoodAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/batch',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.batchAnalysis
    );

    this.app.get('/api/property-intelligence/census/demographics',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.getCensusDemographics
    );

    this.app.get('/api/property-intelligence/census/economics',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.getCensusEconomics
    );

    this.app.get('/api/property-intelligence/census/housing',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.getCensusHousing
    );

    this.app.get('/api/property-intelligence/census/comprehensive',
      this.authenticateToken.bind(this),
      this.propertyIntelligenceController.getComprehensiveCensusIntelligence
    );

    this.app.get('/api/property-intelligence/health',
      this.propertyIntelligenceController.healthCheck
    );

    // Property Intelligence V2 routes (Places API New)
    this.app.use('/api/property-intelligence-v2', 
      authenticateJWT, 
      enhancedPropertyIntelligenceV2Router
    );

    // Dynamic Code Execution routes
    this.app.post('/api/code/execute',
      this.authenticateToken.bind(this),
      this.requirePermission('code_execute'),
      this.validateCodeExecution(),
      this.executeCode.bind(this)
    );

    // AI Services routes
    this.app.post('/api/ai/qc/analyze',
      this.authenticateToken.bind(this),
      this.requirePermission('qc_validate'),
      this.aiServicesController.validateQCAnalysis(),
      this.aiServicesController.performQCAnalysis
    );

    this.app.post('/api/ai/qc/technical',
      this.authenticateToken.bind(this),
      this.requirePermission('qc_validate'),
      this.aiServicesController.validateQCAnalysis(),
      this.aiServicesController.performTechnicalQC
    );

    this.app.post('/api/ai/qc/compliance',
      this.authenticateToken.bind(this),
      this.requirePermission('qc_validate'),
      this.aiServicesController.validateQCAnalysis(),
      this.aiServicesController.performComplianceQC
    );

    this.app.post('/api/ai/market/insights',
      this.authenticateToken.bind(this),
      this.aiServicesController.validateMarketInsights(),
      this.aiServicesController.generateMarketInsights
    );

    this.app.post('/api/ai/property/description',
      this.authenticateToken.bind(this),
      this.aiServicesController.validateMarketInsights(),
      this.aiServicesController.generatePropertyDescription
    );

    this.app.post('/api/ai/vision/analyze',
      this.authenticateToken.bind(this),
      this.aiServicesController.validateImageAnalysis(),
      this.aiServicesController.analyzePropertyImages
    );

    this.app.post('/api/ai/vision/condition',
      this.authenticateToken.bind(this),
      this.aiServicesController.validateImageAnalysis(),
      this.aiServicesController.analyzePropertyCondition
    );

    this.app.post('/api/ai/embeddings',
      this.authenticateToken.bind(this),
      this.aiServicesController.validateEmbeddingGeneration(),
      this.aiServicesController.generateEmbeddings
    );

    this.app.post('/api/ai/completion',
      this.authenticateToken.bind(this),
      this.requirePermission('ai_generate'),
      this.aiServicesController.validateCompletion(),
      this.aiServicesController.generateCompletion
    );

    this.app.get('/api/ai/health',
      this.aiServicesController.getServiceHealth
    );

    this.app.get('/api/ai/usage',
      this.authenticateToken.bind(this),
      this.requirePermission('analytics_view'),
      this.aiServicesController.getUsageStats
    );

    // QC Management routes - comprehensive quality control system
    // Mount QC router modules with authentication
    this.app.use('/api/qc/checklists', 
      this.authenticateToken.bind(this),
      this.qcChecklistRouter
    );
    
    this.app.use('/api/qc/execution', 
      this.authenticateToken.bind(this),
      this.requirePermission('qc_execute'),
      this.qcExecutionRouter
    );
    
    this.app.use('/api/qc/results', 
      this.authenticateToken.bind(this),
      this.qcResultsRouter
    );
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
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        this.logger.error('JWT_SECRET environment variable is not configured');
        res.status(500).json({ 
          error: 'Authentication service misconfigured', 
          code: 'AUTH_MISCONFIGURED' 
        });
        return;
      }

      const decoded = jwt.verify(token, jwtSecret) as any;
      req.user = decoded;
      next();
    } catch (error) {
      res.status(403).json({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
    }
  }

  private requirePermission(permission: string) {
    return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void => {
      if (!req.user?.permissions.includes(permission)) {
        res.status(403).json({ 
          error: `Permission required: ${permission}`, 
          code: 'PERMISSION_DENIED' 
        });
        return;
      }
      next();
    };
  }

  // Validation middleware
  private validateLogin() {
    return [
      body('email').isEmail().normalizeEmail(),
      body('password').isLength({ min: 6 }),
      this.handleValidationErrors
    ];
  }

  private validateRegister() {
    return [
      body('email').isEmail().normalizeEmail(),
      body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
      body('firstName').isLength({ min: 1 }).trim(),
      body('lastName').isLength({ min: 1 }).trim(),
      body('role').isIn(['admin', 'manager', 'appraiser', 'qc_analyst']),
      this.handleValidationErrors
    ];
  }

  private validateOrderCreation() {
    return [
      body('propertyAddress').isLength({ min: 10 }).trim(),
      body('clientId').isUUID(),
      body('orderType').isIn(['purchase', 'refinance', 'heloc', 'other']),
      body('priority').isIn(['standard', 'rush', 'super_rush']).optional(),
      body('dueDate').isISO8601(),
      this.handleValidationErrors
    ];
  }

  private validateOrderId() {
    return [
      param('orderId').isUUID(),
      this.handleValidationErrors
    ];
  }

  private validateVendorId() {
    return [
      param('vendorId').isUUID(),
      this.handleValidationErrors
    ];
  }

  private validateOrderQuery() {
    return [
      query('status').isIn(['pending', 'assigned', 'in_progress', 'delivered', 'completed', 'cancelled']).optional(),
      query('priority').isIn(['standard', 'rush', 'super_rush']).optional(),
      query('limit').isInt({ min: 1, max: 100 }).optional(),
      query('offset').isInt({ min: 0 }).optional(),
      this.handleValidationErrors
    ];
  }

  private validateStatusUpdate() {
    return [
      body('status').isIn(['pending', 'assigned', 'in_progress', 'delivered', 'completed', 'cancelled']),
      body('notes').isLength({ max: 1000 }).optional(),
      this.handleValidationErrors
    ];
  }

  private validateDelivery() {
    return [
      body('reportUrl').isURL(),
      body('deliveryNotes').isLength({ max: 1000 }).optional(),
      this.handleValidationErrors
    ];
  }

  private validateVendorCreation() {
    return [
      body('name').isLength({ min: 2 }).trim(),
      body('email').isEmail().normalizeEmail(),
      body('phone').isMobilePhone('any'),
      body('serviceTypes').isArray({ min: 1 }),
      body('serviceAreas').isArray({ min: 1 }),
      this.handleValidationErrors
    ];
  }

  private validateVendorUpdate() {
    return [
      body('name').isLength({ min: 2 }).trim().optional(),
      body('email').isEmail().normalizeEmail().optional(),
      body('phone').isMobilePhone('any').optional(),
      body('serviceTypes').isArray({ min: 1 }).optional(),
      body('serviceAreas').isArray({ min: 1 }).optional(),
      body('isActive').isBoolean().optional(),
      this.handleValidationErrors
    ];
  }

  private validateAnalyticsQuery() {
    return [
      query('startDate').isISO8601().optional(),
      query('endDate').isISO8601().optional(),
      query('groupBy').isIn(['day', 'week', 'month']).optional(),
      this.handleValidationErrors
    ];
  }

  private validateCodeExecution() {
    return [
      body('code').isLength({ min: 1, max: 10000 }).trim(),
      body('context').isObject().optional(),
      body('timeout').isInt({ min: 100, max: 30000 }).optional(),
      body('memoryLimit').isInt({ min: 1024, max: 67108864 }).optional(), // 1KB to 64MB
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
  private async getHealthCheck(req: express.Request, res: express.Response): Promise<void> {
    try {
      const dbHealth = await this.dbService.healthCheck();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth.status,
          orderManagement: 'healthy',
          qcValidation: 'healthy',
          vendorManagement: 'healthy'
        },
        database: {
          name: dbHealth.database,
          latency: dbHealth.latency
        },
        version: '1.0.0'
      };
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async login(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email, password } = req.body;
      
      // In a real implementation, validate against database
      const user = await this.validateUserCredentials(email, password);
      
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        return;
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        res.status(500).json({ 
          error: 'Authentication service misconfigured', 
          code: 'AUTH_MISCONFIGURED' 
        });
        return;
      }

      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          permissions: user.permissions 
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async register(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, role } = req.body;
      
      // Check if user exists
      const existingUser = await this.findUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: 'User already exists', code: 'USER_EXISTS' });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user in database
      const user = await this.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role
      });

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        res.status(500).json({ 
          error: 'Authentication service misconfigured', 
          code: 'AUTH_MISCONFIGURED' 
        });
        return;
      }

      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          permissions: user.permissions 
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async refreshToken(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No user context', code: 'NO_USER_CONTEXT' });
        return;
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        res.status(500).json({ 
          error: 'Authentication service misconfigured', 
          code: 'AUTH_MISCONFIGURED' 
        });
        return;
      }

      const newToken = jwt.sign(
        { 
          id: req.user.id, 
          email: req.user.email, 
          role: req.user.role,
          permissions: req.user.permissions 
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      res.json({ token: newToken });
    } catch (error) {
      res.status(500).json({
        error: 'Token refresh failed',
        code: 'TOKEN_REFRESH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Order Management endpoints
  private async createOrder(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const orderData = {
        ...req.body,
        createdBy: req.user?.id,
        status: 'pending',
        priority: req.body.priority || 'standard'
      };

      const result = await this.dbService.createOrder(orderData);
      
      if (result.success) {
        res.status(201).json(result.data);
      } else {
        res.status(500).json({
          error: 'Order creation failed',
          code: 'ORDER_CREATION_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Order creation failed',
        code: 'ORDER_CREATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getOrders(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { status, priority, limit = 20, offset = 0 } = req.query;
      
      const filters: any = {};
      if (status) filters.status = [status as string];
      if (priority) filters.priority = [priority as string];

      const result = await this.dbService.findOrders(filters, parseInt(offset as string), parseInt(limit as string));
      
      if (result.success) {
        res.json({
          orders: result.data,
          pagination: result.metadata
        });
      } else {
        res.status(500).json({
          error: 'Failed to retrieve orders',
          code: 'ORDER_RETRIEVAL_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve orders',
        code: 'ORDER_RETRIEVAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getOrder(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      const result = await this.dbService.findOrderById(orderId);
      
      if (result.success && result.data) {
        res.json(result.data);
      } else if (result.success && !result.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
      } else {
        res.status(500).json({
          error: 'Failed to retrieve order',
          code: 'ORDER_RETRIEVAL_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve order',
        code: 'ORDER_RETRIEVAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async updateOrderStatus(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { status, notes } = req.body;

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      const result = await this.dbService.updateOrder(orderId, {});

      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({
          error: 'Failed to update order status',
          code: 'ORDER_UPDATE_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update order status',
        code: 'ORDER_UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async deliverOrder(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const { reportUrl, deliveryNotes } = req.body;

      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      const result = await this.dbService.updateOrder(orderId, {});

      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({
          error: 'Failed to deliver order',
          code: 'ORDER_DELIVERY_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to deliver order',
        code: 'ORDER_DELIVERY_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getOrderDashboard(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      // Get real dashboard data from database
      const [summaryResult, metricsResult, recentOrdersResult] = await Promise.allSettled([
        this.dbService.getOrderSummary(),
        this.dbService.getOrderMetrics(),
        this.dbService.getRecentOrders(10)
      ]);

      const dashboard = {
        summary: summaryResult.status === 'fulfilled' && summaryResult.value.success 
          ? summaryResult.value.data 
          : { totalOrders: 0, pendingOrders: 0, inProgressOrders: 0, completedOrders: 0 },
        
        metrics: metricsResult.status === 'fulfilled' && metricsResult.value.success
          ? metricsResult.value.data
          : { averageCompletionTime: 0, onTimeDeliveryRate: 0, qcPassRate: 0 },
          
        recentOrders: recentOrdersResult.status === 'fulfilled' && recentOrdersResult.value.success
          ? recentOrdersResult.value.data
          : []
      };

      res.json(dashboard);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve dashboard',
        code: 'DASHBOARD_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // QC Validation endpoints
  private async performQCValidation(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      const orderResult = await this.dbService.findOrderById(orderId);
      
      if (!orderResult.success || !orderResult.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
        return;
      }

      // Create mock QC validation result
      const qcResult = {
        orderId,
        qcScore: 94.5,
        validationResults: {
          marketValidation: {
            status: 'passed',
            score: 95.2,
            confidence: 'high'
          },
          riskAssessment: {
            status: 'passed',
            riskLevel: 'low',
            score: 93.8
          }
        },
        recommendations: [
          'Market data validates property value within acceptable range',
          'No significant risk factors identified'
        ],
        validatedBy: req.user?.id,
        validatedAt: new Date()
      };

      // Store QC result in database
      const saveResult = await this.dbService.createQCResult(qcResult);
      
      if (saveResult.success) {
        res.json(saveResult.data);
      } else {
        res.status(500).json({
          error: 'QC validation failed',
          code: 'QC_VALIDATION_ERROR',
          details: saveResult.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'QC validation failed',
        code: 'QC_VALIDATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getQCResults(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      const result = await this.dbService.findQCResultByOrderId(orderId);
      
      if (result.success && result.data) {
        res.json(result.data);
      } else if (result.success && !result.data) {
        res.status(404).json({ error: 'QC results not found', code: 'QC_RESULTS_NOT_FOUND' });
      } else {
        res.status(500).json({
          error: 'Failed to retrieve QC results',
          code: 'QC_RESULTS_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve QC results',
        code: 'QC_RESULTS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getQCMetrics(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const result = await this.dbService.getQCMetrics();
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({
          error: 'Failed to retrieve QC metrics',
          code: 'QC_METRICS_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve QC metrics',
        code: 'QC_METRICS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Vendor Management endpoints
  private async getVendors(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const result = await this.dbService.findAllVendors();
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({
          error: 'Failed to retrieve vendors',
          code: 'VENDOR_RETRIEVAL_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve vendors',
        code: 'VENDOR_RETRIEVAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async createVendor(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const vendorData = {
        ...req.body,
        createdBy: req.user?.id,
        status: 'active',
        licenseState: req.body.serviceAreas?.[0] || 'Unknown'
      };

      const result = await this.dbService.createVendor(vendorData);
      
      if (result.success) {
        res.status(201).json(result.data);
      } else {
        res.status(500).json({
          error: 'Vendor creation failed',
          code: 'VENDOR_CREATION_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Vendor creation failed',
        code: 'VENDOR_CREATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async updateVendor(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { vendorId } = req.params;
      
      if (!vendorId) {
        res.status(400).json({ error: 'Vendor ID is required', code: 'MISSING_VENDOR_ID' });
        return;
      }

      const updateData = {
        ...req.body,
        updatedBy: req.user?.id
      };

      const result = await this.dbService.updateVendor(vendorId, updateData);
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({
          error: 'Vendor update failed',
          code: 'VENDOR_UPDATE_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Vendor update failed',
        code: 'VENDOR_UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async assignVendor(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required', code: 'MISSING_ORDER_ID' });
        return;
      }

      const orderResult = await this.dbService.findOrderById(orderId);
      
      if (!orderResult.success || !orderResult.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
        return;
      }

      // Mock vendor assignment logic
      const vendorsResult = await this.dbService.findAllVendors();
      
      if (vendorsResult.success && vendorsResult.data && vendorsResult.data.length > 0) {
        const selectedVendor = vendorsResult.data[0]; // Simple assignment logic
        
        // Update order with assigned vendor
        const updateResult = await this.dbService.updateOrder(orderId, {});

        if (updateResult.success) {
          res.json({
            orderId,
            assignedVendor: selectedVendor,
            assignmentScore: 95.5,
            assignedAt: new Date()
          });
        } else {
          res.status(500).json({
            error: 'Failed to assign vendor',
            code: 'VENDOR_ASSIGNMENT_ERROR',
            details: updateResult.error
          });
        }
      } else {
        res.status(404).json({ error: 'No available vendors', code: 'NO_VENDORS_AVAILABLE' });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Vendor assignment failed',
        code: 'VENDOR_ASSIGNMENT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getVendorPerformance(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { vendorId } = req.params;
      
      if (!vendorId) {
        res.status(400).json({ error: 'Vendor ID is required', code: 'MISSING_VENDOR_ID' });
        return;
      }

      const result = await this.dbService.getVendorPerformance(vendorId);
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({
          error: 'Failed to retrieve vendor performance',
          code: 'VENDOR_PERFORMANCE_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve vendor performance',
        code: 'VENDOR_PERFORMANCE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Analytics endpoints
  private async getAnalyticsOverview(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const result = await this.dbService.getAnalyticsOverview();
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({
          error: 'Failed to retrieve analytics overview',
          code: 'ANALYTICS_OVERVIEW_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve analytics overview',
        code: 'ANALYTICS_OVERVIEW_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getPerformanceAnalytics(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      
      const result = await this.dbService.getPerformanceAnalytics({
        startDate: startDate as string,
        endDate: endDate as string,
        groupBy: groupBy as string
      });
      
      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({
          error: 'Failed to retrieve performance analytics',
          code: 'PERFORMANCE_ANALYTICS_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve performance analytics',
        code: 'PERFORMANCE_ANALYTICS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeCode(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const { 
        code, 
        context = {}, 
        timeout = parseInt(process.env.DYNAMIC_CODE_TIMEOUT || '5000'), 
        memoryLimit = parseInt(process.env.DYNAMIC_CODE_MEMORY_LIMIT || '16777216') 
      } = req.body;
      
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
            log: (message: string) => this.logger.info(message),
            warn: (message: string) => this.logger.warn(message),
            error: (message: string) => this.logger.error(message)
          }
        }
      };

      const result = await this.dynamicCodeService.executeCode(code, executionContext, {
        timeout,
        memoryLimit
      });

      res.json({
        success: result.success,
        result: result.result,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        error: result.error,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Code execution failed',
        code: 'CODE_EXECUTION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  // User management methods - integrated with Cosmos DB
  private async validateUserCredentials(email: string, password: string): Promise<any> {
    try {
      const userResult = await this.dbService.getUserByEmail(email);
      
      if (!userResult.success || !userResult.data) {
        return null;
      }

      const user = userResult.data;
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValidPassword) {
        return null;
      }

      // Return user without password hash
      const { passwordHash, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        permissions: this.getRolePermissions(user.role)
      };
    } catch (error) {
      this.logger.error('Error validating user credentials', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  private async findUserByEmail(email: string): Promise<any> {
    try {
      const userResult = await this.dbService.getUserByEmail(email);
      return userResult.success ? userResult.data : null;
    } catch (error) {
      this.logger.error('Error finding user by email', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  private async createUser(userData: any): Promise<any> {
    try {
      const permissions = this.getRolePermissions(userData.role);
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: userData.email,
        passwordHash: userData.password, // Already hashed in register method
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        permissions,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        organizationId: userData.organizationId || 'default'
      };

      const result = await this.dbService.createUser(newUser);
      
      if (result.success) {
        // Return user without password hash
        const { passwordHash, ...userWithoutPassword } = result.data;
        return userWithoutPassword;
      } else {
        const errorMessage = typeof result.error === 'string' ? result.error : 
          (result.error ? JSON.stringify(result.error) : 'Failed to create user');
        throw new Error(errorMessage);
      }
    } catch (error) {
      this.logger.error('Error creating user', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private getRolePermissions(role: string): string[] {
    const rolePermissions = {
      admin: ['*'],
      manager: [
        'order_manage', 'vendor_manage', 'qc_validate', 'analytics_view',
        'qc_execute', 'qc_manage', 'qc_checklist_manage', 'qc_results_view'
      ],
      appraiser: ['order_view', 'order_update', 'qc_results_view'],
      qc_analyst: [
        'qc_validate', 'qc_metrics', 'analytics_view', 'qc_execute', 
        'qc_manage', 'qc_checklist_manage', 'qc_results_view'
      ]
    };
    return rolePermissions[role as keyof typeof rolePermissions] || [];
  }

  private async generateAnalyticsOverview(): Promise<any> {
    // Mock implementation - replace with actual analytics queries
    return {
      totalOrders: 1250,
      completedOrders: 1100,
      averageCompletionTime: 5.2,
      qcPassRate: 94.5,
      topVendors: [
        { name: 'Premium Appraisals', completedOrders: 120, rating: 4.8 },
        { name: 'Expert Valuations', completedOrders: 98, rating: 4.7 }
      ],
      monthlyTrends: {
        orders: [85, 92, 78, 110, 95],
        qcScores: [94.2, 95.1, 93.8, 94.7, 94.5]
      }
    };
  }

  private async generatePerformanceAnalytics(params: any): Promise<any> {
    // Mock implementation - replace with actual analytics queries
    return {
      timeframe: {
        startDate: params.startDate,
        endDate: params.endDate,
        groupBy: params.groupBy
      },
      metrics: {
        orderVolume: [12, 15, 18, 22, 19, 25, 28],
        completionTimes: [4.2, 4.8, 5.1, 4.9, 5.3, 4.7, 4.5],
        qcScores: [94.2, 95.1, 93.8, 94.7, 94.5, 95.2, 94.8],
        vendorPerformance: [
          { vendorId: '1', avgCompletionTime: 4.2, qcScore: 95.1 },
          { vendorId: '2', avgCompletionTime: 4.8, qcScore: 94.3 }
        ]
      }
    };
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'Endpoint not found',
        code: 'ENDPOINT_NOT_FOUND',
        path: req.originalUrl
      });
    });

    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled API error', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      
      res.status(error.status || 500).json({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      });
    });
  }

  private getSwaggerSpec(): any {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Appraisal Management Platform API',
        version: '1.0.0',
        description: 'Comprehensive API for appraisal management with QC validation and vendor management'
      },
      servers: [
        { url: `http://localhost:${this.port}`, description: 'Development server' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [{ bearerAuth: [] }],
      paths: {
        '/health': {
          get: {
            summary: 'Health check endpoint',
            responses: {
              '200': { description: 'Service healthy' }
            }
          }
        },
        '/api/orders': {
          post: {
            summary: 'Create new appraisal order',
            security: [{ bearerAuth: [] }],
            responses: {
              '201': { description: 'Order created successfully' }
            }
          },
          get: {
            summary: 'Get orders with filters',
            security: [{ bearerAuth: [] }],
            responses: {
              '200': { description: 'Orders retrieved successfully' }
            }
          }
        },
        '/api/qc/checklists': {
          post: {
            summary: 'Create QC checklist',
            security: [{ bearerAuth: [] }],
            tags: ['QC Management'],
            responses: {
              '201': { description: 'QC checklist created successfully' }
            }
          },
          get: {
            summary: 'Search QC checklists',
            security: [{ bearerAuth: [] }],
            tags: ['QC Management'],
            responses: {
              '200': { description: 'QC checklists retrieved successfully' }
            }
          }
        },
        '/api/qc/checklists/{checklistId}': {
          get: {
            summary: 'Get QC checklist by ID',
            security: [{ bearerAuth: [] }],
            tags: ['QC Management'],
            parameters: [
              {
                name: 'checklistId',
                in: 'path',
                required: true,
                schema: { type: 'string' }
              }
            ],
            responses: {
              '200': { description: 'QC checklist retrieved successfully' }
            }
          }
        },
        '/api/qc/execution/execute': {
          post: {
            summary: 'Execute QC review',
            security: [{ bearerAuth: [] }],
            tags: ['QC Execution'],
            responses: {
              '200': { description: 'QC execution completed successfully' }
            }
          }
        },
        '/api/qc/execution/execute-async': {
          post: {
            summary: 'Execute QC review asynchronously',
            security: [{ bearerAuth: [] }],
            tags: ['QC Execution'],
            responses: {
              '202': { description: 'QC execution started successfully' }
            }
          }
        },
        '/api/qc/results/search': {
          get: {
            summary: 'Search QC results',
            security: [{ bearerAuth: [] }],
            tags: ['QC Results'],
            responses: {
              '200': { description: 'QC results retrieved successfully' }
            }
          }
        },
        '/api/qc/results/analytics/summary': {
          get: {
            summary: 'Get QC analytics summary',
            security: [{ bearerAuth: [] }],
            tags: ['QC Analytics'],
            responses: {
              '200': { description: 'QC analytics summary retrieved successfully' }
            }
          }
        }
      }
    };
  }

  public async start(): Promise<void> {
    try {
      // Initialize database connection
      await this.initializeDatabase();
      
      this.app.listen(this.port, () => {
        this.logger.info(`Appraisal Management API Server running on port ${this.port}`);
        this.logger.info(`API Documentation available at http://localhost:${this.port}/api-docs`);
        this.logger.info(`Health check available at http://localhost:${this.port}/health`);
        this.logger.info(`Database: Connected to Cosmos DB`);
      });
    } catch (error) {
      this.logger.error('Failed to start API server', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  }

  public getExpressApp(): express.Application {
    return this.app;
  }
}

// Export for use
export default AppraisalManagementAPIServer;