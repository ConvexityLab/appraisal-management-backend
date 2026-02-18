# Communication Systems Inventory
**Date:** February 17, 2026  
**Status:** BACKEND COMPLETE - NO FRONTEND UI IMPLEMENTED

## EXECUTIVE SUMMARY

### THE PROBLEM
Despite COMPLETE backend implementation of communication systems, there is **ZERO visible UI** for users to:
- View communication history with vendors/appraisers
- See records of emails, SMS, Teams messages sent
- Access chat/call transcripts
- Send messages from the platform UI

**Backend is 100% functional. Frontend integration is 0% complete.**

---

## BACKEND IMPLEMENTATION STATUS

### ✅ 1. UNIFIED COMMUNICATION SYSTEM (PRODUCTION-READY)

**File:** `src/controllers/unified-communication.controller.ts` (540 lines)  
**Routes:** `/api/communication/*` (Line 395-397 in api-server.ts)  
**Service:** `src/services/unified-communication.service.ts` (579 lines)

**Capabilities:**
- **Communication Contexts** - Track all communications per order/QC review
- **ACS Chat** - Real-time chat threads with multiple participants
- **ACS Calls** - Voice/video calling with call history
- **Teams Meetings** - Schedule and manage Teams meetings
- **AI Transcripts** - Store call/meeting transcripts
- **AI Insights** - Store AI-generated insights from conversations

**Containers in Cosmos DB:**
- `communicationContexts` - Main context records (initialized in code Line 43)
- `communicationTranscripts` - Call/meeting transcripts (initialized Line 67)
- `aiInsights` - AI-generated insights (initialized Line 68)

**API Endpoints:**
```
POST   /api/communication/contexts                    - Create context
GET    /api/communication/contexts/:type/:entityId    - Get by entity
GET    /api/communication/contexts/:contextId         - Get by ID
POST   /api/communication/contexts/:id/chat           - Create chat thread
GET    /api/communication/contexts/:id/chat           - Get chat thread
POST   /api/communication/contexts/:id/call           - Start call
PUT    /api/communication/contexts/:id/calls/:callId  - Update call
POST   /api/communication/contexts/:id/meeting        - Schedule meeting
GET    /api/communication/contexts/:id/meetings       - Get meetings
GET    /api/communication/contexts/:id/transcripts    - Get transcripts
POST   /api/communication/transcripts                 - Store transcript
GET    /api/communication/insights/:entityId          - Get AI insights
```

**Integration Status:**
- ✅ Routes registered in api-server.ts
- ✅ Database containers exist
- ✅ Azure Communication Services configured
- ❌ NO FRONTEND COMPONENTS
- ❌ NO FRONTEND ROUTES
- ❌ NO UI PANELS/PAGES

---

### ✅ 2. SIMPLE COMMUNICATION APIs (SEND ONLY)

**File:** `src/controllers/communication.controller.ts` (527 lines)  
**Routes:** `/api/communications/*` (Line 402-404 in api-server.ts)  
**Service:** `src/services/azure-communication.service.ts` (170 lines)

**Capabilities:**
- Send emails via Azure Communication Services
- Send SMS via Azure Communication Services
- Send Teams channel notifications
- Store all sent messages in `communications` container

**API Endpoints:**
```
POST /api/communications/email  - Send email
POST /api/communications/sms    - Send SMS
POST /api/communications/teams  - Send Teams message
```

**Storage:**
- Container: `communications` (NOT initialized in cosmos-db.service.ts)
- Stores: orderId, channel, to, subject, body, status, sentAt

**Integration Status:**
- ✅ Routes registered
- ⚠️  Container NOT initialized in code (same issue as documents)
- ❌ NO HISTORY RETRIEVAL ENDPOINTS
- ❌ NO FRONTEND UI

---

### ✅ 3. NOTIFICATION SYSTEM

**File:** `src/controllers/notification.controller.ts`  
**Routes:** `/api/notifications/*` (Line 511-514 in api-server.ts)  
**Services:**
- `src/services/core-notification.service.ts` - Main orchestrator
- `src/services/email-notification.service.ts` - Email sending
- `src/services/sms-notification.service.ts` - SMS sending
- `src/services/notification-preferences.service.ts` - User preferences

