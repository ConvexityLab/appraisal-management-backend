// Integration Services Module - API Management, Service Bus, Event processing
// Includes API Management, Service Bus, Event Hubs, and Data Factory

param location string
param environment string
param suffix string
param tags object
param keyVaultName string

// Variables
var apiManagementName = 'apim-appraisal-${environment}-${suffix}'
var serviceBusName = 'sb-appraisal-${environment}-${suffix}'
var eventHubNamespaceName = 'eh-appraisal-${environment}-${suffix}'
var dataFactoryName = 'df-appraisal-${environment}-${suffix}'

// API Management Service
resource apiManagement 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: apiManagementName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Developer'
    capacity: environment == 'prod' ? 2 : 1
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: 'admin@appraisalmanagement.com'
    publisherName: 'Appraisal Management System'
    notificationSenderEmail: 'noreply@appraisalmanagement.com'
    hostnameConfigurations: [
      {
        type: 'Proxy'
        hostName: '${apiManagementName}.azure-api.net'
        negotiateClientCertificate: false
        defaultSslBinding: true
      }
    ]
    customProperties: {
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Ssl30': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Ciphers.TripleDes168': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls10': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls11': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Ssl30': 'false'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Protocols.Server.Http2': 'true'
    }
    virtualNetworkType: 'None'
    disableGateway: false
    natGatewayState: 'Unsupported'
    apiVersionConstraint: {
      minApiVersion: '2019-12-01'
    }
    publicNetworkAccess: 'Enabled'
    developerPortalStatus: environment == 'prod' ? 'Disabled' : 'Enabled'
  }
}

// API Management Products
resource apiProduct 'Microsoft.ApiManagement/service/products@2023-05-01-preview' = {
  parent: apiManagement
  name: 'appraisal-management-api'
  properties: {
    displayName: 'Appraisal Management API'
    description: 'APIs for the Appraisal Management System'
    terms: 'By accessing this API, you agree to the terms of service.'
    subscriptionRequired: true
    approvalRequired: environment == 'prod'
    subscriptionsLimit: environment == 'prod' ? 1000 : 10
    state: 'published'
  }
}

// API Management Policies
resource apiManagementPolicy 'Microsoft.ApiManagement/service/policies@2023-05-01-preview' = {
  parent: apiManagement
  name: 'policy'
  properties: {
    value: '''
    <policies>
      <inbound>
        <rate-limit calls="1000" renewal-period="3600" />
        <quota calls="10000" renewal-period="604800" />
        <cors allow-credentials="true">
          <allowed-origins>
            <origin>*</origin>
          </allowed-origins>
          <allowed-methods>
            <method>GET</method>
            <method>POST</method>
            <method>PUT</method>
            <method>DELETE</method>
            <method>OPTIONS</method>
          </allowed-methods>
          <allowed-headers>
            <header>*</header>
          </allowed-headers>
        </cors>
        <set-header name="X-Forwarded-For" exists-action="override">
          <value>@(context.Request.IpAddress)</value>
        </set-header>
      </inbound>
      <backend>
        <forward-request />
      </backend>
      <outbound>
        <set-header name="X-Powered-By" exists-action="delete" />
        <set-header name="X-AspNet-Version" exists-action="delete" />
        <set-header name="Server" exists-action="delete" />
      </outbound>
      <on-error>
        <set-header name="ErrorSource" exists-action="override">
          <value>@(context.LastError.Source)</value>
        </set-header>
        <set-header name="ErrorReason" exists-action="override">
          <value>@(context.LastError.Reason)</value>
        </set-header>
      </on-error>
    </policies>
    '''
    format: 'xml'
  }
}

// Service Bus Namespace
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: serviceBusName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Basic'
    tier: environment == 'prod' ? 'Standard' : 'Basic'
  }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    zoneRedundant: environment == 'prod'
  }
}

// Service Bus Queues
var queueNames = [
  'order-processing'
  'vendor-notifications'
  'qc-reviews'
  'payment-processing'
  'document-processing'
  'risk-assessment'
  'audit-logging'
]

