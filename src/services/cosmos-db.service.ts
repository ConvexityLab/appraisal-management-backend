import { CosmosClient, Database, Container, ItemResponse, FeedResponse } from '@azure/cosmos';
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
  private propertiesContainer: Container | null = null;
  private propertySummariesContainer: Container | null = null;
  private qcResultsContainer: Container | null = null;
  private analyticsContainer: Container | null = null;

  private readonly databaseId = 'appraisal-management';
  private readonly containers = {
    orders: 'orders',
    vendors: 'vendors',
    properties: 'properties',
    propertySummaries: 'property-summaries',
    qcResults: 'qc-results',
    analytics: 'analytics'
  };

  constructor(
    private endpoint: string = process.env.COSMOS_ENDPOINT || '',
    private key: string = process.env.COSMOS_KEY || ''
  ) {
    this.logger = new Logger();
    
    // Use Cosmos DB Emulator for local development if no endpoint provided
    if (!this.endpoint && process.env.NODE_ENV === 'development') {
      this.endpoint = 'https://localhost:8081';
      this.key = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
      this.logger.info('Using Cosmos DB Emulator for local development');
    }
  }

  /**
   * Initialize Cosmos DB connection and containers
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Azure Cosmos DB connection');

      if (!this.endpoint || !this.key) {
        throw new Error('Cosmos DB endpoint and key must be provided');
      }

      // Initialize Cosmos client
      this.client = new CosmosClient({
        endpoint: this.endpoint,
        key: this.key,
        connectionPolicy: {
          requestTimeout: 30000,
          enableEndpointDiscovery: true,
          preferredLocations: ['East US', 'West US', 'Central US']
        }
      });

      // Create database if it doesn't exist
      const { database } = await this.client.databases.createIfNotExists({
        id: this.databaseId,
        throughput: 1000 // Shared throughput across containers
      });
      this.database = database;

      // Initialize containers
      await this.initializeContainers();

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
   * Create containers with optimal partition keys and indexing policies
   */
  private async initializeContainers(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    try {
      // Orders container
      const { container: ordersContainer } = await this.database.containers.createIfNotExists({
        id: this.containers.orders,
        partitionKey: '/status', // Partition by order status for even distribution
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [
            { path: '/*' }
          ],
          excludedPaths: [
            { path: '/property/details/*' }, // Exclude large nested objects from indexing
            { path: '/attachments/*' }
          ],
          compositeIndexes: [
            [
              { path: '/status', order: 'ascending' },
              { path: '/createdAt', order: 'descending' }
            ],
            [
              { path: '/assignedVendorId', order: 'ascending' },
              { path: '/dueDate', order: 'ascending' }
            ]
          ]
        }
      });
      this.ordersContainer = ordersContainer;

      // Vendors container
      const { container: vendorsContainer } = await this.database.containers.createIfNotExists({
        id: this.containers.vendors,
        partitionKey: '/licenseState', // Partition by license state for geographic distribution
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [
            { path: '/*' }
          ],
          excludedPaths: [
            { path: '/bankingInfo/*' }, // Exclude sensitive data from indexing
            { path: '/insuranceInfo/documents/*' }
          ],
          compositeIndexes: [
            [
              { path: '/status', order: 'ascending' },
              { path: '/performance/rating', order: 'descending' }
            ],
            [
              { path: '/licenseState', order: 'ascending' },
              { path: '/productTypes', order: 'ascending' }
            ]
          ]
        }
      });
      this.vendorsContainer = vendorsContainer;

      // Property Summaries container (lightweight, frequently accessed)
      const { container: propertySummariesContainer } = await this.database.containers.createIfNotExists({
        id: this.containers.propertySummaries,
        partitionKey: '/address/state', // Partition by state for geographic queries
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [
            { path: '/*' }
          ],
          spatialIndexes: [
            { 
              path: '/address/location/*', 
              types: ['Point' as any],
              boundingBox: {
                xmin: -180,
                ymin: -90,
                xmax: 180,
                ymax: 90
              }
            }
          ],
          compositeIndexes: [
            [
              { path: '/address/state', order: 'ascending' },
              { path: '/propertyType', order: 'ascending' }
            ],
            [
              { path: '/propertyType', order: 'ascending' },
              { path: '/valuation/estimatedValue', order: 'descending' }
            ],
            [
              { path: '/address/city', order: 'ascending' },
              { path: '/building/yearBuilt', order: 'descending' }
            ]
          ]
        }
      });
      this.propertySummariesContainer = propertySummariesContainer;

      // Properties container (comprehensive details, less frequently accessed)
      const { container: propertiesContainer } = await this.database.containers.createIfNotExists({
        id: this.containers.properties,
        partitionKey: '/address/state',
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [
            { path: '/id/?' },
            { path: '/address/*' },
            { path: '/assessment/*' },
            { path: '/valuation/*' }
          ],
          excludedPaths: [
            { path: '/deedHistory/*' }, // Large historical data
            { path: '/demographics/*' },
            { path: '/mortgageHistory/*' }
          ]
        }
      });
      this.propertiesContainer = propertiesContainer;

      // QC Results container
      const { container: qcResultsContainer } = await this.database.containers.createIfNotExists({
        id: this.containers.qcResults,
        partitionKey: '/orderId',
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [
            { path: '/*' }
          ],
          compositeIndexes: [
            [
              { path: '/orderId', order: 'ascending' },
              { path: '/validatedAt', order: 'descending' }
            ],
            [
              { path: '/qcScore', order: 'descending' },
              { path: '/validatedAt', order: 'descending' }
            ]
          ]
        }
      });
      this.qcResultsContainer = qcResultsContainer;

      // Analytics container
      const { container: analyticsContainer } = await this.database.containers.createIfNotExists({
        id: this.containers.analytics,
        partitionKey: '/reportType',
        indexingPolicy: {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [
            { path: '/*' }
          ],
          compositeIndexes: [
            [
              { path: '/reportType', order: 'ascending' },
              { path: '/timestamp', order: 'descending' }
            ],
            [
              { path: '/dateRange/from', order: 'ascending' },
              { path: '/dateRange/to', order: 'descending' }
            ]
          ]
        }
      });
      this.analyticsContainer = analyticsContainer;

      this.logger.info('Cosmos DB containers initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize containers', { error });
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

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
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

      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

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

      const { resource } = await this.ordersContainer.item(id, updatedOrder.status).replace(updatedOrder);

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

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      };

      const { resources } = await this.vendorsContainer.items.query<Vendor>(querySpec).fetchAll();
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

      // Build dynamic query
      if (filters.propertyType && filters.propertyType.length > 0) {
        query += ' AND c.propertyType IN (' + filters.propertyType.map((_: any, index: number) => `@type${index}`).join(', ') + ')';
        filters.propertyType.forEach((type: any, index: number) => {
          parameters.push({ name: `@type${index}`, value: type });
        });
      }

      if (filters.address?.state) {
        query += ' AND c.address.state = @state';
        parameters.push({ name: '@state', value: filters.address.state });
      }

      if (filters.address?.city) {
        query += ' AND c.address.city = @city';
        parameters.push({ name: '@city', value: filters.address.city });
      }

      if (filters.priceRange) {
        if (filters.priceRange.min) {
          query += ' AND c.valuation.estimatedValue >= @minPrice';
          parameters.push({ name: '@minPrice', value: filters.priceRange.min });
        }
        if (filters.priceRange.max) {
          query += ' AND c.valuation.estimatedValue <= @maxPrice';
          parameters.push({ name: '@maxPrice', value: filters.priceRange.max });
        }
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

      // Get overall QC metrics
      const metricsQuery = `
        SELECT 
          AVG(c.qcScore) as averageScore,
          COUNT(c) as totalValidations,
          SUM(CASE WHEN c.qcScore >= 90 THEN 1 ELSE 0 END) as highScoreCount,
          SUM(CASE WHEN c.qcScore < 70 THEN 1 ELSE 0 END) as lowScoreCount
        FROM c
        WHERE c.validatedAt >= @fromDate
      `;

      const fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 3); // Last 3 months

      const { resources } = await this.qcResultsContainer.items.query({
        query: metricsQuery,
        parameters: [{ name: '@fromDate', value: fromDate.toISOString() }]
      }).fetchAll();

      const metrics = resources[0] || {};

      return {
        success: true,
        data: {
          overallQCScore: metrics.averageScore || 0,
          totalValidations: metrics.totalValidations || 0,
          highScoreRate: metrics.totalValidations > 0 ? (metrics.highScoreCount / metrics.totalValidations) * 100 : 0,
          lowScoreRate: metrics.totalValidations > 0 ? (metrics.lowScoreCount / metrics.totalValidations) * 100 : 0,
          validationCounts: {
            total: metrics.totalValidations || 0,
            highScore: metrics.highScoreCount || 0,
            lowScore: metrics.lowScoreCount || 0
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

      // Get order statistics
      const orderStatsQuery = `
        SELECT 
          COUNT(c) as totalOrders,
          SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completedOrders,
          AVG(DateDiff('day', c.createdAt, c.completedAt)) as avgCompletionDays
        FROM c
      `;

      const { resources: orderStats } = await this.ordersContainer.items.query({
        query: orderStatsQuery
      }).fetchAll();

      // Get QC pass rate
      const qcStatsQuery = `
        SELECT 
          AVG(c.qcScore) as avgQcScore,
          SUM(CASE WHEN c.qcScore >= 85 THEN 1 ELSE 0 END) as passCount,
          COUNT(c) as totalQc
        FROM c
      `;

      const { resources: qcStats } = await this.qcResultsContainer.items.query({
        query: qcStatsQuery
      }).fetchAll();

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

      const orderMetrics = orderStats[0] || {};
      const qcMetrics = qcStats[0] || {};

      return {
        success: true,
        data: {
          totalOrders: orderMetrics.totalOrders || 0,
          completedOrders: orderMetrics.completedOrders || 0,
          averageCompletionTime: orderMetrics.avgCompletionDays || 0,
          qcPassRate: qcMetrics.totalQc > 0 ? (qcMetrics.passCount / qcMetrics.totalQc) * 100 : 0,
          topVendors: topVendors.map(v => ({
            vendorId: v.assignedVendorId,
            completedOrders: v.completedOrders,
            rating: 4.5 // Mock rating - would be calculated from actual performance data
          })),
          monthlyTrends: {
            orders: [85, 92, 78, 110, 95], // Mock data - would be calculated from actual order data
            qcScores: [94.2, 95.1, 93.8, 94.7, 94.5]
          }
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

      // Get vendor order statistics
      const orderStatsQuery = `
        SELECT 
          COUNT(c) as totalOrders,
          SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completedOrders,
          AVG(DateDiff('day', c.assignedAt, c.completedAt)) as avgCompletionDays
        FROM c
        WHERE c.assignedVendorId = @vendorId
      `;

      const { resources: orderStats } = await this.ordersContainer.items.query({
        query: orderStatsQuery,
        parameters: [{ name: '@vendorId', value: vendorId }]
      }).fetchAll();

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
          totalOrders: orderMetrics.totalOrders || 0,
          completedOrders: orderMetrics.completedOrders || 0,
          completionRate: orderMetrics.totalOrders > 0 ? (orderMetrics.completedOrders / orderMetrics.totalOrders) * 100 : 0,
          averageCompletionTime: orderMetrics.avgCompletionDays || 0,
          averageQcScore: qcMetrics.avgQcScore || 0,
          totalQcResults: qcMetrics.totalQcResults || 0,
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