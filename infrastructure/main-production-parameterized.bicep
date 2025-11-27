// Appraisal Management Platform - Fully Parameterized Infrastructure Template
// Zero hardcoded values - everything configurable via parameters

targetScope = 'subscription'

// === CORE DEPLOYMENT PARAMETERS ===
@description('The primary Azure region for resource deployment')
param location string

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Application name for resource naming')
param appName string

@description('Organization or project identifier (optional)')
param organizationPrefix string = ''

// === NAMING AND TAGGING ===
@description('Resource group naming pattern - supports {appName}, {environment}, {location} tokens')
param resourceGroupNamingPattern string = 'rg-{appName}-{environment}-{location}'

@description('Resource naming pattern - supports {appName}, {environment} tokens')
param resourceNamingPattern string = '{appName}-{environment}'

@description('Custom resource group name override (optional)')
param customResourceGroupName string = ''

@description('Tags to apply to all resources')
param tags object

@description('Azure API version for resource groups')
param resourceGroupApiVersion string = '2023-07-01'

// === APP SERVICE PARAMETERS ===
@description('App Service Plan SKU configuration by environment')
param appServicePlanSkus object = {
  dev: {
    name: 'B1'
    capacity: 1
  }
  staging: {
    name: 'S2'
    capacity: 1
  }
  prod: {
    name: 'P2v3'
    capacity: 2
  }
}

@description('Node.js version for App Service')
param nodeVersion string = '18-lts'

@description('Enable auto-scaling for production')
param enableAutoScaling bool = true

@description('Auto-scaling configuration')
param autoScalingConfig object = {
  minCapacity: 2
  maxCapacity: 10
  defaultCapacity: 2
  scaleOutThreshold: 75
  scaleInThreshold: 25
  scaleOutCooldown: 'PT5M'
  scaleInCooldown: 'PT10M'
}

// === COSMOS DB PARAMETERS ===
@description('Cosmos DB database name')
param cosmosDatabaseName string = 'appraisal-management'

@description('Cosmos DB configuration by environment')
param cosmosDbConfigs object = {
  dev: {
    tier: 'serverless'
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    defaultConsistencyLevel: 'Session'
    backupStorageRedundancy: 'Local'
  }
  staging: {
    tier: 'provisioned'
    throughput: 400
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    defaultConsistencyLevel: 'Session'
    backupStorageRedundancy: 'Local'
  }
  prod: {
    tier: 'provisioned'
    throughput: 1000
    enableAutomaticFailover: true
    enableMultipleWriteLocations: false
    defaultConsistencyLevel: 'Session'
    backupStorageRedundancy: 'Geo'
  }
}

@description('Secondary region for multi-region Cosmos DB deployment')
param cosmosSecondaryRegion string = 'westus2'

@description('Cosmos DB containers configuration')
param cosmosContainers array = [
  {
    name: 'orders'
    partitionKeyPath: '/clientId'
    uniqueKeyPaths: ['/orderId']
    defaultTtl: -1
  }
  {
    name: 'properties' 
    partitionKeyPath: '/address/zipCode'
    uniqueKeyPaths: []
    defaultTtl: -1
    spatialIndexes: [
      {
        path: '/location/*'
        types: ['Point', 'Polygon']
      }
    ]
  }
  {
    name: 'vendors'
    partitionKeyPath: '/businessInfo/primaryServiceArea'
    uniqueKeyPaths: []
    defaultTtl: -1
  }
  {
    name: 'users'
    partitionKeyPath: '/organizationId'
    uniqueKeyPaths: ['/email']
    defaultTtl: -1
    excludedPaths: ['/password/?', '/refreshTokens/*']
  }
  {
    name: 'events'
    partitionKeyPath: '/aggregateId'
    uniqueKeyPaths: []
    defaultTtl: 2592000 // 30 days for dev, overridden in module
  }
]

@description('Backup configuration')
param backupConfig object = {
  intervalInMinutes: 240
  retentionIntervalInHours: 8
}

// === KEY VAULT PARAMETERS ===
@description('Key Vault SKU')
param keyVaultSku string = 'standard'

@description('Key Vault retention settings by environment')
param keyVaultRetention object = {
  dev: {
    softDeleteRetention: 7
    diagnosticRetention: 30
  }
  staging: {
    softDeleteRetention: 30
    diagnosticRetention: 90
  }
  prod: {
    softDeleteRetention: 90
    diagnosticRetention: 365
  }
}

@description('Enable Key Vault purge protection for production')
param enablePurgeProtection bool = true

// === SERVICE BUS PARAMETERS ===
@description('Service Bus SKU by environment')
param serviceBusSkus object = {
  dev: 'Basic'
  staging: 'Standard'
  prod: 'Premium'
}

@description('Service Bus queues and topics configuration')
param serviceBusConfig object = {
  queues: [
    'order-processing'
    'property-analysis'
    'vendor-notifications'
  ]
  topics: [
    'appraisal-events'
    'system-notifications'
  ]
}

