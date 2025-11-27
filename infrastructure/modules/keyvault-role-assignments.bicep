// Key Vault Role Assignments Module
// Assigns Key Vault Secrets User role to container apps

param keyVaultName string
param containerAppPrincipalIds array

// Reference existing Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Key Vault Secrets User role assignments for container apps
resource keyVaultSecretsUserRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  name: guid(keyVault.id, principalId, '4633458b-17de-408a-b874-0445c86b69e6')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows container app ${i} to read secrets from Key Vault'
  }
}]

output roleAssignmentsCount int = length(containerAppPrincipalIds)
