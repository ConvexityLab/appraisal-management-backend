# Unified AI-Powered Communication Platform Architecture

## Vision
Build a comprehensive communication system for the Appraisal Management Platform that unifies chat, calls, and meetings with AI-powered insights, transcription, compliance monitoring, and intelligent automation.

---

## 1. Communication Channels Overview

### A. Text Chat (Persistent Threading)
- Real-time messaging with message history
- Thread-based conversations tied to orders/QC reviews
- Read receipts, typing indicators
- File sharing and image attachments
- **AI Features:**
  - Sentiment analysis
  - Action item extraction
  - Auto-summarization
  - Smart reply suggestions
  - Compliance keyword detection

### B. Voice/Video Calls (Real-Time)
- 1-on-1 and group calls
- Screen sharing capabilities
- Call recording (with consent)
- **AI Features:**
  - Real-time transcription
  - Speaker identification
  - Call summary generation
  - Action items from conversation
  - Key moment highlights

### C. Teams Meetings (Scheduled)
- Calendar integration
- External participant support
- Meeting recording
- **AI Features:**
  - Meeting transcription
  - Participant engagement metrics
  - Meeting summary with action items
  - Follow-up task generation

---

## 2. Unified Database Schema

### Container: `communicationContexts`
```typescript
interface CommunicationContext {
  id: string;                          // Unique context ID
  type: 'order' | 'qc_review' | 'general';
  entityId: string;                    // Order ID, QC Review ID, etc.
  tenantId: string;
  
  // Chat Thread
  chatThreadId?: string;               // ACS chat thread ID
  chatCreatedAt?: Date;
  
  // Call/Meeting History
  calls: Array<{
    id: string;                        // ACS group call ID
    type: 'adhoc_call' | 'scheduled_meeting';
    meetingLink?: string;              // Teams meeting link
    startedAt: Date;
    endedAt?: Date;
    participants: string[];            // User IDs
    recordingUrl?: string;
    transcriptId?: string;             // Link to transcript
    aiSummaryId?: string;              // Link to AI summary
  }>;
  
  // Participants
  participants: Array<{
    userId: string;
    acsUserId: string;
    displayName: string;
    role: string;
    joinedAt: Date;
    permissions: {
      canStartCall: boolean;
      canScheduleMeeting: boolean;
      canInviteOthers: boolean;
    };
  }>;
  
  // AI Insights
  aiInsights: {
    lastAnalyzedAt?: Date;
    overallSentiment?: 'positive' | 'neutral' | 'negative';
    riskFlags: string[];               // Compliance concerns
    actionItems: Array<{
      description: string;
      assignee?: string;
      dueDate?: Date;
      status: 'open' | 'completed';
      extractedAt: Date;
    }>;
    keyTopics: string[];
    escalationSuggested?: boolean;
  };
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}
```

### Container: `communicationTranscripts`
```typescript
interface CommunicationTranscript {
  id: string;
  contextId: string;                   // Link to communicationContext
  type: 'chat' | 'call' | 'meeting';
  
  // Chat transcript
  messages?: Array<{
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: Date;
    sentiment?: number;                // -1 to 1
    flags?: string[];                  // Compliance flags
  }>;
  
  // Call/Meeting transcript
  segments?: Array<{
    speaker: string;
    speakerId: string;
    startTime: number;                 // Seconds from start
    endTime: number;
    text: string;
    confidence: number;
    sentiment?: number;
  }>;
  
  // AI Analysis
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
  riskAssessment?: {
    level: 'low' | 'medium' | 'high';
    concerns: string[];
    recommendations: string[];
  };
  
  generatedAt: Date;
  tenantId: string;
}
```

### Container: `aiInsights`
```typescript
interface AIInsight {
  id: string;
  contextId: string;
  type: 'sentiment' | 'action_item' | 'risk_flag' | 'summary' | 'recommendation';
  
  // Insight data
  confidence: number;                  // 0-1
  content: string;
  metadata: {
    source: 'chat' | 'call' | 'meeting';
    timestamp: Date;
    participants?: string[];
    relatedMessageIds?: string[];
  };
  
  // Actions taken
  notified?: string[];                 // User IDs who were notified
  acknowledged?: boolean;
  resolvedAt?: Date;
  
  createdAt: Date;
  tenantId: string;
}
```

