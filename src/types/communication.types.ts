/**
 * Azure Communication Services Types
 * Email, SMS, Chat, and Push Notification definitions
 */

// ============================================================================
// COMMUNICATION RECORD (UNIFIED STORAGE)
// ============================================================================

export type CommunicationEntityType = 'order' | 'vendor' | 'appraiser' | 'client' | 'user' | 'general';
export type CommunicationChannel = 'email' | 'sms' | 'teams' | 'chat' | 'phone' | 'in_app';
export type CommunicationDirection = 'outbound' | 'inbound';
export type CommunicationStatus = 'draft' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
export type CommunicationCategory = 
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

export interface CommunicationEntity {
  type: CommunicationEntityType;
  id: string;
  name?: string;
  role?: string;
}

export interface CommunicationParticipantInfo {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface CommunicationRecord {
  // Core identification
  id: string;
  tenantId: string;
  type: 'communication';
  
  // Entity relationships
  primaryEntity: CommunicationEntity;
  relatedEntities?: CommunicationEntity[];
  
  // Conversation threading
  threadId?: string;
  parentMessageId?: string;
  conversationContext?: string;
  
  // Channel & delivery
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  
  // Participants
  from: CommunicationParticipantInfo;
  to: CommunicationParticipantInfo[];
  cc?: CommunicationParticipantInfo[];
  bcc?: CommunicationParticipantInfo[];
  
  // Message content
  subject?: string;
  body: string;
  bodyFormat: 'text' | 'html' | 'markdown';
  
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
  }>;
  
  // Status & tracking
  status: CommunicationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  
  deliveryStatus?: {
    messageId?: string;
    provider?: string;
    attempts?: number;
    lastAttemptAt?: Date;
    error?: string;
  };
  
  // Categorization & search
  category: CommunicationCategory;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  tags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  
  // Business context
  businessImpact?: {
    affectsDeadline?: boolean;
    requiresAction?: boolean;
    actionDeadline?: Date;
    estimatedResponseTime?: string;
    escalationLevel?: number;
  };
  
  // AI insights
  aiAnalysis?: {
    summary?: string;
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
  
  // Metadata
  metadata?: {
    source?: string;
    triggeredBy?: string;
    templateId?: string;
    campaignId?: string;
    [key: string]: any;
  };
  
  // Audit & compliance
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  
  archived?: boolean;
  archiveReason?: string;
  archivedAt?: Date;
  archivedBy?: string;
  
  legalHold?: boolean;
  retentionPolicyId?: string;
}

// ============================================================================
// EMAIL TYPES
// ============================================================================

export type EmailPriority = 'low' | 'normal' | 'high';

export interface EmailAddress {
  address: string;
  displayName?: string;
}

export interface EmailAttachment {
  name: string;
  contentType: string;
  contentInBase64: string;
}

export interface EmailMessage {
  senderAddress: string;
  recipients: {
    to: EmailAddress[];
    cc?: EmailAddress[];
    bcc?: EmailAddress[];
  };
  subject: string;
  htmlBody?: string;
  textBody?: string;
  attachments?: EmailAttachment[];
  replyTo?: EmailAddress[];
  priority?: EmailPriority;
  headers?: Record<string, string>;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailTemplateCategory =
  | 'order_assignment'
  | 'order_acceptance'
  | 'order_rejection'
  | 'negotiation'
  | 'milestone'
  | 'document'
  | 'revision'
  | 'delivery'
  | 'system';

export interface EmailSendResult {
  messageId: string;
  status: 'queued' | 'sent' | 'failed';
  error?: string;
}

// ============================================================================
// SMS TYPES
// ============================================================================

export interface SmsMessage {
  from: string;
  to: string[];
  message: string;
  enableDeliveryReport?: boolean;
  tag?: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  maxLength: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SmsSendResult {
  messageId: string;
  to: string;
  httpStatusCode: number;
  successful: boolean;
  errorMessage?: string;
}

// ============================================================================
// CHAT TYPES
// ============================================================================

export interface ChatThread {
  id: string;
  topic: string;
  orderId?: string;
  participants: ChatParticipant[];
  createdAt: Date;
  createdBy: string;
  deletedAt?: Date;
}

export interface ChatParticipant {
  id: string;                    // Azure AD user ID
  acsUserId?: string;            // ACS user ID (e.g., "8:acs:...")
  displayName: string;
  role: 'vendor' | 'amc' | 'client' | 'system';
  shareHistoryTime?: Date;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderDisplayName: string;
  content: string;
  type: 'text' | 'html' | 'file' | 'system';
  metadata?: {
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    [key: string]: any;
  };
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

export interface ChatMessageReadReceipt {
  messageId: string;
  chatThreadId: string;
  senderId: string;
  readBy: string;
  readAt: Date;
}

export interface ChatTypingIndicator {
  threadId: string;
  userId: string;
  displayName: string;
  isTyping: boolean;
  timestamp: Date;
}

// ============================================================================
// PUSH NOTIFICATION TYPES
// ============================================================================

export type PushPlatform = 'ios' | 'android' | 'web';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'max';
  ttl?: number; // Time to live in seconds
  image?: string;
  clickAction?: string;
}

export interface DeviceRegistration {
  id: string;
  userId: string;
  deviceToken: string;
  platform: PushPlatform;
  appVersion?: string;
  osVersion?: string;
  deviceModel?: string;
  registeredAt: Date;
  lastActiveAt: Date;
  tags?: string[];
}

export interface PushSendResult {
  success: boolean;
  failureCount: number;
  successCount: number;
  results: {
    deviceToken: string;
    status: 'sent' | 'failed';
    error?: string;
  }[];
}

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

export interface NotificationPreferences {
  id: string;
  userId: string;
  tenantId: string;
  
