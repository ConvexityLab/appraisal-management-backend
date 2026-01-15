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
    url: 'https://${functionContainerAppFqdn}'
    protocol: 'http'
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
}

// API: Main API
resource api 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apim
  name: apiName
  properties: {
    displayName: 'Appraisal Management API'
    description: 'Main REST API for appraisal management operations'
    path: 'api'  // Base path for all API routes
    protocols: ['https']
    subscriptionRequired: false
    serviceUrl: 'https://${apiContainerAppFqdn}'
    type: 'http'
  }
}

// API Policy: Route /api/* to API Container App backend
resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: '<policies><inbound><base /><set-backend-service backend-id="${apiBackendName}" /><rewrite-uri template="@(&quot;/api&quot; + context.Operation.UrlTemplate)" /><cors allow-credentials="true"><allowed-origins>${join(map(allowedOrigins, origin => '<origin>${origin}</origin>'), '')}</allowed-origins><allowed-methods><method>GET</method><method>POST</method><method>PUT</method><method>DELETE</method><method>PATCH</method><method>OPTIONS</method></allowed-methods><allowed-headers><header>*</header></allowed-headers><expose-headers><header>*</header></expose-headers></cors></inbound><backend><base /></backend><outbound><base /></outbound><on-error><base /></on-error></policies>'
  }
}

// API Operations: Auth endpoints
resource authOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'auth-operations'
  properties: {
    displayName: 'Authentication Operations'
    method: '*'
    urlTemplate: '/auth/{*path}'
    description: 'Login, register, token refresh'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API Operations: Orders
resource ordersOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'orders-operations'
  properties: {
    displayName: 'Order Management'
    method: '*'
    urlTemplate: '/orders/{*path}'
    description: 'CRUD operations for appraisal orders'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API Operations: QC
resource qcOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'qc-operations'
  properties: {
    displayName: 'Quality Control'
    method: '*'
    urlTemplate: '/qc/{*path}'
    description: 'QC validation and metrics'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API Operations: Vendors
resource vendorsOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'vendors-operations'
  properties: {
    displayName: 'Vendor Management'
    method: '*'
    urlTemplate: '/vendors/{*path}'
    description: 'Vendor CRUD and assignment'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API Operations: Analytics
resource analyticsOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'analytics-operations'
  properties: {
    displayName: 'Analytics'
    method: '*'
    urlTemplate: '/analytics/{*path}'
    description: 'Performance and overview analytics'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API Operations: Property Intelligence
resource propertyOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'property-operations'
  properties: {
    displayName: 'Property Intelligence'
    method: '*'
    urlTemplate: '/property-intelligence/{*path}'
    description: 'Property analysis, geocoding, census data'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API Operations: AI/ML Services
resource aiOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'ai-operations'
  properties: {
    displayName: 'AI/ML Services'
    method: '*'
    urlTemplate: '/ai/{*path}'
    description: 'AI-powered QC, market insights, vision analysis'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API Operations: Dynamic Code Execution
resource codeOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'code-operations'
  properties: {
    displayName: 'Code Execution'
    method: '*'
    urlTemplate: '/code/{*path}'
    description: 'Sandboxed code execution'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API Operations: Teams Integration
resource teamsOperations 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'teams-operations'
  properties: {
    displayName: 'Teams Integration'
    method: '*'
    urlTemplate: '/teams/{*path}'
    description: 'Microsoft Teams notifications and integration'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API Operations: Health check
resource healthOperation 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'health-operation'
  properties: {
    displayName: 'Health Check'
    method: 'GET'
    urlTemplate: '/health'
    description: 'Service health status'
  }
}

// API Operations: API Documentation
resource apiDocsOperation 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: api
  name: 'api-docs-operation'
  properties: {
    displayName: 'API Documentation'
    method: 'GET'
    urlTemplate: '/-docs/{*path}'
    description: 'Swagger/OpenAPI documentation'
    templateParameters: [
      {
        name: 'path'
        type: 'string'
        required: false
      }
    ]
  }
}

// API: Functions
resource functionApi 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apim
  name: functionApiName
  properties: {
    displayName: 'Appraisal Functions API'
    description: 'Serverless functions for background processing'
    path: 'api/functions'  // Distinct path to avoid conflict with main API
    protocols: ['https']
    subscriptionRequired: false
    serviceUrl: 'https://${functionContainerAppFqdn}'
    type: 'http'
  }
}

// Function API Policy: Route /api/functions/* to Function Container App backend, strip /functions prefix
resource functionApiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: functionApi
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: '<policies><inbound><base /><set-backend-service backend-id="${functionBackendName}" /><set-variable name="functionPath" value="@(context.Operation.UrlTemplate.Replace(&quot;/{*path}&quot;, &quot;&quot;))" /><rewrite-uri template="@(&quot;/api&quot; + context.Request.Url.Path.Replace(&quot;/api/functions&quot;, &quot;&quot;))" /><cors allow-credentials="true"><allowed-origins>${join(map(allowedOrigins, origin => '<origin>${origin}</origin>'), '')}</allowed-origins><allowed-methods><method>GET</method><method>POST</method><method>PUT</method><method>DELETE</method><method>PATCH</method><method>OPTIONS</method></allowed-methods><allowed-headers><header>*</header></allowed-headers><expose-headers><header>*</header></expose-headers></cors></inbound><backend><base /></backend><outbound><base /></outbound><on-error><base /></on-error></policies>'
  }
}

// Function Operations: All Azure Functions (getOrder, createOrder, etc.)
resource functionsAllOps 'Microsoft.ApiManagement/service/apis/operations@2023-05-01-preview' = {
  parent: functionApi
  name: 'functions-all'
  properties: {
    displayName: 'Azure Functions'
    method: '*'
    urlTemplate: '/{*path}'
    description: 'All Azure Functions (getOrder, createOrder, geocodeAddress, etc.)'
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
