/**
 * Cosmos DB container for blob-sync intake jobs and sync cursors.
 *
 * Two document types share this container (discriminated by `type`):
 *
 *   blob-intake-job   — BlobIntakeJobDocument
 *     Partition key: /tenantId
 *     id:            fileId  (SHA-256 of storageAccount:container:blobPath:eTag)
 *     Tracks per-blob ingestion status: received → queued → processing → done / failed.
 *     Re-enumerated on retry (retryCount < maxRetries).
 *
 *   blob-sync-cursor  — BlobSyncCursorDocument
 *     Partition key: /tenantId
 *     id:            cursor:{connectionId}
 *     Stores lastSyncRunId + lastSyncCompletedAt so DataShareBlobSyncAdapter can
 *     enumerate only blobs uploaded since the previous sync run.
 *
 * Safe to deploy against an existing account — additive only; idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-blob-intake-jobs-container.bicep \
 *     --parameters cosmosAccountName=appraisal-mgmt-staging-cosmos
 */

@description('Name of the existing Cosmos DB account.')
param cosmosAccountName string

@description('Name of the existing Cosmos DB SQL database.')
param databaseName string = 'appraisal-management'

// ─── Existing resources ────────────────────────────────────────────────────────

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ─── blob-intake-jobs container ───────────────────────────────────────────────

resource blobIntakeJobsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'blob-intake-jobs'
  properties: {
    resource: {
      id: 'blob-intake-jobs'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      defaultTtl: -1
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
          // Idempotency probe: lookup by (tenantId partition) + connectionId + fileId
          // Used by both adapters before creating a new intake job.
          [
            { path: '/connectionId', order: 'ascending' }
            { path: '/fileId', order: 'ascending' }
          ]
          // Retry sweep: list all failed jobs for a connection within a tenant
          [
            { path: '/connectionId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/retryCount', order: 'ascending' }
          ]
          // Cursor lookup: type='blob-sync-cursor' by connectionId
          [
            { path: '/type', order: 'ascending' }
            { path: '/connectionId', order: 'ascending' }
          ]
        ]
      }
    }
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

output containerName string = blobIntakeJobsContainer.name
