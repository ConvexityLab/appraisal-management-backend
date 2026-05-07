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
// batchDataEndpoint is still consumed by the Functions container's env block
// (Functions runtime has no loadAppConfig hook yet). Keep until Functions is
// migrated separately.
param batchDataEndpoint string = 'https://api.batchdata.com/api/v1/'
param batchDataApiKey string = ''
param keyVaultUrl string = ''
param azureTenantId string = ''
param azureClientId string = ''
// AZURE_SERVICE_BUS_NAMESPACE is read at module-top-level (cascade through
// AxiomService → ServiceBusEventPublisher) — must stay in bicep until lazy-init.
param serviceBusNamespace string
// azureCommunicationEndpoint, azureCommunicationEmailDomain, webPubSubEndpoint,
// fluidRelayTenantId, fluidRelayEndpoint, azureOpenAiEndpoint, azureOpenAiDeployment,
// sambanovaEndpoint, certoEndpoint are non-secret service-discovery values —
// sourced at runtime from App Configuration via appConfigLoader.ts.

// Statebridge SFTP integration
param sftpStorageAccountName string = ''
param statebridgeClientId string = 'statebridge'
param statebridgeClientName string = 'Statebridge'
param statebridge_tenantId string = ''

// Axiom AI platform integration
// AXIOM_API_BASE_URL, AXIOM_CLIENT_ID, AXIOM_SUB_CLIENT_ID, AXIOM_PIPELINE_ID_SCHEMA_EXTRACT
// are non-secret service-discovery values — loaded at runtime from Azure App Configuration
// (see appConfigLoader.ts KEY_TO_ENV). They are intentionally NOT bicep params.
@secure()
@description('Shared secret used to verify HMAC-SHA256 signatures on inbound Axiom webhooks. Must match the secret configured in Axiom outbound webhook settings. Store in Key Vault as "axiom-webhook-secret".')
param axiomWebhookSecret string = ''
@description('Azure App Configuration endpoint (e.g. https://appconfig-certo-dev.azconfig.io). When set, service-discovery URLs including AXIOM_API_BASE_URL are loaded from App Config at startup via Managed Identity.')
param appConfigEndpoint string = ''

// AI provider credentials (azureOpenAiApiKey, googleGeminiApiKey, sambanovaApiKey)
// and iVueit credentials are sourced via Container App keyVaultUrl secret refs
// (see API container's secrets block below). The Container App's user-assigned
// identity has Key Vault Secrets Officer role on the env's KV and resolves the
// values at runtime. Bicep does NOT receive the values as params — Key Vault
// is the only source of truth.

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
// AI provider API keys (azure-openai-api-key, google-gemini-api-key,
// sambanova-api-key) and iVueit creds (ivueit-api-key, ivueit-secret) are
// declared further down on the API container resource via Container App
// keyVaultUrl secret refs — they're sourced from Key Vault at runtime via
// Managed Identity, not passed through bicep params.
var containerAppSecrets = useBootstrapImage ? [] : concat(
  baseContainerSecrets,
  empty(batchDataApiKey) ? [] : [{
    name: 'batchdata-key'
    value: batchDataApiKey
  }],
  empty(axiomWebhookSecret) ? [] : [{
    name: 'axiom-webhook-secret'
    value: axiomWebhookSecret
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
    // Most env values now come from Azure App Configuration at runtime via
    // appConfigLoader.ts (see KEY_TO_ENV). The entries below are the carve-outs:
    //   - Container shape (NODE_ENV, PORT, ENVIRONMENT)
    //   - Bootstrap chicken-and-egg (App Config endpoint, label, KV URL,
    //     tenant ID — needed before loadAppConfig can run)
    //   - App Insights connection string (deferred — has embedded key, candidate
    //     for Key Vault ref later)
    //   - Secrets via Container App secret refs (axiom-webhook-secret stays as
    //     inline-value pattern; openai/gemini/sambanova/ivueit use keyVaultUrl)
    env: [
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
      // AZURE_COSMOS_ENDPOINT / AZURE_COSMOS_DATABASE_NAME are read at
      // module-import time by criteria.controller.ts:912, results.controller.ts:1624,
      // and reviews.controller.ts:1653 — all before app-production.ts can call
      // loadAppConfig(). Keep these in bicep until those controllers lazy-instantiate.
      {
        name: 'AZURE_COSMOS_ENDPOINT'
        value: cosmosEndpoint
      }
      {
        name: 'AZURE_COSMOS_DATABASE_NAME'
        value: cosmosDatabaseName
      }
      // AZURE_SERVICE_BUS_NAMESPACE and USE_MOCK_SERVICE_BUS are read by
      // ServiceBusEventPublisher constructor → called from AxiomService
      // constructor → in the module-top-level cascade with the QC controllers.
      // Stay in bicep until that's refactored.
      {
        name: 'AZURE_SERVICE_BUS_NAMESPACE'
        value: serviceBusNamespace
      }
      {
        name: 'USE_MOCK_SERVICE_BUS'
        value: environment == 'dev' ? 'true' : 'false'
      }
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        value: applicationInsightsConnectionString
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
        name: 'AZURE_APP_CONFIGURATION_ENDPOINT'
        value: appConfigEndpoint
      }
      {
        name: 'APP_CONFIG_LABEL'
        value: environment
      }
      {
        // HMAC secret for inbound Axiom webhook signature verification.
        name: 'AXIOM_WEBHOOK_SECRET'
        secretRef: 'axiom-webhook-secret'
      }
      {
        name: 'AZURE_OPENAI_API_KEY'
        secretRef: 'azure-openai-api-key'
      }
      {
        name: 'GOOGLE_GEMINI_API_KEY'
        secretRef: 'google-gemini-api-key'
      }
      {
        name: 'SAMBANOVA_API_KEY'
        secretRef: 'sambanova-api-key'
      }
      {
        name: 'IVUEIT_API_KEY'
        secretRef: 'ivueit-api-key'
      }
      {
        name: 'IVUEIT_SECRET'
        secretRef: 'ivueit-secret'
      }
    ]
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
      // AXIOM_PIPELINE_ID_SCHEMA_EXTRACT populated at startup by loadAppConfig()
      // (services.axiom-api.pipeline-id-schema-extract in App Config).
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
      // App-shared secrets + per-app Key Vault refs. Only the API container
      // consumes these — the Container App's user-assigned identity reads them
      // from Key Vault at runtime via Managed Identity, value never passes
      // through bicep, GH Actions, or pipeline logs.
      secrets: useBootstrapImage ? containerAppSecrets : concat(containerAppSecrets, app.name == 'appraisal-api' ? [
        {
          name: 'azure-openai-api-key'
          keyVaultUrl: '${keyVaultUrl}secrets/azure-openai-api-key'
          identity: containerAppIdentities[i].id
        }
        {
          name: 'google-gemini-api-key'
          keyVaultUrl: '${keyVaultUrl}secrets/google-gemini-api-key'
          identity: containerAppIdentities[i].id
        }
        {
          name: 'sambanova-api-key'
          keyVaultUrl: '${keyVaultUrl}secrets/sambanova-api-key'
          identity: containerAppIdentities[i].id
        }
        {
          name: 'ivueit-api-key'
          keyVaultUrl: '${keyVaultUrl}secrets/ivueit-api-key'
          identity: containerAppIdentities[i].id
        }
        {
          name: 'ivueit-secret'
          keyVaultUrl: '${keyVaultUrl}secrets/ivueit-secret'
          identity: containerAppIdentities[i].id
        }
      ] : [])
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