---

## 3. Service Architecture

### Core Services

#### A. `UnifiedCommunicationService`
**Location:** `src/services/unified-communication.service.ts`

**Responsibilities:**
- Central orchestration of all communication channels
- Context creation and management
- Participant management across channels
- Integration with orders/QC reviews

```typescript
class UnifiedCommunicationService {
  // Context Management
  async createContext(params: CreateContextParams): Promise<CommunicationContext>
  async getContext(entityType: string, entityId: string): Promise<CommunicationContext>
  async listUserContexts(userId: string): Promise<CommunicationContext[]>
  
  // Channel Orchestration
  async initializeChatThread(contextId: string): Promise<string>
  async startCall(contextId: string, participants: string[]): Promise<CallDetails>
  async scheduleMeeting(contextId: string, params: MeetingParams): Promise<MeetingDetails>
  
  // Participant Management
  async addParticipant(contextId: string, userId: string, permissions: Permissions): Promise<void>
  async removeParticipant(contextId: string, userId: string): Promise<void>
  async updatePermissions(contextId: string, userId: string, permissions: Permissions): Promise<void>
}
```

#### B. `AcsChatService`
**Location:** `src/services/acs-chat.service.ts`

**Responsibilities:**
- ACS chat thread management
- Message operations
- Chat-specific participant management

```typescript
class AcsChatService {
  async createThread(topic: string, participants: Participant[]): Promise<string>
  async addParticipant(threadId: string, participant: Participant): Promise<void>
  async removeParticipant(threadId: string, userId: string): Promise<void>
  async deleteThread(threadId: string): Promise<void>
  
  // Message operations (for AI analysis)
  async getThreadMessages(threadId: string, count: number): Promise<Message[]>
  async sendMessage(threadId: string, content: string, senderId: string): Promise<void>
}
```

#### C. `CallRecordingService`
**Location:** `src/services/call-recording.service.ts`

**Responsibilities:**
- Manage call recordings
- Store recordings in Azure Blob Storage
- Trigger transcription jobs

```typescript
class CallRecordingService {
  async startRecording(callId: string): Promise<string>
  async stopRecording(recordingId: string): Promise<RecordingDetails>
  async getRecordingUrl(recordingId: string): Promise<string>
  async deleteRecording(recordingId: string): Promise<void>
  async triggerTranscription(recordingId: string): Promise<string>
}
```

#### D. `TranscriptionService`
**Location:** `src/services/transcription.service.ts`

**Responsibilities:**
- Process audio/video recordings
- Generate transcripts with speaker identification
- Store transcripts in Cosmos DB

```typescript
class TranscriptionService {
  async transcribeRecording(recordingUrl: string): Promise<Transcript>
  async transcribeRealtime(audioStream: Stream): AsyncIterable<TranscriptSegment>
  async getTranscript(transcriptId: string): Promise<Transcript>
  async searchTranscripts(query: string, contextId: string): Promise<TranscriptMatch[]>
}
```

#### E. `CommunicationAIService`
**Location:** `src/services/communication-ai.service.ts`

**Responsibilities:**
- AI analysis of all communication
- Sentiment analysis
- Action item extraction
- Risk detection
- Summary generation

```typescript
class CommunicationAIService {
  // Chat Analysis
  async analyzeChatMessages(messages: Message[]): Promise<ChatAnalysis>
  async detectSentiment(text: string): Promise<SentimentScore>
  async extractActionItems(text: string): Promise<ActionItem[]>
  async detectComplianceRisks(text: string): Promise<RiskFlag[]>
  
  // Call/Meeting Analysis
  async analyzeTranscript(transcript: Transcript): Promise<TranscriptAnalysis>
  async generateSummary(transcript: Transcript): Promise<string>
  async extractKeyMoments(transcript: Transcript): Promise<KeyMoment[]>
  async identifySpeakers(transcript: Transcript): Promise<SpeakerMap>
  
  // Cross-Channel Insights
  async generateContextInsights(contextId: string): Promise<ContextInsights>
  async detectEscalationNeeds(contextId: string): Promise<EscalationRecommendation>
  async suggestNextActions(contextId: string): Promise<ActionSuggestion[]>
}
```

