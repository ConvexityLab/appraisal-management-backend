// AI/ML Services Module - Machine learning and cognitive services
// Includes Azure ML, Cognitive Services, OpenAI, and related AI infrastructure

param location string
param environment string
param suffix string  
param tags object

// Variables
var mlWorkspaceName = 'ml-appraisal-${environment}-${suffix}'
var cognitiveServicesName = 'cs-appraisal-${environment}-${suffix}'
var openAiServiceName = 'openai-appraisal-${environment}-${suffix}'
var searchServiceName = 'search-appraisal-${environment}-${suffix}'
var storageAccountName = 'stmlappraisal${environment}${take(suffix, 8)}'
var keyVaultName = 'kv-ml-appraisal-${environment}-${take(suffix, 8)}'
var containerRegistryName = 'crappraisal${environment}${take(suffix, 8)}'
var computeInstanceName = 'ci-appraisal-${environment}'

// Storage Account for ML workspace
resource mlStorageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
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
    supportsHttpsTrafficOnly: true
    encryption: {
      requireInfrastructureEncryption: false
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
    accessTier: 'Hot'
  }
}

// Key Vault for ML workspace
resource mlKeyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enabledForDeployment: false
    enabledForTemplateDeployment: false
    enabledForDiskEncryption: false
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: false
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

// Container Registry for ML models
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Premium' : 'Basic'
  }
  properties: {
    adminUserEnabled: true
    policies: {
      quarantinePolicy: {
        status: 'disabled'
      }
      trustPolicy: {
        type: 'Notary'
        status: 'disabled'
      }
      retentionPolicy: {
        days: 30
        status: 'enabled'
      }
      exportPolicy: {
        status: 'enabled'
      }
    }
    encryption: {
      status: 'disabled'
    }
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
    zoneRedundancy: environment == 'prod' ? 'Enabled' : 'Disabled'
  }
}

// Application Insights for ML workspace
resource mlApplicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'ai-ml-appraisal-${environment}-${suffix}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Machine Learning Workspace
resource mlWorkspace 'Microsoft.MachineLearningServices/workspaces@2023-10-01' = {
  name: mlWorkspaceName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    friendlyName: mlWorkspaceName
    description: 'Machine Learning workspace for Appraisal Management System'
    storageAccount: mlStorageAccount.id
    keyVault: mlKeyVault.id
    applicationInsights: mlApplicationInsights.id
    containerRegistry: containerRegistry.id
    discoveryUrl: 'https://${location}.api.azureml.ms/discovery'
    publicNetworkAccess: 'Enabled'
    imageBuildCompute: 'cpu-cluster'
    allowPublicAccessWhenBehindVnet: false
    // Encryption disabled for development - enable for production
    // encryption: {
    //   status: 'Disabled'
    //   keyVaultProperties: {
    //     keyVaultArmId: keyVaultId
    //     keyIdentifier: keyIdentifier
    //   }
    // }
    hbiWorkspace: false
    v1LegacyMode: false
  }
}

// ML Compute Cluster for training
resource mlComputeCluster 'Microsoft.MachineLearningServices/workspaces/computes@2023-10-01' = {
  parent: mlWorkspace
  name: 'cpu-cluster'
  location: location
  properties: {
    computeType: 'AmlCompute'
    description: 'CPU compute cluster for ML training'
    properties: {
      vmSize: environment == 'prod' ? 'Standard_DS3_v2' : 'Standard_DS2_v2'
      vmPriority: 'Dedicated'
      scaleSettings: {
        maxNodeCount: environment == 'prod' ? 10 : 3
        minNodeCount: 0
        nodeIdleTimeBeforeScaleDown: 'PT2M'
      }
      osType: 'Linux'
      enableNodePublicIp: false
      isolatedNetwork: false
    }
  }
}

// ML Compute Instance for development
resource mlComputeInstance 'Microsoft.MachineLearningServices/workspaces/computes@2023-10-01' = if (environment != 'prod') {
  parent: mlWorkspace
  name: computeInstanceName
  location: location
  properties: {
    computeType: 'ComputeInstance'
    description: 'Compute instance for ML development'
    properties: {
      vmSize: 'Standard_DS3_v2'
      subnet: {
        id: ''
      }
      applicationSharingPolicy: 'Personal'
      sshSettings: {
        sshPublicAccess: 'Disabled'
      }
      computeInstanceAuthorizationType: 'personal'
      personalComputeInstanceSettings: {
        assignedUser: {
          objectId: ''
          tenantId: subscription().tenantId
        }
      }
    }
  }
}

