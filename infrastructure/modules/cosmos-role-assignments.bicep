// Cosmos DB Role Assignments Module
// Grants Container Apps access to Cosmos DB

param cosmosAccountName string
param containerAppPrincipalIds array

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: cosmosAccountName
}

// Built-in Cosmos DB roles
var cosmosRoles = [
  '00000000-0000-0000-0000-000000000001'  // Cosmos DB Built-in Data Reader
  '00000000-0000-0000-0000-000000000002'  // Cosmos DB Built-in Data Contributor
]

// Grant Reader role to each Container App
resource cosmosReaderRoleAssignments 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = [for (principalId, i) in containerAppPrincipalIds: {
  name: guid(cosmosAccount.id, principalId, cosmosRoles[0])
  parent: cosmosAccount
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosRoles[0]}'
    principalId: principalId
    scope: cosmosAccount.id
  }
}]

// Grant Contributor role to each Container App
resource cosmosContributorRoleAssignments 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = [for (principalId, i) in containerAppPrincipalIds: {
  name: guid(cosmosAccount.id, principalId, cosmosRoles[1])
  parent: cosmosAccount
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosRoles[1]}'
    principalId: principalId
    scope: cosmosAccount.id
  }
}]

output roleAssignmentIds array = concat(
  [for (principalId, i) in containerAppPrincipalIds: cosmosReaderRoleAssignments[i].id],
  [for (principalId, i) in containerAppPrincipalIds: cosmosContributorRoleAssignments[i].id]
)
