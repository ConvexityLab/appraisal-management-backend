import { CosmosClient, Database, Container, ItemResponse, FeedResponse } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { 
  AppraisalOrder, 
  Vendor, 
  OrderFilters, 
  PropertyDetails,
  PropertyAddress,
  ApiResponse
} from '../types/index';
import { 
  PropertySummary, 
  CreatePropertySummaryRequest 
} from '../types/property-enhanced';
import { Logger } from '../utils/logger';
import { createApiError, ErrorCodes } from '../utils/api-response.util';

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
  private qcResultsContainer: Container | null = null;
  private qcChecklistsContainer: Container | null = null;
  private qcExecutionsContainer: Container | null = null;
  private qcSessionsContainer: Container | null = null;
  private qcTemplatesContainer: Container | null = null;
  private analyticsContainer: Container | null = null;

  private readonly databaseId = 'appraisal-management';
  private readonly containers = {
    orders: 'orders',
    vendors: 'vendors',
    users: 'users',
    properties: 'properties',
    propertySummaries: 'property-summaries',
    qcResults: 'qc-results',
    qcChecklists: 'qc-checklists',
    qcExecutions: 'qc-executions',
    qcSessions: 'qc-sessions',
    qcTemplates: 'qc-templates',
    analytics: 'analytics'
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
   * Uses simplified indexing for emulator, complex for production
   */
  private async initializeContainers(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    try {
      const isEmulator = this.endpoint.includes('localhost') || this.endpoint.includes('127.0.0.1');
      
      // Orders container with environment-specific configuration
      const ordersContainerDef: any = {
        id: this.containers.orders,
        partitionKey: '/clientId' // Partition by clientId for better distribution
      };

      if (isEmulator) {
        // Simple indexing for emulator compatibility
        ordersContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }]
        };
        this.logger.info('Using simplified indexing for emulator');
      } else {
        // Production indexing with composite indexes
        ordersContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          compositeIndexes: [
            [
              { path: '/status', order: 'ascending' },
              { path: '/dueDate', order: 'ascending' }
            ],
            [
              { path: '/priority', order: 'ascending' },
              { path: '/createdAt', order: 'descending' }
            ],
            [
              { path: '/clientId', order: 'ascending' },
              { path: '/status', order: 'ascending' }
            ]
          ]
        };
        this.logger.info('Using production indexing with composite indexes');
      }

      const { container: ordersContainer } = await this.database.containers.createIfNotExists(ordersContainerDef);
      this.ordersContainer = ordersContainer;

      // Vendors container with environment-specific configuration
      const vendorsContainerDef: any = {
        id: this.containers.vendors,
        partitionKey: '/licenseState'
      };

      if (isEmulator) {
        vendorsContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }]
        };
      } else {
        vendorsContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          excludedPaths: [
            { path: '/bankingInfo/*' },
            { path: '/insuranceInfo/documents/*' }
          ],
          compositeIndexes: [
            [
              { path: '/status', order: 'ascending' },
              { path: '/performance/rating', order: 'descending' }
            ],
            [
              { path: '/licenseState', order: 'ascending' },
              { path: '/serviceTypes', order: 'ascending' }
            ]
          ]
        };
      }

      const { container: vendorsContainer } = await this.database.containers.createIfNotExists(vendorsContainerDef);
      this.vendorsContainer = vendorsContainer;

      // Property Summaries container with environment-specific configuration
      const propertySummariesContainerDef: any = {
        id: this.containers.propertySummaries,
        partitionKey: '/address/state'
      };

      if (isEmulator) {
        propertySummariesContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }]
        };
      } else {
        propertySummariesContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          compositeIndexes: [
            [
              { path: '/address/state', order: 'ascending' },
              { path: '/propertyType', order: 'ascending' }
            ],
            [
              { path: '/propertyType', order: 'ascending' },
              { path: '/valuation/estimatedValue', order: 'descending' }
            ]
          ]
        };
      }

      const { container: propertySummariesContainer } = await this.database.containers.createIfNotExists(propertySummariesContainerDef);
      this.propertySummariesContainer = propertySummariesContainer;

      // Properties container with environment-specific configuration
      const propertiesContainerDef: any = {
        id: this.containers.properties,
        partitionKey: '/address/state'
      };

      if (isEmulator) {
        propertiesContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }]
        };
      } else {
        propertiesContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          excludedPaths: [
            { path: '/deedHistory/*' },
            { path: '/demographics/*' },
            { path: '/mortgageHistory/*' }
          ]
        };
      }

      const { container: propertiesContainer } = await this.database.containers.createIfNotExists(propertiesContainerDef);
      this.propertiesContainer = propertiesContainer;

      // QC Results container with environment-specific configuration
      const qcResultsContainerDef: any = {
        id: this.containers.qcResults,
        partitionKey: '/orderId'
      };

      if (isEmulator) {
        qcResultsContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }]
        };
      } else {
        qcResultsContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
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
        };
      }

      const { container: qcResultsContainer } = await this.database.containers.createIfNotExists(qcResultsContainerDef);
      this.qcResultsContainer = qcResultsContainer;

      // Analytics container with environment-specific configuration
      const analyticsContainerDef: any = {
        id: this.containers.analytics,
        partitionKey: '/reportType'
      };

      if (isEmulator) {
        analyticsContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }]
        };
      } else {
        analyticsContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
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
        };
      }

      const { container: analyticsContainer } = await this.database.containers.createIfNotExists(analyticsContainerDef);
      this.analyticsContainer = analyticsContainer;

      // Users container
      const usersContainerDef: any = {
        id: this.containers.users,
        partitionKey: '/organizationId'
      };

      if (!isEmulator) {
        usersContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          excludedPaths: [{ path: '/passwordHash' }],
          compositeIndexes: [
            [
              { path: '/role', order: 'ascending' },
              { path: '/isActive', order: 'ascending' }
            ]
          ]
        };
      }

      const { container: usersContainer } = await this.database.containers.createIfNotExists(usersContainerDef);
      this.usersContainer = usersContainer;

      // QC Checklists container
      const qcChecklistsContainerDef: any = {
        id: this.containers.qcChecklists,
        partitionKey: '/clientId'
      };

      if (!isEmulator) {
        qcChecklistsContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          compositeIndexes: [
            [
              { path: '/status', order: 'ascending' },
              { path: '/category', order: 'ascending' }
            ],
            [
              { path: '/clientId', order: 'ascending' },
              { path: '/createdAt', order: 'descending' }
            ]
          ]
        };
      }

      const { container: qcChecklistsContainer } = await this.database.containers.createIfNotExists(qcChecklistsContainerDef);
      this.qcChecklistsContainer = qcChecklistsContainer;

      // QC Executions container
      const qcExecutionsContainerDef: any = {
        id: this.containers.qcExecutions,
        partitionKey: '/checklistId'
      };

      if (!isEmulator) {
        qcExecutionsContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          compositeIndexes: [
            [
              { path: '/status', order: 'ascending' },
              { path: '/executedAt', order: 'descending' }
            ],
            [
              { path: '/checklistId', order: 'ascending' },
              { path: '/status', order: 'ascending' }
            ]
          ]
        };
      }

      const { container: qcExecutionsContainer } = await this.database.containers.createIfNotExists(qcExecutionsContainerDef);
      this.qcExecutionsContainer = qcExecutionsContainer;

      // QC Sessions container
      const qcSessionsContainerDef: any = {
        id: this.containers.qcSessions,
        partitionKey: '/userId'
      };

      if (!isEmulator) {
        qcSessionsContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          compositeIndexes: [
            [
              { path: '/status', order: 'ascending' },
              { path: '/startedAt', order: 'descending' }
            ]
          ]
        };
      }

      const { container: qcSessionsContainer } = await this.database.containers.createIfNotExists(qcSessionsContainerDef);
      this.qcSessionsContainer = qcSessionsContainer;

      // QC Templates container
      const qcTemplatesContainerDef: any = {
        id: this.containers.qcTemplates,
        partitionKey: '/category'
      };

      if (!isEmulator) {
        qcTemplatesContainerDef.indexingPolicy = {
          indexingMode: 'consistent',
          automatic: true,
          includedPaths: [{ path: '/*' }],
          compositeIndexes: [
            [
              { path: '/category', order: 'ascending' },
              { path: '/version', order: 'descending' }
            ],
            [
              { path: '/isActive', order: 'ascending' },
              { path: '/priority', order: 'ascending' }
            ]
          ]
        };
      }

      const { container: qcTemplatesContainer } = await this.database.containers.createIfNotExists(qcTemplatesContainerDef);
      this.qcTemplatesContainer = qcTemplatesContainer;

      this.logger.info('Cosmos DB containers initialized successfully', {
        containers: Object.keys(this.containers).length,
        qcContainers: ['qc-checklists', 'qc-executions', 'qc-sessions', 'qc-templates']
      });

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
      this.logger.error('Failed to create item', { error: error instanceof Error ? error.message : 'Unknown error', containerName });
      return {
        success: false,
        error: this.createApiError('CREATE_ITEM_FAILED', 'Failed to create item')
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