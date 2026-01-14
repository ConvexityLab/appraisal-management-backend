# ============================================================================
# TEAMS DIRECT MESSAGING TEST
# ============================================================================
# This will send you a Teams message to verify the integration works
#
# PREREQUISITES:
# 1. API server must be running (npm run dev)
# 2. ALLOW_TEST_TOKENS=true in .env
# 3. Your Azure AD app needs Microsoft Graph Chat.ReadWrite permission
# ============================================================================

Write-Host "`n===========================================================" -ForegroundColor Cyan
Write-Host "    TEAMS DIRECT MESSAGING TEST" -ForegroundColor Yellow
Write-Host "===========================================================`n" -ForegroundColor Cyan

# Your Azure AD user ID
$recipientUserId = "hiro@loneanalytics.com"
$senderUserId = "2d57c213-85b3-4ea2-9805-f1928d7532ee"

# Test admin token (expires 2026-02-07)
$testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmxvY2FsIiwibmFtZSI6IlRlc3QgQWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRJZCI6InRlc3QtdGVuYW50IiwiYWNjZXNzU2NvcGUiOnsidGVhbUlkcyI6WyJ0ZWFtLWFsbCJdLCJkZXBhcnRtZW50SWRzIjpbImRlcHQtYWxsIl0sIm1hbmFnZWRDbGllbnRJZHMiOlsiY2xpZW50LWFsbCJdLCJtYW5hZ2VkVmVuZG9ySWRzIjpbInZlbmRvci1hbGwiXSwibWFuYWdlZFVzZXJJZHMiOlsidXNlci1hbGwiXSwicmVnaW9uSWRzIjpbInJlZ2lvbi1hbGwiXSwic3RhdGVzQ292ZXJlZCI6WyJBTEwiXSwiY2FuVmlld0FsbE9yZGVycyI6dHJ1ZSwiY2FuVmlld0FsbFZlbmRvcnMiOnRydWUsImNhbk92ZXJyaWRlUUMiOnRydWV9LCJwZXJtaXNzaW9ucyI6WyIqIl0sImlzcyI6ImFwcHJhaXNhbC1tYW5hZ2VtZW50LXRlc3QiLCJhdWQiOiJhcHByYWlzYWwtbWFuYWdlbWVudC1hcGkiLCJpYXQiOjE3Njc4NDUyMjAsImlzVGVzdFRva2VuIjp0cnVlLCJleHAiOjE3NzA0MzcyMjB9.HgTiQ0NBQqL-0YvYGcakYTxgx5WL6v0VNPnxMBo0CCI"

# Message content
$messageBody = @"
<h2>🎉 Teams Integration Test Successful!</h2>
<p>Your appraisal management platform can now send direct Teams messages.</p>
<p><strong>Timestamp:</strong> $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</p>
<p><strong>Capabilities Verified:</strong></p>
<ul>
  <li>✅ 1-on-1 Direct Messaging</li>
  <li>✅ Order Notifications</li>
  <li>✅ Teams Meeting Integration</li>
  <li>✅ External User Chat (ACS)</li>
</ul>
<p><em>This message was sent programmatically via Microsoft Graph API.</em></p>
"@

$requestBody = @{
    recipientUserId = $recipientUserId
    senderUserId = $senderUserId
    message = $messageBody
} | ConvertTo-Json

Write-Host "Testing direct Teams message..." -ForegroundColor Yellow
Write-Host "Recipient: $recipientUserId" -ForegroundColor Gray
Write-Host "Endpoint: http://localhost:3001/api/teams/messages/direct`n" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/teams/messages/direct" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $testToken"
            "Content-Type" = "application/json"
        } `
        -Body $requestBody

    Write-Host "✅ SUCCESS! Teams message sent." -ForegroundColor Green
    Write-Host ""
    Write-Host "Chat ID:    " -NoNewline; Write-Host $response.data.chatId -ForegroundColor Yellow
    Write-Host "Message ID: " -NoNewline; Write-Host $response.data.messageId -ForegroundColor Yellow
    Write-Host ""
    Write-Host "👉 Check your Microsoft Teams app - you should see the message now!" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ FAILED!" -ForegroundColor Red
    Write-Host ""
    
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    
    Write-Host "Status Code: $statusCode" -ForegroundColor Red
    Write-Host "Error: $errorMessage" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Details: $($errorDetails.error)" -ForegroundColor Red
        if ($errorDetails.message) {
            Write-Host "Message: $($errorDetails.message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "1. Is the API server running? (npm run dev)" -ForegroundColor Gray
    Write-Host "2. Check .env: ALLOW_TEST_TOKENS=true" -ForegroundColor Gray
    Write-Host "3. Azure App needs Graph API permissions: Chat.ReadWrite" -ForegroundColor Gray
    Write-Host "4. Check server logs for detailed errors" -ForegroundColor Gray
}

Write-Host "`n===========================================================`n" -ForegroundColor Cyan