resource serviceBusQueues 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = [for queueName in queueNames: {
  parent: serviceBusNamespace
  name: queueName
  properties: {
    lockDuration: 'PT1M'
    maxSizeInMegabytes: environment == 'prod' ? 5120 : 1024
    requiresDuplicateDetection: false
    requiresSession: false
    defaultMessageTimeToLive: 'P14D'
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    maxDeliveryCount: 10
    enablePartitioning: environment == 'prod'
    enableExpress: false
  }
}]

// Service Bus Topics
var topicNames = [
  'order-events'
  'valuation-events'
  'compliance-events'
  'system-events'
]

resource serviceBusTopics 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = [for topicName in topicNames: {
  parent: serviceBusNamespace
  name: topicName
  properties: {
    defaultMessageTimeToLive: 'P14D'
    maxSizeInMegabytes: environment == 'prod' ? 5120 : 1024
    requiresDuplicateDetection: false
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    enableBatchedOperations: true
    enablePartitioning: environment == 'prod'
    enableExpress: false
  }
}]

// Event Hubs Namespace
resource eventHubNamespace 'Microsoft.EventHub/namespaces@2023-01-01-preview' = {
  name: eventHubNamespaceName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Basic'
    tier: environment == 'prod' ? 'Standard' : 'Basic'
    capacity: environment == 'prod' ? 2 : 1
  }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    zoneRedundant: environment == 'prod'
    isAutoInflateEnabled: environment == 'prod'
    maximumThroughputUnits: environment == 'prod' ? 20 : 1
    kafkaEnabled: environment == 'prod'
  }
}

// Event Hubs
var eventHubNames = [
  'data-ingestion'
  'real-time-analytics' 
  'audit-stream'
  'ml-telemetry'
]

resource eventHubs 'Microsoft.EventHub/namespaces/eventhubs@2023-01-01-preview' = [for eventHubName in eventHubNames: {
  parent: eventHubNamespace
  name: eventHubName
  properties: {
    messageRetentionInDays: environment == 'prod' ? 7 : 1
    partitionCount: environment == 'prod' ? 4 : 2
    captureDescription: environment == 'prod' ? {
      enabled: true
      encoding: 'Avro'
      intervalInSeconds: 300
      sizeLimitInBytes: 314572800
      skipEmptyArchives: true
    } : null
  }
}]

// Data Factory
resource dataFactory 'Microsoft.DataFactory/factories@2018-06-01' = {
  name: dataFactoryName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    globalParameters: {}
  }
}

// Data Factory Managed Private Endpoint (for production)
resource dataFactoryManagedVNet 'Microsoft.DataFactory/factories/managedVirtualNetworks@2018-06-01' = if (environment == 'prod') {
  parent: dataFactory
  name: 'default'
  properties: {}
}

// Integration Runtime for Data Factory
resource integrationRuntime 'Microsoft.DataFactory/factories/integrationRuntimes@2018-06-01' = {
  parent: dataFactory
  name: 'AutoResolveIntegrationRuntime'
  properties: {
    type: 'Managed'
    managedVirtualNetwork: environment == 'prod' ? {
      referenceName: 'default'
      type: 'ManagedVirtualNetworkReference'
    } : null
    typeProperties: {
      computeProperties: {
        location: 'AutoResolve'
        dataFlowProperties: {
          computeType: 'General'
          coreCount: 8
          timeToLive: 10
        }
      }
    }
  }
}

// Outputs
output apiManagementName string = apiManagement.name
output apiManagementId string = apiManagement.id
output apiManagementGatewayUrl string = apiManagement.properties.gatewayUrl
output serviceBusNamespaceName string = serviceBusNamespace.name
output serviceBusNamespaceId string = serviceBusNamespace.id
output serviceBusConnectionString string = listKeys('${serviceBusNamespace.id}/AuthorizationRules/RootManageSharedAccessKey', serviceBusNamespace.apiVersion).primaryConnectionString
output eventHubNamespaceName string = eventHubNamespace.name
output eventHubNamespaceId string = eventHubNamespace.id
output eventHubConnectionString string = listKeys('${eventHubNamespace.id}/AuthorizationRules/RootManageSharedAccessKey', eventHubNamespace.apiVersion).primaryConnectionString
output dataFactoryName string = dataFactory.name
output dataFactoryId string = dataFactory.id
