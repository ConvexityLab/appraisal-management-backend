@description('Appraisal drafts container: in-progress appraisal work (UAD 3.6 Phase 1)')
param cosmosAccountName string
param databaseName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ── appraisal-drafts ──────────────────────────────────────────────────────────
// Stores AppraisalDraft documents — in-progress appraisal work with
// section-level auto-save. Partitioned by /orderId so all drafts for a single
// order are co-located for efficient listing and conflict detection.
// Separate from finalized reports in the `reporting` container.
resource appraisalDraftsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'appraisal-drafts'
  properties: {
    resource: {
      id: 'appraisal-drafts'
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
          // Exclude the large reportDocument from indexing — only queried by id
          { path: '/reportDocument/*' }
        ]
        compositeIndexes: [
          // List drafts for an order by status + last modified
          [
            { path: '/orderId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/updatedAt', order: 'descending' }
          ]
          // List drafts for an order by creation time
          [
            { path: '/orderId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
      defaultTtl: -1
    }
  }
}

output containerName string = appraisalDraftsContainer.name
