# Deploy Infrastructure with Your Identity for Local Testing
# This script gets your Azure user principal ID and includes it in the deployment

# Get your user principal ID
Write-Host "Getting your Azure user principal ID..." -ForegroundColor Cyan
$yourPrincipalId = az ad signed-in-user show --query id -o tsv

if (-not $yourPrincipalId) {
    Write-Host "❌ Failed to get your principal ID. Make sure you're logged in: az login" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Your Principal ID: $yourPrincipalId" -ForegroundColor Green
Write-Host ""

# Set deployment parameters
$resourceGroup = "rg-appraisal-staging"
$location = "eastus"
$environment = "staging"

Write-Host "Deploying infrastructure with the following settings:" -ForegroundColor Cyan
Write-Host "  Resource Group: $resourceGroup"
Write-Host "  Location: $location"
Write-Host "  Environment: $environment"
Write-Host "  Developer Access: YOUR identity will get ACS Contributor role"
Write-Host ""

# Create resource group if it doesn't exist
Write-Host "Creating resource group (if needed)..." -ForegroundColor Cyan
az group create --name $resourceGroup --location $location

# Deploy Bicep template at SUBSCRIPTION scope (Bicep creates the resource group)
Write-Host "Deploying Bicep template..." -ForegroundColor Cyan
az deployment sub create `
  --location $location `
  --template-file infrastructure/main.bicep `
  --parameters `
    environment=$environment `
    location=$location `
    appName="appraisal" `
    googleMapsApiKey="$env:GOOGLE_MAPS_API_KEY" `
    azureOpenAiApiKey="$env:AZURE_OPENAI_API_KEY" `
    azureOpenAiEndpoint="$env:AZURE_OPENAI_ENDPOINT" `
    googleGeminiApiKey="$env:GOOGLE_GEMINI_API_KEY" `
    censusApiKey="$env:CENSUS_API_KEY" `
    bridgeServerToken="$env:BRIDGE_SERVER_TOKEN" `
    npsApiKey="$env:NPS_API_KEY" `
    sambanovaApiKey="$env:SAMBANOVA_API_KEY" `
    azureCommunicationApiKey="$env:AZURE_COMMUNICATION_API_KEY" `
    azureTenantId="$env:AZURE_TENANT_ID" `
    azureClientId="$env:AZURE_CLIENT_ID" `
    azureClientSecret="$env:AZURE_CLIENT_SECRET" `
    emailDomain="$env:AZURE_COMMUNICATION_EMAIL_DOMAIN" `
    developerPrincipalIds="['$yourPrincipalId']"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your identity now has ACS Contributor role." -ForegroundColor Green
    Write-Host "You can test ACS features locally with your Managed Identity (via 'az login')." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Make sure you're logged in: az login"
    Write-Host "2. Restart your dev server: npm run dev"
    Write-Host "3. ACS routes will now use your Managed Identity instead of API key"
    Write-Host "4. Check logs for: 'ACS Identity Service initialized with Managed Identity'"
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details."
}
