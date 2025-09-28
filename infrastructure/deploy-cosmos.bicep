@description('Cosmos DB deployment template for Enterprise Appraisal Management System')
param location string = resourceGroup().location
param environment string = 'production'
param cosmosAccountName string = 'appraisal-cosmos-${environment}-${uniqueString(resourceGroup().id)}'
param databaseName string = 'appraisal-management'

// Deploy Azure Cosmos DB using the production module
module cosmosDb 'modules/cosmos-production.bicep' = {
  name: 'cosmosdb-deployment'
  params: {
    location: location
    environment: environment
    cosmosAccountName: cosmosAccountName
    databaseName: databaseName
  }
}

// Optional: Deploy monitoring and alerts (placeholder for future implementation)
// module monitoring 'modules/cosmos-monitoring.bicep' = if (environment == 'production') {
//   name: 'cosmosdb-monitoring'
//   params: {
//     cosmosAccountName: cosmosDb.outputs.cosmosDbAccountName
//     cosmosResourceId: cosmosDb.outputs.cosmosDbResourceId
//     environment: environment
//     tags: defaultTags
//   }
//   dependsOn: [
//     cosmosDb
//   ]
// }

// Outputs for application configuration
output cosmosAccountName string = cosmosDb.outputs.cosmosAccountName
output cosmosEndpoint string = cosmosDb.outputs.cosmosEndpoint
output cosmosResourceId string = cosmosDb.outputs.cosmosAccountId
output databaseName string = cosmosDb.outputs.databaseName
output containerNames array = cosmosDb.outputs.containerNames
output deploymentEnvironment string = environment
output locations array = cosmosDb.outputs.locations
output consistencyLevel string = cosmosDb.outputs.consistencyLevel

// Application settings for easy configuration
output appSettings object = cosmosDb.outputs.appSettings
