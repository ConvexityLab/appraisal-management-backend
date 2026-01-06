# Authentication Setup Guide

Complete guide for setting up Azure AD authentication between your frontend and backend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER AUTHENTICATION FLOW                     │
└─────────────────────────────────────────────────────────────────────┘

1. User visits Frontend (Static Web App)
2. Frontend redirects to Azure AD login
3. User logs in with Azure AD credentials
4. Azure AD returns JWT token to frontend
5. Frontend calls Backend API with JWT token in Authorization header
6. Backend validates JWT token against Azure AD
7. Backend returns data to Frontend

┌──────────────────┐       ┌──────────────────┐       ┌──────────────┐
│  Static Web App  │──────▶│   Azure AD       │◀──────│  Backend API │
│   (Frontend)     │       │  (Entra ID)      │       │(Container App)│
└──────────────────┘       └──────────────────┘       └──────────────┘
        │                           │                          │
        │ JWT Token                 │ Validates                │
        └───────────────────────────┴──────────────────────────┘
```

## Required Azure AD App Registrations

You need **TWO** app registrations:

### 1. Frontend App Registration (SPA)
For user authentication in the frontend.

### 2. Backend API App Registration (API)
For backend to validate tokens and call Microsoft services (Graph, Teams, ACS).

## Step 1: Create Frontend App Registration

```powershell
# Get your tenant ID
$tenantId = az account show --query tenantId -o tsv

# Create frontend app (Single Page Application)
az ad app create `
  --display-name "Appraisal Management Frontend - Staging" `
  --sign-in-audience AzureADMyOrg `
  --enable-id-token-issuance true `
  --public-client-redirect-uris "http://localhost:3000" "http://localhost:5173"

# Get the app ID (save this!)
$frontendAppId = az ad app list --display-name "Appraisal Management Frontend - Staging" --query "[0].appId" -o tsv
echo "Frontend App ID: $frontendAppId"
```

**Manual Configuration in Azure Portal:**
1. Go to **Azure Portal** → **Azure Active Directory** → **App registrations**
2. Find "Appraisal Management Frontend - Staging"
3. Go to **Authentication**:
   - Add platform: **Single-page application**
   - Add Redirect URIs:
     - `https://<your-static-web-app>.azurestaticapps.net`
     - `https://<your-static-web-app>.azurestaticapps.net/.auth/login/aad/callback`
     - `http://localhost:3000` (for local dev)
   - Enable **ID tokens** (for implicit flow)
4. Go to **Token configuration**:
   - Add optional claims: `email`, `name`, `family_name`, `given_name`
5. Go to **API permissions**:
   - Add **Microsoft Graph** → **User.Read** (delegated)

## Step 2: Create Backend API App Registration

```powershell
# Create backend API app
az ad app create `
  --display-name "Appraisal Management API - Staging" `
  --sign-in-audience AzureADMyOrg `
  --identifier-uris "api://appraisal-management-api-staging"

# Get the app ID
$backendAppId = az ad app list --display-name "Appraisal Management API - Staging" --query "[0].appId" -o tsv
echo "Backend App ID: $backendAppId"

# Create service principal (required for API permissions)
az ad sp create --id $backendAppId

# Create client secret (IMPORTANT: Save this - you can't retrieve it later!)
$secret = az ad app credential reset --id $backendAppId --query password -o tsv
echo "Backend Client Secret: $secret"
```

**Manual Configuration in Azure Portal:**
1. Go to **App registrations** → "Appraisal Management API - Staging"
2. Go to **Expose an API**:
   - Set Application ID URI: `api://appraisal-management-api-staging`
   - Add a scope:
     - Name: `Orders.ReadWrite`
     - Who can consent: **Admins and users**
     - Display name: "Access appraisal orders"
3. Go to **App roles** (for role-based access):
   - Add roles: `Admin`, `Manager`, `Appraiser`, `QC_Analyst`
4. Go to **API permissions**:
   - **Microsoft Graph**:
     - `User.Read` (delegated)
     - `User.ReadBasic.All` (delegated) - for Teams
   - **Azure Communication Services**:
     - `https://communication.azure.com/.default` (application)

## Step 3: Link Frontend to Backend API

