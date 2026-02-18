#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Test Communication System End-to-End (LIVE)
.DESCRIPTION
    Run after containers are deployed to verify communication system works
#>

Write-Host "`n" -NoNewline
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  COMMUNICATION SYSTEM LIVE TEST" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:3011"
$orderId1 = "ord_2024_test_001"
$orderId2 = "ord_2024_test_002"
$vendorId = "vendor-elite-appraisals"
$appraiserId = "appraiser-fl-res-11111"

# Get JWT token (assumes you have a valid token in environment or need to login)
Write-Host "[1/7] Getting authentication token..." -ForegroundColor Yellow
$token = $env:BEARER_TOKEN
if (-not $token) {
    Write-Host "   WARNING: No BEARER_TOKEN found. Using placeholder." -ForegroundColor Red
    Write-Host "   Set with: `$env:BEARER_TOKEN = 'your-jwt-token'" -ForegroundColor Yellow
    $token = "placeholder-will-fail"
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Test 1: Check if backend is running
Write-Host "`n[2/7] Checking backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -ErrorAction Stop
    Write-Host "   ✓ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend not running. Start with: npm run dev" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Send test email
Write-Host "`n[3/7] Sending test email..." -ForegroundColor Yellow
$emailPayload = @{
    to = "test@example.com"
    subject = "Test Email from Communication System"
    body = "This is a test email to verify the communication system is working."
    primaryEntity = @{
        type = "order"
        id = $orderId1
        name = "ORD-2024-001 - 123 Main Street, Miami, FL 33101"
    }
    relatedEntities = @(
        @{
            type = "vendor"
            id = $vendorId
            name = "Elite Appraisals"
        }
    )
    category = "order_discussion"
    priority = "normal"
} | ConvertTo-Json -Depth 10

try {
    $emailResult = Invoke-RestMethod -Uri "$baseUrl/api/communications/email" -Method POST -Headers $headers -Body $emailPayload -ErrorAction Stop
    Write-Host "   ✓ Email sent successfully" -ForegroundColor Green
    Write-Host "   Communication ID: $($emailResult.data.id)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Failed to send email" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Test 3: Send test SMS
Write-Host "`n[4/7] Sending test SMS..." -ForegroundColor Yellow
$smsPayload = @{
    to = "+15551234567"
    body = "Test SMS: Order ORD-2024-001 status update"
    primaryEntity = @{
        type = "order"
        id = $orderId1
        name = "ORD-2024-001"
    }
    category = "deadline_reminder"
    priority = "high"
} | ConvertTo-Json -Depth 10

try {
    $smsResult = Invoke-RestMethod -Uri "$baseUrl/api/communications/sms" -Method POST -Headers $headers -Body $smsPayload -ErrorAction Stop
    Write-Host "   ✓ SMS sent successfully" -ForegroundColor Green
    Write-Host "   Communication ID: $($smsResult.data.id)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Failed to send SMS" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Query communications by order
Write-Host "`n[5/7] Querying communications for Order $orderId1..." -ForegroundColor Yellow
try {
    $orderComms = Invoke-RestMethod -Uri "$baseUrl/api/communications/order/${orderId1}?includeRelated=true" -Method GET -Headers $headers -ErrorAction Stop
    $count = $orderComms.data.Count
    Write-Host "   ✓ Found $count communication(s)" -ForegroundColor Green
    if ($count -gt 0) {
        Write-Host "   Latest:" -ForegroundColor Gray
        $latest = $orderComms.data[0]
        Write-Host "     - $($latest.channel.ToUpper()): $($latest.subject ?? $latest.body.Substring(0, [Math]::Min(50, $latest.body.Length)))" -ForegroundColor Gray
        Write-Host "     - Status: $($latest.status)" -ForegroundColor Gray
        Write-Host "     - Created: $($latest.createdAt)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Failed to query order communications" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Query communications by vendor
Write-Host "`n[6/7] Querying communications for Vendor $vendorId..." -ForegroundColor Yellow
try {
    $vendorComms = Invoke-RestMethod -Uri "$baseUrl/api/communications/vendor/${vendorId}" -Method GET -Headers $headers -ErrorAction Stop
    $count = $vendorComms.data.Count
    Write-Host "   ✓ Found $count communication(s)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed to query vendor communications" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Query communications by appraiser
Write-Host "`n[7/7] Querying communications for Appraiser $appraiserId..." -ForegroundColor Yellow
try {
    $appraiserComms = Invoke-RestMethod -Uri "$baseUrl/api/communications/appraiser/${appraiserId}" -Method GET -Headers $headers -ErrorAction Stop
    $count = $appraiserComms.data.Count
    Write-Host "   ✓ Found $count communication(s)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed to query appraiser communications" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  TEST COMPLETE" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run seed script: node scripts/seed-communications.js" -ForegroundColor White
Write-Host "  2. Open frontend: http://localhost:3010" -ForegroundColor White
Write-Host "  3. Navigate to an Order detail page" -ForegroundColor White
Write-Host "  4. Click Communications tray icon (badge should show count)" -ForegroundColor White
Write-Host "  5. View History tab to see all communications" -ForegroundColor White
Write-Host "  6. Click Send tab to compose new message" -ForegroundColor White
Write-Host ""
