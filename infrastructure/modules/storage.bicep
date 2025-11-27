// Storage Module
// Deploys Azure Storage Account for documents and file storage

@description('The Azure region for deployment')
param location string

@description('Naming prefix for resources')
param namingPrefix string

@description('Environment name')
param environment string

@description('Tags to apply to resources')
param tags object

// Environment-specific configurations
var storageConfigs = {
  dev: {
    sku: 'Standard_LRS'
    tier: 'Standard'
    deleteRetentionDays: 7
  }
  staging: {
    sku: 'Standard_ZRS'
    tier: 'Standard'
    deleteRetentionDays: 30
  }
  prod: {
    sku: 'Standard_GRS'
    tier: 'Standard'
    deleteRetentionDays: 90
  }
}

var config = storageConfigs[environment]

// Storage Account (must be 3-24 chars, lowercase letters and numbers only)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  name: 'appr${environment}${take(uniqueString(resourceGroup().id), 6)}st'
  location: location
  tags: tags
  sku: {
    name: config.sku
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
      requireInfrastructureEncryption: environment == 'prod'
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

// Blob Service
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    changeFeed: {
      enabled: environment == 'prod'
      retentionInDays: environment == 'prod' ? 7 : null
    }
    restorePolicy: {
      enabled: environment == 'prod'
      days: environment == 'prod' ? 6 : null
    }
    deleteRetentionPolicy: {
      enabled: true
      days: config.deleteRetentionDays
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: config.deleteRetentionDays
    }
    isVersioningEnabled: environment == 'prod'
  }
}

// Appraisal Documents Container
resource documentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'appraisal-documents'
  properties: {
    publicAccess: 'None'
    metadata: {
      purpose: 'Appraisal documents and reports'
      environment: environment
    }
  }
}

// Property Images Container
resource imagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'property-images'
  properties: {
    publicAccess: 'None'
    metadata: {
      purpose: 'Property photos and images'
      environment: environment
    }
  }
}

// Vendor Credentials Container
resource credentialsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'vendor-credentials'
  properties: {
    publicAccess: 'None'
    metadata: {
      purpose: 'Vendor certifications and credentials'
      environment: environment
    }
  }
}

// Templates Container
resource templatesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'templates'
  properties: {
    publicAccess: 'None'
    metadata: {
      purpose: 'Document templates and forms'
      environment: environment
    }
  }
}

// Archive Container (for long-term retention)
resource archiveContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'archive'
  properties: {
    publicAccess: 'None'
    metadata: {
      purpose: 'Archived documents and long-term storage'
      environment: environment
    }
  }
}

// File Service for shared file storage
resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-04-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    shareDeleteRetentionPolicy: {
      enabled: true
      days: config.deleteRetentionDays
    }
  }
}

// Shared File Share for collaborative work
resource sharedFileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-04-01' = {
  parent: fileService
  name: 'shared-workspace'
  properties: {
    shareQuota: environment == 'prod' ? 1024 : 100
    metadata: {
      purpose: 'Shared workspace for collaborative document editing'
      environment: environment
    }
  }
}

// Table Service for simple structured data
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-04-01' = {
  parent: storageAccount
  name: 'default'
}

// Session Storage Table
resource sessionTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-04-01' = {
  parent: tableService
  name: 'sessions'
}

// Audit Log Table
resource auditTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-04-01' = {
  parent: tableService
  name: 'auditlogs'
}

// Queue Service for async processing
resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-04-01' = {
  parent: storageAccount
  name: 'default'
}

// Document Processing Queue
resource documentProcessingQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-04-01' = {
  parent: queueService
  name: 'document-processing'
  properties: {
    metadata: {
      purpose: 'Queue for document processing tasks'
      environment: environment
    }
  }
}

// Image Resize Queue
resource imageResizeQueue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-04-01' = {
  parent: queueService
  name: 'image-resize'
  properties: {
    metadata: {
      purpose: 'Queue for image resizing and optimization'
      environment: environment
    }
  }
}

// Outputs
output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output primaryEndpoints object = storageAccount.properties.primaryEndpoints
output containerNames array = [
  documentsContainer.name
  imagesContainer.name
  credentialsContainer.name
  templatesContainer.name
  archiveContainer.name
]
output fileShareNames array = [
  sharedFileShare.name
]
output tableNames array = [
  sessionTable.name
  auditTable.name
]
output queueNames array = [
  documentProcessingQueue.name
  imageResizeQueue.name
]
