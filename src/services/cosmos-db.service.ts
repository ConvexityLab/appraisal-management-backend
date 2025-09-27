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

/**
 * Azure Cosmos DB Service for Enterprise Appraisal Management System
 * Provides production-ready database operations with global scale and enterprise features
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

  private readonly databaseId = 'appraisal-management';
  private readonly containers = {
    orders: 'orders',
    vendors: 'vendors',
    properties: 'properties',
    propertySummaries: 'property-summaries'
  };

  constructor(
    private endpoint: string = process.env.COSMOS_ENDPOINT || '',
    private key: string = process.env.COSMOS_KEY || ''
  ) {
    this.logger = new Logger();
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
        data: order
      };

    } catch (error) {
      this.logger.error('Failed to find order', { error, id });
      return {
        success: false,
        data: null,
        error: {
          code: 'FIND_ORDER_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
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
        error: {
          code: 'FIND_ORDERS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
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
          error: {
            code: 'ORDER_NOT_FOUND',
            message: `Order with id ${id} not found`
          }
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
        error: {
          code: 'UPDATE_ORDER_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
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
        error: {
          code: 'DELETE_ORDER_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
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
        error: {
          code: 'CREATE_VENDOR_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
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
        data: vendor
      };

    } catch (error) {
      this.logger.error('Failed to find vendor', { error, id });
      return {
        success: false,
        data: null,
        error: {
          code: 'FIND_VENDOR_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
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
        lastUpdated: new Date(),
        dataSource: 'internal',
        quickLists: property.quickLists || {}
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
        error: {
          code: 'CREATE_PROPERTY_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
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
        data: property
      };

    } catch (error) {
      this.logger.error('Failed to find property summary', { error, id });
      return {
        success: false,
        data: null,
        error: {
          code: 'FIND_PROPERTY_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
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
        error: {
          code: 'SEARCH_PROPERTIES_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // ===============================
  // Utility Methods
  // ===============================

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