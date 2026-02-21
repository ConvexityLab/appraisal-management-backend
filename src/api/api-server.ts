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
import bcrypt from 'bcryptjs';

// Import our services
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { EnhancedPropertyIntelligenceController } from '../controllers/enhanced-property-intelligence.controller';
import { AIServicesController } from '../controllers/ai-services.controller';
import { DynamicCodeExecutionService } from '../services/dynamic-code-execution.service.js';
import { Logger } from '../utils/logger.js';

// Import Azure Entra ID authentication
import { createAzureEntraAuth, AuthenticatedRequest as EntraAuthRequest } from '../middleware/azure-entra-auth.middleware.js';

// Import Unified Authentication (Azure AD + Test Tokens)
import { createUnifiedAuth, UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';

// Import Authorization middleware
import { createAuthorizationMiddleware, AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

// Import QC controllers and middleware
import { qcChecklistRouter } from '../controllers/criteria.controller';
import { qcExecutionRouter } from '../controllers/reviews.controller';
import { QCResultsController } from '../controllers/results.controller';

// Import Places API (New) controller
import enhancedPropertyIntelligenceV2Router from '../controllers/enhanced-property-intelligence-v2.controller';
import { createGeospatialRouter } from '../controllers/geospatial.controller';
import { createBridgeMlsRouter } from '../controllers/bridge-mls.controller';

// Import AVM and Fraud Detection controllers
import avmRouter from '../controllers/avm.controller';
import fraudDetectionRouter from '../controllers/fraud-detection.controller';
import { AVMCascadeService } from '../services/avm-cascade.service.js';
import { validationResult as validateRequest } from 'express-validator';

// Import QC Workflow controller
import qcWorkflowRouter from '../controllers/qc-workflow.controller';

// Import new QC Checklist controller (separate from old criteria.controller)
import qcChecklistNewRouter from '../controllers/qc-checklist.controller.js';

// Import Correlation ID middleware
import { correlationIdMiddleware, requestLoggingMiddleware } from '../middleware/correlation-id.middleware.js';

// Import Authorization controllers
import { createUserProfileRouter } from '../controllers/user-profile.controller';
import { createAccessGraphRouter } from '../controllers/access-graph.controller';
import { createAuthorizationTestRouter } from '../controllers/authorization-test.controller';

// Import ROV controller
import { createROVRouter } from '../controllers/rov.controller';

// Import Template controller
import { createTemplateRouter } from '../controllers/template.controller';

// Import Review controller
import { createReviewRouter } from '../controllers/review.controller';

// Import Vendor Performance controller
import { createVendorPerformanceRouter } from '../controllers/vendor-performance.controller';

// Import Auto-Assignment controller
import { createAutoAssignmentRouter } from '../controllers/auto-assignment.controller';

// Import Delivery Workflow controller
import { createDeliveryWorkflowRouter } from '../controllers/delivery-workflow.controller';

// Import Communication Services controllers
import { createNotificationRouter } from '../controllers/notification.controller';
import { createChatRouter } from '../controllers/chat.controller';
import { createAcsTokenRouter } from '../controllers/acs-token.controller';
import { createTeamsRouter } from '../controllers/teams.controller';
import { createServiceHealthRouter } from '../controllers/service-health.controller';
import { createUnifiedCommunicationRouter } from '../controllers/unified-communication.controller';
import { createAxiomRouter } from '../controllers/axiom.controller';

// Import Item 3: Enhanced Vendor Management controllers
import { createVendorCertificationRouter } from '../controllers/vendor-certification.controller';
import { createPaymentRouter } from '../controllers/payment.controller';
import { createVendorOnboardingRouter } from '../controllers/vendor-onboarding.controller';
import { createVendorAnalyticsRouter } from '../controllers/vendor-analytics.controller';

// Import Simple Communication Controller (Phase 4.1)
import { createCommunicationRouter } from '../controllers/communication.controller';

// Import Vendor Timeout Job (Phase 4.2)
import { VendorTimeoutCheckerJob } from '../jobs/vendor-timeout-checker.job';

// Import Phase 3 background jobs
import { SLAMonitoringJob } from '../jobs/sla-monitoring.job';
import { OverdueOrderDetectionJob } from '../jobs/overdue-order-detection.job';

// Import Appraiser Controller (Phase 4.3)
import { AppraiserController } from '../controllers/appraiser.controller';

// Import Vendor Controller (Phase A - Live Data)
import { VendorController } from '../controllers/production-vendor.controller';

// Import Negotiation Controller (Phase C1 - Live Data)
import { createNegotiationRouter } from '../controllers/negotiation.controller';

// Import Core Notification Service (Phase E - Event-Driven)
import { NotificationService as EventNotificationOrchestrator } from '../services/core-notification.service';

// Import Inspection Controller (Phase 4.4)
import { InspectionController } from '../controllers/inspection.controller';

// Import Photo Controller (Phase 4.5)
import { PhotoController } from '../controllers/photo.controller.js';

// Import Enhanced Order Controller (Phase 5)
import { EnhancedOrderController } from '../controllers/enhanced-order.controller.js';

// Import Document Controller (Phase 6)
import { DocumentController } from '../controllers/document.controller.js';

// Import Order Controller (Phase 0.2 — extracted from inline handlers)
import { OrderController } from '../controllers/order.controller.js';

// Import Reports Controller (Comp Analysis Migration)
import { createReportsRouter } from '../controllers/reports.controller.js';

import { 
  authenticateJWT, 
  requireRole, 
  sanitizeInput, 
  errorHandler
} from '../middleware/qc-api-validation.middleware.js';

// Use unified auth request type (supports both Azure AD and test tokens)
type AuthenticatedRequest = UnifiedAuthRequest;

export class AppraisalManagementAPIServer {
  private app: express.Application;
  private dbService: CosmosDbService;
  private propertyIntelligenceController: EnhancedPropertyIntelligenceController;
  private aiServicesController: AIServicesController;
  private dynamicCodeService: DynamicCodeExecutionService;
  private logger: Logger;
  private port: number;
  private azureAuth: ReturnType<typeof createAzureEntraAuth>;
  private unifiedAuth: ReturnType<typeof createUnifiedAuth>;
  private authzMiddleware?: AuthorizationMiddleware;
  private vendorTimeoutJob?: VendorTimeoutCheckerJob;
  private slaMonitoringJob?: SLAMonitoringJob;
  private overdueDetectionJob?: OverdueOrderDetectionJob;
  private eventOrchestrator?: EventNotificationOrchestrator;
  private orderController!: OrderController;
  
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
    
    // Initialize Azure Entra ID authentication
    this.azureAuth = createAzureEntraAuth();
    this.configureAzureRoles();
    
    // Initialize Unified Authentication (Azure AD + Test Tokens)
    this.unifiedAuth = createUnifiedAuth();
    
    // Initialize QC routers (except results, which needs dbService)
    this.qcChecklistRouter = qcChecklistRouter;
    this.qcExecutionRouter = qcExecutionRouter;
    // qcResultsRouter will be initialized after database is ready
    this.qcResultsRouter = null as any; // Placeholder
    
    this.setupMiddleware();
    this.setupRoutes();
    // NOTE: Error handling moved to after authorization routes are registered
  }

  private async initializeDatabase(): Promise<void> {
    
    // Initialize database FIRST
    await this.dbService.initialize();
    
    // Initialize QC Results router with shared dbService
    this.qcResultsRouter = new QCResultsController(this.dbService).getRouter();
    this.logger.info('QC Results controller initialized with shared database service');
    
    // Initialize authorization middleware after database is ready - pass dbService
    this.authzMiddleware = await createAuthorizationMiddleware(undefined, this.dbService);
    this.logger.info('Authorization middleware initialized');
    
    // Register QC Results routes AFTER authz middleware is ready
    this.app.use('/api/qc/results', 
      this.unifiedAuth.authenticate(),
      this.qcResultsRouter
    );
    this.logger.info('QC Results routes registered');
    
    // DEBUG: Add test auth endpoint
    this.app.get('/api/auth/test',
      this.unifiedAuth.authenticate(),
      (req: any, res: any) => {
        res.json({
          success: true,
          message: 'Authentication successful',
          user: {
            id: req.user?.id,
            email: req.user?.email,
            tenantId: req.user?.tenantId,
            isTestUser: req.user?.isTestUser
          }
        });
      }
    );
    
    // Register authorization routes AFTER middleware is initialized
    this.setupAuthorizationRoutes();
    
    // Register error handlers LAST (after all routes)
    this.setupErrorHandling();
  }

  /**
   * Helper to return authz middleware only if initialized
   */
  private loadUserProfileIfAvailable(): express.RequestHandler[] {
    return this.authzMiddleware ? [this.authzMiddleware.loadUserProfile()] : [];
  }

  /**
   * Configure Azure AD group/role mappings
   * Replace these IDs with your actual Azure AD group Object IDs
   */
  private configureAzureRoles(): void {
    // Get group IDs from environment or use defaults
    const adminGroupId = process.env.AZURE_ADMIN_GROUP_ID || 'admin-group-id';
    const managerGroupId = process.env.AZURE_MANAGER_GROUP_ID || 'manager-group-id';
    const qcAnalystGroupId = process.env.AZURE_QC_ANALYST_GROUP_ID || 'qc-analyst-group-id';
    const appraiserGroupId = process.env.AZURE_APPRAISER_GROUP_ID || 'appraiser-group-id';

    this.azureAuth.setRoleMapping(adminGroupId, 'admin', ['*']);
    this.azureAuth.setRoleMapping(managerGroupId, 'manager', [
      'order_manage', 'vendor_manage', 'vendor_assign', 'analytics_view', 
      'qc_metrics', 'qc_validate'
    ]);
    this.azureAuth.setRoleMapping(qcAnalystGroupId, 'qc_analyst', [
      'qc_validate', 'qc_execute', 'qc_metrics'
    ]);
    this.azureAuth.setRoleMapping(appraiserGroupId, 'appraiser', [
      'order_view', 'order_update'
    ]);

    this.logger.info('Azure AD role mappings configured');
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
      origin: process.env.ALLOWED_ORIGINS?.split(',') || (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3010']),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-ID', 'x-tenant-id'],
    }));

    // Correlation ID - must be early in middleware chain
    this.app.use(correlationIdMiddleware);
    this.app.use(requestLoggingMiddleware);

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

  /**
   * Setup authorization-related routes
   * Called AFTER authzMiddleware is initialized
   */
  private setupAuthorizationRoutes(): void {
    if (!this.authzMiddleware) {
      this.logger.warn('Authorization middleware not initialized - skipping authorization routes');
      return;
    }

    this.logger.info('Registering authorization routes...');

    // User profile management (admin/manager only)
    this.app.use('/api/users',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware.loadUserProfile(),
      this.authorize('user', 'manage'),
      createUserProfileRouter()
    );

    // Access graph management (admin only)
    this.app.use('/api/access-graph',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware.loadUserProfile(),
      this.authorize('access_graph', 'manage'),
      createAccessGraphRouter()
    );

    // Authorization testing endpoint (authenticated users only)
    this.app.use('/api/authz-test',
      this.unifiedAuth.authenticate(),
      createAuthorizationTestRouter()
    );

    // ROV Management (authenticated users with proper permissions)
    this.app.use('/api/rov',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware.loadUserProfile(),
      createROVRouter()
    );

    // Template Management (authenticated users with proper permissions)
    this.app.use('/api/templates',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware.loadUserProfile(),
      createTemplateRouter()
    );

    // Vendor Performance Management (authenticated users with proper permissions)
    this.app.use('/api/vendor-performance',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware.loadUserProfile(),
      createVendorPerformanceRouter()
    );

    // Auto-Assignment & Vendor Matching (authenticated users with proper permissions)
    this.app.use('/api/auto-assignment',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware.loadUserProfile(),
      createAutoAssignmentRouter()
    );

    // Order Negotiation & Acceptance — handled by negotiation.controller.ts (Phase C1)
    // Old order-negotiation.controller.ts removed (routes were shadowed).

    // Delivery Workflow - Progress Tracking, Milestones, Documents (authenticated users)
    this.app.use('/api/delivery',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware.loadUserProfile(),
      createDeliveryWorkflowRouter()
    );

    // ACS Token Exchange - Get chat tokens (authenticated users)
    // Note: No loadUserProfile() - ACS identities are auto-created on first use
    this.app.use('/api/acs',
      this.unifiedAuth.authenticate(),
      createAcsTokenRouter()
    );

    // Teams Meetings - Teams interoperability (authenticated users)
    // External users can join without Teams license
    // Note: No loadUserProfile() - Teams meetings work with authentication only
    this.app.use('/api/teams',
      this.unifiedAuth.authenticate(),
      createTeamsRouter()
    );

    // Unified Communication Platform - Chat, Calls, Meetings with AI (authenticated users)
    // Orchestrates all communication channels with intelligent insights
    // Auto-creates ACS identities, manages contexts, provides real thread/meeting IDs
    this.app.use('/api/communication',
      this.unifiedAuth.authenticate(),
      createUnifiedCommunicationRouter()
    );

    // Simple Communication APIs - Direct email/SMS/Teams sending (Phase 4.1)
    // Straightforward endpoints for sending messages and retrieving history
    this.app.use('/api/communications',
      this.unifiedAuth.authenticate(),
      createCommunicationRouter()
    );

    // Appraiser Management - Profiles, licenses, assignments, conflict checking (Phase 4.3)
    // Manages appraiser entities, license tracking, availability, and conflict-of-interest checks
    const appraiserController = new AppraiserController(this.dbService);
    this.app.use('/api/appraisers',
      this.unifiedAuth.authenticate(),
      appraiserController.router
    );

    // Vendor Management - CRUD, assignment, performance (Phase A - Live Data)
    // Uses CosmosDbService directly for all vendor operations
    const vendorController = new VendorController(this.dbService);
    this.app.use('/api/vendors',
      this.unifiedAuth.authenticate(),
      vendorController.router
    );

    // Negotiations - Accept, reject, counter-offer, respond (Phase C1 - Live Data)
    // Full state machine for vendor/client fee negotiation with auto-accept thresholds
    // Sole mount after merging with order-negotiation.controller.ts (Phase 0.4)
    this.app.use('/api/negotiations',
      this.unifiedAuth.authenticate(),
      ...(this.authzMiddleware ? [this.authzMiddleware.loadUserProfile()] : []),
      createNegotiationRouter()
    );

    // Inspection Scheduling - Appointment management, availability, calendar integration (Phase 4.4)
    // Manages inspection appointments, scheduling, rescheduling, and appraiser calendar coordination
    const inspectionController = new InspectionController(this.dbService);
    this.app.use('/api/inspections',
      this.unifiedAuth.authenticate(),
      inspectionController.router
    );

    // Photo Upload & Management - Inspection photos with blob storage (Phase 4.5)
    // Manages inspection photo uploads, retrieval, and storage in Azure Blob Storage
    const photoController = new PhotoController(this.dbService);
    this.app.use('/api/photos',
      this.unifiedAuth.authenticate(),
      photoController.router
    );

    // Enhanced Order Management - Advanced lifecycle, QC integration, analytics (Phase 5)
    // Comprehensive order management with property intelligence and automated QC validation
    const enhancedOrderController = new EnhancedOrderController(this.dbService);
    this.app.use('/api/enhanced-orders',
      this.unifiedAuth.authenticate(),
      enhancedOrderController.router
    );

    // Document Management - Upload, storage, metadata management (Phase 6)
    // Manages document uploads to blob storage with metadata tracking and search
    const documentController = new DocumentController(this.dbService);
    this.app.use('/api/documents',
      this.unifiedAuth.authenticate(),
      documentController.router
    );

    // NOTE: Order Management (/api/orders) registered in setupRoutes() — must work even when authzMiddleware is absent

    // QC Checklist Management - Manage QC checklists with document requirements
    // Provides CRUD operations for checklists stored in criteria container
    this.app.use('/api/qc-checklists-new',
      this.unifiedAuth.authenticate(),
      qcChecklistNewRouter
    );

    // Reports & Comps - Property valuation reports and comparable properties (Comp Analysis Migration)
    // Migrated from Function Apps: getReport, upsertReport, runInteractiveAvm, PDF operations, geocoding
    this.app.use('/api/reports',
      this.unifiedAuth.authenticate(),
      createReportsRouter(this.dbService)
    );

    // Storage/Geocode endpoints (part of reports functionality)
    this.app.use('/api/storage',
      this.unifiedAuth.authenticate(),
      createReportsRouter(this.dbService)
    );
    this.app.use('/api/geocode',
      this.unifiedAuth.authenticate(),
      createReportsRouter(this.dbService)
    );

    // Axiom AI Platform - Document analysis, criteria evaluation, risk scoring (authenticated users)
    // Powers AI features: USPAP compliance, QC automation, revision comparison, ROV analysis
    this.app.use('/api/axiom',
      this.unifiedAuth.authenticate(),
      createAxiomRouter(this.dbService)
    );

    // ===== ITEM 3: ENHANCED VENDOR MANAGEMENT SYSTEM =====
    
    // Vendor Certifications - License tracking, expiry monitoring, document storage (authenticated users)
    // Manages vendor certifications, automatic renewal alerts, state board verification
    this.app.use('/api/vendor-certifications',
      this.unifiedAuth.authenticate(),
      createVendorCertificationRouter(this.dbService)
    );

    // Payment Processing - Invoicing, vendor payments, Stripe/ACH integration (authenticated users)
    // Handles invoice generation, payment processing, vendor compensation tracking
    this.app.use('/api/payments',
      this.unifiedAuth.authenticate(),
      createPaymentRouter(this.dbService)
    );

    // Vendor Onboarding - Multi-step workflow, document verification, approval process (authenticated users)
    // Manages vendor onboarding from application to approval with background checks
    this.app.use('/api/vendor-onboarding',
      this.unifiedAuth.authenticate(),
      createVendorOnboardingRouter()
    );

    // Vendor Analytics - Performance dashboards, trends, comparative analytics (authenticated users)
    // Provides insights on vendor performance, rankings, tier analysis, historical trends
    this.app.use('/api/vendor-analytics',
      this.unifiedAuth.authenticate(),
      createVendorAnalyticsRouter()
    );

    // ===== END ITEM 3 =====

    // Notifications - Email, SMS, Templates, Preferences (authenticated users)
    this.app.use('/api/notifications',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware.loadUserProfile(),
      createNotificationRouter()
    );

    // Chat - Real-time messaging with ACS Chat SDK (authenticated users)
    this.app.use('/api/chat',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware.loadUserProfile(),
      createChatRouter()
    );

    // Service Health - Diagnostics and health checks (no auth required for monitoring)
    this.app.use('/api/health',
      createServiceHealthRouter()
    );

    this.logger.info('✅ Authorization routes registered successfully');
  }

  private setupRoutes(): void {
    // Health check - comprehensive status
    this.app.get('/health', this.getHealthCheck.bind(this));
    
    // Readiness check - is service ready to accept traffic?
    this.app.get('/ready', async (req: express.Request, res: express.Response) => {
      try {
        // Check database connectivity
        await this.dbService.initialize();
        res.status(200).json({ ready: true, timestamp: new Date().toISOString() });
      } catch (error) {
        this.logger.error('Readiness check failed', { error });
        res.status(503).json({ 
          ready: false, 
          error: error instanceof Error ? error.message : 'Service not ready',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Liveness check - is service alive?
    this.app.get('/live', (req: express.Request, res: express.Response) => {
      res.status(200).json({ alive: true, timestamp: new Date().toISOString() });
    });
    
    // Status endpoint
    this.app.get('/api/status', (_req, res) => {
      const uptime = process.uptime();
      const memory = process.memoryUsage();
      
      res.json({
        server: 'running',
        database: this.dbService ? 'connected' : 'not_configured',
        uptime: uptime,
        memory: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
          external: memory.external,
          arrayBuffers: memory.arrayBuffers
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          nodeEnv: process.env.NODE_ENV || 'development'
        }
      });
    });

    // Authentication routes
    this.app.post('/api/auth/login', this.validateLogin(), this.login.bind(this));
    this.app.post('/api/auth/register', this.validateRegister(), this.register.bind(this));
    this.app.post('/api/auth/refresh', this.unifiedAuth.authenticate(), this.refreshToken.bind(this));
    
    // Test token generation endpoint (dev/test only)
    if (process.env.ALLOW_TEST_TOKENS === 'true') {
      this.app.post('/api/auth/test-token', this.generateTestToken.bind(this));
    }

    // NOTE: Authorization routes registered separately after authzMiddleware initialization

    // Order Management - CRUD, status lifecycle, dashboard (Phase 0.2)
    // Registered here (not in setupAuthorizationRoutes) so it works even when authzMiddleware is absent.
    // OrderController handles its own authz internally via optional authzMiddleware param.
    this.orderController = new OrderController(this.dbService, this.authzMiddleware);
    this.app.use('/api/orders',
      this.unifiedAuth.authenticate(),
      this.orderController.router
    );

    // QC Validation routes
    this.app.post('/api/qc/validate/:orderId',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('order', 'qc_validate'),
      this.performQCValidation.bind(this)
    );

    // NOTE: QC Results route handled by results controller at /api/qc/results/*
    // this.app.get('/api/qc/results/:orderId',
    //   this.unifiedAuth.authenticate(),
    //   this.getQCResults.bind(this)
    // );

    this.app.get('/api/qc/metrics',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('order', 'view'),
      this.getQCMetrics.bind(this)
    );

    // Vendor Management routes — now handled by VendorController mounted above at /api/vendors

    // Analytics routes
    this.app.get('/api/analytics/overview',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('analytics', 'view'),
      this.getAnalyticsOverview.bind(this)
    );

    this.app.get('/api/analytics/performance',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('analytics', 'view'),
      this.validateAnalyticsQuery(),
      this.getPerformanceAnalytics.bind(this)
    );

    // Property Intelligence routes (with /api prefix)
    this.app.get('/api/property-intelligence/address/suggest',
      this.unifiedAuth.optionalAuth(),
      this.propertyIntelligenceController.suggestAddresses
    );

    // Property Intelligence routes (backward compatibility - without /api prefix)
    this.app.get('/property-intelligence/address/suggest',
      this.unifiedAuth.optionalAuth(),
      this.propertyIntelligenceController.suggestAddresses
    );

    this.app.post('/api/property-intelligence/address/geocode',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.geocodeAddress
    );

    this.app.post('/api/property-intelligence/address/validate',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.validateAddress
    );

    this.app.post('/api/property-intelligence/analyze/comprehensive',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.comprehensiveAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/creative',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.creativeFeatureAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/view',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.viewAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/transportation',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.transportationAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/neighborhood',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.neighborhoodAnalysis
    );

    this.app.post('/api/property-intelligence/analyze/batch',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.batchAnalysis
    );

    this.app.get('/api/property-intelligence/census/demographics',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.getCensusDemographics
    );

    this.app.get('/api/property-intelligence/census/economics',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.getCensusEconomics
    );

    this.app.get('/api/property-intelligence/census/housing',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.getCensusHousing
    );

    this.app.get('/api/property-intelligence/census/comprehensive',
      this.unifiedAuth.authenticate(),
      this.propertyIntelligenceController.getComprehensiveCensusIntelligence
    );

    this.app.get('/api/property-intelligence/health',
      this.propertyIntelligenceController.healthCheck
    );

    // Property Intelligence V2 routes (Places API New)
    this.app.use('/api/property-intelligence-v2', 
      this.unifiedAuth.authenticate(),
      enhancedPropertyIntelligenceV2Router
    );

    // Geospatial Risk Assessment routes (FEMA, Census, Tribal, Environmental)
    this.app.use('/api/geospatial',
      this.unifiedAuth.authenticate(),
      createGeospatialRouter()
    );

    // Bridge Interactive MLS routes
    this.app.use('/api/bridge-mls',
      this.unifiedAuth.authenticate(),
      createBridgeMlsRouter()
    );

    // Dynamic Code Execution routes
    this.app.post('/api/code/execute',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('code', 'execute'),
      this.validateCodeExecution(),
      this.executeCode.bind(this)
    );

    // AI Services routes
    this.app.post('/api/ai/qc/analyze',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('ai', 'qc_analyze'),
      this.aiServicesController.validateQCAnalysis(),
      this.aiServicesController.performQCAnalysis
    );

    this.app.post('/api/ai/qc/technical',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('ai', 'qc_analyze'),
      this.aiServicesController.validateQCAnalysis(),
      this.aiServicesController.performTechnicalQC
    );

    this.app.post('/api/ai/qc/compliance',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('ai', 'qc_analyze'),
      this.aiServicesController.validateQCAnalysis(),
      this.aiServicesController.performComplianceQC
    );

    this.app.post('/api/ai/market/insights',
      this.unifiedAuth.authenticate(),
      this.aiServicesController.validateMarketInsights(),
      this.aiServicesController.generateMarketInsights
    );

    this.app.post('/api/ai/property/description',
      this.unifiedAuth.authenticate(),
      this.aiServicesController.validateMarketInsights(),
      this.aiServicesController.generatePropertyDescription
    );

    this.app.post('/api/ai/vision/analyze',
      this.unifiedAuth.authenticate(),
      this.aiServicesController.validateImageAnalysis(),
      this.aiServicesController.analyzePropertyImages
    );

    this.app.post('/api/ai/vision/condition',
      this.unifiedAuth.authenticate(),
      this.aiServicesController.validateImageAnalysis(),
      this.aiServicesController.analyzePropertyCondition
    );

    this.app.post('/api/ai/embeddings',
      this.unifiedAuth.authenticate(),
      this.aiServicesController.validateEmbeddingGeneration(),
      this.aiServicesController.generateEmbeddings
    );

    this.app.post('/api/ai/completion',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('ai', 'generate'),
      this.aiServicesController.validateCompletion(),
      this.aiServicesController.generateCompletion
    );

    this.app.get('/api/ai/health',
      this.aiServicesController.getServiceHealth
    );

    // AVM (Automated Valuation Model) routes
    this.app.use('/api/avm',
      this.unifiedAuth.authenticate(),
      avmRouter
    );

    // Fraud Detection routes
    this.app.use('/api/fraud-detection',
      this.unifiedAuth.authenticate(),
      fraudDetectionRouter
    );

    this.app.get('/api/ai/usage',
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('analytics', 'view'),
      this.aiServicesController.getUsageStats
    );

    // QC Management routes - comprehensive quality control system
    // Mount QC router modules with authentication
    this.app.use('/api/qc/checklists', 
      this.unifiedAuth.authenticate(),
      this.qcChecklistRouter
    );
    
    this.app.use('/api/qc/execution', 
      this.unifiedAuth.authenticate(),
      ...this.loadUserProfileIfAvailable(),
      this.authorize('order', 'qc_execute'),
      this.qcExecutionRouter
    );
    
    // QC Results routes registered in initializeDatabase() after dbService is ready
    // this.app.use('/api/qc/results', ...)

    // QC Workflow Automation routes - review queue, revisions, escalations, SLA tracking
    this.app.use('/api/qc-workflow',
      this.unifiedAuth.authenticate(),
      qcWorkflowRouter
    );

    // Appraisal Review routes - review assignment, workflow, comparable analysis, reports
    this.app.use('/api/reviews',
      this.unifiedAuth.authenticate(),
      this.authzMiddleware?.loadUserProfile() || ((req: any, res: any, next: any) => next()),
      createReviewRouter()
    );

    // Legacy Azure Functions proxy routes
    this.setupFunctionsRoutes();
  }

  // Setup legacy /functions/* routes as proxies to new REST API
  private setupFunctionsRoutes(): void {
    // POST /functions/getOrder -> GET /api/orders/:orderId
    this.app.post('/functions/getOrder',
      this.unifiedAuth.authenticate(),
      async (req: express.Request, res: express.Response) => {
        this.logger.info('Functions getOrder called', { 
          body: req.body, 
          orderId: req.body?.orderId,
          headers: req.headers['content-type'],
          user: (req as AuthenticatedRequest).user?.id
        });
        const { orderId } = req.body;
        if (!orderId) {
          this.logger.warn('Missing orderId in request body', { body: req.body });
          return res.status(400).json({ error: 'orderId is required' });
        }
        // Forward to OrderController by setting params and piping through its router
        req.params.orderId = orderId;
        return this.orderController.getOrder(req as AuthenticatedRequest, res);
      }
    );

    // POST /functions/createOrder -> POST /api/orders
    this.app.post('/functions/createOrder',
      this.unifiedAuth.authenticate(),
      async (req: express.Request, res: express.Response) => {
        // Forward to OrderController's createOrder handler
        return this.orderController.createOrder(req as AuthenticatedRequest, res);
      }
    );

    // Backward compatibility: POST /functions/runInteractiveAvm
    // Legacy endpoint that calls AVM service directly
    this.app.post('/functions/runInteractiveAvm',
      this.unifiedAuth.authenticate(),
      async (req: express.Request, res: express.Response) => {
        try {
          this.logger.info('AVM valuation via legacy endpoint', { address: req.body?.address });
          
          // Validate required fields
          if (!req.body?.address) {
            return res.status(400).json({
              success: false,
              error: 'Address is required',
              message: 'Please provide a property address for valuation'
            });
          }
          
          const avmService = new AVMCascadeService();
          const result = await avmService.getValuation(req.body);
          
          if (!result.success) {
            this.logger.warn('AVM valuation failed', { 
              address: req.body.address, 
              error: result.error,
              attempts: result.attempts 
            });
            return res.status(422).json({
              success: false,
              error: 'Valuation failed',
              message: result.error || 'Unable to generate valuation estimate',
              attempts: result.attempts,
              processingTime: result.processingTime,
            });
          }
          
          this.logger.info('AVM valuation successful', {
            address: req.body.address,
            method: result.result?.method,
            value: result.result?.estimatedValue
          });
          
          return res.json({
            success: true,
            valuation: result.result,
            attempts: result.attempts,
            processingTime: result.processingTime,
          });
        } catch (error) {
          this.logger.error('Legacy AVM endpoint error', { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            address: req.body?.address 
          });
          return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error occurred during valuation'
          });
        }
      }
    );
  }

  // Authentication middleware - unified auth (test tokens + Azure AD)
  private authenticateToken = (req: UnifiedAuthRequest, res: express.Response, next: express.NextFunction): void => {
    this.unifiedAuth.authenticate()(req, res, next);
  };

  // Authorization middleware - now using Casbin
  private authorize(resourceType: string, action: string) {
    if (!this.authzMiddleware) {
      this.logger.warn('Authorization middleware not initialized - allowing request');
      return (req: any, res: any, next: any) => next();
    }
    // Cast to proper types since we know these match Casbin's ResourceType and Action
    return this.authzMiddleware.authorize(resourceType as any, action as any);
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
      // Accept multiple formats: UUID, timestamp-randomstring, numeric string, or QC review format
      param('orderId').custom((value) => {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        const isTimestampFormat = /^\d+-[a-z0-9]+$/.test(value);
        const isNumeric = /^\d+$/.test(value);
        const isOrderFormat = /^ORD-\d{4}-\d{8}$/.test(value); // ORD-YYYY-XXXXXXXX
        const isQCReviewFormat = /^qc[_-]?review[_-]?\d{8}[_-]?\d{3}$/.test(value); // qc_review_20260208_001
        if (!isUUID && !isTimestampFormat && !isNumeric && !isOrderFormat && !isQCReviewFormat) {
          throw new Error('Order ID must be a UUID, timestamp-randomstring format, numeric ID, order format (ORD-YYYY-XXXXXXXX), or QC review format');
        }
        return true;
      }),
      this.handleValidationErrors
    ];
  }

  // validateVendorId, validateVendorCreation, validateVendorUpdate — moved to VendorController

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

  private async generateTestToken(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { email, role, name } = req.body;
      
      if (!email || !role) {
        res.status(400).json({ 
          error: 'email and role are required',
          code: 'MISSING_FIELDS' 
        });
        return;
      }

      const testUser = {
        id: `test-${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        role,
        tenantId: 'test-tenant',
        permissions: ['*']
      };

      // Use TestTokenGenerator directly
      const { TestTokenGenerator } = await import('../utils/test-token-generator.js');
      const tokenGen = new TestTokenGenerator();
      const token = tokenGen.generateToken(testUser);

      res.json({
        token,
        user: testUser,
        expiresIn: '24h'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to generate test token',
        code: 'TOKEN_GENERATION_ERROR',
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
          name: req.user.name,
          tenantId: req.user.tenantId
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

  // Order Management endpoints now handled by OrderController (this.orderController)
  // See src/controllers/order.controller.ts

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

  // Vendor Management endpoints — REMOVED: now handled by VendorController (production-vendor.controller.ts)

  // Analytics endpoints
  private async getAnalyticsOverview(req: AuthenticatedRequest, res: express.Response): Promise<void> {
    try {
      const result = await this.dbService.getAnalyticsOverview();
      
      if (result.success) {
        res.json(result.data);
      } else {
        // Return empty analytics instead of error if database not available
        res.json({
          totalOrders: 0,
          completedOrders: 0,
          averageCompletionTime: 0,
          qcPassRate: 0,
          topVendors: [],
          monthlyTrends: []
        });
      }
    } catch (error) {
      // Return empty analytics instead of error
      res.json({
        totalOrders: 0,
        completedOrders: 0,
        averageCompletionTime: 0,
        qcPassRate: 0,
        topVendors: [],
        monthlyTrends: []
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
        },
        '/api/avm/valuation': {
          post: {
            summary: 'Get property valuation using AVM cascade',
            security: [{ bearerAuth: [] }],
            tags: ['AVM - Automated Valuation'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['address'],
                    properties: {
                      address: { type: 'string', example: '123 Main St, Seattle, WA 98101' },
                      latitude: { type: 'number', example: 47.6062 },
                      longitude: { type: 'number', example: -122.3321 },
                      squareFootage: { type: 'number', example: 2400 },
                      yearBuilt: { type: 'number', example: 2015 },
                      bedrooms: { type: 'number', example: 3 },
                      bathrooms: { type: 'number', example: 2.5 },
                      propertyType: { type: 'string', example: 'single-family' },
                      strategy: { type: 'string', enum: ['speed', 'quality', 'cost'], example: 'quality' },
                      forceMethod: { type: 'string', enum: ['bridge', 'hedonic', 'cost'] }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Valuation completed successfully' },
              '422': { description: 'All valuation methods failed' }
            }
          }
        },
        '/api/avm/batch': {
          post: {
            summary: 'Get valuations for multiple properties (batch)',
            security: [{ bearerAuth: [] }],
            tags: ['AVM - Automated Valuation'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['properties'],
                    properties: {
                      properties: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 100,
                        items: {
                          type: 'object',
                          required: ['address'],
                          properties: {
                            address: { type: 'string' }
                          }
                        }
                      },
                      strategy: { type: 'string', enum: ['speed', 'quality', 'cost'] }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Batch valuation completed' }
            }
          }
        },
        '/api/avm/methods': {
          get: {
            summary: 'Get available AVM methods and strategies',
            security: [{ bearerAuth: [] }],
            tags: ['AVM - Automated Valuation'],
            responses: {
              '200': { description: 'AVM methods retrieved successfully' }
            }
          }
        },
        '/api/fraud-detection/analyze': {
          post: {
            summary: 'Analyze appraisal for fraud indicators',
            security: [{ bearerAuth: [] }],
            tags: ['Fraud Detection'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['appraisalId', 'propertyAddress', 'appraisedValue', 'appraisalDate', 'subjectProperty', 'comparables', 'appraiser'],
                    properties: {
                      appraisalId: { type: 'string', example: 'APR-2024-001' },
                      propertyAddress: { type: 'string' },
                      appraisedValue: { type: 'number', example: 500000 },
                      appraisalDate: { type: 'string', format: 'date' },
                      subjectProperty: {
                        type: 'object',
                        properties: {
                          squareFootage: { type: 'number' },
                          yearBuilt: { type: 'number' },
                          condition: { type: 'string' },
                          propertyType: { type: 'string' }
                        }
                      },
                      comparables: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            address: { type: 'string' },
                            soldPrice: { type: 'number' },
                            distance: { type: 'number' },
                            adjustments: {
                              type: 'object',
                              properties: {
                                total: { type: 'number' }
                              }
                            }
                          }
                        }
                      },
                      appraiser: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          licenseNumber: { type: 'string' },
                          licenseState: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Fraud analysis completed successfully' }
            }
          }
        },
        '/api/fraud-detection/quick-check': {
          post: {
            summary: 'Quick fraud risk check (rules-based only)',
            security: [{ bearerAuth: [] }],
            tags: ['Fraud Detection'],
            responses: {
              '200': { description: 'Quick check completed' }
            }
          }
        },
        '/api/fraud-detection/batch': {
          post: {
            summary: 'Batch fraud analysis for multiple appraisals',
            security: [{ bearerAuth: [] }],
            tags: ['Fraud Detection'],
            responses: {
              '200': { description: 'Batch analysis completed' }
            }
          }
        },
        '/api/fraud-detection/risk-thresholds': {
          get: {
            summary: 'Get fraud risk scoring thresholds',
            security: [{ bearerAuth: [] }],
            tags: ['Fraud Detection'],
            responses: {
              '200': { description: 'Risk thresholds retrieved successfully' }
            }
          }
        },
        '/api/qc-workflow/queue': {
          get: {
            summary: 'Search QC review queue with filters',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Queue Management'],
            parameters: [
              { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'IN_REVIEW', 'COMPLETED'] } },
              { name: 'priorityLevel', in: 'query', schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] } },
              { name: 'assignedAnalystId', in: 'query', schema: { type: 'string' } },
              { name: 'slaBreached', in: 'query', schema: { type: 'boolean' } },
              { name: 'limit', in: 'query', schema: { type: 'number', default: 50 } },
              { name: 'offset', in: 'query', schema: { type: 'number', default: 0 } }
            ],
            responses: {
              '200': { description: 'Queue items retrieved successfully' }
            }
          }
        },
        '/api/qc-workflow/queue/statistics': {
          get: {
            summary: 'Get QC queue statistics',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Queue Management'],
            responses: {
              '200': { 
                description: 'Queue statistics retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        total: { type: 'number', example: 150 },
                        pending: { type: 'number', example: 45 },
                        inReview: { type: 'number', example: 30 },
                        completed: { type: 'number', example: 75 },
                        breached: { type: 'number', example: 5 },
                        averageWaitTimeMinutes: { type: 'number', example: 127 },
                        longestWaitTimeMinutes: { type: 'number', example: 540 },
                        byPriority: {
                          type: 'object',
                          properties: {
                            LOW: { type: 'number', example: 20 },
                            MEDIUM: { type: 'number', example: 65 },
                            HIGH: { type: 'number', example: 55 },
                            CRITICAL: { type: 'number', example: 10 }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/qc-workflow/queue/assign': {
          post: {
            summary: 'Manually assign QC review to analyst',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Queue Management'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['queueItemId', 'analystId'],
                    properties: {
                      queueItemId: { type: 'string', example: 'QQI-2024-001' },
                      analystId: { type: 'string', example: 'analyst-123' },
                      notes: { type: 'string', example: 'High priority - complex valuation' }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Review assigned successfully' },
              '400': { description: 'Analyst at capacity or invalid request' }
            }
          }
        },
        '/api/qc-workflow/queue/auto-assign': {
          post: {
            summary: 'Automatically assign pending reviews to available analysts',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Queue Management'],
            description: 'Balances workload by assigning to analysts with lowest capacity utilization',
            responses: {
              '200': { 
                description: 'Auto-assignment completed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        assignedCount: { type: 'number', example: 12 }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/qc-workflow/queue/next/{analystId}': {
          get: {
            summary: 'Get next highest priority review for analyst',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Queue Management'],
            parameters: [
              { name: 'analystId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: {
              '200': { description: 'Next review retrieved' },
              '204': { description: 'No reviews available or analyst at capacity' }
            }
          }
        },
        '/api/qc-workflow/analysts/workload': {
          get: {
            summary: 'Get workload for all analysts',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Queue Management'],
            description: 'Returns capacity utilization and performance metrics for all QC analysts',
            responses: {
              '200': {
                description: 'Analyst workloads retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          analystId: { type: 'string', example: 'analyst-123' },
                          analystName: { type: 'string', example: 'John Smith' },
                          pending: { type: 'number', example: 3 },
                          inProgress: { type: 'number', example: 7 },
                          completedToday: { type: 'number', example: 12 },
                          totalAssigned: { type: 'number', example: 10 },
                          maxConcurrent: { type: 'number', example: 10 },
                          utilizationPercent: { type: 'number', example: 70.5 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/qc-workflow/revisions': {
          post: {
            summary: 'Create revision request for appraisal',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Revision Management'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['orderId', 'appraisalId', 'qcReportId', 'severity', 'issues', 'requestedBy'],
                    properties: {
                      orderId: { type: 'string', example: 'ORD-2024-001' },
                      appraisalId: { type: 'string', example: 'APR-2024-001' },
                      qcReportId: { type: 'string', example: 'QCR-2024-001' },
                      severity: { type: 'string', enum: ['CRITICAL', 'MAJOR', 'MODERATE', 'MINOR'], example: 'MAJOR' },
                      dueDate: { type: 'string', format: 'date-time', description: 'Optional - auto-calculated if not provided' },
                      issues: {
                        type: 'array',
                        minItems: 1,
                        items: {
                          type: 'object',
                          required: ['category', 'description'],
                          properties: {
                            category: { type: 'string', example: 'COMPARABLE_SELECTION' },
                            description: { type: 'string', example: 'Comp #2 is 1.5 miles away - exceed adjustment guidelines' },
                            severity: { type: 'string', enum: ['CRITICAL', 'MAJOR', 'MODERATE', 'MINOR'] }
                          }
                        }
                      },
                      requestNotes: { type: 'string', example: 'Please address comp selection and provide additional analysis' },
                      requestedBy: { type: 'string', example: 'qc-analyst-456' }
                    }
                  }
                }
              }
            },
            responses: {
              '201': { description: 'Revision request created successfully' }
            }
          }
        },
        '/api/qc-workflow/revisions/{revisionId}/submit': {
          post: {
            summary: 'Submit revised appraisal',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Revision Management'],
            description: 'Triggers automatic re-QC upon submission',
            parameters: [
              { name: 'revisionId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['submittedBy', 'resolvedIssues'],
                    properties: {
                      responseNotes: { type: 'string', example: 'Updated comp analysis with local market data' },
                      submittedBy: { type: 'string', example: 'appraiser-789' },
                      resolvedIssues: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['issueId', 'resolution'],
                          properties: {
                            issueId: { type: 'string' },
                            resolution: { type: 'string', example: 'Replaced with comp within 0.5 miles' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Revision submitted, re-QC triggered automatically' }
            }
          }
        },
        '/api/qc-workflow/revisions/{revisionId}/accept': {
          post: {
            summary: 'Accept revised appraisal',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Revision Management'],
            parameters: [
              { name: 'revisionId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['acceptedBy'],
                    properties: {
                      acceptedBy: { type: 'string', example: 'qc-analyst-456' },
                      notes: { type: 'string', example: 'All issues resolved satisfactorily' }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Revision accepted, order can proceed' }
            }
          }
        },
        '/api/qc-workflow/revisions/{revisionId}/reject': {
          post: {
            summary: 'Reject revised appraisal (needs more work)',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Revision Management'],
            parameters: [
              { name: 'revisionId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['rejectedBy', 'reason'],
                    properties: {
                      rejectedBy: { type: 'string', example: 'qc-analyst-456' },
                      reason: { type: 'string', example: 'Comp adjustments still exceed guidelines' }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Revision rejected, appraiser notified' }
            }
          }
        },
        '/api/qc-workflow/revisions/order/{orderId}/history': {
          get: {
            summary: 'Get revision history for order',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Revision Management'],
            description: 'Returns all versions (v1, v2, v3...) with issue tracking',
            parameters: [
              { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: {
              '200': { description: 'Revision history retrieved' }
            }
          }
        },
        '/api/qc-workflow/revisions/active': {
          get: {
            summary: 'Get all active revisions',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Revision Management'],
            description: 'Returns PENDING or IN_PROGRESS revisions',
            responses: {
              '200': { description: 'Active revisions retrieved' }
            }
          }
        },
        '/api/qc-workflow/revisions/overdue': {
          get: {
            summary: 'Get overdue revisions',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Revision Management'],
            responses: {
              '200': { description: 'Overdue revisions retrieved' }
            }
          }
        },
        '/api/qc-workflow/escalations': {
          post: {
            summary: 'Create escalation case',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Escalation Management'],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['orderId', 'escalationType', 'priority', 'title', 'description', 'raisedBy'],
                    properties: {
                      orderId: { type: 'string', example: 'ORD-2024-001' },
                      escalationType: { 
                        type: 'string', 
                        enum: ['QC_DISPUTE', 'SLA_BREACH', 'COMPLEX_CASE', 'REVISION_FAILURE', 'FRAUD_SUSPECTED', 'COMPLIANCE_ISSUE', 'CLIENT_COMPLAINT'],
                        example: 'QC_DISPUTE'
                      },
                      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'HIGH' },
                      title: { type: 'string', example: 'Appraiser disputes QC findings on comp adjustments' },
                      description: { type: 'string', example: 'Appraiser provided additional market data to support adjustments' },
                      raisedBy: { type: 'string', example: 'appraiser-789' },
                      appraisalId: { type: 'string' },
                      qcReportId: { type: 'string' },
                      revisionId: { type: 'string' }
                    }
                  }
                }
              }
            },
            responses: {
              '201': { description: 'Escalation created and auto-assigned to appropriate manager' }
            }
          }
        },
        '/api/qc-workflow/escalations/open': {
          get: {
            summary: 'Get all open escalations',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Escalation Management'],
            responses: {
              '200': { description: 'Open escalations retrieved' }
            }
          }
        },
        '/api/qc-workflow/escalations/manager/{managerId}': {
          get: {
            summary: 'Get escalations assigned to manager',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Escalation Management'],
            parameters: [
              { name: 'managerId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: {
              '200': { description: 'Manager escalations retrieved' }
            }
          }
        },
        '/api/qc-workflow/escalations/{escalationId}/comment': {
          post: {
            summary: 'Add comment to escalation',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Escalation Management'],
            parameters: [
              { name: 'escalationId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['commentBy', 'comment'],
                    properties: {
                      commentBy: { type: 'string', example: 'qc-manager-123' },
                      comment: { type: 'string', example: 'Reviewed market data - adjustments appear reasonable' },
                      visibility: { type: 'string', enum: ['INTERNAL', 'VENDOR', 'CLIENT'], default: 'INTERNAL' }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Comment added successfully' }
            }
          }
        },
        '/api/qc-workflow/escalations/{escalationId}/resolve': {
          post: {
            summary: 'Resolve escalation case',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - Escalation Management'],
            parameters: [
              { name: 'escalationId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['resolution', 'resolvedBy', 'actions'],
                    properties: {
                      resolution: { type: 'string', example: 'QC finding overturned based on additional market evidence' },
                      resolvedBy: { type: 'string', example: 'qc-manager-123' },
                      actions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['actionType', 'description', 'performedBy'],
                          properties: {
                            actionType: { type: 'string', example: 'QC_OVERRIDE' },
                            description: { type: 'string', example: 'Overrode QC finding on comp adjustments' },
                            performedBy: { type: 'string' },
                            performedAt: { type: 'string', format: 'date-time' },
                            metadata: { type: 'object' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'Escalation resolved successfully' }
            }
          }
        },
        '/api/qc-workflow/sla/start': {
          post: {
            summary: 'Start SLA tracking for entity',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - SLA Tracking'],
            description: 'Begin tracking turnaround time with automatic breach detection',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['entityType', 'entityId', 'orderId', 'orderNumber'],
                    properties: {
                      entityType: { type: 'string', enum: ['QC_REVIEW', 'REVISION', 'ESCALATION'], example: 'QC_REVIEW' },
                      entityId: { type: 'string', example: 'QQI-2024-001' },
                      orderId: { type: 'string', example: 'ORD-2024-001' },
                      orderNumber: { type: 'string', example: 'AP-2024-0123' },
                      orderPriority: { type: 'string', enum: ['ROUTINE', 'EXPEDITED', 'RUSH', 'EMERGENCY'], example: 'RUSH' }
                    }
                  }
                }
              }
            },
            responses: {
              '201': { 
                description: 'SLA tracking started',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        trackingId: { type: 'string', example: 'SLA-2024-001' },
                        targetMinutes: { type: 'number', example: 120 },
                        targetDate: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/qc-workflow/sla/{trackingId}': {
          get: {
            summary: 'Get SLA tracking status',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - SLA Tracking'],
            description: 'Returns real-time status (ON_TRACK/AT_RISK/BREACHED)',
            parameters: [
              { name: 'trackingId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: {
              '200': {
                description: 'SLA status retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        trackingId: { type: 'string' },
                        status: { type: 'string', enum: ['ON_TRACK', 'AT_RISK', 'BREACHED', 'WAIVED'] },
                        elapsedMinutes: { type: 'number', example: 95 },
                        targetMinutes: { type: 'number', example: 120 },
                        percentComplete: { type: 'number', example: 79.2 },
                        breachedAt: { type: 'string', format: 'date-time' },
                        breachDurationMinutes: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/api/qc-workflow/sla/{trackingId}/extend': {
          post: {
            summary: 'Extend SLA deadline',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - SLA Tracking'],
            parameters: [
              { name: 'trackingId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['extensionMinutes', 'reason', 'extendedBy'],
                    properties: {
                      extensionMinutes: { type: 'number', example: 60 },
                      reason: { type: 'string', example: 'Complex property requires additional research' },
                      extendedBy: { type: 'string', example: 'qc-manager-123' }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'SLA extended successfully' }
            }
          }
        },
        '/api/qc-workflow/sla/{trackingId}/waive': {
          post: {
            summary: 'Waive SLA requirement',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - SLA Tracking'],
            parameters: [
              { name: 'trackingId', in: 'path', required: true, schema: { type: 'string' } }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['reason', 'waivedBy'],
                    properties: {
                      reason: { type: 'string', example: 'Client requested delay for additional documentation' },
                      waivedBy: { type: 'string', example: 'qc-manager-123' }
                    }
                  }
                }
              }
            },
            responses: {
              '200': { description: 'SLA waived successfully' }
            }
          }
        },
        '/api/qc-workflow/sla/metrics': {
          get: {
            summary: 'Get SLA performance metrics',
            security: [{ bearerAuth: [] }],
            tags: ['QC Workflow - SLA Tracking'],
            parameters: [
              { name: 'period', in: 'query', schema: { type: 'string', enum: ['TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'], default: 'WEEK' } },
              { name: 'entityType', in: 'query', schema: { type: 'string', enum: ['QC_REVIEW', 'REVISION', 'ESCALATION'] } }
            ],
            responses: {
              '200': {
                description: 'SLA metrics retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        totalTracked: { type: 'number', example: 150 },
                        onTrack: { type: 'number', example: 110 },
                        atRisk: { type: 'number', example: 25 },
                        breached: { type: 'number', example: 10 },
                        waived: { type: 'number', example: 5 },
                        averageCompletionMinutes: { type: 'number', example: 95.7 },
                        onTimePercentage: { type: 'number', example: 93.3 },
                        breachRate: { type: 'number', example: 6.7 }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  public async start(): Promise<void> {
    try {
      // Run service health check on startup
      await this.performStartupHealthCheck();
      
      // Initialize database connection
      await this.initializeDatabase();
      // Start background jobs
      this.startBackgroundJobs();
      
      this.app.listen(this.port, () => {
        this.logger.info(`Appraisal Management API Server running on port ${this.port}`);
        this.logger.info(`API Documentation available at http://localhost:${this.port}/api-docs`);
        this.logger.info(`Health check available at http://localhost:${this.port}/health`);
        this.logger.info(`Service diagnostics: http://localhost:${this.port}/api/health/services`);
        this.logger.info(`Database: Connected to Cosmos DB`);
      });
    } catch (error) {
      this.logger.error('Failed to start API server', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  }

  /**
   * Start background jobs
   */
  private startBackgroundJobs(): void {
    // Start vendor timeout checker (Phase 4.2) - pass dbService
    this.vendorTimeoutJob = new VendorTimeoutCheckerJob(this.dbService);
    this.vendorTimeoutJob.start();

    // Start SLA monitoring job (Phase 3.3)
    this.slaMonitoringJob = new SLAMonitoringJob(this.dbService);
    this.slaMonitoringJob.start();

    // Start overdue order detection job (Phase 3.4)
    this.overdueDetectionJob = new OverdueOrderDetectionJob(this.dbService);
    this.overdueDetectionJob.start();

    // Start event-driven notification orchestrator (Phase E)
    // Subscribes to Service Bus events and routes to WebSocket/Email/SMS channels
    try {
      this.eventOrchestrator = new EventNotificationOrchestrator();
      this.eventOrchestrator.start().catch(err => {
        this.logger.warn('Event notification orchestrator failed to start — events will not be processed', {
          error: err instanceof Error ? err.message : String(err)
        });
      });
    } catch (err) {
      this.logger.warn('Event notification orchestrator could not be created — real-time notifications disabled', {
        error: err instanceof Error ? err.message : String(err)
      });
    }

    this.logger.info('✅ Background jobs started', {
      jobs: ['vendor-timeout-checker', 'sla-monitoring', 'overdue-order-detection', 'event-notification-orchestrator']
    });
  }

  /**
   * Stop background jobs (for graceful shutdown)
   */
  public stopBackgroundJobs(): void {
    if (this.vendorTimeoutJob) {
      this.vendorTimeoutJob.stop();
    }
    if (this.slaMonitoringJob) {
      this.slaMonitoringJob.stop();
    }
    if (this.overdueDetectionJob) {
      this.overdueDetectionJob.stop();
    }
    if (this.eventOrchestrator) {
      this.eventOrchestrator.stop().catch(() => {});
    }
    this.logger.info('Background jobs stopped');
  }

  /**
   * Perform health check on startup to identify configuration issues
   */
  private async performStartupHealthCheck(): Promise<void> {
    try {
      const { ServiceHealthCheckService } = await import('../services/service-health-check.service.js');
      const healthService = new ServiceHealthCheckService();
      const report = await healthService.performHealthCheck();
      
      this.logger.info('Startup Health Check', {
        status: report.overallStatus,
        healthyServices: report.summary.healthyServices,
        unavailableServices: report.summary.unavailableServices
      });
      
      // Log warnings but don't block startup
      if (report.summary.criticalIssues.length > 0) {
        this.logger.warn('Critical Issues Detected:', {
          issues: report.summary.criticalIssues
        });
      }
      
      if (report.summary.warnings.length > 0) {
        this.logger.warn('Configuration Warnings:', {
          warnings: report.summary.warnings
        });
      }
      
      if (report.summary.recommendations.length > 0) {
        this.logger.info('Configuration Recommendations:', {
          recommendations: report.summary.recommendations
        });
      }
    } catch (error) {
      this.logger.warn('Health check failed during startup', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Don't block startup if health check fails
    }
  }

  public getExpressApp(): express.Application {
    return this.app;
  }
}

// Export for use
export default AppraisalManagementAPIServer;
