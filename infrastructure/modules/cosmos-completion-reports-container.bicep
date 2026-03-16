@description('Completion reports container: URAR 1.3 completion report documents per order')
param cosmosAccountName string
param databaseName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ── completion-reports ────────────────────────────────────────────────────────
// Stores CanonicalCompletionReport documents — one per order, upserted on save.
// Partitioned by /orderId so each order's completion data is a single-partition
// point-read (id == orderId).
resource completionReportsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'completion-reports'
  properties: {
    resource: {
      id: 'completion-reports'
      partitionKey: {
        paths: ['/orderId']
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
            { path: '/orderId', order: 'ascending' }
            { path: '/savedAt', order: 'descending' }
          ]
        ]
      }
      defaultTtl: -1
    }
  }
}

output containerName string = completionReportsContainer.name
