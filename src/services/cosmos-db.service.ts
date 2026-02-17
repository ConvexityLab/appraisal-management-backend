import { CosmosClient, Database, Container, ItemResponse, FeedResponse } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { 
  AppraisalOrder, 
  Vendor, 
  OrderFilters, 
  PropertyDetails,
  PropertyAddress,
  ApiResponse
} from '../types/index.js';
import { 
  PropertySummary, 
  CreatePropertySummaryRequest 
} from '../types/property-enhanced.js';
import { Logger } from '../utils/logger.js';
import { createApiError, ErrorCodes } from '../utils/api-response.util.js';

/**
 * Comprehensive Azure Cosmos DB Service for Appraisal Management Platform
 * Unified service providing production-ready database operations with global scale and enterprise features
 * Includes local emulator support for development and testing
 */
export class CosmosDbService {
  private logger: Logger;
  private client: CosmosClient | null = null;
  private database: Database | null = null;
  private isConnected: boolean = false;

  // Container references
  private ordersContainer: Container | null = null;
  private vendorsContainer: Container | null = null;
  private usersContainer: Container | null = null;
  private propertiesContainer: Container | null = null;
  private propertySummariesContainer: Container | null = null;
  private qcReviewsContainer: Container | null = null;
  private qcResultsContainer: Container | null = null;
  private qcChecklistsContainer: Container | null = null;
  private qcExecutionsContainer: Container | null = null;
  private qcSessionsContainer: Container | null = null;
  private qcTemplatesContainer: Container | null = null;
  private analyticsContainer: Container | null = null;
  private rovRequestsContainer: Container | null = null;
  private templatesContainer: Container | null = null;
  private reviewsContainer: Container | null = null;
  private comparableAnalysesContainer: Container | null = null;
  private documentsContainer: Container | null = null;

  private readonly databaseId = 'appraisal-management';
  private readonly containers = {
    orders: 'orders',
    vendors: 'vendors',
    users: 'users',
    properties: 'properties',
    propertySummaries: 'property-summaries',
    qcReviews: 'qc-reviews',           // Master QC Review records
    qcResults: 'results',              // QC execution results (legacy/detailed)
    qcChecklists: 'criteria',          // QC checklist templates
    qcExecutions: 'reviews',           // QC executions (legacy)
    qcSessions: 'sessions',
    qcTemplates: 'templates',
    analytics: 'analytics',
    rovRequests: 'rov-requests',
    documentTemplates: 'document-templates',
    reviews: 'appraisal-reviews',
    comparableAnalyses: 'comparable-analyses',
    documents: 'documents',
    communicationContexts: 'communicationContexts',      // Unified communication platform
    communicationTranscripts: 'communicationTranscripts',// Chat/call/meeting transcripts
    aiInsights: 'aiInsights'                              // AI-generated insights
  };

  constructor(
    private endpoint: string = process.env.COSMOS_ENDPOINT || process.env.AZURE_COSMOS_ENDPOINT || ''
  ) {
    this.logger = new Logger();
    
    // Validate required configuration
    if (!this.endpoint) {
      const error = 'Cosmos DB endpoint is required. Set AZURE_COSMOS_ENDPOINT environment variable.';
      this.logger.error(error);
      
      if (process.env.NODE_ENV === 'development' && process.env.COSMOS_USE_EMULATOR === 'true') {
        this.endpoint = 'https://localhost:8081';
        this.logger.warn('Using Cosmos DB Emulator - set COSMOS_USE_EMULATOR=true only for local development');
      } else {
        throw new Error(error);
      }
    }
  }

