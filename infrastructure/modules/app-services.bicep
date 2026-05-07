// Application Services Module - Container Apps and Function Apps hosting
// Includes Container Apps, Function Apps, and related compute services

param location string
param environment string
param suffix string
param tags object
param logAnalyticsWorkspaceId string
param useBootstrapImage bool = true // Set to false after first deployment

@description('Image tag for the appraisal-api container. Pass the build SHA tag from CI on each deploy. Defaults to "latest" only for initial bootstrap or manual dispatches that did not resolve a tag.')
param appImageTag string = 'latest'

@description('Image tag for the appraisal-functions container. Same semantics as appImageTag.')
param functionsImageTag string = 'latest'
param storageAccountName string
param applicationInsightsConnectionString string
param applicationInsightsInstrumentationKey string
param cosmosEndpoint string
param cosmosDatabaseName string
param batchDataEndpoint string = ''
param batchDataApiKey string = ''
param azureCommunicationEndpoint string = ''
param azureCommunicationEmailDomain string = ''
param keyVaultUrl string = ''
param azureTenantId string = ''
param azureClientId string = ''
param serviceBusNamespace string = ''
param webPubSubEndpoint string = ''
param fluidRelayTenantId string = ''
param fluidRelayEndpoint string = ''

// Statebridge SFTP integration
param sftpStorageAccountName string = ''
param statebridgeClientId string = 'statebridge'
param statebridgeClientName string = 'Statebridge'
param statebridge_tenantId string = ''

// Axiom AI platform integration
// URL is populated at runtime from Azure App Configuration (key: services.axiom-api.base-url).
// This param is a deploy-time fallback for environments not yet using App Config.
param axiomApiBaseUrl string = ''
@description('Registered ID for the Axiom pdf-schema-extraction pipeline. Defaults to the canonical registered pipeline; override only if Axiom publishes a new pipeline version.')
param axiomPipelineIdSchemaExtract string = 'complete-document-criteria-evaluation'
@secure()
@description('Shared secret used to verify HMAC-SHA256 signatures on inbound Axiom webhooks. Must match the secret configured in Axiom outbound webhook settings. Store in Key Vault as "axiom-webhook-secret".')
param axiomWebhookSecret string = ''
@description('Platform client ID for Axiom pipeline namespace scoping — written to AXIOM_CLIENT_ID env var.')
param axiomClientId string = ''
@description('Platform sub-client ID for Axiom pipeline namespace scoping — written to AXIOM_SUB_CLIENT_ID env var.')
param axiomSubClientId string = ''
@description('Azure App Configuration endpoint (e.g. https://appconfig-certo-dev.azconfig.io). When set, service-discovery URLs including AXIOM_API_BASE_URL are loaded from App Config at startup via Managed Identity.')
param appConfigEndpoint string = ''

// AI provider credentials
@secure()
param azureOpenAiApiKey string = ''
param azureOpenAiEndpoint string = ''
param azureOpenAiDeployment string = 'gpt-4o-mini'
@secure()
param googleGeminiApiKey string = ''
@secure()
param sambanovaApiKey string = ''
param sambanovaEndpoint string = 'https://api.sambanova.ai/v1'
param certoEndpoint string = 'https://certo-apim-dev-eastus2.azure-api.net/tgi/v1'

// iVueit inspection vendor credentials. Third-party API keys → Key Vault refs
// flow through these params from CI. INSPECTION_PROVIDER and IVUEIT_BASE_URL
// (non-secret service discovery) are sourced from App Config at startup, not
// passed as bicep params.
@secure()
@description('iVueit API key. Stored as Container App secret "ivueit-api-key" and bound to IVUEIT_API_KEY.')
param ivueitApiKey string = ''
@secure()
@description('iVueit secret. Stored as Container App secret "ivueit-secret" and bound to IVUEIT_SECRET.')
param ivueitSecret string = ''

// Variables
var containerAppEnvironmentName = 'cae-appraisal-${environment}-${suffix}'
var acrName = 'acrappraisal${environment}${take(suffix, 8)}'
// Note: Storage uses Managed Identity via AZURE_STORAGE_ACCOUNT_NAME env var
// No connection strings needed except for Azure Functions (legacy requirement)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' existing = {
  name: storageAccountName
}

