# ============================================================================
# TEAMS CHANNEL EMAIL NOTIFICATION TEST
# ============================================================================
# This will send a notification to your Teams channel via email
#
# PREREQUISITES:
# 1. API server must be running (npm start)
# 2. ALLOW_TEST_TOKENS=true in .env
# 3. Azure AD app needs ChannelSettings.Read.All + Mail.Send permissions
# ============================================================================

Write-Host "`n===========================================================" -ForegroundColor Cyan
Write-Host "    TEAMS CHANNEL EMAIL NOTIFICATION TEST" -ForegroundColor Yellow
Write-Host "===========================================================`n" -ForegroundColor Cyan

# Teams channel IDs
$teamId = "ee76d158-d5c2-4050-b80f-50b6794195b8"
$channelId = "19:5y-02woFtkTYcP1W13iM3z3NbS8MzsWjoRoeGOT5jvI1@thread.tacv2"

# Test admin token (expires 2026-02-07)
$testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmxvY2FsIiwibmFtZSI6IlRlc3QgQWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRJZCI6InRlc3QtdGVuYW50IiwiYWNjZXNzU2NvcGUiOnsidGVhbUlkcyI6WyJ0ZWFtLWFsbCJdLCJkZXBhcnRtZW50SWRzIjpbImRlcHQtYWxsIl0sIm1hbmFnZWRDbGllbnRJZHMiOlsiY2xpZW50LWFsbCJdLCJtYW5hZ2VkVmVuZG9ySWRzIjpbInZlbmRvci1hbGwiXSwibWFuYWdlZFVzZXJJZHMiOlsidXNlci1hbGwiXSwicmVnaW9uSWRzIjpbInJlZ2lvbi1hbGwiXSwic3RhdGVzQ292ZXJlZCI6WyJBTEwiXSwiY2FuVmlld0FsbE9yZGVycyI6dHJ1ZSwiY2FuVmlld0FsbFZlbmRvcnMiOnRydWUsImNhbk92ZXJyaWRlUUMiOnRydWV9LCJwZXJtaXNzaW9ucyI6WyIqIl0sImlzcyI6ImFwcHJhaXNhbC1tYW5hZ2VtZW50LXRlc3QiLCJhdWQiOiJhcHByYWlzYWwtbWFuYWdlbWVudC1hcGkiLCJpYXQiOjE3Njc4NDUyMjAsImlzVGVzdFRva2VuIjp0cnVlLCJleHAiOjE3NzA0MzcyMjB9.HgTiQ0NBQqL-0YvYGcakYTxgx5WL6v0VNPnxMBo0CCI"

# Notification content
$subject = "🔔 Appraisal Management Platform - Test Notification"
$messageBody = @"
<h2>🎉 Teams Channel Email Integration Successful!</h2>
<p>Your appraisal management platform can now send notifications to Teams channels via email.</p>
<p><strong>Timestamp:</strong> $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</p>
<p><strong>Channel Email:</strong> L1Analytics@loneanalytics.com</p>
<p><strong>Integration Method:</strong> Email-based notifications (no bot required)</p>
<hr>
<h3>Capabilities:</h3>
<ul>
  <li>✅ Order status updates</li>
  <li>✅ QC alerts</li>
  <li>✅ Vendor notifications</li>
  <li>✅ System alerts</li>
  <li>✅ Rich HTML formatting</li>
</ul>
<hr>
<p><em>This notification was sent programmatically via Microsoft Graph Mail API to the channel's email address.</em></p>
"@

$requestBody = @{
    subject = $subject
    message = $messageBody
} | ConvertTo-Json

$endpoint = "http://localhost:3001/api/teams/channels/$teamId/$channelId/notify"

Write-Host "Sending notification to Teams channel..." -ForegroundColor Cyan
Write-Host "Team ID: $teamId" -ForegroundColor Gray
Write-Host "Channel ID: $channelId" -ForegroundColor Gray
Write-Host "Endpoint: $endpoint" -ForegroundColor Gray
Write-Host "Subject: $subject" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri $endpoint `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $testToken"
            "Content-Type" = "application/json"
        } `
        -Body $requestBody `
        -UseBasicParsing

    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    
    $result = $response.Content | ConvertFrom-Json
    if ($result.data.channelEmail) {
        Write-Host "Channel Email: $($result.data.channelEmail)" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "🎯 Check your Teams channel - notification should appear shortly!" -ForegroundColor Cyan
    Write-Host "📧 Email sent to: L1Analytics@loneanalytics.com" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Details: $($errorDetails.error)" -ForegroundColor Red
        if ($errorDetails.message) {
            Write-Host "Message: $($errorDetails.message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "1. Is the API server running? (npm start)" -ForegroundColor Gray
    Write-Host "2. Azure App needs Mail.Send permission" -ForegroundColor Gray
    Write-Host "3. Service principal needs a mailbox (Exchange Online license)" -ForegroundColor Gray
    Write-Host "4. Check server logs for detailed errors" -ForegroundColor Gray
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