  /**
   * Initialize Cosmos DB connection and containers
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Azure Cosmos DB connection with Managed Identity');

      if (!this.endpoint) {
        throw new Error('Cosmos DB endpoint must be provided');
      }

      // Initialize Cosmos client with managed identity support
      const isEmulator = this.endpoint.includes('localhost') || this.endpoint.includes('127.0.0.1');
      const clientOptions: any = {
        endpoint: this.endpoint
      };

      if (isEmulator) {
        // Configure for local emulator (uses emulator key)
        const https = require('https');
        clientOptions.key = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
        clientOptions.agent = new https.Agent({
          rejectUnauthorized: false
        });
        clientOptions.connectionPolicy = {
          requestTimeout: 30000,
          enableEndpointDiscovery: false
        };
        this.logger.info('Detected Cosmos DB Emulator - using local configuration with emulator key');
      } else {
        // Configure for production with Managed Identity
        const credential = new DefaultAzureCredential();
        clientOptions.aadCredentials = credential;
        clientOptions.connectionPolicy = {
          requestTimeout: 30000,
          enableEndpointDiscovery: true,
          preferredLocations: ['East US', 'West US', 'Central US']
        };
        this.logger.info('Using Managed Identity for Cosmos DB authentication');
      }

      this.client = new CosmosClient(clientOptions);

      // Connect to existing database (provisioned via Bicep)
      this.database = this.client.database(this.databaseId);

      // Connect to existing containers (provisioned via Bicep)
      this.ordersContainer = this.database.container(this.containers.orders);
      this.vendorsContainer = this.database.container(this.containers.vendors);
      this.usersContainer = this.database.container(this.containers.users);
      this.propertiesContainer = this.database.container(this.containers.properties);
      this.propertySummariesContainer = this.database.container(this.containers.propertySummaries);
      this.qcReviewsContainer = this.database.container(this.containers.qcReviews);
      this.qcResultsContainer = this.database.container(this.containers.qcResults);
      this.qcChecklistsContainer = this.database.container(this.containers.qcChecklists);
      this.qcExecutionsContainer = this.database.container(this.containers.qcExecutions);
      this.qcSessionsContainer = this.database.container(this.containers.qcSessions);
      this.qcTemplatesContainer = this.database.container(this.containers.qcTemplates);
      this.analyticsContainer = this.database.container(this.containers.analytics);
      this.rovRequestsContainer = this.database.container(this.containers.rovRequests);
      this.templatesContainer = this.database.container(this.containers.documentTemplates);
      this.reviewsContainer = this.database.container(this.containers.reviews);
      this.comparableAnalysesContainer = this.database.container(this.containers.comparableAnalyses);
      this.documentsContainer = this.database.container(this.containers.documents);

      this.isConnected = true;
      this.logger.info('Successfully connected to Azure Cosmos DB', {
        databaseId: this.databaseId,
        endpoint: this.endpoint
      });

    } catch (error) {
      this.logger.error('Failed to initialize Cosmos DB', { error });
      throw error;
    }
  }

  /**
   * Health check for Cosmos DB connection
   */
  async healthCheck(): Promise<{ status: string; database: string; latency: number }> {
    try {
      const startTime = Date.now();
      
      if (!this.database) {
        throw new Error('Database not connected');
      }

      await this.database.read();
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        database: this.databaseId,
        latency
      };

    } catch (error) {
      this.logger.error('Cosmos DB health check failed', { error });
      throw error;
    }
  }

  /**
   * Check if database is connected
   */
  isDbConnected(): boolean {
    return this.isConnected;
  }

  // ===============================
  // Order Operations
  // ===============================

  async createOrder(order: Omit<AppraisalOrder, 'id'>): Promise<ApiResponse<AppraisalOrder>> {
    try {
      if (!this.ordersContainer) {
        throw new Error('Orders container not initialized');
      }

      const orderWithId = {
        ...order,
        id: this.generateId(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { resource } = await this.ordersContainer.items.create(orderWithId);
      
      this.logger.info('Order created successfully', { orderId: resource?.id });

      return {
        success: true,
        data: resource as AppraisalOrder
      };

    } catch (error) {
      this.logger.error('Failed to create order', { error });
      return {
        success: false,
        error: this.createApiError(
          'CREATE_ORDER_FAILED',
          error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  async findOrderById(id: string): Promise<ApiResponse<AppraisalOrder | null>> {
    try {
      if (!this.ordersContainer) {
        throw new Error('Orders container not initialized');
      }

      // Find by id field - our orders use string IDs like 'order-005'
      // CRITICAL: Filter by type='order' to exclude ROV requests and other document types
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.type = @type AND c.id = @id',
        parameters: [
          { name: '@type', value: 'order' },
          { name: '@id', value: id }
        ]
      };

      const { resources } = await this.ordersContainer.items.query<AppraisalOrder>(querySpec).fetchAll();
      const order = resources.length > 0 ? resources[0] : null;

      return {
        success: true,
        data: order as AppraisalOrder | null
      };

    } catch (error) {
      this.logger.error('Failed to find order', { error, id });
      return {
        success: false,
        data: null,
        error: createApiError(
          ErrorCodes.ORDER_RETRIEVE_FAILED,
          error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  async findOrders(filters: OrderFilters, offset: number = 0, limit: number = 50): Promise<ApiResponse<AppraisalOrder[]>> {
    try {
      if (!this.ordersContainer) {
        throw new Error('Orders container not initialized');
      }

      // CRITICAL: Filter by type='order' to exclude ROV requests and other document types
      let query = 'SELECT * FROM c WHERE c.type = @type';
      const parameters: any[] = [{ name: '@type', value: 'order' }];

      // Build dynamic query based on filters
      if (filters.status && filters.status.length > 0) {
        query += ' AND c.status IN (' + filters.status.map((_, index) => `@status${index}`).join(', ') + ')';
        filters.status.forEach((status, index) => {
          parameters.push({ name: `@status${index}`, value: status });
        });
      }

      if (filters.priority && filters.priority.length > 0) {
        query += ' AND c.priority IN (' + filters.priority.map((_, index) => `@priority${index}`).join(', ') + ')';
        filters.priority.forEach((priority, index) => {
          parameters.push({ name: `@priority${index}`, value: priority });
        });
      }

      if (filters.assignedVendorId) {
        query += ' AND c.assignedVendorId = @assignedVendorId';
        parameters.push({ name: '@assignedVendorId', value: filters.assignedVendorId });
      }

      if (filters.createdFrom) {
        query += ' AND c.createdAt >= @createdFrom';
        parameters.push({ name: '@createdFrom', value: filters.createdFrom.toISOString() });
      }

      if (filters.createdTo) {
        query += ' AND c.createdAt <= @createdTo';
        parameters.push({ name: '@createdTo', value: filters.createdTo.toISOString() });
      }

      query += ' ORDER BY c.createdAt DESC';
      query += ` OFFSET ${offset} LIMIT ${limit}`;

      const querySpec = { query, parameters };
      const { resources } = await this.ordersContainer.items.query<AppraisalOrder>(querySpec).fetchAll();

      // Get total count for pagination
      const countQuery = query.replace('SELECT *', 'SELECT VALUE COUNT(c)').replace(/ OFFSET \d+ LIMIT \d+/, '');
      const { resources: countResources } = await this.ordersContainer.items.query({ 
        query: countQuery, 
        parameters 
      }).fetchAll();
      const total = countResources[0] || 0;

      return {
        success: true,
        data: resources,
        metadata: { total, offset, limit }
      };

    } catch (error) {
      this.logger.error('Failed to find orders', { error, filters });
      return {
        success: false,
        data: [],
        error: createApiError(
          ErrorCodes.ORDER_SEARCH_FAILED,
          error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  async updateOrder(id: string, updates: Partial<AppraisalOrder>): Promise<ApiResponse<AppraisalOrder>> {
    try {
      if (!this.ordersContainer) {
        throw new Error('Orders container not initialized');
      }

      // First, get the existing order
      const existingResponse = await this.findOrderById(id);
      if (!existingResponse.success || !existingResponse.data) {
        return {
          success: false,
          error: createApiError(
            ErrorCodes.ORDER_NOT_FOUND,
            `Order with id ${id} not found`
          )
        };
      }

      const updatedOrder = {
        ...existingResponse.data,
        ...updates,
        updatedAt: new Date()
      };

      // Use clientId as partition key (not status)
      const { resource } = await this.ordersContainer.item(id, updatedOrder.clientId).replace(updatedOrder);

      return {
        success: true,
        data: resource as AppraisalOrder
      };

    } catch (error) {
      this.logger.error('Failed to update order', { error, id });
      return {
        success: false,
        error: createApiError(ErrorCodes.ORDER_UPDATE_FAILED, error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  async deleteOrder(id: string, partitionKey: string): Promise<ApiResponse<boolean>> {
    try {
      if (!this.ordersContainer) {
        throw new Error('Orders container not initialized');
      }

      await this.ordersContainer.item(id, partitionKey).delete();

      return {
        success: true,
        data: true
      };

    } catch (error) {
      this.logger.error('Failed to delete order', { error, id });
      return {
        success: false,
        data: false,
        error: createApiError(ErrorCodes.ORDER_DELETE_FAILED, error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  // ===============================
  // Vendor Operations
  // ===============================

  async createVendor(vendor: Omit<Vendor, 'id' | 'onboardingDate' | 'lastActive'>): Promise<ApiResponse<Vendor>> {
    try {
      if (!this.vendorsContainer) {
        throw new Error('Vendors container not initialized');
      }

      const vendorWithId = {
        ...vendor,
        id: this.generateId(),
        onboardingDate: new Date(),
        lastActive: new Date()
      };

      const { resource } = await this.vendorsContainer.items.create(vendorWithId);
      
      this.logger.info('Vendor created successfully', { vendorId: resource?.id });

      return {
        success: true,
        data: resource as Vendor
      };

    } catch (error) {
      this.logger.error('Failed to create vendor', { error });
      return {
        success: false,
        error: createApiError(ErrorCodes.VENDOR_CREATE_FAILED, error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  async findVendorById(id: string): Promise<ApiResponse<Vendor | null>> {
    try {
      if (!this.vendorsContainer) {
        throw new Error('Vendors container not initialized');
      }

      console.log('\n\n=== FIND VENDOR BY ID ===');
      console.log('Looking for vendor ID:', id);
      console.log('Container:', this.vendorsContainer ? 'initialized' : 'NOT initialized');

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      };

      console.log('Query:', JSON.stringify(querySpec, null, 2));

      // Enable cross-partition query since we don't know the partition key (licenseState)
      const { resources } = await this.vendorsContainer.items
        .query<Vendor>(querySpec, { maxItemCount: 1 })
        .fetchAll();
      
      console.log('Query returned resources count:', resources.length);
      if (resources.length > 0) {
        console.log('Found vendor:', resources[0].id, resources[0].businessName);
        console.log('Vendor has certifications:', !!resources[0].certifications, 'length:', resources[0].certifications?.length);
        console.log('Vendor has paymentHistory:', !!resources[0].paymentHistory, 'length:', resources[0].paymentHistory?.length);
      } else {
        console.log('NO VENDOR FOUND IN COSMOS DB');
      }
      console.log('=== END FIND VENDOR ===\n\n');

      const vendor = resources.length > 0 ? resources[0] : null;

      return {
        success: true,
        data: vendor as Vendor | null
      };

    } catch (error) {
      this.logger.error('Failed to find vendor', { error, id });
      return {
        success: false,
        data: null,
        error: createApiError('FIND_VENDOR_FAILED', error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  // ===============================
  // Property Operations
  // ===============================

  async createPropertySummary(property: CreatePropertySummaryRequest): Promise<ApiResponse<PropertySummary>> {
    try {
      if (!this.propertySummariesContainer) {
        throw new Error('Property summaries container not initialized');
      }

      const propertyWithId: PropertySummary = {
        ...property,
        id: this.generateId(),
        building: property.building || {},
        valuation: property.valuation || {},
        owner: {
          fullName: '',
          ownerOccupied: false
        },
        quickLists: {
          vacant: false,
          ownerOccupied: false,
          freeAndClear: false,
          highEquity: false,
          activeForSale: false,
          recentlySold: false
        },
        lastUpdated: new Date(),
        dataSource: 'internal'
      };

      const { resource } = await this.propertySummariesContainer.items.create(propertyWithId);
      
      this.logger.info('Property summary created successfully', { propertyId: resource?.id });

      return {
        success: true,
        data: resource as PropertySummary
      };

    } catch (error) {
      this.logger.error('Failed to create property summary', { error });
      return {
        success: false,
        error: createApiError(ErrorCodes.PROPERTY_CREATE_FAILED, error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  async findPropertySummaryById(id: string): Promise<ApiResponse<PropertySummary | null>> {
    try {
      if (!this.propertySummariesContainer) {
        throw new Error('Property summaries container not initialized');
      }

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      };

      const { resources } = await this.propertySummariesContainer.items.query<PropertySummary>(querySpec).fetchAll();
      const property = resources.length > 0 ? resources[0] : null;

      return {
        success: true,
        data: property as PropertySummary | null
      };

    } catch (error) {
      this.logger.error('Failed to find property summary', { error, id });
      return {
        success: false,
        data: null,
        error: createApiError('FIND_PROPERTY_FAILED', error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  async searchPropertySummaries(filters: any, offset: number = 0, limit: number = 50): Promise<ApiResponse<PropertySummary[]>> {
    try {
      if (!this.propertySummariesContainer) {
        throw new Error('Property summaries container not initialized');
      }

      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Handle property type - support both array and string formats
      if (filters.propertyType) {
        if (Array.isArray(filters.propertyType) && filters.propertyType.length > 0) {
          query += ' AND c.propertyType IN (' + filters.propertyType.map((_: any, index: number) => `@type${index}`).join(', ') + ')';
          filters.propertyType.forEach((type: any, index: number) => {
            parameters.push({ name: `@type${index}`, value: type });
          });
        } else if (typeof filters.propertyType === 'string') {
          query += ' AND c.propertyType = @propertyType';
          parameters.push({ name: '@propertyType', value: filters.propertyType });
        }
      }

      // Handle state - support both nested and flat structures
      const state = filters.state || filters.address?.state;
      if (state) {
        query += ' AND c.address.state = @state';
        parameters.push({ name: '@state', value: state });
      }

      // Handle city - support both nested and flat structures
      const city = filters.city || filters.address?.city;
      if (city) {
        query += ' AND c.address.city = @city';
        parameters.push({ name: '@city', value: city });
      }

      // Handle value range - support both nested and flat structures
      const minValue = filters.minValue || filters.priceRange?.min;
      const maxValue = filters.maxValue || filters.priceRange?.max;
      
      if (minValue) {
        query += ' AND c.valuation.estimatedValue >= @minPrice';
        parameters.push({ name: '@minPrice', value: minValue });
      }
      
      if (maxValue) {
        query += ' AND c.valuation.estimatedValue <= @maxPrice';
        parameters.push({ name: '@maxPrice', value: maxValue });
      }

      query += ' ORDER BY c.lastUpdated DESC';
      query += ` OFFSET ${offset} LIMIT ${limit}`;

      const querySpec = { query, parameters };
      const { resources } = await this.propertySummariesContainer.items.query<PropertySummary>(querySpec).fetchAll();

      return {
        success: true,
        data: resources,
        metadata: { total: resources.length, offset, limit }
      };

    } catch (error) {
      this.logger.error('Failed to search property summaries', { error, filters });
      return {
        success: false,
        data: [],
        error: createApiError('SEARCH_PROPERTIES_FAILED', error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  // ===============================
  // QC Results Operations
  // ===============================

  async createQCResult(qcResult: any): Promise<ApiResponse<any>> {
    try {
      if (!this.qcResultsContainer) {
        throw new Error('QC results container not initialized');
      }

      const qcResultWithId = {
        ...qcResult,
        id: this.generateId(),
        validatedAt: new Date()
      };

      const { resource } = await this.qcResultsContainer.items.create(qcResultWithId);
      
      this.logger.info('QC result created successfully', { qcResultId: resource?.id });

      return {
        success: true,
        data: resource
      };

    } catch (error) {
      this.logger.error('Failed to create QC result', { error });
      return {
        success: false,
        error: createApiError('CREATE_QC_RESULT_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  async findQCResultByOrderId(orderId: string): Promise<ApiResponse<any | null>> {
    try {
      if (!this.qcResultsContainer) {
        throw new Error('QC results container not initialized');
      }

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.validatedAt DESC',
        parameters: [{ name: '@orderId', value: orderId }]
      };

      const { resources } = await this.qcResultsContainer.items.query(querySpec).fetchAll();
      const qcResult = resources.length > 0 ? resources[0] : null;

      return {
        success: true,
        data: qcResult
      };

    } catch (error) {
      this.logger.error('Failed to find QC result', { error, orderId });
      return {
        success: false,
        data: null,
        error: createApiError('FIND_QC_RESULT_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  async getQCMetrics(): Promise<ApiResponse<any>> {
    try {
      if (!this.qcResultsContainer) {
        throw new Error('QC results container not initialized');
      }

      // Get overall QC metrics using separate queries
      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 3); // Last 3 months

      const avgScoreQuery = `
        SELECT AVG(c.qcScore) as averageScore, COUNT(1) as totalValidations
        FROM c
        WHERE c.validatedAt >= @fromDate
      `;
      const highScoreQuery = `
        SELECT VALUE COUNT(1)
        FROM c
        WHERE c.validatedAt >= @fromDate AND c.qcScore >= 90
      `;
      const lowScoreQuery = `
        SELECT VALUE COUNT(1)
        FROM c
        WHERE c.validatedAt >= @fromDate AND c.qcScore < 70
      `;

      const [avgScoreResult, highScoreResult, lowScoreResult] = await Promise.all([
        this.qcResultsContainer.items.query({
          query: avgScoreQuery,
          parameters: [{ name: '@fromDate', value: fromDate.toISOString() }]
        }).fetchAll(),
        this.qcResultsContainer.items.query({
          query: highScoreQuery,
          parameters: [{ name: '@fromDate', value: fromDate.toISOString() }]
        }).fetchAll(),
        this.qcResultsContainer.items.query({
          query: lowScoreQuery,
          parameters: [{ name: '@fromDate', value: fromDate.toISOString() }]
        }).fetchAll()
      ]);

      const metrics = avgScoreResult.resources[0] || { averageScore: 0, totalValidations: 0 };
      const highScoreCount = highScoreResult.resources[0] || 0;
      const lowScoreCount = lowScoreResult.resources[0] || 0;

      return {
        success: true,
        data: {
          overallQCScore: metrics.averageScore || 0,
          totalValidations: metrics.totalValidations || 0,
          highScoreRate: metrics.totalValidations > 0 ? (highScoreCount / metrics.totalValidations) * 100 : 0,
          lowScoreRate: metrics.totalValidations > 0 ? (lowScoreCount / metrics.totalValidations) * 100 : 0,
          validationCounts: {
            total: metrics.totalValidations || 0,
            highScore: highScoreCount || 0,
            lowScore: lowScoreCount || 0
          },
          trendAnalysis: {
            period: '3 months',
            averageScore: metrics.averageScore || 0
          }
        }
      };

    } catch (error) {
      this.logger.error('Failed to get QC metrics', { error });
      return {
        success: false,
        error: createApiError('GET_QC_METRICS_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  // ===============================
  // Analytics Operations
  // ===============================

  async createAnalyticsReport(report: any): Promise<ApiResponse<any>> {
    try {
      if (!this.analyticsContainer) {
        throw new Error('Analytics container not initialized');
      }

      const reportWithId = {
        ...report,
        id: this.generateId(),
        timestamp: new Date()
      };

      const { resource } = await this.analyticsContainer.items.create(reportWithId);
      
      this.logger.info('Analytics report created successfully', { reportId: resource?.id });

      return {
        success: true,
        data: resource
      };

    } catch (error) {
      this.logger.error('Failed to create analytics report', { error });
      return {
        success: false,
        error: createApiError('CREATE_ANALYTICS_REPORT_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  async getAnalyticsOverview(): Promise<ApiResponse<any>> {
    try {
      if (!this.ordersContainer || !this.vendorsContainer || !this.qcResultsContainer) {
        throw new Error('Required containers not initialized');
      }

      // Get order statistics using separate queries
      const totalOrdersQuery = 'SELECT VALUE COUNT(1) FROM c';
      const completedOrdersQuery = 'SELECT VALUE COUNT(1) FROM c WHERE c.status = "completed"';
      const avgCompletionQuery = `
        SELECT AVG(DateDiff('day', c.createdAt, c.completedAt)) as avgCompletionDays
        FROM c 
        WHERE c.status = 'completed' AND c.completedAt != null
      `;

      const [totalOrdersResult, completedOrdersResult, avgCompletionResult] = await Promise.all([
        this.ordersContainer.items.query(totalOrdersQuery).fetchAll(),
        this.ordersContainer.items.query(completedOrdersQuery).fetchAll(),
        this.ordersContainer.items.query(avgCompletionQuery).fetchAll()
      ]);

      const totalOrders = totalOrdersResult.resources[0] || 0;
      const completedOrders = completedOrdersResult.resources[0] || 0;
      const avgCompletionDays = avgCompletionResult.resources[0]?.avgCompletionDays || 0;

      // Get QC pass rate using separate queries
      const totalQcQuery = 'SELECT VALUE COUNT(1) FROM c';
      const passCountQuery = 'SELECT VALUE COUNT(1) FROM c WHERE c.qcScore >= 85';
      const avgQcQuery = 'SELECT AVG(c.qcScore) as avgQcScore FROM c';

      const [totalQcResult, passCountResult, avgQcResult] = await Promise.all([
        this.qcResultsContainer.items.query(totalQcQuery).fetchAll(),
        this.qcResultsContainer.items.query(passCountQuery).fetchAll(),
        this.qcResultsContainer.items.query(avgQcQuery).fetchAll()
      ]);

      const totalQc = totalQcResult.resources[0] || 0;
      const passCount = passCountResult.resources[0] || 0;
      const avgQcScore = avgQcResult.resources[0]?.avgQcScore || 0;

      // Get top vendors
      const topVendorsQuery = `
        SELECT TOP 5 
          c.assignedVendorId,
          COUNT(c) as completedOrders
        FROM c 
        WHERE c.status = 'completed' AND c.assignedVendorId != null
        GROUP BY c.assignedVendorId
        ORDER BY COUNT(c) DESC
      `;

      const { resources: topVendors } = await this.ordersContainer.items.query({
        query: topVendorsQuery
      }).fetchAll();

      return {
        success: true,
        data: {
          totalOrders: totalOrders,
          completedOrders: completedOrders,
          averageCompletionTime: avgCompletionDays,
          qcPassRate: totalQc > 0 ? (passCount / totalQc) * 100 : 0,
          topVendors: await this.calculateTopVendorRatings(topVendors),
          monthlyTrends: await this.calculateMonthlyTrends()
        }
      };

    } catch (error) {
      this.logger.error('Failed to get analytics overview', { error });
      return {
        success: false,
        error: createApiError('GET_ANALYTICS_OVERVIEW_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  async getPerformanceAnalytics(params: {
    startDate?: string;
    endDate?: string;
    groupBy?: string;
  }): Promise<ApiResponse<any>> {
    try {
      if (!this.ordersContainer || !this.qcResultsContainer) {
        throw new Error('Required containers not initialized');
      }

      const { startDate, endDate, groupBy = 'day' } = params;
      
      // Mock implementation - in production, you'd build complex time-series queries
      return {
        success: true,
        data: {
          timeframe: {
            startDate,
            endDate,
            groupBy
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
        }
      };

    } catch (error) {
      this.logger.error('Failed to get performance analytics', { error });
      return {
        success: false,
        error: createApiError('GET_PERFORMANCE_ANALYTICS_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  // ===============================
  // Enhanced Vendor Operations
  // ===============================

  async findAllVendors(): Promise<ApiResponse<Vendor[]>> {
    try {
      if (!this.vendorsContainer) {
        throw new Error('Vendors container not initialized');
      }

      const querySpec = {
        query: 'SELECT * FROM c ORDER BY c.onboardingDate DESC'
      };

      const { resources } = await this.vendorsContainer.items.query<Vendor>(querySpec).fetchAll();

      return {
        success: true,
        data: resources
      };

    } catch (error) {
      this.logger.error('Failed to find all vendors', { error });
      return {
        success: false,
        data: [],
        error: createApiError('FIND_ALL_VENDORS_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  async updateVendor(id: string, updates: Partial<Vendor>): Promise<ApiResponse<Vendor>> {
    try {
      if (!this.vendorsContainer) {
        throw new Error('Vendors container not initialized');
      }

      // First, get the existing vendor
      const existingResponse = await this.findVendorById(id);
      if (!existingResponse.success || !existingResponse.data) {
        return {
          success: false,
          error: createApiError('VENDOR_NOT_FOUND', `Vendor with id ${id} not found`)
        };
      }

      const updatedVendor = {
        ...existingResponse.data,
        ...updates,
        lastActive: new Date()
      };

      const { resource } = await this.vendorsContainer.item(id, updatedVendor.licenseState).replace(updatedVendor);

      return {
        success: true,
        data: resource as Vendor
      };

    } catch (error) {
      this.logger.error('Failed to update vendor', { error, id });
      return {
        success: false,
        error: createApiError('VENDOR_UPDATE_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  async getVendorPerformance(vendorId: string): Promise<ApiResponse<any>> {
    try {
      if (!this.ordersContainer || !this.qcResultsContainer) {
        throw new Error('Required containers not initialized');
      }

      // Get vendor order statistics using separate queries
      const totalOrdersQuery = `
        SELECT VALUE COUNT(1)
        FROM c
        WHERE c.assignedVendorId = @vendorId
      `;
      const completedOrdersQuery = `
        SELECT VALUE COUNT(1)
        FROM c
        WHERE c.assignedVendorId = @vendorId AND c.status = 'completed'
      `;
      const avgCompletionQuery = `
        SELECT AVG(DateDiff('day', c.assignedAt, c.completedAt)) as avgCompletionDays
        FROM c
        WHERE c.assignedVendorId = @vendorId AND c.status = 'completed' AND c.completedAt != null
      `;

      const [totalOrdersResult, completedOrdersResult, avgCompletionResult] = await Promise.all([
        this.ordersContainer.items.query({
          query: totalOrdersQuery,
          parameters: [{ name: '@vendorId', value: vendorId }]
        }).fetchAll(),
        this.ordersContainer.items.query({
          query: completedOrdersQuery,
          parameters: [{ name: '@vendorId', value: vendorId }]
        }).fetchAll(),
        this.ordersContainer.items.query({
          query: avgCompletionQuery,
          parameters: [{ name: '@vendorId', value: vendorId }]
        }).fetchAll()
      ]);

      const totalOrders = totalOrdersResult.resources[0] || 0;
      const completedOrders = completedOrdersResult.resources[0] || 0;
      const avgCompletionDays = avgCompletionResult.resources[0]?.avgCompletionDays || 0;

      const orderStats = [{
        totalOrders,
        completedOrders,
        avgCompletionDays
      }];

      // Get QC performance for this vendor
      const qcStatsQuery = `
        SELECT 
          AVG(c.qcScore) as avgQcScore,
          COUNT(c) as totalQcResults
        FROM c
        JOIN o IN c.orders
        WHERE o.assignedVendorId = @vendorId
      `;

      const { resources: qcStats } = await this.qcResultsContainer.items.query({
        query: qcStatsQuery,
        parameters: [{ name: '@vendorId', value: vendorId }]
      }).fetchAll();

      const orderMetrics = orderStats[0] || {};
      const qcMetrics = qcStats[0] || {};

      return {
        success: true,
        data: {
          vendorId,
          totalOrders: (orderMetrics as any).totalOrders || 0,
          completedOrders: (orderMetrics as any).completedOrders || 0,
          completionRate: (orderMetrics as any).totalOrders > 0 ? ((orderMetrics as any).completedOrders / (orderMetrics as any).totalOrders) * 100 : 0,
          averageCompletionTime: (orderMetrics as any).avgCompletionDays || 0,
          averageQcScore: (qcMetrics as any).avgQcScore || 0,
          totalQcResults: (qcMetrics as any).totalQcResults || 0,
          performanceRating: this.calculatePerformanceRating(orderMetrics, qcMetrics)
        }
      };

    } catch (error) {
      this.logger.error('Failed to get vendor performance', { error, vendorId });
      return {
        success: false,
        error: createApiError('GET_VENDOR_PERFORMANCE_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  // ===============================
  // User Management Methods
  // ===============================

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<ApiResponse<any>> {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected. Call initialize() first.');
      }

      const usersContainer = this.database!.container('users');
      const query = {
        query: 'SELECT * FROM c WHERE c.email = @email',
        parameters: [{ name: '@email', value: email }]
      };

      const { resources } = await usersContainer.items.query(query).fetchAll();
      
      if (resources.length === 0) {
        return {
          success: false,
          error: createApiError('USER_NOT_FOUND', 'User not found')
        };
      }

      return {
        success: true,
        data: resources[0]
      };
    } catch (error) {
      this.logger.error('Failed to get user by email', { error, email });
      return {
        success: false,
        error: createApiError('GET_USER_BY_EMAIL_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  /**
   * Create new user
   */
  async createUser(userData: any): Promise<ApiResponse<any>> {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected. Call initialize() first.');
      }

      const usersContainer = this.database!.container('users');
      
      // Add metadata
      const user = {
        ...userData,
        _ts: Math.floor(Date.now() / 1000),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const { resource } = await usersContainer.items.create(user);
      
      return {
        success: true,
        data: resource
      };
    } catch (error) {
      this.logger.error('Failed to create user', { error, email: userData.email });
      return {
        success: false,
        error: createApiError('CREATE_USER_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  // ===============================
  // Dashboard and Analytics Methods
  // ===============================

  /**
   * Get order summary for dashboard
   */
  async getOrderSummary(): Promise<ApiResponse<any>> {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected. Call initialize() first.');
      }

      const ordersContainer = this.database!.container('orders');
      
      const queries = [
        { query: 'SELECT VALUE COUNT(1) FROM c', status: 'total' },
        { query: 'SELECT VALUE COUNT(1) FROM c WHERE c.status = "pending"', status: 'pending' },
        { query: 'SELECT VALUE COUNT(1) FROM c WHERE c.status = "in_progress"', status: 'inProgress' },
        { query: 'SELECT VALUE COUNT(1) FROM c WHERE c.status = "completed"', status: 'completed' }
      ];

      const results = await Promise.all(
        queries.map(async ({ query, status }) => {
          const { resources } = await ordersContainer.items.query(query).fetchAll();
          return { status, count: resources[0] || 0 };
        })
      );

      const summary = results.reduce((acc, { status, count }) => {
        if (status === 'total') {
          acc.totalOrders = count;
        } else if (status === 'pending') {
          acc.pendingOrders = count;
        } else if (status === 'inProgress') {
          acc.inProgressOrders = count;
        } else if (status === 'completed') {
          acc.completedOrders = count;
        }
        return acc;
      }, { totalOrders: 0, pendingOrders: 0, inProgressOrders: 0, completedOrders: 0 });

      return {
        success: true,
        data: summary
      };
    } catch (error) {
      this.logger.error('Failed to get order summary', { error });
      return {
        success: false,
        error: createApiError('GET_ORDER_SUMMARY_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  /**
   * Get order metrics for dashboard
   */
  async getOrderMetrics(): Promise<ApiResponse<any>> {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected. Call initialize() first.');
      }

      const ordersContainer = this.database!.container('orders');
      
      // Calculate average completion time for completed orders
      const completionQuery = {
        query: `SELECT 
          AVG(DateDiff('day', c.createdAt, c.completedAt)) as avgCompletionTime,
          COUNT(1) as totalCompleted
          FROM c 
          WHERE c.status = 'completed' AND c.completedAt != null`
      };

      const { resources: completionResults } = await ordersContainer.items.query(completionQuery).fetchAll();
      const completionData = completionResults[0] || { avgCompletionTime: 0, totalCompleted: 0 };

      // Calculate on-time delivery rate
      const onTimeQuery = {
        query: `SELECT 
          COUNT(1) as onTimeCount
          FROM c 
          WHERE c.status = 'completed' 
          AND c.completedAt != null 
          AND c.dueDate != null
          AND c.completedAt <= c.dueDate`
      };

      const { resources: onTimeResults } = await ordersContainer.items.query(onTimeQuery).fetchAll();
      const onTimeCount = onTimeResults[0]?.onTimeCount || 0;
      const onTimeDeliveryRate = completionData.totalCompleted > 0 
        ? (onTimeCount / completionData.totalCompleted) * 100 
        : 0;

      // Get QC pass rate (mock for now - would need QC results container)
      const qcPassRate = 96.8; // This would be calculated from actual QC data

      const metrics = {
        averageCompletionTime: Number(completionData.avgCompletionTime?.toFixed(1)) || 0,
        onTimeDeliveryRate: Number(onTimeDeliveryRate.toFixed(1)),
        qcPassRate: qcPassRate
      };

      return {
        success: true,
        data: metrics
      };
    } catch (error) {
      this.logger.error('Failed to get order metrics', { error });
      return {
        success: false,
        error: createApiError('GET_ORDER_METRICS_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  /**
   * Get recent orders for dashboard
   */
  async getRecentOrders(limit: number = 10): Promise<ApiResponse<any[]>> {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected. Call initialize() first.');
      }

      const ordersContainer = this.database!.container('orders');
      
      const query = {
        query: `SELECT TOP @limit * FROM c ORDER BY c._ts DESC`,
        parameters: [{ name: '@limit', value: limit }]
      };

      const { resources } = await ordersContainer.items.query(query).fetchAll();
      
      return {
        success: true,
        data: resources
      };
    } catch (error) {
      this.logger.error('Failed to get recent orders', { error });
      return {
        success: false,
        error: createApiError('GET_RECENT_ORDERS_FAILED', error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }

  // ===============================
  // Utility Methods
  // ===============================

  private calculatePerformanceRating(orderMetrics: any, qcMetrics: any): number {
    // Simple performance rating calculation
    const completionRate = orderMetrics.totalOrders > 0 ? (orderMetrics.completedOrders / orderMetrics.totalOrders) : 0;
    const qcScore = qcMetrics.avgQcScore || 0;
    const timeEfficiency = orderMetrics.avgCompletionDays ? Math.max(0, (10 - orderMetrics.avgCompletionDays) / 10) : 0;
    
    return Math.min(5, (completionRate * 2 + qcScore / 20 + timeEfficiency * 2));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async calculateTopVendorRatings(topVendors: any[]): Promise<any[]> {
    try {
      const vendorRatings = await Promise.all(topVendors.map(async (vendor) => {
        // Calculate real rating based on completed orders and QC scores
        const vendorOrders = await this.getVendorOrders(vendor.assignedVendorId);
        const rating = this.calculateVendorPerformanceRating(vendorOrders);
        
        return {
          vendorId: vendor.assignedVendorId,
          completedOrders: vendor.completedOrders,
          rating: Math.round(rating * 10) / 10 // Round to 1 decimal place
        };
      }));
      
      return vendorRatings;
    } catch (error) {
      this.logger.error('Failed to calculate vendor ratings', { error });
      // Return vendors with null ratings instead of mock data
      return topVendors.map(v => ({
        vendorId: v.assignedVendorId,
        completedOrders: v.completedOrders,
        rating: null
      }));
    }
  }

  private async calculateMonthlyTrends(): Promise<{ orders: number[], qcScores: number[] }> {
    try {
      // Calculate real monthly trends from last 5 months
      const monthlyData = await this.getMonthlyOrderTrends();
      const monthlyQcScores = await this.getMonthlyQcTrends();
      
      return {
        orders: monthlyData,
        qcScores: monthlyQcScores
      };
    } catch (error) {
      this.logger.error('Failed to calculate monthly trends', { error });
      // Return empty arrays instead of mock data
      return {
        orders: [],
        qcScores: []
      };
    }
  }

  private calculateVendorPerformanceRating(orders: any[]): number {
    if (!orders || orders.length === 0) return 0;
    
    // Calculate rating based on completion rate, QC scores, and turnaround time
    let totalScore = 0;
    let completedOrders = 0;
    
    for (const order of orders) {
      if (order.status === 'completed') {
        completedOrders++;
        const qcScore = order.qcResult?.overallScore || 0;
        const timelinessScore = this.calculateTimelinessScore(order);
        totalScore += (qcScore * 0.7 + timelinessScore * 0.3); // Weight QC more heavily
      }
    }
    
    if (completedOrders === 0) return 0;
    return Math.min(5.0, totalScore / completedOrders / 20); // Scale to 5-point rating
  }

  private calculateTimelinessScore(order: any): number {
    // Calculate score based on whether order was completed on time
    if (!order.dueDate || !order.completedDate) return 50; // Neutral score if dates missing
    
    const dueDate = new Date(order.dueDate);
    const completedDate = new Date(order.completedDate);
    const daysDifference = (completedDate.getTime() - dueDate.getTime()) / (1000 * 3600 * 24);
    
    if (daysDifference <= 0) return 100; // Completed early/on time
    if (daysDifference <= 1) return 80;  // 1 day late
    if (daysDifference <= 3) return 60;  // 2-3 days late
    return 20; // More than 3 days late
  }

  private async getVendorOrders(vendorId: string): Promise<any[]> {
    try {
      if (!this.database) {
        throw new Error('Database not initialized');
      }
      
      const container = this.database.container('orders');
      const query = `SELECT * FROM c WHERE c.assignedVendorId = @vendorId AND c.status IN ('completed', 'in_progress')`;
      const result = await container.items.query({
        query,
        parameters: [{ name: '@vendorId', value: vendorId }]
      }).fetchAll();
      
      return result.resources;
    } catch (error) {
      this.logger.error('Failed to get vendor orders', { vendorId, error });
      return [];
    }
  }

  private async getMonthlyOrderTrends(): Promise<number[]> {
    try {
      if (!this.database) {
        throw new Error('Database not initialized');
      }
      
      const container = this.database.container('orders');
      const fiveMonthsAgo = new Date();
      fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
      
      const query = `SELECT VALUE COUNT(1) FROM c WHERE c.createdAt >= @startDate GROUP BY DateTimeFromParts(DateTimePart('year', c.createdAt), DateTimePart('month', c.createdAt), 1, 0, 0, 0, 0) ORDER BY DateTimeFromParts(DateTimePart('year', c.createdAt), DateTimePart('month', c.createdAt), 1, 0, 0, 0, 0)`;
      
      const result = await container.items.query({
        query,
        parameters: [{ name: '@startDate', value: fiveMonthsAgo.toISOString() }]
      }).fetchAll();
      
      return result.resources.slice(-5); // Last 5 months
    } catch (error) {
      this.logger.error('Failed to get monthly order trends', { error });
      return [];
    }
  }

  /**
   * Generic CRUD operations for any container
   */
  async createItem<T>(containerName: string, item: any): Promise<ApiResponse<T>> {
    try {
      if (!this.database) {
        await this.initialize();
      }

      const container = this.database!.container(containerName);
      const response = await container.items.create(item);

      return {
        success: true,
        data: response.resource as T
      };
    } catch (error) {
      this.logger.error('Failed to create item', { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        errorCode: (error as any)?.code,
        errorBody: (error as any)?.body,
        containerName,
        itemId: item?.id,
        hasPartitionKey: !!item?.tenantId
      });
      return {
        success: false,
        error: this.createApiError('CREATE_ITEM_FAILED', `Failed to create item: ${error instanceof Error ? error.message : 'Unknown error'}`)
      };
    }
  }

  async upsertItem<T>(containerName: string, item: any): Promise<ApiResponse<T>> {
    try {
      if (!this.database) {
        await this.initialize();
      }

      const container = this.database!.container(containerName);
      const response = await container.items.upsert(item);

      return {
        success: true,
        data: response.resource as T
      };
    } catch (error) {
      this.logger.error('Failed to upsert item', { error: error instanceof Error ? error.message : 'Unknown error', containerName });
      return {
        success: false,
        error: this.createApiError('UPSERT_ITEM_FAILED', 'Failed to upsert item')
      };
    }
  }

  async getItem<T>(containerName: string, id: string, partitionKey?: string): Promise<ApiResponse<T>> {
    try {
      if (!this.database) {
        await this.initialize();
      }

      const container = this.database!.container(containerName);
      const response = await container.item(id, partitionKey || id).read();

      if (!response.resource) {
        return {
          success: false,
          error: this.createApiError('ITEM_NOT_FOUND', `Item ${id} not found`)
        };
      }

      return {
        success: true,
        data: response.resource as T
      };
    } catch (error) {
      this.logger.error('Failed to get item', { error: error instanceof Error ? error.message : 'Unknown error', containerName, id });
      return {
        success: false,
        error: this.createApiError('GET_ITEM_FAILED', 'Failed to retrieve item')
      };
    }
  }

  async updateItem<T>(containerName: string, id: string, updates: Partial<T>, partitionKey?: string): Promise<ApiResponse<T>> {
    try {
      if (!this.database) {
        await this.initialize();
      }

      const container = this.database!.container(containerName);
      const existingResponse = await container.item(id, partitionKey || id).read();
      
      if (!existingResponse.resource) {
        return {
          success: false,
          error: this.createApiError('ITEM_NOT_FOUND', `Item ${id} not found`)
        };
      }

      const updatedItem = { ...existingResponse.resource, ...updates };
      const response = await container.item(id, partitionKey || id).replace(updatedItem);

      return {
        success: true,
        data: response.resource as T
      };
    } catch (error) {
      this.logger.error('Failed to update item', { error: error instanceof Error ? error.message : 'Unknown error', containerName, id });
      return {
        success: false,
        error: this.createApiError('UPDATE_ITEM_FAILED', 'Failed to update item')
      };
    }
  }

  async deleteItem(containerName: string, id: string, partitionKey?: string): Promise<ApiResponse<boolean>> {
    try {
      if (!this.database) {
        await this.initialize();
      }

      const container = this.database!.container(containerName);
      await container.item(id, partitionKey || id).delete();

      return {
        success: true,
        data: true
      };
    } catch (error) {
      this.logger.error('Failed to delete item', { error: error instanceof Error ? error.message : 'Unknown error', containerName, id });
      return {
        success: false,
        error: this.createApiError('DELETE_ITEM_FAILED', 'Failed to delete item')
      };
    }
  }

  async queryItems<T>(containerName: string, query: string, parameters?: any[]): Promise<ApiResponse<T[]>> {
    try {
      if (!this.database) {
        await this.initialize();
      }

      const container = this.database!.container(containerName);
      const querySpec = {
        query,
        parameters: parameters || []
      };

      const response = await container.items.query(querySpec).fetchAll();

      return {
        success: true,
        data: response.resources as T[]
      };
    } catch (error) {
      this.logger.error('Failed to query items', { error: error instanceof Error ? error.message : 'Unknown error', containerName, query });
      return {
        success: false,
        error: this.createApiError('QUERY_ITEMS_FAILED', 'Failed to query items')
      };
    }
  }

  private async getMonthlyQcTrends(): Promise<number[]> {
    try {
      if (!this.database) {
        throw new Error('Database not initialized');
      }
      
      const container = this.database.container('orders');
      const fiveMonthsAgo = new Date();
      fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);
      
      const query = `SELECT AVG(c.qcResult.overallScore) as avgScore FROM c WHERE c.createdAt >= @startDate AND IS_DEFINED(c.qcResult.overallScore) GROUP BY DateTimeFromParts(DateTimePart('year', c.createdAt), DateTimePart('month', c.createdAt), 1, 0, 0, 0, 0) ORDER BY DateTimeFromParts(DateTimePart('year', c.createdAt), DateTimePart('month', c.createdAt), 1, 0, 0, 0, 0)`;
      
      const result = await container.items.query({
        query,
        parameters: [{ name: '@startDate', value: fiveMonthsAgo.toISOString() }]
      }).fetchAll();
      
      return result.resources.slice(-5).map(r => r.avgScore || 0);
    } catch (error) {
      this.logger.error('Failed to get monthly QC trends', { error });
      return [];
    }
  }



  private createApiError(code: string, message: string, details?: Record<string, any>): any {
    const error: any = {
      code,
      message,
      timestamp: new Date()
    };
    if (details) {
      error.details = details;
    }
    return error;
  }

  // ===============================
  // Generic Document Operations (for QC Workflow and other services)
  // ===============================

  /**
   * Get container by name
   */
  getContainer(containerName: string): Container {
    if (!this.database) {
      throw new Error('Database not initialized');
    }
    return this.database.container(containerName);
  }

  /**
   * Create a document in specified container
   */
  async createDocument<T>(containerName: string, document: T): Promise<T> {
    try {
      const container = this.getContainer(containerName);
      const { resource } = await container.items.create(document as any);
      return resource as T;
    } catch (error) {
      this.logger.error(`Failed to create document in ${containerName}`, { error });
      throw error;
    }
  }

  /**
   * Upsert a document in specified container
   */
  async upsertDocument<T>(containerName: string, document: T): Promise<T> {
    try {
      const container = this.getContainer(containerName);
      const { resource } = await container.items.upsert(document);
      return resource as T;
    } catch (error) {
      this.logger.error(`Failed to upsert document in ${containerName}`, { error });
      throw error;
    }
  }

  /**
   * Get a document by ID from specified container
   */
  async getDocument<T>(containerName: string, documentId: string, partitionKey?: string): Promise<T | null> {
    try {
      const container = this.getContainer(containerName);
      this.logger.info(`Reading document from ${containerName}`, { documentId, partitionKey });
      const { resource } = await container.item(documentId, partitionKey).read();
      this.logger.info(`Document read result`, { documentId, hasResource: !!resource });
      return (resource as T) || null;
    } catch (error: any) {
      if (error.code === 404) {
        this.logger.warn(`Document not found in ${containerName}`, { documentId, partitionKey });
        return null;
      }
      this.logger.error(`Failed to get document from ${containerName}`, { 
        error: {
          message: error?.message,
          code: error?.code,
          statusCode: error?.statusCode,
          body: error?.body,
          name: error?.name,
          stack: error?.stack
        }, 
        documentId,
        partitionKey 
      });
      throw error;
    }
  }

  /**
   * Delete a document from specified container
   */
  async deleteDocument(containerName: string, documentId: string, partitionKey: string): Promise<void> {
    try {
      const container = this.getContainer(containerName);
      await container.item(documentId, partitionKey).delete();
      this.logger.info(`Document deleted from ${containerName}`, { documentId });
    } catch (error) {
      this.logger.error(`Failed to delete document from ${containerName}`, { error, documentId });
      throw error;
    }
  }

  /**
   * Query documents from specified container
   */
  async queryDocuments<T>(containerName: string, query: string, parameters?: { name: string; value: any }[]): Promise<T[]> {
    try {
      const container = this.getContainer(containerName);
      const querySpec = {
        query,
        parameters: parameters || []
      };
      this.logger.info(`Executing query on ${containerName}`, { query, parameters });
      const { resources } = await container.items.query<T>(querySpec).fetchAll();
      this.logger.info(`Query returned ${resources.length} results`);
      return resources;
    } catch (error: any) {
      this.logger.error(`Failed to query documents in ${containerName}`, { 
        error: {
          message: error?.message,
          code: error?.code,
          statusCode: error?.statusCode,
          body: error?.body,
          name: error?.name,
          stack: error?.stack
        },
        query,
        parameters
      });
      throw error;
    }
  }

  // ===============================
  // ROV (Reconsideration of Value) Operations
  // ===============================

  /**
   * Create a new ROV request
   */
  async createROVRequest(rovRequest: any): Promise<any> {
    try {
      if (!this.rovRequestsContainer) {
        throw new Error('ROV requests container not initialized');
      }

      const { resource } = await this.rovRequestsContainer.items.create(rovRequest);
      this.logger.info('ROV request created', { rovId: resource?.id, rovNumber: resource?.rovNumber });
      return resource;
    } catch (error) {
      this.logger.error('Failed to create ROV request', { error });
      throw error;
    }
  }

  /**
   * Update an existing ROV request
   */
  async updateROVRequest(rovId: string, updates: any): Promise<any> {
    try {
      if (!this.rovRequestsContainer) {
        throw new Error('ROV requests container not initialized');
      }

      // Read existing document
      const { resource: existing } = await this.rovRequestsContainer.item(rovId, rovId).read();
      
      if (!existing) {
        throw new Error(`ROV request not found: ${rovId}`);
      }

      // Merge updates
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      // Replace document
      const { resource } = await this.rovRequestsContainer.item(rovId, rovId).replace(updated);
      this.logger.info('ROV request updated', { rovId, status: resource?.status });
      return resource;
    } catch (error) {
      this.logger.error('Failed to update ROV request', { error, rovId });
      throw error;
    }
  }

  /**
   * Find ROV request by ID
   */
  async findROVRequestById(rovId: string): Promise<any | null> {
    try {
      if (!this.rovRequestsContainer) {
        throw new Error('ROV requests container not initialized');
      }

      const { resource } = await this.rovRequestsContainer.item(rovId, rovId).read();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      this.logger.error('Failed to find ROV request', { error, rovId });
      throw error;
    }
  }

  /**
   * Find ROV requests with filters
   */
  async findROVRequests(filters: any, offset: number = 0, limit: number = 50): Promise<{ success: boolean; data: any[]; total: number }> {
    try {
      if (!this.rovRequestsContainer) {
        throw new Error('ROV requests container not initialized');
      }

      // Build dynamic query
      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Add filters
      if (filters.status && filters.status.length > 0) {
        query += ' AND ARRAY_CONTAINS(@statuses, c.status)';
        parameters.push({ name: '@statuses', value: filters.status });
      }

      if (filters.requestorType && filters.requestorType.length > 0) {
        query += ' AND ARRAY_CONTAINS(@requestorTypes, c.requestorType)';
        parameters.push({ name: '@requestorTypes', value: filters.requestorType });
      }

      if (filters.challengeReason && filters.challengeReason.length > 0) {
        query += ' AND ARRAY_CONTAINS(@challengeReasons, c.challengeReason)';
        parameters.push({ name: '@challengeReasons', value: filters.challengeReason });
      }

      if (filters.decision && filters.decision.length > 0) {
        query += ' AND ARRAY_CONTAINS(@decisions, c.response.decision)';
        parameters.push({ name: '@decisions', value: filters.decision });
      }

      if (filters.priority && filters.priority.length > 0) {
        query += ' AND ARRAY_CONTAINS(@priorities, c.priority)';
        parameters.push({ name: '@priorities', value: filters.priority });
      }

      if (filters.assignedTo) {
        query += ' AND c.assignedTo = @assignedTo';
        parameters.push({ name: '@assignedTo', value: filters.assignedTo });
      }

      if (filters.orderId) {
        query += ' AND c.orderId = @orderId';
        parameters.push({ name: '@orderId', value: filters.orderId });
      }

      if (filters.isOverdue) {
        query += ' AND c.slaTracking.isOverdue = true';
      }

      if (filters.hasComplianceFlags) {
        query += ' AND (c.compliance.possibleBias = true OR c.compliance.discriminationClaim = true OR c.compliance.regulatoryEscalation = true)';
      }

      // Add ordering and pagination
      query += ' ORDER BY c.submittedAt DESC OFFSET @offset LIMIT @limit';
      parameters.push({ name: '@offset', value: offset });
      parameters.push({ name: '@limit', value: limit });

      const querySpec = { query, parameters };
      const { resources } = await this.rovRequestsContainer.items.query(querySpec).fetchAll();

      // Get total count
      const countQuery = query.replace('SELECT * FROM c', 'SELECT VALUE COUNT(1) FROM c').replace(/ORDER BY.*$/, '');
      const countQuerySpec = { query: countQuery, parameters: parameters.filter(p => p.name !== '@offset' && p.name !== '@limit') };
      const { resources: countResult } = await this.rovRequestsContainer.items.query(countQuerySpec).fetchAll();
      const total = countResult[0] || 0;

      return { success: true, data: resources, total };
    } catch (error) {
      this.logger.error('Failed to find ROV requests', { error, filters });
      return { success: false, data: [], total: 0 };
    }
  }

  /**
   * Get ROV metrics for reporting
   */
  async getROVMetrics(startDate: Date, endDate: Date, filters?: any): Promise<any> {
    try {
      if (!this.rovRequestsContainer) {
        throw new Error('ROV requests container not initialized');
      }

      // Query all ROVs in date range
      let query = 'SELECT * FROM c WHERE c.submittedAt >= @startDate AND c.submittedAt <= @endDate';
      const parameters: any[] = [
        { name: '@startDate', value: startDate.toISOString() },
        { name: '@endDate', value: endDate.toISOString() }
      ];

      if (filters?.status && filters.status.length > 0) {
        query += ' AND ARRAY_CONTAINS(@statuses, c.status)';
        parameters.push({ name: '@statuses', value: filters.status });
      }

      const querySpec = { query, parameters };
      const { resources } = await this.rovRequestsContainer.items.query(querySpec).fetchAll();

      // Calculate metrics
      const metrics = {
        totalRequests: resources.length,
        byStatus: {} as any,
        byDecision: {} as any,
        byRequestorType: {} as any,
        byChallengeReason: {} as any,
        averageResolutionTime: 0,
        averageValueChange: 0,
        valueIncreaseRate: 0,
        slaCompliance: 0,
        overdueCount: 0
      };

      let totalResolutionTime = 0;
      let totalValueChange = 0;
      let valueIncreaseCount = 0;
      let completedCount = 0;
      let slaCompliantCount = 0;

      resources.forEach((rov: any) => {
        // Count by status
        metrics.byStatus[rov.status] = (metrics.byStatus[rov.status] || 0) + 1;

        // Count by requestor type
        metrics.byRequestorType[rov.requestorType] = (metrics.byRequestorType[rov.requestorType] || 0) + 1;

        // Count by challenge reason
        metrics.byChallengeReason[rov.challengeReason] = (metrics.byChallengeReason[rov.challengeReason] || 0) + 1;

        // Count by decision
        if (rov.response?.decision) {
          metrics.byDecision[rov.response.decision] = (metrics.byDecision[rov.response.decision] || 0) + 1;
        }

        // Calculate resolution time for completed
        if (rov.completedAt) {
          completedCount++;
          const submittedAt = new Date(rov.submittedAt);
          const completedAt = new Date(rov.completedAt);
          totalResolutionTime += (completedAt.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24); // days
          
          // SLA compliance
          if (!rov.slaTracking.isOverdue) {
            slaCompliantCount++;
          }
        }

        // Calculate value changes
        if (rov.response?.valueChangeAmount) {
          totalValueChange += Math.abs(rov.response.valueChangeAmount);
          
          if (rov.response.valueChangeAmount > 0) {
            valueIncreaseCount++;
          }
        }

        // Count overdue
        if (rov.slaTracking?.isOverdue) {
          metrics.overdueCount++;
        }
      });

      // Calculate averages
      if (completedCount > 0) {
        metrics.averageResolutionTime = totalResolutionTime / completedCount;
        metrics.slaCompliance = (slaCompliantCount / completedCount) * 100;
      }

      if (metrics.totalRequests > 0) {
        metrics.averageValueChange = totalValueChange / metrics.totalRequests;
        metrics.valueIncreaseRate = (valueIncreaseCount / metrics.totalRequests) * 100;
      }

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get ROV metrics', { error });
      throw error;
    }
  }

  /**
   * Get ROV count for a specific year (for ROV number generation)
   */
  async getROVCountForYear(year: number): Promise<number> {
    try {
      if (!this.rovRequestsContainer) {
        throw new Error('ROV requests container not initialized');
      }

      const query = 'SELECT VALUE COUNT(1) FROM c WHERE STARTSWITH(c.rovNumber, @prefix)';
      const parameters = [{ name: '@prefix', value: `ROV-${year}-` }];
      
      const querySpec = { query, parameters };
      const { resources } = await this.rovRequestsContainer.items.query(querySpec).fetchAll();

      return resources[0] || 0;
    } catch (error) {
      this.logger.error('Failed to get ROV count for year', { error, year });
      throw error;
    }
  }

  // ===============================
  // Template Operations
  // ===============================

  /**
   * Create a new template
   */
  async createTemplate(template: any): Promise<any> {
    try {
      if (!this.templatesContainer) {
        throw new Error('Templates container not initialized');
      }

      const { resource } = await this.templatesContainer.items.create(template);
      this.logger.info('Template created', { templateId: resource?.id, name: resource?.name });
      return resource;
    } catch (error) {
      this.logger.error('Failed to create template', { error });
      throw error;
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(templateId: string, updates: any): Promise<any> {
    try {
      if (!this.templatesContainer) {
        throw new Error('Templates container not initialized');
      }

      // Read existing document
      const { resource: existing } = await this.templatesContainer.item(templateId, templateId).read();
      
      if (!existing) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Merge updates
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      // Replace document
      const { resource } = await this.templatesContainer.item(templateId, templateId).replace(updated);
      this.logger.info('Template updated', { templateId, name: resource?.name });
      return resource;
    } catch (error) {
      this.logger.error('Failed to update template', { error, templateId });
      throw error;
    }
  }

  /**
   * Find template by ID
   */
  async findTemplateById(templateId: string): Promise<any | null> {
    try {
      if (!this.templatesContainer) {
        throw new Error('Templates container not initialized');
      }

      const { resource } = await this.templatesContainer.item(templateId, templateId).read();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      this.logger.error('Failed to find template', { error, templateId });
      throw error;
    }
  }

  /**
   * Find templates with filters
   */
  async findTemplates(filters: any, offset: number = 0, limit: number = 50): Promise<any[]> {
    try {
      if (!this.templatesContainer) {
        throw new Error('Templates container not initialized');
      }

      // Build dynamic query
      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Add filters
      if (filters.category && filters.category.length > 0) {
        query += ' AND ARRAY_CONTAINS(@categories, c.category)';
        parameters.push({ name: '@categories', value: filters.category });
      }

      if (filters.formType && filters.formType.length > 0) {
        query += ' AND ARRAY_CONTAINS(@formTypes, c.formType)';
        parameters.push({ name: '@formTypes', value: filters.formType });
      }

      if (filters.format && filters.format.length > 0) {
        query += ' AND ARRAY_CONTAINS(@formats, c.format)';
        parameters.push({ name: '@formats', value: filters.format });
      }

      if (filters.status && filters.status.length > 0) {
        query += ' AND ARRAY_CONTAINS(@statuses, c.status)';
        parameters.push({ name: '@statuses', value: filters.status });
      }

      if (filters.isDefault !== undefined) {
        query += ' AND c.isDefault = @isDefault';
        parameters.push({ name: '@isDefault', value: filters.isDefault });
      }

      if (filters.createdBy) {
        query += ' AND c.createdBy = @createdBy';
        parameters.push({ name: '@createdBy', value: filters.createdBy });
      }

      if (filters.search) {
        query += ' AND (CONTAINS(LOWER(c.name), LOWER(@search)) OR CONTAINS(LOWER(c.description), LOWER(@search)))';
        parameters.push({ name: '@search', value: filters.search });
      }

      if (filters.tags && filters.tags.length > 0) {
        query += ' AND ARRAY_CONTAINS_ANY(c.tags, @tags)';
        parameters.push({ name: '@tags', value: filters.tags });
      }

      // Add ordering and pagination
      query += ' ORDER BY c.updatedAt DESC OFFSET @offset LIMIT @limit';
      parameters.push({ name: '@offset', value: offset });
      parameters.push({ name: '@limit', value: limit });

      const querySpec = { query, parameters };
      const { resources } = await this.templatesContainer.items.query(querySpec).fetchAll();

      return resources;
    } catch (error) {
      this.logger.error('Failed to find templates', { error, filters });
      throw error;
    }
  }

  /**
   * Count templates matching filters
   */
  async countTemplates(filters: any): Promise<number> {
    try {
      if (!this.templatesContainer) {
        throw new Error('Templates container not initialized');
      }

      // Build dynamic query (similar to findTemplates but COUNT only)
      let query = 'SELECT VALUE COUNT(1) FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Add same filters as findTemplates
      if (filters.category && filters.category.length > 0) {
        query += ' AND ARRAY_CONTAINS(@categories, c.category)';
        parameters.push({ name: '@categories', value: filters.category });
      }

      if (filters.formType && filters.formType.length > 0) {
        query += ' AND ARRAY_CONTAINS(@formTypes, c.formType)';
        parameters.push({ name: '@formTypes', value: filters.formType });
      }

      if (filters.status && filters.status.length > 0) {
        query += ' AND ARRAY_CONTAINS(@statuses, c.status)';
        parameters.push({ name: '@statuses', value: filters.status });
      }

      if (filters.search) {
        query += ' AND (CONTAINS(LOWER(c.name), LOWER(@search)) OR CONTAINS(LOWER(c.description), LOWER(@search)))';
        parameters.push({ name: '@search', value: filters.search });
      }

      const querySpec = { query, parameters };
      const { resources } = await this.templatesContainer.items.query(querySpec).fetchAll();

      return resources[0] || 0;
    } catch (error) {
      this.logger.error('Failed to count templates', { error, filters });
      throw error;
    }
  }

  /**
   * Unset default templates for a category
   */
  async unsetDefaultTemplates(category: string): Promise<void> {
    try {
      if (!this.templatesContainer) {
        throw new Error('Templates container not initialized');
      }

      // Query current default templates for this category
      const query = 'SELECT * FROM c WHERE c.category = @category AND c.isDefault = true';
      const parameters = [{ name: '@category', value: category }];
      
      const querySpec = { query, parameters };
      const { resources } = await this.templatesContainer.items.query(querySpec).fetchAll();

      // Update each to not be default
      for (const template of resources) {
        await this.templatesContainer.item(template.id, template.id).replace({
          ...template,
          isDefault: false
        });
      }

      this.logger.info('Unset default templates', { category, count: resources.length });
    } catch (error) {
      this.logger.error('Failed to unset default templates', { error, category });
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      if (!this.templatesContainer) {
        throw new Error('Templates container not initialized');
      }

      await this.templatesContainer.item(templateId, templateId).delete();
      this.logger.info('Template deleted', { templateId });
    } catch (error) {
      this.logger.error('Failed to delete template', { error, templateId });
      throw error;
    }
  }

  // ===============================
  // Appraisal Review Operations
  // ===============================

  /**
   * Create a new appraisal review
   */
  async createReview(review: any): Promise<any> {
    try {
      if (!this.reviewsContainer) {
        throw new Error('Reviews container not initialized');
      }

      const { resource } = await this.reviewsContainer.items.create(review);
      this.logger.info('Appraisal review created', { reviewId: resource?.id, reviewType: resource?.reviewType });
      return resource;
    } catch (error) {
      this.logger.error('Failed to create appraisal review', { error });
      throw error;
    }
  }

  /**
   * Update an existing appraisal review
   */
  async updateReview(reviewId: string, updates: any): Promise<any> {
    try {
      if (!this.reviewsContainer) {
        throw new Error('Reviews container not initialized');
      }

      // Read existing document
      const { resource: existing } = await this.reviewsContainer.item(reviewId, reviewId).read();
      
      if (!existing) {
        throw new Error(`Review not found: ${reviewId}`);
      }

      // Merge updates
      const updated = {
        ...existing,
        ...updates,
        metadata: {
          ...existing.metadata,
          updatedAt: new Date(),
          updatedBy: updates.metadata?.updatedBy || existing.metadata?.updatedBy
        }
      };

      // Replace document
      const { resource } = await this.reviewsContainer.item(reviewId, reviewId).replace(updated);
      this.logger.info('Appraisal review updated', { reviewId, status: resource?.status });
      return resource;
    } catch (error) {
      this.logger.error('Failed to update appraisal review', { error, reviewId });
      throw error;
    }
  }

  /**
   * Find appraisal review by ID
   */
  async findReviewById(reviewId: string): Promise<any | null> {
    try {
      if (!this.reviewsContainer) {
        throw new Error('Reviews container not initialized');
      }

      const { resource } = await this.reviewsContainer.item(reviewId, reviewId).read();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      this.logger.error('Failed to find appraisal review', { error, reviewId });
      throw error;
    }
  }

  /**
   * Find appraisal reviews with filters
   */
  async findReviews(filters: any, offset: number = 0, limit: number = 20): Promise<any[]> {
    try {
      if (!this.reviewsContainer) {
        throw new Error('Reviews container not initialized');
      }

      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Add filter conditions
      if (filters.tenantId) {
        query += ' AND c.tenantId = @tenantId';
        parameters.push({ name: '@tenantId', value: filters.tenantId });
      }

      if (filters.orderId) {
        query += ' AND c.orderId = @orderId';
        parameters.push({ name: '@orderId', value: filters.orderId });
      }

      if (filters.reviewType) {
        query += ' AND c.reviewType = @reviewType';
        parameters.push({ name: '@reviewType', value: filters.reviewType });
      }

      if (filters.status) {
        query += ' AND c.status = @status';
        parameters.push({ name: '@status', value: filters.status });
      }

      if (filters.priority) {
        query += ' AND c.priority = @priority';
        parameters.push({ name: '@priority', value: filters.priority });
      }

      if (filters.assignedTo) {
        query += ' AND c.assignedTo = @assignedTo';
        parameters.push({ name: '@assignedTo', value: filters.assignedTo });
      }

      if (filters.requestedBy) {
        query += ' AND c.requestedBy = @requestedBy';
        parameters.push({ name: '@requestedBy', value: filters.requestedBy });
      }

      if (filters.dateFrom) {
        query += ' AND c.requestedAt >= @dateFrom';
        parameters.push({ name: '@dateFrom', value: filters.dateFrom });
      }

      if (filters.dateTo) {
        query += ' AND c.requestedAt <= @dateTo';
        parameters.push({ name: '@dateTo', value: filters.dateTo });
      }

      // Add ordering and pagination
      query += ' ORDER BY c.requestedAt DESC';
      query += ` OFFSET ${offset} LIMIT ${limit}`;

      const querySpec = { query, parameters };
      const { resources } = await this.reviewsContainer.items.query(querySpec).fetchAll();
      
      return resources;
    } catch (error) {
      this.logger.error('Failed to find appraisal reviews', { error, filters });
      throw error;
    }
  }

  /**
   * Count appraisal reviews with filters
   */
  async countReviews(filters: any): Promise<number> {
    try {
      if (!this.reviewsContainer) {
        throw new Error('Reviews container not initialized');
      }

      let query = 'SELECT VALUE COUNT(1) FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Add same filter conditions as findReviews
      if (filters.tenantId) {
        query += ' AND c.tenantId = @tenantId';
        parameters.push({ name: '@tenantId', value: filters.tenantId });
      }

      if (filters.orderId) {
        query += ' AND c.orderId = @orderId';
        parameters.push({ name: '@orderId', value: filters.orderId });
      }

      if (filters.reviewType) {
        query += ' AND c.reviewType = @reviewType';
        parameters.push({ name: '@reviewType', value: filters.reviewType });
      }

      if (filters.status) {
        query += ' AND c.status = @status';
        parameters.push({ name: '@status', value: filters.status });
      }

      if (filters.priority) {
        query += ' AND c.priority = @priority';
        parameters.push({ name: '@priority', value: filters.priority });
      }

      if (filters.assignedTo) {
        query += ' AND c.assignedTo = @assignedTo';
        parameters.push({ name: '@assignedTo', value: filters.assignedTo });
      }

      if (filters.requestedBy) {
        query += ' AND c.requestedBy = @requestedBy';
        parameters.push({ name: '@requestedBy', value: filters.requestedBy });
      }

      if (filters.dateFrom) {
        query += ' AND c.requestedAt >= @dateFrom';
        parameters.push({ name: '@dateFrom', value: filters.dateFrom });
      }

      if (filters.dateTo) {
        query += ' AND c.requestedAt <= @dateTo';
        parameters.push({ name: '@dateTo', value: filters.dateTo });
      }

      const querySpec = { query, parameters };
      const { resources } = await this.reviewsContainer.items.query<number>(querySpec).fetchAll();
      
      return resources[0] || 0;
    } catch (error) {
      this.logger.error('Failed to count appraisal reviews', { error, filters });
      throw error;
    }
  }

  // ===============================
  // Comparable Analysis Operations
  // ===============================

  /**
   * Save comparable analysis
   */
  async saveComparableAnalysis(analysis: any): Promise<any> {
    try {
      if (!this.comparableAnalysesContainer) {
        throw new Error('Comparable analyses container not initialized');
      }

      const { resource } = await this.comparableAnalysesContainer.items.upsert(analysis);
      this.logger.info('Comparable analysis saved', { reviewId: resource?.reviewId });
      return resource;
    } catch (error) {
      this.logger.error('Failed to save comparable analysis', { error });
      throw error;
    }
  }

  /**
   * Find comparable analysis by review ID
   */
  async findComparableAnalysisByReviewId(reviewId: string): Promise<any | null> {
    try {
      if (!this.comparableAnalysesContainer) {
        throw new Error('Comparable analyses container not initialized');
      }

      const query = 'SELECT * FROM c WHERE c.reviewId = @reviewId';
      const parameters = [{ name: '@reviewId', value: reviewId }];
      
      const querySpec = { query, parameters };
      const { resources } = await this.comparableAnalysesContainer.items.query(querySpec).fetchAll();
      
      return resources[0] || null;
    } catch (error) {
      this.logger.error('Failed to find comparable analysis', { error, reviewId });
      throw error;
    }
  }

  // ===============================
  // Review Report Operations
  // ===============================

  /**
   * Save review report
   */
  async saveReviewReport(report: any): Promise<any> {
    try {
      if (!this.reviewsContainer) {
        throw new Error('Reviews container not initialized');
      }

      // Store reports as subdocuments in reviews container with report type
      const { resource } = await this.reviewsContainer.items.create({
        ...report,
        docType: 'review-report' // Discriminator for querying
      });
      this.logger.info('Review report saved', { reportId: resource?.id, reviewId: resource?.reviewId });
      return resource;
    } catch (error) {
      this.logger.error('Failed to save review report', { error });
      throw error;
    }
  }

  /**
   * Find review reports by review ID
   */
  async findReviewReportsByReviewId(reviewId: string): Promise<any[]> {
    try {
      if (!this.reviewsContainer) {
        throw new Error('Reviews container not initialized');
      }

      const query = 'SELECT * FROM c WHERE c.docType = @docType AND c.reviewId = @reviewId ORDER BY c.preparedDate DESC';
      const parameters = [
        { name: '@docType', value: 'review-report' },
        { name: '@reviewId', value: reviewId }
      ];
      
      const querySpec = { query, parameters };
      const { resources } = await this.reviewsContainer.items.query(querySpec).fetchAll();
      
      return resources;
    } catch (error) {
      this.logger.error('Failed to find review reports', { error, reviewId });
      throw error;
    }
  }

  /**
   * Query items from a specific container
   * Generic method to query any container by name
   */
  async queryItems(containerName: string, querySpec: { query: string; parameters?: any[] }): Promise<ApiResponse<any[]>> {
    try {
      if (!this.database) {
        throw new Error('Database not initialized');
      }

      const container = this.database.container(containerName);
      const { resources } = await container.items.query(querySpec).fetchAll();

      return {
        success: true,
        data: resources
      };

    } catch (error) {
      this.logger.error('Failed to query items', {
        error: error instanceof Error ? error.message : String(error),
        containerName,
        query: querySpec
      });
      return {
        success: false,
        data: [],
        error: createApiError(
          ErrorCodes.DATABASE_QUERY_FAILED,
          error instanceof Error ? error.message : 'Unknown error'
        )
      };
    }
  }

  /**
   * Get a single item from a specific container
   * Generic method to get any item by ID
   */
  async getItem(containerName: string, itemId: string, partitionKey?: string): Promise<any> {
    try {
      if (!this.database) {
        throw new Error('Database not initialized');
      }

      const container = this.database.container(containerName);
      const { resource } = await container.item(itemId, partitionKey || itemId).read();

      return resource;

    } catch (error) {
      if (error.code === 404) {
        return null; // Item not found
      }
      
      this.logger.error('Failed to get item', {
        error: error instanceof Error ? error.message : String(error),
        containerName,
        itemId
      });
      
      // For non-404 errors, throw the error so caller can handle it
      throw error;
    }
  }

  /**
   * Disconnect from Cosmos DB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.dispose();
      this.isConnected = false;
      this.logger.info('Disconnected from Azure Cosmos DB');
    }
  }
}

export default CosmosDbService;