  email: {
    enabled: boolean;
    address: string;
    verified: boolean;
    frequency: 'immediate' | 'digest_hourly' | 'digest_daily';
    categories: {
      orderUpdates: boolean;
      milestones: boolean;
      revisions: boolean;
      messages: boolean;
      systemAlerts: boolean;
    };
  };
  
  sms: {
    enabled: boolean;
    phoneNumber: string;
    verified: boolean;
    urgentOnly: boolean;
    categories: {
      assignments: boolean;
      urgentRevisions: boolean;
      deadlineReminders: boolean;
      milestoneAlerts: boolean;
    };
  };
  
  push: {
    enabled: boolean;
    categories: {
      all: boolean;
      messages: boolean;
      updates: boolean;
      urgent: boolean;
    };
  };
  
  inApp: {
    enabled: boolean;
    playSound: boolean;
    showBadge: boolean;
  };
  
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string;   // HH:mm format
    timezone: string;  // IANA timezone
    allowUrgent: boolean;
  };
  
  language: string;
  timezone: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// NOTIFICATION HISTORY
// ============================================================================

export type NotificationType = 'email' | 'sms' | 'push' | 'chat' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'read';

export interface NotificationHistory {
  id: string;
  tenantId: string;
  userId: string;
  orderId?: string;
  
