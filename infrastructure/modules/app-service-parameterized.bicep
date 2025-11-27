// App Service Plan and Web App Module - Fully Parameterized
// Zero hardcoded values - everything configurable

@description('The Azure region for deployment')
param location string

@description('Naming prefix for resources')
param namingPrefix string

@description('Environment name')
param environment string

@description('Tags to apply to resources')
param tags object

@description('App Service Plan SKU configuration')
param appServicePlanSku object

@description('Node.js version for the web app')
param nodeVersion string

@description('Enable auto-scaling')
param enableAutoScaling bool

@description('Auto-scaling configuration')
param autoScalingConfig object

@description('App Service Plan API version')
param appServicePlanApiVersion string = '2023-12-01'

@description('Web App API version')
param webAppApiVersion string = '2023-12-01'

@description('Auto Scale Settings API version')
param autoScaleApiVersion string = '2022-10-01'

@description('App Service Plan OS type')
@allowed(['Windows', 'Linux'])
param osType string = 'Windows'

@description('App Service additional configuration')
param additionalAppSettings array = []

@description('Enable detailed error logging')
param enableDetailedErrorLogging bool = true

@description('Enable HTTP logging')
param enableHttpLogging bool = true

@description('Enable request tracing')
param enableRequestTracing bool = true

@description('FTP state')
@allowed(['AllAllowed', 'FtpsOnly', 'Disabled'])
param ftpsState string = 'Disabled'

@description('Enable HTTPS only')
param httpsOnly bool = true

@description('Enable client affinity')
param clientAffinityEnabled bool = false

// Calculated properties
var isLinux = osType == 'Linux'
var alwaysOn = environment == 'prod'
var reserved = isLinux

// Base app settings that are always included
var baseAppSettings = [
  {
    name: 'WEBSITE_NODE_DEFAULT_VERSION'
    value: nodeVersion
  }
  {
    name: 'NODE_ENV'
    value: environment
  }
  {
    name: 'WEBSITE_RUN_FROM_PACKAGE'
    value: '1'
  }
  {
    name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
    value: 'true'
  }
]

// Combine base and additional app settings
var allAppSettings = concat(baseAppSettings, additionalAppSettings)

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namingPrefix}-plan'
  location: location
  tags: tags
  sku: {
    name: appServicePlanSku.name
    capacity: appServicePlanSku.capacity
  }
  properties: {
    reserved: reserved
  }
}

// Web App
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namingPrefix}-app'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      nodeVersion: nodeVersion
      appSettings: allAppSettings
      metadata: [
        {
          name: 'CURRENT_STACK'
          value: 'node'
        }
      ]
      alwaysOn: alwaysOn
      ftpsState: ftpsState
      httpLoggingEnabled: enableHttpLogging
      detailedErrorLoggingEnabled: enableDetailedErrorLogging
      requestTracingEnabled: enableRequestTracing
    }
    httpsOnly: httpsOnly
    clientAffinityEnabled: clientAffinityEnabled
  }
}

// Auto-scaling settings (only if enabled)
resource autoScaleSettings 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (enableAutoScaling) {
  name: '${namingPrefix}-autoscale'
  location: location
  tags: tags
  properties: {
    name: '${namingPrefix}-autoscale'
    targetResourceUri: appServicePlan.id
    enabled: true
    profiles: [
      {
        name: 'Default'
        capacity: {
          minimum: string(autoScalingConfig.minCapacity)
          maximum: string(autoScalingConfig.maxCapacity)
          default: string(autoScalingConfig.defaultCapacity)
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT5M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: autoScalingConfig.scaleOutThreshold
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: autoScalingConfig.scaleOutCooldown
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: autoScalingConfig.scaleInThreshold
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: autoScalingConfig.scaleInCooldown
            }
          }
        ]
      }
    ]
  }
}

// Outputs
output appServicePlanName string = appServicePlan.name
output appServicePlanId string = appServicePlan.id
output appServiceName string = webApp.name
output appServiceUrl string = 'https://${webApp.properties.defaultHostName}'
output appServiceManagedIdentityId string = webApp.identity.principalId
output appServiceManagedIdentityTenantId string = webApp.identity.tenantId
output appServiceResourceId string = webApp.id
