@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Location for all resources')
param location string = resourceGroup().location

@description('Name of the Cosmos DB account')
param cosmosDbAccountName string

@description('Email domain for notifications')
param emailDomain string

@description('Tags to apply to all resources')
param tags object = {
  environment: environmentName
  project: 'appraisal-management'
  component: 'communication-services'
}

var communicationServicesName = 'acs-appraisal-${environmentName}'
var notificationHubNamespaceName = 'nhns-appraisal-${environmentName}'
var notificationHubName = 'nh-appraisal-${environmentName}'

// Deploy Azure Communication Services
module communicationServices './communication-services.bicep' = {
  name: 'deploy-communication-services'
  params: {
    communicationServicesName: communicationServicesName
    location: location
    emailDomain: emailDomain
    tags: tags
  }
}

// Deploy Notification Hub
module notificationHub './notification-hub.bicep' = {
  name: 'deploy-notification-hub'
  params: {
    notificationHubNamespaceName: notificationHubNamespaceName
    notificationHubName: notificationHubName
    location: location
    sku: environmentName == 'prod' ? 'Standard' : 'Free'
    tags: tags
  }
}

// Deploy Cosmos DB containers for notifications
module cosmosContainers './cosmos-db-notification-containers.bicep' = {
  name: 'deploy-cosmos-notification-containers'
  params: {
    cosmosDbAccountName: cosmosDbAccountName
    databaseName: 'appraisal-management'
  }
}

output communicationServicesEndpoint string = communicationServices.outputs.communicationServicesEndpoint
output emailDomain string = communicationServices.outputs.emailDomain
output emailVerificationRecords object = communicationServices.outputs.emailDomainVerificationRecords
output notificationHubNamespace string = notificationHub.outputs.notificationHubNamespaceName
output notificationHubName string = notificationHub.outputs.notificationHubName
output notificationHubConnectionString string = notificationHub.outputs.notificationHubConnectionString

// Environment variables template for .env file
output envVariables object = {
  AZURE_COMMUNICATION_ENDPOINT: 'https://${communicationServices.outputs.communicationServicesEndpoint}'
  AZURE_COMMUNICATION_EMAIL_DOMAIN: communicationServices.outputs.emailDomain
  AZURE_NOTIFICATION_HUB_NAME: notificationHub.outputs.notificationHubName
  AZURE_NOTIFICATION_HUB_NAMESPACE: notificationHub.outputs.notificationHubNamespaceName
}
