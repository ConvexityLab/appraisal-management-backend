/**
 * Cosmos DB container for per-scorecard events (ML feed + audit grade history).
 *
 * Append-only. One doc per scorecard append (initial scoring OR re-score).
 * Carries full context at the moment of scoring so an ML pipeline can later
 * train predictive models without retrofitting joins:
 *
 *   - Raw 5-category scores + overall
 *   - Order context: productType, clientId, programId, dueDate, deliveredAt
 *   - Vendor context: tier at time of scoring, prior overallScore, years on platform
 *   - Reviewer context: userId, role, trailing accuracy (when available)
 *   - Derived signals at the time: revisionCount, daysLate, reassignment flag
 *   - Resolved rollup-profile id chain (so we know which weights applied)
 *
 * Distinct from order.scorecards[] — that array is the operational source of
 * truth for the active rating per order. This events container is a flat
 * stream optimized for analytics + ML, not for "what's the current scorecard
 * on order X?" queries.
 *
 * Why a separate container — duplication check:
 *
 *   - order.scorecards[]: per-order, embedded. Needed for the supersedes
 *     chain and the rollup window queries. Separate concern.
 *
 *   - audit-trail: writes structured-by-resource audit rows. Could store
 *     scorecard events but the audit shape is generic; ML wants the
 *     scorecard-specific context preserved in a queryable schema.
 *
 *   - analytics (existing vendor-analytics cache): consumed by the dashboards,
 *     not designed as a long-lived ML training source.
 *
 * Safe to deploy against an existing account — only adds; never modifies or
 * deletes. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-scorecard-events-container.bicep \
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

resource scorecardEventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'scorecard-events'
  properties: {
    resource: {
      id: 'scorecard-events'
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
          // The scores sub-object and the resolved profile id chain are
          // returned whole on reads, not queried inside.
          { path: '/scores/*' }
          { path: '/appliedProfileIds/*' }
        ]
        compositeIndexes: [
          // Vendor-level training query: WHERE tenantId AND vendorId ORDER BY reviewedAt DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/vendorId', order: 'ascending' }
            { path: '/reviewedAt', order: 'descending' }
          ]
          // Product-mix training query: WHERE tenantId AND productType ORDER BY reviewedAt DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/productType', order: 'ascending' }
            { path: '/reviewedAt', order: 'descending' }
          ]
          // Reviewer audit / drift: WHERE tenantId AND reviewedBy ORDER BY reviewedAt DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/reviewedBy', order: 'ascending' }
            { path: '/reviewedAt', order: 'descending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        // Same scorecard event id shouldn't land twice — synthetic id from
        // the source order + scorecard id makes retries idempotent.
        uniqueKeys: [
          { paths: ['/orderId', '/scorecardId'] }
        ]
      }
    }
  }
}

output scorecardEventsId string = scorecardEventsContainer.id
