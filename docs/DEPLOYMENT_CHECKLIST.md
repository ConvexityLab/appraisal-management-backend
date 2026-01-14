# Azure Container Apps Deployment Checklist

## ✅ Automated by Bicep Deployment

These are configured automatically when you run the Bicep deployment:

### 1. Azure Resources Created
- ✅ Container Apps with System-Assigned Managed Identity
- ✅ Azure Communication Services (ACS)
- ✅ Cosmos DB with containers
- ✅ Key Vault for secrets
- ✅ Application Insights for monitoring
- ✅ Container Registry for Docker images
- ✅ Log Analytics Workspace

### 2. RBAC Role Assignments (Managed Identity)
- ✅ **ACS Contributor Role** → Container App Managed Identity
  - Allows: Create ACS identities, issue chat tokens, manage communication resources
  - Configured in: `infrastructure/modules/acs-role-assignments.bicep`
  
- ✅ **Cosmos DB Data Contributor** → Container App Managed Identity
  - Allows: Read/write access to all Cosmos DB containers
  - Configured in: `infrastructure/modules/cosmos-role-assignments.bicep`
  
- ✅ **Key Vault Secrets User** → Container App Managed Identity
  - Allows: Read secrets from Key Vault
  - Configured in: `infrastructure/modules/keyvault-role-assignments.bicep`

### 3. Environment Variables
- ✅ All required environment variables configured in Container Apps
- ✅ Secrets properly injected from Key Vault

## ❌ Manual Configuration Required

These must be configured manually in Azure Portal:

### 1. Microsoft Graph API Permissions (CRITICAL for Teams Integration)

**Why needed?** Teams direct messaging and meeting creation use Microsoft Graph API, not ACS.

**Steps:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App Registrations**
3. Find app: `dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a`
4. Click **API Permissions** → **Add a permission**
5. Select **Microsoft Graph** → **Application permissions**
6. Add these permissions:
   - ✅ **Chat.ReadWrite** (for 1-on-1 Teams messaging)
   - ✅ **OnlineMeetings.ReadWrite** (for Teams meeting creation)
7. Click **Grant admin consent** (requires Global Administrator role)

**Verification:**
```powershell
# Test Teams messaging endpoint
$token = "YOUR_AZURE_AD_TOKEN"
Invoke-RestMethod -Uri "https://your-app.azurecontainerapps.io/api/teams/messages/direct" `
  -Method Post -Headers @{Authorization="Bearer $token"} `
  -Body '{"recipientUserId":"USER_ID","message":"Test"}' `
  -ContentType "application/json"
```

### 2. ACS Email Domain Verification

**Why needed?** Email notifications require verified sender domain.

**Steps:**
1. Deploy infrastructure (creates ACS Email Service)
2. Get DNS verification records from deployment output:
   ```bash
   az deployment group show -g your-rg -n main-deployment --query properties.outputs.emailVerificationRecords.value
   ```
3. Add DNS records to your domain (TXT, DKIM, DKIM2)
4. Wait for verification (up to 48 hours)

### 3. Container Registry Docker Push

**Why needed?** Bootstrap image needs to be replaced with your app.

**Steps:**
```bash
# 1. Build Docker image
docker build -t appraisal-api:latest .

# 2. Login to Azure Container Registry
az acr login --name acrappraisal<env><suffix>

# 3. Tag and push
docker tag appraisal-api:latest acrappraisal<env><suffix>.azurecr.io/appraisal-api:latest
docker push acrappraisal<env><suffix>.azurecr.io/appraisal-api:latest

# 4. Restart Container App to pull new image
az containerapp revision restart -n <app-name> -g <resource-group> --revision <revision-name>
```

## 🔍 Current Status Summary

### What Works Now (After Deployment)
| Service | Local Dev | Container Apps | Notes |
|---------|-----------|----------------|-------|
| Cosmos DB | ✅ API Key | ✅ Managed Identity | Working |
| Key Vault | ✅ API Key | ✅ Managed Identity | Working |
| ACS Chat Tokens | ✅ API Key | ✅ Managed Identity | **FIXED** - smart fallback added |
| Google Maps API | ✅ | ✅ | API key in env vars |
| Azure OpenAI | ✅ | ✅ | API key in env vars |
| Census/NPS APIs | ✅ | ✅ | API keys in env vars |

### What Needs Manual Setup
| Service | Status | Blocker | Impact |
|---------|--------|---------|--------|
| Teams Messaging | ❌ | Graph API permissions | 401 Unauthorized |
| Teams Meetings | ❌ | Graph API permissions | Will fail to create |
| ACS Email | ⚠️ | Domain verification | Can send but may go to spam |

## 🚀 Deployment Commands

### 1. Deploy Infrastructure
```bash
# Set variables
$resourceGroup = "rg-appraisal-staging"
$location = "eastus"

