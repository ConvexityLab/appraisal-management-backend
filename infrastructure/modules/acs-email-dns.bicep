// ============================================================================
// ACS Email Domain DNS Verification
// ============================================================================
// Automatically creates DNS records for ACS Email domain verification
// Requires: Azure DNS zone for the domain

@description('DNS zone name (e.g., loneanalytics.com)')
param dnsZoneName string

@description('Email domain verification records from ACS')
param verificationRecords object

// Helper function to extract subdomain from full domain name
// If record name ends with the zone name, return only the subdomain part
// Otherwise return the full name (for DKIM selectors)
var domainRecordName = endsWith(verificationRecords.Domain.name, dnsZoneName) 
  ? replace(verificationRecords.Domain.name, '.${dnsZoneName}', '')
  : verificationRecords.Domain.name

// Reference existing DNS zone (in same resource group as this deployment)
resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' existing = {
  name: dnsZoneName
}

// Combined Domain verification + SPF TXT record (both use same subdomain)
// Azure requires single TXT resource with multiple values, not separate resources
resource domainAndSpfTxt 'Microsoft.Network/dnsZones/TXT@2018-05-01' = {
  name: '${dnsZoneName}/${domainRecordName}'
  properties: {
    TTL: verificationRecords.Domain.ttl
    TXTRecords: [
      {
        value: [verificationRecords.Domain.value]
      }
      {
        value: [verificationRecords.SPF.value]
      }
    ]
  }
}

// DKIM1 CNAME record (selector only, not full domain)
resource dkim1Cname 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = {
  name: '${dnsZoneName}/${verificationRecords.DKIM.name}'
  properties: {
    TTL: verificationRecords.DKIM.ttl
    CNAMERecord: {
      cname: verificationRecords.DKIM.value
    }
  }
}

// DKIM2 CNAME record (selector only, not full domain)
resource dkim2Cname 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = {
  name: '${dnsZoneName}/${verificationRecords.DKIM2.name}'
  properties: {
    TTL: verificationRecords.DKIM2.ttl
    CNAMERecord: {
      cname: verificationRecords.DKIM2.value
    }
  }
}

output domainVerified bool = true
output dnsRecordsCreated array = [
  domainAndSpfTxt.name
  dkim1Cname.name
  dkim2Cname.name
]
