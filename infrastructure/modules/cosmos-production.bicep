@description('Production deployment for Azure Cosmos DB - Enterprise Appraisal Management System')
param location string = resourceGroup().location
param environment string = 'production'
param cosmosAccountName string = 'appraisal-cosmos-${environment}-${uniqueString(resourceGroup().id)}'
param databaseName string = 'appraisal-management'
param containerAppPrincipalIds array = []

var tags = {
  Environment: environment
  Project: 'AppraisalManagement'
  Service: 'CosmosDB'
  CostCenter: 'IT'
  Owner: 'Platform Team'
}

// Container configurations optimized for appraisal management workload
var containers = [
  {
    name: 'orders'
    partitionKey: '/status'
    throughput: 1000
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
        { path: '/attachments/*' }
      ]
      compositeIndexes: [
        [
          { path: '/status', order: 'ascending' }
          { path: '/createdAt', order: 'descending' }
        ]
        [
          { path: '/assignedVendorId', order: 'ascending' }
          { path: '/dueDate', order: 'ascending' }
        ]
        [
          { path: '/productType', order: 'ascending' }
          { path: '/priority', order: 'ascending' }
        ]
      ]
    }
  }
  {
    name: 'vendors'
    partitionKey: '/status'
    throughput: 800
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
        { path: '/bankingInfo/*' }
        { path: '/insuranceInfo/documents/*' }
      ]
      compositeIndexes: [
        [
          { path: '/status', order: 'ascending' }
          { path: '/performance/rating', order: 'descending' }
        ]
        [
          { path: '/licenseState', order: 'ascending' }
          { path: '/productTypes', order: 'ascending' }
        ]
      ]
    }
  }
  {
    name: 'property-summaries'
    partitionKey: '/propertyType'
    throughput: 2000
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      spatialIndexes: [
        {
          path: '/address/location/*'
          types: ['Point', 'Polygon']
        }
      ]
      compositeIndexes: [
        [
          { path: '/address/state', order: 'ascending' }
          { path: '/propertyType', order: 'ascending' }
        ]
        [
          { path: '/propertyType', order: 'ascending' }
          { path: '/valuation/estimatedValue', order: 'descending' }
        ]
        [
          { path: '/address/city', order: 'ascending' }
          { path: '/building/yearBuilt', order: 'descending' }
        ]
        [
          { path: '/building/livingAreaSquareFeet', order: 'ascending' }
          { path: '/valuation/estimatedValue', order: 'ascending' }
        ]
      ]
    }
  }
  {
    name: 'properties'
    partitionKey: '/address/state'
    throughput: 1500
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/id/?' }
        { path: '/address/*' }
        { path: '/assessment/*' }
        { path: '/valuation/*' }
        { path: '/building/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
        { path: '/deedHistory/*' }
        { path: '/demographics/*' }
        { path: '/mortgageHistory/*' }
        { path: '/propertyOwnerProfile/documents/*' }
      ]
    }
  }
]

// Cosmos DB Account with enterprise settings
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: cosmosAccountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: true
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
      maxIntervalInSeconds: 300
      maxStalenessPrefix: 100000
    }
    capabilities: [
      { name: 'EnableAggregationPipeline' }
      { name: 'EnableServerless' }
    ]
    publicNetworkAccess: 'Disabled'
    enableAnalyticalStorage: true
    analyticalStorageConfiguration: {
      schemaType: 'WellDefined'
    }
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 720
        backupStorageRedundancy: 'Geo'
      }
    }
    enableFreeTier: false
    capacity: {
      totalThroughputLimit: 10000
    }
    networkAclBypass: 'AzureServices'
    networkAclBypassResourceIds: []
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
      throughput: 2000
    }
  }
}

// Containers with optimized configurations
resource cosmosContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = [for container in containers: {
  parent: database
  name: container.name
  properties: {
    resource: {
      id: container.name
      partitionKey: {
        paths: [container.partitionKey]
        kind: 'Hash'
      }
      defaultTtl: -1
      indexingPolicy: container.indexingPolicy
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
    options: {
      throughput: container.throughput
    }
  }
}]

// Diagnostic settings for comprehensive monitoring
resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: cosmosAccount
  name: '${cosmosAccountName}-diagnostics'
  properties: {
    logs: [
      {
        category: 'DataPlaneRequests'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 90
        }
      }
      {
        category: 'QueryRuntimeStatistics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 90
        }
      }
      {
        category: 'PartitionKeyStatistics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 30
        }
      }
      {
        category: 'PartitionKeyRUConsumption'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 30
        }
      }
      {
        category: 'ControlPlaneRequests'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 90
        }
      }
    ]
    metrics: [
      {
        category: 'Requests'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 90
        }
      }
    ]
  }
}

// Role assignments - Cosmos DB Built-in Data Reader for container apps
resource cosmosDbDataReaderRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  name: guid(cosmosAccount.id, principalId, '00000000-0000-0000-0000-000000000001')
  scope: cosmosAccount
  properties: {
    roleDefinitionId: resourceId('Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions', cosmosAccount.name, '00000000-0000-0000-0000-000000000001') // Cosmos DB Built-in Data Reader
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows container app ${i} to read Cosmos DB data'
  }
}]

// Role assignments - Cosmos DB Built-in Data Contributor for container apps
resource cosmosDbDataContributorRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  name: guid(cosmosAccount.id, principalId, '00000000-0000-0000-0000-000000000002')
  scope: cosmosAccount
  properties: {
    roleDefinitionId: resourceId('Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions', cosmosAccount.name, '00000000-0000-0000-0000-000000000002') // Cosmos DB Built-in Data Contributor
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows container app ${i} to read and write Cosmos DB data'
  }
}]

// Outputs for application configuration
output cosmosAccountId string = cosmosAccount.id
output cosmosAccountName string = cosmosAccount.name
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output databaseName string = database.name
output containerNames array = [for container in containers: container.name]
output locations array = cosmosAccount.properties.locations
output consistencyLevel string = cosmosAccount.properties.consistencyPolicy.defaultConsistencyLevel

// Configuration for application settings
output appSettings object = {
  COSMOS_ENDPOINT: cosmosAccount.properties.documentEndpoint
  COSMOS_DATABASE_NAME: databaseName
  COSMOS_CONTAINER_ORDERS: 'orders'
  COSMOS_CONTAINER_VENDORS: 'vendors'
  COSMOS_CONTAINER_PROPERTY_SUMMARIES: 'property-summaries'
  COSMOS_CONTAINER_PROPERTIES: 'properties'
}