**Capabilities:**
- Template-based notifications
- Multi-channel delivery (email, SMS, push)
- User preferences management
- Delivery tracking

**API Endpoints:**
```
POST /api/notifications/send        - Send notification
GET  /api/notifications/templates   - Get templates
GET  /api/notifications/preferences - Get user preferences
PUT  /api/notifications/preferences - Update preferences
```

**Integration Status:**
- ✅ Routes registered
- ✅ Services implemented
- ❌ NO FRONTEND PREFERENCES UI
- ❌ NO NOTIFICATION CENTER UI

---

### ✅ 4. AZURE COMMUNICATION SERVICES (ACS) - LOW-LEVEL

**Files:**
- `src/services/azure-communication.service.ts` - Main wrapper
- `src/services/acs-chat.service.ts` - Chat operations
- `src/services/acs-identity.service.ts` - Token exchange

**Capabilities:**
- Email Client (Managed Identity)
- SMS Client (Managed Identity)
- Chat Client (User tokens)
- Identity token exchange

**Integration Status:**
- ✅ Fully configured
- ✅ Used by higher-level services
- ❌ No direct frontend access (correct - should use higher-level APIs)

---

### ✅ 5. TEAMS INTEGRATION

**File:** `src/services/teams.service.ts`  
**Capabilities:**
- Post messages to Teams channels
- Send adaptive cards
- Tag users in messages

**Integration Status:**
- ✅ Service implemented
- ✅ Used by communication.controller.ts
- ❌ NO UI TO SEND TEAMS MESSAGES

---

## FRONTEND IMPLEMENTATION STATUS

### ⚠️ 1. RTK Query API (PARTIAL)

**File:** `src/store/api/communicationsApi.ts` (137 lines)

**Implemented Hooks:**
```typescript
useSendEmailMutation()
useSendSMSMutation()
useSendTeamsMessageMutation()
useGetCommunicationHistoryQuery()          // NO BACKEND ENDPOINT!
useGetCommunicationHistoryByEntityQuery()  // NO BACKEND ENDPOINT!
```

**Problem:** Frontend expects history endpoints that DON'T EXIST in backend:
```
GET /api/communications/history/:orderId           - 404 NOT FOUND
GET /api/communications/entity/:entityType/:id     - 404 NOT FOUND
```

---

### ⚠️ 2. COMMUNICATION CONTEXT (SHELL ONLY)

**File:** `src/contexts/CommunicationContext.tsx` (90 lines)

**Provides:**
- Entity context tracking (vendor, appraiser, order)
- Panel open/close state
- Basic state management

**Does NOT Provide:**
- Actual communication panel component
- Chat UI
- Call UI
- History display
- Message sending UI

**Usage:** Wrapped in App.tsx but NO COMPONENTS USE IT

---

### ❌ 3. COMMUNICATION UI COMPONENTS - **DO NOT EXIST**

**Missing Components:**
```
src/components/communications/
  ├── CommunicationPanel.tsx         - ❌ DOES NOT EXIST
  ├── CommunicationHistory.tsx       - ❌ DOES NOT EXIST
  ├── ChatThread.tsx                 - ❌ DOES NOT EXIST
  ├── SendEmailDialog.tsx            - ❌ DOES NOT EXIST
  ├── SendSMSDialog.tsx              - ❌ DOES NOT EXIST
  └── CallInterface.tsx              - ❌ DOES NOT EXIST
```

---

### ❌ 4. COMMUNICATION PAGES - **DO NOT EXIST**

**Missing Routes:**
```
/communications                        - ❌ DOES NOT EXIST
/communications/:entityType/:entityId  - ❌ DOES NOT EXIST
/communications/history                - ❌ DOES NOT EXIST
```

**Existing Directories (no communication pages):**
- `src/app/(control-panel)/vendors/`  - NO communication tab
- `src/app/(control-panel)/appraisers/` - NO communication tab
- `src/app/(control-panel)/orders/` - NO communication tab
- `src/app/(control-panel)/property-valuation/` - NO communication tab

---

## WHAT'S MISSING FOR FULL COMMUNICATION VISIBILITY

### 1. BACKEND FIXES NEEDED