---

## 4. AI Integration Architecture

### AI Provider Strategy
Use **multi-provider** approach with fallback:
- **Primary**: Azure OpenAI (gpt-4o) - Complex analysis, summaries
- **Secondary**: Google Gemini - Vision, document analysis
- **Real-time**: Azure Speech Services - Live transcription

### AI Workflows

#### Chat Message Analysis (Real-Time)
```
1. User sends message
2. Message stored in ACS
3. Webhook → Backend receives message event
4. CommunicationAIService analyzes:
   - Sentiment scoring
   - Action item extraction
   - Compliance keyword detection
5. If risk detected → Notify manager
6. Store insights in aiInsights collection
```

#### Call/Meeting Transcription (Post-Call)
```
1. Call/meeting ends
2. Recording saved to Azure Blob
3. CallRecordingService triggers transcription
4. Azure Speech Services transcribes with diarization
5. TranscriptionService stores transcript
6. CommunicationAIService analyzes:
   - Generate summary
   - Extract action items
   - Identify key moments
   - Detect compliance issues
7. Create follow-up tasks in system
8. Notify participants with summary
```

#### Context-Level Insights (Periodic)
```
1. Cron job runs hourly
2. For each active context:
   - Aggregate all communication (chat + calls + meetings)
   - Analyze patterns and trends
   - Detect escalation needs
   - Generate recommendations
3. Update communicationContext.aiInsights
4. Notify relevant stakeholders
```

### AI Features by Use Case

#### Order Communication
- **Sentiment monitoring**: Detect client frustration
- **Progress tracking**: Extract status updates
- **Issue detection**: Identify blockers
- **Compliance**: Flag inappropriate language

#### QC Review Communication
- **Disagreement detection**: Identify conflicts
- **Resolution tracking**: Monitor issue resolution
- **Knowledge extraction**: Capture best practices
- **Training opportunities**: Identify learning moments

#### General Communication
- **Smart replies**: Suggest responses
- **Topic clustering**: Group related discussions
- **Participant engagement**: Track activity levels
- **Meeting optimization**: Suggest better times

---

## 5. API Endpoints

### Unified Communication Controller
**Location:** `src/controllers/unified-communication.controller.ts`

#### Create Communication Context
```
POST /api/communication/contexts
Body: {
  type: 'order' | 'qc_review' | 'general'
  entityId: string
  participants: Array<{ userId: string, role: string, permissions: object }>
  autoCreateChat?: boolean
}
Response: { success: true, data: CommunicationContext }
```

#### Get Context
```
GET /api/communication/contexts/:entityType/:entityId
Response: { success: true, data: CommunicationContext }
```

#### Initialize Chat Thread
```
POST /api/communication/contexts/:contextId/chat
Response: { success: true, data: { threadId: string } }
```

#### Start Ad-Hoc Call
```
POST /api/communication/contexts/:contextId/call
Body: { participants: string[] }
Response: { success: true, data: { groupCallId: string, joinUrl: string } }
```

#### Schedule Meeting
```
POST /api/communication/contexts/:contextId/meeting
Body: {
  subject: string
  startTime: Date
  duration: number
  participants: string[]
  externalAttendees?: string[]
}
Response: { success: true, data: { meetingId: string, joinUrl: string } }
```

#### Get AI Insights
```
GET /api/communication/contexts/:contextId/insights
Response: {
  success: true,
  data: {
    sentiment: object
    actionItems: ActionItem[]
    riskFlags: RiskFlag[]
    summary: string
    recommendations: string[]
  }
}
```

#### Get Transcript
```
GET /api/communication/transcripts/:transcriptId
Response: { success: true, data: Transcript }
```

