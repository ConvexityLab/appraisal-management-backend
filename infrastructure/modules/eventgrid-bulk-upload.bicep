// Event Grid Bulk Upload Module
// Wires BlobCreated events from the Axiom storage account's bulk-upload container
// → a storage queue on the main storage account so the backend API can react to them.
//
// Flow: axiomdevst/bulk-upload BlobCreated → Event Grid System Topic
//       → Event Grid Subscription (filter: bulk-upload container, CSV/XLSX files only)
//       → Storage Queue "bulk-upload-events" on main backend storage account
//       → BulkUploadEventListenerJob in the API server (queue-receive loop)
//
// Expected blob path convention when dropping files:
//   bulk-upload/{tenantId}/{clientId}/{adapterKey}/loans.csv
//   bulk-upload/{tenantId}/{clientId}/{adapterKey}/doc1.pdf
//   bulk-upload/{tenantId}/{clientId}/{adapterKey}/doc2.pdf
//
// The listener reads tenantId / clientId / adapterKey from the blob path segments.

@description('Resource ID of the Axiom storage account (source of BlobCreated events)')
param axiomStorageAccountId string

@description('Name of the Axiom storage account (e.g. axiomdevst)')
param axiomStorageAccountName string

@description('Resource ID of the main backend storage account (queue destination)')
param mainStorageAccountId string

@description('Tags to apply to resources')
param tags object

// ─── Event Grid System Topic ──────────────────────────────────────────────────
resource bulkUploadEventGridTopic 'Microsoft.EventGrid/systemTopics@2023-12-15-preview' = {
  name: 'egt-bulk-upload-${axiomStorageAccountName}'
  location: resourceGroup().location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    source: axiomStorageAccountId
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
}

// ─── Role: Event Grid → Storage Queue Data Message Sender ─────────────────────
// Grant the system topic's managed identity permission to enqueue messages onto
// the main storage account's bulk-upload-events queue.
resource queueSenderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  // Role: Storage Queue Data Message Sender (c6a89b2d-59bc-44d0-9896-0f6e12d7b80a)
  name: guid(bulkUploadEventGridTopic.id, mainStorageAccountId, 'c6a89b2d-59bc-44d0-9896-0f6e12d7b80a')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'c6a89b2d-59bc-44d0-9896-0f6e12d7b80a' // Storage Queue Data Message Sender
    )
    principalId: bulkUploadEventGridTopic.identity.principalId
    principalType: 'ServicePrincipal'
    description: 'Allows Event Grid system topic to enqueue bulk-upload blob notifications'
  }
}

// ─── Event Subscription ───────────────────────────────────────────────────────
// Filter: only BlobCreated events in the bulk-upload container, CSV/XLSX data files only.
// Documents (PDFs etc.) are discovered by the listener by listing the same prefix —
// there's no need to trigger on every individual document upload.
resource bulkUploadEventSubscription 'Microsoft.EventGrid/systemTopics/eventSubscriptions@2023-12-15-preview' = {
  parent: bulkUploadEventGridTopic
  name: 'bulk-upload-to-queue'
  properties: {
    eventDeliverySchema: 'EventGridSchema'
    filter: {
      includedEventTypes: [
        'Microsoft.Storage.BlobCreated'
      ]
      subjectBeginsWith: '/blobServices/default/containers/bulk-upload/blobs/'
      advancedFilters: [
        {
          // Only trigger on data files (CSV / XLSX). Documents are enumerated by the
          // listener from the same path prefix — triggering on every PDF would cause
          // one ingestion job per document upload, which is wrong.
          operatorType: 'StringEndsWith'
          key: 'subject'
          values: [
            '.csv'
            '.CSV'
            '.xlsx'
            '.XLSX'
          ]
        }
      ]
    }
    destination: {
      endpointType: 'StorageQueue'
      properties: {
        resourceId: mainStorageAccountId
        queueName: 'bulk-upload-events'
        // 7 days retention — long enough for weekend gaps or temporary backend outage
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
output eventGridTopicName string = bulkUploadEventGridTopic.name
output eventGridTopicPrincipalId string = bulkUploadEventGridTopic.identity.principalId
