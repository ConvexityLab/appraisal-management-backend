/**
 * Cosmos DB container for per-tenant scorecard-rollup profiles.
 *
 * Stores ScorecardRollupProfile documents (see vendor-marketplace.types.ts).
 * Overlay hierarchy BASE → CLIENT → PRODUCT → CLIENT_PRODUCT × phase × version;
 * every edit creates a new version, prior is deactivated (active=false),
 * legacy versions retained for replay.
 *
 * Distinct from vendor-matching-criteria-profiles: that container holds the
 * matcher's toggle/weight config (Doug's matching criteria); THIS container
 * holds David's algorithm parameters for rolling individual scorecards up
 * into a vendor's blended overallScore.
 *
 * Why a separate container — duplication check (2026-05-13):
 *
 *   - vendor-matching-criteria-profiles: matcher CRITERIA (performance vs
 *     proximity vs cost weighting). Different consumer (matcher), different
 *     data shape, separate version chain. Folding would conflate "how to
 *     pick a vendor" with "how to score a delivered assignment".
 *
 *   - vendor-matching-rule-packs (Prio): if-then deny/score rules. Wrong
 *     abstraction for a weighted-sum scoring algorithm.
 *
 *   - client-configs (TenantAutomationConfigService): partition /clientId,
 *     no version chain. No fit.
 *
 *   - Hard-coded WEIGHTS/SCORECARD_WINDOW_SIZE in
 *     VendorPerformanceCalculatorService: what we're replacing.
 *
 * Safe to deploy against an existing account — only adds; never modifies or
 * deletes. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-scorecard-rollup-profiles-container.bicep \
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

resource rollupProfilesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'scorecard-rollup-profiles'
  properties: {
    resource: {
      id: 'scorecard-rollup-profiles'
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
          // categoryWeights / gates / penalties / customFormulaOverride are
          // fetched whole, never queried inside.
          { path: '/categoryWeights/*' }
          { path: '/gates/*' }
          { path: '/penalties/*' }
          { path: '/customFormulaOverride/*' }
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
        uniqueKeys: [
          { paths: ['/scope/kind', '/scope/clientId', '/scope/productType', '/phase', '/version'] }
        ]
      }
    }
  }
}

output rollupProfilesId string = rollupProfilesContainer.id
