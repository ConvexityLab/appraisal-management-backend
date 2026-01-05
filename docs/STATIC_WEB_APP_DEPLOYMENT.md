# Azure Static Web App Deployment Guide

## Architecture

**Backend Repo** (this repo):
- Deploys Azure Static Web App **resource** via Bicep
- Provides deployment token for frontend repo
- Manages infrastructure and API backend

**Frontend Repo** (separate):
- Contains actual frontend code (React, Vue, Angular, etc.)
- Uses deployment token to deploy to Static Web App
- GitHub Actions workflow handles build and deployment

## Setup Instructions

### 1. Deploy Static Web App Resource (This Repo)

The Bicep template creates the Azure Static Web App resource:

```bash
# Deploy infrastructure
az deployment group create \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --template-file infrastructure/main-production.bicep \
  --parameters environmentName=staging
```

After deployment, get the deployment token:

```bash
# Get deployment token for frontend repo
az staticwebapp secrets list \
  --name swa-appraisal-staging-<unique-id> \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --query "properties.apiKey" -o tsv
```

### 2. Configure Frontend Repo

In your **frontend repository**, add this GitHub Actions workflow:

**File:** `.github/workflows/deploy-static-web-app.yml`

```yaml
name: Deploy Frontend to Azure Static Web Apps

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
          
      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          
          # Build configuration
          app_location: "/" # Root of your frontend code
          api_location: "" # No API in frontend repo (using backend Container App)
          output_location: "dist" # Vite/React build output (or "build" for CRA)
          
      - name: Deploy Configuration
        run: |
          echo "Frontend deployed to: ${{ steps.builddeploy.outputs.static_web_app_url }}"

  close_pull_request:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request
    steps:
      - name: Close Pull Request
        id: closepullrequest
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"
```

### 3. Add Secret to Frontend Repo

Add the deployment token as a GitHub secret:

```bash
# In your frontend repo settings:
# Settings > Secrets and variables > Actions > New repository secret
# Name: AZURE_STATIC_WEB_APPS_API_TOKEN
# Value: <token from step 1>
```

### 4. Configure API Backend URL

The frontend will automatically receive the backend API URL via environment variables:

**Vite:**
```typescript
// Access in your frontend code
const apiUrl = import.meta.env.VITE_API_URL;
```

**Create React App:**
```typescript
const apiUrl = process.env.REACT_APP_API_URL;
```

**Next.js:**
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

## Static Web App Configuration

**File:** `staticwebapp.config.json` (in frontend repo root)

```json
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated", "anonymous"]
    },
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/images/*.{png,jpg,gif}", "/css/*"]
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html",
      "statusCode": 200
    }
  },
  "globalHeaders": {
    "content-security-policy": "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"
  },
  "mimeTypes": {
    ".json": "application/json"
  }
}
```

## Backend API Integration

The Static Web App can optionally use Azure Static Web Apps' built-in API proxy:

**Option 1: Direct Backend Calls (Current Setup)**
```typescript
// Frontend calls Container App directly
const response = await fetch(`${apiUrl}/api/orders`);
```

**Option 2: Static Web App API Proxy (Optional)**
```json
// staticwebapp.config.json
{
  "routes": [
    {
      "route": "/api/*",
      "rewrite": "https://ca-appraisalapi-sta.example.azurecontainerapps.io/api/*"
    }
  ]
}
```

## Deployment Flow

1. **Infrastructure Change** (this repo):
   - Commit Bicep changes
   - GitHub Actions deploys Azure resources
   - Static Web App resource created/updated

2. **Frontend Change** (frontend repo):
   - Commit frontend code
   - GitHub Actions builds and deploys to Static Web App
   - Uses deployment token from backend infrastructure

## Environments

**Staging:**
- Static Web App: `swa-appraisal-staging-<id>`
- Backend API: `https://ca-appraisalapi-sta-<id>.azurecontainerapps.io`

**Production:**
- Static Web App: `swa-appraisal-prod-<id>`
- Backend API: `https://ca-appraisalapi-pro-<id>.azurecontainerapps.io`

## Custom Domains

To add custom domains, update the Bicep template or use Azure CLI:

```bash
az staticwebapp hostname set \
  --name swa-appraisal-prod-<id> \
  --resource-group rg-appraisal-mgmt-prod-eastus \
  --hostname app.yourdomain.com
```

## Benefits of This Architecture

✅ **Separation of Concerns**: Frontend and backend repos are independent
✅ **Independent Deployments**: Deploy frontend without touching backend
✅ **Automatic SSL**: Static Web Apps provides free HTTPS
✅ **Global CDN**: Content served from Azure's global network
✅ **PR Previews**: Automatic staging environments for pull requests
✅ **Cost Effective**: Free tier for development, pay only for Standard features

## Cost Estimate

**Free Tier:**
- 100 GB bandwidth/month
- Single custom domain
- No staging environments

**Standard Tier (~$9/month):**
- 100 GB bandwidth (then $0.20/GB)
- Unlimited custom domains
- Unlimited staging environments
- Private endpoints
- SLA: 99.95% uptime

## Next Steps

1. ✅ Deploy Static Web App resource via this repo's Bicep
2. Create frontend repository
3. Add GitHub Actions workflow to frontend repo
4. Configure deployment token as secret
5. Deploy frontend code
6. Access at: `https://<swa-name>.azurestaticapps.net`
