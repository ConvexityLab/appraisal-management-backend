// Key Vault Secrets Module
// Stores connection strings and secrets in Key Vault

@description('Key Vault name')
param keyVaultName string

@description('Storage account name for building connection string')
param storageAccountName string

@description('Application Insights instrumentation key')
param applicationInsightsKey string

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
    value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
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

// External API Keys (placeholder values)
resource googleMapsApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'google-maps-api-key'
  properties: {
    value: 'REPLACE_WITH_ACTUAL_GOOGLE_MAPS_API_KEY'
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource azureOpenAiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'azure-openai-api-key'
  properties: {
    value: 'REPLACE_WITH_ACTUAL_AZURE_OPENAI_API_KEY'
    contentType: 'api-key'
    attributes: {
      enabled: true
    }
  }
}

resource azureOpenAiEndpointSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'azure-openai-endpoint'
  properties: {
    value: 'REPLACE_WITH_ACTUAL_AZURE_OPENAI_ENDPOINT'
    contentType: 'url'
    attributes: {
      enabled: true
    }
  }
}

// Outputs
output secretNames array = [
  // Removed deprecated secrets that are replaced by managed identity:
  // - cosmosConnectionStringSecret (using managed identity)
  // - cosmosPrimaryKeySecret (using managed identity)
  // - serviceBusConnectionStringSecret (using managed identity)
  storageConnectionStringSecret.name
  appInsightsKeySecret.name
  jwtSecretSecret.name
  googleMapsApiKeySecret.name
  azureOpenAiApiKeySecret.name
  azureOpenAiEndpointSecret.name
]
