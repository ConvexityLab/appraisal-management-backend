# Communication Storage Architecture
**Date:** February 17, 2026  
**Status:** DESIGN PROPOSAL - COMPREHENSIVE COMMUNICATION SYSTEM

---

## USE CASE ANALYSIS

### Primary Communication Scenarios

#### 1. Order-Specific Communications
**Examples:**
- "Can you deliver this appraisal by Friday instead of Monday?"
- "The property has restricted access, here's the gate code"
- "Client wants to negotiate the fee from $550 to $500"
- "Revision needed - comparable #3 is too far from subject"
- "When will the final report be ready?"

**Characteristics:**
- Always tied to a specific `orderId`
- Forms a conversation thread about that order
- May involve multiple participants (AMC staff, appraiser, client, underwriter)
- Must be visible on order detail page
- May span days/weeks as order progresses

#### 2. Vendor/Appraiser Relationship Communications
**Examples:**
- "Are you available for rush orders this week?"
- "Can you cover assignments in Orange County?"
- "Your W9 is expiring, please resubmit"
- "We're updating payment terms to Net-15"
- "Congratulations on your promotion to Senior Appraiser"
- "Can you take on 5 more orders this month?"

**Characteristics:**
- Related to `vendorId` or `appraiserId`, NOT a specific order
- Builds ongoing relationship history
- May result in future order assignments
- Must be visible on vendor/appraiser profile page
- Can span months/years

#### 3. Employment & Availability
**Examples:**
- "I'll be on vacation Aug 1-15, please don't assign orders"
- "I'm now licensed in Nevada in addition to California"
- "My hourly rate is increasing to $125/hr effective next month"
- "Can I get access to the new AI tools?"

**Characteristics:**
- Related to vendor/appraiser profile
- May affect future assignments
- Should trigger profile updates
- Administrative/HR nature

#### 4. Multi-Entity Threads
**Examples:**
- Negotiation about Order-123 involving Vendor-456 and Client-789
- QC review discussion about Order-123 involving Appraiser, QC Reviewer, and AMC Manager
- Escalation about Order-123 CC'ing multiple stakeholders

**Characteristics:**
- Primary entity (usually order)
- Multiple related entities
- Complex participant list
- May branch into sub-conversations

---

## PROPOSED STORAGE STRUCTURE

### Container: `communications`

**Partition Key:** `/tenantId` (for multi-tenancy and performance)

### Document Schema

