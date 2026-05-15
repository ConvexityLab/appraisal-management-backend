// Blob-Sync Integration Module
// Wires BlobCreated / DataShare events from an external vendor storage account
// to the shared blob-sync-events Service Bus queue so BlobSyncWorkerService
// can process them in a uniform, config-driven way.
//
// ─── Architecture ─────────────────────────────────────────────────────────────
//
//   Vendor storage account
//     └─ BlobCreated / DataShareCompleted events
//           │
//           ▼  Event Grid System Topic (per vendor account)
//     Event Grid Subscription
//       • subject prefix filter  (optional, e.g. /blobServices/default/containers/<name>/blobs/)
//       • advanced filter: exclude .tmp / hdi_isfolder markers
//       • delivery attribute: vendorType = <vendorType param>   ← routing key
//           │
//           ▼  Service Bus Queue endpoint
//   blob-sync-events  (Standard or Premium namespace required)
//           │
//           ▼
//   BlobSyncWorkerService
//     reads vendorType from applicationProperties
//     resolves VendorConnection by inboundIdentifier
//     routes to DataShareBlobSyncAdapter or BlobCreatedBlobSyncAdapter
//
// ─── Prerequisites ────────────────────────────────────────────────────────────
//
//   • Service Bus namespace must be Standard or Premium tier.
//     (Event Grid → Service Bus delivery is not supported on Basic.)
//   • The vendor storage account must be accessible from this subscription
//     (same tenant; cross-tenant delivery requires additional configuration).
//   • The blob-sync-events queue must already exist in the Service Bus namespace.
//     (Created by service-bus.bicep.)
//
// ─── Idempotency ──────────────────────────────────────────────────────────────
//   Safe to redeploy. Only adds resources; never modifies or deletes existing
//   Event Grid subscriptions.

@description('Resource ID of the vendor storage account (source of BlobCreated / DataShare events).')
param vendorStorageAccountId string

@description('Name of the vendor storage account. Used to name the Event Grid system topic.')
param vendorStorageAccountName string

@description('Vendor type identifier — stamped as the vendorType application property on every delivered message. Must match VendorConnection.inboundIdentifier in the Cosmos vendor-connections container.')
param vendorType string

@description('Name of the existing Service Bus namespace to deliver messages to.')
param serviceBusNamespaceName string

@description('Name of the Service Bus queue to deliver messages to. Must already exist in the namespace.')
param serviceBusQueueName string = 'blob-sync-events'

@description('Include only events for blobs in this container name. Leave empty to receive events from all containers.')
param containerName string = ''

@description('Additional subject prefix filter beyond the container. Interpreted as a blob path prefix within the container. Leave empty for no prefix restriction.')
param blobPathPrefix string = ''

@description('Tags to apply to resources.')
param tags object

// ─── Derived values ────────────────────────────────────────────────────────────

// Build the subject prefix filter.
// If a container is specified the filter anchors to that container.
// If a blobPathPrefix is also specified it is appended after /blobs/.
var subjectPrefix = !empty(containerName)
  ? !empty(blobPathPrefix)
    ? '/blobServices/default/containers/${containerName}/blobs/${blobPathPrefix}'
    : '/blobServices/default/containers/${containerName}/blobs/'
  : ''

// ─── Existing Service Bus namespace ───────────────────────────────────────────

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2023-01-01-preview' existing = {
  name: serviceBusNamespaceName
}

// ─── Event Grid System Topic ──────────────────────────────────────────────────
// Scoped to the vendor storage account. Each vendor storage account gets its
// own system topic — Event Grid system topics are 1:1 with their source resource.

