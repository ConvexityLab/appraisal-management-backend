/**
 * Add the "engagement-audit-events" Cosmos DB container to an existing
 * account + database.
 *
 * Partition key: /engagementId
 * Rationale:   All audit events for an engagement are queried together,
 *              so colocating them on engagementId gives single-partition
 *              reads for both the audit log and timeline endpoints.
 *
 * Safe to deploy against an existing account — additive only; never modifies
 * or deletes existing containers. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group appraisal-mgmt-staging \
 *     --template-file infrastructure/modules/cosmos-audit-events-container.bicep \
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

// ─── engagement-audit-events container ────────────────────────────────────────

resource auditEventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'engagement-audit-events'
  properties: {
    resource: {
      id: 'engagement-audit-events'
      partitionKey: {
        paths: ['/engagementId']
        kind: 'Hash'
      }
      // ⚠️  DEFERRED: TTL is enabled but set to -1 (documents live forever).
      // Before production go-live this MUST be changed to enforce data retention.
      // USPAP minimum is 5 years; 7 years (220,752,000 s) is the recommended value.
      // See AUTOMATION_FLOW.md § "Known Gaps & Deferred Work" for full rationale.
      // Also create a matching Bicep module for the `audit-trail` container.
      defaultTtl: -1
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
          // data payload can be large; exclude deep paths from index
          { path: '/data/*' }
        ]
        compositeIndexes: [
          // Primary audit log query: all events for an engagement, newest first
          [
            { path: '/engagementId', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
          // Filter by category within engagement
          [
            { path: '/engagementId', order: 'ascending' }
            { path: '/category', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
          // Filter by severity within engagement
          [
            { path: '/engagementId', order: 'ascending' }
            { path: '/severity', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
          // Filter by eventType within engagement
          [
            { path: '/engagementId', order: 'ascending' }
            { path: '/eventType', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
        ]
      }
    }
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

@description('Resource ID of the engagement-audit-events container.')
output auditEventsContainerId string = auditEventsContainer.id

@description('Name of the engagement-audit-events container.')
output auditEventsContainerName string = auditEventsContainer.name