// Storage connection string - ONLY for Azure Functions (Functions requirement)
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${listKeys(storageAccount.id, '2023-04-01').keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'

var baseContainerSecrets = [
  {
    name: 'azurewebjobsstorage'
    value: storageConnectionString
  }
  {
    name: 'appinsights-connection-string'
    value: applicationInsightsConnectionString
  }
  {
    name: 'appinsights-instrumentation-key'
    value: applicationInsightsInstrumentationKey
  }
]
var containerAppSecrets = useBootstrapImage ? [] : concat(
  baseContainerSecrets,
  empty(batchDataApiKey) ? [] : [{
    name: 'batchdata-key'
    value: batchDataApiKey
  }],
  empty(axiomWebhookSecret) ? [] : [{
    name: 'axiom-webhook-secret'
    value: axiomWebhookSecret
  }],
  empty(azureOpenAiApiKey) ? [] : [{
    name: 'azure-openai-api-key'
    value: azureOpenAiApiKey
  }],
  empty(googleGeminiApiKey) ? [] : [{
    name: 'google-gemini-api-key'
    value: googleGeminiApiKey
  }],
  empty(sambanovaApiKey) ? [] : [{
    name: 'sambanova-api-key'
    value: sambanovaApiKey
  }],
  empty(ivueitApiKey) ? [] : [{
    name: 'ivueit-api-key'
    value: ivueitApiKey
  }],
  empty(ivueitSecret) ? [] : [{
    name: 'ivueit-secret'
    value: ivueitSecret
  }]
)

// Container Registry for application images
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Premium' : 'Basic'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
    // Basic SKU only supports basic properties, advanced policies only for Standard/Premium
    policies: environment == 'prod' ? {
      quarantinePolicy: {
        status: 'disabled'
      }
      trustPolicy: {
        type: 'Notary'
        status: 'disabled'
      }
      retentionPolicy: {
        days: 30
        status: 'enabled'
      }
      exportPolicy: {
        status: 'enabled'
      }
    } : {
      exportPolicy: {
        status: 'enabled'
      }
    }
    encryption: {
      status: 'disabled'
    }
    dataEndpointEnabled: false
    networkRuleBypassOptions: 'AzureServices'
    zoneRedundancy: environment == 'prod' ? 'Enabled' : 'Disabled'
  }
}

// Container Apps Environment
resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2023-09-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2023-09-01').primarySharedKey
      }
    }
    zoneRedundant: environment == 'prod'
  }
}

