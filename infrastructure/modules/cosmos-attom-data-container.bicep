@description('ATTOM data container — geohash-partitioned property records for efficient spatial comparable search.')
param cosmosAccountName string
param databaseName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ── attom-data ──────────────────────────────────────────────────────────────
// Stores ATTOM property records partitioned by geohash precision-5.
//
// Partition key: /geohash5 (string) — geohash precision-5 (~4.9km × 4.9km cell).
// Each property is assigned to the geohash cell containing its lat/lon.
// Comp search queries target at most 9 partitions (center cell + 8 neighbors),
// avoiding expensive cross-partition fan-out.
//
// Document id: attomId (string) — enables cross-partition point-read by ATTOM ID
// when the geohash is unknown (rare path, ~5–15 RU).
//
// Composite indexes cover the common comp search patterns:
//   - property type + sale recency within geohash
//   - bedrooms + sqft within geohash
//   - sale recency within geohash (most common query)
//   - state + zip for admin/reporting queries
resource attomDataContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'attom-data'
  properties: {
    resource: {
      id: 'attom-data'
      partitionKey: {
        paths: ['/geohash5']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        // Exclude the large raw payload from the index — it is only accessed
        // after search results are returned. Excluding it saves significant
        // index storage and RU cost on writes for large datasets.
        excludedPaths: [
          { path: '/"_etag"/?' }
          { path: '/rawData/*' }
        ]
        compositeIndexes: [
          // Comp search: filter by property type within geohash, sorted by sale recency
          [
            { path: '/geohash5', order: 'ascending' }
            { path: '/propertyDetail/attomPropertyType', order: 'ascending' }
            { path: '/salesHistory/lastSaleDate', order: 'descending' }
          ]
          // Comp search: filter by bedroom count + sqft range within geohash
          [
            { path: '/geohash5', order: 'ascending' }
            { path: '/propertyDetail/bedroomsTotal', order: 'ascending' }
            { path: '/propertyDetail/livingAreaSqft', order: 'ascending' }
          ]
          // Comp search: geohash partition scan sorted by sale recency (most common)
          [
            { path: '/geohash5', order: 'ascending' }
            { path: '/salesHistory/lastSaleDate', order: 'descending' }
          ]
          // Admin/reporting: cross-partition lookup by state + zip
          [
            { path: '/address/state', order: 'ascending' }
            { path: '/address/zip', order: 'ascending' }
          ]
        ]
        // Geospatial index — enables ST_DISTANCE / ST_WITHIN queries.
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
      defaultTtl: -1  // No automatic expiry — staleness is managed in application code
    }
  }
}

output containerName string = attomDataContainer.name
