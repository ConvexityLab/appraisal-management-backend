# Azure Entra ID Authentication Configuration

## Environment Variables

Add these environment variables to your `.env` file:

```bash
# Azure Entra ID (Azure AD) Configuration
AZURE_TENANT_ID=your-tenant-id-here          # Your Azure AD tenant ID (GUID)
AZURE_CLIENT_ID=your-client-id-here          # Your app registration client ID (GUID)
AZURE_AUDIENCE=api://your-api-scope          # Optional: Custom audience claim
AZURE_ISSUER=https://login.microsoftonline.com/{tenant-id}/v2.0  # Optional: Custom issuer

# Azure AD Group Object IDs (for role mapping)
AZURE_ADMIN_GROUP_ID=admin-group-object-id
AZURE_MANAGER_GROUP_ID=manager-group-object-id
AZURE_QC_ANALYST_GROUP_ID=qc-analyst-group-object-id
AZURE_APPRAISER_GROUP_ID=appraiser-group-object-id

# Development bypass (set to 'true' to skip authentication in dev)
BYPASS_AUTH=false
NODE_ENV=production
```

---

## Setup Steps

### 1. Register Application in Azure Portal

1. Go to **Azure Portal** → **Azure Active Directory** → **App registrations**
2. Click **New registration**
   - **Name**: `Appraisal Management API`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Leave blank (not needed for API)
3. Click **Register**
4. Copy the **Application (client) ID** → This is your `AZURE_CLIENT_ID`
5. Copy the **Directory (tenant) ID** → This is your `AZURE_TENANT_ID`

### 2. Configure API Permissions

1. In your app registration, go to **Expose an API**
2. Click **Add a scope**
   - **Application ID URI**: `api://your-client-id` (or custom)
   - **Scope name**: `access_as_user`
   - **Who can consent**: Admins and users
   - **Admin consent display name**: Access Appraisal Management API
   - **Admin consent description**: Allows the app to access the API on behalf of the user
3. Click **Add scope**

### 3. Create Azure AD Groups (for role-based access)

1. Go to **Azure Active Directory** → **Groups**
2. Create groups for each role:
   - `Appraisal-Admins`
   - `Appraisal-Managers`
   - `Appraisal-QC-Analysts`
   - `Appraisal-Appraisers`
3. For each group, copy the **Object ID** and set in your environment:
   - `AZURE_ADMIN_GROUP_ID`
   - `AZURE_MANAGER_GROUP_ID`
   - `AZURE_QC_ANALYST_GROUP_ID`
   - `AZURE_APPRAISER_GROUP_ID`

### 4. Add Users to Groups

1. Go to each group → **Members** → **Add members**
2. Search for users and add them to appropriate groups

### 5. Configure Token Claims (Optional)

To include group memberships in tokens:

1. Go to your app registration → **Token configuration**
2. Click **Add groups claim**
3. Select **Security groups**
4. Check **Group ID** for token types: Access, ID

---

## Client Application Setup

### Frontend / Mobile App Configuration

Register a separate client application:

1. **Azure Portal** → **App registrations** → **New registration**
   - **Name**: `Appraisal Management Client`
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: 
     - Web: `http://localhost:3000` (dev), `https://yourdomain.com` (prod)
     - SPA: `http://localhost:3000` (React/Vue/Angular)
     - Mobile: `msauth.{package-name}://auth` (iOS/Android)

2. **API Permissions**:
   - Click **Add a permission** → **My APIs**
   - Select your API app (`Appraisal Management API`)
   - Check `access_as_user` scope
   - Click **Grant admin consent**

### JavaScript/React Example (MSAL.js)

```javascript
import { PublicClientApplication } from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId: "your-client-app-id",
    authority: "https://login.microsoftonline.com/your-tenant-id",
    redirectUri: "http://localhost:3000"
  }
};

const msalInstance = new PublicClientApplication(msalConfig);

// Login
const loginRequest = {
  scopes: ["api://your-api-client-id/access_as_user"]
};

async function login() {
  const response = await msalInstance.loginPopup(loginRequest);
  const accessToken = response.accessToken;
  
  // Use access token for API calls
  fetch('http://localhost:3000/api/orders', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
}
```

### cURL Example

```bash
# 1. Get access token (device code flow for testing)
curl -X POST https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/devicecode \
  -d "client_id={client-id}" \
  -d "scope=api://{api-client-id}/access_as_user"

# Follow the instructions, then get token:
curl -X POST https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token \
  -d "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
  -d "client_id={client-id}" \
  -d "device_code={device-code-from-previous-response}"

# 2. Use access token
curl http://localhost:3000/api/orders \
  -H "Authorization: Bearer {access-token}"
```

---

## Token Structure

Azure Entra ID tokens include these claims:

```json
{
  "aud": "api://your-client-id",
  "iss": "https://login.microsoftonline.com/{tenant-id}/v2.0",
  "iat": 1704110400,
  "exp": 1704114000,
  "sub": "user-subject-id",
  "oid": "user-object-id",
  "tid": "tenant-id",
  "email": "user@company.com",
  "name": "John Doe",
  "preferred_username": "john.doe@company.com",
  "roles": ["Admin", "Manager"],
  "groups": ["group-id-1", "group-id-2"]
}
```

---

## Role Mappings

Current role mappings in the API:

| Azure AD Group | API Role | Permissions |
|---------------|----------|-------------|
| Appraisal-Admins | `admin` | All permissions (`*`) |
| Appraisal-Managers | `manager` | order_manage, vendor_manage, vendor_assign, analytics_view, qc_metrics, qc_validate |
| Appraisal-QC-Analysts | `qc_analyst` | qc_validate, qc_execute, qc_metrics |
| Appraisal-Appraisers | `appraiser` | order_view, order_update |

To modify role mappings, edit `src/api/api-server.ts` → `configureAzureRoles()` method.

---

## Testing

### Development Mode (Bypass Auth)

```bash
# .env
BYPASS_AUTH=true
NODE_ENV=development
```

API will accept all requests without tokens and assign admin role.

### Production Mode

```bash
# .env
BYPASS_AUTH=false
NODE_ENV=production
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
```

All requests must include valid Azure AD access token.

---

## Troubleshooting

### "Token missing key ID (kid)"
- Token is not from Azure AD or is malformed
- Verify you're using the correct token endpoint

### "Invalid issuer"
- Check `AZURE_TENANT_ID` is correct
- Verify token issuer matches expected issuer

### "Invalid audience"
- Token audience must match `AZURE_CLIENT_ID` or `AZURE_AUDIENCE`
- Check client app is requesting correct scope

### "User has no role"
- User is not in any Azure AD groups
- Groups are not included in token claims (configure token configuration)
- Group IDs in environment variables don't match actual group Object IDs

### "JWKS fetch failed"
- Network connectivity issue to Microsoft endpoints
- Check firewall/proxy settings
- Verify tenant ID is correct

---

## Security Best Practices

1. **Never commit secrets**: Keep `.env` file out of source control
2. **Use Key Vault**: Store secrets in Azure Key Vault for production
3. **Rotate credentials**: Regularly rotate client secrets if using confidential clients
4. **Limit token lifetime**: Configure appropriate token lifetimes in Azure AD
5. **Monitor failed auth**: Set up alerts for authentication failures
6. **Use managed identities**: For Azure-hosted services, use managed identities instead of secrets

---

## Additional Resources

- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Azure AD Token Reference](https://docs.microsoft.com/en-us/azure/active-directory/develop/access-tokens)
- [Configure group claims](https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-optional-claims)
