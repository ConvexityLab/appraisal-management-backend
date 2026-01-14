// ============================================================================
// Azure Communication Services - Email Service Deployment
// ============================================================================
// Provisions Email Communication Service with Azure-managed domain
// Links to existing ACS resource for Teams channel notifications

@description('Azure region for resources')
param location string = 'unitedstates'

@description('Environment name (staging, production)')
param environment string = 'staging'

@description('Data location for email service')
param dataLocation string = 'United States'

@description('Existing ACS resource name to link')
param acsResourceName string = 'acs-appraisal-staging'

@description('Existing ACS resource group')
param acsResourceGroup string = resourceGroup().name

// ============================================================================
// Email Communication Service
// ============================================================================

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: 'email-appraisal-${environment}'
  location: 'global'
  properties: {
    dataLocation: dataLocation
  }
  tags: {
    environment: environment
    purpose: 'teams-notifications'
  }
}

// ============================================================================
// Azure-managed Email Domain
// ============================================================================

resource azureManagedDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

// ============================================================================
// Link Email Service to existing ACS Resource
// ============================================================================

resource existingAcs 'Microsoft.Communication/communicationServices@2023-04-01' existing = {
  name: acsResourceName
  scope: resourceGroup(acsResourceGroup)
}

resource emailLink 'Microsoft.Communication/communicationServices/linkedNotificationHubs@2020-08-20' = {
  parent: existingAcs
  name: 'email-link'
  properties: {
    resourceId: emailService.id
  }
}

// ============================================================================
// Outputs
// ============================================================================

output emailServiceName string = emailService.name
output emailServiceId string = emailService.id
output emailDomainName string = azureManagedDomain.name
output azureManagedEmailDomain string = 'DoNotReply@${azureManagedDomain.properties.fromSenderDomain}'
output emailEndpoint string = emailService.properties.endpoint

// Instructions for .env file
output envFileUpdate string = '''
Update .env with:
AZURE_COMMUNICATION_EMAIL_DOMAIN=DoNotReply@${azureManagedDomain.properties.fromSenderDomain}

REMINDER: For production, add custom domain loneanalytics.com:
1. Azure Portal → Email Communication Service
2. Provision domains → Add domain → loneanalytics.com
3. Complete DNS verification (TXT records)
4. Update .env: AZURE_COMMUNICATION_EMAIL_DOMAIN=DoNotReply@loneanalytics.com
'''
