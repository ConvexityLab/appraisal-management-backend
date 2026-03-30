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

@description('Statebridge client identifier — used as clientId on all Cosmos orders created via SFTP')
param statebridgeClientId string = 'statebridge'

@description('Statebridge display name — used in the EngagementClient.clientName field')
param statebridgeClientName string = 'Statebridge'

@description('Tenant ID for all Statebridge Cosmos documents (partition key). Set to your Statebridge tenant GUID.')
param statebridge_tenantId string

@description('Base URL of the Axiom AI extraction API (e.g. https://axiom.internal.example.com). Used as a fallback — in deployed environments this is resolved from Azure App Configuration.')
param axiomApiBaseUrl string = ''

@description('Registered UUID for the Axiom pdf-schema-extraction pipeline. Leave empty to use the inline two-stage pipeline definition.')
param axiomPipelineIdSchemaExtract string = ''

@secure()
@description('Shared HMAC-SHA256 secret for verifying inbound Axiom webhook signatures. Must match the secret set in the Axiom outbound webhook configuration. Stored in Key Vault as "axiom-webhook-secret".')
param axiomWebhookSecret string = ''

// appConfigEndpoint is no longer an input param — it is computed from our own
// App Configuration store (deployed by the appConfig module below).



@description('Object ID of the CI/CD service principal (GitHub Actions SP). Granted Key Vault Secrets Officer so it can write the SFTP password to Key Vault after provisioning local users.')
param ciServicePrincipalId string = ''

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
var keyVaultUrl = 'https://${keyVaultName}.${az.environment().suffixes.keyvaultDns}/'

// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// (certoGlobalRg removed — we deploy and own our App Configuration store within our own RG)

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

// Cosmos DB Notification Containers (chat, ACS, Teams)
module cosmosNotificationContainers 'modules/cosmos-db-notification-containers.bicep' = {
  name: 'cosmos-notification-containers-deployment'
  scope: resourceGroup
  params: {
    cosmosDbAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
  }
}

// Cosmos DB Documents Container (for document management system)
module cosmosDocumentsContainer 'modules/cosmos-db-documents-container.bicep' = {
  name: 'cosmos-documents-container-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
    location: location
  }
}

// Cosmos DB Communications Container (for unified communication tracking)
module cosmosCommunicationsContainer 'modules/cosmos-db-communications-container.bicep' = {
  name: 'cosmos-communications-container-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
    location: location
  }
}

// Cosmos DB Construction Finance Containers (construction-loans, draws, contractors)
// Required for the CFSI construction finance module.
module cosmosConstructionContainers 'modules/cosmos-construction-containers.bicep' = {
  name: 'cosmos-construction-containers-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
  }
}

// Cosmos DB Review Containers (review-programs, review-results, bulk-portfolio-jobs)
// Required for the Bulk Portfolio tape evaluation workflow (TAPE_EVALUATION mode).
module cosmosReviewContainers 'modules/cosmos-review-containers.bicep' = {
  name: 'cosmos-review-containers-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
  }
}

// Cosmos DB Matching / RFB / ARV Containers (matching-criteria-sets, rfb-requests, arv-analyses)
// Required for the matching engine, request-for-bid, and ARV analysis workflows.
module cosmosMatchingRfbArvContainers 'modules/cosmos-matching-rfb-arv-containers.bicep' = {
  name: 'cosmos-matching-rfb-arv-containers-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
  }
}

// Cosmos DB Engagements Container (LenderEngagement aggregate root domain)
module cosmosEngagementsContainer 'modules/cosmos-engagements-container.bicep' = {
  name: 'cosmos-engagements-container-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
  }
}

// Cosmos DB Appraisal Drafts Container (UAD 3.6 Phase 1 — in-progress appraisals)
module cosmosAppraisalDraftsContainer 'modules/cosmos-appraisal-drafts-container.bicep' = {
  name: 'cosmos-appraisal-drafts-container-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
  }
}

