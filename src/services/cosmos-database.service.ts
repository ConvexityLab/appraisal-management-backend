import { CosmosClient, Database, Container } from '@azure/cosmos';
import { 
  AppraisalOrder, 
  Vendor, 
  OrderFilters,
  ApiResponse 
} from '../types/index.js';
import { 
  PropertySummary, 
  CreatePropertySummaryRequest 
} from '../types/property-enhanced.js';
import { Logger } from '../utils/logger.js';

/**
 * Simplified Azure Cosmos DB Database Service
 * Compatible with existing service interfaces
 */
export class CosmosDbDatabaseService {
  private logger: Logger;
  private client: CosmosClient | null = null;
  private database: Database | null = null;
  private isConnected: boolean = false;

  // Container references
  private ordersContainer: Container | null = null;
  private vendorsContainer: Container | null = null;
  private propertySummariesContainer: Container | null = null;

  private readonly databaseId = 'appraisal-management';

  constructor(
    private endpoint: string = process.env.COSMOS_ENDPOINT || '',
    private key: string = process.env.COSMOS_KEY || ''
  ) {
    this.logger = new Logger();
  }

  /**
   * Initialize connection to Cosmos DB
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Azure Cosmos DB');

      if (!this.endpoint || !this.key) {
        // Use default connection for development
        this.endpoint = 'https://localhost:8081';
        this.key = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
        this.logger.warn('Using Cosmos DB Emulator default credentials');
      }

      this.client = new CosmosClient({
        endpoint: this.endpoint,
        key: this.key
      });

      // Create database
      const { database } = await this.client.databases.createIfNotExists({
        id: this.databaseId
      });
      this.database = database;

      // Create containers
      await this.initializeContainers();

      this.isConnected = true;
      this.logger.info('Successfully connected to Azure Cosmos DB');

    } catch (error) {
      this.logger.error('Failed to connect to Cosmos DB', { error });
      throw error;
    }
  }

  /**
   * Initialize containers with basic configuration
   */
  private async initializeContainers(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    // Orders container
    const { container: ordersContainer } = await this.database.containers.createIfNotExists({
      id: 'orders',
      partitionKey: '/status'
    });
    this.ordersContainer = ordersContainer;

    // Vendors container
    const { container: vendorsContainer } = await this.database.containers.createIfNotExists({
      id: 'vendors',
      partitionKey: '/status'
    });
    this.vendorsContainer = vendorsContainer;

    // Property summaries container
    const { container: propertySummariesContainer } = await this.database.containers.createIfNotExists({
      id: 'property-summaries',
      partitionKey: '/propertyType'
    });
    this.propertySummariesContainer = propertySummariesContainer;

    this.logger.info('Cosmos DB containers initialized');
  }

  /**
   * Check connection status
   */
  isDbConnected(): boolean {
    return this.isConnected;
  }

  // ===============================
  // Order Operations
  // ===============================

  async createOrder(order: AppraisalOrder): Promise<AppraisalOrder> {
    try {
      if (!this.ordersContainer) throw new Error('Orders container not initialized');

      const { resource } = await this.ordersContainer.items.create(order);
      return resource as AppraisalOrder;

    } catch (error) {
      this.logger.error('Failed to create order', { error });
      throw error;
    }
  }

