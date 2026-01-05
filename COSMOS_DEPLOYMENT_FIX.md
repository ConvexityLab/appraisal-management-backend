# Cosmos DB Deployment Fix

## Issues Found

### 1. Invalid Indexing Path (FIXED)
**Container:** `users`  
**Error:** `The indexing path '/passwordHash' could not be accepted`  
**Fix:** Changed `/passwordHash` to `/passwordHash/?` in excluded paths  
**Status:** ✅ Fixed in cosmos-production.bicep

### 2. Partition Key Changes (REQUIRES MANUAL FIX)
**Containers:** `vendors`, `orders`  
**Error:** `Document collection partition key cannot be changed`  
**Root Cause:** Existing containers have different partition keys than Bicep template

## Current Partition Keys in Bicep
- `orders`: `/orderId`
- `vendors`: `/licenseState`

## What Needs to be Done

### Option 1: Update Bicep to Match Existing Containers (RECOMMENDED)
Query the existing containers to see their current partition keys:

```bash
# Check orders container partition key
az cosmosdb sql container show \
  --account-name appraisal-mgmt-staging-cosmos \
  --database-name appraisal-management \
  --name orders \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --query "resource.partitionKey.paths[0]"

# Check vendors container partition key
az cosmosdb sql container show \
  --account-name appraisal-mgmt-staging-cosmos \
  --database-name appraisal-management \
  --name vendors \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --query "resource.partitionKey.paths[0]"
```

Then update `infrastructure/modules/cosmos-production.bicep` to match the existing partition keys.

### Option 2: Delete and Recreate Containers (DATA LOSS)
⚠️ **WARNING: This will delete all data in these containers**

```bash
# Delete containers
az cosmosdb sql container delete \
  --account-name appraisal-mgmt-staging-cosmos \
  --database-name appraisal-management \
  --name orders \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --yes

az cosmosdb sql container delete \
  --account-name appraisal-mgmt-staging-cosmos \
  --database-name appraisal-management \
  --name vendors \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --yes
```

Then re-run the deployment.

### Option 3: Migrate Data to New Containers
1. Create new containers with desired partition keys (different names)
2. Migrate data from old to new containers
3. Update application to use new container names
4. Delete old containers

## Deployment Command After Fix

```bash
az deployment group create \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --template-file infrastructure/main-production.bicep \
  --parameters environmentName=staging \
  --parameters location=eastus
```

## Why Partition Keys Can't Change

Cosmos DB partition keys are **immutable** once a container is created because:
1. Data is physically distributed based on partition key
2. Changing it would require redistributing all data
3. Would impact existing queries and performance

Always verify partition keys match your existing containers before deployment!
