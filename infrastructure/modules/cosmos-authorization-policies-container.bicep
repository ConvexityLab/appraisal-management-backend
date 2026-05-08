/**
 * Add the "authorization-policies" Cosmos DB container to an existing
 * account + database.
 *
 * Partition key: /tenantId
 * Rationale:   Every query filters by tenantId + role + resourceType,
 *              so colocating all policies for a tenant on a single
 *              partition key gives single-partition reads for the
 *              PolicyEvaluatorService hot path.
 *
 * Safe to deploy against an existing account — additive only; never modifies
 * or deletes existing containers. Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group <rg-name> \
 *     --template-file infrastructure/modules/cosmos-authorization-policies-container.bicep \
 *     --parameters cosmosAccountName=appraisal-mgmt-dev-cosmos
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

// ─── authorization-policies container ─────────────────────────────────────────

resource authorizationPoliciesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'authorization-policies'
  properties: {
    resource: {
      id: 'authorization-policies'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
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
          // Fast lookup for PolicyEvaluatorService: (tenantId, role, resourceType)
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/role', order: 'ascending' }
            { path: '/resourceType', order: 'ascending' }
          ]
          // Policy management list view: ordered by priority descending
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/role', order: 'ascending' }
            { path: '/priority', order: 'descending' }
          ]
          // Audit trail: ordered by timestamp descending per policy
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/policyId', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
        ]
      }
    }
  }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

@description('Resource ID of the authorization-policies container.')
output containerId string = authorizationPoliciesContainer.id

@description('Name of the authorization-policies container.')
output containerName string = authorizationPoliciesContainer.name
