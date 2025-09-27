// Security Services Module - Security Center, Sentinel, and security monitoring
// Includes Azure Security Center, Sentinel SIEM, and security automation

param location string
param environment string
param suffix string
param tags object
param logAnalyticsWorkspaceId string

// Variables
var sentinelSolutionName = 'SecurityInsights(${logAnalyticsWorkspaceName})'

// Get the existing Log Analytics workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
  scope: resourceGroup()
}

var logAnalyticsWorkspaceName = 'log-appraisal-${environment}-${suffix}'

// Azure Sentinel solution
resource sentinelSolution 'Microsoft.OperationsManagement/solutions@2015-11-01-preview' = {
  name: sentinelSolutionName
  location: location
  tags: tags
  plan: {
    name: sentinelSolutionName
    publisher: 'Microsoft'
    product: 'OMSGallery/SecurityInsights'
    promotionCode: ''
  }
  properties: {
    workspaceResourceId: logAnalyticsWorkspaceId
    containedResources: [
      '${logAnalyticsWorkspaceId}/views/SecurityInsights(${logAnalyticsWorkspaceName})'
    ]
  }
}

// Data Collection Rules for security monitoring
resource securityDataCollectionRule 'Microsoft.Insights/dataCollectionRules@2023-03-11' = {
  name: 'dcr-security-${environment}-${suffix}'
  location: location
  tags: tags
  kind: 'Windows'
  properties: {
    dataSources: {
      windowsEventLogs: [
        {
          name: 'eventLogsDataSource'
          streams: [
            'Microsoft-Event'
          ]
          xPathQueries: [
            'Security!*[System[(Level=1 or Level=2 or Level=3 or Level=4 or Level=0)]]'
            'Application!*[System[(Level=1 or Level=2 or Level=3 or Level=4 or Level=0)]]'
            'System!*[System[(Level=1 or Level=2 or Level=3 or Level=4 or Level=0)]]'
          ]
        }
      ]
      performanceCounters: [
        {
          name: 'perfCountersDataSource'
          streams: [
            'Microsoft-Perf'
          ]
          scheduledTransferPeriod: 'PT1M'
          samplingFrequencyInSeconds: 60
          counterSpecifiers: [
            '\\Processor Information(_Total)\\% Processor Time'
            '\\Processor Information(_Total)\\% Privileged Time'
            '\\Processor Information(_Total)\\% User Time'
            '\\Processor Information(_Total)\\Processor Frequency'
            '\\System\\Processes'
            '\\Process(_Total)\\Thread Count'
            '\\Process(_Total)\\Handle Count'
            '\\System\\System Up Time'
            '\\System\\Context Switches/sec'
            '\\System\\Processor Queue Length'
            '\\Memory\\Available Bytes'
            '\\Memory\\Committed Bytes'
            '\\Memory\\Cache Bytes'
            '\\Memory\\Pool Paged Bytes'
            '\\Memory\\Pool Nonpaged Bytes'
            '\\Memory\\Pages/sec'
            '\\Memory\\Page Faults/sec'
            '\\Process(_Total)\\Working Set'
            '\\Process(_Total)\\Working Set - Private'
            '\\LogicalDisk(_Total)\\% Disk Time'
            '\\LogicalDisk(_Total)\\% Disk Read Time'
            '\\LogicalDisk(_Total)\\% Disk Write Time'
            '\\LogicalDisk(_Total)\\% Idle Time'
            '\\LogicalDisk(_Total)\\Disk Bytes/sec'
            '\\LogicalDisk(_Total)\\Disk Read Bytes/sec'
            '\\LogicalDisk(_Total)\\Disk Write Bytes/sec'
            '\\LogicalDisk(_Total)\\Disk Transfers/sec'
            '\\LogicalDisk(_Total)\\Disk Reads/sec'
            '\\LogicalDisk(_Total)\\Disk Writes/sec'
            '\\LogicalDisk(_Total)\\Avg. Disk sec/Transfer'
            '\\LogicalDisk(_Total)\\Avg. Disk sec/Read'
            '\\LogicalDisk(_Total)\\Avg. Disk sec/Write'
            '\\LogicalDisk(_Total)\\Avg. Disk Queue Length'
            '\\LogicalDisk(_Total)\\Avg. Disk Read Queue Length'
            '\\LogicalDisk(_Total)\\Avg. Disk Write Queue Length'
            '\\LogicalDisk(_Total)\\% Free Space'
            '\\LogicalDisk(_Total)\\Free Megabytes'
            '\\Network Interface(*)\\Bytes Total/sec'
            '\\Network Interface(*)\\Bytes Sent/sec'
            '\\Network Interface(*)\\Bytes Received/sec'
            '\\Network Interface(*)\\Packets/sec'
            '\\Network Interface(*)\\Packets Sent/sec'
            '\\Network Interface(*)\\Packets Received/sec'
            '\\Network Interface(*)\\Packets Outbound Errors'
            '\\Network Interface(*)\\Packets Received Errors'
          ]
        }
      ]
    }
    destinations: {
      logAnalytics: [
        {
          workspaceResourceId: logAnalyticsWorkspaceId
          name: 'la-security-destination'
        }
      ]
    }
    dataFlows: [
      {
        streams: [
          'Microsoft-Event'
        ]
        destinations: [
          'la-security-destination'
        ]
      }
      {
        streams: [
          'Microsoft-Perf'
        ]
        destinations: [
          'la-security-destination'
        ]
      }
    ]
  }
}

