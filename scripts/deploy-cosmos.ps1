# Azure Cosmos DB Deployment Script
# Enterprise Appraisal Management System

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US",
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [string]$DeploymentName = "cosmos-deployment-$(Get-Date -Format 'yyyy-MM-dd-HHmm')"
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Azure Cosmos DB Deployment"
Write-Host "Enterprise Appraisal Management System"
Write-Host "========================================"
Write-Host ""

# Login and set subscription
Write-Host "Setting Azure subscription context..."
az account set --subscription $SubscriptionId

# Verify subscription
$currentSub = az account show --query "id" -o tsv
if ($currentSub -ne $SubscriptionId) {
    Write-Error "Failed to set subscription context"
    exit 1
}

Write-Host "✓ Subscription: $SubscriptionId"
Write-Host "✓ Resource Group: $ResourceGroupName"
Write-Host "✓ Location: $Location"
Write-Host "✓ Environment: $Environment"
Write-Host ""

# Create resource group if it doesn't exist
Write-Host "Ensuring resource group exists..."
$rgExists = az group exists --name $ResourceGroupName
if ($rgExists -eq "false") {
    Write-Host "Creating resource group: $ResourceGroupName"
    az group create --name $ResourceGroupName --location $Location --tags Environment=$Environment Project="AppraisalManagement"
    Write-Host "✓ Resource group created"
} else {
    Write-Host "✓ Resource group already exists"
}

# Deploy Cosmos DB infrastructure
Write-Host ""
Write-Host "Deploying Azure Cosmos DB infrastructure..."

$deploymentCommand = @"
az deployment group create \
    --resource-group $ResourceGroupName \
    --template-file infrastructure/modules/cosmos-production.bicep \
    --parameters location="$Location" environment="$Environment" \
    --name $DeploymentName \
    --verbose
"@

Write-Host "Executing deployment command..."
Invoke-Expression $deploymentCommand

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed with exit code: $LASTEXITCODE"
    exit 1
}

Write-Host "✓ Cosmos DB deployment completed successfully"

# Get deployment outputs
Write-Host ""
Write-Host "Retrieving deployment outputs..."

$outputs = az deployment group show --resource-group $ResourceGroupName --name $DeploymentName --query "properties.outputs" -o json | ConvertFrom-Json

$cosmosEndpoint = $outputs.cosmosEndpoint.value
$cosmosAccountName = $outputs.cosmosAccountName.value
$databaseName = $outputs.databaseName.value
$containerNames = $outputs.containerNames.value -join ", "

Write-Host ""
Write-Host "========================================"
Write-Host "Deployment Summary"
Write-Host "========================================"
Write-Host "Cosmos Account: $cosmosAccountName"
Write-Host "Endpoint: $cosmosEndpoint"
Write-Host "Database: $databaseName"
Write-Host "Containers: $containerNames"
Write-Host ""

# Get connection strings (for configuration)
Write-Host "Retrieving connection information..."
$connectionStrings = az cosmosdb keys list --name $cosmosAccountName --resource-group $ResourceGroupName --type connection-strings --query "connectionStrings[0].connectionString" -o tsv

Write-Host ""
Write-Host "========================================"
Write-Host "Configuration Information"
Write-Host "========================================"
Write-Host "Add these to your application configuration:"
Write-Host ""
Write-Host "COSMOS_ENDPOINT=$cosmosEndpoint"
Write-Host "COSMOS_DATABASE_NAME=$databaseName"
Write-Host "COSMOS_CONTAINER_ORDERS=orders"
Write-Host "COSMOS_CONTAINER_VENDORS=vendors"
Write-Host "COSMOS_CONTAINER_PROPERTY_SUMMARIES=property-summaries"
Write-Host "COSMOS_CONTAINER_PROPERTIES=properties"
Write-Host ""
Write-Host "Connection string (store securely):"
Write-Host "COSMOS_CONNECTION_STRING=$connectionStrings"
Write-Host ""

# Create configuration file
$configFile = "cosmos-config-$Environment.json"
$config = @{
    cosmosEndpoint = $cosmosEndpoint
    cosmosAccountName = $cosmosAccountName
    databaseName = $databaseName
    containers = @{
        orders = "orders"
        vendors = "vendors"
        propertySummaries = "property-summaries"
        properties = "properties"
    }
    environment = $Environment
    location = $Location
    deploymentName = $DeploymentName
    deployedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json -Depth 3

$config | Out-File -FilePath $configFile -Encoding UTF8
Write-Host "Configuration saved to: $configFile"

# Verify deployment
Write-Host ""
Write-Host "Verifying deployment..."

$accountStatus = az cosmosdb show --name $cosmosAccountName --resource-group $ResourceGroupName --query "provisioningState" -o tsv
$databaseExists = az cosmosdb sql database exists --account-name $cosmosAccountName --resource-group $ResourceGroupName --name $databaseName

if ($accountStatus -eq "Succeeded" -and $databaseExists -eq "true") {
    Write-Host "✓ Cosmos DB account is ready"
    Write-Host "✓ Database is available"
    
    # Check containers
    $containerCount = (az cosmosdb sql container list --account-name $cosmosAccountName --resource-group $ResourceGroupName --database-name $databaseName --query "length(@)") -as [int]
    Write-Host "✓ $containerCount containers created"
    
} else {
    Write-Warning "Deployment verification found issues. Please check the Azure portal."
}

# Performance recommendations
Write-Host ""
Write-Host "========================================"
Write-Host "Performance Recommendations"
Write-Host "========================================"
Write-Host "1. Monitor RU consumption and scale containers as needed"
Write-Host "2. Use appropriate partition keys for even distribution"
Write-Host "3. Implement connection pooling in your application"
Write-Host "4. Use bulk operations for large data operations"
Write-Host "5. Monitor query performance and optimize indexes"
Write-Host ""

Write-Host "========================================"
Write-Host "Deployment completed successfully!"
Write-Host "Time: $(Get-Date)"
Write-Host "========================================"