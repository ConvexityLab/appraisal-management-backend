// Service Bus Role Assignments Module
// Assigns Azure Service Bus Data Sender + Data Receiver roles to container apps
// Uses Managed Identity (DefaultAzureCredential) — no connection strings needed

@description('Service Bus namespace name')
param serviceBusNamespaceName string

@description('Principal IDs of container apps that need Service Bus access')
param containerAppPrincipalIds array

@description('Optional: Developer user principal IDs for local integration testing (principalType=User)')
param developerPrincipalIds array = []

// Reference existing Service Bus namespace
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2023-01-01-preview' existing = {
  name: serviceBusNamespaceName
}

// Azure Service Bus Data Sender — allows sending messages to queues/topics
resource serviceBusSenderRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  name: guid(serviceBusNamespace.id, principalId, '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39')
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39') // Azure Service Bus Data Sender
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows container app ${i} to send messages to Service Bus queues and topics'
  }
}]

// Azure Service Bus Data Receiver — allows receiving/completing messages
resource serviceBusReceiverRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in containerAppPrincipalIds: if (!empty(containerAppPrincipalIds)) {
  name: guid(serviceBusNamespace.id, principalId, '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0')
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0') // Azure Service Bus Data Receiver
    principalId: principalId
    principalType: 'ServicePrincipal'
    description: 'Allows container app ${i} to receive messages from Service Bus queues and subscriptions'
  }
}]

// Azure Service Bus Data Sender — developer identities for local integration test SB injection
resource serviceBusDeveloperSenderRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in developerPrincipalIds: if (!empty(developerPrincipalIds)) {
  name: guid(serviceBusNamespace.id, principalId, '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39-developer')
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39') // Azure Service Bus Data Sender
    principalId: principalId
    principalType: 'User'
    description: 'Allows developer ${i} to send messages to Service Bus for integration test SB injection'
  }
}]

// Azure Service Bus Data Receiver — developer identities for local integration test consumption
resource serviceBusDeveloperReceiverRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (principalId, i) in developerPrincipalIds: if (!empty(developerPrincipalIds)) {
  name: guid(serviceBusNamespace.id, principalId, '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0-developer')
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0') // Azure Service Bus Data Receiver
    principalId: principalId
    principalType: 'User'
    description: 'Allows developer ${i} to receive messages from Service Bus for local testing'
  }
}]

output senderRoleAssignmentsCount int = length(containerAppPrincipalIds)
output receiverRoleAssignmentsCount int = length(containerAppPrincipalIds)
