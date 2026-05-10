/**
 * Add three Cosmos DB containers introduced by AUTO_ASSIGNMENT_REVIEW.md
 * Phases 3 + 5:
 *   - vendor-matching-rule-packs   (partition key: /tenantId)
 *   - vendor-matching-rule-audit   (partition key: /tenantId)
 *   - assignment-traces            (partition key: /tenantId)
 *
 * Safe to deploy against an existing account — only adds; never modifies or
 * deletes existing containers. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-vendor-matching-rule-pack-containers.bicep \
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

// ─── vendor-matching-rule-packs ───────────────────────────────────────────────
// Phase 3 T19. Per-tenant immutable versioned rule packs that drive MOP's
// vendor-matching evaluator. Synthetic id is `${tenantId}__${packId}__v${version}`
// so listing all versions for a (tenant, packId) is a partition-scoped query.

resource rulePacksContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'vendor-matching-rule-packs'
  properties: {
    resource: {
      id: 'vendor-matching-rule-packs'
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
          // The rules array can grow; we never query inside it (only the
          // rule pack as a whole is fetched).
          { path: '/rules/*' }
        ]
        compositeIndexes: [
          // Listing all versions of a pack: WHERE tenantId AND packId ORDER BY version DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/packId', order: 'ascending' }
            { path: '/version', order: 'descending' }
          ]
          // Finding the active version: WHERE tenantId AND packId AND status='active'
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/packId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        // Belt + suspenders against duplicate version writes (synthetic id
        // already enforces this, but the unique key catches mistakes that
        // bypass composeId).
        uniqueKeys: [
          { paths: ['/packId', '/version'] }
        ]
      }
    }
  }
}

// ─── vendor-matching-rule-audit ───────────────────────────────────────────────
// Phase 3 T23. Append-only audit log for every CRUD on rule packs.
// Document id is a uuid; tenantId is the partition key.

resource ruleAuditContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'vendor-matching-rule-audit'
  properties: {
    resource: {
      id: 'vendor-matching-rule-audit'
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
          // Audit log for a pack: WHERE tenantId AND packId ORDER BY timestamp DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/packId', order: 'ascending' }
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

// ─── assignment-traces ────────────────────────────────────────────────────────
// Phase 5 T37. Per-assignment evaluation trace; one document per
// triggerVendorAssignment. Synthetic id is `${tenantId}__${orderId}__${initiatedAt}`
// so retries (deterministic id) collide and Cosmos returns 409 — recorder
// treats that as success.

resource tracesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'assignment-traces'
  properties: {
    resource: {
      id: 'assignment-traces'
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
          // The big sub-arrays — only ever displayed in the FE timeline,
          // never queried inside.
          { path: '/rankedVendors/*' }
          { path: '/deniedVendors/*' }
          { path: '/matchRequest/*' }
        ]
        compositeIndexes: [
          // FE order-detail timeline: WHERE tenantId AND orderId ORDER BY initiatedAt DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/orderId', order: 'ascending' }
            { path: '/initiatedAt', order: 'descending' }
          ]
          // Recent decisions / live feed: WHERE tenantId ORDER BY initiatedAt DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/initiatedAt', order: 'descending' }
          ]
          // Phase 7 analytics — aggregate by outcome over time.
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/outcome', order: 'ascending' }
            { path: '/initiatedAt', order: 'descending' }
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
output assignmentTracesId string = tracesContainer.id
