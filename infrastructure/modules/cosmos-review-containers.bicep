/**
 * Cosmos DB Review Containers
 *
 * Adds two new containers to an existing Cosmos DB account + database:
 *   - review-programs    (partition key: /clientId)
 *   - review-results     (partition key: /jobId)
 *
 * The review-programs container stores versioned ReviewProgram documents for
 * any programType (FRAUD, QC, 1033, PORTFOLIO, APPRAISAL_REVIEW, etc.).
 * clientId = null (stored as JSON null) for platform-wide defaults —
 * queries must handle both null and string values in the partition key.
 *
 * The review-results container stores per-loan ReviewTapeResult documents
 * linked to a BulkPortfolioJob by jobId.  Per-loan documents are written here
 * for large jobs (> 500 rows) to avoid Cosmos 2MB document size limits.
 *
 * Safe to deploy against an existing account — only adds; never modifies or
 * deletes existing containers.  Idempotent.
 *
 * Usage:
 *   az deployment group create \
 *     --resource-group rg-appraisal-mgmt-staging-eastus \
 *     --template-file infrastructure/modules/cosmos-review-containers.bicep \
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

// ─── review-programs ──────────────────────────────────────────────────────────
// Stores versioned ReviewProgram documents.
// programType identifies what kind of criteria this program contains (FRAUD, QC, etc.).
// clientId = null for platform-wide defaults; string for client-specific programs.

resource reviewProgramsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'review-programs'
  properties: {
    resource: {
      id: 'review-programs'
      partitionKey: {
        paths: ['/clientId']
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
            { path: '/status', order: 'ascending' }
            { path: '/name', order: 'ascending' }
          ]
          [
            { path: '/clientId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
          ]
          [
            { path: '/programType', order: 'ascending' }
            { path: '/status', order: 'ascending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        // Prevent duplicate version for the same program name + client
        uniqueKeys: [
          {
            paths: ['/name', '/version', '/clientId']
          }
        ]
      }
    }
  }
}

// ─── review-results ───────────────────────────────────────────────────────────
// Stores per-loan ReviewTapeResult documents for jobs with > 500 rows.
// Partitioned by /jobId so all results for a job land in the same logical
// partition, enabling efficient range queries and pagination.

resource reviewResultsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'review-results'
  properties: {
    resource: {
      id: 'review-results'
      partitionKey: {
        paths: ['/jobId']
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
          { path: '/autoFlagResults/*' }
          { path: '/manualFlagResults/*' }
        ]
        compositeIndexes: [
          [
            { path: '/jobId', order: 'ascending' }
            { path: '/computedDecision', order: 'ascending' }
          ]
          [
            { path: '/jobId', order: 'ascending' }
            { path: '/overallRiskScore', order: 'descending' }
          ]
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
  }
}

// ─── bulk-portfolio-jobs ──────────────────────────────────────────────────────
// Stores BulkPortfolioJob records for both ORDER_CREATION and TAPE_EVALUATION
// modes.  For TAPE_EVALUATION jobs the items array contains ReviewTapeResult[].
// Partitioned by /tenantId for efficient per-tenant job history queries.

resource bulkPortfolioJobsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'bulk-portfolio-jobs'
  properties: {
    resource: {
      id: 'bulk-portfolio-jobs'
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
          { path: '/items/*' }
        ]
        compositeIndexes: [
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/submittedAt', order: 'descending' }
          ]
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
          ]
          [
            { path: '/clientId', order: 'ascending' }
            { path: '/submittedAt', order: 'descending' }
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

@description('Resource ID of the review-programs container.')
output reviewProgramsContainerId string = reviewProgramsContainer.id

@description('Resource ID of the review-results container.')
output reviewResultsContainerId string = reviewResultsContainer.id

@description('Resource ID of the bulk-portfolio-jobs container.')
output bulkPortfolioJobsContainerId string = bulkPortfolioJobsContainer.id
