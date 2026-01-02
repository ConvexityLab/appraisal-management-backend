#!/usr/bin/env pwsh
# Fix TypeScript compilation errors

# Fix return types - change : Promise<void> to : Promise<any>
$files = @(
    "src\middleware\unified-auth.middleware.ts",
    "src\controllers\user-profile.controller.ts",
    "src\controllers\access-graph.controller.ts"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    $content = $content -replace ': Promise<void>', ': Promise<any>'
    Set-Content -Path $file -Value $content -NoNewline
}

# Fix access-control-helper ownerEmail
$file = "src\services\access-control-helper.service.ts"
$content = Get-Content $file -Raw
$content = $content -replace 'ownerEmail: options\.ownerEmail,', 'ownerEmail: options.ownerEmail || "",'
Set-Content -Path $file -Value $content -NoNewline

# Fix user-profile.service return type assertion
$file = "src\services\user-profile.service.ts"
$content = Get-Content $file -Raw
$content = $content -replace 'results\.length > 0 \? results\[0\] : null as UserProfile \| null', '(results.length > 0 ? results[0] : null) as UserProfile | null'
Set-Content -Path $file -Value $content -NoNewline

Write-Host "Fixes applied!"
