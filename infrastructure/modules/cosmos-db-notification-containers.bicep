@description('Name of the Cosmos DB account')
param cosmosDbAccountName string

@description('Name of the database')
param databaseName string = 'appraisal-management'

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosDbAccountName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' existing = {
  parent: cosmosAccount
  name: databaseName
}

resource emailTemplatesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'emailTemplates'
  properties: {
    resource: {
      id: 'emailTemplates'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
      }
    }
    }
}

resource smsTemplatesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'smsTemplates'
  properties: {
    resource: {
      id: 'smsTemplates'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
      }
    }
    }
}

resource notificationHistoryContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'notificationHistory'
  properties: {
    resource: {
      id: 'notificationHistory'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        compositeIndexes: [
          [
            { path: '/userId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
      defaultTtl: 7776000 // 90 days
    }
    }
}

resource notificationPreferencesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'notificationPreferences'
  properties: {
    resource: {
      id: 'notificationPreferences'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: [
          { paths: ['/userId', '/tenantId'] }
        ]
      }
    }
    }
}

resource chatThreadsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'chatThreads'
  properties: {
    resource: {
      id: 'chatThreads'
      partitionKey: {
        paths: ['/orderId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
      }
    }
    }
}

resource chatMessagesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'chatMessages'
  properties: {
    resource: {
      id: 'chatMessages'
      partitionKey: {
        paths: ['/threadId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        compositeIndexes: [
          [
            { path: '/threadId', order: 'ascending' }
            { path: '/createdAt', order: 'ascending' }
          ]
        ]
      }
      defaultTtl: 15552000 // 180 days
    }
    }
}

resource deviceRegistrationsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'deviceRegistrations'
  properties: {
    resource: {
      id: 'deviceRegistrations'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: [
          { paths: ['/deviceToken'] }
        ]
      }
    }
    }
}

resource acsUserMappingsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'acsUserMappings'
  properties: {
    resource: {
      id: 'acsUserMappings'
      partitionKey: {
        paths: ['/azureAdUserId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
      }
      uniqueKeyPolicy: {
        uniqueKeys: [
          { paths: ['/acsUserId'] }
        ]
      }
    }
    }
}

// Teams meetings container for Teams interoperability
resource teamsMeetingsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'teamsMeetings'
  properties: {
    resource: {
      id: 'teamsMeetings'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/_etag/?' }
        ]
      }
      // Index by orderId and meetingId for fast lookups
      compositeIndexes: [
        [
          { path: '/orderId', order: 'ascending' }
          { path: '/startDateTime', order: 'descending' }
        ]
        [
          { path: '/meetingId', order: 'ascending' }
        ]
      ]
    }
    }
}

// Communication contexts container - unified chat/call/meeting orchestration
resource communicationContextsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'communicationContexts'
  properties: {
    resource: {
      id: 'communicationContexts'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/_etag/?' }
        ]
        compositeIndexes: [
          [
            { path: '/type', order: 'ascending' }
            { path: '/entityId', order: 'ascending' }
          ]
          [
            { path: '/tenantId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
    }
  }
}

// Communication transcripts container - AI analysis of conversations
resource communicationTranscriptsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'communicationTranscripts'
  properties: {
    resource: {
      id: 'communicationTranscripts'
      partitionKey: {
        paths: ['/contextId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        compositeIndexes: [
          [
            { path: '/contextId', order: 'ascending' }
            { path: '/startTime', order: 'ascending' }
          ]
        ]
      }
      defaultTtl: 31536000 // 365 days
    }
  }
}

// AI insights container - sentiment, action items, compliance
resource aiInsightsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'aiInsights'
  properties: {
    resource: {
      id: 'aiInsights'
      partitionKey: {
        paths: ['/contextId']
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        compositeIndexes: [
          [
            { path: '/contextId', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
          [
            { path: '/type', order: 'ascending' }
            { path: '/timestamp', order: 'descending' }
          ]
        ]
      }
      defaultTtl: 31536000 // 365 days
    }
  }
}

output emailTemplatesContainerId string = emailTemplatesContainer.id
output smsTemplatesContainerId string = smsTemplatesContainer.id
output notificationHistoryContainerId string = notificationHistoryContainer.id
output notificationPreferencesContainerId string = notificationPreferencesContainer.id
output chatThreadsContainerId string = chatThreadsContainer.id
output chatMessagesContainerId string = chatMessagesContainer.id
output deviceRegistrationsContainerId string = deviceRegistrationsContainer.id
output acsUserMappingsContainerId string = acsUserMappingsContainer.id
output teamsMeetingsContainerId string = teamsMeetingsContainer.id
output communicationContextsContainerId string = communicationContextsContainer.id
output communicationTranscriptsContainerId string = communicationTranscriptsContainer.id
output aiInsightsContainerId string = aiInsightsContainer.id


