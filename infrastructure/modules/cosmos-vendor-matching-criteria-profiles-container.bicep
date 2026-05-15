/**
 * Cosmos DB container for per-tenant vendor-matching criteria profiles.
 *
 * Stores VendorMatchingCriteriaProfile documents (see
 * src/types/vendor-marketplace.types.ts). Overlay hierarchy
 * BASE → CLIENT → PRODUCT → CLIENT_PRODUCT × phase × version; every edit
 * creates a new version, prior is deactivated (active=false), legacy
 * versions retained for replay.
 *
 * Safe to deploy against an existing account — only adds; never modifies or
 * deletes. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-vendor-matching-criteria-profiles-container.bicep \
 *     --parameters cosmosAccountName=appraisal-mgmt-staging-cosmos
 *
 * ─── Why a separate container — duplication check (2026-05-13) ───────────────
 *
 * Before deploying, we audited every existing container that could plausibly
 * absorb criteria profiles. None fit. Recording here so future "do we need
 * this?" reviewers see the answer inline instead of reopening the question.
 *
 *   - vendor-matching-rule-packs (Prio JSONLogic rules) — rules are
 *     "if X then deny/score-adjust" logic; criteria profiles are
 *     configuration ("performance weighs 25%, proximity off for DVR").
 *     Folding criteria into rule packs would require inventing new Prio
 *     action verbs (set_criterion_weight, toggle_criterion), coupling the
 *     matcher to the rule engine and breaking the abstraction.
 *
 *   - client-configs (TenantAutomationConfigService) — wrong partition
 *     key (/clientId not /tenantId); no version chain; no slot for BASE
 *     overlays (which have no clientId); mixing automation toggles with
 *     overlay rules is the schema-smell.
 *
 *   - decision-rule-packs — same rules-vs-config mismatch as
 *     vendor-matching-rule-packs.
 *
 *   - Azure App Configuration — env-stage-static values, not admin-edited
 *     per-client overlays.
 *
 *   - Hard-coded WEIGHTS in vendor-matching-engine.service.ts — what we
 *     replaced; zero per-tenant override existed before this container.
 *
 * The overlay hierarchy + version chain + composite indexes on
 * (tenantId, scope.kind, phase, version DESC) match the resolver's
 * query pattern exactly. No other container had a viable shape.
 *
 * If a future "tenant-overlays" container is introduced (hosting THIS
 * + other overlay-style configs side-by-side), this container can be
 * folded in — but for one overlay domain, one container is correct.
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

resource criteriaProfilesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'vendor-matching-criteria-profiles'
  properties: {
    resource: {
      id: 'vendor-matching-criteria-profiles'
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
          // criteria sub-object is fetched whole, never queried inside.
          { path: '/criteria/*' }
        ]
        compositeIndexes: [
          // Resolver query: WHERE tenantId AND type AND active AND scope.kind AND phase ORDER BY version DESC
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/scope/kind', order: 'ascending' }
            { path: '/phase', order: 'ascending' }
            { path: '/version', order: 'descending' }
          ]
          // Admin list of all versions for a (scope, phase) tuple
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/scope/kind', order: 'ascending' }
            { path: '/scope/clientId', order: 'ascending' }
            { path: '/scope/productType', order: 'ascending' }
            { path: '/version', order: 'descending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        // (scope+phase+version) is unique per tenant — belt+suspenders against
        // race-condition duplicate version creates.
        uniqueKeys: [
          { paths: ['/scope/kind', '/scope/clientId', '/scope/productType', '/phase', '/version'] }
        ]
      }
    }
  }
}

output criteriaProfilesId string = criteriaProfilesContainer.id
