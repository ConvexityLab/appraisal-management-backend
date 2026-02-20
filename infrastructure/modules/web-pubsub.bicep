// Web PubSub Module
// Deploys Azure Web PubSub for real-time WebSocket notifications

@description('The Azure region for deployment')
param location string

@description('Naming prefix for resources')
param namingPrefix string

@description('Environment name')
param environment string

@description('Tags to apply to resources')
param tags object

// Environment-specific configurations
var webPubSubConfigs = {
  dev: {
    sku: 'Free_F1'
    capacity: 1
  }
  staging: {
    sku: 'Standard_S1'
    capacity: 1
  }
  prod: {
    sku: 'Standard_S1'
    capacity: 2
  }
}

var config = webPubSubConfigs[environment]

// Web PubSub resource
resource webPubSub 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: '${namingPrefix}-webpubsub'
  location: location
  tags: tags
  sku: {
    name: config.sku
    capacity: config.capacity
  }
  properties: {
    tls: {
      clientCertEnabled: false
    }
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    disableAadAuth: false
  }
}

// Hub for appraisal notifications
resource notificationsHub 'Microsoft.SignalRService/webPubSub/hubs@2024-03-01' = {
  parent: webPubSub
  name: 'appraisal-notifications'
  properties: {
    anonymousConnectPolicy: 'deny'
    eventHandlers: []
    eventListeners: []
  }
}

// Outputs
output webPubSubName string = webPubSub.name
output webPubSubId string = webPubSub.id
output webPubSubHostName string = webPubSub.properties.hostName
output webPubSubEndpoint string = 'https://${webPubSub.properties.hostName}'
