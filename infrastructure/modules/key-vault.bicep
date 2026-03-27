// Key Vault Module
// Deploys Azure Key Vault with access policies for the App Service

@description('The Azure region for deployment')
param location string

@description('Naming prefix for resources')
param namingPrefix string

@description('Environment name')
param environment string

@description('Tags to apply to resources')
param tags object

@description('Log Analytics workspace ID for diagnostic settings')
param logAnalyticsWorkspaceId string = ''

// Generate a valid Key Vault name (3-24 alphanumeric characters, start with letter)
// Use stable seed (namingPrefix + environment + location) so name stays same across deployments
var cleanPrefix = replace(replace(replace(namingPrefix, '-', ''), 'appraisal', 'appr'), 'mgmt', 'm')
var uniqueSuffix = uniqueString(namingPrefix, environment, location)
var keyVaultName = 'kv${take(cleanPrefix, 8)}${take(environment, 3)}${take(uniqueSuffix, 6)}'

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenant().tenantId
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: environment == 'prod' ? 90 : 7
    enablePurgeProtection: true
    // Use Azure RBAC for secrets access — managed by keyvault-role-assignments.bicep.
    // Access policies are not used; this prevents deployments from inadvertently
    // wiping manually-added developer policies.
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Diagnostic settings for Key Vault (only if Log Analytics workspace is provided)
resource keyVaultDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (!empty(logAnalyticsWorkspaceId)) {
  scope: keyVault
  name: 'default'
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

// Outputs
output keyVaultName string = keyVault.name
output keyVaultId string = keyVault.id
output keyVaultUri string = keyVault.properties.vaultUri