# Create resource group
az group create -n $resourceGroup -l $location

# Deploy Bicep template
az deployment group create `
  -g $resourceGroup `
  -f infrastructure/main.bicep `
  -p environment=staging `
  -p googleMapsApiKey="$env:GOOGLE_MAPS_API_KEY" `
  -p azureOpenAiApiKey="$env:AZURE_OPENAI_API_KEY" `
  -p azureOpenAiEndpoint="$env:AZURE_OPENAI_ENDPOINT" `
  -p azureTenantId="$env:AZURE_TENANT_ID" `
  -p azureClientId="$env:AZURE_CLIENT_ID" `
  -p azureClientSecret="$env:AZURE_CLIENT_SECRET" `
  -p azureCommunicationApiKey="$env:AZURE_COMMUNICATION_API_KEY"
```

### 2. Verify Deployment
```bash
# Check Container App status
az containerapp show -n <app-name> -g $resourceGroup --query properties.runningStatus

# Check Managed Identity assignment
az containerapp identity show -n <app-name> -g $resourceGroup

# View role assignments
az role assignment list --assignee <managed-identity-principal-id> --all
```

### 3. Configure Graph API Permissions
See "Manual Configuration Required" section above.

### 4. Build and Push Docker Images
See "Container Registry Docker Push" section above.

## 🔧 Local Development Setup

### Environment Variables Required
```bash
# .env file (line 9 - for local development)
ALLOW_TEST_TOKENS=true  # Changed from false

# ACS uses API key locally, Managed Identity in production
AZURE_COMMUNICATION_API_KEY=<your-key>  # Already configured
AZURE_COMMUNICATION_ENDPOINT=<your-endpoint>  # Already configured
```

### Test Token Configuration Fixed
✅ Duplicate `ALLOW_TEST_TOKENS` setting removed from line 137
✅ Line 9 now controls test token behavior

## 📝 Architecture Decisions

### Why Managed Identity + API Key Fallback?

```typescript
// src/services/acs-identity.service.ts
if (apiKey) {
  // Local: Use connection string with API key
  const connectionString = `endpoint=${endpoint};accesskey=${apiKey}`;
  this.identityClient = new CommunicationIdentityClient(connectionString);
} else {
  // Production: Use Managed Identity (requires Contributor role on ACS)
  const credential = new DefaultAzureCredential();
  this.identityClient = new CommunicationIdentityClient(endpoint, credential);
}
```

**Benefits:**
1. **Security**: No secrets in production environment
2. **Convenience**: Developers can test locally with API key
3. **Flexibility**: Works in both environments without code changes
4. **Best Practice**: Aligns with Azure Well-Architected Framework

### Why Separate Graph API Permissions?

**ACS Contributor Role:**
- Controls: Azure Communication Services resources
- Grants: Create identities, issue tokens, manage ACS chat
- Scope: ACS resource only

**Microsoft Graph API:**
- Controls: Microsoft 365 services (Teams, Outlook, OneDrive, etc.)
- Grants: Create Teams meetings, send messages, access calendars
- Scope: Entire Microsoft 365 tenant

These are **completely separate systems** requiring separate permissions.

## 🎯 Success Criteria

### Deployment Successful When:
- ✅ Container Apps are running (status: "Running")
- ✅ Managed Identity assigned to Container Apps
- ✅ ACS Contributor role assigned to Managed Identity
- ✅ Cosmos DB role assignment active
- ✅ Key Vault role assignment active
- ✅ Environment variables configured
- ✅ Docker images pushed to Container Registry

### Teams Integration Working When:
- ✅ Graph API permissions granted + admin consent
- ✅ Can create Teams meetings via API
- ✅ Can send 1-on-1 Teams messages via API
- ✅ No 401 Unauthorized errors

### Email Sending Working When:
- ✅ ACS Email domain verified (DNS records added)
- ✅ Can send emails without spam warnings
- ✅ Sender domain appears as verified

## 🔗 Related Documentation

- [API Production Audit Report](./API_PRODUCTION_AUDIT_REPORT.md)
- [Azure Deployment Guide](./AZURE_DEPLOYMENT_GUIDE.md)
- [Communication Services Documentation](./COMMUNICATIONS_SERVICES.md)
- [Cosmos DB Setup](./COSMOS_DB_SETUP.md)

## 📞 Support

If you encounter issues:
1. Check Container App logs: `az containerapp logs show -n <app-name> -g <rg>`
2. Verify Managed Identity: `az containerapp identity show -n <app-name> -g <rg>`
3. Check role assignments: `az role assignment list --assignee <principal-id>`
4. Review deployment outputs: `az deployment group show -g <rg> -n main-deployment`
