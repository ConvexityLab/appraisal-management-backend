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

// Cosmos DB with Container App role assignments
module cosmosDb 'modules/cosmos-production.bicep' = {
  name: 'cosmos-db-deployment'
  scope: resourceGroup
  params: {
    location: location
    environment: environment
    cosmosAccountName: '${namingPrefix}-cosmos'
    databaseName: 'appraisal-management'
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
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

// Key Vault (no principal IDs initially)
module keyVault 'modules/key-vault.bicep' = {
  name: 'key-vault-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
    appServicePrincipalId: '00000000-0000-0000-0000-000000000000' // Temporary placeholder
  }
}

// Container Apps and Container Registry (deployed first to get principal IDs)
module appServices 'modules/app-services.bicep' = {
  name: 'app-services-deployment'
  scope: resourceGroup
  params: {
    location: location
    environment: environment
    suffix: substring(uniqueString(resourceGroup.id), 0, 6)
    tags: tags
    keyVaultName: '${namingPrefix}-kv-${substring(uniqueString(resourceGroup.id), 0, 6)}'
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
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
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    serviceBusNamespaceName: serviceBus.outputs.namespaceName
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
output containerRegistryName string = appServices.outputs.containerRegistryName
output containerRegistryLoginServer string = appServices.outputs.containerRegistryLoginServer
output keyVaultName string = keyVault.outputs.keyVaultName
output cosmosAccountName string = cosmosDb.outputs.cosmosAccountName
output applicationInsightsName string = monitoring.outputs.applicationInsightsName
output deploymentSummary object = {
  resourceGroup: resourceGroup.name
  location: location
  environment: environment
  containerAppEnvironment: appServices.outputs.containerAppEnvironmentName
  containerRegistry: appServices.outputs.containerRegistryName
  containerApps: appServices.outputs.containerAppNames
  cosmosEndpoint: cosmosDb.outputs.cosmosEndpoint
  keyVaultUri: keyVault.outputs.keyVaultUri
  monitoringWorkspace: monitoring.outputs.logAnalyticsWorkspaceName
}
