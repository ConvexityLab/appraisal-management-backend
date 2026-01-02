# Test Orders with Authorization Filtering
# This script creates test orders and then queries them with each user to verify filtering

param(
    [string]$ApiBase = "http://localhost:3000",
    [switch]$CreateOrders = $true,
    [switch]$TestQueries = $true,
    [switch]$Verbose = $false
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Authorization Testing - Test Orders" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check environment variables
$requiredVars = @(
    "TEST_JWT_ADMIN",
    "TEST_JWT_MANAGER",
    "TEST_JWT_QC_ANALYST",
    "TEST_JWT_APPRAISER"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    if (-not (Get-ChildItem env: | Where-Object Name -eq $var)) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "❌ Missing environment variables:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "   - $var" -ForegroundColor Red
    }
    Write-Host "`nPlease load your .env file first." -ForegroundColor Yellow
    exit 1
}

# Create test orders
if ($CreateOrders) {
    Write-Host "Step 1: Creating Test Orders..." -ForegroundColor Yellow
    Write-Host "----------------------------------------`n" -ForegroundColor Gray
    
    npm run create-test-orders
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n❌ Failed to create test orders" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "`n✓ Test orders created successfully`n" -ForegroundColor Green
    Start-Sleep -Seconds 2
}

# Test queries with each user
if ($TestQueries) {
    Write-Host "`nStep 2: Testing Queries with Each User..." -ForegroundColor Yellow
    Write-Host "----------------------------------------`n" -ForegroundColor Gray
    
    $users = @(
        @{
            Name = "Admin"
            Token = $env:TEST_JWT_ADMIN
            Color = "Magenta"
        },
        @{
            Name = "Manager"
            Token = $env:TEST_JWT_MANAGER
            Color = "Blue"
        },
        @{
            Name = "QC Analyst"
            Token = $env:TEST_JWT_QC_ANALYST
            Color = "Cyan"
        },
        @{
            Name = "Appraiser"
            Token = $env:TEST_JWT_APPRAISER
            Color = "Green"
        }
    )
    
    foreach ($user in $users) {
        Write-Host "`n$($user.Name) - GET /api/orders" -ForegroundColor $user.Color
        Write-Host "----------------------------------------" -ForegroundColor Gray
        
        try {
            $response = Invoke-RestMethod -Uri "$ApiBase/api/orders" `
                -Method GET `
                -Headers @{
                    "Authorization" = "Bearer $($user.Token)"
                } `
                -ErrorAction Stop
            
            if ($response.data) {
                $orders = $response.data
            } elseif ($response -is [array]) {
                $orders = $response
            } else {
                $orders = @($response)
            }
            
            Write-Host "  Orders returned: $($orders.Count)" -ForegroundColor White
            
            if ($Verbose -and $orders.Count -gt 0) {
                Write-Host "`n  Order Details:" -ForegroundColor Gray
                foreach ($order in $orders) {
                    Write-Host "    - $($order.orderNumber)" -ForegroundColor Gray
                    Write-Host "      Owner: $($order.accessControl.ownerId)" -ForegroundColor Gray
                    if ($order.accessControl.teamId) {
                        Write-Host "      Team: $($order.accessControl.teamId)" -ForegroundColor Gray
                    }
                    if ($order.accessControl.clientId) {
                        Write-Host "      Client: $($order.accessControl.clientId)" -ForegroundColor Gray
                    }
                    if ($order.accessControl.assignedUserIds -and $order.accessControl.assignedUserIds.Count -gt 0) {
                        Write-Host "      Assigned: $($order.accessControl.assignedUserIds -join ', ')" -ForegroundColor Gray
                    }
                }
            } else {
                # Summary without details
                foreach ($order in $orders) {
                    Write-Host "    ✓ $($order.orderNumber) (Owner: $($order.accessControl.ownerId))" -ForegroundColor Gray
                }
            }
            
        } catch {
            Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
            if ($_.Exception.Response) {
                $statusCode = $_.Exception.Response.StatusCode.value__
                Write-Host "  Status Code: $statusCode" -ForegroundColor Red
            }
        }
    }
}

# Test specific order access
Write-Host "`n`nStep 3: Testing Specific Order Access..." -ForegroundColor Yellow
Write-Host "----------------------------------------`n" -ForegroundColor Gray

Write-Host "Testing GET /api/orders with different users:" -ForegroundColor White
Write-Host "  1. Check audit logs for query filters" -ForegroundColor Gray
Write-Host "  2. Admin should see: team-1 orders + owned" -ForegroundColor Gray
Write-Host "  3. Manager should see: team-2 + client-2 orders + owned" -ForegroundColor Gray
Write-Host "  4. QC Analyst should see: own + assigned QC orders" -ForegroundColor Gray
Write-Host "  5. Appraiser should see: own + assigned orders" -ForegroundColor Gray

# Test authorization check endpoint
Write-Host "`n`nStep 4: Testing Authorization Decisions..." -ForegroundColor Yellow
Write-Host "----------------------------------------`n" -ForegroundColor Gray

$testCases = @(
    @{
        User = "Manager"
        Token = $env:TEST_JWT_MANAGER
        ResourceType = "order"
        Action = "create"
        Expected = $true
    },
    @{
        User = "Appraiser"
        Token = $env:TEST_JWT_APPRAISER
        ResourceType = "order"
        Action = "create"
        Expected = $false
    },
    @{
        User = "Admin"
        Token = $env:TEST_JWT_ADMIN
        ResourceType = "order"
        Action = "delete"
        Expected = $true
    }
)

foreach ($test in $testCases) {
    Write-Host "$($test.User) - $($test.Action.ToUpper()) $($test.ResourceType)" -ForegroundColor White
    
    $body = @{
        resourceType = $test.ResourceType
        action = $test.Action
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$ApiBase/api/authz-test/check" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $($test.Token)"
            } `
            -Body $body `
            -ContentType "application/json" `
            -ErrorAction Stop
        
        $allowed = $response.decision.allowed
        $expectedStr = if ($test.Expected) { "ALLOW" } else { "DENY" }
        $actualStr = if ($allowed) { "ALLOW" } else { "DENY" }
        
        if ($allowed -eq $test.Expected) {
            Write-Host "  ✓ $actualStr (expected: $expectedStr)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $actualStr (expected: $expectedStr)" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Review audit logs to see query filters:" -ForegroundColor White
Write-Host "   - Check server console output" -ForegroundColor Gray
Write-Host "   - Look for 'Authorization audit' messages" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Enable enforcement mode:" -ForegroundColor White
Write-Host "   - Set ENFORCE_AUTHORIZATION=true in .env" -ForegroundColor Gray
Write-Host "   - Restart the API server" -ForegroundColor Gray
Write-Host "   - Re-run this script to verify enforcement" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test POST /api/orders creation:" -ForegroundColor White
Write-Host "   - Wire authorization to createOrder endpoint" -ForegroundColor Gray
Write-Host "   - Test with each user role" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Verify 403 Forbidden responses:" -ForegroundColor White
Write-Host "   - Appraiser trying to create order (should fail)" -ForegroundColor Gray
Write-Host "   - Manager accessing orders outside team/client (should fail)" -ForegroundColor Gray
Write-Host ""
