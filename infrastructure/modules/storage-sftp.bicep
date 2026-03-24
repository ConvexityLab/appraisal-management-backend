// SFTP Storage Module — Statebridge Integration
// Deploys a dedicated Azure Data Lake Storage Gen2 (HNS) account with SFTP enabled.
// HNS is required for SFTP support and CANNOT be added to the existing storage account.
// Statebridge authenticates with a password-based local user.
//
// Inbound:  Statebridge uploads daily order files  → uploads/ container
// Outbound: We write results + PDFs               → results/ container
//
// After deployment, run once to generate the SFTP password and save it to Key Vault:
//   az storage account local-user regenerate-password \
//     --account-name <storageAccountName> --name statebridge \
//     --resource-group <rg> --query sshPassword -o tsv

@description('Azure region')
param location string

@description('Environment name (dev, staging, prod)')
param environment string

@description('Tags to apply to resources')
param tags object

// SFTP SKU: ZRS for staging, GRS for prod, LRS for dev
var sftpSku = environment == 'prod' ? 'Standard_GRS' : environment == 'staging' ? 'Standard_ZRS' : 'Standard_LRS'

// Name: must be 3-24 chars, lowercase alphanumeric.
// 'apprsftp' (8) + take(env,3) (3) + take(unique,6) (6) = 17 chars
var sftpStorageAccountName = 'apprsftp${take(environment, 3)}${take(uniqueString(resourceGroup().id, 'sftp'), 6)}'

// ─── Storage Account ──────────────────────────────────────────────────────────
resource sftpStorageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  name: sftpStorageAccountName
  location: location
  tags: tags
  sku: {
    name: sftpSku
  }
  kind: 'StorageV2'
  properties: {
    // HNS (Data Lake Gen2) is required for SFTP
    isHnsEnabled: true
    // SFTP requires shared key access to be enabled for local user auth
    allowSharedKeyAccess: true
    isSftpEnabled: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowCrossTenantReplication: false
    supportsHttpsTrafficOnly: true
    dnsEndpointType: 'Standard'
    defaultToOAuthAuthentication: false
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
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
// Minimal properties only — HNS/ADLS Gen2 accounts do not support:
//   • changeFeed (removed above)
//   • deleteRetentionPolicy (blob soft delete)
//   • containerDeleteRetentionPolicy (container soft delete)
//   • isVersioningEnabled (blob versioning)
// Setting any of these causes the storage stamp to return HTTP 400.
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' = {
  parent: sftpStorageAccount
  name: 'default'
}

// ─── Containers ───────────────────────────────────────────────────────────────

// Inbound: Statebridge uploads daily pipe-delimited order files here
resource uploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'uploads'
  // NOTE: publicAccess is not supported on HNS/ADLS Gen2 containers.
  // Access is governed by the account-level allowBlobPublicAccess: false setting.
}

// Outbound: We write tab-delimited results + PDFs here for Statebridge to retrieve
resource resultsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'results'
  // NOTE: publicAccess is not supported on HNS/ADLS Gen2 containers.
  // Access is governed by the account-level allowBlobPublicAccess: false setting.
}

// ─── SFTP Local User ──────────────────────────────────────────────────────────
// Password is NOT settable via ARM; after deployment run:
//   az storage account local-user regenerate-password \
//     --account-name <name> --name statebridge --resource-group <rg>
// Store the returned sshPassword in Key Vault under secret 'sftp-statebridge-password'.
resource statebridgeLocalUser 'Microsoft.Storage/storageAccounts/localUsers@2023-04-01' = {
  parent: sftpStorageAccount
  name: 'statebridge'
  properties: {
    // hasSshPassword is a READ-ONLY flag set by the storage service after
    // `az storage account local-user regenerate-password` is called.
    // Setting it to true here causes HTTP 400 because the storage service
    // will not accept it via PUT before a password has been provisioned.
    hasSshKey: false
    hasSharedKey: false
    homeDirectory: 'uploads'
    permissionScopes: [
      {
        // Statebridge uploads order files: create + write + list + read (to verify uploads)
        permissions: 'rcwl'
        service: 'blob'
        resourceName: 'uploads'
      }
      {
        // Statebridge reads back results + PDFs: read + list only
        permissions: 'rl'
        service: 'blob'
        resourceName: 'results'
      }
    ]
  }
  dependsOn: [
    uploadsContainer
    resultsContainer
  ]
}

// ─── Outputs ──────────────────────────────────────────────────────────────────
@description('Name of the SFTP storage account — pass to app-services as SFTP_STORAGE_ACCOUNT_NAME')
output sftpStorageAccountName string = sftpStorageAccount.name

@description('Resource ID of the SFTP storage account — used by Event Grid system topic')
output sftpStorageAccountId string = sftpStorageAccount.id

@description('SFTP endpoint — share with Statebridge: <storageAccountName>.blob.core.windows.net')
output sftpEndpoint string = '${sftpStorageAccount.name}.blob.core.windows.net'

@description('SFTP connection target for clients: <storageAccountName>.blob.core.windows.net')
output sftpConnectionTarget string = sftpStorageAccount.properties.primaryEndpoints.blob

@description('Upload container name')
output uploadsContainerName string = uploadsContainer.name

@description('Results container name')
output resultsContainerName string = resultsContainer.name
