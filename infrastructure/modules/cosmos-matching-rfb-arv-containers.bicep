/**
 * Add three new Cosmos DB containers to an existing account + database:
 *   - matching-criteria-sets  (partition key: /tenantId)
 *   - rfb-requests            (partition key: /orderId)
 *   - arv-analyses            (partition key: /tenantId)
 *
 * Safe to deploy against an existing account — only adds; never modifies or
 * deletes existing containers.  Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-matching-rfb-arv-containers.bicep \
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

// ─── matching-criteria-sets ───────────────────────────────────────────────────

resource matchingCriteriaSetsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'matching-criteria-sets'
  properties: {
    resource: {
      id: 'matching-criteria-sets'
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
        ]
        compositeIndexes: [
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/name', order: 'ascending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
  }
}

// ─── rfb-requests ─────────────────────────────────────────────────────────────

resource rfbRequestsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'rfb-requests'
  properties: {
    resource: {
      id: 'rfb-requests'
      partitionKey: {
        paths: ['/orderId']
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
          // matchSnapshot is large and rarely queried directly — exclude from index
          { path: '/matchSnapshot/*' }
        ]
        compositeIndexes: [
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
          ]
          [
            { path: '/orderId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
  }
}

// ─── arv-analyses ─────────────────────────────────────────────────────────────

resource arvAnalysesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'arv-analyses'
  properties: {
    resource: {
      id: 'arv-analyses'
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
          // comps and scopeOfWork are large sub-arrays; query by analysis-level fields only
          { path: '/comps/*' }
          { path: '/scopeOfWork/*' }
        ]
        compositeIndexes: [
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          [
            { path: '/orderId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
          ]
          [
            { path: '/dealType', order: 'ascending' }
            { path: '/status', order: 'ascending' }
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

output matchingCriteriaSetsId string = matchingCriteriaSetsContainer.id
output rfbRequestsId string = rfbRequestsContainer.id
output arvAnalysesId string = arvAnalysesContainer.id
