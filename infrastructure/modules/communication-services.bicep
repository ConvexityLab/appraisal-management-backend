@description('Name for the Azure Communication Services resource')
param communicationServicesName string

@description('Tags to apply to all resources')
param tags object = {}

resource emailServices 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${communicationServicesName}-email'
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
  }
}

// Azure-managed domain — fully verified by Microsoft, no DNS records required.
// Sender address format: DoNotReply@<fromSenderDomain>
resource azureManagedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailServices
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

// ACS resource. linkedDomains authorises AzureManagedDomain as an allowed sender.
// Without this, every send fails with "The specified sender domain has not been linked".
// Bicep automatically places communicationServices after azureManagedDomain due to the
// reference in linkedDomains — no explicit dependsOn required.
resource communicationServices 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: communicationServicesName
  location: 'global'
  tags: tags
  properties: {
    dataLocation: 'United States'
    linkedDomains: [azureManagedDomain.id]
  }
}

output communicationServicesEndpoint string = communicationServices.properties.hostName
output communicationServicesResourceId string = communicationServices.id
// Full sender address ready to use as AZURE_COMMUNICATION_EMAIL_DOMAIN
output emailDomain string = 'DoNotReply@${azureManagedDomain.properties.fromSenderDomain}'
