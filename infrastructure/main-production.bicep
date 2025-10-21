// Appraisal Management Platform - Main Infrastructure Template
// Streamlined deployment for production-ready API server

targetScope = 'subscription'

@description('The primary Azure region for resource deployment')
param location string = 'eastus2'

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Application name for resource naming')
param appName string = 'appraisal-mgmt'

@description('Tags to apply to all resources')
param tags object = {
  Environment: environment
  Application: appName
  ManagedBy: 'Bicep'
  DeployedBy: 'GitHub-Actions'
}

// Variables
var resourceGroupName = 'rg-${appName}-${environment}-${location}'
var namingPrefix = '${appName}-${environment}'

// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// App Service Plan and Web App
module appService 'modules/app-service.bicep' = {
  name: 'app-service-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
  }
}

// Cosmos DB
module cosmosDb 'modules/cosmos-db.bicep' = {
  name: 'cosmos-db-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
  }
}

// Service Bus
module serviceBus 'modules/service-bus.bicep' = {
  name: 'service-bus-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
  }
}

// Key Vault
module keyVault 'modules/key-vault.bicep' = {
  name: 'key-vault-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    appServicePrincipalId: appService.outputs.appServiceManagedIdentityId
  }
}

// Application Insights and Log Analytics
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
  }
}

// Storage Account
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
  }
}

// Key Vault Secrets
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

// App Service Configuration
module appServiceConfig 'modules/app-service-config.bicep' = {
  name: 'app-service-config-deployment'
  scope: resourceGroup
  params: {
    appServiceName: appService.outputs.appServiceName
    keyVaultName: keyVault.outputs.keyVaultName
    applicationInsightsConnectionString: monitoring.outputs.connectionString
  }
  dependsOn: [
    keyVaultSecrets
  ]
}

// Outputs
output resourceGroupName string = resourceGroup.name
output appServiceName string = appService.outputs.appServiceName
output appServiceUrl string = appService.outputs.appServiceUrl
output keyVaultName string = keyVault.outputs.keyVaultName
output cosmosAccountName string = cosmosDb.outputs.accountName
output applicationInsightsName string = monitoring.outputs.applicationInsightsName
output deploymentSummary object = {
  resourceGroup: resourceGroup.name
  location: location
  environment: environment
  appServiceUrl: appService.outputs.appServiceUrl
  cosmosEndpoint: cosmosDb.outputs.endpoint
  keyVaultUri: keyVault.outputs.keyVaultUri
  monitoringWorkspace: monitoring.outputs.logAnalyticsWorkspaceName
}
