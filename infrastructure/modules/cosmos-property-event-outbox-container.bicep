@description('Property event outbox container — durable non-authoritative integration notifications derived from committed property-domain writes.')
param cosmosAccountName string
param databaseName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

resource propertyEventOutboxContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'property-event-outbox'
  properties: {
    resource: {
      id: 'property-event-outbox'
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
          { path: '/payload/*' }
        ]
        compositeIndexes: [
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/availableAt', order: 'ascending' }
          ]
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/eventType', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/availableAt', order: 'ascending' }
          ]
        ]
      }
      defaultTtl: -1
    }
  }
}

output containerName string = propertyEventOutboxContainer.name
