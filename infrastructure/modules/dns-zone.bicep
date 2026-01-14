// ============================================================================
// DNS Zone Module
// ============================================================================
// Creates Azure DNS zone for custom domain management

@description('DNS zone name (e.g., appraisal.platform)')
param dnsZoneName string

@description('Tags to apply to resources')
param tags object = {}

// Create DNS zone
resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' = {
  name: dnsZoneName
  location: 'global'
  tags: tags
  properties: {
    zoneType: 'Public'
  }
}

// Output nameservers for registrar configuration
output dnsZoneId string = dnsZone.id
output nameServers array = dnsZone.properties.nameServers
output dnsZoneName string = dnsZone.name

// Instructions for domain registrar
output registrarInstructions string = '''
Configure these nameservers at your domain registrar:
${join(dnsZone.properties.nameServers, '\n')}

This typically takes 24-48 hours to propagate.
'''
