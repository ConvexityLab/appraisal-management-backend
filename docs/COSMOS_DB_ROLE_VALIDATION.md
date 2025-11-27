# Cosmos DB Role Assignment Validation

## Checking Cosmos DB Built-in Roles

After deployment, validate that both Cosmos DB roles are assigned:

```bash
# Get Cosmos DB account resource ID
COSMOS_ACCOUNT_ID=$(az cosmosdb show --name "appraisal-cosmos-dev-12345" --resource-group "rg-appraisal-dev-12345" --query id -o tsv)

# Check Cosmos DB Built-in Data Reader role (ends in 00001)
az role assignment list \
  --scope "$COSMOS_ACCOUNT_ID" \
  --query "[?roleDefinitionId==\`$COSMOS_ACCOUNT_ID/sqlRoleDefinitions/00000000-0000-0000-0000-000000000001\`]" \
  --output table

# Check Cosmos DB Built-in Data Contributor role (ends in 00002)  
az role assignment list \
  --scope "$COSMOS_ACCOUNT_ID" \
  --query "[?roleDefinitionId==\`$COSMOS_ACCOUNT_ID/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002\`]" \
  --output table
```

## PowerShell Version

```powershell
# Get Cosmos DB account resource ID
$cosmosAccountId = az cosmosdb show --name "appraisal-cosmos-dev-12345" --resource-group "rg-appraisal-dev-12345" --query id -o tsv

# Check both Cosmos DB roles
az role assignment list --scope $cosmosAccountId --query "[?contains(roleDefinitionId, '00000000-0000-0000-0000-000000000001') || contains(roleDefinitionId, '00000000-0000-0000-0000-000000000002')]" --output table
```

## Expected Output

You should see 12 total role assignments for Cosmos DB:
- 6 assignments for Data Reader role (00001) - one per container app
- 6 assignments for Data Contributor role (00002) - one per container app

## Role Capabilities

### Cosmos DB Built-in Data Reader (`00000000-0000-0000-0000-000000000001`)
- ✅ SELECT queries
- ✅ Read documents, containers, databases
- ✅ Execute stored procedures (read-only)
- ❌ INSERT, UPDATE, DELETE operations
- ❌ Create/modify containers or databases

### Cosmos DB Built-in Data Contributor (`00000000-0000-0000-0000-000000000002`)  
- ✅ All Data Reader permissions
- ✅ INSERT, UPDATE, DELETE documents
- ✅ Execute stored procedures (with write access)
- ✅ Create/modify documents
- ❌ Create/modify containers or databases (requires control plane access)

## Why Both Roles?

While Data Contributor includes all Data Reader permissions, assigning both roles provides:

1. **Explicit Permission Model**: Clear visibility of read vs. write access
2. **Granular Monitoring**: Separate audit trails for read and write operations  
3. **Future Flexibility**: Easy to revoke write access while maintaining read access
4. **Compliance**: Some security frameworks require explicit read/write role separation

## Application Configuration

Update your application to use managed identity authentication:

```typescript
// Example: Node.js with @azure/cosmos
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

const credential = new DefaultAzureCredential();
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  aadCredentials: credential
});
```

This replaces the need for connection strings or account keys in your application configuration.