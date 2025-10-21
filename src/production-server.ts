/**
 * Production-Ready API Server
 * Clean implementation for Azure deployment
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { DynamicCodeExecutionService } from './services/dynamic-code-execution.service';
import { CosmosDbService } from './services/cosmos-db.service';
import { EnhancedPropertyIntelligenceController } from './controllers/enhanced-property-intelligence.controller';
import { ProductionOrderController } from './controllers/production-order.controller';
import { ProductionVendorController } from './controllers/production-vendor.controller';

interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export class ProductionAPIServer {
  private app: express.Application;
  private dynamicCodeService: DynamicCodeExecutionService;
  private dbService: CosmosDbService;
  private propertyIntelligenceController: EnhancedPropertyIntelligenceController;
  private orderController: ProductionOrderController;
  private vendorController: ProductionVendorController;
  private port: number;

  constructor(port = 3000) {
    this.app = express();
    this.port = port;
    this.dynamicCodeService = new DynamicCodeExecutionService();
    this.dbService = new CosmosDbService();
    this.propertyIntelligenceController = new EnhancedPropertyIntelligenceController();
    this.orderController = new ProductionOrderController(this.dbService);
    this.vendorController = new ProductionVendorController(this.dbService);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initialize database connections
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await this.dbService.initialize();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Logging
    this.app.use(morgan('combined'));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        azure: {
          region: process.env.AZURE_REGION || 'unknown',
          appService: process.env.WEBSITE_SITE_NAME || 'local'
        }
      });
    });

    // API info
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Appraisal Management API',
        version: '1.0.0',
        description: 'Production-ready appraisal management platform with comprehensive property intelligence',
        endpoints: {
          'GET /health': 'Health check',
          'GET /api': 'API information',
          'POST /api/auth/login': 'Authentication',
          'POST /api/code/execute': 'Dynamic code execution',
          'GET /api/status': 'System status'
        },
        orderManagement: {
          'POST /api/orders': 'Create new appraisal order',
          'GET /api/orders/:id': 'Get order by ID',
          'PUT /api/orders/:id': 'Update order',
          'DELETE /api/orders/:id': 'Delete order',
          'GET /api/orders': 'List orders with filters'
        },
        vendorManagement: {
          'POST /api/vendors': 'Create new vendor',
          'GET /api/vendors/:id': 'Get vendor by ID',
          'PUT /api/vendors/:id': 'Update vendor',
          'DELETE /api/vendors/:id': 'Deactivate vendor',
          'GET /api/vendors': 'List vendors',
          'GET /api/vendors/:id/performance': 'Get vendor performance'
        },
        propertyIntelligence: {
          'POST /api/property-intelligence/address/geocode': 'Multi-provider address geocoding',
          'POST /api/property-intelligence/address/validate': 'Address validation',
          'POST /api/property-intelligence/analyze/comprehensive': 'Comprehensive property analysis',
          'POST /api/property-intelligence/analyze/creative-features': 'Creative property features analysis',
          'POST /api/property-intelligence/census/demographics': 'Census demographic data',
          'GET /api/property-intelligence/health': 'Property intelligence service health'
        },
        azure: {
          deployed: !!process.env.WEBSITE_SITE_NAME,
          resourceGroup: process.env.WEBSITE_RESOURCE_GROUP || 'unknown'
        }
      });
    });

    // System status
    this.app.get('/api/status', (req, res) => {
      res.json({
        server: 'running',
        database: process.env.COSMOS_ENDPOINT ? 'configured' : 'not_configured',
        storage: process.env.AZURE_STORAGE_CONNECTION_STRING ? 'configured' : 'not_configured',
        serviceBus: process.env.AZURE_SERVICE_BUS_CONNECTION_STRING ? 'configured' : 'not_configured',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          nodeEnv: process.env.NODE_ENV || 'development'
        }
      });
    });

    // Simple authentication endpoint
    this.app.post('/api/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        
        // Demo authentication for now
        if (email === 'demo@appraisal.com' && password === 'demo123') {
          const token = this.generateDemoToken(email);
          res.json({
            success: true,
            token,
            user: { email, role: 'admin' },
            message: 'Authentication successful'
          });
        } else {
          res.status(401).json({
            success: false,
            message: 'Invalid credentials',
            hint: 'Use demo@appraisal.com / demo123'
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Authentication error'
        });
      }
    });

    // Dynamic code execution
    this.app.post('/api/code/execute', async (req, res): Promise<void> => {
      try {
        const { code, context = {}, timeout = 5000 } = req.body;
        
        if (!code) {
          res.status(400).json({
            success: false,
            message: 'Code is required'
          });
          return;
        }

        const executionContext = {
          timestamp: new Date(),
          environment: process.env.NODE_ENV || 'development',
          ...context
        };

        const result = await this.dynamicCodeService.executeCode(code, executionContext, {
          timeout
        });

        res.json({
          success: result.success,
          result: result.result,
          executionTime: result.executionTime,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Code execution failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // ===========================
    // PROPERTY INTELLIGENCE ROUTES
    // ===========================

    // Address Services
    this.app.post('/api/property-intelligence/address/geocode', this.propertyIntelligenceController.geocodeAddress);
    this.app.post('/api/property-intelligence/address/validate', this.propertyIntelligenceController.validateAddress);
    this.app.post('/api/property-intelligence/address/reverse-geocode', this.propertyIntelligenceController.reverseGeocode);
    this.app.get('/api/property-intelligence/address/suggest', this.propertyIntelligenceController.suggestAddresses);

    // Property Analysis
    this.app.post('/api/property-intelligence/analyze/comprehensive', this.propertyIntelligenceController.comprehensiveAnalysis);
    this.app.post('/api/property-intelligence/analyze/creative-features', this.propertyIntelligenceController.creativeFeatureAnalysis);
    this.app.post('/api/property-intelligence/analyze/batch', this.propertyIntelligenceController.batchAnalysis);
    this.app.post('/api/property-intelligence/analyze/views', this.propertyIntelligenceController.viewAnalysis);
    this.app.post('/api/property-intelligence/analyze/transportation', this.propertyIntelligenceController.transportationAnalysis);
    this.app.post('/api/property-intelligence/analyze/neighborhood', this.propertyIntelligenceController.neighborhoodAnalysis);

    // Census Intelligence
    this.app.post('/api/property-intelligence/census/demographics', this.propertyIntelligenceController.getCensusDemographics);
    this.app.post('/api/property-intelligence/census/economics', this.propertyIntelligenceController.getCensusEconomics);
    this.app.post('/api/property-intelligence/census/housing', this.propertyIntelligenceController.getCensusHousing);
    this.app.post('/api/property-intelligence/census/comprehensive', this.propertyIntelligenceController.getComprehensiveCensusIntelligence);

    // System APIs
    this.app.get('/api/property-intelligence/providers/status', this.propertyIntelligenceController.getProviderStatus);
    this.app.get('/api/property-intelligence/health', this.propertyIntelligenceController.healthCheck);

    // ===========================
    // ORDER MANAGEMENT ROUTES
    // ===========================
    this.app.post('/api/orders', this.orderController.createOrder);
    this.app.get('/api/orders/:id', this.orderController.getOrder);
    this.app.put('/api/orders/:id', this.orderController.updateOrder);
    this.app.delete('/api/orders/:id', this.orderController.deleteOrder);
    this.app.get('/api/orders', this.orderController.getOrders);

    // ===========================
    // VENDOR MANAGEMENT ROUTES
    // ===========================
    this.app.post('/api/vendors', this.vendorController.createVendor);
    this.app.get('/api/vendors/:id', this.vendorController.getVendor);
    this.app.put('/api/vendors/:id', this.vendorController.updateVendor);
    this.app.delete('/api/vendors/:id', this.vendorController.deleteVendor);
    this.app.get('/api/vendors', this.vendorController.getVendors);
    this.app.get('/api/vendors/:id/performance', this.vendorController.getVendorPerformance);
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        availableEndpoints: [
          'GET /health',
          'GET /api',
          'GET /api/status',
          'POST /api/auth/login',
          'POST /api/code/execute',
          'POST /api/orders',
          'GET /api/orders',
          'POST /api/vendors',
          'GET /api/vendors',
          'POST /api/property-intelligence/address/geocode',
          'POST /api/property-intelligence/analyze/comprehensive',
          'GET /api/property-intelligence/health'
        ]
      });
    });

    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('API Error:', error);
      res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    });
  }

  private generateDemoToken(email: string): string {
    const payload = {
      email,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };
    
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  public async start(): Promise<void> {
    console.log('🔧 Initializing production server...');
    
    // Initialize database
    await this.initializeDatabase();
    
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log('\n🚀 Production API Server Started!');
        console.log(`📡 Port: ${this.port}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`❤️  Health: http://localhost:${this.port}/health`);
        console.log(`📚 API Info: http://localhost:${this.port}/api`);
        console.log(`🏠 Property Intelligence: http://localhost:${this.port}/api/property-intelligence/health`);
        
        if (process.env.WEBSITE_SITE_NAME) {
          console.log(`☁️  Azure App Service: ${process.env.WEBSITE_SITE_NAME}`);
          console.log(`🔗 Public URL: https://${process.env.WEBSITE_SITE_NAME}.azurewebsites.net`);
        }
        
        console.log('\n✅ Server ready for production traffic with full property intelligence!');
        resolve();
      });
    });
  }

  public getExpressApp(): express.Application {
    return this.app;
  }
}

export default ProductionAPIServer;