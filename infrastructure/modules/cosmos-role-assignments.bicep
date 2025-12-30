// Cosmos DB Role Assignments Module
// Grants Container Apps access to Cosmos DB

param cosmosAccountName string
param containerAppPrincipalIds array

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: cosmosAccountName
}

// Built-in Cosmos DB Data Contributor role
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

// Grant Cosmos DB Data Contributor to each Container App
resource cosmosRoleAssignments 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = [for (principalId, i) in containerAppPrincipalIds: {
  name: guid(cosmosAccount.id, principalId, cosmosDataContributorRoleId)
  parent: cosmosAccount
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosDataContributorRoleId}'
    principalId: principalId
    scope: cosmosAccount.id
  }
}]

output roleAssignmentIds array = [for (principalId, i) in containerAppPrincipalIds: cosmosRoleAssignments[i].id]
