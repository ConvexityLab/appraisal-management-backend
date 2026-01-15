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
// Flatten: Create array of all principal+role combinations
var roleAssignmentsFlat = flatten([for principalId in containerAppPrincipalIds: [
  for role in cosmosRoles: {
    principalId: principalId
    roleId: role.id
    uniqueName: guid(cosmosAccount.id, principalId, role.id)
  }
]])

resource cosmosRoleAssignments 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = [for assignment in roleAssignmentsFlat: {
  name: assignment.uniqueName
  parent: cosmosAccount
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${assignment.roleId}'
    principalId: assignment.principalId
    scope: cosmosAccount.id
  }
}]

output roleAssignmentIds array = [for assignment in roleAssignmentsFlat: cosmosRoleAssignments[indexOf(roleAssignmentsFlat, assignment)].id]