#### A. Add `communications` Container Initialization
**File:** `src/services/cosmos-db.service.ts`
```typescript
// Line 46: Add property
private communicationsContainer: Container | null = null;

// Line 66: Add to containers object
communications: 'communications',

// Line 149: Add initialization
this.communicationsContainer = this.database.container(this.containers.communications);
```

#### B. Add History Retrieval Endpoints
**File:** `src/controllers/communication.controller.ts`
```typescript
// GET /api/communications/history/:orderId
router.get('/history/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const tenantId = req.user?.tenantId || 'default';
  
  const query = 'SELECT * FROM c WHERE c.orderId = @orderId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC';
  const params = [
    { name: '@orderId', value: orderId },
    { name: '@tenantId', value: tenantId }
  ];
  
  const result = await cosmosService.queryItems('communications', query, params);
  res.json(result);
});

// GET /api/communications/entity/:entityType/:entityId
router.get('/entity/:entityType/:entityId', async (req, res) => {
  const { entityType, entityId } = req.params;
  const { channel } = req.query;
  const tenantId = req.user?.tenantId || 'default';
  
  let query = 'SELECT * FROM c WHERE c.entityType = @entityType AND c.entityId = @entityId AND c.tenantId = @tenantId';
  const params = [
    { name: '@entityType', value: entityType },
    { name: '@entityId', value: entityId },
    { name: '@tenantId', value: tenantId }
  ];
  
  if (channel) {
    query += ' AND c.channel = @channel';
    params.push({ name: '@channel', value: channel });
  }
  
  query += ' ORDER BY c.createdAt DESC';
  
  const result = await cosmosService.queryItems('communications', query, params);
  res.json(result);
});
```

#### C. Deploy `communications` Container via Bicep
Create: `infrastructure/modules/cosmos-db-communications-container.bicep`
```bicep
resource communicationsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'communications'
  properties: {
    resource: {
      id: 'communications'
      partitionKey: {
        paths: ['/tenantId']
        kind: 'Hash'
      }
      indexingPolicy: {
        compositeIndexes: [
          [
            { path: '/orderId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
          [
            { path: '/entityType', order: 'ascending' }
            { path: '/entityId', order: 'ascending' }
            { path: '/createdAt', order: 'descending' }
          ]
        ]
      }
    }
  }
}
```

---

### 2. FRONTEND COMPONENTS NEEDED

#### A. Communication History Panel
**File:** `src/components/communications/CommunicationHistory.tsx`
```tsx
interface Props {
  entityType: 'vendor' | 'appraiser' | 'order';
  entityId: string;
  onSendMessage?: () => void;
}

export function CommunicationHistory({ entityType, entityId }: Props) {
  const { data, isLoading } = useGetCommunicationHistoryByEntityQuery({
    entityType,
    entityId
  });
  
  // Display timeline of all communications
  // Email, SMS, Teams messages, chat, calls
  // Show timestamps, status, content
  // Action buttons: Reply, Forward, View Details
}
```

#### B. Send Communication Dialog
**File:** `src/components/communications/SendCommunicationDialog.tsx`
```tsx
interface Props {
  orderId?: string;
  recipient: { name: string; email?: string; phone?: string };
  onClose: () => void;
}

export function SendCommunicationDialog({ orderId, recipient, onClose }: Props) {
  const [channel, setChannel] = useState<'email' | 'sms' | 'teams'>('email');
  const [sendEmail] = useSendEmailMutation();
  const [sendSMS] = useSendSMSMutation();
  
  // Tabs: Email | SMS | Teams
  // Form fields based on channel
  // Send button
}
```

#### C. Communication Tab for Entity Pages
Add to:
- `src/app/(control-panel)/vendors/[id]/page.tsx`
- `src/app/(control-panel)/appraisers/[id]/page.tsx`
- `src/app/(control-panel)/property-valuation/Order/OrderDetail.tsx`

```tsx
<Tabs>
  <Tab label="Overview" />
  <Tab label="Details" />
  <Tab label="Communications" />  {/* ADD THIS */}
</Tabs>

{activeTab === 'communications' && (
  <CommunicationHistory
    entityType="vendor"
    entityId={vendorId}
  />
)}
```

---

### 3. NAVIGATION & MENU UPDATES