Allow frontend to request tokens for backend API:

```powershell
# Add backend API as a required permission for frontend
az ad app permission add `
  --id $frontendAppId `
  --api $backendAppId `
  --api-permissions <scope-id>=Scope

# Grant admin consent
az ad app permission admin-consent --id $frontendAppId
```

**In Azure Portal:**
1. Frontend App → **API permissions**
2. Add permission → **My APIs** → "Appraisal Management API - Staging"
3. Select **Delegated permissions** → `Orders.ReadWrite`
4. Click **Grant admin consent**

## Step 4: Configure Environment Variables

### Backend `.env` (Local Development)

```env
# Azure Entra (Azure AD) Authentication
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<backend-app-id>
AZURE_CLIENT_SECRET=<backend-client-secret>
AZURE_FRONTEND_CLIENT_ID=<frontend-app-id>

# JWT Configuration
JWT_SECRET=<generate-a-secure-random-string>
JWT_ISSUER=appraisal-management-api
JWT_AUDIENCE=appraisal-management-api
```

### Frontend `.env` (Local Development)

```env
# Azure AD Configuration
VITE_AZURE_TENANT_ID=<your-tenant-id>
VITE_AZURE_CLIENT_ID=<frontend-app-id>
VITE_AZURE_REDIRECT_URI=http://localhost:5173

# Backend API
VITE_API_URL=http://localhost:3000
```

## Step 5: Set GitHub Secrets

Run the helper script to populate GitHub Secrets:

```powershell
# From backend repository
.\scripts\setup-github-secrets.ps1
```

Or manually set them:

```powershell
gh secret set AZURE_TENANT_ID --body "<your-tenant-id>"
gh secret set AZURE_CLIENT_ID --body "<backend-app-id>"
gh secret set AZURE_CLIENT_SECRET --body "<backend-client-secret>"
```

## Step 6: Frontend Authentication Implementation

### Option A: Azure Static Web Apps Built-in Auth

Create `staticwebapp.config.json` in frontend repository root:

```json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/<tenant-id>/v2.0",
          "clientIdSettingName": "AZURE_CLIENT_ID",
          "clientSecretSettingName": "AZURE_CLIENT_SECRET"
        }
      }
    }
  },
  "routes": [
    {
      "route": "/login",
      "rewrite": "/.auth/login/aad"
    },
    {
      "route": "/logout",
      "rewrite": "/.auth/logout"
    },
    {
      "route": "/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad?post_login_redirect_uri=.referrer",
      "statusCode": 302
    }
  }
}
```

Then configure Static Web App settings:

```powershell
az staticwebapp appsettings set `
  --name <static-web-app-name> `
  --setting-names AZURE_CLIENT_ID=$frontendAppId
```

**Access user info in frontend:**
```javascript
const response = await fetch('/.auth/me');
const { clientPrincipal } = await response.json();
console.log('User:', clientPrincipal.userDetails);
```

### Option B: Custom MSAL Integration

Install MSAL in frontend:

```bash
npm install @azure/msal-browser @azure/msal-react
```

Create `src/authConfig.ts`:

```typescript
import { Configuration, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        console.log(message);
      },
      logLevel: LogLevel.Info,
      piiLoggingEnabled: false,
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read', `api://${import.meta.env.VITE_BACKEND_API_APP_ID}/Orders.ReadWrite`],
};
```

Create `src/App.tsx`:

```typescript
import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './authConfig';

const msalInstance = new PublicClientApplication(msalConfig);

function LoginButton() {
  const { instance } = useMsal();
  
  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(console.error);
  };
  
  return <button onClick={handleLogin}>Sign In</button>;
}

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthenticatedTemplate>
        <YourApp />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <LoginButton />
      </UnauthenticatedTemplate>
    </MsalProvider>
  );
}
```

**Make authenticated API calls:**

```typescript
import { useMsal } from '@azure/msal-react';
import { loginRequest } from './authConfig';

