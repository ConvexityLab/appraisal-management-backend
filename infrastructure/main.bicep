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

@description('Email domain for Azure Communication Services')
param emailDomain string = ''

@description('Automatically configure DNS records for email domain (requires Azure DNS zone)')
param autoConfigureDns bool = false

@description('DNS zone resource group (if different from deployment resource group)')
param dnsZoneResourceGroup string = ''

// External API Keys (secure parameters from GitHub Secrets)
@secure()
@description('Google Maps API key')
param googleMapsApiKey string = ''

@secure()
@description('Azure OpenAI API key')
param azureOpenAiApiKey string = ''

@secure()
@description('Azure OpenAI endpoint')
param azureOpenAiEndpoint string = ''

@secure()
@description('Google Gemini API key')
param googleGeminiApiKey string = ''

@secure()
@description('Census Bureau API key')
param censusApiKey string = ''

@secure()
@description('Bridge Interactive MLS token')
param bridgeServerToken string = ''

@secure()
@description('National Park Service API key')
param npsApiKey string = ''

@secure()
@description('SambaNova API key')
param sambanovaApiKey string = ''

@secure()
@description('Azure Communication Services API key for local dev')
param azureCommunicationApiKey string = ''

// Azure Entra (Azure AD) Configuration
@description('Azure Tenant ID for Entra authentication - defaults to current subscription tenant')
param azureTenantId string = tenant().tenantId

// Azure Entra (Azure AD) Configuration
@description('Azure Client ID (Application ID) for JWT authentication - backend app registration')
param azureClientId string = 'dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a'

@secure()
@description('Azure Client Secret for service authentication')
param azureClientSecret string = ''

@description('Optional: Array of developer user principal IDs for local testing (get via: az ad signed-in-user show --query id -o tsv)')
param developerPrincipalIds array = []

// Variables - all derived from parameters, no hardcoded values
var resourceGroupName = empty(customResourceGroupName) 
  ? replace(replace(replace(resourceGroupNamingPattern, '{appName}', appName), '{environment}', environment), '{location}', location)
  : customResourceGroupName

var namingPrefix = empty(organizationPrefix) 
  ? replace(replace(resourceNamingPattern, '{appName}', appName), '{environment}', environment)
  : '${organizationPrefix}-${replace(replace(resourceNamingPattern, '{appName}', appName), '{environment}', environment)}'

// Key Vault URL (construct predictably to avoid circular dependency)
// Must match the naming pattern in modules/key-vault.bicep
var cleanPrefix = replace(replace(replace(namingPrefix, '-', ''), 'appraisal', 'appr'), 'mgmt', 'm')
var uniqueSuffix = uniqueString(namingPrefix, environment, location)
var keyVaultName = 'kv${take(cleanPrefix, 8)}${take(environment, 3)}${take(uniqueSuffix, 6)}'
var keyVaultUrl = 'https://${keyVaultName}.vault.azure.net/'

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
    azureCommunicationEndpoint: 'https://${communicationServices.outputs.communicationServicesEndpoint}'
    azureCommunicationEmailDomain: communicationServices.outputs.emailDomain
    keyVaultUrl: keyVaultUrl
    azureTenantId: azureTenantId
    azureClientId: azureClientId
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

