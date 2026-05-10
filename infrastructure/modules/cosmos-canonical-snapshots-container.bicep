@description('Canonical snapshots container — frozen order-scoped reproducibility documents for downstream reads and replay.')
param cosmosAccountName string
param databaseName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

resource canonicalSnapshotsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'canonical-snapshots'
  properties: {
    resource: {
      id: 'canonical-snapshots'
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
        ]
        compositeIndexes: [
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

output containerName string = canonicalSnapshotsContainer.name