```typescript
interface CommunicationRecord {
  // ============================================================================
  // CORE IDENTIFICATION
  // ============================================================================
  id: string;                          // Unique message ID
  tenantId: string;                    // Partition key
  type: 'communication';               // Document type marker
  
  // ============================================================================
  // ENTITY RELATIONSHIPS
  // ============================================================================
  primaryEntity: {
    type: 'order' | 'vendor' | 'appraiser' | 'client' | 'user' | 'general';
    id: string;                        // Primary entity this is about
    name?: string;                     // Display name for UI
  };
  
  relatedEntities: Array<{             // Additional entities involved
    type: 'order' | 'vendor' | 'appraiser' | 'client' | 'user';
    id: string;
    role?: string;                     // 'participant', 'cc', 'mentioned'
  }>;
  
  // ============================================================================
  // CONVERSATION THREADING
  // ============================================================================
  threadId?: string;                   // Groups related messages
  parentMessageId?: string;            // For replies/responses
  conversationContext: string;         // 'order_discussion' | 'negotiation' | 'availability' | 'employment' | 'general'
  
  // ============================================================================
  // CHANNEL & DELIVERY
  // ============================================================================
  channel: 'email' | 'sms' | 'teams' | 'chat' | 'phone' | 'in_app';
  direction: 'outbound' | 'inbound';   // Sent by us or received
  
  // Participants
  from: {
    id?: string;                       // User/Vendor/System ID
    name: string;
    email?: string;
    phone?: string;
    role?: string;                     // 'amc_staff' | 'appraiser' | 'vendor' | 'client' | 'system'
  };
  
  to: Array<{
    id?: string;
    name: string;
    email?: string;
    phone?: string;
    role?: string;
  }>;
  
  cc?: Array<{
    id?: string;
    name: string;
    email?: string;
  }>;
  
  bcc?: Array<{
    id?: string;
    name: string;
    email?: string;
  }>;
  
  // ============================================================================
  // MESSAGE CONTENT
  // ============================================================================
  subject?: string;                    // For email, Teams
  body: string;                        // Message content
  bodyFormat: 'text' | 'html' | 'markdown';
  
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
  }>;
  
  // ============================================================================
  // STATUS & TRACKING
  // ============================================================================
  status: 'draft' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
  
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  
  deliveryStatus?: {
    messageId?: string;                // External system message ID
    provider?: string;                 // 'azure_acs' | 'teams' | 'twilio'
    attempts?: number;
    lastAttemptAt?: Date;
    error?: string;
  };
  
  // ============================================================================
  // CATEGORIZATION & SEARCH
  // ============================================================================
  category: 
    | 'order_assignment'
    | 'order_discussion'
    | 'negotiation'
    | 'payment'
    | 'document_request'
    | 'revision_request'
    | 'deadline_reminder'
    | 'availability'
    | 'employment'
    | 'onboarding'
    | 'training'
    | 'compliance'
    | 'general';
  
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  tags?: string[];                     // ['rush', 'fee_negotiation', 'complex_property']
  
  sentiment?: 'positive' | 'neutral' | 'negative';  // AI-detected
  
  // ============================================================================
  // BUSINESS CONTEXT
  // ============================================================================
  businessImpact?: {
    affectsDeadline?: boolean;
    requiresAction?: boolean;
    actionDeadline?: Date;
    estimatedResponseTime?: string;    // ISO duration
    escalationLevel?: number;
  };
  
  // ============================================================================
  // AI INSIGHTS
  // ============================================================================
  aiAnalysis?: {
    summary?: string;                  // Auto-generated summary
    actionItems?: Array<{
      description: string;
      assignedTo?: string;
      dueDate?: Date;
      status: 'pending' | 'completed';
    }>;
    detectedIssues?: string[];
    suggestedResponse?: string;
    confidence?: number;
  };
  
  // ============================================================================
  // METADATA
  // ============================================================================
  metadata?: {
    source?: string;                   // 'api' | 'automation' | 'webhook' | 'manual'
    triggeredBy?: string;              // Event or workflow that triggered this
    templateId?: string;               // If sent from template
    campaignId?: string;               // If part of bulk communication
    [key: string]: any;
  };
  
  // ============================================================================
  // AUDIT & COMPLIANCE
  // ============================================================================
  createdBy: string;                   // User ID who sent or received
  createdAt: Date;
  updatedAt?: Date;
  
  archived?: boolean;
  archiveReason?: string;
  archivedAt?: Date;
  archivedBy?: string;
  
  legalHold?: boolean;                 // For compliance/litigation
  retentionPolicyId?: string;
}
```

---

## INDEXING STRATEGY

### Composite Indexes (for fast queries)

```typescript
const compositeIndexes = [
  // 1. Order-specific communications (most common query)
  [
    { path: '/primaryEntity/type', order: 'ascending' },
    { path: '/primaryEntity/id', order: 'ascending' },
    { path: '/createdAt', order: 'descending' }
  ],
  
  // 2. Vendor/Appraiser history
  [
    { path: '/primaryEntity/type', order: 'ascending' },
    { path: '/primaryEntity/id', order: 'ascending' },
    { path: '/category', order: 'ascending' },
    { path: '/createdAt', order: 'descending' }
  ],
  
  // 3. Thread/conversation grouping
  [
    { path: '/threadId', order: 'ascending' },
    { path: '/createdAt', order: 'ascending' }
  ],
  
  // 4. Related entities lookup
  [
    { path: '/relatedEntities[]/type', order: 'ascending' },
    { path: '/relatedEntities[]/id', order: 'ascending' },
    { path: '/createdAt', order: 'descending' }
  ],
  
  // 5. Status/action tracking
  [
    { path: '/businessImpact/requiresAction', order: 'ascending' },
    { path: '/businessImpact/actionDeadline', order: 'ascending' }
  ],
  
  // 6. Category + status
  [
    { path: '/category', order: 'ascending' },
    { path: '/status', order: 'ascending' },
    { path: '/createdAt', order: 'descending' }
  ]
];
```

---

## QUERY PATTERNS

### 1. Get All Communications for an Order
```typescript
const query = `
  SELECT * FROM c 
  WHERE c.type = 'communication'
    AND c.primaryEntity.type = 'order'
    AND c.primaryEntity.id = @orderId
    AND c.tenantId = @tenantId
  ORDER BY c.createdAt DESC
`;
```

