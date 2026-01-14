@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Location for all resources')
param location string = resourceGroup().location

@description('Name of the Cosmos DB account')
param cosmosDbAccountName string

@description('Email domain for notifications')
param emailDomain string

@description('Whether to auto-configure DNS records (requires Azure DNS)')
param autoConfigureDns bool = false

@description('DNS zone resource group (if different from current)')
param dnsZoneResourceGroup string = resourceGroup().name

@description('Tags to apply to all resources')
param tags object = {
  environment: environmentName
  project: 'appraisal-management'
  component: 'communication-services'
}

var communicationServicesName = 'acs-appraisal-${environmentName}'

// Create DNS zone if auto-configuration is enabled
module dnsZone './dns-zone.bicep' = if (autoConfigureDns && !empty(emailDomain)) {
  name: 'create-dns-zone'
  params: {
    dnsZoneName: emailDomain
    tags: tags
  }
}

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

// Configure DNS records for email domain verification (depends on DNS zone)
module emailDns './acs-email-dns.bicep' = if (autoConfigureDns && !empty(emailDomain)) {
  name: 'configure-email-dns'
  scope: resourceGroup(dnsZoneResourceGroup)
  dependsOn: [
    dnsZone
  ]
  params: {
    dnsZoneName: emailDomain
    verificationRecords: communicationServices.outputs.emailDomainVerificationRecords
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
output emailDomain string = communicationServices.outputs.emailDomain
output emailVerificationRecords object = communicationServices.outputs.emailDomainVerificationRecords
output dnsZoneNameServers array = (autoConfigureDns && !empty(emailDomain) && dnsZone != null) ? dnsZone.outputs.nameServers : []
output dnsZoneCreated bool = autoConfigureDns && !empty(emailDomain)
output dnsConfigurationInstructions string = (autoConfigureDns && !empty(emailDomain) && dnsZone != null) ? dnsZone.outputs.registrarInstructions : 'DNS zone not created - set autoConfigureDns=true and provide emailDomain'

// Environment variables template for .env file
output envVariables object = {
  AZURE_COMMUNICATION_ENDPOINT: 'https://${communicationServices.outputs.communicationServicesEndpoint}'
  AZURE_COMMUNICATION_EMAIL_DOMAIN: communicationServices.outputs.emailDomain
}