function useApi() {
  const { instance, accounts } = useMsal();
  
  const callApi = async (endpoint: string, options = {}) => {
    // Get access token
    const response = await instance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });
    
    // Call backend API
    const apiResponse = await fetch(
      `${import.meta.env.VITE_API_URL}${endpoint}`,
      {
        ...options,
        headers: {
          'Authorization': `Bearer ${response.idToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return apiResponse.json();
  };
  
  return { callApi };
}
```

## Step 7: Backend Token Validation

Your backend already validates JWT tokens. Ensure it validates Azure AD tokens:

Update `src/middleware/qc-api-validation.middleware.ts` to validate Azure AD tokens:

```typescript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

private async validateJWT(token: string): Promise<AuthUser | null> {
  try {
    // Option 1: Validate custom JWT (current implementation)
    if (process.env.JWT_SECRET) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      return {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || [],
        organizationId: decoded.organizationId,
        clientId: decoded.clientId
      };
    }
    
    // Option 2: Validate Azure AD token
    const client = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`
    });
    
    const getKey = (header: any, callback: any) => {
      client.getSigningKey(header.kid, (err, key) => {
        const signingKey = key?.getPublicKey();
        callback(err, signingKey);
      });
    };
    
    return new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {
        audience: process.env.AZURE_CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
        algorithms: ['RS256']
      }, (err, decoded: any) => {
        if (err) return reject(err);
        
        resolve({
          id: decoded.sub || decoded.oid,
          email: decoded.email || decoded.preferred_username,
          role: decoded.roles?.[0] || 'user',
          permissions: decoded.roles || [],
          organizationId: decoded.tid,
          clientId: decoded.azp
        });
      });
    });
    
  } catch (error) {
    this.logger.error('JWT validation failed', { error });
    return null;
  }
}
```

Install required package:

```bash
npm install jwks-rsa
```

## Step 8: Deploy and Test

```powershell
# Deploy backend
git push origin master

# Deploy frontend (from frontend repository)
# The deployment will automatically inject:
# - VITE_API_URL from Static Web App config
# - AZURE_CLIENT_ID from app settings
```

## Testing Authentication

### Test with Postman

1. Get Azure AD token:
   ```
   POST https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token
   Content-Type: application/x-www-form-urlencoded
   
   grant_type=client_credentials
   &client_id=<backend-app-id>
   &client_secret=<backend-client-secret>
   &scope=api://appraisal-management-api-staging/.default
   ```

2. Use token in API request:
   ```
   GET https://<backend-url>/api/orders
   Authorization: Bearer <token>
   ```

### Test with Frontend

1. Navigate to frontend URL
2. Click "Sign In"
3. Log in with Azure AD credentials
4. Verify API calls work in DevTools Network tab

## Troubleshooting

### Token Validation Fails

- Verify `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` match your app registration
- Check token issuer matches: `https://login.microsoftonline.com/<tenant-id>/v2.0`
- Ensure backend has correct audience configured

### CORS Errors

Add frontend URL to backend CORS configuration:

```typescript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://<static-web-app>.azurestaticapps.net'
  ],
  credentials: true
}));
```

### Redirect URI Mismatch

Ensure redirect URI in Azure AD exactly matches your Static Web App URL (including https://).

## Security Best Practices

✅ **Use HTTPS** - Always use HTTPS in production
✅ **Short Token Expiry** - Configure token lifetime to 1 hour or less
✅ **Refresh Tokens** - Implement refresh token flow for long sessions
✅ **Validate Audience** - Always validate token audience matches your API
✅ **Role-Based Access** - Use Azure AD app roles for authorization
✅ **Conditional Access** - Enable MFA and conditional access policies
✅ **Monitor Sign-ins** - Review Azure AD sign-in logs regularly

## Summary of IDs and Secrets

After setup, you should have:

| Variable | Value | Where Used |
|----------|-------|------------|
| `AZURE_TENANT_ID` | Your Azure AD tenant ID | Frontend + Backend + Key Vault |
| `AZURE_FRONTEND_CLIENT_ID` | Frontend app ID | Frontend config |
| `AZURE_CLIENT_ID` | Backend app ID | Backend + Key Vault |
| `AZURE_CLIENT_SECRET` | Backend secret | Backend + Key Vault |
| `JWT_SECRET` | Random secure string | Backend only (for custom tokens) |

**Store in GitHub Secrets** for automatic deployment! ✅
