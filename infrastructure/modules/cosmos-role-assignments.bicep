// Cosmos DB Role Assignments Module
// Grants Container Apps access to Cosmos DB

param cosmosAccountName string
param containerAppPrincipalIds array

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: cosmosAccountName
}

// Built-in Cosmos DB roles
var cosmosRoles = [
  {
    id: '00000000-0000-0000-0000-000000000001'  // Cosmos DB Built-in Data Reader
    name: 'reader'
  }
  {
    id: '00000000-0000-0000-0000-000000000002'  // Cosmos DB Built-in Data Contributor
    name: 'contributor'
  }
]

// Grant BOTH Reader and Contributor roles to each Container App
resource cosmosRoleAssignments 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = [for principalId in containerAppPrincipalIds: [for role in cosmosRoles: {
  name: guid(cosmosAccount.id, principalId, role.id)
  parent: cosmosAccount
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${role.id}'
    principalId: principalId
    scope: cosmosAccount.id
  }
}]]

output roleAssignmentIds array = [for (principalId, i) in containerAppPrincipalIds: [for (role, j) in cosmosRoles: cosmosRoleAssignments[i][j].id]]
