// Application Services Module - Container Apps and Function Apps hosting
// Includes Container Apps, Function Apps, and related compute services

param location string
param environment string
param suffix string
param tags object
param logAnalyticsWorkspaceId string

// Variables
var containerAppEnvironmentName = 'cae-appraisal-${environment}-${suffix}'
var acrName = 'acrappraisal${environment}${take(suffix, 8)}'

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

// Single monolithic API container app
var containerApps = [
  {
    name: 'appraisal-api'
    image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' // Placeholder - will be replaced with actual image
    cpu: environment == 'prod' ? '2.0' : '1.0'
    memory: environment == 'prod' ? '4Gi' : '2Gi'
    minReplicas: environment == 'prod' ? 2 : 1
    maxReplicas: environment == 'prod' ? 10 : 5
    targetPort: 8080 // Node.js app port
  }
]

resource containerAppInstances 'Microsoft.App/containerApps@2023-05-01' = [for app in containerApps: {
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
        targetPort: app.targetPort
        allowInsecure: false
        transport: 'http'
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
              name: 'NODE_ENV'
              value: environment == 'prod' ? 'production' : 'development'
            }
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'ENVIRONMENT'
              value: environment
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

// ACR Pull role assignments for container apps to pull images
resource acrPullRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (app, i) in containerApps: {
  name: guid(containerRegistry.id, containerAppInstances[i].id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: containerAppInstances[i].identity.principalId
    principalType: 'ServicePrincipal'
    description: 'Allows ${containerAppInstances[i].name} to pull container images from ACR'
  }
}]



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
output containerAppPrincipalIds array = [for (app, i) in containerApps: containerAppInstances[i].identity.principalId]
output containerRegistryName string = containerRegistry.name
output containerRegistryId string = containerRegistry.id
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output logicAppName string = logicApp.name
output logicAppId string = logicApp.id
