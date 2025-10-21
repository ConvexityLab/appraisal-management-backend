# GitHub Actions CI/CD Setup

## Overview

This repository uses GitHub Actions for automated CI/CD deployment to Azure. The pipeline is designed for Infrastructure as Code using Bicep templates and automated application deployment.

## Required GitHub Secrets

Configure the following secrets in your GitHub repository (Settings → Secrets and variables → Actions):

### Azure Authentication
```
AZURE_CREDENTIALS - Azure Service Principal credentials (JSON format)
AZURE_SUBSCRIPTION_ID - Azure subscription ID
```

### Optional Notifications
```
MS_TEAMS_WEBHOOK_URI - Microsoft Teams webhook for notifications
SNYK_TOKEN - Snyk security scanning token
```

## Azure Service Principal Setup

1. Create a Service Principal for GitHub Actions:
```bash
az ad sp create-for-rbac --name "github-actions-appraisal-mgmt" \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID \
  --sdk-auth
```

2. Copy the JSON output and add it as `AZURE_CREDENTIALS` secret in GitHub.

## Workflow Files

### 1. Continuous Integration (`.github/workflows/ci.yml`)
- Code quality checks (ESLint, Prettier, TypeScript)
- Unit and integration tests
- Security scanning
- Bicep template validation

### 2. Infrastructure Deployment (`.github/workflows/infrastructure.yml`)
- Deploys Azure infrastructure using Bicep templates
- Validates deployment
- Runs infrastructure tests

### 3. Application Deployment (`.github/workflows/application.yml`)
- Builds Node.js application
- Deploys to Azure App Service
- Runs integration and performance tests

### 4. Main Deployment (`.github/workflows/deploy.yml`)
- Orchestrates the entire deployment process
- Handles environment-specific deployments
- Manages production approvals

## Deployment Environments

### Development
- **Trigger**: Push to `main` branch
- **Auto-deploy**: Yes
- **Approval**: Not required

### Staging
- **Trigger**: Manual workflow dispatch
- **Auto-deploy**: Yes
- **Approval**: Not required

### Production
- **Trigger**: Manual workflow dispatch or promotion from staging
- **Auto-deploy**: No
- **Approval**: Required via GitHub environments

## Manual Deployment

To deploy manually:

1. Go to Actions → "Deploy to Azure"
2. Click "Run workflow"
3. Select target environment
4. Choose whether to deploy infrastructure
5. Click "Run workflow"

## Environment Configuration

### GitHub Environments
Create the following environments in GitHub (Settings → Environments):

1. **dev** - No protection rules
2. **staging** - Optional reviewers
3. **prod** - Required reviewers + deployment branches
4. **production-approval** - Required reviewers for production promotion

### Environment Variables
Each environment should have:
- Different resource sizing (defined in Bicep parameters)
- Environment-specific secrets in Key Vault
- Appropriate monitoring and alerting thresholds

## Bicep Templates

### Main Template
- `infrastructure/main-production.bicep` - Main orchestration template

### Modules
- `modules/app-service.bicep` - App Service Plan and Web App
- `modules/cosmos-db.bicep` - Cosmos DB with containers
- `modules/service-bus.bicep` - Service Bus with queues and topics
- `modules/key-vault.bicep` - Key Vault with access policies
- `modules/monitoring.bicep` - Application Insights and Log Analytics
- `modules/storage.bicep` - Storage account with containers
- `modules/key-vault-secrets.bicep` - Secrets management
- `modules/app-service-config.bicep` - App Service configuration

### Parameters
- `parameters/dev.parameters.json` - Development configuration
- `parameters/staging.parameters.json` - Staging configuration
- `parameters/prod.parameters.json` - Production configuration

## Monitoring and Alerts

### Application Insights
- Automatic telemetry collection
- Custom metrics and logging
- Performance monitoring
- Availability tests (production only)

### Alerts
- High response time (>2s for prod, >5s for dev/staging)
- Error rate thresholds (>5% for prod, >10% for dev/staging)
- Resource utilization monitoring

### Notifications
- Microsoft Teams integration for deployment status
- GitHub issue creation for deployment failures
- Email notifications for critical alerts

## Security

### RBAC
- Service Principal with minimal required permissions
- Environment-specific access controls
- Key Vault access policies for managed identities

### Secrets Management
- All sensitive data stored in Azure Key Vault
- App Service uses Key Vault references
- No secrets in application code or configuration files

### Security Scanning
- Trivy vulnerability scanning
- Snyk dependency checking
- Azure Security Center integration

## Troubleshooting

### Common Issues

1. **Azure Authentication Failure**
   - Verify AZURE_CREDENTIALS secret format
   - Check Service Principal permissions
   - Ensure subscription ID is correct

2. **Bicep Deployment Failure**
   - Validate templates locally: `az bicep build --file main-production.bicep`
   - Check parameter file syntax
   - Verify resource naming conventions

3. **App Service Deployment Failure**
   - Check build artifacts are created correctly
   - Verify Node.js version compatibility
   - Check App Service logs in Azure portal

4. **Health Check Failures**
   - Verify application starts correctly
   - Check environment variables are set
   - Review Application Insights logs

### Debug Commands

```bash
# Validate Bicep locally
az bicep build --file infrastructure/main-production.bicep

# Test deployment (what-if)
az deployment sub what-if \
  --location eastus2 \
  --template-file infrastructure/main-production.bicep \
  --parameters infrastructure/parameters/dev.parameters.json

# Check App Service logs
az webapp log tail --name <app-service-name> --resource-group <resource-group>
```

## Cost Optimization

### Development Environment
- Uses Basic/Standard tiers for cost efficiency
- Scheduled shutdown capabilities
- Minimal monitoring retention

### Production Environment
- Reserved instances for predictable costs
- Autoscaling based on demand
- Long-term storage for compliance

### Cost Monitoring
- Azure Cost Management integration
- Budget alerts and spending limits
- Resource tagging for cost allocation

---

For additional help, check the [Azure Deployment Plan](../docs/AZURE_DEPLOYMENT_PLAN.md) or create an issue in this repository.