// === STORAGE PARAMETERS ===
@description('Storage account SKU by environment')
param storageSkus object = {
  dev: 'Standard_LRS'
  staging: 'Standard_GRS'
  prod: 'Standard_RAGRS'
}

@description('Storage containers configuration')
param storageContainers array = [
  'documents'
  'images'
  'reports'
  'backups'
]

// === MONITORING PARAMETERS ===
@description('Log Analytics workspace retention by environment')
param logRetentionDays object = {
  dev: 30
  staging: 90
  prod: 365
}

@description('Application Insights daily data cap in GB')
param appInsightsDataCap object = {
  dev: 1
  staging: 5
  prod: 10
}

// === COMPUTED VARIABLES ===
var resourceGroupName = empty(customResourceGroupName) 
  ? replace(replace(replace(resourceGroupNamingPattern, '{appName}', appName), '{environment}', environment), '{location}', location)
  : customResourceGroupName

var namingPrefix = empty(organizationPrefix) 
  ? replace(replace(resourceNamingPattern, '{appName}', appName), '{environment}', environment)
  : '${organizationPrefix}-${replace(replace(resourceNamingPattern, '{appName}', appName), '{environment}', environment)}'

var currentCosmosConfig = cosmosDbConfigs[environment]
var currentAppServicePlan = appServicePlanSkus[environment] 
var currentKeyVaultRetention = keyVaultRetention[environment]

// === RESOURCE GROUP ===
resource resourceGroup 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// === APP SERVICE DEPLOYMENT ===
module appService 'modules/app-service.bicep' = {
  name: 'app-service-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    appServicePlanSku: currentAppServicePlan
    nodeVersion: nodeVersion
    enableAutoScaling: enableAutoScaling && environment == 'prod'
    autoScalingConfig: autoScalingConfig
  }
}

// === COSMOS DB DEPLOYMENT ===
module cosmosDb 'modules/cosmos-db.bicep' = {
  name: 'cosmos-db-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    databaseName: cosmosDatabaseName
    cosmosConfig: currentCosmosConfig
    secondaryRegion: cosmosSecondaryRegion
    containers: cosmosContainers
    backupConfig: backupConfig
  }
}

// === SERVICE BUS DEPLOYMENT ===
module serviceBus 'modules/service-bus.bicep' = {
  name: 'service-bus-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    serviceBusSku: serviceBusSkus[environment]
    serviceBusConfig: serviceBusConfig
  }
}

// === KEY VAULT DEPLOYMENT ===
module keyVault 'modules/key-vault.bicep' = {
  name: 'key-vault-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    keyVaultSku: keyVaultSku
    appServicePrincipalId: appService.outputs.appServiceManagedIdentityId
    retentionSettings: currentKeyVaultRetention
    enablePurgeProtection: enablePurgeProtection && environment == 'prod'
  }
}

// === MONITORING DEPLOYMENT ===
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    logRetentionDays: logRetentionDays[environment]
    appInsightsDataCap: appInsightsDataCap[environment]
  }
}

// === STORAGE DEPLOYMENT ===
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    storageSku: storageSkus[environment]
    containers: storageContainers
  }
}

// === KEY VAULT SECRETS ===
module keyVaultSecrets 'modules/key-vault-secrets.bicep' = {
  name: 'key-vault-secrets-deployment'
  scope: resourceGroup
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    cosmosAccountName: cosmosDb.outputs.accountName
    serviceBusNamespaceName: serviceBus.outputs.namespaceName
    storageAccountName: storage.outputs.storageAccountName
    applicationInsightsKey: monitoring.outputs.instrumentationKey
  }
}

// === APP SERVICE CONFIGURATION ===
module appServiceConfiguration 'modules/app-service-config.bicep' = {
  name: 'app-service-config-deployment'
  scope: resourceGroup
  params: {
    appServiceName: appService.outputs.appServiceName
    keyVaultName: keyVault.outputs.keyVaultName
    applicationInsightsConnectionString: monitoring.outputs.connectionString
    cosmosDatabaseName: cosmosDatabaseName
    environment: environment
  }
  dependsOn: [
    keyVaultSecrets
  ]
}

// === OUTPUTS ===
output deploymentSummary object = {
  resourceGroup: resourceGroup.name
  location: location
  environment: environment
  appServiceUrl: appService.outputs.appServiceUrl
  cosmosEndpoint: cosmosDb.outputs.endpoint
  keyVaultUri: keyVault.outputs.keyVaultUri
  monitoringWorkspace: monitoring.outputs.logAnalyticsWorkspaceName
  serviceBusNamespace: serviceBus.outputs.namespaceName
  storageAccount: storage.outputs.storageAccountName
}

output resourceGroupName string = resourceGroup.name
output appServiceName string = appService.outputs.appServiceName
output appServiceUrl string = appService.outputs.appServiceUrl
output keyVaultName string = keyVault.outputs.keyVaultName
output cosmosAccountName string = cosmosDb.outputs.accountName
output applicationInsightsName string = monitoring.outputs.applicationInsightsName
