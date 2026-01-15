# Frontend API Integration Guide

## Backend Architecture Overview

Your backend consists of **two container apps** behind an **Azure API Management (APIM) gateway**:

```
┌─────────────────────────────────────────────────┐
│  APIM Gateway                                   │
│  https://apim-appraisal-staging-*.azure-api.net │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ API Backend  │    │ Function App │
│ Container    │    │ Container    │
└──────────────┘    └──────────────┘
```

**IMPORTANT**: All requests go through the **APIM Gateway URL** - never call container apps directly.

---

## API Gateway Base URL

```typescript
// Replace {APIM_FQDN} with actual APIM gateway URL after deployment
const API_BASE_URL = 'https://{APIM_FQDN}';

// Example after deployment:
// const API_BASE_URL = 'https://apim-appraisal-staging-abc123.azure-api.net';
```

---

## Authentication

### Getting an Access Token

**Development/Testing (JWT Test Tokens):**
```typescript
// POST /api/auth/login
const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'your-password'
  })
});

const data = await response.json();
// Response:
// {
//   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
//   "user": {
//     "id": "user-123",
//     "email": "user@example.com",
//     "firstName": "John",
//     "lastName": "Doe",
//     "role": "admin",
//     "permissions": ["*"]
//   }
// }

const accessToken = data.token;
```

**Production (Azure AD OAuth):**
```typescript
// Use MSAL.js or similar OAuth library
// Tenant ID: 885097ba-35ea-48db-be7a-a0aa7ff451bd
// Client ID: dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a

import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: 'dd3e7944-ecf3-4cd9-bf1d-ba1a4e857e8a',
    authority: 'https://login.microsoftonline.com/885097ba-35ea-48db-be7a-a0aa7ff451bd',
    redirectUri: window.location.origin,
  }
};

const msalInstance = new PublicClientApplication(msalConfig);
const loginResponse = await msalInstance.loginPopup();
const accessToken = loginResponse.accessToken;
```

### Using the Access Token

**Every API request** (except public endpoints) requires the token in the `Authorization` header:

```typescript
const response = await fetch(`${API_BASE_URL}/api/orders`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});

if (response.status === 401) {
  // Token expired or invalid - redirect to login
  console.error('Authentication required');
}
```

### Token Refresh

Tokens expire after **24 hours**. Refresh before expiration:

```typescript
// POST /api/auth/refresh
const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${oldToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
const newToken = data.token;
```

---

## Route Structure

### API Container App Routes: `/api/*`

These routes handle **primary application logic** and route to the **API container app backend**:

#### Authentication
- `POST /api/auth/login` - Get access token (public)
- `POST /api/auth/register` - Create new user (public)
- `POST /api/auth/refresh` - Refresh access token (requires auth)

#### Order Management
- `POST /api/orders` - Create new appraisal order
- `GET /api/orders` - List orders
- `GET /api/orders/:orderId` - Get order details
- `PUT /api/orders/:orderId/status` - Update order status
- `POST /api/orders/:orderId/deliver` - Mark order delivered
- `GET /api/orders/dashboard` - Dashboard metrics

#### Quality Control (QC)
- `POST /api/qc/validate/:orderId` - Run QC validation
- `GET /api/qc/results/:orderId` - Get QC results
- `GET /api/qc/metrics` - QC performance metrics

#### Vendor Management
- `GET /api/vendors` - List vendors
- `POST /api/vendors` - Create vendor
- `PUT /api/vendors/:vendorId` - Update vendor
- `POST /api/vendors/assign/:orderId` - Assign vendor to order
- `GET /api/vendors/performance/:vendorId` - Vendor performance stats

#### Analytics
- `GET /api/analytics/overview` - Platform overview
- `GET /api/analytics/performance` - Performance analytics

#### Property Intelligence
- `GET /api/property-intelligence/address/suggest?query=<address>` - Address autocomplete (optional auth)
- `POST /api/property-intelligence/address/geocode` - Geocode address
- `POST /api/property-intelligence/address/validate` - Validate address
- `POST /api/property-intelligence/analyze/comprehensive` - Full property analysis
- `POST /api/property-intelligence/analyze/creative` - Creative features
- `POST /api/property-intelligence/analyze/view` - View analysis
- `POST /api/property-intelligence/analyze/transportation` - Transit analysis
- `POST /api/property-intelligence/analyze/neighborhood` - Neighborhood data
- `POST /api/property-intelligence/analyze/batch` - Batch analysis
- `GET /api/property-intelligence/census/demographics` - Census demographics
- `GET /api/property-intelligence/census/economics` - Economic data
- `GET /api/property-intelligence/census/housing` - Housing data
- `GET /api/property-intelligence/census/comprehensive` - All census data
- `GET /api/property-intelligence/health` - Service health (public)

