@description('Construction finance containers: construction-loans, draws, contractors')
param cosmosAccountName string
param databaseName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ── construction-loans ────────────────────────────────────────────────────────
// Stores ConstructionLoan documents (partitioned by tenantId).
// Also stores TenantConstructionConfig documents (id: config-{tenantId}).
resource constructionLoansContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'construction-loans'
  properties: {
    resource: {
      id: 'construction-loans'
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
          // List loans by tenant + status filter
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // List loans by tenant + loanType filter
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/loanType', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          // List all loans for a tenant ordered by creation
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
      defaultTtl: -1
    }
  }
}

// ── draws ─────────────────────────────────────────────────────────────────────
// Stores DrawRequest documents (partitioned by constructionLoanId).
resource drawsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'draws'
  properties: {
    resource: {
      id: 'draws'
      partitionKey: {
        paths: ['/constructionLoanId']
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
          { path: '/lineItems/?' }
        ]
        compositeIndexes: [
          // List draws for a loan ordered by draw number (primary access pattern)
          [
            { path: '/constructionLoanId', order: 'ascending' }
            { path: '/drawNumber', order: 'ascending' }
          ]
          // Filter draws for a loan by status
          [
            { path: '/constructionLoanId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/drawNumber', order: 'ascending' }
          ]
          // Cross-partition query: tenant + status (for reporting)
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/status', order: 'ascending' }
            { path: '/submittedAt', order: 'descending' }
          ]
        ]
      }
      defaultTtl: -1
    }
  }
}

// ── contractors ───────────────────────────────────────────────────────────────
// Stores Contractor documents (partitioned by tenantId).
resource contractorsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'contractors'
  properties: {
    resource: {
      id: 'contractors'
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
          // List contractors for a tenant ordered by name
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/name', order: 'ascending' }
          ]
          // Filter contractors by risk tier
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/riskTier', order: 'ascending' }
            { path: '/name', order: 'ascending' }
          ]
          // Filter by verification status
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/licenseVerificationStatus', order: 'ascending' }
            { path: '/name', order: 'ascending' }
          ]
        ]
      }
      defaultTtl: -1
    }
  }
}

// ── construction-cost-catalog ─────────────────────────────────────────────────
// RSMeans-style CSI MasterFormat unit-cost items partitioned by CSI division code.
// Used for AI budget-reasonability analysis and feasibility reviews.
resource constructionCostCatalogContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'construction-cost-catalog'
  properties: {
    resource: {
      id: 'construction-cost-catalog'
      partitionKey: {
        paths: ['/division']
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
          // Browse catalog items by division + section
          [
            { path: '/division', order: 'ascending' }
            { path: '/sectionCode', order: 'ascending' }
          ]
          // Filter by division and total cost
          [
            { path: '/division', order: 'ascending' }
            { path: '/totalCost', order: 'descending' }
          ]
        ]
      }
      defaultTtl: -1
    }
  }
}

output constructionLoansContainerId string = constructionLoansContainer.properties.resource.id
output drawsContainerId string = drawsContainer.properties.resource.id
output contractorsContainerId string = contractorsContainer.properties.resource.id
output constructionCostCatalogContainerId string = constructionCostCatalogContainer.properties.resource.id