#### Search Communications
```
GET /api/communication/search?q=property+inspection&contextId=xyz
Response: { success: true, data: SearchResult[] }
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create `UnifiedCommunicationService`
- [ ] Create `AcsChatService`
- [ ] Implement database schema
- [ ] Create communication contexts
- [ ] Basic chat thread creation
- [ ] Test chat functionality

### Phase 2: Calls & Meetings (Week 2)
- [ ] Integrate call initiation
- [ ] Implement `CallRecordingService`
- [ ] Teams meeting integration
- [ ] Store call/meeting history
- [ ] Test end-to-end calling

### Phase 3: Transcription (Week 3)
- [ ] Setup Azure Speech Services
- [ ] Implement `TranscriptionService`
- [ ] Real-time transcription
- [ ] Post-call transcription
- [ ] Speaker diarization
- [ ] Test transcription accuracy

### Phase 4: AI Analysis (Week 4)
- [ ] Create `CommunicationAIService`
- [ ] Implement sentiment analysis
- [ ] Action item extraction
- [ ] Risk detection algorithms
- [ ] Summary generation
- [ ] Test AI accuracy

### Phase 5: Advanced Features (Week 5)
- [ ] Smart reply suggestions
- [ ] Meeting optimization
- [ ] Engagement metrics
- [ ] Knowledge base building
- [ ] Compliance monitoring

### Phase 6: Integration (Week 6)
- [ ] Auto-create contexts for orders
- [ ] Auto-create contexts for QC reviews
- [ ] Notification system integration
- [ ] Dashboard widgets
- [ ] Mobile notifications

### Phase 7: Testing & Refinement (Week 7)
- [ ] Load testing
- [ ] AI accuracy tuning
- [ ] Security audit
- [ ] Performance optimization
- [ ] User acceptance testing

---

## 7. Technical Dependencies

### Azure Services Required
- ✅ **Azure Communication Services** (ACS) - Already configured
  - Chat
  - Calling
  - SMS (future)

- ✅ **Azure OpenAI** - Already configured
  - GPT-4o for analysis
  - Embeddings for search

- 🔲 **Azure Speech Services** - Need to provision
  - Real-time transcription
  - Speaker identification
  - Batch transcription

- 🔲 **Azure Blob Storage** - Need to configure
  - Call recordings
  - Meeting recordings
  - Attachment storage

- ✅ **Azure Cosmos DB** - Already configured
  - All metadata storage

- 🔲 **Azure Cognitive Services** - Optional
  - Content moderation
  - Translation services

### NPM Packages Needed
```json
{
  "@azure/communication-chat": "^1.4.0",           // ✅ Installed
  "@azure/communication-calling": "^1.19.0",       // 🔲 Need
  "@azure/storage-blob": "^12.17.0",               // 🔲 Need
  "@azure/ai-speech": "^1.0.0",                    // 🔲 Need
  "@azure/cognitiveservices-speech": "^1.34.0"     // 🔲 Need (alternative)
}
```

---

## 8. AI Prompts & Models

### Chat Analysis Prompts
```typescript
const SENTIMENT_ANALYSIS_PROMPT = `
Analyze the sentiment of the following message in the context of appraisal management.
Consider: tone, urgency, satisfaction level, potential concerns.

Message: {message}

Return JSON:
{
  "sentiment": "positive" | "neutral" | "negative",
  "score": -1 to 1,
  "urgency": "low" | "medium" | "high",
  "concerns": ["list", "of", "concerns"],
  "recommendations": ["suggested", "actions"]
}
`;

const ACTION_ITEM_EXTRACTION_PROMPT = `
Extract actionable items from this conversation about property appraisal.
Look for: tasks, commitments, deadlines, requests, follow-ups.

Conversation: {conversation}

Return JSON:
{
  "actionItems": [
    {
      "description": "clear action",
      "assignee": "person if mentioned",
      "dueDate": "date if mentioned",
      "priority": "low|medium|high"
    }
  ]
}
`;
```

### Transcript Analysis Prompts
```typescript
const MEETING_SUMMARY_PROMPT = `
Summarize this appraisal meeting transcript. Focus on:
- Key decisions made
- Action items assigned
- Issues discussed
- Next steps

Transcript: {transcript}

Generate:
1. Executive summary (2-3 sentences)
2. Key points (bullet list)
3. Action items with owners
4. Decisions made
5. Open questions
`;

