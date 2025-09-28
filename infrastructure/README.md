# Infrastructure Deployment Guide

## Azure Cosmos DB Deployment using Bicep & GitHub Actions

This guide explains how to deploy Azure Cosmos DB using our Infrastructure as Code (Bicep) templates through GitHub Actions workflows.

## Overview

We use **Bicep** with **GitHub Actions** as our deployment framework for consistent, automated infrastructure deployments:

- **Infrastructure as Code**: All infrastructure defined in Bicep templates
- **Automated Deployment**: GitHub Actions workflows handle deployment
- **Version Control**: All infrastructure changes tracked in git
- **Environment Isolation**: Separate workflows for dev/prod environments
- **Validation**: Built-in template validation and what-if analysis
- **Security**: Service principal authentication with secrets

## File Structure

```
infrastructure/
├── deploy-cosmos.bicep                    # Main deployment template
├── modules/
│   ├── cosmos-production.bicep            # Cosmos DB module (production-ready)
│   └── cosmos-db.bicep                    # Cosmos DB module (basic)
├── parameters/
│   ├── cosmos-production.parameters.json  # Production parameters
│   └── cosmos-development.parameters.json # Development parameters
└── README.md                              # This file

.github/workflows/
├── deploy-infrastructure.yml              # Automatic deployment on push
└── deploy-cosmos.yml                      # Manual Cosmos DB deployment
```

## Prerequisites

1. **Azure CLI** installed and logged in
2. **Bicep CLI** (comes with Azure CLI 2.20.0+)
3. **Appropriate Azure permissions** (Contributor or Owner on resource group)

## Quick Start

### 1. Setup GitHub Repository Secrets

Configure these secrets in your GitHub repository:

```
AZURE_CREDENTIALS - Service principal credentials (JSON)
AZURE_SUBSCRIPTION_ID - Your Azure subscription ID
```

### 2. Configure Environment Variables (Optional)

Set these variables in your GitHub environments (development/production):

```
RESOURCE_GROUP_DEV - Development resource group name
RESOURCE_GROUP_PROD - Production resource group name  
AZURE_REGION - Primary Azure region
```

### 3. Deploy via GitHub Actions

**Automatic Deployment (on push to main/master):**
- Push changes to `infrastructure/` folder
- GitHub Actions automatically validates and deploys to development
- Production deployment requires manual approval

**Manual Deployment:**
1. Go to **Actions** tab in GitHub
2. Select **"Deploy Cosmos DB"** workflow
3. Click **"Run workflow"**
4. Choose environment (development/production)
5. Optionally specify resource group and location
6. Click **"Run workflow"**## Manual Deployment (Local Development Only)

For local development and testing, you can deploy manually:

### 1. Login to Azure
```bash
az login
az account set --subscription "your-subscription-id"
```

### 2. Deploy Development Environment
```bash
az deployment group create \
  --resource-group "rg-appraisal-dev" \
  --name "cosmos-dev-local-$(date +%Y%m%d-%H%M)" \
  --template-file "infrastructure/deploy-cosmos.bicep" \
  --parameters "@infrastructure/parameters/cosmos-development.parameters.json"
```

### 3. Get Deployment Outputs
```bash
az deployment group show \
  --resource-group "rg-appraisal-dev" \
  --name "cosmos-dev-local-YYYYMMDD-HHMM" \
  --query "properties.outputs"
```

> **Note**: Manual deployment should only be used for local development. All production deployments must go through GitHub Actions for proper audit trails and security.

## Configuration

### Environment Parameters

Parameters are defined in JSON files under `infrastructure/parameters/`:

**Development** (`cosmos-development.parameters.json`):
```json
{
  "location": { "value": "East US" },
  "environment": { "value": "development" },
  "cosmosAccountName": { "value": "appraisal-cosmos-dev" },
  "databaseName": { "value": "appraisal-management-dev" }
}
```

**Production** (`cosmos-production.parameters.json`):
```json
{
  "location": { "value": "East US" },
  "environment": { "value": "production" },
  "cosmosAccountName": { "value": "appraisal-cosmos-prod" },
  "databaseName": { "value": "appraisal-management" }
}
```

### Customization

To customize the deployment, you can:

1. **Modify parameter files** for environment-specific settings
2. **Override parameters** in the deployment command:
   ```bash
   az deployment group create \
     --parameters cosmosAccountName="my-custom-name" \
     --parameters location="West US 2"
   ```
3. **Edit the Bicep templates** for advanced configuration

## Deployment Outputs

After successful deployment, you'll get these outputs:

```json
{
  "cosmosAccountName": "appraisal-cosmos-prod-abc123",
  "cosmosEndpoint": "https://appraisal-cosmos-prod-abc123.documents.azure.com:443/",
  "databaseName": "appraisal-management",
  "containerNames": ["orders", "vendors", "property-summaries", "properties"],
  "appSettings": {
    "COSMOS_ENDPOINT": "https://...",
    "COSMOS_DATABASE_NAME": "appraisal-management",
    "COSMOS_CONTAINER_ORDERS": "orders",
    "COSMOS_CONTAINER_VENDORS": "vendors",
    "COSMOS_CONTAINER_PROPERTY_SUMMARIES": "property-summaries",
    "COSMOS_CONTAINER_PROPERTIES": "properties"
  }
}
```

