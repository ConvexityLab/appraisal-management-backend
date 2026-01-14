# ============================================================================
# Teams Channel Email Notification - Integration Guide
# ============================================================================

## Overview

This document explains how to send notifications to Microsoft Teams channels
using email-based delivery - the recommended approach for system notifications
that don't require a Teams Bot.

## Architecture

```
Your API → Email Service → Teams Channel Email → Teams Channel
           (SMTP/SendGrid)   (L1Analytics@loneanalytics.com)
```

**Benefits:**
- ✅ No Teams Bot required
- ✅ No additional Microsoft Graph permissions
- ✅ Standard enterprise email pattern
- ✅ Works with existing SMTP infrastructure
- ✅ Reliable delivery with retry mechanisms

## API Endpoints

### 1. Get Channel Email Address

```http
GET /api/teams/channels/:teamId/:channelId/email
Authorization: Bearer {your-jwt-token}
```

**Response:**
```json
{
  "success": true,
  "channelEmail": "L1Analytics@loneanalytics.com"
}
```

**Required Permission:** `ChannelSettings.Read.All` (application permission)

### 2. Send Channel Notification

```http
POST /api/teams/channels/:teamId/:channelId/notify
Authorization: Bearer {your-jwt-token}
Content-Type: application/json

{
  "subject": "Order Update",
  "message": "<h2>Order #12345 Completed</h2><p>Your appraisal is ready for review.</p>"
}
```

**Response:**
```json
{
  "success": true,
  "channelEmail": "L1Analytics@loneanalytics.com",
  "messageId": "<unique-message-id>"
}
```

## Email Service Configuration

The email service supports multiple providers. Configure ONE of the following:

### Option 1: SMTP Configuration (Office 365, Gmail, etc.)

```bash
# .env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@loneanalytics.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=notifications@loneanalytics.com
```

**Office 365 Setup:**
1. Create app password in Azure AD
2. Use SMTP_HOST=smtp.office365.com
3. Use SMTP_PORT=587
4. Use authenticated account

### Option 2: SendGrid (Recommended for Production)

```bash
# .env
SENDGRID_API_KEY=SG.your-sendgrid-api-key-here
EMAIL_FROM=notifications@loneanalytics.com
```

**SendGrid Setup:**
1. Sign up at https://sendgrid.com
2. Create API key with "Mail Send" permission
3. Verify sender domain (loneanalytics.com)
4. No SMTP credentials needed

### Option 3: Gmail SMTP Relay

```bash
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-gmail@gmail.com
```

**Gmail Setup:**
1. Enable 2-factor authentication
2. Generate app password
3. Use app password (not account password)

## Testing

### Test Script: TEST-TEAMS-EMAIL-NOTIFY.ps1

```powershell
# Configuration
$teamId = "ee76d158-d5c2-4050-b80f-50b6794195b8"
$channelId = "19:5y-02woFtkTYcP1W13iM3z3NbS8MzsWjoRoeGOT5jvI1@thread.tacv2"
$testToken = "Bearer eyJhbGc..."  # Your test token

# Send notification
$response = Invoke-WebRequest `
  -Uri "http://localhost:3001/api/teams/channels/$teamId/$channelId/notify" `
  -Method POST `
  -Headers @{
    "Authorization" = $testToken
    "Content-Type" = "application/json"
  } `
  -Body (@{
    subject = "Test Notification"
    message = "<h2>Test Message</h2><p>This is a test notification.</p>"
  } | ConvertTo-Json) `
  -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Expected Response (No Email Service Configured)

```json
{
  "success": false,
  "channelEmail": "L1Analytics@loneanalytics.com",
  "error": "Email service not configured. Set SMTP_HOST or SENDGRID_API_KEY..."
}
```

### Expected Response (Email Service Configured)

```json
{
  "success": true,
  "channelEmail": "L1Analytics@loneanalytics.com",
  "messageId": "<20240108123456.12345@smtp.office365.com>"
}
```

## Production Setup Checklist

- [ ] Choose email provider (SMTP, SendGrid, etc.)
- [ ] Add credentials to .env file
- [ ] Verify email service connection: `await emailService.verifyConnection()`
- [ ] Test notification delivery
- [ ] Configure sender domain SPF/DKIM records
- [ ] Add email templates for different notification types
- [ ] Set up delivery monitoring/alerting

## Troubleshooting

### Issue: "Email service not configured"

**Solution:** Set either SMTP_HOST or SENDGRID_API_KEY in .env

### Issue: SMTP authentication failed

**Causes:**
- Wrong username/password
- App password not generated (Office 365/Gmail)
- 2FA not enabled (Gmail)

**Solution:** 
- Verify credentials
- Generate app password
- Enable 2FA

### Issue: Email not appearing in Teams channel

**Causes:**
- Channel email feature not enabled
- Email blocked by spam filter
- Sender domain not verified

**Solution:**
- Check channel settings in Teams
- Whitelist sender in Microsoft 365 admin
- Add SPF/DKIM records for sender domain

### Issue: Rate limiting

**Causes:**
- Too many emails sent too quickly
- Provider rate limits exceeded

**Solution:**
- Implement exponential backoff
- Use SendGrid for higher limits
- Add queueing system

## Integration Examples

### TypeScript/Node.js

```typescript
import { TeamsService } from './services/teams.service';

const teamsService = new TeamsService();

async function notifyChannel(orderId: string) {
  const teamId = 'ee76d158-d5c2-4050-b80f-50b6794195b8';
  const channelId = '19:5y-02woFtkTYcP1W13iM3z3NbS8MzsWjoRoeGOT5jvI1@thread.tacv2';

  const result = await teamsService.sendChannelEmailNotification(
    teamId,
    channelId,
    `Order #${orderId} Update`,
    `<h2>Order Completed</h2><p>Order #${orderId} is ready for review.</p>`
  );

  if (!result.success) {
    console.error('Failed to send notification:', result.error);
  }
}
```

### Frontend (React/JavaScript)

```javascript
async function sendTeamsNotification(teamId, channelId, subject, message) {
  const response = await fetch(
    `/api/teams/channels/${teamId}/${channelId}/notify`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ subject, message })
    }
  );

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to send notification');
  }

  return data;
}
```

## Alternative: Teams Bot Implementation

For real-time direct/channel messaging (not email-based), you need a Teams Bot:

**Requirements:**
- Azure Bot Service registration
- Teams app manifest
- Bot Framework SDK
- ChannelMessage.Send.All permission

**Comparison:**

| Feature | Email-based | Bot-based |
|---------|-------------|-----------|
| Setup complexity | Low | High |
| Real-time | No (email delay) | Yes |
| Rich interactions | Limited | Full (cards, buttons) |
| Direct messages | No | Yes |
| Channel posts | Yes | Yes |
| Maintenance | Low | Medium |

## Related Documentation

- [Channel Email Setup](https://docs.microsoft.com/en-us/microsoftteams/email-integration)
- [SendGrid Integration](https://docs.sendgrid.com/)
- [Teams Bot Framework](https://docs.microsoft.com/en-us/microsoftteams/platform/bots/what-are-bots)

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify email service configuration
3. Test email service connection independently
4. Contact Microsoft 365 admin for Teams channel settings
