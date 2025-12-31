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

@description('Custom resource group name override (optional)')
param customResourceGroupName string = ''

@description('BatchData API endpoint for Azure Functions workloads')
param batchDataEndpoint string = ''

@description('BatchData API key used by Azure Functions workloads')
param batchDataApiKey string = ''

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

// Application Insights and Log Analytics (deployed first - required by other modules)
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

// Cosmos DB (deployed early for local testing - doesn't depend on Container Apps)
module cosmosDb 'modules/cosmos-production.bicep' = {
  name: 'cosmos-db-deployment'
  scope: resourceGroup
  params: {
    location: location
    environment: environment
    cosmosAccountName: '${namingPrefix}-cosmos'
    databaseName: 'appraisal-management'
    containerAppPrincipalIds: [] // Will grant access later via separate role assignments
  }
}

// Service Bus (deployed early for local testing)
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

// Storage Account (deployed early for local testing)
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  scope: resourceGroup
  params: {
    location: location
    environment: environment
    tags: tags
  }
}

// Container Apps and Container Registry (deployed after data services)
module appServices 'modules/app-services.bicep' = {
  name: 'app-services-deployment'
  scope: resourceGroup
  params: {
    location: location
    environment: environment
    suffix: substring(uniqueString(resourceGroup.id), 0, 6)
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    useBootstrapImage: false
    storageAccountName: storage.outputs.storageAccountName
    applicationInsightsInstrumentationKey: monitoring.outputs.instrumentationKey
    applicationInsightsConnectionString: monitoring.outputs.connectionString
    cosmosEndpoint: cosmosDb.outputs.cosmosEndpoint
    cosmosDatabaseName: cosmosDb.outputs.databaseName
    batchDataEndpoint: batchDataEndpoint
    batchDataApiKey: batchDataApiKey
  }
}

// Cosmos DB role assignments for Container Apps (after apps exist)
module cosmosRoleAssignments 'modules/cosmos-role-assignments.bicep' = {
  name: 'cosmos-role-assignments-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
  }
}

// Key Vault (after Container Apps for principal IDs)
module keyVault 'modules/key-vault.bicep' = {
  name: 'key-vault-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    appServicePrincipalId: appServices.outputs.containerAppPrincipalIds[0]
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// Key Vault Secrets
module keyVaultSecrets 'modules/key-vault-secrets.bicep' = {
  name: 'key-vault-secrets-deployment'
  scope: resourceGroup
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    storageAccountName: storage.outputs.storageAccountName
    applicationInsightsKey: monitoring.outputs.instrumentationKey
  }
}

// Key Vault Role Assignments for Container Apps
module keyVaultRoleAssignments 'modules/keyvault-role-assignments.bicep' = {
  name: 'keyvault-role-assignments-deployment'
  scope: resourceGroup
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
  }
}

// Outputs
output resourceGroupName string = resourceGroup.name
output containerAppEnvironmentName string = appServices.outputs.containerAppEnvironmentName
output containerAppNames array = appServices.outputs.containerAppNames
output containerAppFqdns array = appServices.outputs.containerAppFqdns
output containerRegistryName string = appServices.outputs.containerRegistryName
output containerRegistryLoginServer string = appServices.outputs.containerRegistryLoginServer
output keyVaultName string = keyVault.outputs.keyVaultName
output cosmosAccountName string = cosmosDb.outputs.cosmosAccountName
output applicationInsightsName string = monitoring.outputs.applicationInsightsName
output appServiceName string = appServices.outputs.containerAppNames[0]
output appServiceUrl string = 'https://${appServices.outputs.containerAppFqdns[0]}'
output deploymentSummary object = {
  resourceGroup: resourceGroup.name
  location: location
  environment: environment
  containerAppEnvironment: appServices.outputs.containerAppEnvironmentName
  containerRegistry: appServices.outputs.containerRegistryName
  containerApps: appServices.outputs.containerAppNames
  containerAppFqdns: appServices.outputs.containerAppFqdns
  cosmosEndpoint: cosmosDb.outputs.cosmosEndpoint
  keyVaultUri: keyVault.outputs.keyVaultUri
  monitoringWorkspace: monitoring.outputs.logAnalyticsWorkspaceName
}
