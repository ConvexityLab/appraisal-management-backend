/**
 * Add AI Assistant Cosmos DB containers to an existing account + database.
 *
 * Introduces four containers that back the frontend AI Assistant
 * subsystem (phases 0–8 of AI-ASSISTANT-PRODUCTION-READINESS-PLAN.md).
 * Safe to deploy against an existing account — additive only; never
 * modifies or deletes existing containers.  Idempotent.
 *
 *   1. ai-audit-events       — attributable record of every AI-initiated
 *                               tool / intent execution.  Partition /tenantId.
 *   2. ai-conversations      — persistent AI conversation history per user
 *                               per tenant.  Replaces client-only IndexedDB
 *                               so right-to-delete and cross-tenant
 *                               isolation work via the standard account
 *                               pipeline.  Partition /tenantId.
 *   3. ai-feature-flags       — per-tenant / per-user runtime overrides of
 *                               the AI Assistant feature flags defined in
 *                               the frontend aiAssistantFlags.ts.
 *                               Partition /tenantId.
 *   4. ai-telemetry-events   — short-retention (30 d) observability
 *                               events from the AI loop (prompt submitted,
 *                               intent parsed, tool invoked, etc).
 *                               Partition /tenantId.
 *
 * TTL values are defaults; production policy should revisit alongside the
 * engagement-audit-events TTL review (see cosmos-audit-events-container.bicep).
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group appraisal-mgmt-staging \
 *     --template-file infrastructure/modules/cosmos-ai-assistant-containers.bicep \
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

// ─── ai-audit-events container ────────────────────────────────────────────────
// Every write/external-sideEffect AI action produces one row.
// Retention should match engagement-audit-events.
resource aiAuditEventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'ai-audit-events'
  properties: {
    resource: {
      id: 'ai-audit-events'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      // ⚠️  DEFERRED: TTL matches engagement-audit-events (-1 / forever)
      // until retention policy (F5 in the AI readiness plan) is
      // confirmed by legal.  Recommended: 7 years = 220,752,000 s.
      defaultTtl: -1
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [{ path: '/*' }]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
        compositeIndexes: [
          // Primary: all audit rows for a tenant, newest first.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
          // Per-user filter.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/userId', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
          // Per-kind filter (tool vs intent).
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/kind', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
          // Entity cross-link (e.g. all AI actions on a specific order).
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/entityId', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
        ]
      }
    }
  }
}

// ─── ai-conversations container ───────────────────────────────────────────────
// Persistent conversation history.  Frontend treats this as the source of
// truth and uses IndexedDB only as a cache.
resource aiConversationsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'ai-conversations'
  properties: {
    resource: {
      id: 'ai-conversations'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      // ⚠️  DEFERRED: retention also pending F5.  Pick something short
      // of the audit window — 1 year is a reasonable starting place.
      defaultTtl: -1
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [{ path: '/*' }]
        excludedPaths: [
          { path: '/"_etag"/?' }
          // Message bodies can be large; exclude from index.
          { path: '/messages/*' }
        ]
        compositeIndexes: [
          // Primary: all conversations for a user, newest first.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/userId', order: 'ascending' }
            { path: '/updatedAt', order: 'descending' }
          ]
        ]
      }
    }
  }
}

// ─── ai-feature-flags container ───────────────────────────────────────────────
// Per-tenant runtime overrides of the frontend AiAssistantFlags.  Document
// id is `${tenantId}` (global tenant flags) or `${tenantId}:${userId}`
// (per-user override, takes precedence).
resource aiFeatureFlagsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'ai-feature-flags'
  properties: {
    resource: {
      id: 'ai-feature-flags'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      // Flags documents are small, long-lived, and written rarely.
      // No TTL — infinite retention.
      defaultTtl: -1
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [{ path: '/*' }]
        excludedPaths: [{ path: '/"_etag"/?' }]
      }
    }
  }
}

// ─── ai-telemetry-events container ────────────────────────────────────────────
// Short-retention observability events.  30-day TTL so we don't pay to
// keep click-level telemetry indefinitely.
resource aiTelemetryEventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'ai-telemetry-events'
  properties: {
    resource: {
      id: 'ai-telemetry-events'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      // 30 days = 2,592,000 seconds.
      defaultTtl: 2592000
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [{ path: '/*' }]
        excludedPaths: [
          { path: '/"_etag"/?' }
          { path: '/data/*' }
        ]
        compositeIndexes: [
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/eventType', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
        ]
      }
    }
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

@description('Resource IDs of the AI Assistant containers.')
output containerIds object = {
  aiAuditEvents: aiAuditEventsContainer.id
  aiConversations: aiConversationsContainer.id
  aiFeatureFlags: aiFeatureFlagsContainer.id
  aiTelemetryEvents: aiTelemetryEventsContainer.id
}