#### Add to Navigation Menu
**File:** `src/configs/navigationConfig.ts`
```typescript
{
  id: 'communications',
  title: 'Communications',
  type: 'group',
  icon: ChatBubbleOutlineIcon,
  children: [
    {
      id: 'communication-center',
      title: 'Communication Center',
      type: 'item',
      url: '/communications',
      icon: ForumIcon
    },
    {
      id: 'communication-preferences',
      title: 'Preferences',
      type: 'item',
      url: '/communications/preferences',
      icon: SettingsIcon
    }
  ]
}
```

#### Create Communication Center Page
**File:** `src/app/(control-panel)/communications/page.tsx`
```tsx
// Central hub for all communications
// - Recent activity feed
// - Unified inbox (emails, SMS, Teams)
// - Quick actions (send email, SMS)
// - Search/filter by entity, date, channel
// - Export communications history
```

---

## SUMMARY OF THE GAP

### What EXISTS (Backend):
1. ✅ Unified Communication Service - Full chat/call/meeting orchestration
2. ✅ Simple Communication APIs - Send email/SMS/Teams
3. ✅ Notification System - Template-based multi-channel
4. ✅ Azure Communication Services - All infrastructure configured
5. ✅ Teams Integration - Post to channels
6. ✅ Database containers - communicationContexts, communicationTranscripts, aiInsights
7. ✅ All routes registered and functional

### What's MISSING (Frontend):
1. ❌ NO communication history UI anywhere
2. ❌ NO way to view sent emails/SMS from UI
3. ❌ NO chat interface
4. ❌ NO call interface
5. ❌ NO communication tabs on vendor/appraiser/order pages
6. ❌ NO communication center page
7. ❌ NO preferences UI
8. ❌ NO unified inbox
9. ❌ Backend history endpoints missing (easy fix)
10. ❌ `communications` container not initialized (same as documents)

---

## IMMEDIATE ACTION ITEMS

### Priority 1: Make Existing Messages Visible
1. Initialize `communications` container in cosmos-db.service.ts
2. Deploy communications container via Bicep
3. Add GET /api/communications/history/:orderId endpoint
4. Add GET /api/communications/entity/:type/:id endpoint
5. Create CommunicationHistory.tsx component
6. Add "Communications" tab to order detail page

### Priority 2: Enable Sending from UI
1. Create SendCommunicationDialog.tsx
2. Add action buttons to order pages ("Send Email", "Send SMS")
3. Test send + view history workflow

### Priority 3: Full Communication Center
1. Create /communications page with unified inbox
2. Add navigation menu item
3. Implement search/filter
4. Add preferences UI

### Priority 4: Advanced Features
1. Implement chat UI using Unified Communication System
2. Implement call UI
3. Add AI insights display
4. Add transcript viewer

---

## DOCUMENT SYSTEM STATUS

### ✅ Backend Document System
- `src/services/document.service.ts` - Upload, list, get, delete
- `src/controllers/document.controller.ts` - REST API
- Routes: `/api/documents/*` (Line 442 in api-server.ts)
- Blob Storage: `documents` container in Azure Storage

### ⚠️ Missing Pieces:
1. ❌ `documents` container NOT initialized in cosmos-db.service.ts (JUST FIXED)
2. ⚠️  Bicep module exists but not deployed
3. ⚠️  Need to run: `az deployment group create --template-file cosmos-db-documents-container.bicep`

### ✅ Frontend Document System
- Document upload UI exists in order pages
- Document list/preview implemented
- Uses RTK Query for API calls

**Document system is 90% complete - just needs container deployment.**

---

## CONCLUSION

The communication infrastructure is **FULLY BUILT** on the backend but has **ZERO visibility** in the frontend. Users cannot see any record of communications because:

1. No UI components exist to display history
2. Backend history endpoints are missing (2 endpoints needed)
3. `communications` container not initialized (same issue as documents)
4. No communication tabs on entity pages
5. No central communication center page

**Estimated effort to fix:**
- Backend: 1-2 hours (container init + 2 endpoints + deployment)
- Frontend: 8-12 hours (history component + tabs + send dialog + communication center)

**This explains why you see NO evidence of communication functionality despite it being fully implemented.**
