@description('Name for the Notification Hub namespace')
param notificationHubNamespaceName string

@description('Name for the Notification Hub')
param notificationHubName string

@description('Location for the resource')
param location string = resourceGroup().location

@description('SKU for the Notification Hub (Free, Basic, Standard)')
param sku string = 'Standard'

@description('Tags to apply to all resources')
param tags object = {}

resource notificationHubNamespace 'Microsoft.NotificationHubs/namespaces@2023-09-01' = {
  name: notificationHubNamespaceName
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {}
}

resource notificationHub 'Microsoft.NotificationHubs/namespaces/notificationHubs@2023-09-01' = {
  parent: notificationHubNamespace
  name: notificationHubName
  location: location
  tags: tags
  properties: {
    apnsCredential: {
      properties: {
        // Configure APNS credentials for iOS push notifications
        // These will need to be set after deployment via Portal or CLI
      }
    }
    gcmCredential: {
      properties: {
        // Configure FCM credentials for Android push notifications
        // These will need to be set after deployment via Portal or CLI
      }
    }
  }
}

output notificationHubNamespaceName string = notificationHubNamespace.name
output notificationHubName string = notificationHub.name
output notificationHubEndpoint string = notificationHubNamespace.properties.serviceBusEndpoint
output notificationHubConnectionString string = listKeys(notificationHub.id, '2023-09-01').primaryConnectionString
