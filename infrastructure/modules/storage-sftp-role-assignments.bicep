// SFTP Storage Role Assignments Module — Statebridge Integration
// Grants the functions Container App managed identity Blob Data Contributor
// on the SFTP storage account so it can:
//   - Read inbound order files from uploads/
//   - Write results files and PDFs to results/

@description('Name of the SFTP storage account')
param sftpStorageAccountName string

@description('Principal IDs of container apps that need SFTP storage access')
param containerAppPrincipalIds array

resource sftpStorageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' existing = {
  name: sftpStorageAccountName
}

// Storage Blob Data Contributor — read uploads/ and write results/
resource sftpBlobContributorRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  name: guid(sftpStorageAccount.id, principalId, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe', 'sftp')
  scope: sftpStorageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows functions container app to read uploads/ and write results/ on the SFTP storage account'
  }
}]

output roleAssignmentsCount int = length(containerAppPrincipalIds)
