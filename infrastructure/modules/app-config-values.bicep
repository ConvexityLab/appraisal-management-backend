// App Configuration Values Module
//
// Declaratively writes a set of {key: value} pairs into an existing Azure App
// Configuration store under a specific label. Replaces the manual
// `az appconfig kv set` workflow with infra-as-code: every infra deploy
// reconciles the App Config contents to match the declarations here.
//
// Idempotency: Container Apps' keyValues resources are upserts. Re-deploying
// with the same value is a no-op. Changing a value updates the existing key.
// Removing a key from this module does NOT delete it from App Config (bicep
// incremental mode); orphans need manual `az appconfig kv delete`.
//
// Usage from main.bicep:
//   module appConfigValues 'modules/app-config-values.bicep' = {
//     name: 'app-config-values-deployment'
//     scope: resourceGroup
//     params: {
//       appConfigName: appConfig.outputs.appConfigName
//       label: environment
//       keyValues: union(envSpecificValues, computedValues)
//     }
//   }

@description('Name of the existing App Configuration store.')
param appConfigName string

@description('Label to apply to all key-values written by this module (e.g. dev, staging, prod). The loader reads with this label.')
param label string

@description('Map of App Config keys to values to write. Keys typically follow the dotted convention services.<service>.<attr>.')
param keyValues object

resource appConfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' existing = {
  name: appConfigName
}

// Bicep keyValues resource name uses the syntax `<key>$<label>`.
// Iterate the keyValues object and emit one resource per entry.
resource kv 'Microsoft.AppConfiguration/configurationStores/keyValues@2023-03-01' = [for entry in items(keyValues): {
  parent: appConfig
  name: '${entry.key}$${label}'
  properties: {
    value: entry.value
    contentType: ''
  }
}]

@description('Count of key-values written (for verification in deployment outputs).')
output keyValueCount int = length(items(keyValues))
