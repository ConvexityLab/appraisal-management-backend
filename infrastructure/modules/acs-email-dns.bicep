// ============================================================================
// ACS Email Domain DNS Verification
// ============================================================================
// Automatically creates DNS records for ACS Email domain verification
// Requires: Azure DNS zone for the domain

@description('DNS zone name (e.g., loneanalytics.com)')
param dnsZoneName string

@description('Email domain verification records from ACS')
param verificationRecords object

// Reference existing DNS zone (in same resource group as this deployment)
resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' existing = {
  name: dnsZoneName
}

// Domain verification TXT record
resource domainVerificationTxt 'Microsoft.Network/dnsZones/TXT@2018-05-01' = {
  parent: dnsZone
  name: verificationRecords.Domain.name
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
  parent: dnsZone
  name: verificationRecords.SPF.name
  properties: {
    TTL: verificationRecords.SPF.ttl
    TXTRecords: [
      {
        value: [verificationRecords.SPF.value]
      }
    ]
  }
}

// DKIM1 CNAME record
resource dkim1Cname 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = {
  parent: dnsZone
  name: verificationRecords.DKIM.name
  properties: {
    TTL: verificationRecords.DKIM.ttl
    CNAMERecord: {
      cname: verificationRecords.DKIM.value
    }
  }
}

// DKIM2 CNAME record
resource dkim2Cname 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = {
  parent: dnsZone
  name: verificationRecords.DKIM2.name
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