## Application Configuration

Use the deployment outputs to configure your application:

### Environment Variables
```bash
export COSMOS_ENDPOINT="https://appraisal-cosmos-prod-abc123.documents.azure.com:443/"
export COSMOS_DATABASE_NAME="appraisal-management"
export COSMOS_CONTAINER_ORDERS="orders"
export COSMOS_CONTAINER_VENDORS="vendors"
export COSMOS_CONTAINER_PROPERTY_SUMMARIES="property-summaries"
export COSMOS_CONTAINER_PROPERTIES="properties"
```

### Node.js Configuration
```typescript
const cosmosConfig = {
  endpoint: process.env.COSMOS_ENDPOINT,
  databaseName: process.env.COSMOS_DATABASE_NAME,
  containers: {
    orders: process.env.COSMOS_CONTAINER_ORDERS,
    vendors: process.env.COSMOS_CONTAINER_VENDORS,
    propertySummaries: process.env.COSMOS_CONTAINER_PROPERTY_SUMMARIES,
    properties: process.env.COSMOS_CONTAINER_PROPERTIES
  }
};
```

## GitHub Actions Workflows

### Infrastructure Deployment (`deploy-infrastructure.yml`)
**Triggers:**
- Push to main/master branch with infrastructure changes
- Pull request validation (what-if analysis only)
- Manual workflow dispatch

**Features:**
- Template validation
- What-if deployment analysis on PRs
- Automatic deployment to development
- Manual approval required for production
- Deployment summaries with results

### Cosmos DB Deployment (`deploy-cosmos.yml`)
**Triggers:**
- Manual workflow dispatch only

**Features:**
- Environment selection (development/production)
- Custom resource group and location
- What-if analysis before deployment
- Detailed deployment summaries
- Verification checks

### Workflow Security
- Service principal authentication
- Environment-based approvals
- Secrets management
- Audit trails for all deployments

## Troubleshooting

### Common Issues

1. **Permission Errors**
   - Ensure you have Contributor or Owner role on the resource group
   - Check that the service principal has appropriate permissions

2. **Template Validation Errors**
   - Run `az bicep build --file infrastructure/deploy-cosmos.bicep` to validate
   - Check parameter file syntax

3. **Resource Conflicts**
   - Cosmos DB account names must be globally unique
   - Use the `uniqueString()` function in templates

4. **Deployment Failures**
   - Check deployment logs: `az deployment group show --name <deployment-name>`
   - Review activity logs in Azure Portal

### Getting Help

1. **Validate templates**: `az bicep build --file <template>`
2. **What-if deployment**: `az deployment group what-if --template-file <template>`
3. **Deployment logs**: `az deployment group show --name <deployment>`

## Best Practices

1. **Use parameter files** for environment-specific configuration
2. **Version your templates** in source control
3. **Test deployments** in development environments first
4. **Use meaningful deployment names** with timestamps
5. **Tag resources** for cost management and organization
6. **Validate templates** before deployment
7. **Monitor deployment logs** for issues

## Security Considerations

1. **Connection strings** are not exposed in outputs
2. **Access keys** must be retrieved separately using Azure CLI or Portal
3. **Use Managed Identity** where possible for application access
4. **Enable firewall rules** to restrict access
5. **Configure private endpoints** for enhanced security

---

## GitHub Actions Setup Guide

### 1. Create Azure Service Principal

```bash
az ad sp create-for-rbac \
  --name "appraisal-management-sp" \
  --role contributor \
  --scopes /subscriptions/{subscription-id} \
  --sdk-auth
```

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AZURE_CREDENTIALS` | JSON output from step 1 | Service principal credentials |
| `AZURE_SUBSCRIPTION_ID` | Your subscription ID | Azure subscription identifier |

### 3. Configure Environment Variables (Optional)

In GitHub repository settings, create environments (development, production) with these variables:

| Variable Name | Development Value | Production Value |
|---------------|------------------|------------------|
| `RESOURCE_GROUP_DEV` | `rg-appraisal-dev` | N/A |
| `RESOURCE_GROUP_PROD` | N/A | `rg-appraisal-prod` |
| `AZURE_REGION` | `East US` | `East US` |

### 4. Enable Required Permissions

Ensure your service principal has:
- **Contributor** role on target resource groups
- **Reader** role on subscription (for what-if analysis)

---

## Migration from Manual Scripts

The new GitHub Actions approach provides significant advantages over manual deployment scripts:

- ✅ **Automated Deployment** - No manual script execution required
- ✅ **Environment Controls** - Built-in approval workflows for production
- ✅ **Audit Trails** - Complete deployment history in GitHub
- ✅ **Security** - Service principal authentication, no local credentials
- ✅ **Validation** - Automatic template validation and what-if analysis
- ✅ **Consistency** - Same deployment process every time
- ✅ **Integration** - Native GitHub integration with pull request workflows

All deployment logic is now contained in Bicep templates and executed through secure, auditable GitHub Actions workflows.