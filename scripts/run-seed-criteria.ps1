$ErrorActionPreference = 'Stop'

function Import-DotEnv {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    Get-Content -Path $Path | ForEach-Object {
        if ($_ -match '^\s*#') { return }
        if ($_ -match '^\s*$') { return }
        if ($_ -match '^\s*([A-Z0-9_]+)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2].Trim()
            if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            if ($value.StartsWith("'") -and $value.EndsWith("'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            if (-not (Test-Path -Path "Env:$name")) {
                Set-Item -Path "Env:$name" -Value $value
            }
        }
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Import-DotEnv -Path (Join-Path $repoRoot '.env')

if (-not $env:AZURE_COSMOS_ENDPOINT) { throw 'AZURE_COSMOS_ENDPOINT is required' }
if (-not $env:AZURE_COSMOS_DATABASE_NAME) { throw 'AZURE_COSMOS_DATABASE_NAME is required' }

if (-not $env:SEED_TENANT_ID) {
    $env:SEED_TENANT_ID = 'test-tenant'
}

Push-Location $repoRoot
try {
    node .\scripts\seed-bulk-ingestion-criteria-config.mjs
}
finally {
    Pop-Location
}