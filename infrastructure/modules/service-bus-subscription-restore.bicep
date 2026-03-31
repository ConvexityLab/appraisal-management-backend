targetScope = 'resourceGroup'

@description('Service Bus namespace name (not FQDN).')
param serviceBusNamespaceName string

@description('Service Bus topic name.')
param topicName string = 'appraisal-events'

@description('Service Bus subscription name to create or restore.')
param subscriptionName string = 'axiom-bulk-submission-service'

@description('Maximum delivery attempts before dead-lettering.')
param maxDeliveryCount int = 5

@description('Message lock duration in ISO 8601 format.')
param lockDuration string = 'PT5M'

@description('Default message TTL in ISO 8601 format.')
param defaultMessageTimeToLive string = 'P14D'

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2023-01-01-preview' existing = {
  name: serviceBusNamespaceName
}

resource appraisalEventsTopic 'Microsoft.ServiceBus/namespaces/topics@2023-01-01-preview' existing = {
  parent: serviceBusNamespace
  name: topicName
}

resource axiomBulkSubmissionServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = {
  parent: appraisalEventsTopic
  name: subscriptionName
  properties: {
    maxDeliveryCount: maxDeliveryCount
    lockDuration: lockDuration
    defaultMessageTimeToLive: defaultMessageTimeToLive
    deadLetteringOnMessageExpiration: true
  }
}

output subscriptionResourceId string = axiomBulkSubmissionServiceSubscription.id
