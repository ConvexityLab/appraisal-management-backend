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
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
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
  {
    name: 'analytics'
    partitionKey: '/reportType'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/reportType', order: 'ascending' }
          { path: '/timestamp', order: 'descending' }
        ]
        [
          { path: '/dateRange/from', order: 'ascending' }
          { path: '/dateRange/to', order: 'descending' }
        ]
      ]
    }
  }
  {
    name: 'users'
    partitionKey: '/organizationId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
        { path: '/passwordHash/?' }
      ]
      compositeIndexes: [
        [
          { path: '/role', order: 'ascending' }
          { path: '/isActive', order: 'ascending' }
        ]
      ]
    }
  }
  {
    name: 'results'
    partitionKey: '/orderId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/orderId', order: 'ascending' }
          { path: '/validatedAt', order: 'descending' }
        ]
        [
          { path: '/qcScore', order: 'descending' }
          { path: '/validatedAt', order: 'descending' }
        ]
      ]
    }
  }
  {
    name: 'criteria'
    partitionKey: '/clientId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/status', order: 'ascending' }
          { path: '/category', order: 'ascending' }
        ]
        [
          { path: '/clientId', order: 'ascending' }
          { path: '/createdAt', order: 'descending' }
        ]
      ]
    }
  }
  {
    name: 'reviews'
    partitionKey: '/checklistId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/status', order: 'ascending' }
          { path: '/executedAt', order: 'descending' }
        ]
        [
          { path: '/checklistId', order: 'ascending' }
          { path: '/status', order: 'ascending' }
        ]
      ]
    }
  }
  {
    name: 'sessions'
    partitionKey: '/userId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/status', order: 'ascending' }
          { path: '/startedAt', order: 'descending' }
        ]
      ]
    }
  }
  {
    name: 'templates'
    partitionKey: '/category'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/category', order: 'ascending' }
          { path: '/version', order: 'descending' }
        ]
        [
          { path: '/isActive', order: 'ascending' }
          { path: '/priority', order: 'ascending' }
        ]
      ]
    }
  }
  // QC Workflow Automation Containers
  {
    name: 'qc-review-queue'
    partitionKey: '/orderId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/status', order: 'ascending' }
          { path: '/priorityScore', order: 'descending' }
        ]
        [
          { path: '/assignedAnalystId', order: 'ascending' }
          { path: '/status', order: 'ascending' }
        ]
        [
          { path: '/priorityLevel', order: 'ascending' }
          { path: '/createdAt', order: 'ascending' }
        ]
        [
          { path: '/slaBreached', order: 'ascending' }
          { path: '/priorityScore', order: 'descending' }
        ]
      ]
    }
  }
  {
    name: 'revisions'
    partitionKey: '/orderId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/orderId', order: 'ascending' }
          { path: '/requestedAt', order: 'descending' }
        ]
        [
          { path: '/status', order: 'ascending' }
          { path: '/dueDate', order: 'ascending' }
        ]
        [
          { path: '/severity', order: 'ascending' }
          { path: '/requestedAt', order: 'descending' }
        ]
      ]
    }
  }
  {
    name: 'escalations'
    partitionKey: '/orderId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/status', order: 'ascending' }
          { path: '/priority', order: 'descending' }
        ]
        [
          { path: '/escalationType', order: 'ascending' }
          { path: '/raisedAt', order: 'descending' }
        ]
        [
          { path: '/assignedTo', order: 'ascending' }
          { path: '/status', order: 'ascending' }
        ]
      ]
    }
  }
  {
    name: 'sla-tracking'
    partitionKey: '/orderId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/status', order: 'ascending' }
          { path: '/percentComplete', order: 'descending' }
        ]
        [
          { path: '/entityType', order: 'ascending' }
          { path: '/startTime', order: 'ascending' }
        ]
        [
          { path: '/orderId', order: 'ascending' }
          { path: '/entityType', order: 'ascending' }
        ]
      ]
    }
  }
  {
    name: 'sla-configurations'
    partitionKey: '/clientId'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
      compositeIndexes: [
        [
          { path: '/clientId', order: 'ascending' }
          { path: '/entityType', order: 'ascending' }
        ]
      ]
    }
  }
  {
    name: 'transactions'
    partitionKey: '/id'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
    }
  }
  {
    name: 'batchData'
    partitionKey: '/id'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
    }
  }
  {
    name: 'comps'
    partitionKey: '/id'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
    }
  }
  {
    name: 'reporting'
    partitionKey: '/id'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
      ]
    }
  }
  {
    name: 'appraisalData'
    partitionKey: '/id'
    indexingPolicy: {
      indexingMode: 'consistent'
      automatic: true
      includedPaths: [
        { path: '/*' }
      ]
      excludedPaths: [
        { path: '/"_etag"/?' }
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
        isZoneRedundant: false
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
    // No throughput option for serverless
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
    // No throughput option for serverless
  }
}]

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
