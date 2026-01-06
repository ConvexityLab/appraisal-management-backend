# Setup GitHub Secrets from .env file
# Run this script to populate GitHub repository secrets from your local .env file
# Usage: .\scripts\setup-github-secrets.ps1

Write-Host "🔐 Setting up GitHub Secrets from .env file..." -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found. Please create one first." -ForegroundColor Red
    exit 1
}

# Check if gh CLI is installed
try {
    $ghVersion = gh --version
    Write-Host "✅ GitHub CLI found: $($ghVersion[0])" -ForegroundColor Green
} catch {
    Write-Host "❌ GitHub CLI not installed. Install from: https://cli.github.com/" -ForegroundColor Red
    exit 1
}

# Parse .env file
Write-Host "`n📖 Reading .env file..." -ForegroundColor Cyan
$envVars = @{}
Get-Content .env | ForEach-Object {
    $line = $_.Trim()
    # Skip comments and empty lines
    if ($line -and -not $line.StartsWith("#")) {
        # Handle lines with = in the value
        if ($line -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $envVars[$key] = $value
        }
    }
}

Write-Host "✅ Found $($envVars.Count) environment variables" -ForegroundColor Green

# Map of .env keys to GitHub Secret names
$secretMap = @{
    "GOOGLE_MAPS_API_KEY" = "GOOGLE_MAPS_API_KEY"
    "AZURE_OPENAI_API_KEY" = "AZURE_OPENAI_API_KEY"
    "AZURE_OPENAI_ENDPOINT" = "AZURE_OPENAI_ENDPOINT"
    "GOOGLE_GEMINI_API_KEY" = "GOOGLE_GEMINI_API_KEY"
    "CENSUS_API_KEY" = "CENSUS_API_KEY"
    "BRIDGE_SERVER_TOKEN" = "BRIDGE_SERVER_TOKEN"
    "NPS_API_KEY" = "NPS_API_KEY"
    "SAMBANOVA_API_KEY" = "SAMBANOVA_API_KEY"
    "AZURE_COMMUNICATION_API_KEY" = "AZURE_COMMUNICATION_API_KEY"
}

Write-Host "`n🔑 Setting GitHub Secrets..." -ForegroundColor Cyan
$successCount = 0
$skipCount = 0
$errorCount = 0

foreach ($envKey in $secretMap.Keys) {
    $secretName = $secretMap[$envKey]
    $secretValue = $envVars[$envKey]
    
    if ([string]::IsNullOrWhiteSpace($secretValue) -or 
        $secretValue -like "*your-*" -or 
        $secretValue -like "*REPLACE*" -or
        $secretValue -eq "=") {
        Write-Host "⏭️  Skipping $secretName (no value or placeholder)" -ForegroundColor Yellow
        $skipCount++
        continue
    }
    
    try {
        # Set secret using gh CLI
        $secretValue | gh secret set $secretName --repo ConvexityLab/appraisal-management-backend
        Write-Host "✅ Set $secretName" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host "❌ Failed to set $secretName : $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host "`n📊 Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Secrets set: $successCount" -ForegroundColor Green
Write-Host "  ⏭️  Skipped: $skipCount" -ForegroundColor Yellow
Write-Host "  ❌ Errors: $errorCount" -ForegroundColor Red

if ($successCount -gt 0) {
    Write-Host "`n🎉 GitHub Secrets configured successfully!" -ForegroundColor Green
    Write-Host "Next: Push changes and deploy will automatically use these secrets." -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️  No secrets were set. Check your .env file." -ForegroundColor Yellow
}
