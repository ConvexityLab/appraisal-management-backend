// Blob Intake Storage Role Assignments
//
// Two sets of grants:
//   1. Container App MIs → Storage Blob Data Reader (account scope)
//      The appraisal-api BlobSyncWorkerService must enumerate blobs and download
//      content from any path inside the intake account.
//
//   2. External client service principals → Storage Blob Data Contributor
//      scoped to the `received` container only. Clients can write (upload) blobs
//      and delete their own; they cannot touch any other container on this account.
//      Add each external client's managed identity / service principal objectId to
//      the externalClientPrincipalIds parameter in staging/prod parameters files.

@description('Name of the blob intake storage account')
param intakeStorageAccountName string

@description('Principal IDs of the Container App managed identities that need to read blobs from the intake account.')
param containerAppPrincipalIds array

@description('Principal IDs of external vendor clients that should be allowed to write to the `received` container. Empty by default — add entries per environment.')
param externalClientPrincipalIds array = []

@description('Optional: Developer user principal IDs for local integration testing (principalType=User)')
param developerPrincipalIds array = []

// ─── Existing resources ───────────────────────────────────────────────────────
resource intakeStorageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' existing = {
  name: intakeStorageAccountName
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' existing = {
  parent: intakeStorageAccount
  name: 'default'
}

resource receivedContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' existing = {
  parent: blobService
  name: 'received'
}

// ─── Container App MIs: Storage Blob Data Reader (account scope) ──────────────
// Reader is sufficient — the worker only enumerates and downloads blobs.
resource readerRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  // Deterministic guid: account id + principal + Reader role definition id
  name: guid(intakeStorageAccount.id, principalId, '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1')
  scope: intakeStorageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1') // Storage Blob Data Reader
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows appraisal-api Container App to read blobs from the blob intake account for BlobSyncWorkerService processing.'
  }
}]

// ─── External client principals: Storage Blob Data Contributor (container scope) ─
// Scoped to `received` only — external clients cannot access other containers.
resource externalClientContributorRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in externalClientPrincipalIds: if (!empty(externalClientPrincipalIds)) {
  name: guid(receivedContainer.id, principalId, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  scope: receivedContainer
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows external vendor client ${i} to write blobs to the received container.'
  }
}]

// ─── Developer principals: Storage Blob Data Contributor (received container scope) ─
// Allows developer identities to upload blobs for integration testing.
resource developerContributorRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in developerPrincipalIds: if (!empty(developerPrincipalIds)) {
  name: guid(receivedContainer.id, principalId, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe-developer')
  scope: receivedContainer
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // Storage Blob Data Contributor
    principalId: principalId
    principalType: 'User'
    description: 'Allows developer ${i} to write blobs to the received container for integration testing.'
  }
}]

output readerAssignmentsCount int = length(containerAppPrincipalIds)
output externalContributorAssignmentsCount int = length(externalClientPrincipalIds)
