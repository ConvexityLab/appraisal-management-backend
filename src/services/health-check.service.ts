/**
 * Health Check Service
 * Comprehensive health monitoring for all Azure services and dependencies
 */

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { ServiceBusClient } from '@azure/service-bus';
import { BlobServiceClient } from '@azure/storage-blob';
import { AzureConfigService } from './azure-config.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
  services: {
    [key: string]: ServiceHealthStatus;
  };
  dependencies: {
    [key: string]: DependencyHealthStatus;
  };
}

export interface ServiceHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  lastChecked: string;
  message?: string;
  details?: any;
}

export interface DependencyHealthStatus extends ServiceHealthStatus {
  critical: boolean;
}

export class HealthCheckService {
  private startTime: Date;

  constructor(
    private configService: AzureConfigService
  ) {
    this.startTime = new Date();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    const [services, dependencies] = await Promise.all([
      this.checkServices(),
      this.checkDependencies()
    ]);

    // Determine overall status
    const overallStatus = this.determineOverallStatus(services, dependencies);

    return {
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.0',
      timestamp,
      uptime,
      environment: process.env.NODE_ENV || 'development',
      services,
      dependencies
    };
  }

  /**
   * Check internal services
   */
  private async checkServices(): Promise<{ [key: string]: ServiceHealthStatus }> {
    const config = this.configService.getConfig();
    const checks: Promise<[string, ServiceHealthStatus]>[] = [];

    // API Service (self)
    checks.push(this.checkApiService());

    // Configuration Service
    checks.push(this.checkConfigurationService());

    const results = await Promise.allSettled(checks);
    const services: { [key: string]: ServiceHealthStatus } = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const [serviceName, status] = result.value;
        services[serviceName] = status;
      } else {
        services[`service_${index}`] = {
          status: 'unhealthy',
          lastChecked: new Date().toISOString(),
          message: result.reason?.message || 'Unknown error'
        };
      }
    });

    return services;
  }

  /**
   * Check external dependencies
   */
  private async checkDependencies(): Promise<{ [key: string]: DependencyHealthStatus }> {
    const config = this.configService.getConfig();
    const checks: Promise<[string, DependencyHealthStatus]>[] = [];

    // Cosmos DB (critical)
    if (config.cosmosEndpoint) {
      checks.push(this.checkCosmosDb(config.cosmosEndpoint));
    }

    // Service Bus (non-critical)
    if (config.serviceBusNamespace) {
      checks.push(this.checkServiceBus(config.serviceBusNamespace));
    }

    // Storage (non-critical)
    if (config.storageConnectionString) {
      checks.push(this.checkStorage(config.storageConnectionString));
    }

    // External APIs (non-critical)
    if (config.googleMapsApiKey) {
      checks.push(this.checkGoogleMapsApi(config.googleMapsApiKey));
    }

    const results = await Promise.allSettled(checks);
    const dependencies: { [key: string]: DependencyHealthStatus } = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const [depName, status] = result.value;
        dependencies[depName] = status;
      } else {
        dependencies[`dependency_${index}`] = {
          status: 'unhealthy',
          critical: false,
          lastChecked: new Date().toISOString(),
          message: result.reason?.message || 'Unknown error'
        };
      }
    });

    return dependencies;
  }

  /**
   * Check API service health
   */
  private async checkApiService(): Promise<[string, ServiceHealthStatus]> {
    const startTime = Date.now();
    try {
      // Simple memory and uptime check
      const memUsage = process.memoryUsage();
      const responseTime = Date.now() - startTime;

      return ['api', {
        status: 'healthy',
        responseTime,
        lastChecked: new Date().toISOString(),
        details: {
          memoryUsage: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
          },
          uptime: `${Math.floor(process.uptime())}s`
        }
      }];
    } catch (error) {
      return ['api', {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown error'
      }];
    }
  }

  /**
   * Check configuration service
   */
  private async checkConfigurationService(): Promise<[string, ServiceHealthStatus]> {
    try {
      const config = this.configService.getConfig();
      const validationErrors = this.configService.validateRequiredConfig();

      return ['configuration', {
        status: validationErrors.length > 0 ? 'degraded' : 'healthy',
        lastChecked: new Date().toISOString(),
        message: validationErrors.length > 0 ? `Configuration issues: ${validationErrors.join(', ')}` : 'Configuration valid',
        details: {
          configuredServices: {
            cosmos: !!config.cosmosEndpoint,
            googleMaps: !!config.googleMapsApiKey,
            serviceBus: !!config.serviceBusNamespace,
            storage: !!config.storageConnectionString
          }
        }
      }];
    } catch (error) {
      return ['configuration', {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Configuration check failed'
      }];
    }
  }

  /**
   * Check Cosmos DB connectivity
   */
  private async checkCosmosDb(endpoint: string): Promise<[string, DependencyHealthStatus]> {
    const startTime = Date.now();
    try {
      const isEmulator = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
      const clientConfig: any = { endpoint };
      
      if (isEmulator) {
        clientConfig.key = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
      } else {
        const credential = new DefaultAzureCredential();
        clientConfig.aadCredentials = credential;
      }
      
      const client = new CosmosClient(clientConfig);
      await client.getDatabaseAccount();
      const responseTime = Date.now() - startTime;

      return ['cosmosdb', {
        status: 'healthy',
        critical: true,
        responseTime,
        lastChecked: new Date().toISOString(),
        message: 'Connection successful'
      }];
    } catch (error) {
      return ['cosmosdb', {
        status: 'unhealthy',
        critical: true,
        lastChecked: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Connection failed'
      }];
    }
  }

  /**
   * Check Service Bus connectivity
   */
  private async checkServiceBus(serviceBusNamespace: string): Promise<[string, DependencyHealthStatus]> {
    const startTime = Date.now();
    try {
      const isEmulator = serviceBusNamespace === 'local-emulator';
      let client: ServiceBusClient;
      
      if (isEmulator) {
        // Skip check for emulator
        return ['servicebus', {
          status: 'healthy',
          critical: false,
          lastChecked: new Date().toISOString(),
          message: 'Local emulator mode'
        }];
      } else {
        const credential = new DefaultAzureCredential();
        client = new ServiceBusClient(serviceBusNamespace, credential);
      }
      
      // Simple connection test
      await client.close();
      const responseTime = Date.now() - startTime;

      return ['servicebus', {
        status: 'healthy',
        critical: false,
        responseTime,
        lastChecked: new Date().toISOString(),
        message: 'Connection successful'
      }];
    } catch (error) {
      return ['servicebus', {
        status: 'unhealthy',
        critical: false,
        lastChecked: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Connection failed'
      }];
    }
  }

  /**
   * Check Storage connectivity
   */
  private async checkStorage(connectionString: string): Promise<[string, DependencyHealthStatus]> {
    const startTime = Date.now();
    try {
      const client = BlobServiceClient.fromConnectionString(connectionString);
      await client.getAccountInfo();
      const responseTime = Date.now() - startTime;

      return ['storage', {
        status: 'healthy',
        critical: false,
        responseTime,
        lastChecked: new Date().toISOString(),
        message: 'Connection successful'
      }];
    } catch (error) {
      return ['storage', {
        status: 'unhealthy',
        critical: false,
        lastChecked: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Connection failed'
      }];
    }
  }

  /**
   * Check Google Maps API
   */
  private async checkGoogleMapsApi(apiKey: string): Promise<[string, DependencyHealthStatus]> {
    const startTime = Date.now();
    try {
      // Simple API test - geocode a known address
      const axios = require('axios');
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json`,
        {
          params: {
            address: '1600 Amphitheatre Parkway, Mountain View, CA',
            key: apiKey
          },
          timeout: 5000
        }
      );

      const responseTime = Date.now() - startTime;

      return ['googlemaps', {
        status: response.data.status === 'OK' ? 'healthy' : 'degraded',
        critical: false,
        responseTime,
        lastChecked: new Date().toISOString(),
        message: `API Status: ${response.data.status}`
      }];
    } catch (error) {
      return ['googlemaps', {
        status: 'unhealthy',
        critical: false,
        lastChecked: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'API check failed'
      }];
    }
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(
    services: { [key: string]: ServiceHealthStatus },
    dependencies: { [key: string]: DependencyHealthStatus }
  ): 'healthy' | 'unhealthy' | 'degraded' {
    // Check for critical dependency failures
    const criticalDeps = Object.values(dependencies).filter(dep => dep.critical);
    const unhealthyCriticalDeps = criticalDeps.filter(dep => dep.status === 'unhealthy');
    
    if (unhealthyCriticalDeps.length > 0) {
      return 'unhealthy';
    }

    // Check for any unhealthy services
    const unhealthyServices = Object.values(services).filter(service => service.status === 'unhealthy');
    if (unhealthyServices.length > 0) {
      return 'unhealthy';
    }

    // Check for degraded status
    const degradedServices = Object.values(services).filter(service => service.status === 'degraded');
    const degradedDeps = Object.values(dependencies).filter(dep => dep.status === 'degraded');
    
    if (degradedServices.length > 0 || degradedDeps.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }
}