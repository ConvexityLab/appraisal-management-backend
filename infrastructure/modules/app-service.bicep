// App Service Plan and Web App Module
// Deploys App Service Plan and Web App with managed identity

@description('The Azure region for deployment')
param location string

@description('Naming prefix for resources')
param namingPrefix string

@description('Environment name')
param environment string

@description('Tags to apply to resources')
param tags object

// Environment-specific configurations
var appServicePlanConfigs = {
  dev: {
    sku: 'B1'
    capacity: 1
    autoScale: false
  }
  staging: {
    sku: 'S2'
    capacity: 1
    autoScale: false
  }
  prod: {
    sku: 'P2v3'
    capacity: 2
    autoScale: true
  }
}

var config = appServicePlanConfigs[environment]

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namingPrefix}-plan'
  location: location
  tags: tags
  sku: {
    name: config.sku
    capacity: config.capacity
  }
  properties: {
    reserved: false // Windows
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
      nodeVersion: '18-lts'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~18'
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
      metadata: [
        {
          name: 'CURRENT_STACK'
          value: 'node'
        }
      ]
      alwaysOn: environment == 'prod'
      ftpsState: 'Disabled'
      httpLoggingEnabled: true
      detailedErrorLoggingEnabled: true
      requestTracingEnabled: true
    }
    httpsOnly: true
    clientAffinityEnabled: false
  }
}

// Auto-scaling settings for production
resource autoScaleSettings 'Microsoft.Insights/autoscalesettings@2022-10-01' = if (config.autoScale) {
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
          minimum: '2'
          maximum: '10'
          default: '2'
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
              threshold: 75
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
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
              threshold: 25
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
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