#### AI/ML Services
- `POST /api/ai/qc/analyze` - AI-powered QC analysis
- `POST /api/ai/qc/technical` - Technical QC
- `POST /api/ai/qc/compliance` - Compliance QC
- `POST /api/ai/market/insights` - Market insights
- `POST /api/ai/property/description` - Generate property description
- `POST /api/ai/vision/analyze` - Analyze property images
- `POST /api/ai/vision/condition` - Property condition from images
- `POST /api/ai/embeddings` - Generate embeddings
- `POST /api/ai/completion` - AI text completion
- `GET /api/ai/health` - AI service health (public)
- `GET /api/ai/usage` - AI usage statistics

#### Teams Integration
- `GET /api/teams/channels/:teamId/:channelId/email` - Get channel email
- `POST /api/teams/channels/:teamId/:channelId/notify` - Send notification

#### Other Services
- `POST /api/code/execute` - Execute sandboxed code
- `/api/avm/*` - Automated Valuation Model endpoints
- `/api/fraud-detection/*` - Fraud detection endpoints
- `/api/geospatial/*` - Geospatial risk assessment
- `/api/bridge-mls/*` - MLS data integration

#### Health & Documentation
- `GET /health` - API health check (public)
- `GET /api-docs` - Swagger/OpenAPI docs (public)

---

### Function Container App Routes: `/api/functions/*`

These routes handle **background processing** and **async tasks**, routed to the **Function container app backend**:

#### Background Processing
- `POST /api/functions/background/process-report` - Process appraisal report
- `POST /api/functions/background/generate-insights` - Generate AI insights
- `POST /api/functions/background/sync-data` - Data synchronization

#### Scheduled Tasks
- `POST /api/functions/scheduled/cleanup` - Cleanup old data
- `POST /api/functions/scheduled/report-generation` - Scheduled reports
- `POST /api/functions/scheduled/metrics-aggregation` - Aggregate metrics

#### Event Processing
- `POST /api/functions/events/order-created` - Handle order creation event
- `POST /api/functions/events/order-completed` - Handle order completion
- `POST /api/functions/events/qc-validation` - Handle QC validation events

#### Webhooks
- `POST /api/functions/webhooks/mls-update` - MLS data webhook
- `POST /api/functions/webhooks/vendor-notification` - Vendor webhook
- `POST /api/functions/webhooks/external-integration` - External system webhooks

**Note**: Function app routes are typically called by the backend or external systems, not directly by frontend. However, they use the same authentication mechanism.

---

## Example API Calls

### TypeScript/JavaScript Examples

#### Get Orders List
```typescript
async function getOrders(accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}
```

#### Create New Order
```typescript
async function createOrder(accessToken: string, orderData: any) {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      propertyAddress: orderData.address,
      orderType: 'full_appraisal',
      dueDate: orderData.dueDate,
      clientId: orderData.clientId
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create order');
  }
  
  return await response.json();
}
```

#### Property Intelligence Analysis
```typescript
async function analyzeProperty(accessToken: string, coordinates: { lat: number, lng: number }) {
  const response = await fetch(`${API_BASE_URL}/api/property-intelligence/analyze/comprehensive`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      strategy: 'quality_first'
    })
  });
  
  if (!response.ok) {
    throw new Error('Property analysis failed');
  }
  
  return await response.json();
}
```

#### Send Teams Notification
```typescript
async function sendTeamsNotification(
  accessToken: string, 
  teamId: string, 
  channelId: string, 
  notification: { subject: string, message: string }
) {
  const response = await fetch(
    `${API_BASE_URL}/api/teams/channels/${teamId}/${channelId}/notify`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notification)
    }
  );
  
  return await response.json();
}
```

---

## Error Handling

All endpoints return consistent error responses:

```typescript
interface ApiError {
  error: string;        // Human-readable error message
  code: string;         // Machine-readable error code
  details?: any;        // Additional error details
  timestamp?: string;   // ISO 8601 timestamp
}
```

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response data |
| 201 | Created | Resource successfully created |
| 400 | Bad Request | Check request body/parameters |
| 401 | Unauthorized | Token missing/invalid - redirect to login |
| 403 | Forbidden | User lacks required permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Validation failed - check error.details |
| 429 | Too Many Requests | Rate limited - retry with backoff |
| 500 | Internal Server Error | Backend error - log and notify user |
| 503 | Service Unavailable | Backend temporarily down - retry |

