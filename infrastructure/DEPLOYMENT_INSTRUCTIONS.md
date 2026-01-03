# Azure Communication Services - Deployment Instructions

## Prerequisites

1. **Azure CLI** installed and logged in:
   ```bash
   az login
   az account set --subscription "Your-Subscription-Name"
   ```

2. **Existing Resources**:
   - Resource Group created
   - Cosmos DB account deployed (from previous phases)

## Deployment Steps

### 1. Deploy Communication Services (Dev Environment)

```bash
az deployment group create \
  --resource-group rg-appraisal-dev \
  --template-file infrastructure/deploy-communication-services.bicep \
  --parameters infrastructure/parameters.communication.dev.json
```

### 2. Deploy Communication Services (Prod Environment)

```bash
az deployment group create \
  --resource-group rg-appraisal-prod \
  --template-file infrastructure/deploy-communication-services.bicep \
  --parameters infrastructure/parameters.communication.prod.json
```

### 3. Get Deployment Outputs

```bash
# Get environment variables needed for .env file
az deployment group show \
  --resource-group rg-appraisal-dev \
  --name deploy-communication-services \
  --query properties.outputs.envVariables.value \
  --output json

# Get email verification records
az deployment group show \
  --resource-group rg-appraisal-dev \
  --name deploy-communication-services \
  --query properties.outputs.emailVerificationRecords.value \
  --output json
```

### 4. Configure DNS Records

After deployment, you'll need to configure DNS records for email domain verification:

1. Get the verification records from deployment output
2. Add TXT and DKIM records to your DNS provider:
   - **TXT Record**: For domain verification
   - **DKIM Record**: For email authentication
   - **DKIM2 Record**: For email authentication

Example DNS records:
```
Type: TXT
Host: @
Value: ms-domain-verification=xxxxxxxx

Type: TXT
Host: selector1._domainkey
Value: selector1-xxxxx._domainkey.azurecomm.net

Type: TXT
Host: selector2._domainkey
Value: selector2-xxxxx._domainkey.azurecomm.net
```

### 5. Provision SMS Phone Number

SMS phone numbers must be provisioned via Azure Portal or CLI:

```bash
# List available phone numbers
az communication phonenumber list \
  --connection-string "YOUR_ACS_CONNECTION_STRING"

# Purchase a phone number (example)
az communication phonenumber purchase \
  --connection-string "YOUR_ACS_CONNECTION_STRING" \
  --phone-number "+18005551234" \
  --country-code "US" \
  --phone-number-type "tollFree"
```

Update your `.env` file:
```env
AZURE_COMMUNICATION_SMS_NUMBER=+18005551234
```

### 6. Configure Push Notification Credentials

For iOS (APNS):
```bash
az notification-hub credential apns update \
  --resource-group rg-appraisal-dev \
  --namespace-name nhns-appraisal-dev \
  --notification-hub-name nh-appraisal-dev \
  --apns-certificate @path/to/certificate.p12 \
  --certificate-key "YOUR_CERTIFICATE_PASSWORD"
```

For Android (FCM):
```bash
az notification-hub credential gcm update \
  --resource-group rg-appraisal-dev \
  --namespace-name nhns-appraisal-dev \
  --notification-hub-name nh-appraisal-dev \
  --google-api-key "YOUR_FCM_SERVER_KEY"
```

### 7. Configure Managed Identity Access

Grant the application's Managed Identity access to Communication Services:

```bash
# Get the principal ID of your App Service or Function App
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group rg-appraisal-dev \
  --name app-appraisal-dev \
  --query principalId \
  --output tsv)

# Get the Communication Services resource ID
ACS_RESOURCE_ID=$(az communication list \
  --resource-group rg-appraisal-dev \
  --query "[0].id" \
  --output tsv)

# Grant Contributor role
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Contributor" \
  --scope $ACS_RESOURCE_ID
```

### 8. Update Application Configuration

Add these to your `.env` or App Service Configuration:

```env
# From deployment outputs
AZURE_COMMUNICATION_ENDPOINT=https://acs-appraisal-dev.communication.azure.com
AZURE_COMMUNICATION_EMAIL_DOMAIN=noreply-dev.appraisal.platform
AZURE_NOTIFICATION_HUB_NAME=nh-appraisal-dev
AZURE_NOTIFICATION_HUB_NAMESPACE=nhns-appraisal-dev

# Manually configured
AZURE_COMMUNICATION_SMS_NUMBER=+18005551234

# Notification Hub connection string (from output)
AZURE_NOTIFICATION_HUB_CONNECTION_STRING=Endpoint=sb://...
```

## Verification

### Test Email Service

```typescript
import { EmailNotificationService } from './services/email-notification.service';

const emailService = new EmailNotificationService();
await emailService.sendEmail({
  to: ['test@example.com'],
  subject: 'Test Email',
  htmlBody: '<p>This is a test</p>'
}, 'tenant-id');
```

### Test SMS Service

```typescript
import { SmsNotificationService } from './services/sms-notification.service';

const smsService = new SmsNotificationService();
await smsService.sendSms('+15555551234', 'Test SMS', 'tenant-id');
```

### Health Check

```bash
curl https://your-api.azurewebsites.net/api/health
```

Should return:
```json
{
  "status": "healthy",
  "services": {
    "email": true,
    "sms": true,
    "chat": true
  }
}
```

## Cost Management

### Development Environment
- Communication Services: Pay-per-use (minimal cost for dev/testing)
- Notification Hub: Free tier (10M pushes/month)
- Cosmos DB: 400 RU/s per container = ~$24/month

### Production Environment
- Communication Services: ~$16/month estimated
- Notification Hub: Standard tier = $10/month
- Cosmos DB: Scale as needed

### Cost Optimization Tips
1. Use Free tier Notification Hub for dev/staging
2. Set TTL on notificationHistory (90 days) and chatMessages (180 days)
3. Monitor usage via Azure Cost Management
4. Enable auto-scale on Cosmos DB containers

## Troubleshooting

### Email not sending
- Verify DNS records are configured correctly
- Check domain verification status in Azure Portal
- Ensure Managed Identity has proper permissions

### SMS not working
- Verify phone number is provisioned and active
- Check SMS capability is enabled for your number
- Verify destination number format (+1XXXXXXXXXX)

### Push notifications failing
- Verify APNS/FCM credentials are configured
- Check device tokens are valid
- Ensure notification payload is correct format

## Rollback

To remove all communication services resources:

```bash
# Delete Communication Services
az communication delete \
  --resource-group rg-appraisal-dev \
  --name acs-appraisal-dev

# Delete Notification Hub
az notification-hub delete \
  --resource-group rg-appraisal-dev \
  --namespace-name nhns-appraisal-dev \
  --name nh-appraisal-dev

# Delete Cosmos DB containers
az cosmosdb sql container delete \
  --account-name cosmos-appraisal-dev \
  --database-name appraisal-management \
  --name emailTemplates \
  --resource-group rg-appraisal-dev \
  --yes
```

## Support

For issues or questions:
- Azure Communication Services Docs: https://learn.microsoft.com/azure/communication-services/
- Azure Notification Hubs Docs: https://learn.microsoft.com/azure/notification-hubs/
- Internal Wiki: [Add your wiki link here]
