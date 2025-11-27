# Azure Deployment Guide for Appraisal Management Platform

## 🚀 **Quick Deployment Steps**

### **Prerequisites**
1. **Azure Subscription** with contributor access
2. **GitHub Repository** with code
3. **Azure CLI** installed locally

### **Step 1: Deploy Azure Infrastructure**

1. **Login to Azure:**
   ```bash
   az login
   az account set --subscription "your-subscription-id"
   ```

2. **Create Resource Group:**
   ```bash
   az group create --name rg-appraisal-prod --location eastus2
   ```

3. **Deploy Infrastructure:**
   ```bash
   cd infrastructure
   az deployment group create \
     --resource-group rg-appraisal-prod \
     --template-file main-production.bicep \
     --parameters environment=production
   ```

### **Step 2: Configure GitHub Secrets**

1. **Create Service Principal:**
   ```bash
   az ad sp create-for-rbac --name "appraisal-management-sp" \
     --role contributor \
     --scopes /subscriptions/{subscription-id} \
     --sdk-auth
   ```

2. **Add GitHub Repository Secrets:**
   - `AZURE_CREDENTIALS` - JSON output from step 1
   - `AZURE_SUBSCRIPTION_ID` - Your subscription ID

### **Step 3: Configure Application Settings**

After infrastructure deployment, configure App Service with environment variables:

```bash
# Get App Service name
APP_NAME=$(az deployment group show \
  --resource-group rg-appraisal-prod \
  --name main-production \
  --query "properties.outputs.appServiceName.value" -o tsv)

# Configure environment variables
az webapp config appsettings set \
  --resource-group rg-appraisal-prod \
  --name $APP_NAME \
  --settings \
    NODE_ENV=production \
    WEBSITE_NODE_DEFAULT_VERSION=18-lts \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

### **Step 4: Deploy Application**

1. **Push to main branch** - GitHub Actions will automatically deploy
2. **Or deploy manually:**
   ```bash
   # Build application
   npm run build
   
   # Deploy to App Service
   az webapp deployment source config-zip \
     --resource-group rg-appraisal-prod \
     --name $APP_NAME \
     --src deployment-package.zip
   ```

### **Step 5: Configure Cosmos DB Connection**

1. **Get Cosmos DB connection details:**
   ```bash
   # Get Cosmos endpoint
   COSMOS_ENDPOINT=$(az cosmosdb show \
     --resource-group rg-appraisal-prod \
     --name appraisal-mgmt-prod-cosmos \
     --query "documentEndpoint" -o tsv)
   
   # Get Cosmos key
   COSMOS_KEY=$(az cosmosdb keys list \
     --resource-group rg-appraisal-prod \
     --name appraisal-mgmt-prod-cosmos \
     --query "primaryMasterKey" -o tsv)
   ```

2. **Add to App Service settings:**
   ```bash
   az webapp config appsettings set \
     --resource-group rg-appraisal-prod \
     --name $APP_NAME \
     --settings \
       AZURE_COSMOS_ENDPOINT="$COSMOS_ENDPOINT" \
       AZURE_COSMOS_KEY="$COSMOS_KEY" \
       AZURE_COSMOS_DATABASE_NAME="appraisal-management"
   ```

---

## 🏗️ **Manual Infrastructure Deployment**

If you prefer manual deployment over GitHub Actions:

### **Deploy All Services:**

```bash
# 1. Deploy main infrastructure
az deployment group create \
  --resource-group rg-appraisal-prod \
  --template-file infrastructure/main-production.bicep \
  --parameters environment=production location=eastus2

# 2. Get deployment outputs
az deployment group show \
  --resource-group rg-appraisal-prod \
  --name main-production \
  --query "properties.outputs"
```

### **Verify Deployment:**

```bash
# Check App Service
az webapp list --resource-group rg-appraisal-prod --output table

# Check Cosmos DB
az cosmosdb list --resource-group rg-appraisal-prod --output table

# Test endpoint
curl https://your-app-service-name.azurewebsites.net/api/health
```

---

## 🔧 **Environment Configuration**

### **Required Environment Variables:**

| Variable | Source | Description |
|----------|--------|-------------|
| `AZURE_COSMOS_ENDPOINT` | Cosmos DB | Database endpoint URL |
| `AZURE_COSMOS_KEY` | Cosmos DB | Primary access key |
| `AZURE_COSMOS_DATABASE_NAME` | Config | Database name |
| `NODE_ENV` | Config | Set to "production" |
| `PORT` | Azure | Auto-set by App Service |

### **Optional API Keys:**
- `GOOGLE_MAPS_API_KEY` - For property intelligence
- `AZURE_OPENAI_API_KEY` - For AI features
- `JWT_SECRET` - For authentication (generate secure key)

---

## 📊 **Post-Deployment Verification**

### **Test API Endpoints:**

```bash
# Health check
curl https://your-app.azurewebsites.net/api/health

# API documentation
curl https://your-app.azurewebsites.net/api/docs

# Test order creation
curl -X POST https://your-app.azurewebsites.net/api/orders \
  -H "Content-Type: application/json" \
  -d '{"propertyAddress": "123 Main St", "orderType": "appraisal"}'
```

### **Monitor Logs:**

```bash
# Stream App Service logs
az webapp log tail --resource-group rg-appraisal-prod --name your-app-name

# Check Application Insights
# Visit Azure Portal > Application Insights > Live Metrics
```

---

## 🔒 **Security Configuration**

### **Network Security:**
1. **Configure App Service firewall** (if needed)
2. **Enable HTTPS only** (done by Bicep template)
3. **Configure CORS** for frontend domains

### **Secrets Management:**
1. **Use Azure Key Vault** for sensitive data
2. **Enable Managed Identity** for secure access
3. **Rotate keys regularly**

---

## 💰 **Cost Optimization**

### **Current Configuration:**
- **App Service Plan**: Basic (B1) ~$13/month
- **Cosmos DB**: Serverless pricing ~$0.25/million requests
- **Service Bus**: Basic tier ~$0.05/million operations
- **Application Insights**: First 5GB free

### **Estimated Monthly Cost**: $15-25 for development/testing

---

## 🚀 **Ready for Deployment!**

Your platform includes:
- ✅ **27 API Endpoints** - Complete CRUD operations
- ✅ **Property Intelligence** - Census, FEMA, geospatial data
- ✅ **AI Integration** - Azure OpenAI ready
- ✅ **Production Security** - Helmet, CORS, rate limiting
- ✅ **Monitoring** - Application Insights integration
- ✅ **Docker Support** - Container-ready deployment

**Next Step**: Choose deployment method (GitHub Actions automated or manual) and execute!