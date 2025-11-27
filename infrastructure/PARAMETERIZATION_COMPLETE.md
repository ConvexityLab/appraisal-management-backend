# Fully Parameterized Azure Infrastructure - Zero Hardcoded Values

## ✅ **Comprehensive Parameter Audit Completed**

This infrastructure has been completely overhauled to eliminate ALL hardcoded values. Every aspect of the deployment is now configurable through parameters.

## 📋 **Parameter Categories**

### **Core Deployment Parameters**
- `location` - Azure region (no default - must be specified)
- `environment` - Environment type (dev/staging/prod)
- `appName` - Application identifier (no default - must be specified)
- `organizationPrefix` - Optional organization prefix
- `tags` - Complete tag object (no defaults - must be specified)

### **Naming Parameters**
- `resourceGroupNamingPattern` - Pattern with tokens: `rg-{appName}-{environment}-{location}`
- `resourceNamingPattern` - Resource naming: `{appName}-{environment}`
- `customResourceGroupName` - Override for custom RG names

### **App Service Parameters**
- `appServicePlanSkus` - Complete SKU configuration per environment
- `nodeVersion` - Node.js version (configurable)
- `enableAutoScaling` - Auto-scaling toggle
- `autoScalingConfig` - Complete auto-scale settings (thresholds, cooldowns, capacity)

### **Cosmos DB Parameters**
- `cosmosDatabaseName` - Database name (configurable)
- `cosmosDbConfigs` - Per-environment configuration (tier, throughput, consistency, backup)
- `cosmosSecondaryRegion` - Secondary region for multi-region
- `cosmosContainers` - Complete container definitions (names, partition keys, indexes, TTL)
- `backupConfig` - Backup intervals and retention

### **Key Vault Parameters**
- `keyVaultSku` - SKU selection (standard/premium)
- `keyVaultRetention` - Retention settings per environment
- `enablePurgeProtection` - Purge protection toggle

### **Service Bus Parameters**
- `serviceBusSkus` - SKU per environment
- `serviceBusConfig` - Queue and topic definitions

### **Storage Parameters**
- `storageSkus` - Storage redundancy per environment
- `storageContainers` - Container definitions

### **Monitoring Parameters**
- `logRetentionDays` - Log retention per environment
- `appInsightsDataCap` - Data cap per environment

## 🚀 **Deployment Commands**

### **Production Deployment with Custom Parameters**

```bash
# Deploy with comprehensive parameter file
az deployment sub create \
  --location eastus2 \
  --template-file infrastructure/main-production-parameterized.bicep \
  --parameters @infrastructure/parameters/production-fully-parameterized.parameters.json

# Or override specific parameters inline
az deployment sub create \
  --location eastus2 \
  --template-file infrastructure/main-production-parameterized.bicep \
  --parameters \
    location=westus2 \
    environment=prod \
    appName=my-appraisal-app \
    organizationPrefix=contoso \
    "tags={Environment:'Production',Owner:'DevOps Team'}" \
    nodeVersion=20-lts \
    cosmosDatabaseName=my-custom-db
```

### **Development Deployment with Minimal Parameters**

```bash
# Minimal required parameters for dev environment
az deployment sub create \
  --location eastus2 \
  --template-file infrastructure/main-production-parameterized.bicep \
  --parameters \
    location=eastus2 \
    environment=dev \
    appName=appraisal-dev \
    "tags={Environment:'Development',ManagedBy:'Developer'}"
```

## 📋 **Parameter Examples**

### **Custom Naming Example**
```json
{
  "organizationPrefix": { "value": "contoso" },
  "resourceGroupNamingPattern": { "value": "rg-{appName}-{environment}-{location}" },
  "resourceNamingPattern": { "value": "{appName}-{environment}" },
  "customResourceGroupName": { "value": "my-custom-rg-name" }
}
```

