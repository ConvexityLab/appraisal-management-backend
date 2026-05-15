/**
 * Cosmos DB container for the vendor outbound event outbox.
 *
 * One document type:
 *
 *   vendor-event-outbox  — VendorOutboxDocument
 *     Partition key: /tenantId
 *     id:            vendor-outbound:<eventId>  (idempotency key)
 *     Fields: direction, status, attemptCount, nextRetryAt, connectionId, vendorType
 *
 * VendorEventOutboxService (inbound) and VendorOutboundOutboxService (outbound)
 * both write to this container. VendorOutboxWorkerService polls direction='inbound'
 * and VendorOutboundWorkerService polls direction='outbound'.
 *
 * The container is already defined in cosmos-production.bicep (deployed as part of
 * the main template). This standalone file exists for targeted manual patches
 * (e.g. adding TTL or index changes to an existing environment without a full
 * main-template redeploy).
 *
 * NOTE: Do NOT wire this into main.bicep — that would create a duplicate resource
 * deployment that conflicts with the definition in cosmos-production.bicep.
 *
 * TTL of 7 days (604800 s) automatically purges processed documents so
 * the container does not grow unbounded.
 *
 * Usage (standalone patch only):
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-dev-eastus \
 *     --template-file infrastructure/modules/cosmos-vendor-event-outbox-container.bicep \
 *     --parameters cosmosAccountName=appraisal-mgmt-dev-cosmos
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

// ─── vendor-event-outbox container ────────────────────────────────────────────

resource vendorEventOutboxContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'vendor-event-outbox'
  properties: {
    resource: {
      id: 'vendor-event-outbox'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      // TTL: 7 days. Successfully delivered documents (status='delivered') are
      // not explicitly deleted — TTL keeps the container from growing unbounded.
      defaultTtl: 604800
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
          // Worker poll sweep: direction + status + availableAt
          // Matches the WHERE/ORDER BY clause in VendorOutboundWorkerService.loadPendingDocuments()
          [
            { path: '/direction', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/availableAt', order: 'ascending' }
          ]
          // Dead-letter sweep: find all dead-lettered events for a connection
          [
            { path: '/connectionId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/attemptCount', order: 'descending' }
          ]
        ]
      }
    }
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

output containerName string = vendorEventOutboxContainer.name
