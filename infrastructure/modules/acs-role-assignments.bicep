// ACS Role Assignments Module
// Grants Container Apps' managed identities access to Azure Communication Services

@description('Name of the Azure Communication Services account')
param communicationServicesName string

@description('Principal IDs of Container Apps to grant access')
param containerAppPrincipalIds array

@description('Optional: Developer user principal IDs for local testing')
param developerPrincipalIds array = []

@description('Tags to apply to role assignments')
param tags object = {}

// Reference to existing ACS resource
resource communicationServices 'Microsoft.Communication/communicationServices@2023-04-01' existing = {
  name: communicationServicesName
}

// Built-in Azure RBAC role definitions for Communication Services
// Contributor role - allows full management of communication resources including identity creation and token issuance
var contributorRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')

// Alternative roles if you want to restrict permissions:
// - Communication Services Reader: '48316857-84d6-4e46-9c7e-9c5ca42ce37a'
// - Communication Services Data Contributor: 'f9876b55-3a03-4eef-8c07-1e5ac7ce6f35' (for data plane operations)
// For identity creation and token issuance, Contributor role is typically required

// Grant each Container App's managed identity Contributor access to ACS
resource acsContainerAppRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: {
  name: guid(communicationServices.id, principalId, 'acs-contributor')
  scope: communicationServices
  properties: {
    roleDefinitionId: contributorRoleDefinitionId
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Grants Container App managed identity access to Azure Communication Services for identity creation and token issuance'
  }
}]

// Grant developer identities Contributor access for local testing
resource acsDeveloperRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in developerPrincipalIds: {
  name: guid(communicationServices.id, principalId, 'acs-contributor-developer')
  scope: communicationServices
  properties: {
    roleDefinitionId: contributorRoleDefinitionId
    principalId: principalId
    principalType: 'User'
    description: 'Grants developer identity access to Azure Communication Services for local testing with Managed Identity'
  }
}]

// Outputs
output roleAssignmentIds array = [for (principalId, i) in containerAppPrincipalIds: acsContainerAppRoleAssignments[i].id]
output developerRoleAssignmentIds array = [for (principalId, i) in developerPrincipalIds: acsDeveloperRoleAssignments[i].id]
output communicationServicesResourceId string = communicationServices.id
