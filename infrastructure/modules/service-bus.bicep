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
    requiresDuplicateDetection: config.sku != 'Basic'
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
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P7D'
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: config.sku != 'Basic'
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
    requiresDuplicateDetection: config.sku != 'Basic'
    enablePartitioning: config.sku != 'Premium'
  }
}

// Notifications Queue
resource notificationsQueue 'Microsoft.ServiceBus/namespaces/queues@2023-01-01-preview' = {
  parent: serviceBusNamespace
  name: 'notifications'
  properties: {
    maxSizeInMegabytes: 1024
    maxDeliveryCount: 10
    lockDuration: 'PT1M'
    defaultMessageTimeToLive: 'P1D'
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: false
    enablePartitioning: config.sku != 'Premium'
  }
}

// AI Autopilot Tasks Queue — Phase 14 v2 (2026-05-11).
//
// Point-to-point transport between AiAutopilotSweepJob (publisher) and
// AiAutopilotConsumer (subscriber).  Each message kicks one autopilot
// run.  Application-level idempotency via `idempotencyKey` short-circuits
// duplicate deliveries at the consumer; the broker just guarantees
// at-least-once.  Tuned long-lock (PT10M) because autopilot runs may
// dispatch to slow downstream services (Axiom, MOP) before completing.
resource aiAutopilotTasksQueue 'Microsoft.ServiceBus/namespaces/queues@2023-01-01-preview' = {
  parent: serviceBusNamespace
  name: 'autopilot-tasks'
  properties: {
    maxSizeInMegabytes: 1024
    // 5 attempts before dead-letter — matches order-events / vendor-assignment.
    maxDeliveryCount: 5
    // Lock-duration capped at PT5M (Azure Service Bus hard max — values
    // > 5 minutes return MessagingGatewayBadRequest at deploy time).
    // For autopilot runs that exceed 5 minutes (Axiom pipelines + MOP +
    // dispatcher chain), the consumer must call `renewMessageLock` to
    // extend the lock incrementally — that's the supported pattern for
    // long-running consumers. See AiAutopilotConsumerService.
    lockDuration: 'PT5M'
    // 14d retention matches order-events.  If a message sits this long
    // unprocessed the recipe state is stale anyway.
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    // Broker-level dedupe is belt-and-suspenders on top of the
    // app-level idempotencyKey probe in AutopilotRunRepository.
    requiresDuplicateDetection: config.sku != 'Basic'
    enablePartitioning: config.sku != 'Premium'
  }
}

// Blob-Sync Events Queue
// Fan-in queue for all blob-drop vendor integrations (Data Share completions,
// BlobCreated notifications). Each external vendor storage account has its own
// Event Grid subscription that routes here; the vendorType application property
// (stamped by the subscription) lets BlobSyncWorkerService route to the correct
// VendorConnection without parsing message bodies.
//
// ⚠️  Event Grid → Service Bus queue delivery requires Standard or Premium tier.
//    This queue is defined unconditionally so it is available in all environments,
//    but Event Grid subscriptions (in blob-sync-integration.bicep) must only be
//    deployed against Standard/Premium namespaces (staging and prod).
resource blobSyncEventsQueue 'Microsoft.ServiceBus/namespaces/queues@2023-01-01-preview' = {
  parent: serviceBusNamespace
  name: 'blob-sync-events'
  properties: {
    maxSizeInMegabytes: 2048
    // 10 attempts: adapter catches transient errors and abandons; 10 broker-level
    // retries give enough runway for intermittent storage/Cosmos failures before
    // the message moves to the dead-letter queue for alerting.
    maxDeliveryCount: 10
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: config.sku != 'Basic'
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
    lockDuration: 'PT5M'
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

// Appraisal Events Topic (for real-time notification pipeline)
resource appraisalEventsTopic 'Microsoft.ServiceBus/namespaces/topics@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: serviceBusNamespace
  name: 'appraisal-events'
  properties: {
    maxSizeInMegabytes: 1024
    defaultMessageTimeToLive: 'P14D'
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    requiresDuplicateDetection: true
    enablePartitioning: config.sku != 'Premium'
  }
}

// Comp Collection Subscription (consumed by CompCollectionListenerJob — runs comp-collection + comp-selection on client-order.created)
resource compCollectionSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'comp-collection'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Notification Service Subscription (consumed by backend notification pipeline)
resource notificationServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'notification-service'
  properties: {
    maxDeliveryCount: 10
    lockDuration: 'PT1M'
    defaultMessageTimeToLive: 'P7D'
    deadLetteringOnMessageExpiration: true
  }
}

