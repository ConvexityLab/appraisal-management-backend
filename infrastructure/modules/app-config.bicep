// App Configuration Module — Appraisal Management Platform
// Deploys our own Azure App Configuration store within our resource group.
// Container Apps read service-discovery values (e.g. AXIOM_API_BASE_URL) at
// startup via Managed Identity — no connection strings or keys required.

@description('Azure region')
param location string

@description('Naming prefix for the store (e.g. appraisal-mgmt-staging)')
param namingPrefix string

@description('Environment name (dev, staging, prod)')
param environment string

@description('Tags to apply to resources')
param tags object

@description('Axiom API base URL to seed into App Config under key "services.axiom-api.base-url". Leave empty to skip seeding this key.')
param axiomApiBaseUrl string = ''

// SKU: Free tier has 1 req/s and 10 MB limit — fine for dev.
// Standard is required for prod/staging (geo-replication, higher limits, soft-delete).
var sku = environment == 'prod' || environment == 'staging' ? 'Standard' : 'Free'

// Name: 5-50 chars, alphanumeric + hyphens. Must be globally unique.
// 'appcfg-' (7) + take(namingPrefix, 24) (≤24) + '-' + take(unique, 6) (6) = ≤38 chars.
var appConfigName = 'appcfg-${take(namingPrefix, 24)}-${take(uniqueString(resourceGroup().id, 'appconfig'), 6)}'

resource appConfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' = {
  name: appConfigName
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    // Managed Identity resolves access — disable local auth (key-based access)
    // to enforce Managed Identity usage per platform policy.
    disableLocalAuth: true
    // Soft-delete: enabled on Standard only (not available on Free)
    enablePurgeProtection: sku == 'Standard'
    softDeleteRetentionInDays: sku == 'Standard' ? 7 : null
    publicNetworkAccess: 'Enabled'
  }
}

// Seed service-discovery key-values. The child resource name format is
// "{key}${label}" where "$" is a literal separator (not string interpolation).
// ARM management-plane writes are NOT affected by disableLocalAuth (data plane only).
resource axiomBaseUrlKv 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = if (!empty(axiomApiBaseUrl)) {
  parent: appConfig
  // "$$" in Bicep string: first "$" is treated as literal (next char is "$" not "{"),
  // second "${environment}" is normal interpolation → produces "key$label" e.g. "services.axiom-api.base-url$staging"
  name: 'services.axiom-api.base-url$${environment}'
  properties: {
    value: axiomApiBaseUrl
    // contentType left empty — plain string (not JSON, not Key Vault ref)
  }
}

@description('App Configuration store name')
output appConfigName string = appConfig.name

@description('App Configuration endpoint — pass as APP_CONFIG_ENDPOINT env var to Container Apps')
output appConfigEndpoint string = appConfig.properties.endpoint

@description('App Configuration resource ID — used for role assignments')
output appConfigId string = appConfig.id
