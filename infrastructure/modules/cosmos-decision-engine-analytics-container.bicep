/**
 * Add the Decision Engine analytics snapshot container (Phase E.preagg of
 * `docs/DECISION_ENGINE_RULES_SURFACE.md`).
 *
 *   - decision-rule-analytics   (partition key: /tenantId)
 *
 * Each row is a pre-aggregated `CategoryAnalyticsSummary` for one
 * (tenantId, category, days) tuple, computed by the nightly aggregation
 * job (`DecisionAnalyticsAggregationJob`). Synthetic id is
 * `${tenantId}__${category}__${days}d__${YYYY-MM-DD}` so same-day re-runs
 * are idempotent upserts.
 *
 * Why a new container (justification per CLAUDE.md "no schema bloat"):
 *   - The audit container (`decision-rule-audit`) is append-only audit
 *     log data — mixing aggregation snapshots in would pollute audit
 *     queries and conflict with the indexing policy.
 *   - The per-category trace stores (`assignment-traces`, `review-results`,
 *     `firing-decisions`, `orders`, `axiom-executions`) hold raw events;
 *     daily roll-ups would create write amplification + read confusion.
 *   - No existing analytics-shaped container exists on the platform —
 *     this is genuinely new shape.
 *
 * Safe to deploy against an existing account — only adds; never modifies
 * or deletes existing containers. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-decision-engine-analytics-container.bicep \
 *     --parameters cosmosAccountName=appraisal-mgmt-staging-cosmos
 */

@description('Name of the existing Cosmos DB account.')
param cosmosAccountName string

@description('Name of the existing Cosmos DB SQL database.')
param databaseName string = 'appraisal-management'

// ─── Existing resources ───────────────────────────────────────────────────────

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ─── decision-rule-analytics ──────────────────────────────────────────────────

resource analyticsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'decision-rule-analytics'
  properties: {
    resource: {
      id: 'decision-rule-analytics'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      // 30-day TTL on snapshot rows — they're recomputed nightly, so
      // there's no value in keeping historical aggregations indefinitely.
      // Operators wanting longer history get it from the raw trace stores.
      defaultTtl: 2592000
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
          // perRule[] + windowDates[] are rendered verbatim, never queried.
          { path: '/summary/perRule/*' }
          { path: '/summary/windowDates/*' }
        ]
        compositeIndexes: [
          // Latest snapshot for a (tenant, category):
          //   WHERE tenantId AND category AND days ORDER BY computedAt DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/category', order: 'ascending' }
            { path: '/days', order: 'ascending' }
            { path: '/computedAt', order: 'descending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: [
          // Synthetic id enforces same-day uniqueness, but the unique key
          // is belt + suspenders against bypassing composeId.
          { paths: ['/category', '/days', '/computedDate'] }
        ]
      }
    }
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

output analyticsContainerId string = analyticsContainer.id
