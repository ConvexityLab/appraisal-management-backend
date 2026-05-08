// App Configuration Data Owner role assignment
//
// Grants the GitHub Actions deploy SP "App Configuration Data Owner" on the
// App Configuration store. Required when the store has disableLocalAuth=true
// AND dataPlaneProxy.authenticationMode='Pass-through' (see app-config.bicep)
// — bicep keyValues operations then use the deploying principal's identity,
// which must have Data Owner role to read/write/delete keys.
//
// Without this role assignment, deploys hit:
//   "The operation cannot be performed because the configuration store is
//    using local authentication mode and local authentication is disabled."

@description('Name of the App Configuration store to grant access on.')
param appConfigName string

@description('Object ID of the principal (GitHub Actions service principal) that needs Data Owner access.')
param principalId string

resource appConfig 'Microsoft.AppConfiguration/configurationStores@2024-05-01' existing = {
  name: appConfigName
}

// Built-in role: App Configuration Data Owner
// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#app-configuration-data-owner
var appConfigDataOwnerRoleId = '5ae67dd6-50cb-40e7-96ff-dc2bfa4b606b'

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: appConfig
  name: guid(appConfig.id, principalId, appConfigDataOwnerRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', appConfigDataOwnerRoleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
