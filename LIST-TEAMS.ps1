# ============================================================================
# LIST TEAMS AND CHANNELS
# ============================================================================
# Helper script to find your Team IDs and Channel IDs
# ============================================================================

Write-Host "`n===========================================================" -ForegroundColor Cyan
Write-Host "    TEAMS & CHANNELS LOOKUP" -ForegroundColor Yellow
Write-Host "===========================================================`n" -ForegroundColor Cyan

$testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LWFkbWluIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmxvY2FsIiwibmFtZSI6IlRlc3QgQWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRJZCI6InRlc3QtdGVuYW50IiwiYWNjZXNzU2NvcGUiOnsidGVhbUlkcyI6WyJ0ZWFtLWFsbCJdLCJkZXBhcnRtZW50SWRzIjpbImRlcHQtYWxsIl0sIm1hbmFnZWRDbGllbnRJZHMiOlsiY2xpZW50LWFsbCJdLCJtYW5hZ2VkVmVuZG9ySWRzIjpbInZlbmRvci1hbGwiXSwibWFuYWdlZFVzZXJJZHMiOlsidXNlci1hbGwiXSwicmVnaW9uSWRzIjpbInJlZ2lvbi1hbGwiXSwic3RhdGVzQ292ZXJlZCI6WyJBTEwiXSwiY2FuVmlld0FsbE9yZGVycyI6dHJ1ZSwiY2FuVmlld0FsbFZlbmRvcnMiOnRydWUsImNhbk92ZXJyaWRlUUMiOnRydWV9LCJwZXJtaXNzaW9ucyI6WyIqIl0sImlzcyI6ImFwcHJhaXNhbC1tYW5hZ2VtZW50LXRlc3QiLCJhdWQiOiJhcHByYWlzYWwtbWFuYWdlbWVudC1hcGkiLCJpYXQiOjE3Njc4NDUyMjAsImlzVGVzdFRva2VuIjp0cnVlLCJleHAiOjE3NzA0MzcyMjB9.HgTiQ0NBQqL-0YvYGcakYTxgx5WL6v0VNPnxMBo0CCI"

$apiEndpoint = "http://localhost:3001/api/teams/list-teams"

Write-Host "Fetching your Teams..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $apiEndpoint `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $testToken"
        }

    if ($response.success -and $response.data.teams) {
        $teams = $response.data.teams
        Write-Host "✅ Found $($teams.Count) team(s)`n" -ForegroundColor Green

        foreach ($team in $teams) {
            Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
            Write-Host "Team: " -NoNewline -ForegroundColor Cyan
            Write-Host $team.displayName -ForegroundColor White
            Write-Host "Team ID: " -NoNewline -ForegroundColor Yellow
            Write-Host $team.id -ForegroundColor Gray
            
            if ($team.channels -and $team.channels.Count -gt 0) {
                Write-Host "`nChannels:" -ForegroundColor Cyan
                foreach ($channel in $team.channels) {
                    Write-Host "  • " -NoNewline -ForegroundColor DarkGray
                    Write-Host $channel.displayName -NoNewline -ForegroundColor White
                    Write-Host " (" -NoNewline -ForegroundColor DarkGray
                    Write-Host $channel.membershipType -NoNewline -ForegroundColor Gray
                    Write-Host ")" -ForegroundColor DarkGray
                    Write-Host "    ID: " -NoNewline -ForegroundColor Yellow
                    Write-Host $channel.id -ForegroundColor Gray
                }
            }
            Write-Host ""
        }

        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        Write-Host "`nℹ️  Copy a Team ID and Channel ID to use in TEST-TEAMS-CHANNEL.ps1" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  No teams found or unexpected response format" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "Details: $($errorDetails.error)" -ForegroundColor Yellow
            if ($errorDetails.message) {
                Write-Host "Message: $($errorDetails.message)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "Raw error: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Cyan
    Write-Host "1. Make sure API server is running (npm start)" -ForegroundColor Gray
    Write-Host "2. Check Azure App permissions: Team.ReadBasic.All" -ForegroundColor Gray
    Write-Host "3. This endpoint needs to be implemented in the API" -ForegroundColor Gray
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
