/**
 * Provisions the firing-decisions Cosmos container introduced by Phase G
 * polish of docs/DECISION_ENGINE_RULES_SURFACE.md. Holds per-vendor
 * firing-rules evaluation records produced by the daily firing evaluator
 * job.
 *
 * Safe to deploy against an existing account — only adds; never modifies
 * or deletes existing containers. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-firing-decisions-container.bicep \
 *     --parameters cosmosAccountName=appraisal-mgmt-staging-cosmos
 */

@description('Name of the existing Cosmos DB account.')
param cosmosAccountName string

@description('Name of the existing Cosmos DB SQL database.')
param databaseName string = 'appraisal-management'

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

resource firingDecisionsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'firing-decisions'
  properties: {
    resource: {
      id: 'firing-decisions'
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
          // Big sub-objects — only ever displayed in the FE timeline,
          // never queried inside.
          { path: '/metricsSnapshot/*' }
          { path: '/actionsFired/*' }
        ]
        compositeIndexes: [
          // Sandbox replay window: WHERE tenantId AND evaluatedAt >= @since
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/evaluatedAt', order: 'descending' }
          ]
          // Per-vendor history: WHERE tenantId AND vendorId
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/vendorId', order: 'ascending' }
            { path: '/evaluatedAt', order: 'descending' }
          ]
          // Outcome roll-up for analytics (Phase E surface):
          //   WHERE tenantId AND outcome ORDER BY evaluatedAt DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/outcome', order: 'ascending' }
            { path: '/evaluatedAt', order: 'descending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        // Belt + suspenders against duplicate same-day writes (synthetic id
        // already enforces this).
        uniqueKeys: [
          { paths: ['/vendorId', '/runDate'] }
        ]
      }
    }
  }
}

output firingDecisionsId string = firingDecisionsContainer.id