// API container and the new functions container app definition set
var containerApps = [
  {
    name: 'appraisal-api'
    imageName: 'appraisal-api'
    cpu: environment == 'prod' ? '2.0' : '1.0'
    memory: environment == 'prod' ? '4Gi' : '2Gi'
    minReplicas: environment == 'prod' ? 2 : 1
    maxReplicas: environment == 'prod' ? 10 : 5
    targetPort: appPort
    env: concat([
      {
        name: 'NODE_ENV'
        value: environment == 'prod' ? 'production' : 'development'
      }
      {
        name: 'PORT'
        value: string(appPort)
      }
      {
        name: 'ENVIRONMENT'
        value: environment
      }
      {
        name: 'AZURE_COSMOS_ENDPOINT'
        value: cosmosEndpoint
      }
      {
        name: 'AZURE_COSMOS_DATABASE_NAME'
        value: cosmosDatabaseName
      }
      {
        name: 'AZURE_STORAGE_ACCOUNT_NAME'
        value: storageAccountName
      }
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        value: applicationInsightsConnectionString
      }
      {
        name: 'AZURE_COMMUNICATION_ENDPOINT'
        value: azureCommunicationEndpoint
      }
      {
        name: 'AZURE_COMMUNICATION_EMAIL_DOMAIN'
        value: azureCommunicationEmailDomain
      }
      {
        name: 'KEY_VAULT_URL'
        value: keyVaultUrl
      }
      {
        name: 'AZURE_TENANT_ID'
        value: azureTenantId
      }
      {
        // Blob container holding uploaded appraisal documents — used by DocumentService, AxiomController, auto-trigger
        name: 'STORAGE_CONTAINER_DOCUMENTS'
        value: 'appraisal-documents'
      }
      {
        // Blob container used as SHARED_STORAGE ingestion source for bulk package drops
        name: 'STORAGE_CONTAINER_BULK_UPLOAD'
        value: 'bulk-upload'
      }
      {
        name: 'AZURE_SERVICE_BUS_NAMESPACE'
        value: serviceBusNamespace
      }
      {
        // Basic-tier Service Bus (dev) does not support topics/subscriptions.
        // Route topic-based eventing through the in-memory event bus so
        // listeners like CompCollectionListenerJob work in-process.
        name: 'USE_MOCK_SERVICE_BUS'
        value: environment == 'dev' ? 'true' : 'false'
      }
      {
        name: 'AXIOM_PIPELINE_ID_SCHEMA_EXTRACT'
        value: axiomPipelineIdSchemaExtract
      }
      {
        // Storage account name that owns the bulk-upload container + bulk-upload-events queue.
        // Used by BulkUploadEventListenerJob for both queue polling and SHARED_STORAGE ingestion payloads.
        name: 'BULK_UPLOAD_STORAGE_ACCOUNT_NAME'
        value: storageAccountName
      }
      {
        // Enables the per-item criteria stage after extraction completes.
        // Keep enabled in deployed environments so bulk-ingestion jobs emit
        // criteria decisions and the finalizer can advance jobs to completion.
        name: 'BULK_INGESTION_ENABLE_CRITERIA_STAGE'
        value: 'true'
      }
      {
        // Deploy-time Axiom API base URL. When set, loadAppConfig() at startup sees the env
        // var is already populated and skips the App Config lookup for this key.
        // Empty string falls through to the App Config lookup path.
        name: 'AXIOM_API_BASE_URL'
        value: axiomApiBaseUrl
      }
      {
        // HMAC secret for verifying inbound Axiom webhook signatures (AXIOM_WEBHOOK_SECRET).
        // Value lives in Key Vault; passed here as a Container App secret so it is never
        // stored in plain text in the Container App environment variables.
        name: 'AXIOM_WEBHOOK_SECRET'
        secretRef: 'axiom-webhook-secret'
      }
      {
        // iVueit inspection vendor API key. Third-party API key — required by
        // IVueitInspectionProvider constructor. Value lives in Key Vault and is
        // passed in via the ivueitApiKey secure param.
        name: 'IVUEIT_API_KEY'
        secretRef: 'ivueit-api-key'
      }
      {
        // iVueit inspection vendor shared secret. Same lifecycle as IVUEIT_API_KEY.
        name: 'IVUEIT_SECRET'
        secretRef: 'ivueit-secret'
      }
      {
        // Platform client ID for Axiom pipeline namespace scoping.
        name: 'AXIOM_CLIENT_ID'
        value: axiomClientId
      }
      {
        // Platform sub-client ID for Axiom pipeline namespace scoping.
        name: 'AXIOM_SUB_CLIENT_ID'
        value: axiomSubClientId
      }
      {
        // Azure App Configuration endpoint — enables Managed Identity–based service discovery.
        // When set, loadAppConfig() at startup resolves AXIOM_API_BASE_URL and other service
        // URLs from App Config (key: services.axiom-api.base-url, label: environment).
        name: 'AZURE_APP_CONFIGURATION_ENDPOINT'
        value: appConfigEndpoint
      }
      {
        // Explicitly bind startup label to deployment environment (dev/staging/prod)
        // so App Config lookups are deterministic.
        name: 'APP_CONFIG_LABEL'
        value: environment
      }
      {
        name: 'AZURE_WEB_PUBSUB_ENDPOINT'
        value: webPubSubEndpoint
      }
      // Fluid Relay: non-secret identifiers only.
      // The signing key is in Key Vault under "fluid-relay-key"; CollaborationService fetches it at runtime.
      {
        name: 'AZURE_FLUID_RELAY_TENANT_ID'
        value: fluidRelayTenantId
      }
      {
        name: 'AZURE_FLUID_RELAY_ENDPOINT'
        value: fluidRelayEndpoint
      }
      // Non-secret AI config
      {
        name: 'AZURE_OPENAI_ENDPOINT'
        value: azureOpenAiEndpoint
      }
      {
        name: 'AZURE_OPENAI_DEPLOYMENT'
        value: azureOpenAiDeployment
      }
      {
        name: 'AZURE_OPENAI_MODEL_NAME'
        value: azureOpenAiDeployment
      }
      {
        name: 'SAMBANOVA_ENDPOINT'
        value: sambanovaEndpoint
      }
      {
        name: 'CERTO_ENDPOINT'
        value: certoEndpoint
      }
    ], concat(
      empty(azureOpenAiApiKey) ? [] : [{
        name: 'AZURE_OPENAI_API_KEY'
        secretRef: 'azure-openai-api-key'
      }],
      empty(googleGeminiApiKey) ? [] : [{
        name: 'GOOGLE_GEMINI_API_KEY'
        secretRef: 'google-gemini-api-key'
      }],
      empty(sambanovaApiKey) ? [] : [{
        name: 'SAMBANOVA_API_KEY'
        secretRef: 'sambanova-api-key'
      }]
    ))
    scaleRule: {
      name: 'api-http-scaling'
      http: {
        metadata: {
          concurrentRequests: '100'
        }
      }
    }
  }
  {
    name: 'appraisal-functions'
    imageName: 'appraisal-functions'
    cpu: environment == 'prod' ? '1.0' : '0.5'
    memory: environment == 'prod' ? '2Gi' : '1Gi'
    minReplicas: environment == 'prod' ? 2 : 1
    maxReplicas: environment == 'prod' ? 10 : 3
    targetPort: functionsPort
    env: concat([
      {
        name: 'AzureWebJobsStorage'
        secretRef: 'azurewebjobsstorage'
      }
      {
        name: 'AzureWebJobsStorage__connectionString'
        secretRef: 'azurewebjobsstorage'
      }
      {
        name: 'AzureWebJobsMyStorageConnectionAppSetting'
        secretRef: 'azurewebjobsstorage'
      }
      {
        // Managed-identity queue trigger binding.
        // The Azure Functions SDK resolves "<prefix>__queueServiceUri" automatically and
        // authenticates via DefaultAzureCredential (AZURE_CLIENT_ID set below).
        // Required RBAC: Storage Queue Data Contributor (974c5e8b) is already granted to
        // all container app identities in data-services.bicep :: primaryStorageQueueRoleAssignments.
        name: 'SFTP_ORDER_QUEUE_STORAGE__queueServiceUri'
        value: 'https://${storageAccountName}.queue.core.windows.net'
      }
      {
        name: 'AZURE_STORAGE_ACCOUNT_NAME'
        value: storageAccountName
      }
      {
        // Blob container holding uploaded appraisal/BPO documents — used by handleStatebridgeBpoDocument
        name: 'STORAGE_CONTAINER_DOCUMENTS'
        value: 'appraisal-documents'
      }
      {
        // Blob container used as SHARED_STORAGE ingestion source for bulk package drops
        name: 'STORAGE_CONTAINER_BULK_UPLOAD'
        value: 'bulk-upload'
      }
      {
        name: 'BULK_UPLOAD_STORAGE_ACCOUNT_NAME'
        value: storageAccountName
      }
      {
        name: 'FUNCTIONS_EXTENSION_VERSION'
        value: '~4'
      }
      {
        name: 'FUNCTIONS_WORKER_RUNTIME'
        value: 'node'
      }
      {
        name: 'FUNCTIONS_ENVIRONMENT'
        value: environment
      }
      {
        name: 'AzureWebJobsFeatureFlags'
        value: 'EnableWorkerIndexing'
      }
      {
        name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
        secretRef: 'appinsights-instrumentation-key'
      }
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        secretRef: 'appinsights-connection-string'
      }
      {
        name: 'AzureFunctionsJobHost__Logging__Console__IsEnabled'
        value: 'true'
      }
      {
        name: 'WEBSITE_RUN_FROM_PACKAGE'
        value: '0'
      }
      {
        name: 'PORT'
        value: string(functionsPort)
      }
      {
        name: 'WEBSITES_PORT'
        value: string(functionsPort)
      }
      {
        name: 'COSMOSDB_ENDPOINT'
        value: cosmosEndpoint
      }
      {
        name: 'DATABASE_NAME'
        value: cosmosDatabaseName
      }
      {
        name: 'BATCHDATA_ENDPOINT'
        value: empty(batchDataEndpoint) ? '' : batchDataEndpoint
      }
      {
        // SFTP storage account name — used by processSftpOrderFile to download
        // inbound order files and write results back via DefaultAzureCredential
        name: 'SFTP_STORAGE_ACCOUNT_NAME'
        value: sftpStorageAccountName
      }
      {
        // Client identifier for Cosmos orders created from Statebridge SFTP files
        name: 'STATEBRIDGE_CLIENT_ID'
        value: statebridgeClientId
      }
      {
        name: 'STATEBRIDGE_CLIENT_NAME'
        value: statebridgeClientName
      }
      {
        // Cosmos partition key (tenantId) for all Statebridge engagement + order documents
        name: 'STATEBRIDGE_TENANT_ID'
        value: statebridge_tenantId
      }
      {
        // Registered UUID for the pdf-schema-extraction pipeline (leave empty to use inline definition)
        name: 'AXIOM_PIPELINE_ID_SCHEMA_EXTRACT'
        value: axiomPipelineIdSchemaExtract
      }
      {
        // Cosmos Change Feed binding — identity-based connection requires
        // CosmosDbConnection__accountEndpoint pointing at the Cosmos account.
        name: 'CosmosDbConnection__accountEndpoint'
        value: cosmosEndpoint
      }
    ], empty(batchDataApiKey) && empty(axiomWebhookSecret) ? [] : concat(
      empty(batchDataApiKey) ? [] : [{
        name: 'BATCHDATA_KEY'
        secretRef: 'batchdata-key'
      }],
      empty(axiomWebhookSecret) ? [] : [{
        name: 'AXIOM_WEBHOOK_SECRET'
        secretRef: 'axiom-webhook-secret'
      }]
    ))
    scaleRule: {
      name: 'functions-http-scaling'
      http: {
        metadata: {
          concurrentRequests: '50'
        }
      }
    }
  }
]

