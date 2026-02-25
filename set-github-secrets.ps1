#Requires -Version 5.1
param(
    [string]$Repo = "ConvexityLab/appraisal-management-backend"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) is not installed. Get it from https://cli.github.com"
    exit 1
}

Write-Host ""
Write-Host "Setting GitHub secrets for: $Repo" -ForegroundColor Cyan
Write-Host ""

function Set-GhSecret {
    param([string]$Name, [string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        Write-Warning "  SKIP $Name -- value is empty"
        return
    }
    $Value | gh secret set $Name --repo $Repo
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK  $Name" -ForegroundColor Green
    } else {
        Write-Host "  FAIL $Name" -ForegroundColor Red
    }
}

Write-Host "Azure infrastructure -- provide values from your Azure subscription." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Generate AZURE_CREDENTIALS with:" -ForegroundColor DarkGray
Write-Host "  az ad sp create-for-rbac --name appraisal-mgmt-deploy --role contributor \\" -ForegroundColor DarkGray
Write-Host "    --scopes /subscriptions/<SUB_ID>/resourceGroups/rg-appraisal-mgmt-staging-eastus \\" -ForegroundColor DarkGray
Write-Host "    --sdk-auth" -ForegroundColor DarkGray
Write-Host ""

$azureCreds = Read-Host "Paste AZURE_CREDENTIALS (the full JSON block)"
Set-GhSecret "AZURE_CREDENTIALS" $azureCreds

$subscriptionId = Read-Host "AZURE_SUBSCRIPTION_ID (GUID)"
Set-GhSecret "AZURE_SUBSCRIPTION_ID" $subscriptionId

$acrName = Read-Host "ACR_NAME (e.g. acrappraisalstagingxxx)"
Set-GhSecret "ACR_NAME" $acrName

$containerAppName = Read-Host "CONTAINER_APP_NAME (e.g. ca-appraisalapi-sta-lqxl)"
Set-GhSecret "CONTAINER_APP_NAME" $containerAppName

$rgDefault = "rg-appraisal-mgmt-staging-eastus"
$rgInput   = Read-Host "AZURE_RESOURCE_GROUP (press Enter for default: $rgDefault)"
$rg        = if ([string]::IsNullOrWhiteSpace($rgInput)) { $rgDefault } else { $rgInput }
Set-GhSecret "AZURE_RESOURCE_GROUP" $rg

Write-Host ""
Write-Host "WARNING: Rotate AZURE_OPENAI_API_KEY before continuing -- old key was in git history." -ForegroundColor Red
Write-Host "  Azure Portal > OpenAI resource > Keys and Endpoint > Regenerate Key 1" -ForegroundColor Red
Write-Host ""

$openAiKey = Read-Host "Paste new AZURE_OPENAI_API_KEY"
Set-GhSecret "AZURE_OPENAI_API_KEY" $openAiKey

Set-GhSecret "GOOGLE_GEMINI_API_KEY" "AIzaSyA4ruodrY3GSipv0fNovAtMHwiXDLlhiiQ"
Set-GhSecret "SAMBANOVA_API_KEY"     "e601b0a9-c260-4f03-9387-ce50c2bf33a1"

Write-Host ""
Write-Host "Backend secrets done." -ForegroundColor Cyan
Write-Host ""