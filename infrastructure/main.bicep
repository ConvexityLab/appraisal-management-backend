// Main Bicep template for Enterprise Appraisal Management System
// This template orchestrates all Azure resources needed for the platform

targetScope = 'subscription'

@description('The primary Azure region for resource deployment')
param location string = 'East US'

@description('The secondary Azure region for disaster recovery')
param drLocation string = 'West US 2'

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Unique suffix for resource naming')
param suffix string = uniqueString(subscription().subscriptionId, location)

// Note: SQL Server parameters removed - using Cosmos DB only

@description('Tags to apply to all resources')
param tags object = {
  Environment: environment
  Project: 'Enterprise-Appraisal-Management'
  Owner: 'Platform-Team'
}

// Variables
var resourceGroupName = 'rg-appraisal-mgmt-${environment}-${suffix}'
var drResourceGroupName = 'rg-appraisal-mgmt-dr-${environment}-${suffix}'

// Resource Groups
resource primaryResourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

resource drResourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: drResourceGroupName
  location: drLocation
  tags: union(tags, { Purpose: 'Disaster-Recovery' })
}

// Core Infrastructure Module
module coreInfrastructure 'modules/core-infrastructure.bicep' = {
  name: 'core-infrastructure-deployment'
  scope: primaryResourceGroup
  params: {
    location: location
    environment: environment
    suffix: suffix
    tags: tags
  }
}

// Data Services Module (Storage and Cache only)
module dataServices 'modules/data-services.bicep' = {
  name: 'data-services-deployment'
  scope: primaryResourceGroup
  params: {
    location: location
    environment: environment
    suffix: suffix
    tags: tags
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
  }
}

// Cosmos DB Module (Single consolidated database)
module cosmosDb 'modules/cosmos-production.bicep' = {
  name: 'cosmosdb-deployment'
  scope: primaryResourceGroup
  params: {
    location: location
    environment: environment
    cosmosAccountName: 'appraisal-cosmos-${environment}-${suffix}'
    databaseName: 'appraisal-management'
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
  }
}

// AI/ML Services Module
module aimlServices 'modules/aiml-services.bicep' = {
  name: 'aiml-services-deployment'
  scope: primaryResourceGroup
  params: {
    location: location
    environment: environment
    suffix: suffix
    tags: tags
  }
}

// Application Services Module
module appServices 'modules/app-services.bicep' = {
  name: 'app-services-deployment'
  scope: primaryResourceGroup
  params: {
    location: location
    environment: environment
    suffix: suffix
    tags: tags
    keyVaultName: coreInfrastructure.outputs.keyVaultName
    logAnalyticsWorkspaceId: coreInfrastructure.outputs.logAnalyticsWorkspaceId
  }

}

// Security Services Module
module securityServices 'modules/security-services.bicep' = {
  name: 'security-services-deployment'
  scope: primaryResourceGroup
  params: {
    location: location
    environment: environment
    suffix: suffix
    tags: tags
    logAnalyticsWorkspaceId: coreInfrastructure.outputs.logAnalyticsWorkspaceId
  }
}

// Disaster Recovery Module - Disabled (Cosmos DB has built-in geo-replication)
// module disasterRecovery 'modules/disaster-recovery.bicep' = {
//   name: 'disaster-recovery-deployment'
//   scope: drResourceGroup
//   params: {
//     location: drLocation
//     primaryLocation: location
//     environment: environment
//     suffix: suffix
//     tags: union(tags, { Purpose: 'Disaster-Recovery' })
//     primaryStorageAccountName: dataServices.outputs.primaryStorageAccountName
//   }
// }

// Integration Services Module
module integrationServices 'modules/integration-services.bicep' = {
  name: 'integration-services-deployment'
  scope: primaryResourceGroup
  params: {
    location: location
    environment: environment
    suffix: suffix
    tags: tags
    keyVaultName: coreInfrastructure.outputs.keyVaultName
  }
}

// Key Vault Role Assignments (after container apps are deployed)
module keyVaultRoleAssignments 'modules/keyvault-role-assignments.bicep' = {
  name: 'keyvault-role-assignments-deployment'
  scope: primaryResourceGroup
  params: {
    keyVaultName: coreInfrastructure.outputs.keyVaultName
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
  }
}

// Outputs
output resourceGroupName string = primaryResourceGroup.name
output drResourceGroupName string = drResourceGroup.name
output keyVaultName string = coreInfrastructure.outputs.keyVaultName
output containerAppEnvironmentName string = appServices.outputs.containerAppEnvironmentName
output containerAppNames array = appServices.outputs.containerAppNames
output containerAppPrincipalIds array = appServices.outputs.containerAppPrincipalIds
output applicationInsightsName string = coreInfrastructure.outputs.applicationInsightsName
output storageAccountName string = dataServices.outputs.primaryStorageAccountName
output redisCacheName string = dataServices.outputs.redisCacheName
output apiManagementName string = integrationServices.outputs.apiManagementName

// Cosmos DB Outputs
output cosmosAccountName string = cosmosDb.outputs.cosmosAccountName
output cosmosEndpoint string = cosmosDb.outputs.cosmosEndpoint
output cosmosDatabaseName string = cosmosDb.outputs.databaseName
output cosmosContainerNames array = cosmosDb.outputs.containerNames