### Error Handling Pattern

```typescript
async function apiCall<T>(url: string, options: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error: ApiError = await response.json();
      
      // Handle specific error codes
      switch (response.status) {
        case 401:
          // Redirect to login
          window.location.href = '/login';
          throw new Error('Authentication required');
        
        case 403:
          throw new Error('You do not have permission to perform this action');
        
        case 422:
          // Validation errors
          console.error('Validation errors:', error.details);
          throw new Error(error.error);
        
        default:
          throw new Error(error.error || `HTTP ${response.status}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

---

## React/Vue/Angular Integration

### React Example with Axios

```typescript
import axios, { AxiosInstance } from 'axios';

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Add token to all requests
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    // Handle 401 errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.accessToken = token;
  }

  private handleUnauthorized() {
    this.accessToken = null;
    window.location.href = '/login';
  }

  // API methods
  async getOrders() {
    const response = await this.client.get('/api/orders');
    return response.data;
  }

  async createOrder(data: any) {
    const response = await this.client.post('/api/orders', data);
    return response.data;
  }

  async analyzeProperty(coordinates: { latitude: number, longitude: number }) {
    const response = await this.client.post(
      '/api/property-intelligence/analyze/comprehensive',
      coordinates
    );
    return response.data;
  }
}

// Usage
const apiClient = new ApiClient('https://{APIM_FQDN}');

// After login
const loginData = await apiClient.client.post('/api/auth/login', {
  email: 'user@example.com',
  password: 'password'
});
apiClient.setToken(loginData.data.token);

// Now make authenticated calls
const orders = await apiClient.getOrders();
```

---

## WebSocket Support (Future)

Currently, all communication is REST-based. WebSocket support for real-time updates is planned for future releases.

---

## CORS Configuration

The backend has CORS enabled for all origins during development. In production, ensure your frontend domain is whitelisted.

**Current CORS headers:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
Access-Control-Allow-Credentials: true
```

---

## Rate Limiting

Rate limits are configured at the APIM level:
- **Development**: No limits
- **Production**: 1000 requests per minute per IP

When rate limited, you'll receive a `429 Too Many Requests` response with a `Retry-After` header indicating when to retry.

---

## Testing Your Integration

### Health Check
```bash
curl https://{APIM_FQDN}/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T00:00:00.000Z",
  "services": {
    "database": "healthy",
    "orderManagement": "healthy",
    "qcValidation": "healthy",
    "vendorManagement": "healthy"
  },
  "version": "1.0.0"
}
```

### Get Test Token
```bash
curl -X POST https://{APIM_FQDN}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Authenticated Endpoint
```bash
TOKEN="your-token-here"

curl https://{APIM_FQDN}/api/orders \
  -H "Authorization: Bearer $TOKEN"
```

---

## Deployment Configuration

After APIM deployment completes, update your frontend environment variables:

```bash
# .env.development
VITE_API_BASE_URL=https://apim-appraisal-staging-abc123.azure-api.net

# .env.production
VITE_API_BASE_URL=https://apim-appraisal-prod-xyz789.azure-api.net
```

---

## Support & Documentation

- **Swagger/OpenAPI Docs**: `https://{APIM_FQDN}/api-docs`
- **APIM Developer Portal**: Available after deployment
- **Backend Source**: GitHub repository
- **Issues**: Create GitHub issue for bugs/features

---

## Quick Reference

### Environment Setup
```typescript
// src/config/api.ts
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://apim-appraisal-staging-*.azure-api.net',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
};
```

### Authentication State Management
```typescript
// src/store/auth.ts
interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    accessToken: localStorage.getItem('accessToken'),
    user: null,
    isAuthenticated: false
  });

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_CONFIG.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    setAuthState({
      accessToken: data.token,
      user: data.user,
      isAuthenticated: true
    });
    
    localStorage.setItem('accessToken', data.token);
  };

  const logout = () => {
    setAuthState({
      accessToken: null,
      user: null,
      isAuthenticated: false
    });
    localStorage.removeItem('accessToken');
  };

  return { authState, login, logout };
};
```

---

**Last Updated**: 2026-01-15  
**Backend Version**: 1.0.0  
**APIM Status**: Deploying (pending DNS verification)
