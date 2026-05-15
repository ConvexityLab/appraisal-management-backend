/**
 * Add the "decomposition-rules" Cosmos DB container to an existing account +
 * database.
 *
 * Stores DecompositionRule documents that map a ClientOrder (productType +
 * scope) to one or more VendorOrder templates. See
 * src/types/decomposition-rule.types.ts.
 *
 * Partition key: /tenantId
 *   - Tenant-scoped rules use the owning tenantId.
 *   - Global default rules use the sentinel '__global__'.
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

// ─── decomposition-rules container ──────────────────────────────────────────

resource decompositionRulesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'decomposition-rules'
  properties: {
    resource: {
      id: 'decomposition-rules'
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
          // Lookup by (tenant + productType) — second tier of precedence.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/productType', order: 'ascending' }
          ]
          // Lookup by (tenant + clientId + productType) — most-specific tier.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/clientId', order: 'ascending' }
            { path: '/productType', order: 'ascending' }
          ]
        ]
      }
    }
  }
}

output containerName string = decompositionRulesContainer.name