  type: NotificationType;
  category: string;
  subject?: string;
  content: string;
  
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  
  metadata: {
    templateId?: string;
    templateVariables?: Record<string, any>;
    messageId?: string;
    provider?: string;
    error?: string;
    retryCount?: number;
    [key: string]: any;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// NOTIFICATION EVENTS
// ============================================================================

export interface NotificationEvent {
  eventType: NotificationEventType;
  orderId?: string;
  userId: string;
  tenantId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export type NotificationEventType =
  // Order events
  | 'order.assigned'
  | 'order.accepted'
  | 'order.rejected'
  | 'order.completed'
  | 'order.cancelled'
  
  // Negotiation events
  | 'negotiation.counter_offered'
  | 'negotiation.accepted'
  | 'negotiation.rejected'
  | 'negotiation.expired'
  
  // Milestone events
  | 'milestone.started'
  | 'milestone.completed'
  | 'milestone.overdue'
  
  // Document events
  | 'document.uploaded'
  | 'document.reviewed'
  | 'document.approved'
  | 'document.rejected'
  
  // Revision events
  | 'revision.requested'
  | 'revision.resolved'
  | 'revision.overdue'
  
  // Delivery events
  | 'delivery.package_created'
  | 'delivery.package_acknowledged'
  | 'delivery.completed'
  
  // Communication events
  | 'chat.message_received'
  | 'chat.thread_created'
  | 'teams.meeting_created'
  | 'teams.meeting_started'
  | 'teams.meeting_ended'
  | 'teams.participant_joined'
  
  // System events
  | 'system.maintenance'
  | 'system.alert';

// ============================================================================
// TEAMS INTEROPERABILITY TYPES
// ============================================================================

export interface TeamsMeetingParticipant {
  userId: string;
  acsUserId?: string;
  displayName: string;
  email?: string;
  role: 'organizer' | 'presenter' | 'attendee';
  isExternal: boolean;
}

export interface TeamsMeeting {
  id: string;
  meetingId: string; // Graph API meeting ID
  orderId: string;
  subject: string;
  startDateTime: Date;
  endDateTime: Date;
  joinUrl: string; // Universal join link (works for all users)
  joinWebUrl: string; // Web browser join link
  organizerId: string;
  participants: TeamsMeetingParticipant[];
  chatThreadId?: string; // Associated chat thread ID
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
  allowExternalParticipants: boolean;
  createdAt: Date;
  tenantId: string;
}

export interface TeamsJoinInfo {
  joinUrl: string;
  joinWebUrl: string;
  displayName: string;
  instructions: string;
}

export interface CreateTeamsMeetingRequest {
  orderId: string;
  subject: string;
  startDateTime: Date | string;
  endDateTime: Date | string;
  participants: TeamsMeetingParticipant[];
  recordingEnabled?: boolean;
  transcriptionEnabled?: boolean;
}

export interface UpdateTeamsMeetingRequest {
  subject?: string;
  startDateTime?: Date | string;
  endDateTime?: Date | string;
}

// ============================================================================
// TEMPLATE VARIABLES
// ============================================================================

export interface NotificationTemplateVariables {
  // Order variables
  orderId?: string;
  orderType?: string;
  propertyAddress?: string;
  dueDate?: string;
  fee?: string;
  
  // User variables
  userName?: string;
  userEmail?: string;
  vendorName?: string;
  clientName?: string;
  
  // Milestone variables
  milestoneName?: string;
  milestoneStatus?: string;
  completionDate?: string;
  
  // Document variables
  documentName?: string;
  documentType?: string;
  reviewNotes?: string;
  
  // Revision variables
  revisionReason?: string;
  revisionDueDate?: string;
  revisionSeverity?: string;
  
  // Teams meeting variables
  meetingJoinUrl?: string;
  meetingStartTime?: string;
  meetingSubject?: string;
  
  // System variables
  platformName?: string;
  supportEmail?: string;
  supportPhone?: string;
  portalUrl?: string;
  
  [key: string]: string | undefined;
}

// ============================================================================
// DIGEST NOTIFICATIONS
// ============================================================================

export interface DigestNotification {
  id: string;
  userId: string;
  tenantId: string;
  frequency: 'hourly' | 'daily';
  notifications: NotificationHistory[];
  sentAt?: Date;
  createdAt: Date;
}

// ============================================================================
// UNIFIED COMMUNICATION PLATFORM TYPES
// ============================================================================

export interface CommunicationParticipant {
  userId: string;
  acsUserId: string;
  displayName: string;
  email: string;
  role: string;
  joinedAt: Date;
  permissions: {
    canStartCall: boolean;
    canScheduleMeeting: boolean;
    canInviteOthers: boolean;
    canViewTranscripts: boolean;
  };
}

export interface CallDetails {
  id: string;
  type: 'adhoc_call' | 'scheduled_meeting';
  meetingLink?: string;
  groupCallId?: string;
  startedAt: Date;
  endedAt?: Date;
  participants: string[];
  recordingUrl?: string;
  transcriptId?: string;
  aiSummaryId?: string;
  duration?: number;
}

export interface AIInsights {
  lastAnalyzedAt?: Date;
  overallSentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  riskFlags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    detectedAt: Date;
  }>;
  actionItems: Array<{
    id: string;
    description: string;
    assignee?: string;
    dueDate?: Date;
    status: 'open' | 'completed';
    extractedAt: Date;
    source: 'chat' | 'call' | 'meeting';
  }>;
  keyTopics: string[];
  escalationSuggested?: boolean;
  escalationReason?: string;
}

export interface CommunicationContext {
  id: string;
  type: 'order' | 'qc_review' | 'general';
  entityId: string;
  tenantId: string;
  
  // Chat Thread
  chatThreadId?: string;
  chatCreatedAt?: Date;
  
  // Call/Meeting History
  calls: CallDetails[];
  
  // Participants
  participants: CommunicationParticipant[];
  
  // AI Insights
  aiInsights?: AIInsights;
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CreateContextParams {
  type: 'order' | 'qc_review' | 'general';
  entityId: string;
  tenantId: string;
  createdBy: string;
  participants: Array<{
    userId: string;
    displayName: string;
    email: string;
    role: string;
    permissions?: Partial<CommunicationParticipant['permissions']>;
  }>;
  autoCreateChat?: boolean;
}

export interface TranscriptSegment {
  speaker: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  sentiment?: number;
}

export interface CommunicationTranscript {
  id: string;
  contextId: string;
  type: 'chat' | 'call' | 'meeting';
  
  // Chat transcript
  messages?: Array<{
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: Date;
    sentiment?: number;
    flags?: string[];
  }>;
  
  // Call/Meeting transcript
  segments?: TranscriptSegment[];
  
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

export interface AIInsight {
  id: string;
  contextId: string;
  type: 'sentiment' | 'action_item' | 'risk_flag' | 'summary' | 'recommendation';
  
  confidence: number;
  content: string;
  metadata: {
    source: 'chat' | 'call' | 'meeting';
    timestamp: Date;
    participants?: string[];
    relatedMessageIds?: string[];
  };
  
  notified?: string[];
  acknowledged?: boolean;
  resolvedAt?: Date;
  
  createdAt: Date;
  tenantId: string;
}

export interface MeetingParams {
  subject: string;
  startTime: Date;
  endTime: Date;
  participants: string[];
  externalAttendees?: Array<{
    email: string;
    displayName: string;
  }>;
  description?: string;
}

export interface ChatAnalysis {
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number;
    confidence: number;
  };
  actionItems: Array<{
    description: string;
    assignee?: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  riskFlags: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  keyTopics: string[];
}

export interface TranscriptAnalysis {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  participantEngagement: Record<string, {
    speakTime: number;
    messageCount: number;
    sentiment: number;
  }>;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    concerns: string[];
  };
}