  async findOrderById(id: string): Promise<AppraisalOrder | null> {
    try {
      if (!this.ordersContainer) throw new Error('Orders container not initialized');

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      };

      const { resources } = await this.ordersContainer.items.query<AppraisalOrder>(querySpec).fetchAll();
      return resources.length > 0 ? (resources[0] || null) : null;

    } catch (error) {
      this.logger.error('Failed to find order', { error, id });
      return null;
    }
  }

  async findOrders(filters: OrderFilters, offset: number, limit: number): Promise<{ orders: AppraisalOrder[]; total: number }> {
    try {
      if (!this.ordersContainer) throw new Error('Orders container not initialized');

      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      // Apply basic filters
      if (filters.status && filters.status.length > 0) {
        query += ' AND c.status IN (' + filters.status.map((_, index) => `@status${index}`).join(', ') + ')';
        filters.status.forEach((status, index) => {
          parameters.push({ name: `@status${index}`, value: status });
        });
      }

      if (filters.assignedVendorId) {
        query += ' AND c.assignedVendorId = @assignedVendorId';
        parameters.push({ name: '@assignedVendorId', value: filters.assignedVendorId });
      }

      query += ' ORDER BY c.createdAt DESC';
      query += ` OFFSET ${offset} LIMIT ${limit}`;

      const querySpec = { query, parameters };
      const { resources } = await this.ordersContainer.items.query<AppraisalOrder>(querySpec).fetchAll();

      // Simple count - in production, use a separate count query
      const total = resources.length;

      return { orders: resources, total };

    } catch (error) {
      this.logger.error('Failed to find orders', { error });
      return { orders: [], total: 0 };
    }
  }

  async updateOrder(id: string, order: AppraisalOrder): Promise<AppraisalOrder> {
    try {
      if (!this.ordersContainer) throw new Error('Orders container not initialized');

      const { resource } = await this.ordersContainer.item(id, order.status).replace(order);
      return resource as AppraisalOrder;

    } catch (error) {
      this.logger.error('Failed to update order', { error, id });
      throw error;
    }
  }

  async deleteOrder(id: string): Promise<void> {
    try {
      if (!this.ordersContainer) throw new Error('Orders container not initialized');

      // First get the order to get the partition key
      const order = await this.findOrderById(id);
      if (!order) {
        throw new Error(`Order not found: ${id}`);
      }

      await this.ordersContainer.item(id, order.status).delete();

    } catch (error) {
      this.logger.error('Failed to delete order', { error, id });
      throw error;
    }
  }

  // ===============================
  // Vendor Operations
  // ===============================

  async createVendor(vendor: Vendor): Promise<Vendor> {
    try {
      if (!this.vendorsContainer) throw new Error('Vendors container not initialized');

      const { resource } = await this.vendorsContainer.items.create(vendor);
      return resource as Vendor;

    } catch (error) {
      this.logger.error('Failed to create vendor', { error });
      throw error;
    }
  }

  async findVendorById(id: string): Promise<Vendor | null> {
    try {
      if (!this.vendorsContainer) throw new Error('Vendors container not initialized');

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      };

      const { resources } = await this.vendorsContainer.items.query<Vendor>(querySpec).fetchAll();
      return resources.length > 0 ? (resources[0] || null) : null;

    } catch (error) {
      this.logger.error('Failed to find vendor', { error, id });
      return null;
    }
  }

  async findVendors(filters: any, offset: number, limit: number): Promise<{ vendors: Vendor[]; total: number }> {
    try {
      if (!this.vendorsContainer) throw new Error('Vendors container not initialized');

      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      if (filters.status) {
        query += ' AND c.status = @status';
        parameters.push({ name: '@status', value: filters.status });
      }

      query += ' ORDER BY c.onboardingDate DESC';
      query += ` OFFSET ${offset} LIMIT ${limit}`;

      const querySpec = { query, parameters };
      const { resources } = await this.vendorsContainer.items.query<Vendor>(querySpec).fetchAll();

      return { vendors: resources, total: resources.length };

    } catch (error) {
      this.logger.error('Failed to find vendors', { error });
      return { vendors: [], total: 0 };
    }
  }

  async updateVendor(id: string, vendor: Vendor): Promise<Vendor> {
    try {
      if (!this.vendorsContainer) throw new Error('Vendors container not initialized');

      const { resource } = await this.vendorsContainer.item(id, vendor.status).replace(vendor);
      return resource as Vendor;

    } catch (error) {
      this.logger.error('Failed to update vendor', { error, id });
      throw error;
    }
  }

  async deleteVendor(id: string): Promise<void> {
    try {
      if (!this.vendorsContainer) throw new Error('Vendors container not initialized');

      const vendor = await this.findVendorById(id);
      if (!vendor) {
        throw new Error(`Vendor not found: ${id}`);
      }

      await this.vendorsContainer.item(id, vendor.status).delete();

    } catch (error) {
      this.logger.error('Failed to delete vendor', { error, id });
      throw error;
    }
  }

  // ===============================
  // Property Operations
  // ===============================

  async createPropertySummary(property: CreatePropertySummaryRequest): Promise<PropertySummary> {
    try {
      if (!this.propertySummariesContainer) throw new Error('Property summaries container not initialized');

      const propertyWithDefaults: PropertySummary = {
        id: this.generateId(),
        lastUpdated: new Date(),
        dataSource: 'internal',
        owner: {},
        quickLists: {},
        building: {},
        valuation: {},
        ...property
      };

      const { resource } = await this.propertySummariesContainer.items.create(propertyWithDefaults);
      return resource as PropertySummary;

    } catch (error) {
      this.logger.error('Failed to create property summary', { error });
      throw error;
    }
  }

  async findPropertySummaryById(id: string): Promise<PropertySummary | null> {
    try {
      if (!this.propertySummariesContainer) throw new Error('Property summaries container not initialized');

      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      };

      const { resources } = await this.propertySummariesContainer.items.query<PropertySummary>(querySpec).fetchAll();
      return resources.length > 0 ? (resources[0] || null) : null;

    } catch (error) {
      this.logger.error('Failed to find property summary', { error, id });
      return null;
    }
  }

  async searchPropertySummaries(filters: any, offset: number, limit: number): Promise<{ properties: PropertySummary[]; total: number }> {
    try {
      if (!this.propertySummariesContainer) throw new Error('Property summaries container not initialized');

      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: any[] = [];

      if (filters.propertyType && Array.isArray(filters.propertyType)) {
        query += ' AND c.propertyType IN (' + filters.propertyType.map((_: any, index: number) => `@type${index}`).join(', ') + ')';
        filters.propertyType.forEach((type: any, index: number) => {
          parameters.push({ name: `@type${index}`, value: type });
        });
      }

      if (filters.address?.state) {
        query += ' AND c.address.state = @state';
        parameters.push({ name: '@state', value: filters.address.state });
      }

      query += ' ORDER BY c.lastUpdated DESC';
      query += ` OFFSET ${offset} LIMIT ${limit}`;

      const querySpec = { query, parameters };
      const { resources } = await this.propertySummariesContainer.items.query<PropertySummary>(querySpec).fetchAll();

      return { properties: resources, total: resources.length };

    } catch (error) {
      this.logger.error('Failed to search property summaries', { error });
      return { properties: [], total: 0 };
    }
  }

  // ===============================
  // Utility Methods
  // ===============================

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; database: string }> {
    try {
      if (!this.database) {
        throw new Error('Database not connected');
      }

      await this.database.read();
      
      return {
        status: 'healthy',
        database: this.databaseId
      };

    } catch (error) {
      this.logger.error('Cosmos DB health check failed', { error });
      throw error;
    }
  }
}

export default CosmosDbDatabaseService;