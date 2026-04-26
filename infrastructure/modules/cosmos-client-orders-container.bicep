/**
 * Add the "client-orders" Cosmos DB container to an existing account + database.
 *
 * Stores ClientOrder documents — what a client placed on an engagement
 * (e.g. "BPO" for a specific loan). Each ClientOrder is fulfilled by one or
 * more VendorOrder documents (in the existing `orders` container). See
 * src/types/client-order.types.ts.
 *
 * Partition key: /tenantId
 *
 * Safe to deploy against an existing account — additive only; never modifies
 * or deletes existing containers. Idempotent.
 */

@description('Name of the existing Cosmos DB account.')
param cosmosAccountName string

@description('Name of the existing Cosmos DB SQL database.')
param databaseName string = 'appraisal-management'

// ─── Existing resources ─────────────────────────────────────────────────────

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ─── client-orders container ────────────────────────────────────────────────

resource clientOrdersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'client-orders'
  properties: {
    resource: {
      id: 'client-orders'
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
          // List for a tenant, newest first — primary dashboard query.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // Filter by ClientOrderStatus within a tenant.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/clientOrderStatus', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // All ClientOrders for an engagement — drill-down from engagement detail.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/engagementId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // All ClientOrders for a client (lender) within a tenant.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/clientId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        // clientOrderNumber must be unique per tenant.
        uniqueKeys: [
          {
            paths: ['/clientOrderNumber']
          }
        ]
      }
    }
  }
}

output containerName string = clientOrdersContainer.name
