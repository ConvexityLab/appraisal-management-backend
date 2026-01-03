/**
 * Azure Communication Services Types
 * Email, SMS, Chat, and Push Notification definitions
 */

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
  
  // System events
  | 'system.maintenance'
  | 'system.alert';

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