// QC Issue Recorder Subscription (consumed by QCIssueRecorderService —
// converts qc.issue.detected events into aiInsights qc-issue rows that
// the FE's AI Issues panel reads).
// Pre-fix the recorder shared the notification-service subscription due
// to a constructor-arg slot mistake; events were therefore handled by
// the wrong subscriber and never persisted. See
// src/services/qc-issue-recorder.service.ts.
resource qcIssueRecorderSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'qc-issue-recorder'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT1M'
    defaultMessageTimeToLive: 'P7D'
    deadLetteringOnMessageExpiration: true
  }
}

// Auto-Assignment Service Subscription (consumed by AutoAssignmentOrchestratorService)
resource autoAssignmentServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'auto-assignment-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Auto-Delivery Service Subscription (consumed by AutoDeliveryService)
resource autoDeliveryServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'auto-delivery-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Audit Event Sink Subscription (consumed by AuditEventSinkService — persists all events to Cosmos)
resource auditEventSinkSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'audit-event-sink'
  properties: {
    maxDeliveryCount: 10
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// AI QC Gate Service Subscription (consumed by AIQCGateService)
resource aiQcGateServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'ai-qc-gate-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Engagement Lifecycle Service Subscription (consumed by EngagementLifecycleService)
resource engagementLifecycleServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'engagement-lifecycle-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Engagement Letter Auto-Send Service Subscription (consumed by EngagementLetterAutoSendService)
resource engagementLetterAutoSendServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'engagement-letter-autosend-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Axiom Auto-Trigger Service Subscription (consumed by AxiomAutoTriggerService)
resource axiomAutoTriggerServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'axiom-auto-trigger-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Vendor Performance Updater Service Subscription (consumed by VendorPerformanceUpdaterService)
resource vendorPerformanceUpdaterServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'vendor-performance-updater-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// UCDP/EAD Auto-Submit Service Subscription (consumed by UcdpEadAutoSubmitService — auto-submits delivered orders to GSE portals)
resource ucdpEadAutoSubmitServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'ucdp-ead-auto-submit-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// MISMO Auto-Generate Service Subscription (consumed by MismoAutoGenerateService — auto-generates MISMO 3.4 XML when an order is SUBMITTED)
resource mismoAutoGenerateServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'mismo-auto-generate-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Communication Event Handler Subscription (consumed by CommunicationEventHandlerService — triggers automated emails/SMS on appraisal lifecycle events)
resource communicationEventHandlerSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'communication-event-handler'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Axiom Document Processing Service Subscription (consumed by AxiomDocumentProcessingService — triggers generic PDF extraction via Axiom on document.uploaded events)
resource axiomDocumentProcessingServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'axiom-document-processing-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Axiom Bulk Submission Service Subscription (consumed by AxiomBulkSubmissionService — submits queued tape-evaluation jobs to Axiom)
resource axiomBulkSubmissionServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'axiom-bulk-submission-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Bulk Ingestion Processor Service Subscription (consumed by BulkIngestionProcessorService — parses CSV and dispatches per-row jobs)
resource bulkIngestionProcessorServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'bulk-ingestion-processor-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Bulk Ingestion Canonical Worker Service Subscription (consumed by BulkIngestionCanonicalWorkerService — canonicalizes raw appraisal blobs)
resource bulkIngestionCanonicalWorkerServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'bulk-ingestion-canonical-worker-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Bulk Ingestion Extraction Worker Service Subscription (consumed by BulkIngestionExtractionWorkerService — triggers Axiom extraction per appraisal)
resource bulkIngestionExtractionWorkerServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'bulk-ingestion-extraction-worker-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Bulk Ingestion Order Creation Worker Service Subscription (consumed by BulkIngestionOrderCreationWorkerService — creates appraisal orders from ingested rows)
resource bulkIngestionOrderCreationWorkerServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'bulk-ingestion-order-creation-worker-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Bulk Ingestion Criteria Worker Service Subscription (consumed by BulkIngestionCriteriaWorkerService — validates loan criteria before order creation)
resource bulkIngestionCriteriaWorkerServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'bulk-ingestion-criteria-worker-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
  }
}

// Bulk Ingestion Finalizer Service Subscription (consumed by BulkIngestionFinalizerService — marks jobs complete and emits summary events)
resource bulkIngestionFinalizerServiceSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = if (config.sku != 'Basic') {
  parent: appraisalEventsTopic
  name: 'bulk-ingestion-finalizer-service'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P14D'
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
  aiAutopilotTasksQueue.name
  blobSyncEventsQueue.name
]
output topicNames array = config.sku != 'Basic' ? [
  qcEventsTopic.name
  auditEventsTopic.name
  appraisalEventsTopic.name
] : []
