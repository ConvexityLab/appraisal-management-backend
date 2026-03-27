/**
 * Add the "engagements" Cosmos DB container to an existing account + database.
 *
 * Partition key: /tenantId
 * Indexes:       engagementNumber, client.clientId, property.zipCode, status, priority
 *
 * Safe to deploy against an existing account — additive only; never modifies or
 * deletes existing containers. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-engagements-container.bicep \
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

// ─── engagements container ─────────────────────────────────────────────────────

resource engagementsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'engagements'
  properties: {
    resource: {
      id: 'engagements'
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
          // Most common list query: all engagements for a tenant, newest first
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // Filter by status within a tenant
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // Filter by client within a tenant
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/client/clientId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // Filter by priority within a tenant
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/priority', order: 'ascending' }
            { path: '/clientDueDate', order: 'ascending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        // engagementNumber must be unique per tenant
        uniqueKeys: [
          {
            paths: ['/tenantId', '/engagementNumber']
          }
        ]
      }
    }
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

@description('Resource ID of the engagements container.')
output engagementsContainerId string = engagementsContainer.id

@description('Name of the engagements container.')
output engagementsContainerName string = engagementsContainer.name
