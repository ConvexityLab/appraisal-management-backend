@description('Property enrichment container — stores raw provider responses per order for traceability.')
param cosmosAccountName string
param databaseName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

resource propertyEnrichmentsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'property-enrichments'
  properties: {
    resource: {
      id: 'property-enrichments'
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
          { path: '/dataResult/*' }
        ]
        compositeIndexes: [
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/orderId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/propertyId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/engagementId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
      defaultTtl: -1
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
  }
}

output containerName string = propertyEnrichmentsContainer.name
