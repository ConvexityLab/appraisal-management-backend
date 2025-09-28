import { CosmosClient, Database, Container, ItemResponse, FeedResponse } from '@azure/cosmos';
import { 
  AppraisalOrder, 
  Vendor, 
  OrderFilters,
  ApiResponse,
  ApiError 
} from '../types/index.js';
import { 
  PropertySummary, 
  PropertyDetails,
  CreatePropertySummaryRequest 
} from '../types/property-enhanced.js';
import { Logger } from '../utils/logger.js';

/**
 * Consolidated Azure Cosmos DB Service
 * Matches the production Bicep deployment configuration
 * Single database with optimized containers and partitioning
 */
export class ConsolidatedCosmosDbService {
  private logger: Logger;
  private client: CosmosClient | null = null;
  private database: Database | null = null;
  private isConnected: boolean = false;

  // Container references - matching our Bicep deployment
  private containers: {
    orders: Container | null;
    vendors: Container | null;
    propertySummaries: Container | null;
    properties: Container | null;
  } = {
    orders: null,
    vendors: null,
    propertySummaries: null,
    properties: null
  };

  // Configuration from environment variables (set by Bicep deployment outputs)
  private readonly config = {
    endpoint: process.env.COSMOS_ENDPOINT || 'https://localhost:8081',
    key: process.env.COSMOS_KEY || 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
    databaseName: process.env.COSMOS_DATABASE_NAME || 'appraisal-management',
    containers: {
      orders: process.env.COSMOS_CONTAINER_ORDERS || 'orders',
      vendors: process.env.COSMOS_CONTAINER_VENDORS || 'vendors',
      propertySummaries: process.env.COSMOS_CONTAINER_PROPERTY_SUMMARIES || 'property-summaries',
      properties: process.env.COSMOS_CONTAINER_PROPERTIES || 'properties'
    }
  };

  constructor() {
    this.logger = new Logger();
    
    if (this.config.endpoint === 'https://localhost:8081') {
      this.logger.warn('Using Cosmos DB Emulator - development mode only');
    }
  }

