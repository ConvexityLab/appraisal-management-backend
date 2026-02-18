# Communication System - Deploy & Test Guide

## 🚨 CURRENT STATUS

**Backend Code:** ✅ READY (committed and pushed)
**Frontend Code:** ✅ READY (committed and pushed)
**Infrastructure:** ⏳ PENDING (awaiting CI/CD deployment)

---

## 📋 Pre-Deployment Checklist

### What's Already Done:

✅ **Backend:**
- `communications` container Bicep module created
- `documents` container Bicep module created
- Both modules referenced in `infrastructure/main.bicep`
- CommunicationRecord TypeScript interface defined
- `storeCommunication()` function with full schema support
- 5 query endpoints: order, vendor, appraiser, thread, search
- Cosmos DB service initialization code added

✅ **Frontend:**
- CommunicationHistory component (timeline view with filters)
- SendCommunicationDialog component (email/SMS composer)
- CommunicationsTrayWithACS updated with History + Send tabs
- RTK Query hooks for all backend endpoints
- Dynamic drawer width (700px History, 900px AI, 640px others)

✅ **Seed Data:**
- `scripts/seed-communications.js` with 8 realistic messages
- Linked to existing test orders, vendors, appraisers
- Thread grouping, categories, business impact tracking

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Trigger CI/CD Pipeline

**Option A: Via GitHub Actions (Recommended)**
1. Go to: https://github.com/ConvexityLab/appraisal-management-backend/actions
2. Find the deployment workflow
3. Click "Run workflow" → Run on `master` branch
4. Wait for completion (~5-10 minutes)

**Option B: Manual Azure Deployment (If CI/CD unavailable)**
```bash
# ⚠️ USE ONLY IF CI/CD IS BROKEN
cd infrastructure
az deployment group create \
  --resource-group appraisal-mgmt-staging \
  --template-file main.bicep \
  --parameters cosmosAccountName=appraisal-mgmt-staging-cosmos \
  --parameters databaseName=appraisal-management
```

**Option C: Azure Portal**
1. Go to Azure Portal → Resource Groups → appraisal-mgmt-staging
2. Click "Deployments" in left menu
3. Click "Create" → "Template deployment"
4. Upload `infrastructure/main.bicep`
5. Fill parameters and deploy

---

### Step 2: Verify Containers Created

```powershell
# Check if containers exist
az cosmosdb sql container list \
  --account-name appraisal-mgmt-staging-cosmos \
  --database-name appraisal-management \
  --resource-group appraisal-mgmt-staging \
  --query "[].name" -o table
```

**Expected output should include:**
- ✅ `communications`
- ✅ `documents`
- (plus all existing containers: orders, vendors, appraisers, etc.)

---

### Step 3: Seed Communication Data

```bash
cd c:\source\appraisal-management-backend

# Ensure existing test data exists (orders, vendors, appraisers)
node scripts/seed-appraiser-assignments.js

# Seed communications (links to above test data)
node scripts/seed-communications.js
```

**Expected output:**
```
🌱 Seeding test communications...
✅ Created: EMAIL - New Order Assignment: ORD-2024-001
✅ Created: SMS - Got the order. Can I schedule...
✅ Created: EMAIL - RE: Inspection Scheduling...
...
✅ Successfully created: 8
```

---

### Step 4: Start Backend & Verify

```bash
cd c:\source\appraisal-management-backend
npm run dev
```

**Backend should start WITHOUT errors. If it crashes:**
- ❌ Container doesn't exist → Go back to Step 1
- ❌ Permission error → Check Managed Identity / connection string
- ❌ Other error → Check logs for details

**Test backend endpoints:**
```powershell
# Run automated test script
.\scripts\test-communications-live.ps1

# OR manual tests:
# 1. Get auth token
$token = "YOUR_JWT_TOKEN"

# 2. Query order communications
Invoke-RestMethod -Uri "http://localhost:3011/api/communications/order/ord_2024_test_001" `
  -Headers @{Authorization="Bearer $token"} | ConvertTo-Json -Depth 5