// Cosmos DB Completion Reports Container (URAR 1.3 — one completion report per order)
module cosmosCompletionReportsContainer 'modules/cosmos-completion-reports-container.bicep' = {
  name: 'cosmos-completion-reports-container-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
  }
}

// Cosmos DB Property Records + Comparable Sales Containers (Phase R1)
module cosmosPropertyRecordsContainer 'modules/cosmos-property-records-container.bicep' = {
  name: 'cosmos-property-records-container-deployment'
  scope: resourceGroup
  params: {
    cosmosAccountName: cosmosDb.outputs.cosmosAccountName
    databaseName: 'appraisal-management'
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

// Fluid Relay (real-time collaborative editing — orders, QC, ARV pages)
module fluidRelay 'modules/fluid-relay.bicep' = {
  name: 'fluid-relay-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
  }
}

// Web PubSub (deployed early for local testing)
module webPubSub 'modules/web-pubsub.bicep' = {
  name: 'web-pubsub-deployment'
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

// SFTP Storage Account (Statebridge integration)
// Dedicated HNS/ADLS Gen2 account — HNS cannot be added to the existing account.
// Statebridge uploads daily pipe-delimited BPO order files to uploads/
// and reads pipe-delimited results + PDFs from results/.
module sftpStorage 'modules/storage-sftp.bicep' = {
  name: 'sftp-storage-deployment'
  scope: resourceGroup
  params: {
    location: location
    environment: environment
    tags: tags
  }
}

// Event Grid subscription: SFTP BlobCreated → sftp-order-events queue
// Routes uploads/ blob events to the queue so the functions container app can process them.
module sftpEventGrid 'modules/eventgrid-sftp.bicep' = {
  name: 'sftp-eventgrid-deployment'
  scope: resourceGroup
  params: {
    sftpStorageAccountId: sftpStorage.outputs.sftpStorageAccountId
    sftpStorageAccountName: sftpStorage.outputs.sftpStorageAccountName
    mainStorageAccountId: storage.outputs.storageAccountId
    tags: tags
  }
  dependsOn: [
    storage
    sftpStorage
  ]
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
    serviceBusNamespace: '${serviceBus.outputs.namespaceName}.servicebus.windows.net'
    webPubSubEndpoint: webPubSub.outputs.webPubSubEndpoint
    fluidRelayTenantId: fluidRelay.outputs.fluidRelayTenantId
    fluidRelayEndpoint: fluidRelay.outputs.fluidRelayEndpoint
    sftpStorageAccountName: sftpStorage.outputs.sftpStorageAccountName
    statebridgeClientId: statebridgeClientId
    statebridgeClientName: statebridgeClientName
    statebridge_tenantId: statebridge_tenantId
    axiomApiBaseUrl: axiomApiBaseUrl
    axiomPipelineIdSchemaExtract: axiomPipelineIdSchemaExtract
    axiomWebhookSecret: axiomWebhookSecret
    appConfigEndpoint: appConfig.outputs.appConfigEndpoint
    azureOpenAiApiKey: azureOpenAiApiKey
    azureOpenAiEndpoint: azureOpenAiEndpoint
    googleGeminiApiKey: googleGeminiApiKey
    sambanovaApiKey: sambanovaApiKey
    sambanovaEndpoint: 'https://api.sambanova.ai/v1'
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

// SFTP Storage role assignments for Container Apps (functions need read/write on SFTP account)
module sftpStorageRoleAssignments 'modules/storage-sftp-role-assignments.bicep' = {
  name: 'sftp-storage-role-assignments-deployment'
  scope: resourceGroup
  params: {
    sftpStorageAccountName: sftpStorage.outputs.sftpStorageAccountName
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
  }
}

// Storage role assignments for Container Apps (after apps exist)
module storageRoleAssignments 'modules/storage-role-assignments.bicep' = {
  name: 'storage-role-assignments-deployment'
  scope: resourceGroup
  params: {
    storageAccountName: storage.outputs.storageAccountName
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
  }
}

// Service Bus role assignments for Container Apps (after apps exist)
module serviceBusRoleAssignments 'modules/servicebus-role-assignments.bicep' = {
  name: 'servicebus-role-assignments-deployment'
  scope: resourceGroup
  params: {
    serviceBusNamespaceName: serviceBus.outputs.namespaceName
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
  }
}

// Web PubSub role assignments for Container Apps (after apps exist)
module webPubSubRoleAssignments 'modules/webpubsub-role-assignments.bicep' = {
  name: 'webpubsub-role-assignments-deployment'
  scope: resourceGroup
  params: {
    webPubSubName: webPubSub.outputs.webPubSubName
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
    fluidRelayTenantKey: fluidRelay.outputs.fluidRelayPrimaryKey
    axiomWebhookSecret: axiomWebhookSecret
  }
}

// Our own App Configuration store (replaces the cross-RG Certo dependency).
module appConfig 'modules/app-config.bicep' = {
  name: 'app-config-deployment'
  scope: resourceGroup
  params: {
    location: location
    namingPrefix: namingPrefix
    environment: environment
    tags: tags
  }
}

// App Configuration Data Reader role for Container Apps — scoped to our own RG.
module appConfigReaderRole 'modules/appconfig-reader-role.bicep' = {
  name: 'appconfig-reader-role-deployment'
  scope: resourceGroup
  params: {
    appConfigName: appConfig.outputs.appConfigName
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
  }
}

// Key Vault Role Assignments for Container Apps + CI/CD service principal
module keyVaultRoleAssignments 'modules/keyvault-role-assignments.bicep' = {
  name: 'keyvault-role-assignments-deployment'
  scope: resourceGroup
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    containerAppPrincipalIds: appServices.outputs.containerAppPrincipalIds
    additionalPrincipalIds: empty(ciServicePrincipalId) ? [] : [ciServicePrincipalId]
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
// Email sender address is derived from the Azure-managed domain (always verified).
// emailDomain / autoConfigureDns / dnsZoneResourceGroup params are kept at top level
// for future custom-domain use but are not passed to this module.
module communicationServices 'modules/communication-services-deployment.bicep' = {
  name: 'communication-services-deployment'
  scope: resourceGroup
  params: {
    environmentName: environment
    location: location
    cosmosDbAccountName: cosmosDb.outputs.cosmosAccountName
    tags: tags
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
output sftpStorageAccountName string = sftpStorage.outputs.sftpStorageAccountName
output sftpEndpoint string = sftpStorage.outputs.sftpEndpoint
output sftpStatebridgeContainer string = sftpStorage.outputs.statebridgeContainerName
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
    serviceBus: 'Data Sender + Data Receiver granted to all Container Apps'
  }
  serviceBus: {
    namespaceName: serviceBus.outputs.namespaceName
    endpoint: serviceBus.outputs.endpoint
    queues: serviceBus.outputs.queueNames
    topics: serviceBus.outputs.topicNames
  }
  webPubSub: {
    name: webPubSub.outputs.webPubSubName
    hostName: webPubSub.outputs.webPubSubHostName
  }
  fluidRelay: {
    name: fluidRelay.outputs.fluidRelayName
    tenantId: fluidRelay.outputs.fluidRelayTenantId
    endpoint: fluidRelay.outputs.fluidRelayEndpoint
  }
}

// Critical outputs for frontend repository configuration
output frontendDeploymentToken string = staticWebApp.outputs.staticWebAppDeploymentToken
output frontendRepoSecrets object = staticWebApp.outputs.frontendRepoSecrets
output staticWebAppUrl string = staticWebApp.outputs.staticWebAppUrl

// Communication services outputs
output communicationServicesEndpoint string = communicationServices.outputs.communicationServicesEndpoint
output emailDomainVerificationRecords object = communicationServices.outputs.emailVerificationRecords
