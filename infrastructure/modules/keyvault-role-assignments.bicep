// Key Vault Role Assignments Module
// Assigns Key Vault Secrets Officer role to container apps (includes get AND list permissions)

param keyVaultName string
param containerAppPrincipalIds array

@description('Additional service principal object IDs that need Key Vault Secrets Officer (e.g. the CI/CD service principal).')
param additionalPrincipalIds array = []

// Reference existing Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Key Vault Secrets Officer role assignments for container apps
// This role allows: get, list, set, delete secrets (but not purge)
resource keyVaultSecretsOfficerRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  name: guid(keyVault.id, principalId, 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7') // Key Vault Secrets Officer
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows container app ${i} to get and list secrets from Key Vault'
  }
}]

// Key Vault Secrets Officer role assignments for additional principals (e.g. CI/CD service principal)
// The CI/CD SP needs setSecret to write the SFTP password after provisioning local users.
resource keyVaultSecretsOfficerAdditional 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in additionalPrincipalIds: if (!empty(additionalPrincipalIds)) {
  name: guid(keyVault.id, principalId, 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7', 'additional')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7') // Key Vault Secrets Officer
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Additional principal ${i}: Key Vault Secrets Officer (e.g. CI/CD SP for SFTP password management)'
  }
}]

output roleAssignmentsCount int = length(containerAppPrincipalIds) + length(additionalPrincipalIds)
