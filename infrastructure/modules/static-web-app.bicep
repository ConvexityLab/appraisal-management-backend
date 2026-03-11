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

// NOTE: No appsettings resource here.
// VITE_* variables are baked at BUILD TIME by Vite — they cannot be injected at runtime
// via SWA appsettings. The frontend CI workflow resolves the Container App FQDN dynamically
// using `az containerapp list` and passes it as VITE_API_BASE_URL during `pnpm run build`.
// The backendApiUrl param is retained so frontendRepoSecrets can surface the URL for ops use.

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
