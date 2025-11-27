/**
 * Azure Configuration Service
 * Handles Azure Key Vault integration and environment configuration
 */

import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { Logger } from '../utils/logger';

export interface AzureConfig {
  // Cosmos DB Configuration
  cosmosEndpoint: string;
  cosmosKey: string;
  cosmosDatabaseName: string;

  // External API Keys
  googleMapsApiKey: string;
  azureMapsApiKey: string;
  censusApiKey: string;
  smartyStreetsAuthId: string;
  smartyStreetsAuthToken: string;

  // Application Configuration
  jwtSecret: string;
  allowedOrigins: string[];

  // Service Bus Configuration
  serviceBusConnectionString: string;

  // Storage Configuration
  storageConnectionString: string;

  // Application Insights
  applicationInsightsConnectionString: string;
}

export class AzureConfigService {
  private secretClient: SecretClient | null = null;
  private config: Partial<AzureConfig> = {};
  private isInitialized = false;
  private logger: Logger;

  constructor(private keyVaultUrl?: string) {
    this.logger = new Logger();
    
    // Initialize Key Vault client if running in Azure
    if (keyVaultUrl && this.isRunningInAzure()) {
      try {
        const credential = new DefaultAzureCredential();
        this.secretClient = new SecretClient(keyVaultUrl, credential);
      } catch (error) {
        this.logger.warn('Failed to initialize Azure Key Vault client', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /**
   * Initialize configuration from Azure Key Vault and environment variables
   */
  async initialize(): Promise<AzureConfig> {
    if (this.isInitialized) {
      return this.config as AzureConfig;
    }

    console.log('🔧 Initializing Azure configuration...');

    // Load configuration from Key Vault or environment variables
    this.config = {
      // Cosmos DB Configuration
      cosmosEndpoint: await this.getSecret('COSMOS-ENDPOINT') || process.env.AZURE_COSMOS_ENDPOINT || '',
      cosmosKey: await this.getSecret('COSMOS-KEY') || process.env.AZURE_COSMOS_KEY || '',
      cosmosDatabaseName: process.env.COSMOS_DATABASE_NAME || 'appraisal-management',

      // External API Keys
      googleMapsApiKey: await this.getSecret('GOOGLE-MAPS-API-KEY') || process.env.GOOGLE_MAPS_API_KEY || '',
      azureMapsApiKey: await this.getSecret('AZURE-MAPS-API-KEY') || process.env.AZURE_MAPS_API_KEY || '',
      censusApiKey: await this.getSecret('CENSUS-API-KEY') || process.env.CENSUS_API_KEY || '',
      smartyStreetsAuthId: await this.getSecret('SMARTYSTREETS-AUTH-ID') || process.env.SMARTYSTREETS_AUTH_ID || '',
      smartyStreetsAuthToken: await this.getSecret('SMARTYSTREETS-AUTH-TOKEN') || process.env.SMARTYSTREETS_AUTH_TOKEN || '',

      // Application Configuration
      jwtSecret: await this.getSecret('JWT-SECRET') || process.env.JWT_SECRET || '',
      allowedOrigins: this.parseAllowedOrigins(process.env.ALLOWED_ORIGINS || '*'),

      // Service Bus Configuration
      serviceBusConnectionString: await this.getSecret('SERVICE-BUS-CONNECTION-STRING') || process.env.SERVICE_BUS_CONNECTION_STRING || '',

      // Storage Configuration
      storageConnectionString: await this.getSecret('STORAGE-CONNECTION-STRING') || process.env.AZURE_STORAGE_CONNECTION_STRING || '',

      // Application Insights
      applicationInsightsConnectionString: await this.getSecret('APPLICATION-INSIGHTS-CONNECTION-STRING') || process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || ''
    };

    this.isInitialized = true;
    this.logConfigurationStatus();
    return this.config as AzureConfig;
  }

  /**
   * Get configuration value
   */
  getConfig(): AzureConfig {
    if (!this.isInitialized) {
      throw new Error('AzureConfigService not initialized. Call initialize() first.');
    }
    return this.config as AzureConfig;
  }

  /**
   * Get secret from Key Vault or fallback to environment variable
   */
  private async getSecret(secretName: string): Promise<string | undefined> {
    if (!this.secretClient) {
      return undefined;
    }

    try {
      const secret = await this.secretClient.getSecret(secretName);
      return secret.value;
    } catch (error) {
      console.warn(`Failed to retrieve secret ${secretName} from Key Vault:`, error);
      return undefined;
    }
  }

  /**
   * Check if running in Azure environment
   */
  private isRunningInAzure(): boolean {
    return !!(
      process.env.WEBSITE_SITE_NAME || 
      process.env.CONTAINER_APP_NAME ||
      process.env.AZURE_CLIENT_ID ||
      process.env.MSI_ENDPOINT
    );
  }

  /**
   * Parse allowed origins from environment variable
   */
  private parseAllowedOrigins(originsString: string): string[] {
    if (originsString === '*') {
      return ['*'];
    }
    return originsString.split(',').map(origin => origin.trim());
  }

  /**
   * Log configuration status for debugging
   */
  private logConfigurationStatus(): void {
    const status = {
      cosmos: !!(this.config.cosmosEndpoint && this.config.cosmosKey),
      googleMaps: !!this.config.googleMapsApiKey,
      azureMaps: !!this.config.azureMapsApiKey,
      census: !!this.config.censusApiKey,
      smartyStreets: !!(this.config.smartyStreetsAuthId && this.config.smartyStreetsAuthToken),
      serviceBus: !!this.config.serviceBusConnectionString,
      storage: !!this.config.storageConnectionString,
      applicationInsights: !!this.config.applicationInsightsConnectionString
    };

    this.logger.info('Configuration Status:', {
      cosmos: status.cosmos ? 'Configured' : 'Missing',
      googleMaps: status.googleMaps ? 'Configured' : 'Missing - API functionality limited',
      azureMaps: status.azureMaps ? 'Configured' : 'Missing (optional)',
      census: status.census ? 'Configured' : 'Missing - API functionality limited',
      smartyStreets: status.smartyStreets ? 'Configured' : 'Missing (optional)',
      serviceBus: status.serviceBus ? 'Configured' : 'Missing - events disabled',
      storage: status.storage ? 'Configured' : 'Missing - local storage only',
      applicationInsights: status.applicationInsights ? 'Configured' : 'Missing - no telemetry'
    });

    if (!status.cosmos) {
      console.warn('⚠️  Cosmos DB configuration missing. Application may not function properly.');
    }
  }

  /**
   * Validate required configuration
   */
  validateRequiredConfig(): string[] {
    const errors: string[] = [];

    if (!this.config.cosmosEndpoint || !this.config.cosmosKey) {
      errors.push('Cosmos DB configuration is required');
    }

    if (!this.config.jwtSecret || this.config.jwtSecret === '') {
      errors.push('JWT secret must be configured and cannot be empty');
    }

    // In production, be extra strict about JWT secret length and complexity
    if (process.env.NODE_ENV === 'production' && this.config.jwtSecret) {
      if (this.config.jwtSecret.length < 32) {
        errors.push('JWT secret must be at least 32 characters long for production');
      }
    }

    return errors;
  }
}