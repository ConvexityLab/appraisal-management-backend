# Chat System Architecture Plan

## Overview
Implement a complete Azure Communication Services (ACS) Chat integration for the Appraisal Management Platform, enabling real-time communication between appraisers, QC analysts, managers, and clients.

## 1. Database Schema (Cosmos DB)

### Container: `chatThreads`
```typescript
interface ChatThread {
  id: string;                          // ACS thread ID
  topic: string;                       // Thread topic/title
  contextType: 'order' | 'qc_review' | 'general';
  contextId?: string;                  // Order ID, QC review ID, etc.
  participants: Array<{
    userId: string;                    // Azure AD user ID
    acsUserId: string;                 // ACS communication user ID
    displayName: string;
    role?: string;
    addedAt: Date;
  }>;
  createdBy: string;                   // User ID who created thread
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  tenantId: string;
  metadata?: {
    orderId?: string;
    propertyAddress?: string;
    qcReviewId?: string;
    [key: string]: any;
  };
}
```

## 2. Services Architecture

### New Service: `AcsChatService`
**Location:** `src/services/acs-chat.service.ts`

**Responsibilities:**
- Create and manage ACS chat threads
- Add/remove participants
- Store thread metadata in Cosmos DB
- Map Azure AD users to ACS user IDs
- Handle thread lifecycle

**Key Methods:**
```typescript
class AcsChatService {
  // Thread Management
  async createThread(params: CreateThreadParams): Promise<ChatThread>
  async getThread(threadId: string, tenantId: string): Promise<ChatThread>
  async listUserThreads(userId: string, tenantId: string): Promise<ChatThread[]>
  async deleteThread(threadId: string, tenantId: string): Promise<void>
  
  // Participant Management
  async addParticipant(threadId: string, userId: string, displayName: string): Promise<void>
  async removeParticipant(threadId: string, userId: string): Promise<void>
  async listParticipants(threadId: string): Promise<Participant[]>
  
  // Context-Based Creation
  async createOrderThread(orderId: string, participants: string[]): Promise<ChatThread>
  async createQCReviewThread(qcReviewId: string, participants: string[]): Promise<ChatThread>
}
```

## 3. API Endpoints

### New Controller: `chat.controller.ts`
**Location:** `src/controllers/chat.controller.ts`

**Endpoints:**

#### Create Thread
```
POST /api/chat/threads
Body: {
  topic: string
  contextType: 'order' | 'qc_review' | 'general'
  contextId?: string
  participants: Array<{ userId: string, displayName: string }>
  metadata?: object
}
Response: {
  success: true,
  data: ChatThread
}
```

#### List User Threads
```
GET /api/chat/threads?contextType=order&contextId=123
Response: {
  success: true,
  data: ChatThread[]
}
```

#### Get Thread Details
```
GET /api/chat/threads/:threadId
Response: {
  success: true,
  data: ChatThread
}
```

#### Add Participant
```
POST /api/chat/threads/:threadId/participants
Body: {
  userId: string
  displayName: string
  role?: string
}
Response: {
  success: true
}
```

#### Remove Participant
```
DELETE /api/chat/threads/:threadId/participants/:userId
Response: {
  success: true
}
```

#### Delete Thread
```
DELETE /api/chat/threads/:threadId
Response: {
  success: true
}
```

## 4. Integration Points

### Order Management Integration
**Auto-create threads when:**
- Order is assigned to appraiser
- Order enters QC review
- Client requests communication

**Participants:**
- Order: Client, Appraiser, Assigned Manager
- QC Review: Appraiser, QC Analyst, Reviewer

### QC Review Integration
**Auto-create threads for:**
- QC collaboration between analyst and appraiser
- Escalation discussions with senior reviewers

### User Profile Integration
**Display in UI:**
- Active chat threads badge
- Recent messages count
- Thread context (order, QC review)

## 5. Dependencies

### NPM Packages (Already Installed)
- `@azure/communication-chat` - Chat SDK
- `@azure/communication-identity` - Identity management
- `@azure/core-auth` - Authentication

### Service Dependencies
- `AcsIdentityService` - For user identity mapping
- `CosmosDbService` - For thread persistence
- `UserService` - For user profile lookups
- `OrderService` - For order context
- `QcService` - For QC review context

## 6. Implementation Phases

### Phase 1: Core Chat Service (This Session)
- [ ] Create `AcsChatService` with thread management
- [ ] Implement Cosmos DB schema and operations
- [ ] Add participant management
- [ ] Create test script for thread creation

### Phase 2: REST API (This Session)
- [ ] Create `chat.controller.ts` with all endpoints
- [ ] Add authentication middleware
- [ ] Add authorization checks (participants only)
- [ ] Register routes in `api-server.ts`

### Phase 3: Testing (This Session)
- [ ] Unit tests for `AcsChatService`
- [ ] Integration tests for API endpoints
- [ ] Test script for end-to-end flow
- [ ] Verify thread creation in Azure Portal

### Phase 4: Integration (Future)
- [ ] Auto-create threads for new orders
- [ ] Auto-create threads for QC reviews
- [ ] Add thread context to order/QC views
- [ ] Frontend integration guide

## 7. Testing Strategy

### Test Scripts
```
scripts/test-chat-thread-creation.js  - Create and verify thread
scripts/test-chat-participants.js     - Add/remove participants
scripts/test-chat-integration.js      - End-to-end workflow
```

### Test Scenarios
1. **Create Thread**: Create thread with 2+ participants
2. **Add Participant**: Add user to existing thread
3. **Remove Participant**: Remove user from thread
4. **List Threads**: Get all threads for a user
5. **Delete Thread**: Clean up test threads
6. **Order Integration**: Create thread when order assigned
7. **QC Integration**: Create thread for QC review

## 8. Security Considerations

### Authorization Rules
- Only thread participants can access thread details
- Only thread creator or admin can delete threads
- Only participants can add new participants
- Managers can access all order-related threads
- QC analysts can access all QC-related threads

### Data Privacy
- Thread messages stored in ACS (not Cosmos DB)
- Only thread metadata stored in Cosmos DB
- Respect tenant isolation
- Audit log all thread operations

## 9. Frontend Integration

### Required from Backend
- Thread ID for each order/QC review
- User's ACS identity token (already implemented)
- List of active threads API
- Participant management API

### Frontend Responsibilities
- Use ACS Chat SDK with thread ID
- Display chat UI with messages
- Handle real-time updates
- Show participant list

## 10. Monitoring & Observability

### Logs
- Thread creation/deletion
- Participant additions/removals
- Failed operations
- Authorization denials

### Metrics
- Active threads count
- Threads per order/QC review
- Average participants per thread
- Thread creation rate

## 11. Rollout Plan

### Development (Now)
- Implement core functionality
- Test with mock data
- Verify ACS integration

### Staging
- Test with real orders
- Load testing with multiple threads
- Frontend integration testing

### Production
- Gradual rollout by tenant
- Monitor error rates
- User feedback collection

## Next Steps

1. **Create `AcsChatService`** - Core thread management
2. **Create `chat.controller.ts`** - REST API
3. **Test thread creation** - Verify ACS integration
4. **Document API** - For frontend team
5. **Integration points** - Order/QC auto-creation
