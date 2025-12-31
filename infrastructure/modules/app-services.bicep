// Application Services Module - Container Apps and Function Apps hosting
// Includes Container Apps, Function Apps, and related compute services

param location string
param environment string
param suffix string
param tags object
param logAnalyticsWorkspaceId string
param useBootstrapImage bool = true // Set to false after first deployment
param storageAccountConnectionString string
param applicationInsightsConnectionString string
param applicationInsightsInstrumentationKey string
param cosmosEndpoint string
param cosmosDatabaseName string
param batchDataEndpoint string = ''
param batchDataApiKey string = ''

// Variables
var containerAppEnvironmentName = 'cae-appraisal-${environment}-${suffix}'
var acrName = 'acrappraisal${environment}${take(suffix, 8)}'
var baseContainerSecrets = [
  {
    name: 'azurewebjobsstorage'
    value: storageAccountConnectionString
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
var containerAppSecrets = useBootstrapImage ? [] : concat(baseContainerSecrets, empty(batchDataApiKey) ? [] : [
  {
    name: 'batchdata-key'
    value: batchDataApiKey
  }
])

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
    targetPort: 7071
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
        name: 'AZURE_STORAGE_CONNECTION_STRING'
        secretRef: 'azurewebjobsstorage'
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
        value: '7071'
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
    ], empty(batchDataApiKey) ? [] : [
      {
        name: 'BATCHDATA_KEY'
        secretRef: 'batchdata-key'
      }
    ])
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

resource containerAppInstances 'Microsoft.App/containerApps@2023-05-01' = [for (app, i) in containerApps: {
  name: 'ca-${replace(app.name, '-', '')}-${take(environment, 3)}-${take(suffix, 4)}'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: useBootstrapImage ? bootstrapPort : app.targetPort
        allowInsecure: false
        transport: 'http'
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
          identity: 'system'
        }
      ]
      secrets: containerAppSecrets
    }
    template: {
      containers: [
        {
          name: app.name
          image: useBootstrapImage ? bootstrapImage : '${containerRegistry.properties.loginServer}/${app.imageName}:latest'
          resources: {
            cpu: json(app.cpu)
            memory: app.memory
          }
          env: [for envVar in app.env: envVar]
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
}]

// ACR Pull role assignments - created AFTER container apps exist
resource acrPullRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (app, i) in containerApps: {
  name: guid(containerAppInstances[i].id, containerRegistry.id, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: containerAppInstances[i].identity.principalId
    principalType: 'ServicePrincipal'
  }
  dependsOn: [
    containerAppInstances[i]
  ]
}]

// Outputs
output containerAppEnvironmentName string = containerAppEnvironment.name
output containerAppEnvironmentId string = containerAppEnvironment.id
output containerAppNames array = [for (app, i) in containerApps: containerAppInstances[i].name]
output containerAppFqdns array = [for (app, i) in containerApps: containerAppInstances[i].properties.configuration.ingress.fqdn]
output containerAppPrincipalIds array = [for (app, i) in containerApps: containerAppInstances[i].identity.principalId]
output containerRegistryName string = containerRegistry.name
output containerRegistryId string = containerRegistry.id
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
