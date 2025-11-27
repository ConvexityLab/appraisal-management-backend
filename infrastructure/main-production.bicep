// Appraisal Management Platform - Main Infrastructure Template
// Fully parameterized deployment for production-ready API server

targetScope = 'subscription'

@description('The primary Azure region for resource deployment')
param location string

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Application name for resource naming')
param appName string

@description('Organization or project identifier')
param organizationPrefix string = ''

@description('Resource group naming pattern')
param resourceGroupNamingPattern string = 'rg-{appName}-{environment}-{location}'

@description('Resource naming pattern')
param resourceNamingPattern string = '{appName}-{environment}'

@description('Tags to apply to all resources')
param tags object

@description('Azure API version for resource groups')
param resourceGroupApiVersion string = '2023-07-01'

@description('Custom resource group name override (optional)')
param customResourceGroupName string = ''

// Variables - all derived from parameters, no hardcoded values
var resourceGroupName = empty(customResourceGroupName) 
  ? replace(replace(replace(resourceGroupNamingPattern, '{appName}', appName), '{environment}', environment), '{location}', location)
  : customResourceGroupName

var namingPrefix = empty(organizationPrefix) 
  ? replace(replace(resourceNamingPattern, '{appName}', appName), '{environment}', environment)
  : '${organizationPrefix}-${replace(replace(resourceNamingPattern, '{appName}', appName), '{environment}', environment)}'

// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

@description('App Service Plan configuration')
param appServicePlan object = {}

@description('App Service configuration')  
param appServiceConfig object = {}

@description('Node.js version for App Service')
param nodeVersion string = '18-lts'

// App Service Plan and Web App
module appService 'modules/app-service.bicep' = {
  name: 'app-service-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    appServicePlanConfig: appServicePlan
    appServiceConfig: appServiceConfig
    nodeVersion: nodeVersion
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
