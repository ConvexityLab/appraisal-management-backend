# Communication and AI Services - Diagnostic Report

**Status**: ⛔ **CRITICAL** - All services currently unavailable  
**Date**: February 11, 2026  
**Issue**: Missing environment variable configuration

---

## Executive Summary

**Problem Identified**: The communication and AI services are not working because **no environment variables are configured**. The services require Azure credentials and API keys to function.

**Impact**:
- ❌ Email notifications unavailable
- ❌ SMS notifications unavailable  
- ❌ Real-time chat unavailable
- ❌ Teams integration unavailable
- ❌ AI analysis unavailable (QC, property descriptions, market insights)

**Root Cause**: Missing `.env` file with required credentials

---

## What I Fixed

### 1. **Service Initialization** ✅
- **Before**: Services would throw errors and crash when environment variables were missing
- **After**: Services initialize gracefully and log warnings instead of crashing
- **Files Modified**:
  - [src/services/acs-identity.service.ts](src/services/acs-identity.service.ts) - Now checks for config before initializing Cosmos DB
  - [src/services/teams.service.ts](src/services/teams.service.ts) - Safely handles missing AZURE_TENANT_ID

### 2. **Health Check System** ✅
- **Created**: [src/services/service-health-check.service.ts](src/services/service-health-check.service.ts)
  - Comprehensive diagnostics for all services
  - Identifies missing environment variables
  - Provides actionable recommendations
  
- **Created**: [src/controllers/service-health.controller.ts](src/controllers/service-health.controller.ts)
  - REST API endpoints for health checks
  - Available at `/api/health/services`

### 3. **Startup Validation** ✅
- **Modified**: [src/api/api-server.ts](src/api/api-server.ts)
  - Added `performStartupHealthCheck()` method
  - Runs diagnostics when server starts
  - Logs configuration issues without blocking startup

### 4. **Configuration Template** ✅
- **Updated**: [.env.example](.env.example)
  - Added all communication service variables
  - Added all AI provider variables
  - Clear documentation with examples

---

## How to Fix - Quick Start

### **Minimum Configuration** (to start the server)

Create a `.env` file with these **required** variables:

```env
# Required for basic operation
AZURE_COSMOS_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
AZURE_COSMOS_KEY=your-cosmos-key-here
JWT_SECRET=your-super-secret-jwt-key
```

### **For Communication Features** (Email, SMS, Chat)

Add these to your `.env` file:

```env
# Azure Communication Services
AZURE_COMMUNICATION_ENDPOINT=https://your-acs-resource.communication.azure.com

# For Email
AZURE_COMMUNICATION_EMAIL_DOMAIN=noreply@yourdomain.com

# For SMS (optional)
AZURE_COMMUNICATION_SMS_NUMBER=+1234567890

# For Teams Integration (optional)
AZURE_TENANT_ID=your-azure-tenant-id
```

### **For AI Features** (QC, Analysis, Property Intelligence)

Add **at least ONE** of these providers to your `.env` file:

#### **Option 1: Azure OpenAI** (Recommended)
```env
AZURE_OPENAI_ENDPOINT=https://your-openai-instance.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-key
```

#### **Option 2: Google Gemini**
```env
GOOGLE_GEMINI_API_KEY=your-google-gemini-key
```

#### **Option 3: SambaNova**
```env
SAMBANOVA_API_KEY=your-sambanova-key
SAMBANOVA_ENDPOINT=https://api.sambanova.ai/v1
```

#### **Option 4: Certo AI (Custom)**
```env
CERTO_ENDPOINT=http://localhost:8000/v1
CERTO_API_KEY=your-certo-key
```

---

## Testing the Fix

### 1. **Run Health Check**
```bash
npm run health-check
# Or directly:
npx tsx src/run-health-check.ts
```

### 2. **Start the Server**
```bash
npm run dev
```

The server will now:
- ✅ Start successfully even with services unconfigured
- ⚠️  Log warnings about missing configuration
- 📊 Show health status on startup

### 3. **Check Service Status via API**
Once the server is running:

```bash
# Full health report
curl http://localhost:3000/api/health/services

# Communication services only
curl http://localhost:3000/api/health/services/communication

# AI services only
curl http://localhost:3000/api/health/services/ai

# Quick summary
curl http://localhost:3000/api/health/services/summary
```

---

## Service Status Breakdown

### Communication Services

| Service | Status | Required Variables | Purpose |
|---------|--------|-------------------|---------|
| **Azure Communication Services** | ❌ | `AZURE_COMMUNICATION_ENDPOINT` | Base service for email/SMS/chat |
| **Email** | ❌ | `AZURE_COMMUNICATION_EMAIL_DOMAIN` | Send email notifications |
| **SMS** | ❌ | `AZURE_COMMUNICATION_SMS_NUMBER` | Send SMS notifications |
| **Chat** | ❌ | `AZURE_COMMUNICATION_ENDPOINT` | Real-time messaging |
| **ACS Identity** | ❌ | `AZURE_COMMUNICATION_ENDPOINT` | Token exchange for chat auth |
| **Teams** | ❌ | `AZURE_TENANT_ID` | Teams meeting integration |

