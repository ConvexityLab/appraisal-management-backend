// ============================================================================
// Azure API Management (APIM)
// ============================================================================
// Gateway for API Container App and Function App Container App backends

@description('Environment name (dev, staging, prod)')
param environment string

@description('Azure region')
param location string = resourceGroup().location

@description('Resource name suffix for uniqueness')
param suffix string

@description('Tags for all resources')
param tags object = {}

@description('API Container App FQDN')
param apiContainerAppFqdn string

@description('Function Container App FQDN')
param functionContainerAppFqdn string

@description('Publisher email for APIM')
param publisherEmail string = 'admin@appraisal.platform'

@description('Publisher name for APIM')
param publisherName string = 'Appraisal Management Platform'

@description('APIM SKU name')
@allowed(['Consumption', 'Developer', 'Basic', 'Standard', 'Premium'])
param skuName string = 'Consumption'

@description('APIM SKU capacity (units)')
param skuCapacity int = 0 // 0 for Consumption tier

@description('Allowed CORS origins')
param allowedOrigins array = [
  'http://localhost:3000'
  'http://localhost:4200'
  'http://localhost:5173'
]

// Variables
var apimName = 'apim-appraisal-${environment}-${suffix}'
var apiBackendName = 'appraisal-api-backend'
var functionBackendName = 'appraisal-functions-backend'
var apiName = 'appraisal-management-api'
var functionApiName = 'appraisal-functions-api'

// APIM Service
resource apim 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: apimName
  location: location
  tags: tags
  sku: {
    name: skuName
    capacity: skuCapacity
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
    // TLS/SSL customProperties only supported in Developer, Standard, Premium tiers (not Consumption)
    customProperties: skuName != 'Consumption' ? {
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Ssl30': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls11': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Ssl30': 'False'
    } : {}
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Backend: API Container App
resource apiBackend 'Microsoft.ApiManagement/service/backends@2023-05-01-preview' = {
  parent: apim
  name: apiBackendName
  properties: {
    title: 'Appraisal API Backend'
    description: 'Main API Container App backend'
    url: 'https://${apiContainerAppFqdn}'
    protocol: 'http'
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
}

// Backend: Function Container App
resource functionBackend 'Microsoft.ApiManagement/service/backends@2023-05-01-preview' = {
  parent: apim
  name: functionBackendName
  properties: {
    title: 'Appraisal Functions Backend'
    description: 'Function App Container App backend'
    url: 'https://${functionContainerAppFqdn}/api'
    protocol: 'http'
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
}

// API: Main API - Import from OpenAPI spec
resource api 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apim
  name: apiName
  properties: {
    displayName: 'Appraisal Management API'
    description: 'Main REST API for appraisal management operations'
    path: ''  // No base path - swagger paths include /api
    protocols: ['https']
    subscriptionRequired: false
    serviceUrl: 'https://${apiContainerAppFqdn}'  // Swagger paths include /api
    type: 'http'
    format: 'openapi+json'
    value: loadTextContent('../api-swagger.json')
  }
}

// API Policy: No rewrite needed - paths in swagger already have /api prefix
resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: '<policies><inbound><base /><set-backend-service backend-id="${apiBackendName}" /><cors allow-credentials="true"><allowed-origins>${join(map(allowedOrigins, origin => '<origin>${origin}</origin>'), '')}</allowed-origins><allowed-methods><method>GET</method><method>POST</method><method>PUT</method><method>DELETE</method><method>PATCH</method><method>OPTIONS</method></allowed-methods><allowed-headers><header>*</header></allowed-headers><expose-headers><header>*</header></expose-headers></cors></inbound><backend><base /></backend><outbound><base /></outbound><on-error><base /></on-error></policies>'
  }
}

// API: Functions
resource functionApi 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apim
  name: functionApiName
  properties: {
    displayName: 'Appraisal Functions API'
    description: 'Serverless functions for background processing'
    path: 'functions'
    protocols: ['https']
    subscriptionRequired: false
    serviceUrl: 'https://${functionContainerAppFqdn}/api'
    type: 'http'
  }
}

// Function API Policy: Extract function name from path and rewrite
resource functionApiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: functionApi
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: '<policies><inbound><base /><set-backend-service backend-id="${functionBackendName}" /><rewrite-uri template="@{ string incomingPath = context.Request.Url.Path; string functionName = incomingPath.Split(\'/\').Last(); return $"/{functionName}"; }" /><cors allow-credentials="true"><allowed-origins>${join(map(allowedOrigins, origin => '<origin>${origin}</origin>'), '')}</allowed-origins><allowed-methods><method>GET</method><method>POST</method><method>PUT</method><method>DELETE</method><method>PATCH</method><method>OPTIONS</method></allowed-methods><allowed-headers><header>*</header></allowed-headers><expose-headers><header>*</header></expose-headers></cors></inbound><backend><base /></backend><outbound><base /></outbound><on-error><base /></on-error></policies>'
  }
}

// Function Operations: Single wildcard operation matching all function paths
resource functionsAllOps 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: functionApi
  name: 'functions-all'
  properties: {
    displayName: 'Azure Functions'
    method: '*'
    urlTemplate: '/{*path}'
    description: 'All Azure Functions'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: true
      }
    ]
  }
}

// Outputs
output apimName string = apim.name
output apimId string = apim.id
output apimGatewayUrl string = apim.properties.gatewayUrl
output apimPrincipalId string = apim.identity.principalId
output apiUrl string = '${apim.properties.gatewayUrl}/api'
output functionUrl string = '${apim.properties.gatewayUrl}/functions'
