@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Location for all resources')
param location string = resourceGroup().location

@description('Name of the Cosmos DB account')
param cosmosDbAccountName string

@description('Tags to apply to all resources')
param tags object = {
  environment: environmentName
  project: 'appraisal-management'
  component: 'communication-services'
}

var communicationServicesName = 'acs-appraisal-${environmentName}'

// Deploy Azure Communication Services with Azure-managed email domain
module communicationServices './communication-services.bicep' = {
  name: 'deploy-communication-services'
  params: {
    communicationServicesName: communicationServicesName
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
output communicationServicesName string = communicationServicesName
// Full DoNotReply@<azurecomm.net> sender address — use as AZURE_COMMUNICATION_EMAIL_DOMAIN
output emailDomain string = communicationServices.outputs.emailDomain
// Azure-managed domain is always verified; no DNS records to distribute
output emailVerificationRecords object = {}

// App setting values for .env and Container App configuration
output envVariables object = {
  AZURE_COMMUNICATION_ENDPOINT: 'https://${communicationServices.outputs.communicationServicesEndpoint}'
  AZURE_COMMUNICATION_EMAIL_DOMAIN: communicationServices.outputs.emailDomain
}
