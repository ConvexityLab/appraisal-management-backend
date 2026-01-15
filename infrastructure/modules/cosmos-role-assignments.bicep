// Cosmos DB Role Assignments Module
// Grants Container Apps access to Cosmos DB

param cosmosAccountName string
param containerAppPrincipalIds array

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' existing = {
  name: cosmosAccountName
}

// Built-in Cosmos DB Data Reader role
var cosmosDataReaderRoleId = '00000000-0000-0000-0000-000000000001'

// Built-in Cosmos DB Data Contributor role
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

// Grant Reader role to each Container App
resource cosmosReaderRoleAssignments 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = [for (principalId, i) in containerAppPrincipalIds: {
  name: guid(cosmosAccount.id, principalId, cosmosDataReaderRoleId)
  parent: cosmosAccount
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosDataReaderRoleId}'
    principalId: principalId
    scope: cosmosAccount.id
  }
}]

// Grant Contributor role to each Container App
resource cosmosContributorRoleAssignments 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = [for (principalId, i) in containerAppPrincipalIds: {
  name: guid(cosmosAccount.id, principalId, cosmosDataContributorRoleId)
  parent: cosmosAccount
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosDataContributorRoleId}'
    principalId: principalId
    scope: cosmosAccount.id
  }
}]

output roleAssignmentIds array = [for (principalId, i) in containerAppPrincipalIds: cosmosReaderRoleAssignments[i].id]
