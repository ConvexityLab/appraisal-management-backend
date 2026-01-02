// Vendor Marketplace Cosmos DB Containers - Phase 1
// Adds containers for vendor performance tracking, availability, and bidding

param cosmosAccountName string
param databaseName string = 'appraisal-management'
param location string = resourceGroup().location

@description('Tags to apply to resources')
param tags object = {}

// Reference existing Cosmos DB account
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: cosmosAccountName
}

// Reference existing database
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ========================================
// VENDOR PERFORMANCE METRICS CONTAINER
// ========================================
resource vendorPerformanceMetricsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'vendor-performance-metrics'
  properties: {
    resource: {
      id: 'vendor-performance-metrics'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      indexingPolicy: {
        automatic: true
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/_etag/?'
          }
        ]
        compositeIndexes: [
          // Leaderboard queries (top performers by score)
          [
            {
              path: '/tenantId'
              order: 'ascending'
            }
            {
              path: '/overallScore'
              order: 'descending'
            }
          ]
          // Tier-based queries
          [
            {
              path: '/tenantId'
              order: 'ascending'
            }
            {
              path: '/tier'
              order: 'ascending'
            }
            {
              path: '/overallScore'
              order: 'descending'
            }
          ]
          // Time-series queries (performance history)
          [
            {
              path: '/vendorId'
              order: 'ascending'
            }
            {
              path: '/calculatedAt'
              order: 'descending'
            }
          ]
          // Property type specialization searches
          [
            {
              path: '/tenantId'
              order: 'ascending'
            }
            {
              path: '/propertyTypeExpertise'
              order: 'ascending'
            }
            {
              path: '/overallScore'
              order: 'descending'
            }
          ]
        ]
      }
      defaultTtl: -1 // No automatic expiration
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
  }
  tags: tags
}

// ========================================
// VENDOR AVAILABILITY CONTAINER
// ========================================
resource vendorAvailabilityContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'vendor-availability'
  properties: {
    resource: {
      id: 'vendor-availability'
      partitionKey: {
        paths: ['/vendorId']
        kind: 'Hash'
      }
      indexingPolicy: {
        automatic: true
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/_etag/?'
          }
        ]
        compositeIndexes: [
          // Available vendors search (by capacity and region)
          [
            {
              path: '/tenantId'
              order: 'ascending'
            }
            {
              path: '/currentLoad'
              order: 'ascending'
            }
            {
              path: '/maxCapacity'
              order: 'descending'
            }
          ]
          // Geographic availability queries
          [
            {
              path: '/tenantId'
              order: 'ascending'
            }
            {
              path: '/serviceableStates'
              order: 'ascending'
            }
            {
              path: '/isAcceptingOrders'
              order: 'descending'
            }
          ]
          // Time-based availability (scheduling)
          [
            {
              path: '/vendorId'
              order: 'ascending'
            }
            {
              path: '/nextAvailableDate'
              order: 'ascending'
            }
          ]
        ]
      }
      defaultTtl: -1 // No automatic expiration
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
  }
  tags: tags
}

// ========================================
// VENDOR BIDS CONTAINER
// ========================================
resource vendorBidsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: 'vendor-bids'
  properties: {
    resource: {
      id: 'vendor-bids'
      partitionKey: {
        paths: ['/orderId']
        kind: 'Hash'
      }
      indexingPolicy: {
        automatic: true
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/_etag/?'
          }
        ]
        compositeIndexes: [
          // Vendor-specific bid history
          [
            {
              path: '/vendorId'
              order: 'ascending'
            }
            {
              path: '/submittedAt'
              order: 'descending'
            }
          ]
          // Order-specific bid management
          [
            {
              path: '/orderId'
              order: 'ascending'
            }
            {
              path: '/matchScore'
              order: 'descending'
            }
          ]
          // Pending bids requiring action
          [
            {
              path: '/vendorId'
              order: 'ascending'
            }
            {
              path: '/status'
              order: 'ascending'
            }
            {
              path: '/expiresAt'
              order: 'ascending'
            }
          ]
          // Client order review (all bids for an order)
          [
            {
              path: '/orderId'
              order: 'ascending'
            }
            {
              path: '/proposedFee'
              order: 'ascending'
            }
          ]
        ]
      }
      defaultTtl: 7776000 // 90 days TTL - bids expire after negotiation
      uniqueKeyPolicy: {
        uniqueKeys: []
      }
    }
  }
  tags: tags
}

// ========================================
// OUTPUTS
// ========================================
output vendorPerformanceMetricsContainerId string = vendorPerformanceMetricsContainer.id
output vendorAvailabilityContainerId string = vendorAvailabilityContainer.id
output vendorBidsContainerId string = vendorBidsContainer.id
output containerNames array = [
  'vendor-performance-metrics'
  'vendor-availability'
  'vendor-bids'
]
