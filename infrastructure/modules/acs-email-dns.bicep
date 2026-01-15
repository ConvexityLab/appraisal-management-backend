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

var spfRecordName = endsWith(verificationRecords.SPF.name, dnsZoneName)
  ? replace(verificationRecords.SPF.name, '.${dnsZoneName}', '')
  : verificationRecords.SPF.name

// Reference existing DNS zone (in same resource group as this deployment)
resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' existing = {
  name: dnsZoneName
}

// Domain verification TXT record
resource domainVerificationTxt 'Microsoft.Network/dnsZones/TXT@2018-05-01' = {
  name: '${dnsZoneName}/${domainRecordName}'
  properties: {
    TTL: verificationRecords.Domain.ttl
    TXTRecords: [
      {
        value: [verificationRecords.Domain.value]
      }
    ]
  }
}

// SPF TXT record
resource spfTxt 'Microsoft.Network/dnsZones/TXT@2018-05-01' = {
  name: '${dnsZoneName}/${spfRecordName}'
  properties: {
    TTL: verificationRecords.SPF.ttl
    TXTRecords: [
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
  domainVerificationTxt.name
  spfTxt.name
  dkim1Cname.name
  dkim2Cname.name
]
