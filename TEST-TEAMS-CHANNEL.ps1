# ============================================================================
# TEAMS CHANNEL MESSAGE TEST
# ============================================================================
# This will post a message to a Teams channel
#
# PREREQUISITES:
# 1. API server must be running (npm run dev)
# 2. ALLOW_TEST_TOKENS=true in .env
# 3. Azure AD app needs ChannelMessage.Send application permission
# 4. You need a Team ID and Channel ID
# ============================================================================

Write-Host "`n===========================================================" -ForegroundColor Cyan
Write-Host "    TEAMS CHANNEL MESSAGE TEST" -ForegroundColor Yellow
Write-Host "===========================================================`n" -ForegroundColor Cyan

# Team and Channel IDs - UPDATE THESE WITH YOUR VALUES
# To find these: Teams > Right-click team > Get link to team
# URL format: https://teams.microsoft.com/l/team/19%3a...%40thread.tacv2/conversations?groupId={TEAM_ID}&tenantId=...
# Or use Graph Explorer: GET /me/joinedTeams to list your teams
# Then GET /teams/{team-id}/channels to list channels

$teamId = "ee76d158-d5c2-4050-b80f-50b6794195b8"
$channelId = "19:5y-02woFtkTYcP1W13iM3z3NbS8MzsWjoRoeGOT5jvI1@thread.tacv2"

# Test admin token (expires 2026-02-07)
$testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmxvY2FsIiwibmFtZSI6IlRlc3QgQWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRJZCI6InRlc3QtdGVuYW50IiwiYWNjZXNzU2NvcGUiOnsidGVhbUlkcyI6WyJ0ZWFtLWFsbCJdLCJkZXBhcnRtZW50SWRzIjpbImRlcHQtYWxsIl0sIm1hbmFnZWRDbGllbnRJZHMiOlsiY2xpZW50LWFsbCJdLCJtYW5hZ2VkVmVuZG9ySWRzIjpbInZlbmRvci1hbGwiXSwibWFuYWdlZFVzZXJJZHMiOlsidXNlci1hbGwiXSwicmVnaW9uSWRzIjpbInJlZ2lvbi1hbGwiXSwic3RhdGVzQ292ZXJlZCI6WyJBTEwiXSwiY2FuVmlld0FsbE9yZGVycyI6dHJ1ZSwiY2FuVmlld0FsbFZlbmRvcnMiOnRydWUsImNhbk92ZXJyaWRlUUMiOnRydWV9LCJwZXJtaXNzaW9ucyI6WyIqIl0sImlzcyI6ImFwcHJhaXNhbC1tYW5hZ2VtZW50LXRlc3QiLCJhdWQiOiJhcHByYWlzYWwtbWFuYWdlbWVudC1hcGkiLCJpYXQiOjE3Njc4NDUyMjAsImlzVGVzdFRva2VuIjp0cnVlLCJleHAiOjE3NzA0MzcyMjB9.HgTiQ0NBQqL-0YvYGcakYTxgx5WL6v0VNPnxMBo0CCI"

# Message content
$messageBody = @"
<h2>🎉 Teams Channel Integration Test</h2>
<p>Your appraisal management platform can now send messages to Teams channels.</p>
<p><strong>Timestamp:</strong> $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</p>
<p><strong>Order Notification Example:</strong></p>
<ul>
  <li>✅ Order #12345 assigned to vendor</li>
  <li>✅ Appraisal ready for QC review</li>
  <li>✅ New order received from Bridge MLS</li>
  <li>✅ ROV request submitted by borrower</li>
</ul>
<p><em>This message was sent programmatically via Microsoft Graph API.</em></p>
"@

$requestBody = @{
    teamId = $teamId
    channelId = $channelId
    message = $messageBody
    subject = "Appraisal Management - Test Notification"
} | ConvertTo-Json

$apiEndpoint = "http://localhost:3001/api/teams/messages/channel"

Write-Host "Testing channel message..." -ForegroundColor Cyan
Write-Host "Team ID: $teamId" -ForegroundColor Gray
Write-Host "Channel ID: $channelId" -ForegroundColor Gray
Write-Host "Endpoint: $apiEndpoint" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $apiEndpoint `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $testToken"
            "Content-Type" = "application/json"
        } `
        -Body $requestBody

    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Message ID: $($response.data.messageId)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Check your Teams channel for the message!" -ForegroundColor Yellow
}
catch {
    Write-Host "❌ FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Details: $($errorDetails.error)" -ForegroundColor Yellow
        if ($errorDetails.message) {
            Write-Host "Message: $($errorDetails.message)" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Cyan
    Write-Host "1. Update teamId and channelId in this script" -ForegroundColor Gray
    Write-Host "2. To find IDs, use Graph Explorer: GET /me/joinedTeams" -ForegroundColor Gray
    Write-Host "3. Then: GET /teams/{team-id}/channels" -ForegroundColor Gray
    Write-Host "4. Azure App needs ChannelMessage.Send permission" -ForegroundColor Gray
    Write-Host "5. Check server logs for detailed errors" -ForegroundColor Gray
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
