// Web PubSub Role Assignments Module
// Assigns Web PubSub Service Owner role to container apps for Managed Identity access
// No connection strings needed — uses DefaultAzureCredential

@description('Web PubSub resource name')
param webPubSubName string

@description('Principal IDs of container apps that need Web PubSub access')
param containerAppPrincipalIds array

// Reference existing Web PubSub
resource webPubSub 'Microsoft.SignalRService/webPubSub@2024-03-01' existing = {
  name: webPubSubName
}

// Web PubSub Service Owner — allows sending messages, managing connections, generating tokens
resource webPubSubRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  name: guid(webPubSub.id, principalId, '12cf5a90-567b-43ae-8102-96cf46c7d9b4')
  scope: webPubSub
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '12cf5a90-567b-43ae-8102-96cf46c7d9b4') // Web PubSub Service Owner
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows container app ${i} to send messages and manage connections via Managed Identity'
  }
}]

output roleAssignmentsCount int = length(containerAppPrincipalIds)