// Separate image selection to avoid BCP178 error
var bootstrapImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var bootstrapPort = 80 // Hello world image listens on port 80
var appPort = 8080 // Node.js app port
var functionsPort = 80 // Azure Functions custom container defaults to port 80

// Dedicated user-assigned identities ensure ACR pull access is granted before provisioning
resource containerAppIdentities 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = [for (app, i) in containerApps: {
  name: 'id-${replace(app.name, '-', '')}-${take(environment, 3)}-${take(suffix, 4)}'
  location: location
  tags: tags
}]

resource acrPullRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (app, i) in containerApps: {
  name: guid(containerAppIdentities[i].id, containerRegistry.id, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: containerAppIdentities[i].properties.principalId
    principalType: 'ServicePrincipal'
  }
}]

resource containerAppInstances 'Microsoft.App/containerApps@2023-05-01' = [for (app, i) in containerApps: {
  name: 'ca-${replace(app.name, '-', '')}-${take(environment, 3)}-${take(suffix, 4)}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${containerAppIdentities[i].id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: useBootstrapImage ? bootstrapPort : app.targetPort
        allowInsecure: false
        transport: 'auto'
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
      }
      registries: useBootstrapImage ? [] : [
        {
          server: containerRegistry.properties.loginServer
          identity: containerAppIdentities[i].id
        }
      ]
      secrets: containerAppSecrets
    }
    template: {
      containers: [
        {
          name: app.name
          image: useBootstrapImage ? bootstrapImage : '${containerRegistry.properties.loginServer}/${app.imageName}:${app.name == 'appraisal-api' ? appImageTag : functionsImageTag}'
          resources: {
            cpu: json(app.cpu)
            memory: app.memory
          }
          env: concat(app.env, [
            {
              // Use the clientId of the Bicep-managed user-assigned identity so
              // DefaultAzureCredential resolves the correct identity at runtime.
              name: 'AZURE_CLIENT_ID'
              value: containerAppIdentities[i].properties.clientId
            }
          ], app.name == 'appraisal-api' ? [
            {
              // The API app's own public ingress URL — used by AxiomService as the
              // webhookUrl base for Axiom pipeline callback registrations.
              // Computed here (not passed as a param) because it is self-referential:
              //   {appName}.{managedEnvironment.defaultDomain}
              name: 'API_BASE_URL'
              value: 'https://ca-${replace(app.name, '-', '')}-${take(environment, 3)}-${take(suffix, 4)}.${containerAppEnvironment.properties.defaultDomain}'
            }
          ] : [])
        }
      ]
      scale: {
        minReplicas: app.minReplicas
        maxReplicas: app.maxReplicas
        rules: [
          app.scaleRule
        ]
      }
    }
  }
  dependsOn: [
    acrPullRoleAssignments[i]
  ]
}]

// Outputs
output containerAppEnvironmentName string = containerAppEnvironment.name
output containerAppEnvironmentId string = containerAppEnvironment.id
output containerAppNames array = [for (app, i) in containerApps: containerAppInstances[i].name]
output containerAppFqdns array = [for (app, i) in containerApps: containerAppInstances[i].properties.configuration.ingress.fqdn]
output containerAppPrincipalIds array = [for (app, i) in containerApps: containerAppIdentities[i].properties.principalId]
output containerRegistryName string = containerRegistry.name
output containerRegistryId string = containerRegistry.id
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