  /**
   * Helper method to create ApiError objects
   */
  private createApiError(code: string, message: string, details?: Record<string, any>): ApiError {
    const error: ApiError = {
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
   * Initialize Cosmos DB connection and containers
   */
  async connect(): Promise<{ success: boolean; error?: ApiError }> {
    try {
      this.logger.info('Initializing Cosmos DB connection...', { 
        endpoint: this.config.endpoint,
        database: this.config.databaseName 
      });

      // Initialize client
      this.client = new CosmosClient({
        endpoint: this.config.endpoint,
        key: this.config.key,
        connectionPolicy: {
          requestTimeout: 30000,
          retryOptions: {
            maxRetryAttemptCount: 3,
            fixedRetryIntervalInMilliseconds: 1000,
            maxWaitTimeInSeconds: 60
          }
        }
      });

      // Get database reference
      this.database = this.client.database(this.config.databaseName);

      // Initialize container references
      this.containers.orders = this.database.container(this.config.containers.orders);
      this.containers.vendors = this.database.container(this.config.containers.vendors);
      this.containers.propertySummaries = this.database.container(this.config.containers.propertySummaries);
      this.containers.properties = this.database.container(this.config.containers.properties);

      // Test connection
      await this.database.read();
      
      this.isConnected = true;
      this.logger.info('Cosmos DB connection established successfully');
      
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to connect to Cosmos DB', { error });
      return {
        success: false,
        error: this.createApiError(
          'CONNECTION_FAILED',
          `Failed to connect to Cosmos DB: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Close the Cosmos DB connection
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.dispose();
        this.client = null;
        this.database = null;
        this.containers.orders = null;
        this.containers.vendors = null;
        this.containers.propertySummaries = null;
        this.containers.properties = null;
        this.isConnected = false;
        this.logger.info('Cosmos DB connection closed');
      }
    } catch (error) {
      this.logger.error('Error closing Cosmos DB connection', { error });
    }
  }

  /**
   * Check if service is connected and ready
   */
  isReady(): boolean {
    return this.isConnected && 
           this.containers.orders !== null && 
           this.containers.vendors !== null && 
           this.containers.propertySummaries !== null && 
           this.containers.properties !== null;
  }

  /**
   * Health check for monitoring
   */
  async healthCheck(): Promise<ApiResponse<{ status: string; containers: string[] }>> {
    try {
      if (!this.isReady()) {
        return {
          success: false,
          error: this.createApiError('SERVICE_NOT_READY', 'Service is not connected or containers are not initialized')
        };
      }

      // Test each container with a simple query
      const containerTests = await Promise.all([
        this.containers.orders!.items.query('SELECT TOP 1 c.id FROM c').fetchNext(),
        this.containers.vendors!.items.query('SELECT TOP 1 c.id FROM c').fetchNext(),
        this.containers.propertySummaries!.items.query('SELECT TOP 1 c.id FROM c').fetchNext(),
        this.containers.properties!.items.query('SELECT TOP 1 c.id FROM c').fetchNext()
      ]);

      return {
        success: true,
        data: {
          status: 'healthy',
          containers: [
            this.config.containers.orders,
            this.config.containers.vendors,
            this.config.containers.propertySummaries,
            this.config.containers.properties
          ]
        }
      };
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return {
        success: false,
        error: this.createApiError(
          'HEALTH_CHECK_FAILED',
          `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  // =================================
  // ORDER OPERATIONS
  // =================================

  /**
   * Create a new appraisal order
   */
  async createOrder(orderData: Omit<AppraisalOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<AppraisalOrder>> {
    try {
      if (!this.containers.orders) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Orders container is not initialized')
        };
      }

      const newOrder: AppraisalOrder = {
        ...orderData,
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { resource } = await this.containers.orders.items.create(newOrder);
      
      this.logger.info('Order created successfully', { orderId: newOrder.id });
      
      return {
        success: true,
        data: resource as AppraisalOrder
      };
    } catch (error) {
      this.logger.error('Failed to create order', { error });
      return {
        success: false,
        error: this.createApiError(
          'ORDER_CREATE_FAILED',
          `Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(id: string, status: string): Promise<ApiResponse<AppraisalOrder>> {
    try {
      if (!this.containers.orders) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Orders container is not initialized')
        };
      }

      const { resource } = await this.containers.orders.item(id, status).read<AppraisalOrder>();
      
      if (!resource) {
        return {
          success: false,
          error: this.createApiError('ORDER_NOT_FOUND', 'Order not found')
        };
      }

      return {
        success: true,
        data: resource
      };
    } catch (error) {
      this.logger.error('Failed to retrieve order', { orderId: id, error });
      return {
        success: false,
        error: this.createApiError(
          'ORDER_RETRIEVE_FAILED',
          `Failed to retrieve order: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Search orders with filters
   */
  async searchOrders(filters: OrderFilters = {}): Promise<ApiResponse<AppraisalOrder[]>> {
    try {
      if (!this.containers.orders) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Orders container is not initialized')
        };
      }

      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Build dynamic query based on filters
      if (filters.status && filters.status.length > 0) {
        query += ` AND c.status IN (${filters.status.map((_, i) => `@status${i}`).join(',')})`;
        filters.status.forEach((status, i) => {
          parameters.push({ name: `@status${i}`, value: status });
        });
      }

      if (filters.clientId) {
        query += ' AND c.clientId = @clientId';
        parameters.push({ name: '@clientId', value: filters.clientId });
      }

      if (filters.assignedVendorId) {
        query += ' AND c.assignedVendorId = @assignedVendorId';
        parameters.push({ name: '@assignedVendorId', value: filters.assignedVendorId });
      }

      // Note: rushOrder filter not available in OrderFilters interface

      // Add date range filters
      if (filters.dueDateFrom) {
        query += ' AND c.dueDate >= @dueDateFrom';
        parameters.push({ name: '@dueDateFrom', value: filters.dueDateFrom.toISOString() });
      }

      if (filters.dueDateTo) {
        query += ' AND c.dueDate <= @dueDateTo';
        parameters.push({ name: '@dueDateTo', value: filters.dueDateTo.toISOString() });
      }

      // Add ordering
      query += ' ORDER BY c.createdAt DESC';

      const querySpec = {
        query,
        parameters
      };

      const { resources } = await this.containers.orders.items.query<AppraisalOrder>(querySpec).fetchAll();
      
      this.logger.info('Orders search completed', { count: resources.length, filters });
      
      return {
        success: true,
        data: resources
      };
    } catch (error) {
      this.logger.error('Failed to search orders', { filters, error });
      return {
        success: false,
        error: this.createApiError(
          'ORDER_SEARCH_FAILED',
          `Failed to search orders: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Update an existing order
   */
  async updateOrder(id: string, status: string, updates: Partial<AppraisalOrder>): Promise<ApiResponse<AppraisalOrder>> {
    try {
      if (!this.containers.orders) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Orders container is not initialized')
        };
      }

      const { resource: existingOrder } = await this.containers.orders.item(id, status).read<AppraisalOrder>();
      
      if (!existingOrder) {
        return {
          success: false,
          error: this.createApiError('ORDER_NOT_FOUND', 'Order not found')
        };
      }

      const updatedOrder: AppraisalOrder = {
        ...existingOrder,
        ...updates,
        id, // Ensure ID doesn't change
        updatedAt: new Date()
      };

      const { resource } = await this.containers.orders.item(id, status).replace(updatedOrder);
      
      this.logger.info('Order updated successfully', { orderId: id });
      
      return {
        success: true,
        data: resource as AppraisalOrder
      };
    } catch (error) {
      this.logger.error('Failed to update order', { orderId: id, error });
      return {
        success: false,
        error: this.createApiError(
          'ORDER_UPDATE_FAILED',
          `Failed to update order: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Delete an order
   */
  async deleteOrder(id: string, status: string): Promise<ApiResponse<boolean>> {
    try {
      if (!this.containers.orders) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Orders container is not initialized')
        };
      }

      await this.containers.orders.item(id, status).delete();
      
      this.logger.info('Order deleted successfully', { orderId: id });
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      this.logger.error('Failed to delete order', { orderId: id, error });
      return {
        success: false,
        error: this.createApiError(
          'ORDER_DELETE_FAILED',
          `Failed to delete order: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  // =================================
  // VENDOR OPERATIONS
  // =================================

  /**
   * Create a new vendor
   */
  async createVendor(vendorData: Omit<Vendor, 'id'>): Promise<ApiResponse<Vendor>> {
    try {
      if (!this.containers.vendors) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Vendors container is not initialized')
        };
      }

      const newVendor: Vendor = {
        ...vendorData,
        id: `vendor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      const { resource } = await this.containers.vendors.items.create(newVendor);
      
      this.logger.info('Vendor created successfully', { vendorId: newVendor.id });
      
      return {
        success: true,
        data: resource as Vendor
      };
    } catch (error) {
      this.logger.error('Failed to create vendor', { error });
      return {
        success: false,
        error: this.createApiError(
          'VENDOR_CREATE_FAILED',
          `Failed to create vendor: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Get vendor by ID
   */
  async getVendor(id: string, status: string): Promise<ApiResponse<Vendor>> {
    try {
      if (!this.containers.vendors) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Vendors container is not initialized')
        };
      }

      const { resource } = await this.containers.vendors.item(id, status).read<Vendor>();
      
      if (!resource) {
        return {
          success: false,
          error: this.createApiError('VENDOR_NOT_FOUND', 'Vendor not found')
        };
      }

      return {
        success: true,
        data: resource
      };
    } catch (error) {
      this.logger.error('Failed to retrieve vendor', { vendorId: id, error });
      return {
        success: false,
        error: this.createApiError(
          'VENDOR_RETRIEVE_FAILED',
          `Failed to retrieve vendor: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Search vendors with filters
   */
  async searchVendors(filters: {
    status?: string[];
    licenseState?: string;
    serviceArea?: string;
    specialty?: string;
  } = {}): Promise<ApiResponse<Vendor[]>> {
    try {
      if (!this.containers.vendors) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Vendors container is not initialized')
        };
      }

      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Build dynamic query based on filters
      if (filters.status && filters.status.length > 0) {
        query += ` AND c.status IN (${filters.status.map((_, i) => `@status${i}`).join(',')})`;
        filters.status.forEach((status, i) => {
          parameters.push({ name: `@status${i}`, value: status });
        });
      }

      if (filters.licenseState) {
        query += ' AND c.licenseState = @licenseState';
        parameters.push({ name: '@licenseState', value: filters.licenseState });
      }

      if (filters.serviceArea) {
        query += ' AND ARRAY_CONTAINS(c.serviceAreas, @serviceArea)';
        parameters.push({ name: '@serviceArea', value: filters.serviceArea });
      }

      if (filters.specialty) {
        query += ' AND ARRAY_CONTAINS(c.specialties, @specialty)';
        parameters.push({ name: '@specialty', value: filters.specialty });
      }

      query += ' ORDER BY c.name ASC';

      const querySpec = {
        query,
        parameters
      };

      const { resources } = await this.containers.vendors.items.query<Vendor>(querySpec).fetchAll();
      
      this.logger.info('Vendors search completed', { count: resources.length, filters });
      
      return {
        success: true,
        data: resources
      };
    } catch (error) {
      this.logger.error('Failed to search vendors', { filters, error });
      return {
        success: false,
        error: this.createApiError(
          'VENDOR_SEARCH_FAILED',
          `Failed to search vendors: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  // =================================
  // PROPERTY OPERATIONS
  // =================================

  /**
   * Create a new property summary
   */
  async createPropertySummary(propertyData: CreatePropertySummaryRequest): Promise<ApiResponse<PropertySummary>> {
    try {
      if (!this.containers.propertySummaries) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Property summaries container is not initialized')
        };
      }

      const newProperty: PropertySummary = {
        ...propertyData,
        id: `property_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        building: propertyData.building || {},
        valuation: propertyData.valuation || {},
        owner: { fullName: '', ownerOccupied: false },
        quickLists: {
          vacant: false,
          ownerOccupied: false,
          freeAndClear: false,
          highEquity: false,
          activeForSale: false,
          recentlySold: false
        },
        lastUpdated: new Date()
      };

      const { resource } = await this.containers.propertySummaries.items.create(newProperty);
      
      this.logger.info('Property summary created successfully', { propertyId: newProperty.id });
      
      return {
        success: true,
        data: resource as PropertySummary
      };
    } catch (error) {
      this.logger.error('Failed to create property summary', { error });
      return {
        success: false,
        error: this.createApiError(
          'PROPERTY_CREATE_FAILED',
          `Failed to create property summary: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Get property summary by ID
   */
  async getPropertySummary(id: string, propertyType: string): Promise<ApiResponse<PropertySummary>> {
    try {
      if (!this.containers.propertySummaries) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Property summaries container is not initialized')
        };
      }

      const { resource } = await this.containers.propertySummaries.item(id, propertyType).read<PropertySummary>();
      
      if (!resource) {
        return {
          success: false,
          error: this.createApiError('PROPERTY_NOT_FOUND', 'Property summary not found')
        };
      }

      return {
        success: true,
        data: resource
      };
    } catch (error) {
      this.logger.error('Failed to retrieve property summary', { propertyId: id, error });
      return {
        success: false,
        error: this.createApiError(
          'PROPERTY_RETRIEVE_FAILED',
          `Failed to retrieve property summary: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Search property summaries
   */
  async searchProperties(filters: {
    propertyType?: string[];
    city?: string;
    state?: string;
    zipCode?: string;
    minSquareFeet?: number;
    maxSquareFeet?: number;
    minYearBuilt?: number;
    maxYearBuilt?: number;
  } = {}): Promise<ApiResponse<PropertySummary[]>> {
    try {
      if (!this.containers.propertySummaries) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Property summaries container is not initialized')
        };
      }

      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Build dynamic query based on filters
      if (filters.propertyType && filters.propertyType.length > 0) {
        query += ` AND c.propertyType IN (${filters.propertyType.map((_, i) => `@type${i}`).join(',')})`;
        filters.propertyType.forEach((type, i) => {
          parameters.push({ name: `@type${i}`, value: type });
        });
      }

      if (filters.city) {
        query += ' AND c.address.city = @city';
        parameters.push({ name: '@city', value: filters.city });
      }

      if (filters.state) {
        query += ' AND c.address.state = @state';
        parameters.push({ name: '@state', value: filters.state });
      }

      if (filters.zipCode) {
        query += ' AND c.address.zip = @zipCode';
        parameters.push({ name: '@zipCode', value: filters.zipCode });
      }

      if (filters.minSquareFeet) {
        query += ' AND c.building.livingAreaSquareFeet >= @minSquareFeet';
        parameters.push({ name: '@minSquareFeet', value: filters.minSquareFeet });
      }

      if (filters.maxSquareFeet) {
        query += ' AND c.building.livingAreaSquareFeet <= @maxSquareFeet';
        parameters.push({ name: '@maxSquareFeet', value: filters.maxSquareFeet });
      }

      if (filters.minYearBuilt) {
        query += ' AND c.building.yearBuilt >= @minYearBuilt';
        parameters.push({ name: '@minYearBuilt', value: filters.minYearBuilt });
      }

      if (filters.maxYearBuilt) {
        query += ' AND c.building.yearBuilt <= @maxYearBuilt';
        parameters.push({ name: '@maxYearBuilt', value: filters.maxYearBuilt });
      }

      query += ' ORDER BY c.address.city ASC, c.address.street ASC';

      const querySpec = {
        query,
        parameters
      };

      const { resources } = await this.containers.propertySummaries.items.query<PropertySummary>(querySpec).fetchAll();
      
      this.logger.info('Properties search completed', { count: resources.length, filters });
      
      return {
        success: true,
        data: resources
      };
    } catch (error) {
      this.logger.error('Failed to search properties', { filters, error });
      return {
        success: false,
        error: this.createApiError(
          'PROPERTY_SEARCH_FAILED',
          `Failed to search properties: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Get detailed property information
   */
  async getPropertyDetails(id: string): Promise<ApiResponse<PropertyDetails>> {
    try {
      if (!this.containers.properties) {
        return {
          success: false,
          error: this.createApiError('CONTAINER_NOT_READY', 'Properties container is not initialized')
        };
      }

      const { resource } = await this.containers.properties.item(id, id).read<PropertyDetails>();
      
      if (!resource) {
        return {
          success: false,
          error: this.createApiError('PROPERTY_DETAILS_NOT_FOUND', 'Property details not found')
        };
      }

      return {
        success: true,
        data: resource
      };
    } catch (error) {
      this.logger.error('Failed to retrieve property details', { propertyId: id, error });
      return {
        success: false,
        error: this.createApiError(
          'PROPERTY_DETAILS_RETRIEVE_FAILED',
          `Failed to retrieve property details: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }

  /**
   * Get container statistics for monitoring
   */
  async getContainerStats(): Promise<ApiResponse<Record<string, { itemCount: number; size: string }>>> {
    try {
      if (!this.isReady()) {
        return {
          success: false,
          error: this.createApiError('SERVICE_NOT_READY', 'Service is not ready')
        };
      }

      const stats: Record<string, { itemCount: number; size: string }> = {};

      // Get stats for each container
      const containerNames = ['orders', 'vendors', 'propertySummaries', 'properties'] as const;
      
      for (const containerName of containerNames) {
        try {
          const container = this.containers[containerName]!;
          const { resources } = await container.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
          const itemCount = resources[0] || 0;
          
          stats[containerName] = {
            itemCount,
            size: 'N/A' // Size calculation would require additional queries
          };
        } catch (error) {
          this.logger.warn(`Failed to get stats for container ${containerName}`, { error });
          stats[containerName] = {
            itemCount: 0,
            size: 'Error'
          };
        }
      }

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      this.logger.error('Failed to get container statistics', { error });
      return {
        success: false,
        error: this.createApiError(
          'STATS_FAILED',
          `Failed to get container statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      };
    }
  }
}