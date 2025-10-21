// Cosmos DB Module
// Deploys Cosmos DB account with containers for the appraisal management platform

@description('The Azure region for deployment')
param location string

@description('Naming prefix for resources')
param namingPrefix string

@description('Environment name')
param environment string

@description('Tags to apply to resources')
param tags object

// Environment-specific configurations
var cosmosConfigs = {
  dev: {
    tier: 'serverless'
    locations: [location]
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    defaultConsistencyLevel: 'Session'
  }
  staging: {
    tier: 'provisioned'
    throughput: 400
    locations: [location]
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
    defaultConsistencyLevel: 'Session'
  }
  prod: {
    tier: 'provisioned'
    throughput: 1000
    locations: [location, 'westus2']
    enableAutomaticFailover: true
    enableMultipleWriteLocations: false
    defaultConsistencyLevel: 'Session'
  }
}

var config = cosmosConfigs[environment]

// Cosmos DB Account
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: '${namingPrefix}-cosmos'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: config.defaultConsistencyLevel
    }
    locations: [for (loc, i) in config.locations: {
      locationName: loc
      failoverPriority: i
      isZoneRedundant: false
    }]
    enableAutomaticFailover: config.enableAutomaticFailover
    enableMultipleWriteLocations: config.enableMultipleWriteLocations
    capabilities: config.tier == 'serverless' ? [
      {
        name: 'EnableServerless'
      }
    ] : []
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 8
        backupStorageRedundancy: environment == 'prod' ? 'Geo' : 'Local'
      }
    }
    networkAclBypass: 'AzureServices'
    publicNetworkAccess: 'Enabled'
    disableKeyBasedMetadataWriteAccess: false
  }
}

// Cosmos DB Database
resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' = {
  parent: cosmosAccount
  name: 'appraisal-management'
  properties: config.tier == 'serverless' ? {
    resource: {
      id: 'appraisal-management'
    }
  } : {
    resource: {
      id: 'appraisal-management'
    }
    options: {
      throughput: config.throughput
    }
  }
}

// Orders Container
resource ordersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDatabase
  name: 'orders'
  properties: {
    resource: {
      id: 'orders'
      partitionKey: {
        paths: ['/clientId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: [
          {
            paths: ['/orderId']
          }
        ]
      }
    }
  }
}

// Properties Container
resource propertiesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDatabase
  name: 'properties'
  properties: {
    resource: {
      id: 'properties'
      partitionKey: {
        paths: ['/address/zipCode']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
        spatialIndexes: [
          {
            path: '/location/*'
            types: ['Point', 'Polygon']
          }
        ]
      }
    }
  }
}

// Vendors Container
resource vendorsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDatabase
  name: 'vendors'
  properties: {
    resource: {
      id: 'vendors'
      partitionKey: {
        paths: ['/businessInfo/primaryServiceArea']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
      }
    }
  }
}

// Users Container
resource usersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDatabase
  name: 'users'
  properties: {
    resource: {
      id: 'users'
      partitionKey: {
        paths: ['/organizationId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/password/?'
          }
          {
            path: '/refreshTokens/*'
          }
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: [
          {
            paths: ['/email']
          }
        ]
      }
    }
  }
}

// Events Container (for audit trails and event sourcing)
resource eventsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDatabase
  name: 'events'
  properties: {
    resource: {
      id: 'events'
      partitionKey: {
        paths: ['/aggregateId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        includedPaths: [
          {
            path: '/*'
          }
        ]
      }
      defaultTtl: environment == 'dev' ? 2592000 : -1 // 30 days TTL for dev, no TTL for staging/prod
    }
  }
}

// Outputs
output accountName string = cosmosAccount.name
output accountId string = cosmosAccount.id
output endpoint string = cosmosAccount.properties.documentEndpoint
output databaseName string = cosmosDatabase.name
output containerNames array = [
  ordersContainer.name
  propertiesContainer.name
  vendorsContainer.name
  usersContainer.name
  eventsContainer.name
]