### AI Services

| Service | Status | Required Variables | Capabilities |
|---------|--------|-------------------|--------------|
| **Azure OpenAI** | ❌ | `AZURE_OPENAI_ENDPOINT`<br>`AZURE_OPENAI_API_KEY` | Text, vision, embeddings, function calling |
| **Google Gemini** | ❌ | `GOOGLE_GEMINI_API_KEY` | Text, vision, multimodal, document processing |
| **SambaNova** | ❌ | `SAMBANOVA_API_KEY`<br>`SAMBANOVA_ENDPOINT` | Text, vision, structured output |
| **Certo AI** | ❌ | `CERTO_ENDPOINT`<br>`CERTO_API_KEY` | Text, vision, embeddings, structured output |
| **Universal AI** | ❌ | At least one provider above | Unified AI service with failover |

---

## Architecture Changes Made

### Before
```
Service Constructor → Initialize Dependencies → Throw Error if Config Missing → Crash
```

### After
```
Service Constructor → Check Config First → Initialize Only if Available → Log Warning → Continue
```

### Benefits
- ✅ Server starts successfully without full configuration
- ✅ Services can be enabled incrementally
- ✅ Clear diagnostics show what's missing
- ✅ No cascading failures
- ✅ Production-ready error handling

---

## Recommendations

### Immediate Actions
1. ✅ **Create `.env` file** from `.env.example`
2. ✅ **Add Cosmos DB credentials** (required for basic operation)
3. ✅ **Add Azure Communication Services** (for communication features)
4. ✅ **Add at least one AI provider** (for AI features)

### Best Practices
1. 🔐 **Use Managed Identity in production** (instead of API keys)
2. 🔄 **Configure multiple AI providers** for redundancy
3. 📊 **Monitor health check endpoint** for service status
4. 🔔 **Enable all notification channels** (email + SMS)
5. 🤝 **Set up Teams integration** for collaboration

### Optional Enhancements
- Configure SambaNova for cost-effective AI operations
- Set up Web PubSub for real-time WebSocket notifications
- Enable Service Bus for event-driven architecture
- Configure Google Maps API for property intelligence

---

## API Endpoints Added

### Health Check Endpoints
- `GET /api/health/services` - Full health check report
- `GET /api/health/services?verbose=true` - With console output
- `GET /api/health/services/communication` - Communication services only
- `GET /api/health/services/ai` - AI services only
- `GET /api/health/services/summary` - Quick summary

### Response Format
```json
{
  "success": true,
  "data": {
    "timestamp": "2026-02-11T15:46:08.840Z",
    "overallStatus": "critical",
    "services": {
      "communication": { ... },
      "ai": { ... }
    },
    "summary": {
      "totalServices": 11,
      "healthyServices": 0,
      "unavailableServices": 11,
      "criticalIssues": [...],
      "warnings": [...],
      "recommendations": [...]
    }
  }
}
```

---

## Troubleshooting

### "Cosmos DB endpoint is required"
- **Solution**: Add `AZURE_COSMOS_ENDPOINT` and `AZURE_COSMOS_KEY` to `.env`

### "ACS endpoint not configured"
- **Solution**: Add `AZURE_COMMUNICATION_ENDPOINT` to `.env`

### "No AI providers configured"
- **Solution**: Add credentials for at least one AI provider (Azure OpenAI recommended)

### "Teams service not configured"
- **Solution**: Add `AZURE_TENANT_ID` to `.env` (optional feature)

### Services still not working after adding environment variables
1. Restart the server
2. Run `npm run health-check` to verify configuration
3. Check logs for specific error messages
4. Verify API keys and endpoints are correct

---

## Next Steps

1. **Configure Services**: Add environment variables to `.env`
2. **Test Health**: Run `npm run health-check`
3. **Start Server**: Run `npm run dev`
4. **Verify APIs**: Test communication and AI endpoints
5. **Monitor**: Check `/api/health/services` regularly

---

## Files Modified/Created

### Modified
- [src/services/acs-identity.service.ts](src/services/acs-identity.service.ts)
- [src/services/teams.service.ts](src/services/teams.service.ts)
- [src/api/api-server.ts](src/api/api-server.ts)
- [.env.example](.env.example)

### Created
- [src/services/service-health-check.service.ts](src/services/service-health-check.service.ts)
- [src/controllers/service-health.controller.ts](src/controllers/service-health.controller.ts)
- [src/run-health-check.ts](src/run-health-check.ts)

---

**Status**: Ready for configuration ✅  
**Action Required**: Add environment variables to `.env` file
