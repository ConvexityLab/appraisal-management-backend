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
