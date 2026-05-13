// Blob Intake Storage Account
// Dedicated StorageV2 account used as the shared blob-drop zone for external vendor clients.
// Clients are granted Storage Blob Data Contributor on the `received` container (see
// storage-blob-intake-role-assignments.bicep). The appraisal-api Container App reads from
// this account via Managed Identity (Storage Blob Data Reader at account scope).
//
// Event Grid wiring (BlobCreated → blob-sync-events Service Bus queue) is handled in
// main.bicep via a conditional blob-sync-integration module — staging and prod only.
// dev uses the Basic Service Bus tier which cannot receive Event Grid deliveries.

@description('Azure region')
param location string

@description('Environment name (dev, staging, prod)')
param environment string

@description('Tags to apply to resources')
param tags object

// SKU: ZRS for staging (zone redundancy), GRS for prod (geo redundancy), LRS for dev.
var intakeSku = environment == 'prod' ? 'Standard_GRS' : environment == 'staging' ? 'Standard_ZRS' : 'Standard_LRS'

// Name: must be 3-24 chars, lowercase alphanumeric only. 'apprblin' (8) + take(env,3) (3) + take(unique,6) (6) = 17.
var intakeStorageAccountName = 'apprblin${take(environment, 3)}${take(uniqueString(resourceGroup().id, 'blin'), 6)}'

var softDeleteRetentionDays = environment == 'prod' ? 30 : environment == 'staging' ? 14 : 7

// ─── Storage Account ──────────────────────────────────────────────────────────
resource intakeStorageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  name: intakeStorageAccountName
  location: location
  tags: tags
  sku: {
    name: intakeSku
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false           // Managed Identity only — no shared-key fallback
    allowCrossTenantReplication: false
    supportsHttpsTrafficOnly: true
    dnsEndpointType: 'Standard'
    // OAuth as default simplifies client SDK setup via DefaultAzureCredential
    defaultToOAuthAuthentication: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    encryption: {
      requireInfrastructureEncryption: environment == 'prod'
      services: {
        blob: {
          keyType: 'Account'
          enabled: true
        }
        file: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

// ─── Blob Service ─────────────────────────────────────────────────────────────
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' = {
  parent: intakeStorageAccount
  name: 'default'
  properties: {
    // Versioning lets us recover blobs overwritten or deleted by mistake.
    isVersioningEnabled: true
    deleteRetentionPolicy: {
      enabled: true
      days: softDeleteRetentionDays
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: softDeleteRetentionDays
    }
  }
}

// ─── received container ───────────────────────────────────────────────────────
// The drop-zone: external vendor clients write blobs here; the appraisal-api
// BlobSyncWorkerService reads and processes them.
resource receivedContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'received'
  properties: {
    publicAccess: 'None'
    metadata: {
      purpose: 'Vendor blob-drop intake zone — BlobCreated events route to blob-sync-events queue'
      environment: environment
    }
  }
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

@description('Resource ID of the blob intake storage account — use as vendorStorageAccountId in blobSyncClients.')
output storageAccountId string = intakeStorageAccount.id

@description('Name of the blob intake storage account — use as vendorStorageAccountName in blobSyncClients.')
output storageAccountName string = intakeStorageAccount.name