### **Custom App Service Configuration**
```json
{
  "nodeVersion": { "value": "20-lts" },
  "appServicePlanSkus": {
    "value": {
      "dev": { "name": "F1", "capacity": 1 },
      "staging": { "name": "B2", "capacity": 2 },
      "prod": { "name": "P3v3", "capacity": 5 }
    }
  },
  "autoScalingConfig": {
    "value": {
      "minCapacity": 5,
      "maxCapacity": 50,
      "scaleOutThreshold": 60,
      "scaleInThreshold": 20
    }
  }
}
```

### **Custom Cosmos DB Configuration**
```json
{
  "cosmosDatabaseName": { "value": "my-custom-database" },
  "cosmosSecondaryRegion": { "value": "canadacentral" },
  "cosmosContainers": {
    "value": [
      {
        "name": "custom-orders",
        "partitionKeyPath": "/customKey", 
        "uniqueKeyPaths": [{"paths": ["/customId"]}],
        "defaultTtl": 604800
      }
    ]
  }
}
```

## ✅ **Eliminated Hardcoded Values**

### **Before (Hardcoded)**
- ❌ Fixed SKUs: 'B1', 'S2', 'P2v3'
- ❌ Fixed Node version: '18-lts'
- ❌ Fixed database name: 'appraisal-management'
- ❌ Fixed container names: 'orders', 'vendors'
- ❌ Fixed partition keys: '/clientId'
- ❌ Fixed thresholds: 75%, 25%
- ❌ Fixed retention: 90 days, 365 days
- ❌ Fixed regions: 'westus2'
- ❌ Fixed API versions: '2023-12-01'

### **After (Parameterized)**
- ✅ Configurable SKUs per environment
- ✅ Configurable Node.js version
- ✅ Configurable database and container names
- ✅ Configurable partition key strategies
- ✅ Configurable scaling thresholds
- ✅ Configurable retention policies
- ✅ Configurable regions and locations
- ✅ Configurable API versions

## 🔧 **Environment-Specific Examples**

### **Development Environment**
```json
{
  "appServicePlanSkus": {
    "dev": { "name": "F1", "capacity": 1 }
  },
  "cosmosDbConfigs": {
    "dev": {
      "tier": "serverless",
      "defaultConsistencyLevel": "Eventual"
    }
  },
  "serviceBusSkus": { "dev": "Basic" },
  "storageSkus": { "dev": "Standard_LRS" }
}
```

### **Production Environment**
```json
{
  "appServicePlanSkus": {
    "prod": { "name": "P3v3", "capacity": 10 }
  },
  "cosmosDbConfigs": {
    "prod": {
      "tier": "provisioned",
      "throughput": 5000,
      "enableAutomaticFailover": true,
      "enableMultipleWriteLocations": true,
      "defaultConsistencyLevel": "BoundedStaleness"
    }
  },
  "serviceBusSkus": { "prod": "Premium" },
  "storageSkus": { "prod": "Standard_GZRS" }
}
```

## 📊 **Validation**

### **Parameter Validation Script**
```bash
# Validate template before deployment
az deployment sub validate \
  --location eastus2 \
  --template-file infrastructure/main-production-parameterized.bicep \
  --parameters @infrastructure/parameters/production-fully-parameterized.parameters.json

# What-if analysis
az deployment sub what-if \
  --location eastus2 \
  --template-file infrastructure/main-production-parameterized.bicep \
  --parameters @infrastructure/parameters/production-fully-parameterized.parameters.json
```

## 🎯 **Key Benefits**

1. **🔧 Complete Configurability** - Zero hardcoded values
2. **🌍 Multi-Region Ready** - Configurable regions and failover
3. **💰 Cost Optimization** - Environment-specific SKUs and settings
4. **🔒 Security Flexible** - Configurable retention and access policies
5. **📈 Scale Ready** - Configurable auto-scaling and capacity
6. **🏢 Enterprise Ready** - Custom naming patterns and organization prefixes
7. **🔄 CI/CD Friendly** - Easy parameter overrides for different environments

Your infrastructure is now **100% parameterized** and ready for enterprise deployment across any Azure environment!