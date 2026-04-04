@description('Property data cache container — persistent cache for all third-party property data (ATTOM, Bridge, etc.)')
param cosmosAccountName string
param databaseName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

// ── property-data-cache ───────────────────────────────────────────────────────
// Stores cached property records sourced from any third-party provider
// (ATTOM CSV import, live ATTOM API, Bridge Interactive, etc.).
//
// Partition key: /attomId (string) — the ATTOM integer ID, stored as string.
// This is the most selective key: every lookup by address resolves to an attomId
// first, then all subsequent API calls (assessment, sales history) are point-reads.
//
// Secondary indexes cover the common lookup patterns:
//   - address normalisation (zip + streetNumber + streetName)
//   - APN (assessor parcel number) lookups
//   - freshness queries (cachedAt for TTL-based re-fetch decisions)
resource propertyDataCacheContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'property-data-cache'
  properties: {
    resource: {
      id: 'property-data-cache'
      partitionKey: {
        paths: ['/attomId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        // Exclude the large raw payload from the index — it is only accessed
        // via point-read after we resolve attomId. Excluding it saves ~30–40%
        // of index storage / RU cost on writes for 500k+ documents.
        excludedPaths: [
          { path: '/"_etag"/?' }
          { path: '/rawData/*' }
        ]
        compositeIndexes: [
          // Address lookup: zip + normalised street number + street name
          [
            { path: '/address/zip', order: 'ascending' }
            { path: '/address/houseNumber', order: 'ascending' }
            { path: '/address/streetName', order: 'ascending' }
          ]
          // APN lookup within a county
          [
            { path: '/apnFormatted', order: 'ascending' }
            { path: '/address/state', order: 'ascending' }
          ]
          // Freshness: find oldest records per state for batch re-fetch jobs
          [
            { path: '/address/state', order: 'ascending' }
            { path: '/cachedAt', order: 'ascending' }
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

output containerName string = propertyDataCacheContainer.name
