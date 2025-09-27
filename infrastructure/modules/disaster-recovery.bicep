// Disaster Recovery Module - Backup and DR services
// Includes backup configurations, geo-replication, and disaster recovery setup

param location string
param primaryLocation string
param environment string
param suffix string
param tags object
param primarySqlServerName string
param primaryStorageAccountName string

@secure()
param drSqlAdminPassword string = ''

// Variables
var drSqlServerName = 'sql-appraisal-dr-${environment}-${suffix}'
var drStorageAccountName = 'stadrappraisal${environment}${take(suffix, 8)}'
var recoveryVaultName = 'rsv-appraisal-${environment}-${suffix}'

// Recovery Services Vault for backup
resource recoveryServicesVault 'Microsoft.RecoveryServices/vaults@2023-06-01' = {
  name: recoveryVaultName
  location: location
  tags: tags
  sku: {
    name: 'RS0'
    tier: 'Standard'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    restoreSettings: {
      crossSubscriptionRestoreSettings: {
        crossSubscriptionRestoreState: 'Disabled'
      }
    }
    // redundancySettings are read-only properties configured at vault creation
    securitySettings: {
      immutabilitySettings: {
        state: 'Disabled'
      }
      softDeleteSettings: {
        softDeleteRetentionPeriodInDays: 14
        softDeleteState: 'Enabled'
      }
    }
  }
}

// DR SQL Server (for production environments)
resource drSqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = if (environment == 'prod') {
  name: drSqlServerName
  location: location
  tags: tags
  properties: {
    administratorLogin: 'sqladmin'
    administratorLoginPassword: drSqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: 'Disabled'
  }
}

// DR SQL Server firewall rules
resource drSqlServerFirewallRuleAzure 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = if (environment == 'prod') {
  parent: drSqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// DR Storage Account
resource drStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: drStorageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_GRS' // Always geo-redundant for DR
  }
  kind: 'StorageV2'
  properties: {
    dnsEndpointType: 'Standard'
    defaultToOAuthAuthentication: false
    publicNetworkAccess: 'Enabled'
    allowCrossTenantReplication: false
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    networkAcls: {
      bypass: 'AzureServices'
      virtualNetworkRules: []
      ipRules: []
      defaultAction: 'Allow'
    }
    supportsHttpsTrafficOnly: true
    encryption: {
      requireInfrastructureEncryption: true
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Cool' // Cost optimization for DR storage
  }
}

// DR Storage blob services
resource drStorageBlobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: drStorageAccount
  name: 'default'
  properties: {
    changeFeed: {
      enabled: true
      retentionInDays: 7
    }
    restorePolicy: {
      enabled: true
      days: 6
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    deleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    isVersioningEnabled: true
  }
}

// DR Storage containers
resource drDocumentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: drStorageBlobServices
  name: 'documents-dr'
  properties: {
    publicAccess: 'None'
  }
}

resource drBackupsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: drStorageBlobServices
  name: 'backups-dr'
  properties: {
    publicAccess: 'None'
  }
}

// Backup Policy for VMs (if any)
resource vmBackupPolicy 'Microsoft.RecoveryServices/vaults/backupPolicies@2023-06-01' = {
  parent: recoveryServicesVault
  name: 'DefaultVMPolicy'
  properties: {
    backupManagementType: 'AzureIaasVM'
    schedulePolicy: {
      schedulePolicyType: 'SimpleSchedulePolicy'
      scheduleRunFrequency: 'Daily'
      scheduleRunTimes: [
        '2023-01-01T02:00:00.000Z'
      ]
      scheduleWeeklyFrequency: 0
    }
    retentionPolicy: {
      retentionPolicyType: 'LongTermRetentionPolicy'
      dailySchedule: {
        retentionTimes: [
          '2023-01-01T02:00:00.000Z'
        ]
        retentionDuration: {
          count: environment == 'prod' ? 30 : 7
          durationType: 'Days'
        }
      }
      weeklySchedule: {
        daysOfTheWeek: [
          'Sunday'
        ]
        retentionTimes: [
          '2023-01-01T02:00:00.000Z'
        ]
        retentionDuration: {
          count: environment == 'prod' ? 12 : 4
          durationType: 'Weeks'
        }
      }
      monthlySchedule: {
        retentionScheduleFormatType: 'Weekly'
        retentionScheduleWeekly: {
          daysOfTheWeek: [
            'Sunday'
          ]
          weeksOfTheMonth: [
            'First'
          ]
        }
        retentionTimes: [
          '2023-01-01T02:00:00.000Z'
        ]
        retentionDuration: {
          count: environment == 'prod' ? 12 : 3
          durationType: 'Months'
        }
      }
      yearlySchedule: environment == 'prod' ? {
        retentionScheduleFormatType: 'Weekly'
        monthsOfYear: [
          'January'
        ]
        retentionScheduleWeekly: {
          daysOfTheWeek: [
            'Sunday'
          ]
          weeksOfTheMonth: [
            'First'
          ]
        }
        retentionTimes: [
          '2023-01-01T02:00:00.000Z'
        ]
        retentionDuration: {
          count: 7
          durationType: 'Years'
        }
      } : null
    }
    timeZone: 'UTC'
  }
}

// Backup Policy for Azure Files
resource filesBackupPolicy 'Microsoft.RecoveryServices/vaults/backupPolicies@2023-06-01' = {
  parent: recoveryServicesVault
  name: 'DefaultFilesPolicy'
  properties: {
    backupManagementType: 'AzureStorage'
    workLoadType: 'AzureFileShare'
    schedulePolicy: {
      schedulePolicyType: 'SimpleSchedulePolicy'
      scheduleRunFrequency: 'Daily'
      scheduleRunTimes: [
        '2023-01-01T03:00:00.000Z'
      ]
    }
    retentionPolicy: {
      retentionPolicyType: 'LongTermRetentionPolicy'
      dailySchedule: {
        retentionTimes: [
          '2023-01-01T03:00:00.000Z'
        ]
        retentionDuration: {
          count: environment == 'prod' ? 30 : 7
          durationType: 'Days'
        }
      }
    }
    timeZone: 'UTC'
  }
}

// Outputs
output recoveryServicesVaultName string = recoveryServicesVault.name
output recoveryServicesVaultId string = recoveryServicesVault.id
output drSqlServerName string = environment == 'prod' ? drSqlServer.name : ''
output drSqlServerId string = environment == 'prod' ? drSqlServer.id : ''
output drStorageAccountName string = drStorageAccount.name
output drStorageAccountId string = drStorageAccount.id
