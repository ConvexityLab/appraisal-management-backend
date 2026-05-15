/**
 * Add the generalized Decision Engine Cosmos containers introduced by
 * docs/DECISION_ENGINE_RULES_SURFACE.md Phase A:
 *   - decision-rule-packs   (partition key: /tenantId)
 *   - decision-rule-audit   (partition key: /tenantId)
 *
 * These supersede the vendor-matching-specific
 * `vendor-matching-rule-packs` + `vendor-matching-rule-audit` containers
 * (created by cosmos-vendor-matching-rule-pack-containers.bicep). The old
 * containers remain in place; a one-shot migration script copies their
 * docs into the new containers and the old ones are kept read-only for
 * one release before removal.
 *
 * Safe to deploy against an existing account — only adds; never modifies
 * or deletes existing containers. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-decision-engine-rule-containers.bicep \
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

// ─── decision-rule-packs ──────────────────────────────────────────────────────
// Phase A. Per-(tenant, category) immutable versioned rule packs that drive
// every decision-engine evaluator on the platform. Synthetic id is
// `${tenantId}__${category}__${packId}__v${version}` so listing all versions
// for a (tenant, category, packId) is a partition-scoped query.

resource rulePacksContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'decision-rule-packs'
  properties: {
    resource: {
      id: 'decision-rule-packs'
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
          // Rules are opaque per-category JSON; never queried inside.
          { path: '/rules/*' }
        ]
        compositeIndexes: [
          // Listing all versions of a pack:
          //   WHERE tenantId AND category AND packId ORDER BY version DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/category', order: 'ascending' }
            { path: '/packId', order: 'ascending' }
            { path: '/version', order: 'descending' }
          ]
          // Finding the active version:
          //   WHERE tenantId AND category AND packId AND status='active'
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/category', order: 'ascending' }
            { path: '/packId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
          ]
          // Cross-tenant analytics in Phase E:
          //   WHERE category ORDER BY createdAt DESC
          [
            { path: '/category', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        // Belt + suspenders against duplicate version writes (synthetic id
        // already enforces this, but the unique key catches mistakes that
        // bypass composeId).
        uniqueKeys: [
          { paths: ['/category', '/packId', '/version'] }
        ]
      }
    }
  }
}

// ─── decision-rule-audit ──────────────────────────────────────────────────────
// Phase A. Append-only audit log for every CRUD on rule packs across all
// categories. Document id is a uuid; tenantId is the partition key.

resource ruleAuditContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'decision-rule-audit'
  properties: {
    resource: {
      id: 'decision-rule-audit'
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
          // diff sub-object's array contents are rendered to the operator
          // verbatim; never queried by content.
          { path: '/diff/added/*' }
          { path: '/diff/removed/*' }
          { path: '/diff/modified/*' }
        ]
        compositeIndexes: [
          // Audit log for a pack:
          //   WHERE tenantId AND category AND packId ORDER BY timestamp DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/category', order: 'ascending' }
            { path: '/packId', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
          // Tenant-wide rule edit history (Phase I "audit hub"):
          //   WHERE tenantId ORDER BY timestamp DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

output rulePacksId string = rulePacksContainer.id
output ruleAuditId string = ruleAuditContainer.id