// ACS role assignments for Container Apps (after apps exist)
module acsRoleAssignments 'modules/acs-role-assignments.bicep' = {
  name: 'acs-role-assignments-deployment'
  scope: resourceGroup
  params: {
    communicationServicesName: communicationServices.outputs.communicationServicesName
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
    developerPrincipalIds: developerPrincipalIds
    tags: tags
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
    googleMapsApiKey: googleMapsApiKey
    azureOpenAiApiKey: azureOpenAiApiKey
    azureOpenAiEndpoint: azureOpenAiEndpoint
    googleGeminiApiKey: googleGeminiApiKey
    censusApiKey: censusApiKey
    bridgeServerToken: bridgeServerToken
    npsApiKey: npsApiKey
    sambanovaApiKey: sambanovaApiKey
    azureCommunicationApiKey: azureCommunicationApiKey
    azureCommunicationEndpoint: 'https://${communicationServices.outputs.communicationServicesEndpoint}'
    azureTenantId: azureTenantId
    azureClientId: azureClientId
    azureClientSecret: azureClientSecret
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

// Static Web App for Frontend (deployed from separate repository)
module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'static-web-app-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    location: 'eastus2' // Static Web Apps have limited region availability
    staticWebAppName: '${namingPrefix}-swa'
    backendApiUrl: 'https://${appServices.outputs.containerAppFqdns[0]}'
    sku: environment == 'prod' ? 'Standard' : 'Free'
    tags: tags
  }
}

// Azure Communication Services (ACS, Teams Interop, Notifications)
module communicationServices 'modules/communication-services-deployment.bicep' = {
  name: 'communication-services-deployment'
  scope: resourceGroup
  params: {
    environmentName: environment
    location: location
    cosmosDbAccountName: cosmosDb.outputs.cosmosAccountName
    emailDomain: emailDomain
    autoConfigureDns: autoConfigureDns
    dnsZoneResourceGroup: dnsZoneResourceGroup
    tags: tags
  }
}

// Azure API Management (APIM) - Gateway for Container Apps
module apim 'modules/apim.bicep' = {
  name: 'apim-deployment'
  scope: resourceGroup
  params: {
    environment: environment
    location: location
    suffix: uniqueString(namingPrefix, environment, location)
    tags: tags
    apiContainerAppFqdn: appServices.outputs.containerAppFqdns[0]
    functionContainerAppFqdn: appServices.outputs.containerAppFqdns[1]
    publisherEmail: 'admin@appraisal.platform'
    publisherName: 'Appraisal Management Platform'
    skuName: environment == 'prod' ? 'Standard' : 'Consumption'
    skuCapacity: environment == 'prod' ? 1 : 0
    allowedOrigins: [
      'http://localhost:3000'
      'http://localhost:4200'
      'http://localhost:5173'
      'https://${staticWebApp.outputs.staticWebAppHostname}'
    ]
  }
  dependsOn: [
    appServices
    staticWebApp
  ]
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
output apimGatewayUrl string = apim.outputs.apimGatewayUrl
output apimApiUrl string = apim.outputs.apiUrl
output apimFunctionUrl string = apim.outputs.functionUrl
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
  apim: {
    name: apim.outputs.apimName
    gatewayUrl: apim.outputs.apimGatewayUrl
    apiUrl: apim.outputs.apiUrl
    functionUrl: apim.outputs.functionUrl
  }
  staticWebApp: {
    name: staticWebApp.outputs.staticWebAppName
    url: staticWebApp.outputs.staticWebAppUrl
    hostname: staticWebApp.outputs.staticWebAppHostname
  }
  communicationServices: {
    endpoint: 'https://${communicationServices.outputs.communicationServicesEndpoint}'
    emailDomain: communicationServices.outputs.emailDomain
    managedIdentityAccess: 'Granted to all Container Apps'
  }
  rbacAssignments: {
    cosmosDb: 'Granted to all Container Apps'
    acs: 'Contributor role granted to all Container Apps'
    keyVault: 'Secrets access granted to all Container Apps'
  }
}

// Critical outputs for frontend repository configuration
output frontendDeploymentToken string = staticWebApp.outputs.staticWebAppDeploymentToken
output frontendRepoSecrets object = staticWebApp.outputs.frontendRepoSecrets
output staticWebAppUrl string = staticWebApp.outputs.staticWebAppUrl

// Communication services outputs
output communicationServicesEndpoint string = communicationServices.outputs.communicationServicesEndpoint
output emailDomainVerificationRecords object = communicationServices.outputs.emailVerificationRecords
