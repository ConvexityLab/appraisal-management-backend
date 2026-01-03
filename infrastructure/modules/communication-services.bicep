@description('Name for the Azure Communication Services resource')
param communicationServicesName string

@description('Location for the resource')
param location string = resourceGroup().location

@description('Email domain for sender addresses')
param emailDomain string = 'noreply@appraisal.platform'

@description('Tags to apply to all resources')
param tags object = {}

resource communicationServices 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: communicationServicesName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
  }
}

resource emailServices 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${communicationServicesName}-email'
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
  }
}

resource emailServicesDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailServices
  name: emailDomain
  location: 'global'
  tags: tags
  properties: {
    domainManagement: 'CustomerManaged'
    userEngagementTracking: 'Enabled'
  }
}

// Link email domain to Communication Services
resource emailDomainLink 'Microsoft.Communication/communicationServices/domains@2023-04-01' = {
  parent: communicationServices
  name: emailDomain
  properties: {
    domainName: emailServicesDomain.name
  }
}

output communicationServicesEndpoint string = communicationServices.properties.hostName
output communicationServicesResourceId string = communicationServices.id
output emailDomain string = emailServicesDomain.name
output emailDomainVerificationRecords object = {
  txt: emailServicesDomain.properties.verificationRecords.Domain.type
  dkim1: emailServicesDomain.properties.verificationRecords.DKIM.type
  dkim2: emailServicesDomain.properties.verificationRecords.DKIM2.type
}
