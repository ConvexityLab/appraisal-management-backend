@description('Documents container for appraisal management document uploads')
param cosmosAccountName string
param databaseName string
param location string = resourceGroup().location

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

resource documentsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'documents'
  properties: {
    resource: {
      id: 'documents'
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
            { path: '/uploadedAt', order: 'descending' }
          ]
          [
            { path: '/orderId', order: 'ascending' }
            { path: '/uploadedAt', order: 'descending' }
          ]
          [
            { path: '/category', order: 'ascending' }
            { path: '/uploadedAt', order: 'descending' }
          ]
        ]
      }
    }
  }
}

output containerId string = documentsContainer.properties.resource.id
