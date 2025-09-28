// Data Services Module - Storage and analytics services only
// Cosmos DB is handled by the dedicated cosmos-production.bicep module

param location string
param environment string
param suffix string
param tags object

// Variables - Removed SQL Server and Cosmos DB (handled separately)
var primaryStorageAccountName = 'stappraisal${environment}${take(suffix, 8)}'
var dataLakeStorageName = 'stadlappraisal${environment}${take(suffix, 8)}'
var redisName = 'redis-appraisal-${environment}-${suffix}'

// Primary Storage Account for general blob storage
resource primaryStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: primaryStorageAccountName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    dnsEndpointType: 'Standard'
    defaultToOAuthAuthentication: false
    publicNetworkAccess: 'Enabled'
    allowCrossTenantReplication: false
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    networkAcls: {
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
    encryption: {
      requireInfrastructureEncryption: true
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

// Blob services for primary storage
resource primaryStorageAccountBlobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: primaryStorageAccount
  name: 'default'
  properties: {
    changeFeed: {
      enabled: true
      retentionInDays: 7
    }
    restorePolicy: {
      enabled: true
      days: 6
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    isVersioningEnabled: true
  }
}

// Storage containers
resource documentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: primaryStorageAccountBlobServices
  name: 'documents'
  properties: {
    publicAccess: 'None'
  }
}

resource imagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: primaryStorageAccountBlobServices
  name: 'images'
  properties: {
    publicAccess: 'None'
  }
}

resource reportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: primaryStorageAccountBlobServices
  name: 'reports'
  properties: {
    publicAccess: 'None'
  }
}

resource backupsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: primaryStorageAccountBlobServices
  name: 'backups'
  properties: {
    publicAccess: 'None'
  }
}

// Data Lake Storage Gen2 for analytics
resource dataLakeStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: dataLakeStorageName
  location: location  
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    dnsEndpointType: 'Standard'
    defaultToOAuthAuthentication: false
    publicNetworkAccess: 'Enabled'
    allowCrossTenantReplication: false
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    isHnsEnabled: true // Hierarchical namespace for Data Lake Gen2
    networkAcls: {
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
    encryption: {
      requireInfrastructureEncryption: true
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

// Data Lake blob services
resource dataLakeBlobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: dataLakeStorage
  name: 'default'
  properties: {
    changeFeed: {
      enabled: true
      retentionInDays: 30
    }
    isVersioningEnabled: true
  }
}

// Data Lake containers
resource rawDataContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: dataLakeBlobServices
  name: 'raw-data'
  properties: {
    publicAccess: 'None'
  }
}

resource processedDataContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: dataLakeBlobServices
  name: 'processed-data'
  properties: {
    publicAccess: 'None'
  }
}

resource analyticsDataContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: dataLakeBlobServices
  name: 'analytics-data'
  properties: {
    publicAccess: 'None'
  }
}

// Note: Database services moved to dedicated cosmos-production.bicep module
// This module now focuses on storage and caching services only

// Azure Cache for Redis
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: redisName
  location: location
  tags: tags
  properties: {
    sku: {
      name: environment == 'prod' ? 'Premium' : 'Standard'
      family: environment == 'prod' ? 'P' : 'C'
      capacity: environment == 'prod' ? 1 : 1
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    redisConfiguration: {
      'maxmemory-reserved': environment == 'prod' ? '200' : '50'
      'maxfragmentationmemory-reserved': environment == 'prod' ? '200' : '50'
      'maxmemory-delta': environment == 'prod' ? '200' : '50'
    }
    redisVersion: '6'
  }
}

// Note: Synapse Analytics removed - analytics can be handled through Cosmos DB analytical store

// Outputs - Storage and cache services only
output primaryStorageAccountName string = primaryStorageAccount.name
output primaryStorageAccountId string = primaryStorageAccount.id
output dataLakeStorageName string = dataLakeStorage.name
output dataLakeStorageId string = dataLakeStorage.id
output redisCacheName string = redisCache.name
output redisCacheId string = redisCache.id
output redisCacheHostName string = redisCache.properties.hostName