// Cognitive Services Multi-Service Account
resource cognitiveServices 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: cognitiveServicesName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'S0' : 'F0'
  }
  kind: 'CognitiveServices'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    apiProperties: {}
    customSubDomainName: cognitiveServicesName
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: false
  }
}

// Form Recognizer for document processing
resource formRecognizer 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'fr-appraisal-${environment}-${suffix}'
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'S0' : 'F0'
  }
  kind: 'FormRecognizer'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    apiProperties: {}
    customSubDomainName: 'fr-appraisal-${environment}-${suffix}'
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: false
  }
}

// Computer Vision for image analysis
resource computerVision 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'cv-appraisal-${environment}-${suffix}'
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'S1' : 'F0'
  }
  kind: 'ComputerVision'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    apiProperties: {}
    customSubDomainName: 'cv-appraisal-${environment}-${suffix}'
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: false
  }
}

// Text Analytics for NLP
resource textAnalytics 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: 'ta-appraisal-${environment}-${suffix}'
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'S' : 'F0'
  }
  kind: 'TextAnalytics'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    apiProperties: {}
    customSubDomainName: 'ta-appraisal-${environment}-${suffix}'
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: false
  }
}

// Azure OpenAI Service
resource openAiService 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: openAiServiceName
  location: 'East US' // OpenAI is only available in specific regions
  tags: tags
  sku: {
    name: 'S0'
  }
  kind: 'OpenAI'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    apiProperties: {}
    customSubDomainName: openAiServiceName
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: false
  }
}

// GPT-4 deployment
resource gpt4Deployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  parent: openAiService
  name: 'gpt-4'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4'
      version: '0613'
    }
    raiPolicyName: 'Microsoft.Default'
    scaleSettings: {
      scaleType: 'Standard'
    }
  }
}

// GPT-3.5 Turbo deployment
resource gpt35Deployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  parent: openAiService
  name: 'gpt-35-turbo'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-35-turbo'
      version: '0613'
    }
    raiPolicyName: 'Microsoft.Default'
    scaleSettings: {
      scaleType: 'Standard'
    }
  }
}

// Text Embedding model deployment
resource textEmbeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-10-01-preview' = {
  parent: openAiService
  name: 'text-embedding-ada-002'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-ada-002'
      version: '2'
    }
    raiPolicyName: 'Microsoft.Default'
    scaleSettings: {
      scaleType: 'Standard'
    }
  }
}

// Azure Cognitive Search for document indexing and retrieval
resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: searchServiceName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'standard' : 'basic'
  }
  properties: {
    replicaCount: environment == 'prod' ? 2 : 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    networkRuleSet: {
      ipRules: []
    }
    encryptionWithCmk: {
      enforcement: 'Unspecified'
    }
    disableLocalAuth: false
    authOptions: {
      apiKeyOnly: {}
    }
    semanticSearch: environment == 'prod' ? 'standard' : 'free'
  }
}

// Outputs
output mlWorkspaceName string = mlWorkspace.name
output mlWorkspaceId string = mlWorkspace.id
output mlStorageAccountName string = mlStorageAccount.name
output containerRegistryName string = containerRegistry.name
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output cognitiveServicesName string = cognitiveServices.name
output cognitiveServicesEndpoint string = cognitiveServices.properties.endpoint
output formRecognizerName string = formRecognizer.name
output formRecognizerEndpoint string = formRecognizer.properties.endpoint
output computerVisionName string = computerVision.name
output computerVisionEndpoint string = computerVision.properties.endpoint
output textAnalyticsName string = textAnalytics.name
output textAnalyticsEndpoint string = textAnalytics.properties.endpoint
output openAiServiceName string = openAiService.name
output openAiServiceEndpoint string = openAiService.properties.endpoint
output searchServiceName string = searchService.name
output searchServiceEndpoint string = 'https://${searchService.name}.search.windows.net'
