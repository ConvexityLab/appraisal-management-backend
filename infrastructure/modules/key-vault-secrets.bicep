// Key Vault Secrets Module
// Stores connection strings and secrets in Key Vault

@description('Key Vault name')
param keyVaultName string

@description('Storage account name for building connection string')
param storageAccountName string

@description('Application Insights instrumentation key')
param applicationInsightsKey string

@secure()
@description('Google Maps API key')
param googleMapsApiKey string = ''

@secure()
@description('Azure OpenAI API key')
param azureOpenAiApiKey string = ''

@secure()
@description('Azure OpenAI endpoint')
param azureOpenAiEndpoint string = ''

@secure()
@description('Google Gemini API key')
param googleGeminiApiKey string = ''

@secure()
@description('Census Bureau API key')
param censusApiKey string = ''

@secure()
@description('Bridge Interactive MLS token')
param bridgeServerToken string = ''

@secure()
@description('National Park Service API key')
param npsApiKey string = ''

@secure()
@description('SambaNova API key')
param sambanovaApiKey string = ''

@secure()
@description('Azure Communication Services API key')
param azureCommunicationApiKey string = ''

@description('Azure Communication Services endpoint')
param azureCommunicationEndpoint string = ''

@description('Azure Tenant ID for Entra authentication')
param azureTenantId string = ''

@description('Azure Client ID (Application ID)')
param azureClientId string = ''

@secure()
@description('Azure Client Secret')
param azureClientSecret string = ''

// Reference existing resources to get their secrets
// cosmosAccount and serviceBusNamespace removed - using managed identity instead of keys

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-04-01' existing = {
  name: storageAccountName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Cosmos DB Connection String (DEPRECATED - Using Managed Identity)
// Kept only for emergency break-glass access
/*
resource cosmosConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-connection-string'
  properties: {
    value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
    contentType: 'connection-string'
    attributes: {
      enabled: true
    }
  }
}
*/

// Cosmos DB Primary Key (DEPRECATED - Using Managed Identity)
// Kept only for emergency break-glass access
/*
resource cosmosPrimaryKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'cosmos-primary-key'
  properties: {
    value: cosmosAccount.listKeys().primaryMasterKey
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}
*/

// Service Bus Connection String (DEPRECATED - Using Managed Identity)
// Kept only for emergency break-glass access
/*
resource serviceBusConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'servicebus-connection-string'
  properties: {
    value: listKeys('${serviceBusNamespace.id}/AuthorizationRules/RootManageSharedAccessKey', serviceBusNamespace.apiVersion).primaryConnectionString
    contentType: 'connection-string'
    attributes: {
      enabled: true
    }
  }
}
*/

// Storage Account Connection String
resource storageConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-connection-string'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'
    contentType: 'connection-string'
    attributes: {
      enabled: true
    }
  }
}

// Application Insights Instrumentation Key
resource appInsightsKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'appinsights-instrumentation-key'
  properties: {
    value: applicationInsightsKey
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

// JWT Secret for authentication
resource jwtSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-secret'
  properties: {
    value: base64(guid(resourceGroup().id, 'jwt-secret'))
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

// External API Keys (from secure parameters)
resource googleMapsApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(googleMapsApiKey)) {
  parent: keyVault
  name: 'google-maps-api-key'
  properties: {
    value: googleMapsApiKey
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource azureOpenAiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureOpenAiApiKey)) {
  parent: keyVault
  name: 'azure-openai-api-key'
  properties: {
    value: azureOpenAiApiKey
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource azureOpenAiEndpointSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureOpenAiEndpoint)) {
  parent: keyVault
  name: 'azure-openai-endpoint'
  properties: {
    value: azureOpenAiEndpoint
    contentType: 'url'
    attributes: {
      enabled: true
    }
  }
}

resource googleGeminiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(googleGeminiApiKey)) {
  parent: keyVault
  name: 'google-gemini-api-key'
  properties: {
    value: googleGeminiApiKey
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource censusApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(censusApiKey)) {
  parent: keyVault
  name: 'census-api-key'
  properties: {
    value: censusApiKey
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource bridgeServerTokenSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(bridgeServerToken)) {
  parent: keyVault
  name: 'bridge-server-token'
  properties: {
    value: bridgeServerToken
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource npsApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(npsApiKey)) {
  parent: keyVault
  name: 'nps-api-key'
  properties: {
    value: npsApiKey
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource sambanovaApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(sambanovaApiKey)) {
  parent: keyVault
  name: 'sambanova-api-key'
  properties: {
    value: sambanovaApiKey
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource azureCommunicationApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureCommunicationApiKey)) {
  parent: keyVault
  name: 'azure-communication-api-key'
  properties: {
    value: azureCommunicationApiKey
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource azureCommunicationEndpointSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureCommunicationEndpoint)) {
  parent: keyVault
  name: 'azure-communication-endpoint'
  properties: {
    value: azureCommunicationEndpoint
    contentType: 'url'
    attributes: {
      enabled: true
    }
  }
}

resource azureTenantIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureTenantId)) {
  parent: keyVault
  name: 'azure-tenant-id'
  properties: {
    value: azureTenantId
    contentType: 'guid'
    attributes: {
      enabled: true
    }
  }
}

resource azureClientIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureClientId)) {
  parent: keyVault
  name: 'azure-client-id'
  properties: {
    value: azureClientId
    contentType: 'guid'
    attributes: {
      enabled: true
    }
  }
}

resource azureClientSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureClientSecret)) {
  parent: keyVault
  name: 'azure-client-secret'
  properties: {
    value: azureClientSecret
    contentType: 'password'
    attributes: {
      enabled: true
    }
  }
}

// Outputs
output secretNames array = concat(
  [
    // Core secrets (always created)
    storageConnectionStringSecret.name
    appInsightsKeySecret.name
    jwtSecretSecret.name
  ],
  // API keys (conditionally created)
  !empty(googleMapsApiKey) ? [googleMapsApiKeySecret.name] : [],
  !empty(azureOpenAiApiKey) ? [azureOpenAiApiKeySecret.name] : [],
  !empty(azureOpenAiEndpoint) ? [azureOpenAiEndpointSecret.name] : [],
  !empty(googleGeminiApiKey) ? [googleGeminiApiKeySecret.name] : [],
  !empty(censusApiKey) ? [censusApiKeySecret.name] : [],
  !empty(bridgeServerToken) ? [bridgeServerTokenSecret.name] : [],
  !empty(npsApiKey) ? [npsApiKeySecret.name] : [],
  !empty(sambanovaApiKey) ? [sambanovaApiKeySecret.name] : [],
  !empty(azureCommunicationApiKey) ? [azureCommunicationApiKeySecret.name] : [],
  !empty(azureCommunicationEndpoint) ? [azureCommunicationEndpointSecret.name] : [],
  !empty(azureTenantId) ? [azureTenantIdSecret.name] : [],
  !empty(azureClientId) ? [azureClientIdSecret.name] : [],
  !empty(azureClientSecret) ? [azureClientSecretSecret.name] : []
)
