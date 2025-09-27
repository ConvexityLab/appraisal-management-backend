@description('Azure Cosmos DB module for Enterprise Appraisal Management System')
param location string = resourceGroup().location
param cosmosAccountName string
param databaseName string = 'appraisal-management'
param environment string = 'production'
param tags object = {}

// Global distribution regions
param enableMultipleWriteLocations bool = true
param locations array = [
  {
    locationName: 'East US'
    failoverPriority: 0
    isZoneRedundant: false
  }
  {
    locationName: 'West US 2'
    failoverPriority: 1
    isZoneRedundant: false
  }
  {
    locationName: 'Central US'
    failoverPriority: 2
    isZoneRedundant: false
  }
]

// Throughput and performance settings
param enableAutomaticFailover bool = true
param consistencyLevel string = 'Session'
param maxIntervalInSeconds int = 300
param maxStalenessPrefix int = 100000

// Container configurations
param containers array = [
  {
    name: 'orders'
    partitionKey: '/status'
    throughput: 1000
    ttl: -1
  }
  {
    name: 'vendors'
    partitionKey: '/status'
    throughput: 800
    ttl: -1
  }
  {
    name: 'property-summaries'
    partitionKey: '/propertyType'
    throughput: 2000
    ttl: -1
  }
  {
    name: 'properties'
    partitionKey: '/address/state'
    throughput: 1500
    ttl: -1
  }
]

// Security and networking
param enablePublicNetworkAccess bool = false
param enableAnalyticalStorage bool = true
param enableServerless bool = false

// Cosmos DB Account
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: cosmosAccountName
  location: location
  tags: union(tags, {
    Environment: environment
    Service: 'CosmosDB'
    Purpose: 'AppraisalManagement'
  })
  kind: 'GlobalDocumentDB'
  properties: {
    enableAutomaticFailover: enableAutomaticFailover
    enableMultipleWriteLocations: enableMultipleWriteLocations
    isVirtualNetworkFilterEnabled: true
    virtualNetworkRules: []
    ipRules: []
    databaseAccountOfferType: 'Standard'
    locations: locations
    consistencyPolicy: {
      defaultConsistencyLevel: consistencyLevel
      maxIntervalInSeconds: maxIntervalInSeconds
      maxStalenessPrefix: maxStalenessPrefix
    }
    capabilities: [
      {
        name: 'EnableAggregationPipeline'
      }
      {
        name: 'EnableCassandra'
      }
      {
        name: 'EnableTable'
      }
      {
        name: 'EnableServerless'
      }
      {
        name: 'EnableMongo'
      }
    ]
    publicNetworkAccess: enablePublicNetworkAccess ? 'Enabled' : 'Disabled'
    enableAnalyticalStorage: enableAnalyticalStorage
    analyticalStorageConfiguration: enableAnalyticalStorage ? {
      schemaType: 'WellDefined'
    } : null
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 720
        backupStorageRedundancy: 'Geo'
      }
    }
    cors: [
      {
        allowedOrigins: ['*']
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        allowedHeaders: ['*']
        maxAgeInSeconds: 86400
      }
    ]
    enableFreeTier: false
    capacity: enableServerless ? null : {
      totalThroughputLimit: 10000
    }
  }
}

// Database
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
    options: {
      throughput: enableServerless ? null : 2000
    }
  }
}

// Containers
resource cosmosContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = [for container in containers: {
  parent: database
  name: container.name
  properties: {
    resource: {
      id: container.name
      partitionKey: {
        paths: [
          container.partitionKey
        ]
        kind: 'Hash'
      }
      defaultTtl: container.ttl
      indexingPolicy: container.name == 'property-summaries' ? {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
        spatialIndexes: [
          {
            path: '/address/location/*'
            types: [
              'Point'
              'Polygon'
            ]
          }
        ]
        compositeIndexes: [
          [
            {
              path: '/address/state'
              order: 'ascending'
            }
            {
              path: '/propertyType'
              order: 'ascending'
            }
          ]
          [
            {
              path: '/propertyType'
              order: 'ascending'
            }
            {
              path: '/valuation/estimatedValue'
              order: 'descending'
            }
          ]
          [
            {
              path: '/address/city'
              order: 'ascending'
            }
            {
              path: '/building/yearBuilt'
              order: 'descending'
            }
          ]
        ]
      } : {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
    options: enableServerless ? null : {
      throughput: container.throughput
    }
  }
}]

// Private Endpoint for secure access
resource cosmosPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-04-01' = if (!enablePublicNetworkAccess) {
  name: '${cosmosAccountName}-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: '/subscriptions/${subscription().subscriptionId}/resourceGroups/${resourceGroup().name}/providers/Microsoft.Network/virtualNetworks/appraisal-vnet/subnets/cosmos-subnet'
    }
    privateLinkServiceConnections: [
      {
        name: '${cosmosAccountName}-psc'
        properties: {
          privateLinkServiceId: cosmosAccount.id
          groupIds: [
            'Sql'
          ]
        }
      }
    ]
  }
}

// Diagnostic settings for monitoring
resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: cosmosAccount
  name: '${cosmosAccountName}-diagnostics'
  properties: {
    workspaceId: '/subscriptions/${subscription().subscriptionId}/resourceGroups/${resourceGroup().name}/providers/Microsoft.OperationalInsights/workspaces/appraisal-law'
    logs: [
      {
        category: 'DataPlaneRequests'
        enabled: true
      }
      {
        category: 'QueryRuntimeStatistics'
        enabled: true
      }
      {
        category: 'PartitionKeyStatistics'
        enabled: true
      }
      {
        category: 'PartitionKeyRUConsumption'
        enabled: true
      }
      {
        category: 'ControlPlaneRequests'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'Requests'
        enabled: true
      }
    ]
  }
}

// Role assignments for managed identity access
resource cosmosDbContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: cosmosAccount
  name: guid(cosmosAccount.id, 'CosmosDBContributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
    principalId: 'MANAGED_IDENTITY_PRINCIPAL_ID' // This should be replaced with actual managed identity
    principalType: 'ServicePrincipal'
  }
}

// Key Vault for storing connection strings
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' existing = {
  name: 'appraisal-kv-${environment}'
}

// Store connection strings in Key Vault
resource cosmosConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'cosmos-connection-string'
  properties: {
    value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
    contentType: 'application/x-connection-string'
    attributes: {
      enabled: true
    }
  }
}

resource cosmosEndpointSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'cosmos-endpoint'
  properties: {
    value: cosmosAccount.properties.documentEndpoint
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource cosmosPrimaryKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'cosmos-primary-key'
  properties: {
    value: cosmosAccount.listKeys().primaryMasterKey
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// Outputs
output cosmosAccountId string = cosmosAccount.id
output cosmosAccountName string = cosmosAccount.name
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output databaseName string = database.name
output containerNames array = [for container in containers: container.name]
output cosmosConnectionString string = cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
output cosmosAccountResourceId string = cosmosAccount.id

// Security and compliance outputs
output enabledCapabilities array = cosmosAccount.properties.capabilities
output backupPolicy object = cosmosAccount.properties.backupPolicy
output consistencyPolicy object = cosmosAccount.properties.consistencyPolicy
output locations array = cosmosAccount.properties.locations
