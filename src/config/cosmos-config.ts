import { Logger } from '../utils/logger.js';

/**
 * Configuration service for Azure Cosmos DB
 * Manages connection settings, environment variables, and deployment configurations
 */
export class CosmosDbConfig {
  private logger: Logger;
  private static instance: CosmosDbConfig;

  // Configuration properties
  public readonly endpoint: string;
  public readonly key: string;
  public readonly databaseName: string;
  public readonly containers: Record<string, string>;
  public readonly environment: string;
  public readonly region: string;

  // Performance settings
  public readonly connectionPolicy: any;
  public readonly requestOptions: any;

  // Security settings
  public readonly enableSSL: boolean;
  public readonly enableEndpointDiscovery: boolean;

  private constructor() {
    this.logger = new Logger();
    
    // Load configuration from environment variables
    this.endpoint = process.env.COSMOS_ENDPOINT || process.env.AZURE_COSMOS_ENDPOINT || 'https://localhost:8081';
    this.key = process.env.COSMOS_KEY || process.env.AZURE_COSMOS_KEY || 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
    this.databaseName = process.env.COSMOS_DATABASE_NAME || 'appraisal-management';
    this.environment = process.env.NODE_ENV || 'development';
    this.region = process.env.AZURE_REGION || 'East US';

    // Container mappings
    this.containers = {
      orders: process.env.COSMOS_CONTAINER_ORDERS || 'orders',
      vendors: process.env.COSMOS_CONTAINER_VENDORS || 'vendors',
      propertySummaries: process.env.COSMOS_CONTAINER_PROPERTY_SUMMARIES || 'property-summaries',
      properties: process.env.COSMOS_CONTAINER_PROPERTIES || 'properties'
    };

    // Performance settings
    this.connectionPolicy = {
      requestTimeout: parseInt(process.env.COSMOS_REQUEST_TIMEOUT || '30000'),
      enableEndpointDiscovery: true,
      preferredLocations: this.getPreferredLocations(),
      retryOptions: {
        maxRetryAttemptCount: 3,
        fixedRetryIntervalInMilliseconds: 0,
        maxRetryWaitTimeInSeconds: 30
      }
    };

    this.requestOptions = {
      enableCrossPartitionQuery: true,
      populateQueryMetrics: this.environment === 'development',
      maxItemCount: parseInt(process.env.COSMOS_MAX_ITEM_COUNT || '100')
    };

    // Security settings
    this.enableSSL = process.env.COSMOS_ENABLE_SSL !== 'false';
    this.enableEndpointDiscovery = process.env.COSMOS_ENABLE_ENDPOINT_DISCOVERY !== 'false';

    this.validateConfiguration();
    this.logConfiguration();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CosmosDbConfig {
    if (!CosmosDbConfig.instance) {
      CosmosDbConfig.instance = new CosmosDbConfig();
    }
    return CosmosDbConfig.instance;
  }

  /**
   * Get preferred regions based on environment
   */
  private getPreferredLocations(): string[] {
    const locations = process.env.COSMOS_PREFERRED_LOCATIONS?.split(',') || [];
    
    if (locations.length > 0) {
      return locations.map(loc => loc.trim());
    }

    // Default locations based on environment
    switch (this.environment) {
      case 'production':
        return ['East US', 'West US 2', 'Central US'];
      case 'staging':
        return ['East US', 'West US 2'];
      case 'development':
      default:
        return ['East US'];
    }
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    const requiredSettings = [
      { key: 'endpoint', value: this.endpoint },
      { key: 'key', value: this.key },
      { key: 'databaseName', value: this.databaseName }
    ];

    const missingSettings = requiredSettings.filter(setting => !setting.value);
    
    if (missingSettings.length > 0) {
      const missing = missingSettings.map(s => s.key).join(', ');
      throw new Error(`Missing required Cosmos DB configuration: ${missing}`);
    }

    // Validate endpoint format
    if (!this.endpoint.startsWith('https://') && !this.endpoint.startsWith('http://')) {
      throw new Error('Cosmos DB endpoint must be a valid HTTPS URL');
    }

    // Validate key format (for non-emulator)
    if (!this.endpoint.includes('localhost') && this.key.length < 50) {
      this.logger.warn('Cosmos DB key appears to be invalid for production use');
    }
  }

  /**
   * Log configuration (without sensitive data)
   */
  private logConfiguration(): void {
    this.logger.info('Cosmos DB configuration loaded', {
      endpoint: this.maskEndpoint(this.endpoint),
      databaseName: this.databaseName,
      environment: this.environment,
      region: this.region,
      containers: Object.keys(this.containers),
      preferredLocations: this.connectionPolicy.preferredLocations,
      enableSSL: this.enableSSL,
      enableEndpointDiscovery: this.enableEndpointDiscovery
    });
  }

  /**
   * Mask endpoint for logging
   */
  private maskEndpoint(endpoint: string): string {
    if (endpoint.includes('localhost')) {
      return endpoint;
    }
    
    const url = new URL(endpoint);
    const hostname = url.hostname;
    const parts = hostname.split('.');
    
    if (parts.length > 2 && parts[0]) {
      parts[0] = parts[0].substring(0, 3) + '***';
      return `${url.protocol}//${parts.join('.')}`;
    }
    
    return endpoint;
  }

  /**
   * Get connection string (for compatibility)
   */
  public getConnectionString(): string {
    return `AccountEndpoint=${this.endpoint};AccountKey=${this.key};`;
  }

  /**
   * Get throughput settings based on environment
   */
  public getThroughputSettings(): Record<string, number> {
    const baseSettings = {
      orders: 1000,
      vendors: 800,
      propertySummaries: 2000,
      properties: 1500
    };

    // Scale down for non-production environments
    if (this.environment !== 'production') {
      const scaleFactor = this.environment === 'staging' ? 0.5 : 0.2;
      return Object.fromEntries(
        Object.entries(baseSettings).map(([key, value]) => 
          [key, Math.max(400, Math.floor(value * scaleFactor))]
        )
      );
    }

    return baseSettings;
  }

  /**
   * Get indexing policy for a container
   */
  public getIndexingPolicy(containerName: string): any {
    const policies: Record<string, any> = {
      orders: {
        indexingMode: 'consistent',
        automatic: true,
        includedPaths: [{ path: '/*' }],
        excludedPaths: [
          { path: '/"_etag"/?' },
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
      },
      vendors: {
        indexingMode: 'consistent',
        automatic: true,
        includedPaths: [{ path: '/*' }],
        excludedPaths: [
          { path: '/"_etag"/?' },
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
            { path: '/productTypes', order: 'ascending' }
          ]
        ]
      },
      'property-summaries': {
        indexingMode: 'consistent',
        automatic: true,
        includedPaths: [{ path: '/*' }],
        excludedPaths: [{ path: '/"_etag"/?' }],
        spatialIndexes: [
          {
            path: '/address/location/*',
            types: ['Point', 'Polygon']
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
      },
      properties: {
        indexingMode: 'consistent',
        automatic: true,
        includedPaths: [
          { path: '/id/?' },
          { path: '/address/*' },
          { path: '/assessment/*' },
          { path: '/valuation/*' }
        ],
        excludedPaths: [
          { path: '/"_etag"/?' },
          { path: '/deedHistory/*' },
          { path: '/demographics/*' },
          { path: '/mortgageHistory/*' }
        ]
      }
    };

    return policies[containerName] || policies['property-summaries'];
  }

  /**
   * Get health check configuration
   */
  public getHealthCheckConfig(): any {
    return {
      timeout: 10000,
      retries: 3,
      interval: 30000,
      checkDatabase: true,
      checkContainers: true,
      logResults: this.environment === 'development'
    };
  }

  /**
   * Get monitoring configuration
   */
  public getMonitoringConfig(): any {
    return {
      enableRequestMetrics: true,
      enableQueryMetrics: this.environment !== 'production',
      logSlowQueries: true,
      slowQueryThreshold: 1000, // ms
      logFrequency: this.environment === 'production' ? 60000 : 10000, // ms
      enableDetailedErrors: this.environment === 'development'
    };
  }

  /**
   * Create deployment configuration
   */
  public getDeploymentConfig(): any {
    return {
      bicepTemplate: 'infrastructure/modules/cosmos-production.bicep',
      parameters: {
        location: process.env.AZURE_LOCATION || 'East US',
        environment: this.environment,
        cosmosAccountName: `appraisal-cosmos-${this.environment}`,
        databaseName: this.databaseName
      },
      tags: {
        Environment: this.environment,
        Project: 'AppraisalManagement',
        Service: 'CosmosDB',
        ManagedBy: 'Infrastructure-as-Code'
      }
    };
  }

  /**
   * Get backup configuration
   */
  public getBackupConfig(): any {
    return {
      type: 'Periodic',
      periodicModeProperties: {
        backupIntervalInMinutes: this.environment === 'production' ? 240 : 1440,
        backupRetentionIntervalInHours: this.environment === 'production' ? 720 : 168,
        backupStorageRedundancy: this.environment === 'production' ? 'Geo' : 'Local'
      }
    };
  }

  /**
   * Validate connection
   */
  public async validateConnection(): Promise<boolean> {
    try {
      // This would be implemented with actual Cosmos DB client validation
      this.logger.info('Validating Cosmos DB connection configuration');
      
      // Basic validation checks
      if (!this.endpoint || !this.key || !this.databaseName) {
        throw new Error('Missing required connection parameters');
      }

      // URL validation
      new URL(this.endpoint);

      this.logger.info('Cosmos DB configuration validation successful');
      return true;

    } catch (error) {
      this.logger.error('Cosmos DB configuration validation failed', { error });
      return false;
    }
  }
}

// Export singleton instance
export const cosmosConfig = CosmosDbConfig.getInstance();
export default CosmosDbConfig;