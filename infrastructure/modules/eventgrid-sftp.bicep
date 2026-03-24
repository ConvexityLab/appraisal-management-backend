// Event Grid SFTP Module — Statebridge Integration
// Wires BlobCreated events from the SFTP storage account → a storage queue 
// on the main storage account so the Azure Function can trigger reliably.
//
// Why queue-based (not direct blob trigger)?
// Azure Functions blob triggers on HNS/ADLS Gen2 accounts require Event Grid
// under the hood. Routing through a storage queue gives us durable delivery,
// poison-message handling, and decouples the trigger from the container runtime.
//
// Flow: SFTP uploads/ BlobCreated → Event Grid System Topic
//       → Event Grid Subscription (filter: uploads/ prefix)
//       → Storage Queue "sftp-order-events" on main storage account
//       → processSftpOrderFile function (queue trigger)

@description('Resource ID of the SFTP storage account (source of BlobCreated events)')
param sftpStorageAccountId string

@description('Name of the SFTP storage account')
param sftpStorageAccountName string

@description('Resource ID of the main storage account (queue destination)')
param mainStorageAccountId string

@description('Tags to apply to resources')
param tags object

// ─── Event Grid System Topic ──────────────────────────────────────────────────
// Must be in the same resource group as the SFTP storage account.
resource sftpEventGridTopic 'Microsoft.EventGrid/systemTopics@2023-12-15-preview' = {
  name: 'egt-sftp-${sftpStorageAccountName}'
  location: resourceGroup().location
  tags: tags
  identity: {
    // System-assigned MI is used for authenticated delivery to the storage queue
    type: 'SystemAssigned'
  }
  properties: {
    source: sftpStorageAccountId
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
}

// ─── Role: Event Grid → Storage Queue Data Message Sender ─────────────────────
// Grant the Event Grid system topic's managed identity permission to enqueue
// messages onto the main storage account's sftp-order-events queue.
resource queueSenderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  // Role: Storage Queue Data Message Sender (c6a89b2d-59bc-44d0-9896-0f6e12d7b80a)
  name: guid(sftpEventGridTopic.id, mainStorageAccountId, 'c6a89b2d-59bc-44d0-9896-0f6e12d7b80a')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'c6a89b2d-59bc-44d0-9896-0f6e12d7b80a' // Storage Queue Data Message Sender
    )
    principalId: sftpEventGridTopic.identity.principalId
    principalType: 'ServicePrincipal'
    description: 'Allows Event Grid system topic to enqueue SFTP blob notifications'
  }
}

// ─── Event Subscription ───────────────────────────────────────────────────────
// Filter: only BlobCreated events in the uploads/ container.
// Delivery: main storage account → sftp-order-events queue.
resource sftpEventSubscription 'Microsoft.EventGrid/systemTopics/eventSubscriptions@2023-12-15-preview' = {
  parent: sftpEventGridTopic
  name: 'sftp-uploads-to-queue'
  properties: {
    eventDeliverySchema: 'EventGridSchema'
    filter: {
      includedEventTypes: [
        'Microsoft.Storage.BlobCreated'
      ]
      subjectBeginsWith: '/blobServices/default/containers/uploads/'
      // Exclude the hdi_isfolder marker blobs that HNS creates for directories
      advancedFilters: [
        {
          operatorType: 'StringNotContains'
          key: 'subject'
          values: [
            'hdi_isfolder=true'
          ]
        }
      ]
    }
    destination: {
      endpointType: 'StorageQueue'
      properties: {
        resourceId: mainStorageAccountId
        queueName: 'sftp-order-events'
        // Messages expire after 7 days (604800 seconds) — long enough for weekend gap
        queueMessageTimeToLiveInSeconds: 604800
      }
    }
    retryPolicy: {
      maxDeliveryAttempts: 30
      eventTimeToLiveInMinutes: 1440 // 24 hours
    }
    deadLetterDestination: null
  }
  dependsOn: [
    queueSenderRole
  ]
}

// ─── Outputs ──────────────────────────────────────────────────────────────────
output eventGridTopicName string = sftpEventGridTopic.name
output eventGridTopicPrincipalId string = sftpEventGridTopic.identity.principalId
