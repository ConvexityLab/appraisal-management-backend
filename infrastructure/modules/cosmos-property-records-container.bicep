@description('Property aggregate root containers: property records and comparable sales (Phase R1)')
param cosmosAccountName string
param databaseName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ── property-records ──────────────────────────────────────────────────────────
// Stores PropertyRecord aggregate root documents.
// Partitioned by /tenantId to keep per-lender property data isolated.
resource propertyRecordsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'property-records'
  properties: {
    resource: {
      id: 'property-records'
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
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/address/zipCode', order: 'ascending' }
            { path: '/updatedAt', order: 'descending' }
          ]
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
        // Geospatial index — enables ST_DISTANCE / ST_WITHIN queries for map-based search.
        // Documents MUST store coordinates as GeoJSON:
        //   location: { type: 'Point', coordinates: [longitude, latitude] }
        // IMPORTANT: GeoJSON order is [longitude, latitude] — NOT [lat, lon].
        spatialIndexes: [
          {
            path: '/location/?'
            types: ['Point']
          }
        ]
      }
      defaultTtl: -1
    }
  }
}

// ── comparable-sales ──────────────────────────────────────────────────────────
// Stores PropertyComparableSale documents.
// Partitioned by /zipCode so comparable searches (by geography) are efficient
// single-partition queries.
resource comparableSalesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'comparable-sales'
  properties: {
    resource: {
      id: 'comparable-sales'
      partitionKey: {
        paths: ['/zipCode']
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
          [
            { path: '/zipCode', order: 'ascending' }
            { path: '/saleDate', order: 'descending' }
          ]
          [
            { path: '/zipCode', order: 'ascending' }
            { path: '/propertyType', order: 'ascending' }
            { path: '/saleDate', order: 'descending' }
          ]
        ]
        // Geospatial index — enables radius search for comparable selection (e.g. within 1 mile).
        // Documents MUST store coordinates as GeoJSON:
        //   location: { type: 'Point', coordinates: [longitude, latitude] }
        spatialIndexes: [
          {
            path: '/location/?'
            types: ['Point']
          }
        ]
      }
      defaultTtl: -1
    }
  }
}

output propertyRecordsContainerName string = propertyRecordsContainer.name
output comparableSalesContainerName string = comparableSalesContainer.name