### 2. Get Vendor Relationship History (excluding order-specific)
```typescript
const query = `
  SELECT * FROM c 
  WHERE c.type = 'communication'
    AND c.primaryEntity.type = 'vendor'
    AND c.primaryEntity.id = @vendorId
    AND c.tenantId = @tenantId
  ORDER BY c.createdAt DESC
`;
```

### 3. Get All Communications Involving a Vendor (including as participant)
```typescript
const query = `
  SELECT * FROM c 
  WHERE c.type = 'communication'
    AND c.tenantId = @tenantId
    AND (
      (c.primaryEntity.type = 'vendor' AND c.primaryEntity.id = @vendorId)
      OR ARRAY_CONTAINS(c.relatedEntities, {type: 'vendor', id: @vendorId}, true)
    )
  ORDER BY c.createdAt DESC
`;
```

### 4. Get Conversation Thread
```typescript
const query = `
  SELECT * FROM c 
  WHERE c.type = 'communication'
    AND c.threadId = @threadId
    AND c.tenantId = @tenantId
  ORDER BY c.createdAt ASC
`;
```

### 5. Get Communications Requiring Action
```typescript
const query = `
  SELECT * FROM c 
  WHERE c.type = 'communication'
    AND c.tenantId = @tenantId
    AND c.businessImpact.requiresAction = true
    AND c.businessImpact.actionDeadline >= @now
  ORDER BY c.businessImpact.actionDeadline ASC
`;
```

### 6. Search Communications by Content
```typescript
// Uses Cosmos DB full-text search capability
const query = `
  SELECT * FROM c 
  WHERE c.type = 'communication'
    AND c.tenantId = @tenantId
    AND (
      CONTAINS(c.subject, @searchTerm, true)
      OR CONTAINS(c.body, @searchTerm, true)
    )
  ORDER BY c.createdAt DESC
`;
```

---

## MIGRATION PLAN

### Phase 1: Create Infrastructure

1. **Create Bicep Module:** `cosmos-db-communications-container.bicep`
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
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [{ path: '/*' }]
        excludedPaths: [
          { path: '/"_etag"/?' }
          { path: '/body/?' }  // Don't index large text fields
        ]
        compositeIndexes: [
          // Add all indexes from above
        ]
      }
      defaultTtl: -1  // No auto-expiration, manage via archival process
    }
  }
}
```

2. **Deploy Container**
```bash
az deployment group create \
  --resource-group appraisal-mgmt-staging-rg \
  --template-file cosmos-db-communications-container.bicep \
  --parameters cosmosAccountName=appraisal-mgmt-staging-cosmos \
               databaseName=appraisal-management \
               location=eastus
```

3. **Initialize in Code** - Already done in previous commit:
```typescript
// cosmos-db.service.ts
private communicationsContainer: Container | null = null;
this.communicationsContainer = this.database.container('communications');
```

### Phase 2: Update Communication Controller

**File:** `src/controllers/communication.controller.ts`

Replace simple `CommunicationMessage` interface with comprehensive `CommunicationRecord`:

```typescript
import { CommunicationRecord } from '../types/communication.types';

