// Storage Role Assignments Module
// Assigns Storage Blob Data Contributor role to container apps

@description('Storage account name')
param storageAccountName string

@description('Principal IDs of container apps that need storage access')
param containerAppPrincipalIds array

// Reference existing storage account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' existing = {
  name: storageAccountName
}

// Assign Storage Blob Data Contributor role to each container app
resource storageRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  name: guid(storageAccount.id, principalId, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows container app ${i} to read/write/delete blobs in storage account'
  }
}]

output roleAssignmentsCount int = length(containerAppPrincipalIds)
