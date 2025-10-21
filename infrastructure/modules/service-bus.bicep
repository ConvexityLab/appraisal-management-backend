// Service Bus Module
// Deploys Service Bus namespace with queues and topics for event-driven architecture

@description('The Azure region for deployment')
param location string

@description('Naming prefix for resources')
param namingPrefix string

@description('Environment name')
param environment string

@description('Tags to apply to resources')
param tags object

// Environment-specific configurations
var serviceBusConfigs = {
  dev: {
    sku: 'Basic'
    capacity: 1
    zoneRedundant: false
  }
  staging: {
    sku: 'Standard'
    capacity: 1
    zoneRedundant: false
  }
  prod: {
    sku: 'Premium'
    capacity: 1
    zoneRedundant: true
  }
}

var config = serviceBusConfigs[environment]

// Service Bus Namespace
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2023-01-01-preview' = {
  name: '${namingPrefix}-servicebus'
  location: location
  tags: tags
  sku: {
    name: config.sku
    tier: config.sku
    capacity: config.capacity
  }
  properties: {
    zoneRedundant: config.zoneRedundant
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

// Order Events Queue
resource orderEventsQueue 'Microsoft.ServiceBus/namespaces/queues@2023-01-01-preview' = {
  parent: serviceBusNamespace
  name: 'order-events'
  properties: {
    maxSizeInMegabytes: 1024
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: true
    enablePartitioning: config.sku != 'Premium'
  }
}

// Property Intelligence Queue
resource propertyIntelligenceQueue 'Microsoft.ServiceBus/namespaces/queues@2023-01-01-preview' = {
  parent: serviceBusNamespace
  name: 'property-intelligence'
  properties: {
    maxSizeInMegabytes: 2048
    maxDeliveryCount: 3
    lockDuration: 'PT10M'
    defaultMessageTimeToLive: 'P7D'
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: true
    enablePartitioning: config.sku != 'Premium'
  }
}

// Vendor Assignment Queue
resource vendorAssignmentQueue 'Microsoft.ServiceBus/namespaces/queues@2023-01-01-preview' = {
  parent: serviceBusNamespace
  name: 'vendor-assignment'
  properties: {
    maxSizeInMegabytes: 1024
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: true
    enablePartitioning: config.sku != 'Premium'
  }
}

// Notifications Queue
resource notificationsQueue 'Microsoft.ServiceBus/namespaces/queues@2023-01-01-preview' = {
  parent: serviceBusNamespace
  name: 'notifications'
  properties: {
    maxSizeInMegabytes: 512
    maxDeliveryCount: 10
    lockDuration: 'PT1M'
    defaultMessageTimeToLive: 'P1D'
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: false
    enablePartitioning: config.sku != 'Premium'
  }
}

// QC Events Topic (for publishing QC workflow events)
resource qcEventsTopic 'Microsoft.ServiceBus/namespaces/topics@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: serviceBusNamespace
  name: 'qc-events'
  properties: {
    maxSizeInMegabytes: 1024
    defaultMessageTimeToLive: 'P14D'
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: true
    enablePartitioning: config.sku != 'Premium'
  }
}

// QC Processing Subscription
resource qcProcessingSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: qcEventsTopic
  name: 'qc-processing'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// QC Alerts Subscription
resource qcAlertsSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: qcEventsTopic
  name: 'qc-alerts'
  properties: {
    maxDeliveryCount: 10
    lockDuration: 'PT1M'
    defaultMessageTimeToLive: 'P1D'
    deadLetteringOnMessageExpiration: true
  }
}

// Audit Events Topic (for audit trail and compliance)
resource auditEventsTopic 'Microsoft.ServiceBus/namespaces/topics@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: serviceBusNamespace
  name: 'audit-events'
  properties: {
    maxSizeInMegabytes: 2048
    defaultMessageTimeToLive: 'P90D'
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: true
    enablePartitioning: config.sku != 'Premium'
  }
}

// Compliance Subscription
resource complianceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: auditEventsTopic
  name: 'compliance'
  properties: {
    maxDeliveryCount: 3
    lockDuration: 'PT10M'
    defaultMessageTimeToLive: 'P90D'
    deadLetteringOnMessageExpiration: true
  }
}

// Analytics Subscription
resource analyticsSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: auditEventsTopic
  name: 'analytics'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P30D'
    deadLetteringOnMessageExpiration: true
  }
}

// Outputs
output namespaceName string = serviceBusNamespace.name
output namespaceId string = serviceBusNamespace.id
output endpoint string = serviceBusNamespace.properties.serviceBusEndpoint
output queueNames array = [
  orderEventsQueue.name
  propertyIntelligenceQueue.name
  vendorAssignmentQueue.name
  notificationsQueue.name
]
output topicNames array = config.sku != 'Basic' ? [
  qcEventsTopic.name
  auditEventsTopic.name
] : []