# 3. Send test email
$body = @{
  to = "test@example.com"
  subject = "Test"
  body = "Hello"
  primaryEntity = @{
    type = "order"
    id = "ord_2024_test_001"
    name = "Test Order"
  }
  category = "general"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3011/api/communications/email" `
  -Method POST -Headers @{Authorization="Bearer $token"; "Content-Type"="application/json"} `
  -Body $body
```

---

### Step 5: Start Frontend & Test UI

```bash
cd c:\source\l1-valuation-platform-ui
npm run dev
```

**Frontend URL:** http://localhost:3010

---

## 🧪 END-TO-END TEST PLAN

### Test 1: View Communication History

1. **Navigate to Order Detail Page**
   - Go to: http://localhost:3010/property-valuation/order/ord_2024_test_001
   - Or use search to find "ORD-2024-001"

2. **Open Communications Tray**
   - Click the communications icon (💬) in top-right corner
   - Badge should show unread count (if any)

3. **Verify History Tab**
   - Should default to "History" tab (first tab)
   - Should see timeline of 3 messages for this order:
     - EMAIL: "New Order Assignment: ORD-2024-001"
     - SMS: "Got the order. Can I schedule..."
     - EMAIL: "RE: Inspection Scheduling..."
   - Filter by channel: Click "Email" → Should show only emails
   - Filter by category: Select "Order Discussion" → Should filter
   - Search: Type "inspection" → Should find matching message

4. **Verify Order Context Banner**
   - Top of tray should show:
     ```
     📋 Order #ORD-2024-001
     🏠 123 Main Street, Miami, FL 33101
     Phase: [current phase] · Due: [due date]
     ```

### Test 2: Send New Communication

1. **Click "Send" Tab** (second tab)
2. **Compose Email:**
   - Channel: Email (tab selected by default)
   - To: john.smith@appraiser.com
   - Category: Order Discussion
   - Subject: "Follow-up on inspection"
   - Body: "Just checking on the inspection status..."
   - Click **Send**

3. **Verify:**
   - Should see success message
   - Switch back to "History" tab
   - New message should appear at top of timeline
   - Refresh page and reopen tray → Message persists

### Test 3: Vendor Communication History

1. **Navigate to Vendor Profile**
   - Go to: http://localhost:3010/vendors/vendor-elite-appraisals

2. **Open Communications Tray**
   - Should show 5 messages total:
     - 3 order-specific (for ORD-2024-001)
     - 2 relationship messages (employment, availability)

3. **Filter: "Relationship Only"**
   - Toggle "Show Order-Specific" → OFF
   - Should show only 2 messages:
     - Employment: "Coverage Area Expansion Opportunity"
     - Availability: "Availability Update - March 2026"

### Test 4: Appraiser Communication History

1. **Navigate to Appraiser Profile**
   - Go to: http://localhost:3010/appraisers/appraiser-fl-res-11111

2. **Open Communications Tray**
   - Should show ALL 8 messages (appraiser is involved in all)
   - Filter by category → Should work
   - Search functionality → Should work

### Test 5: Thread View

1. **In any History tab, find a message with a thread indicator**
   - Should see "Thread: [id substring]" chip
2. **Click "View Thread"** (future feature - may not exist yet)
3. **Expected:** All messages in that conversation grouped chronologically

### Test 6: Business Impact Indicators

1. **Look for messages with warning badges:**
   - "⚠️ ACTION REQUIRED by [date]"
   - Red/orange badges for urgent/high priority
2. **Verify deadline tracking:**
   - Messages approaching deadline should be highlighted
   - Overdue actions should show error state

---

## 🐛 TROUBLESHOOTING

### Backend Issues

**Error: "Resource Not Found" for communications container**
```
✗ Container doesn't exist
→ Run Step 1 (Deploy infrastructure)
→ Verify with Step 2 (Check containers)
```

**Error: "PartitionKey value must be supplied for this operation"**
```
✗ Missing tenantId in request
→ Check authentication middleware
→ Verify JWT contains tenant claim
```

**Error: "Query exceeded maximum execution time"**
```
✗ Missing indexes or inefficient query
→ Verify Bicep module has all 7 composite indexes
→ Check RU allocation (should be 400 RU/s)
```

### Frontend Issues

**History tab shows "No communications found"**
```
✗ Possible causes:
1. Seed data not run → Run seed script
2. Wrong orderId → Check URL parameter matches seed data
3. Backend not running → Start backend (npm run dev)
4. CORS error → Check browser console
```

**Send button disabled**
```
✗ Missing required fields:
- Email: Must have To, Subject, Body
- SMS: Must have To, Body (≤160 chars)
```

**"Failed to load communication history" error**
```
✗ Backend endpoint error
→ Open browser DevTools → Network tab
→ Check API response for error details
→ Verify authentication token is valid
```

---

## 📊 SUCCESS CRITERIA

All must be ✅ before considering deployment successful:

### Backend
- [ ] Containers exist in Cosmos DB
- [ ] Backend starts without errors
- [ ] GET `/api/communications/order/:orderId` returns data
- [ ] POST `/api/communications/email` creates record
- [ ] All 5 query endpoints respond correctly

### Frontend
- [ ] Communications tray opens
- [ ] History tab shows seeded data
- [ ] Filters work (channel, category, search)
- [ ] Send tab opens dialog
- [ ] Email can be sent successfully
- [ ] New communication appears in History immediately

### Integration
- [ ] Order context auto-filters communications
- [ ] Badge shows correct unread count
- [ ] Thread grouping works
- [ ] Business impact indicators display
- [ ] No console errors

---

## 🎯 NEXT STEPS AFTER SUCCESSFUL DEPLOYMENT

1. **Integrate with Real Email Service**
   - Currently using mock/logging
   - Add SendGrid / Azure Communication Services
   - Configure templates

2. **Add Real-Time Updates**
   - WebSocket for new message notifications
   - Update badge count in real-time
   - Show "New message" indicator

3. **Add More UI Features**
   - Reply inline from History tab
   - Attachment support
   - Rich text editor for email
   - SMS character counter

4. **Production Deployment**
   - Update to production resource group
   - Configure monitoring/alerts
   - Set up retention policies
   - Scale RU/s based on load

---

## 📞 SUPPORT

If deployment fails or tests don't pass:
1. Check GitHub Actions logs
2. Review Azure deployment errors in portal
3. Check backend logs: `npm run dev` output
4. Check browser console for frontend errors
5. Review this checklist step-by-step

**Environment Variables Required:**
```env
# Backend (.env)
AZURE_COSMOS_ENDPOINT=https://appraisal-mgmt-staging-cosmos.documents.azure.com:443/
AZURE_COSMOS_DATABASE_NAME=appraisal-management
NODE_ENV=development

# Frontend (.env)
VITE_API_URL=http://localhost:3011
VITE_ACS_ENDPOINT=[optional - for ACS features]
```
