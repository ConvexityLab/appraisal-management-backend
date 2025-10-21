# GitHub Actions Setup Guide

## Quick Setup for Azure Cosmos DB Deployment

### 1. Create Azure Service Principal

Run this command in Azure CLI (replace `{subscription-id}` with your subscription ID):

```bash
az ad sp create-for-rbac \
  --name "appraisal-management-github" \
  --role contributor \
  --scopes /subscriptions/{subscription-id} \
  --sdk-auth
```

Copy the JSON output - you'll need it for GitHub secrets.

### 2. Configure GitHub Repository

#### Add Repository Secrets:
1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add:

| Secret Name | Value |
|-------------|-------|
| `AZURE_CREDENTIALS` | Paste the JSON output from step 1 |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID |

#### Create Environments (Optional):
1. Go to **Settings** → **Environments**
2. Create `development` environment
3. Create `production` environment (with protection rules)
4. Add environment variables to each:

**Development Environment:**
```
RESOURCE_GROUP_DEV = rg-appraisal-dev
AZURE_REGION = East US
```

**Production Environment:**
```
RESOURCE_GROUP_PROD = rg-appraisal-prod
AZURE_REGION = East US
```

### 3. Deploy Cosmos DB

#### Automatic Deployment:
- Push changes to `infrastructure/` folder on main/master branch
- GitHub Actions will automatically deploy to development

#### Manual Deployment:
1. Go to **Actions** tab
2. Select **"Deploy Cosmos DB"** workflow
3. Click **"Run workflow"**
4. Choose environment and options
5. Click **"Run workflow"**

### 4. Monitor Deployment

- View deployment progress in **Actions** tab
- Check deployment summary for results
- Access Azure Portal to verify resources

## Workflow Features

✅ **Template Validation** - Bicep templates validated before deployment  
✅ **What-If Analysis** - Preview changes before applying  
✅ **Environment Separation** - Different configurations for dev/prod  
✅ **Approval Gates** - Production deployments require approval  
✅ **Detailed Logging** - Complete audit trail of all deployments  
✅ **Security** - Service principal authentication, no local credentials  

## Troubleshooting

### Common Issues:

1. **Permission Errors**
   - Ensure service principal has Contributor role
   - Check subscription ID is correct

2. **Template Validation Failures**
   - Review Bicep template syntax
   - Check parameter file format

3. **Resource Group Issues**
   - Verify resource group names in parameters
   - Ensure proper naming conventions

### Getting Help:

- Check **Actions** tab for detailed error logs
- Review deployment summary for specific issues
- Validate templates locally: `az bicep build --file infrastructure/deploy-cosmos.bicep`

## Next Steps

After successful deployment:
1. Configure your application with the output environment variables
2. Set up monitoring and alerts
3. Configure backup and disaster recovery
4. Implement application deployment pipelines