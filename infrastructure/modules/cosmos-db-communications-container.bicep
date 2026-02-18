@description('Communications container for unified communication tracking across all channels')
param cosmosAccountName string
param databaseName string
param location string = resourceGroup().location

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

resource communicationsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'communications'
  properties: {
    resource: {
      id: 'communications'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
          { path: '/body/?' }
          { path: '/aiAnalysis/suggestedResponse/?' }
        ]
        compositeIndexes: [
          // Order-specific communications (most common)
          [
            { path: '/primaryEntity/type', order: 'ascending' }
            { path: '/primaryEntity/id', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // Vendor/Appraiser history with category filter
          [
            { path: '/primaryEntity/type', order: 'ascending' }
            { path: '/primaryEntity/id', order: 'ascending' }
            { path: '/category', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // Thread/conversation grouping
          [
            { path: '/threadId', order: 'ascending' }
            { path: '/createdAt', order: 'ascending' }
          ]
          // Status and action tracking
          [
            { path: '/businessImpact/requiresAction', order: 'ascending' }
            { path: '/businessImpact/actionDeadline', order: 'ascending' }
          ]
          // Category + status queries
          [
            { path: '/category', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // Channel-based queries
          [
            { path: '/channel', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // Tenant + type filtering
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/type', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
      defaultTtl: -1
    }
  }
}

output containerId string = communicationsContainer.properties.resource.id
output containerName string = communicationsContainer.name