// Action Groups for security alerts
resource securityActionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-security-${environment}-${suffix}'
  location: 'Global'
  tags: tags
  properties: {
    groupShortName: 'SecurityOps'
    enabled: true
    emailReceivers: [
      {
        name: 'Security Team'
        emailAddress: 'security@appraisalmanagement.com'
        useCommonAlertSchema: true
      }
    ]
    smsReceivers: []
    webhookReceivers: []
    eventHubReceivers: []
    itsmReceivers: []
    azureAppPushReceivers: []
    automationRunbookReceivers: []
    voiceReceivers: []
    logicAppReceivers: []
    azureFunctionReceivers: []
    armRoleReceivers: [
      {
        name: 'Security Admin Role'
        roleId: '8e3af657-a8ff-443c-a75c-2fe8c4bcb635' // Owner role
        useCommonAlertSchema: true
      }
    ]
  }
}

// Security Alert Rules (sample - should be expanded based on requirements)
resource highSeveritySecurityAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'High Severity Security Events'
  location: location
  tags: tags
  properties: {
    displayName: 'High Severity Security Events'
    description: 'Alert for high severity security events in the system'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    criteria: {
      allOf: [
        {
          query: 'SecurityEvent | where Level <= 2 | summarize count() by Computer, EventID'
          timeAggregation: 'Count'
          dimensions: []
          operator: 'GreaterThan'
          threshold: 5
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        securityActionGroup.id
      ]
      customProperties: {}
    }
    scopes: [
      logAnalyticsWorkspaceId
    ]
  }
}

// Suspicious Login Activity Alert
resource suspiciousLoginAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'Suspicious Login Activity'
  location: location
  tags: tags
  properties: {
    displayName: 'Suspicious Login Activity'
    description: 'Alert for suspicious login patterns and failed authentication attempts'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT10M'
    windowSize: 'PT10M'
    criteria: {
      allOf: [
        {
          query: 'SigninLogs | where ResultType != "0" | summarize FailedAttempts=count() by UserPrincipalName, IPAddress | where FailedAttempts > 5'
          timeAggregation: 'Count'
          dimensions: []
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        securityActionGroup.id
      ]
      customProperties: {}
    }
    scopes: [
      logAnalyticsWorkspaceId
    ]
  }
}

// Data Breach Detection Alert
resource dataBreachAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'Potential Data Breach'
  location: location
  tags: tags
  properties: {
    displayName: 'Potential Data Breach Detection'
    description: 'Alert for unusual data access patterns that might indicate a breach'
    severity: 0
    enabled: true
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [
        {
          query: 'AuditLogs | where OperationName contains "download" or OperationName contains "export" | summarize Downloads=count() by InitiatedBy.user.userPrincipalName | where Downloads > 100'
          timeAggregation: 'Count'
          dimensions: []
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        securityActionGroup.id
      ]
      customProperties: {}
    }
    scopes: [
      logAnalyticsWorkspaceId
    ]
  }
}

// Outputs
output sentinelSolutionName string = sentinelSolution.name
output sentinelSolutionId string = sentinelSolution.id
output securityActionGroupName string = securityActionGroup.name
output securityActionGroupId string = securityActionGroup.id
output dataCollectionRuleName string = securityDataCollectionRule.name
output dataCollectionRuleId string = securityDataCollectionRule.id
