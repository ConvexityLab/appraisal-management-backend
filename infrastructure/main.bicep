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

@description('Administrator username for SQL databases')
param sqlAdminUsername string

@secure()
@description('Administrator password for SQL databases')
param sqlAdminPassword string

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

// Data Services Module
module dataServices 'modules/data-services.bicep' = {
  name: 'data-services-deployment'
  scope: primaryResourceGroup
  params: {
    location: location
    environment: environment
    suffix: suffix
    sqlAdminUsername: sqlAdminUsername
    sqlAdminPassword: sqlAdminPassword
    tags: tags
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

// Disaster Recovery Module
module disasterRecovery 'modules/disaster-recovery.bicep' = {
  name: 'disaster-recovery-deployment'
  scope: drResourceGroup
  params: {
    location: drLocation
    primaryLocation: location
    environment: environment
    suffix: suffix
    tags: union(tags, { Purpose: 'Disaster-Recovery' })
    primarySqlServerName: dataServices.outputs.sqlServerName
    primaryStorageAccountName: dataServices.outputs.primaryStorageAccountName
    drSqlAdminPassword: sqlAdminPassword
  }
}

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

// Outputs
output resourceGroupName string = primaryResourceGroup.name
output drResourceGroupName string = drResourceGroup.name
output keyVaultName string = coreInfrastructure.outputs.keyVaultName
output containerAppEnvironmentName string = appServices.outputs.containerAppEnvironmentName
output containerAppNames array = appServices.outputs.containerAppNames
output sqlServerName string = dataServices.outputs.sqlServerName
output applicationInsightsName string = coreInfrastructure.outputs.applicationInsightsName
output storageAccountName string = dataServices.outputs.primaryStorageAccountName
output apiManagementName string = integrationServices.outputs.apiManagementName
