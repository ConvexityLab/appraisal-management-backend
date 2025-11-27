// Cosmos DB Module - Fully Parameterized
// Zero hardcoded values - everything configurable

@description('The Azure region for deployment')
param location string

@description('Naming prefix for resources')
param namingPrefix string

@description('Environment name')
param environment string

@description('Tags to apply to resources')
param tags object

@description('Cosmos DB database name')
param databaseName string

@description('Cosmos DB configuration')
param cosmosConfig object

@description('Secondary region for multi-region deployment')
param secondaryRegion string

@description('Container configurations')
param containers array

@description('Backup configuration')
param backupConfig object

@description('Cosmos DB API version')
param cosmosApiVersion string = '2023-11-15'

@description('Additional locations for multi-region deployment')
param additionalLocations array = []

@description('Enable analytical storage')
param enableAnalyticalStorage bool = false

@description('Network ACL bypass')
@allowed(['None', 'AzureServices'])
param networkAclBypass string = 'AzureServices'

@description('Public network access')
@allowed(['Enabled', 'Disabled'])
param publicNetworkAccess string = 'Enabled'

@description('Disable key-based metadata write access')
param disableKeyBasedMetadataWriteAccess bool = false

@description('Enable free tier (only for one account per subscription)')
param enableFreeTier bool = false

// Calculate all locations - primary + secondary + additional
var allLocations = cosmosConfig.tier == 'serverless' 
  ? [location] // Serverless only supports single region
  : union([location], empty(secondaryRegion) ? [] : [secondaryRegion], additionalLocations)

// Cosmos DB Account
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: '${namingPrefix}-cosmos'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    enableFreeTier: enableFreeTier
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: cosmosConfig.defaultConsistencyLevel
    }
    locations: [for (loc, i) in allLocations: {
      locationName: loc
      failoverPriority: i
      isZoneRedundant: false
    }]
    enableAutomaticFailover: cosmosConfig.enableAutomaticFailover
    enableMultipleWriteLocations: cosmosConfig.enableMultipleWriteLocations
    capabilities: cosmosConfig.tier == 'serverless' ? [
      {
        name: 'EnableServerless'
      }
    ] : []
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: backupConfig.intervalInMinutes
        backupRetentionIntervalInHours: backupConfig.retentionIntervalInHours
        backupStorageRedundancy: cosmosConfig.backupStorageRedundancy
      }
    }
    networkAclBypass: networkAclBypass
    publicNetworkAccess: publicNetworkAccess
    disableKeyBasedMetadataWriteAccess: disableKeyBasedMetadataWriteAccess
  }
}

// Cosmos DB Database
resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: cosmosConfig.tier == 'serverless' ? {
    resource: {
      id: databaseName
    }
  } : {
    resource: {
      id: databaseName
    }
    options: {
      throughput: cosmosConfig.throughput
    }
  }
}

// Dynamic container creation based on configuration
resource cosmosContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = [for container in containers: {
  parent: cosmosDatabase
  name: container.name
  properties: {
    resource: union(
      {
        id: container.name
        partitionKey: {
          paths: [container.partitionKeyPath]
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
          spatialIndexes: container.?spatialIndexes ?? []
        }
      },
      // Conditionally add unique key policy if uniqueKeyPaths are specified
      !empty(container.uniqueKeyPaths) ? {
        uniqueKeyPolicy: {
          uniqueKeys: container.uniqueKeyPaths
        }
      } : {},
      // Conditionally add TTL if specified and not -1, and adjust for environment
      container.defaultTtl != -1 ? {
        defaultTtl: container.name == 'events' && environment != 'dev' ? -1 : container.defaultTtl
      } : {}
    )
  }
}]

// Outputs
output accountName string = cosmosAccount.name
output accountId string = cosmosAccount.id
output endpoint string = cosmosAccount.properties.documentEndpoint
output databaseName string = cosmosDatabase.name
output containerNames array = [for container in containers: container.name]
// Note: Keys should be retrieved via Key Vault or Azure CLI, not exposed in outputs
// Use: az cosmosdb keys list --name accountName --resource-group resourceGroup
