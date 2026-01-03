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
    options: {
      throughput: 400
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
    options: {
      throughput: 400
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
    options: {
      throughput: 400
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
    options: {
      throughput: 400
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
    options: {
      throughput: 400
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
    options: {
      throughput: 400
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
    options: {
      throughput: 400
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
    options: {
      throughput: 400
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
