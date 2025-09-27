// Application Services Module - Container Apps and Function Apps hosting
// Includes Container Apps, Function Apps, and related compute services

param location string
param environment string
param suffix string
param tags object
param keyVaultName string
param logAnalyticsWorkspaceId string

// Variables
var containerAppEnvironmentName = 'cae-appraisal-${environment}-${suffix}'
var acrName = 'acrappraisal${environment}${take(suffix, 8)}'
var appServicePlanName = 'asp-appraisal-${environment}-${suffix}'
var functionAppStorageName = 'stfunc${environment}${take(suffix, 8)}'

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
    policies: {
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
    }
    encryption: {
      status: 'disabled'
    }
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
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

// Container Apps for microservices
var containerApps = [
  {
    name: 'order-management'
    image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' // Placeholder image
    cpu: environment == 'prod' ? '1.0' : '0.5'
    memory: environment == 'prod' ? '2Gi' : '1Gi'
    minReplicas: environment == 'prod' ? 2 : 1
    maxReplicas: environment == 'prod' ? 10 : 3
  }
  {
    name: 'vendor-management'
    image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
    cpu: environment == 'prod' ? '1.0' : '0.5'
    memory: environment == 'prod' ? '2Gi' : '1Gi'
    minReplicas: environment == 'prod' ? 2 : 1
    maxReplicas: environment == 'prod' ? 10 : 3
  }
  {
    name: 'valuation-engine'
    image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
    cpu: environment == 'prod' ? '2.0' : '1.0'
    memory: environment == 'prod' ? '4Gi' : '2Gi'
    minReplicas: environment == 'prod' ? 2 : 1
    maxReplicas: environment == 'prod' ? 20 : 5
  }
  {
    name: 'qc-automation'
    image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
    cpu: environment == 'prod' ? '1.0' : '0.5'
    memory: environment == 'prod' ? '2Gi' : '1Gi'
    minReplicas: environment == 'prod' ? 2 : 1
    maxReplicas: environment == 'prod' ? 10 : 3
  }
  {
    name: 'payment-processing'
    image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
    cpu: environment == 'prod' ? '1.0' : '0.5'
    memory: environment == 'prod' ? '2Gi' : '1Gi'
    minReplicas: environment == 'prod' ? 2 : 1
    maxReplicas: environment == 'prod' ? 10 : 3
  }
  {
    name: 'notification-service'
    image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'  
    cpu: environment == 'prod' ? '0.5' : '0.25'
    memory: environment == 'prod' ? '1Gi' : '0.5Gi'
    minReplicas: environment == 'prod' ? 1 : 1
    maxReplicas: environment == 'prod' ? 5 : 2
  }
]

resource containerAppInstances 'Microsoft.App/containerApps@2023-05-01' = [for app in containerApps: {
  name: 'ca-${app.name}-${environment}-${suffix}'
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
        targetPort: 80
        allowInsecure: false
        traffic: [
          {
            weight: 100
            latestRevision: true
          }
        ]
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: app.name
          image: app.image
          resources: {
            cpu: json(app.cpu)
            memory: app.memory
          }
          env: [
            {
              name: 'ENVIRONMENT'
              value: environment
            }
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: environment == 'prod' ? 'Production' : 'Development'
            }
          ]
        }
      ]
      scale: {
        minReplicas: app.minReplicas
        maxReplicas: app.maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}]

// Role assignment for Container Apps to pull from ACR
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (app, i) in containerApps: {
  name: guid(containerRegistry.id, containerAppInstances[i].id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: containerAppInstances[i].identity.principalId
    principalType: 'ServicePrincipal'
  }
}]

// Storage Account for Azure Functions
resource functionAppStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: functionAppStorageName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    dnsEndpointType: 'Standard'
    defaultToOAuthAuthentication: false
    publicNetworkAccess: 'Enabled'
    allowCrossTenantReplication: false
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    supportsHttpsTrafficOnly: true
    encryption: {
      requireInfrastructureEncryption: false
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

// App Service Plan for Azure Functions
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'EP1' : 'Y1'
    tier: environment == 'prod' ? 'ElasticPremium' : 'Dynamic'
  }
  kind: environment == 'prod' ? 'elastic' : 'functionapp'
  properties: {
    reserved: true // Linux
    maximumElasticWorkerCount: environment == 'prod' ? 20 : 1
  }
}

// Azure Functions App for background processing
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: 'func-appraisal-${environment}-${suffix}'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    reserved: true
    isXenon: false
    hyperV: false
    vnetRouteAllEnabled: false
    vnetImagePullEnabled: false
    vnetContentShareEnabled: false
    siteConfig: {
      numberOfWorkers: 1
      linuxFxVersion: 'Python|3.11'
      acrUseManagedIdentityCreds: false
      alwaysOn: environment == 'prod'
      http20Enabled: false
      functionAppScaleLimit: environment == 'prod' ? 200 : 10
      minimumElasticInstanceCount: environment == 'prod' ? 1 : 0
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${functionAppStorage.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${functionAppStorage.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${functionAppStorage.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${functionAppStorage.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower('func-appraisal-${environment}-${suffix}')
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
        {
          name: 'WEBSITE_PYTHON_DEFAULT_VERSION'
          value: '3.11'
        }
      ]
    }
    httpsOnly: true
    redundancyMode: 'None'
    storageAccountRequired: false
    keyVaultReferenceIdentity: 'SystemAssigned'
  }
}

// Logic Apps for workflow automation  
resource logicApp 'Microsoft.Logic/workflows@2019-05-01' = {
  name: 'logic-appraisal-${environment}-${suffix}'
  location: location
  tags: tags
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      parameters: {}
      triggers: {}
      actions: {}
      outputs: {}
    }
    parameters: {}
  }
}

// Outputs
output containerAppEnvironmentName string = containerAppEnvironment.name
output containerAppEnvironmentId string = containerAppEnvironment.id
output containerAppNames array = [for (app, i) in containerApps: containerAppInstances[i].name]
output containerRegistryName string = containerRegistry.name
output containerRegistryId string = containerRegistry.id
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output functionAppName string = functionApp.name
output functionAppId string = functionApp.id
output appServicePlanName string = appServicePlan.name
output appServicePlanId string = appServicePlan.id
output logicAppName string = logicApp.name
output logicAppId string = logicApp.id
