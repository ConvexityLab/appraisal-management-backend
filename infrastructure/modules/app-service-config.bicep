// App Service Configuration Module
// Configures App Service with Key Vault references and settings

@description('App Service name')
param appServiceName string

@description('Key Vault name')
param keyVaultName string

@description('Application Insights connection string')
param applicationInsightsConnectionString string

@description('Cosmos DB endpoint')
param cosmosEndpoint string

@description('Service Bus namespace (e.g., myservicebus.servicebus.windows.net)')
param serviceBusNamespace string

// Reference existing App Service
resource appService 'Microsoft.Web/sites@2023-12-01' existing = {
  name: appServiceName
}

// Reference existing Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// App Service Configuration
resource appServiceConfig 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: appService
  name: 'appsettings'
  properties: {
    // Node.js Configuration
    WEBSITE_NODE_DEFAULT_VERSION: '~18'
    NODE_ENV: 'production'
    WEBSITE_RUN_FROM_PACKAGE: '1'
    SCM_DO_BUILD_DURING_DEPLOYMENT: 'true'
    
    // Application Configuration
    PORT: '8080'
    API_VERSION: '1.0.0'
    
    // Azure Resource Configuration (Using Managed Identity - No Keys!)
    AZURE_COSMOS_ENDPOINT: cosmosEndpoint
    COSMOS_ENDPOINT: cosmosEndpoint
    AZURE_SERVICE_BUS_NAMESPACE: serviceBusNamespace
    STORAGE_CONNECTION_STRING: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=storage-connection-string)'
    
    // Secrets from Key Vault
    JWT_SECRET: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=jwt-secret)'
    
    // External API Keys
    GOOGLE_MAPS_API_KEY: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=google-maps-api-key)'
    AZURE_OPENAI_API_KEY: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=azure-openai-api-key)'
    AZURE_OPENAI_ENDPOINT: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=azure-openai-endpoint)'
    
    // Application Insights
    APPLICATIONINSIGHTS_CONNECTION_STRING: applicationInsightsConnectionString
    APPINSIGHTS_INSTRUMENTATION_KEY: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=appinsights-instrumentation-key)'
    
    // Feature Flags
    ENABLE_DYNAMIC_CODE_EXECUTION: 'true'
    ENABLE_PROPERTY_INTELLIGENCE: 'true'
    ENABLE_EVENT_DRIVEN_ARCHITECTURE: 'true'
    ENABLE_QC_WORKFLOWS: 'true'
    
    // Security Settings
    CORS_ALLOWED_ORIGINS: '*'
    ENABLE_HELMET: 'true'
    ENABLE_RATE_LIMITING: 'true'
    
    // Performance Settings
    MAX_REQUEST_SIZE: '10mb'
    COMPRESSION_ENABLED: 'true'
    CACHE_TTL: '300'
    
    // Logging Configuration
    LOG_LEVEL: 'info'
    ENABLE_REQUEST_LOGGING: 'true'
    ENABLE_ERROR_TRACKING: 'true'
    
    // Database Configuration
    COSMOS_DATABASE_NAME: 'appraisal-management'
    COSMOS_CONTAINER_ORDERS: 'orders'
    COSMOS_CONTAINER_PROPERTIES: 'properties'
    COSMOS_CONTAINER_VENDORS: 'vendors'
    COSMOS_CONTAINER_USERS: 'users'
    COSMOS_CONTAINER_EVENTS: 'events'
    
    // Service Bus Configuration
    SERVICEBUS_QUEUE_ORDER_EVENTS: 'order-events'
    SERVICEBUS_QUEUE_PROPERTY_INTELLIGENCE: 'property-intelligence'
    SERVICEBUS_QUEUE_VENDOR_ASSIGNMENT: 'vendor-assignment'
    SERVICEBUS_QUEUE_NOTIFICATIONS: 'notifications'
    SERVICEBUS_TOPIC_QC_EVENTS: 'qc-events'
    SERVICEBUS_TOPIC_AUDIT_EVENTS: 'audit-events'
    
    // Storage Configuration
    STORAGE_CONTAINER_DOCUMENTS: 'appraisal-documents'
    STORAGE_CONTAINER_IMAGES: 'property-images'
    STORAGE_CONTAINER_CREDENTIALS: 'vendor-credentials'
    STORAGE_CONTAINER_TEMPLATES: 'templates'
    STORAGE_CONTAINER_ARCHIVE: 'archive'
    
    // Azure Service Configuration
    AZURE_REGION: resourceGroup().location
    AZURE_RESOURCE_GROUP: resourceGroup().name
    AZURE_SUBSCRIPTION_ID: subscription().subscriptionId
    AZURE_TENANT_ID: tenant().tenantId
  }
}

// App Service Logs Configuration
resource appServiceLogsConfig 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: appService
  name: 'logs'
  properties: {
    applicationLogs: {
      fileSystem: {
        level: 'Information'
      }
    }
    httpLogs: {
      fileSystem: {
        retentionInMb: 100
        retentionInDays: 7
        enabled: true
      }
    }
    failedRequestsTracing: {
      enabled: true
    }
    detailedErrorMessages: {
      enabled: true
    }
  }
}

// Outputs
output appServiceFqdn string = appService.properties.defaultHostName
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output configurationStatus string = 'configured'
