// Azure Static Web App Module
// Creates Static Web App resource - frontend code deployed from separate repo

@description('Environment name (dev, staging, prod)')
param environment string

@description('Location for the Static Web App')
param location string = 'eastus2'

@description('Static Web App name')
param staticWebAppName string = 'swa-appraisal-${environment}-${uniqueString(resourceGroup().id)}'

@description('Backend API URL (Container App URL)')
param backendApiUrl string

@description('Tags for the resource')
param tags object = {
  environment: environment
  project: 'appraisal-management'
  component: 'frontend'
}

@description('SKU for Static Web App')
@allowed([
  'Free'
  'Standard'
])
param sku string = environment == 'prod' ? 'Standard' : 'Free'

// Static Web App Resource
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    // Repository configuration - will be overridden by frontend repo deployment
    repositoryUrl: '' // Empty - frontend repo will link via deployment token
    branch: '' // Frontend repo will specify branch
    
    // Build configuration
    buildProperties: {
      skipGithubActionWorkflowGeneration: true // Frontend repo handles its own workflow
    }
    
    // Enterprise features (Standard SKU only)
    enterpriseGradeCdnStatus: sku == 'Standard' ? 'Enabled' : 'Disabled'
    allowConfigFileUpdates: true
    
    // Staging environments (Standard SKU only)
    stagingEnvironmentPolicy: sku == 'Standard' ? 'Enabled' : 'Disabled'
  }
}

// Configure API backend integration
resource staticWebAppConfig 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    // Environment variables available to frontend at build time
    VITE_API_URL: backendApiUrl
    REACT_APP_API_URL: backendApiUrl
    NEXT_PUBLIC_API_URL: backendApiUrl
    API_URL: backendApiUrl
  }
}

// Custom domain configuration (example - add your domains)
// resource customDomain 'Microsoft.Web/staticSites/customDomains@2023-01-01' = {
//   parent: staticWebApp
//   name: 'app.yourdomain.com'
//   properties: {}
// }

// Outputs
output staticWebAppId string = staticWebApp.id
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppDeploymentToken string = staticWebApp.listSecrets().properties.apiKey
output staticWebAppHostname string = staticWebApp.properties.defaultHostname

// Output these for frontend repo configuration
output frontendRepoSecrets object = {
  AZURE_STATIC_WEB_APPS_API_TOKEN: staticWebApp.listSecrets().properties.apiKey
  VITE_API_URL: backendApiUrl
}
