// infrastructure/modules/appconfig-reader-role.bicep
// Grants App Configuration Data Reader to every Container App managed identity
// on the shared App Config store (which lives in a different resource group).
//
// Deploy-time scope: the certo-global-{environment}-rg resource group
// (set via `scope: resourceGroup(...)` in main.bicep).

@description('Principal IDs of the Container App managed identities that need read access.')
param containerAppPrincipalIds array

@description('Name of the App Configuration store (e.g. appconfig-certo-dev).')
param appConfigName string

// App Configuration Data Reader built-in role
var appConfigDataReaderRoleId = '516239f1-63e1-4d78-a4de-a74fb236a071'

resource appConfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' existing = {
  name: appConfigName
}

resource roleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: {
  name: guid(appConfig.id, principalId, appConfigDataReaderRoleId)
  scope: appConfig
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      appConfigDataReaderRoleId
    )
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]