resource vendorEventGridTopic 'Microsoft.EventGrid/systemTopics@2023-12-15-preview' = {
  name: 'egt-blob-sync-${vendorStorageAccountName}'
  location: resourceGroup().location
  tags: tags
  identity: {
    // System-assigned MI is used for authenticated delivery to the Service Bus queue.
    type: 'SystemAssigned'
  }
  properties: {
    source: vendorStorageAccountId
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
}

// ─── Role: Event Grid MI → Service Bus Data Sender ────────────────────────────
// Grants the Event Grid system topic's managed identity permission to enqueue
// messages onto the blob-sync-events queue.
//
// Scope: the namespace (not just the queue) — consistent with how the app's
// own container apps receive the Data Sender role in servicebus-role-assignments.bicep.

resource eventGridServiceBusSenderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  // Role: Azure Service Bus Data Sender (69a216fc-b8fb-44d8-bc22-1f3c2cd27a39)
  name: guid(vendorEventGridTopic.id, serviceBusNamespace.id, '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39')
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39' // Azure Service Bus Data Sender
    )
    principalId: vendorEventGridTopic.identity.principalId
    principalType: 'ServicePrincipal'
    description: 'Allows Event Grid system topic for ${vendorStorageAccountName} to send blob-sync messages to Service Bus'
  }
}

// ─── Event Grid Subscription → blob-sync-events queue ─────────────────────────
// Delivers BlobCreated and DataShare sync-completed events to the shared Service
// Bus queue with the vendorType stamped as an application property.
//
// Note on deliveryAttributeMappings (Static type):
//   The 'vendorType' application property is the sole routing key used by
//   BlobSyncWorkerService.handleMessage() to resolve the VendorConnection and
//   select the appropriate adapter. It must match VendorConnection.inboundIdentifier.

resource vendorBlobSyncSubscription 'Microsoft.EventGrid/systemTopics/eventSubscriptions@2023-12-15-preview' = {
  parent: vendorEventGridTopic
  name: 'blob-sync-to-servicebus-${vendorType}'
  properties: {
    eventDeliverySchema: 'EventGridSchema'
    filter: {
      includedEventTypes: [
        'Microsoft.Storage.BlobCreated'
        'Microsoft.DataShare.ShareSubscriptionSynchronizationCompleted'
      ]
      // Subject prefix filter — anchors to the configured container/path if set.
      // Empty string means "all blobs in all containers" which is valid for
      // Data Share accounts that don't use container-based routing.
      subjectBeginsWith: subjectPrefix
      advancedFilters: [
        // Exclude HNS directory-marker blobs (hdi_isfolder) created by ADLS Gen2.
        {
          operatorType: 'StringNotContains'
          key: 'subject'
          values: ['hdi_isfolder=true']
        }
        // Exclude WinSCP / AzCopy in-flight temp files.
        {
          operatorType: 'StringNotEndsWith'
          key: 'subject'
          values: ['.filepart', '.tmp', '.crdownload']
        }
      ]
    }
    destination: {
      endpointType: 'ServiceBusQueue'
      properties: {
        // Full resource ID of the Service Bus queue.
        resourceId: '${serviceBusNamespace.id}/queues/${serviceBusQueueName}'
        deliveryAttributeMappings: [
          {
            // Stamp 'vendorType' as a Service Bus application property.
            // BlobSyncWorkerService reads this in deserializeMessage() to route
            // the message to the correct VendorConnection without parsing the body.
            name: 'vendorType'
            type: 'Static'
            properties: {
              value: vendorType
              isSecret: false
            }
          }
        ]
      }
    }
    retryPolicy: {
      // 30 attempts over 24 hours matches the SFTP subscription policy.
      // Service Bus will additionally retry via maxDeliveryCount on the queue.
      maxDeliveryAttempts: 30
      eventTimeToLiveInMinutes: 1440 // 24 hours
    }
  }
  dependsOn: [
    eventGridServiceBusSenderRole
  ]
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

output eventGridTopicName string = vendorEventGridTopic.name
output eventGridTopicPrincipalId string = vendorEventGridTopic.identity.principalId
output eventSubscriptionName string = vendorBlobSyncSubscription.name