// Update storeCommunication to use proper structure
async function storeCommunication(
  channel: 'email' | 'sms' | 'teams',
  orderId: string | undefined,
  primaryEntity: { type: string; id: string; name?: string },
  from: any,
  to: any,
  subject: string | undefined,
  body: string,
  status: string,
  tenantId: string,
  createdBy: string,
  category: string,
  metadata?: any
): Promise<CommunicationRecord> {
  
  const record: CommunicationRecord = {
    id: `${channel}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tenantId,
    type: 'communication',
    
    primaryEntity,
    relatedEntities: [],  // Add based on context
    
    conversationContext: category,
    
    channel,
    direction: 'outbound',
    
    from,
    to: Array.isArray(to) ? to : [to],
    
    subject,
    body,
    bodyFormat: 'html',
    
    status: status as any,
    sentAt: status === 'sent' ? new Date() : undefined,
    
    category: category as any,
    priority: 'normal',
    
    deliveryStatus: metadata,
    
    createdBy,
    createdAt: new Date()
  };
  
  await cosmosService.createItem('communications', record);
  return record;
}
```

**Update POST /email endpoint:**
```typescript
router.post('/email', async (req, res) => {
  const { orderId, to, subject, body, primaryEntity, category = 'order_discussion' } = req.body;
  
  // Determine primary entity
  const entity = primaryEntity || {
    type: orderId ? 'order' : 'general',
    id: orderId || 'general',
    name: orderId
  };
  
  // Send email...
  
  // Store with proper structure
  const record = await storeCommunication(
    'email',
    orderId,
    entity,
    { name: 'Appraisal Management', email: from },
    { email: to },
    subject,
    body,
    'sent',
    tenantId,
    req.user?.id || 'system',
    category,
    { messageId: result.messageId }
  );
  
  res.json({ success: true, data: record });
});
```

### Phase 3: Add Comprehensive Query Endpoints

```typescript
/**
 * GET /api/communications/order/:orderId
 * All communications about a specific order
 */
router.get('/order/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { includeRelated } = req.query;  // Include where order is in relatedEntities
  
  let query = `
    SELECT * FROM c 
    WHERE c.type = 'communication'
      AND c.tenantId = @tenantId
  `;
  
  if (includeRelated === 'true') {
    query += ` AND (
      (c.primaryEntity.type = 'order' AND c.primaryEntity.id = @orderId)
      OR ARRAY_CONTAINS(c.relatedEntities, {type: 'order', id: @orderId}, true)
    )`;
  } else {
    query += ` AND c.primaryEntity.type = 'order' AND c.primaryEntity.id = @orderId`;
  }
  
  query += ` ORDER BY c.createdAt DESC`;
  
  const result = await cosmosService.queryItems('communications', query, [
    { name: '@tenantId', value: tenantId },
    { name: '@orderId', value: orderId }
  ]);
  
  res.json(result);
});

/**
 * GET /api/communications/vendor/:vendorId
 * All communications with/about a vendor
 */
router.get('/vendor/:vendorId', async (req, res) => {
  const { vendorId } = req.params;
  const { category, excludeOrderSpecific } = req.query;
  
  let query = `
    SELECT * FROM c 
    WHERE c.type = 'communication'
      AND c.tenantId = @tenantId
      AND (
        (c.primaryEntity.type = 'vendor' AND c.primaryEntity.id = @vendorId)
        OR ARRAY_CONTAINS(c.relatedEntities, {type: 'vendor', id: @vendorId}, true)
      )
  `;
  
  if (excludeOrderSpecific === 'true') {
    query += ` AND c.primaryEntity.type != 'order'`;
  }
  
  if (category) {
    query += ` AND c.category = @category`;
  }
  
  query += ` ORDER BY c.createdAt DESC`;
  
  const params = [
    { name: '@tenantId', value: tenantId },
    { name: '@vendorId', value: vendorId }
  ];
  
  if (category) {
    params.push({ name: '@category', value: category });
  }
  
  const result = await cosmosService.queryItems('communications', query, params);
  res.json(result);
});

/**
 * GET /api/communications/thread/:threadId
 * Get entire conversation thread
 */
router.get('/thread/:threadId', async (req, res) => {
  const { threadId } = req.params;
  
  const query = `
    SELECT * FROM c 
    WHERE c.type = 'communication'
      AND c.threadId = @threadId
      AND c.tenantId = @tenantId
    ORDER BY c.createdAt ASC
  `;
  
  const result = await cosmosService.queryItems('communications', query, [
    { name: '@tenantId', value: tenantId },
    { name: '@threadId', value: threadId }
  ]);
  
  res.json(result);
});

/**
 * POST /api/communications/search
 * Advanced search with multiple criteria
 */
router.post('/search', async (req, res) => {
  const {
    entityType,
    entityId,
    category,
    channel,
    dateFrom,
    dateTo,
    searchTerm,
    requiresAction
  } = req.body;
  
  let conditions = ['c.type = \'communication\'', 'c.tenantId = @tenantId'];
  const params = [{ name: '@tenantId', value: tenantId }];
  
  if (entityType && entityId) {
    conditions.push('(c.primaryEntity.type = @entityType AND c.primaryEntity.id = @entityId)');
    params.push(
      { name: '@entityType', value: entityType },
      { name: '@entityId', value: entityId }
    );
  }
  
  if (category) {
    conditions.push('c.category = @category');
    params.push({ name: '@category', value: category });
  }
  
  if (channel) {
    conditions.push('c.channel = @channel');
    params.push({ name: '@channel', value: channel });
  }
  
  if (dateFrom) {
    conditions.push('c.createdAt >= @dateFrom');
    params.push({ name: '@dateFrom', value: dateFrom });
  }
  
  if (dateTo) {
    conditions.push('c.createdAt <= @dateTo');
    params.push({ name: '@dateTo', value: dateTo });
  }
  
  if (searchTerm) {
    conditions.push('(CONTAINS(c.subject, @searchTerm, true) OR CONTAINS(c.body, @searchTerm, true))');
    params.push({ name: '@searchTerm', value: searchTerm });
  }
  
  if (requiresAction) {
    conditions.push('c.businessImpact.requiresAction = true');
  }
  
  const query = `SELECT * FROM c WHERE ${conditions.join(' AND ')} ORDER BY c.createdAt DESC`;
  
  const result = await cosmosService.queryItems('communications', query, params);
  res.json(result);
});
```

---

## UI INTEGRATION POINTS

### 1. Order Detail Page
**Location:** `/property-valuation/[orderId]`

**New Tab:** "Communications"
- Timeline view of all messages
- Filter by: Channel (email/SMS/Teams), Category, Date range
- Quick actions: Send Email, Send SMS
- Thread grouping for conversations
- Status indicators (sent, delivered, read)

### 2. Vendor Profile Page
**Location:** `/vendors/[vendorId]`

**New Tab:** "Communication History"
- Two sections:
  - **Order-Specific:** Communications about orders they worked on
  - **General:** Employment, availability, administrative
- Filter by: Category, Date, Channel
- Quick actions: Send Email, Send SMS, Schedule Call
- Relationship insights: Last contacted, avg response time, sentiment

### 3. Appraiser Profile Page
**Same as Vendor Profile**

### 4. Communication Center
**New Page:** `/communications`

**Features:**
- Unified inbox (all channels)
- Filters: Entity type, Category, Date, Status, Requires Action
- Search across all communications
- Bulk actions
- Export/reporting
- Action queue (messages requiring response)

### 5. Dashboard Widget
**Quick stats:**
- Unread messages
- Action items pending
- Recent communications
- Response time metrics

---

## ADVANCED FEATURES (Future)

### 1. Smart Threading
Auto-detect related messages and group into threads based on:
- Reply-to headers (email)
- Subject line similarity
- Temporal proximity
- Entity overlap
- Content similarity (AI)

### 2. AI Summarization
- Auto-generate summaries of long conversations
- Extract action items
- Detect sentiment shifts
- Suggest responses

### 3. Sentiment Analysis
Track relationship health over time:
- Positive/neutral/negative trend
- Early warning for troubled relationships
- Escalation recommendations

### 4. Communication Preferences
Per vendor/appraiser:
- Preferred channel (email vs SMS)
- Best time to contact
- Response time patterns
- Language preference

### 5. Templates & Automation
- Template library with variables
- Triggered communications (status changes, deadlines)
- Bulk communications with personalization
- Scheduled sends

### 6. Compliance & Retention
- Legal hold flag
- Retention policies by category
- Audit trail
- Export for litigation
- Anonymization for GDPR

---

## IMPLEMENTATION PRIORITY

### Must Have (Now)
1. ✅ Create `communications` container with proper schema
2. ✅ Update storeCommunication to use rich structure
3. ✅ Add query endpoints (order, vendor, thread, search)
4. ✅ Add "Communications" tab to order detail page
5. ✅ Add "Communications" tab to vendor profile page

### Should Have (Next Sprint)
6. Thread grouping logic
7. Communication Center page
8. Search functionality
9. Export/reporting

### Nice to Have (Future)
10. AI summarization
11. Sentiment analysis
12. Smart suggestions
13. Templates
14. Automation rules

---

## COSMOS DB RU ESTIMATION

**Write Operations:**
- ~500 communications/day
- 10 RU per write
- **Total: 5,000 RU/day**

**Read Operations:**
- Order detail page: ~1,000 views/day × 20 RU = 20,000 RU
- Vendor profile: ~200 views/day × 30 RU = 6,000 RU
- Search: ~100 searches/day × 50 RU = 5,000 RU
- **Total: 31,000 RU/day**

**Recommended Throughput:** 400 RU/s shared container (handles 34.5M RU/day)

**Cost:** ~$23/month at 400 RU/s

---

## SUMMARY

This design provides:
✅ **Flexibility** - Store any communication type with rich context  
✅ **Queryability** - Fast lookups by order, vendor, thread, category  
✅ **Scalability** - Proper partitioning and indexing  
✅ **Traceability** - Complete audit trail  
✅ **Intelligence** - Ready for AI enhancement  
✅ **Compliance** - Legal hold and retention support  

**Next Step:** Review and approve design, then implement Phase 1 (infrastructure + basic endpoints).
