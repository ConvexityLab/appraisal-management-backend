// ============================================================================
// ACS Email Domain DNS Verification
// ============================================================================
// Automatically creates DNS records for ACS Email domain verification
// Requires: Azure DNS zone for the domain

@description('DNS zone name (e.g., loneanalytics.com)')
param dnsZoneName string

@description('Email domain verification records from ACS')
param verificationRecords object

@description('Resource group containing the DNS zone')
param dnsZoneResourceGroup string = resourceGroup().name

// Reference existing DNS zone
resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' existing = {
  name: dnsZoneName
  scope: resourceGroup(dnsZoneResourceGroup)
}

// Domain verification TXT record
resource domainVerificationTxt 'Microsoft.Network/dnsZones/TXT@2018-05-01' = {
  parent: dnsZone
  name: '@'
  properties: {
    TTL: 3600
    TXTRecords: [
      {
        value: [verificationRecords.txt]
      }
    ]
  }
}

// DKIM1 CNAME record
resource dkim1Cname 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = {
  parent: dnsZone
  name: 'selector1-azurecomm-prod-net._domainkey'
  properties: {
    TTL: 3600
    CNAMERecord: {
      cname: verificationRecords.dkim1
    }
  }
}

// DKIM2 CNAME record
resource dkim2Cname 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = {
  parent: dnsZone
  name: 'selector2-azurecomm-prod-net._domainkey'
  properties: {
    TTL: 3600
    CNAMERecord: {
      cname: verificationRecords.dkim2
    }
  }
}

output domainVerified bool = true
output dnsRecordsCreated array = [
  domainVerificationTxt.name
  dkim1Cname.name
  dkim2Cname.name
]
