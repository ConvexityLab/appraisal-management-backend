// Fluid Relay Module
// Deploys Azure Fluid Relay for real-time collaborative document editing
// Managed Identity is used by container apps to read keys via Key Vault — no secrets in env vars.

@description('The Azure region for deployment')
param location string

@description('Naming prefix for resources')
param namingPrefix string

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Tags to apply to resources')
param tags object

// Fluid Relay Server
resource fluidRelayServer 'Microsoft.FluidRelay/fluidRelayServers@2022-06-01' = {
  name: '${namingPrefix}-fluidrelay'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

// ─── Outputs ───────────────────────────────────────────────────────────────────
output fluidRelayName string = fluidRelayServer.name

// frsTenantId is the tenant identifier used in Fluid Relay JWT claims and client config
output fluidRelayTenantId string = fluidRelayServer.properties.frsTenantId

// Regional Fluid Relay orderer endpoint — corresponds to the resource location
// East US / East US 2 → us.fluidrelay.azure.com, etc.
output fluidRelayEndpoint string = 'https://${location == 'eastus' || location == 'eastus2' || location == 'centralus' ? 'us' : (location == 'westeurope' || location == 'northeurope' ? 'eu' : 'global')}.fluidrelay.azure.com'

// Primary tenant key — stored in Key Vault by key-vault-secrets module, never in env vars
output fluidRelayPrimaryKey string = fluidRelayServer.listKeys().key1