const COMPLIANCE_CHECK_PROMPT = `
Analyze this communication for compliance issues in real estate appraisal:
- Fair Housing Act violations
- USPAP violations
- Discriminatory language
- Inappropriate pressure on appraiser
- Conflict of interest

Content: {content}

Return JSON with any concerns found.
`;
```

---

## 9. Security & Compliance

### Data Protection
- All transcripts encrypted at rest
- PII detection and redaction
- Access control per context
- Audit logging for all communication
- GDPR/CCPA compliance

### Authorization Rules
```typescript
// Who can access what
const authorizationMatrix = {
  'order': {
    'client': ['view_chat', 'send_message', 'join_call'],
    'appraiser': ['view_chat', 'send_message', 'join_call', 'view_transcript'],
    'manager': ['view_all', 'view_insights', 'view_transcript', 'export_data'],
    'admin': ['full_access']
  },
  'qc_review': {
    'appraiser': ['view_chat', 'send_message', 'view_transcript'],
    'qc_analyst': ['view_chat', 'send_message', 'view_insights', 'flag_issues'],
    'reviewer': ['view_all', 'override', 'view_insights']
  }
};
```

### Compliance Monitoring
- Real-time keyword detection
- Pattern analysis for issues
- Automatic escalation on violations
- Audit trail of all actions
- Regular compliance reports

---

## 10. Performance Considerations

### Caching Strategy
- Cache active contexts (Redis)
- Cache user ACS mappings
- Cache AI analysis results
- Cache transcripts

### Optimization
- Lazy load transcripts
- Paginate message history
- Debounce AI analysis requests
- Batch process insights

### Scalability
- Horizontal scaling of services
- Queue for AI processing
- CDN for recordings
- Database indexing strategy

---

## 11. Frontend Requirements

### Communication Panel Component
```typescript
<UnifiedCommunicationPanel
  contextId={order.communicationContextId}
  onStartCall={handleStartCall}
  onScheduleMeeting={handleScheduleMeeting}
  showAIInsights={true}
  showTranscripts={user.role !== 'client'}
/>
```

### Features Needed
- Chat widget with ACS SDK
- Call button with adapter creation
- Meeting scheduler
- AI insights panel
- Transcript viewer
- Action items list

---

## 12. Monitoring & Analytics

### Metrics to Track
- Active communication contexts
- Messages per context
- Call duration and quality
- Meeting attendance rates
- AI analysis accuracy
- Response times
- Sentiment trends
- Compliance violations

### Dashboards
- Real-time communication activity
- AI insights summary
- Compliance monitoring
- Performance metrics
- User engagement

---

## 13. Testing Strategy

### Unit Tests
- Service methods
- AI prompts
- Authorization logic
- Data transformations

### Integration Tests
- End-to-end chat flow
- Call recording and transcription
- AI analysis pipeline
- Multi-channel workflows

### E2E Tests
```
tests/e2e/communication/
  - chat-thread-creation.test.ts
  - call-recording.test.ts
  - meeting-scheduling.test.ts
  - ai-analysis.test.ts
  - compliance-detection.test.ts
```

### Test Scripts
```
scripts/test-unified-communication.js
scripts/test-ai-analysis.js
scripts/test-transcription.js
```

---

## 14. Cost Estimation

### Azure Services (Monthly)
- ACS Chat: ~$0.0008 per message
- ACS Calling: ~$0.004 per minute
- Azure Speech: ~$1 per hour transcription
- Azure OpenAI: ~$0.03 per 1K tokens
- Blob Storage: ~$0.02 per GB
- Cosmos DB: Based on usage

### Optimization Strategies
- Cache AI results
- Batch transcriptions
- Use cheaper models for simple tasks
- Implement rate limiting
- Archive old data

---

## Next Steps - Ready to Build?

**Immediate Actions:**
1. Provision Azure Speech Services
2. Setup Azure Blob Storage
3. Install NPM packages
4. Create service skeleton
5. Implement Phase 1 (Foundation)

**Timeline:** 7 weeks to full production
**MVP:** 2 weeks (chat + basic AI)

**Ready to start with Phase 1?** I'll begin by:
1. Creating `UnifiedCommunicationService`
2. Creating `AcsChatService`
3. Setting up database schemas
4. Building first API endpoints
5. Creating test scripts

Say "GO" and I'll start building! 🚀
