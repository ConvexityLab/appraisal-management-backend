/**
 * Core Notification Service
 * Orchestrates event processing and routes notifications to appropriate channels
 */

import { 
  AppEvent, 
  BaseEvent,
  EventHandler, 
  NotificationMessage, 
  NotificationChannel, 
  EventPriority,
  EventCategory
} from '../types/events.js';
import { ServiceBusEventSubscriber } from './service-bus-subscriber';
import { ServiceBusEventPublisher } from './service-bus-publisher';
import { EmailNotificationService } from './email-notification.service.js';
import { SmsNotificationService } from './sms-notification.service.js';
import { InAppNotificationService } from './in-app-notification.service.js';
import { WebPubSubService } from './web-pubsub.service.js';
import { Logger } from '../utils/logger.js';

export interface NotificationRule {
  id: string;
  eventType: string;
  condition?: (event: AppEvent) => boolean;
  channels: NotificationChannel[];
  template: {
    title: string;
    message: string;
  };
  priority?: EventPriority;
  throttleMs?: number;
}

export interface NotificationServiceConfig {
  serviceBusConnectionString?: string;
  enableEmail?: boolean;
  enableSMS?: boolean;
  enableWebhooks?: boolean;
}

export class NotificationService {
  private subscriber: ServiceBusEventSubscriber;
  private publisher: ServiceBusEventPublisher;
  private emailService: EmailNotificationService;
  private smsService: SmsNotificationService;
  private inAppService: InAppNotificationService;
  private webPubSubService: WebPubSubService | null = null;
  private logger: Logger;
  private rules: Map<string, NotificationRule[]> = new Map();
  private throttleMap: Map<string, number> = new Map();
  private config: NotificationServiceConfig;

  constructor(config: NotificationServiceConfig = {}) {
    this.config = config;
    this.logger = new Logger('NotificationService');
    
    this.subscriber = new ServiceBusEventSubscriber(
      config.serviceBusConnectionString,
      'appraisal-events',
      'notification-service'
    );
    
    this.publisher = new ServiceBusEventPublisher(
      config.serviceBusConnectionString,
      'notification-events'
    );

    // Initialize channel services
    this.emailService = new EmailNotificationService();
    this.smsService = new SmsNotificationService();
    this.inAppService = new InAppNotificationService();

    // Initialize WebPubSub — gracefully degrade if not configured
    try {
      this.webPubSubService = new WebPubSubService({ enableLocalEmulation: process.env.NODE_ENV === 'development' });
      this.logger.info('WebPubSub service initialized for real-time notifications');
    } catch (error) {
      this.logger.warn('WebPubSub not available — real-time WebSocket delivery disabled', { error: (error as Error).message });
      this.webPubSubService = null;
    }

    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    // Order creation notifications
    this.addRule({
      id: 'order-created-notification',
      eventType: 'order.created',
      channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
      template: {
        title: 'New Appraisal Order Created',
        message: 'A new appraisal order has been created for {{propertyAddress}}. Due date: {{dueDate}}.'
      },
      priority: EventPriority.NORMAL
    });

    // Order assignment notifications
    this.addRule({
      id: 'order-assigned-notification',
      eventType: 'order.assigned',
      channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
      template: {
        title: 'Order Assigned',
        message: 'Order {{orderId}} has been assigned to {{vendorName}}. Due date: {{dueDate}}.'
      },
      priority: EventPriority.NORMAL
    });

    // QC completion notifications
    this.addRule({
      id: 'qc-completed-notification',
      eventType: 'qc.completed',
      channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
      template: {
        title: 'QC Review Completed',
        message: 'QC review for order {{orderId}} completed with result: {{result}}. Score: {{score}}/100.'
      },
      priority: EventPriority.HIGH
    });

    // Critical QC issues
    this.addRule({
      id: 'qc-critical-issue-notification',
      eventType: 'qc.issue.detected',
      condition: (event: AppEvent) => {
        const qcEvent = event as any;
        return qcEvent.data?.severity === 'critical';
      },
      channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL, NotificationChannel.SMS],
      template: {
        title: 'CRITICAL: QC Issue Detected',
        message: 'CRITICAL QC issue detected in order {{orderId}}: {{description}}. Immediate action required.'
      },
      priority: EventPriority.CRITICAL,
      throttleMs: 300000 // 5 minutes
    });

    // System alerts
    this.addRule({
      id: 'system-alert-notification',
      eventType: 'system.alert',
      condition: (event: AppEvent) => {
        const systemEvent = event as any;
        return systemEvent.data?.severity === 'critical' || systemEvent.data?.severity === 'error';
      },
      channels: [NotificationChannel.WEBSOCKET, NotificationChannel.EMAIL],
      template: {
        title: 'System Alert: {{alertType}}',
        message: '{{message}}'
      },
      priority: EventPriority.HIGH
    });

    this.logger.info(`Set up ${this.getTotalRuleCount()} default notification rules`);
  }

  async start(): Promise<void> {
    try {
      // Subscribe to all event types that have rules
      const eventTypes = Array.from(this.rules.keys());
      
      for (const eventType of eventTypes) {
        await this.subscriber.subscribe(eventType, new NotificationEventHandler(this, eventType));
      }

      this.logger.info(`Notification service started, subscribed to ${eventTypes.length} event types`);
    } catch (error) {
      this.logger.error('Failed to start notification service', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.subscriber.close();
      await this.publisher.close();
      this.logger.info('Notification service stopped');
    } catch (error) {
      this.logger.error('Error stopping notification service', { error });
      throw error;
    }
  }

  addRule(rule: NotificationRule): void {
    if (!this.rules.has(rule.eventType)) {
      this.rules.set(rule.eventType, []);
    }
    this.rules.get(rule.eventType)!.push(rule);
    this.logger.info(`Added notification rule: ${rule.id} for event type: ${rule.eventType}`);
  }

  removeRule(ruleId: string): boolean {
    for (const [eventType, rules] of this.rules) {
      const index = rules.findIndex(rule => rule.id === ruleId);
      if (index !== -1) {
        rules.splice(index, 1);
        if (rules.length === 0) {
          this.rules.delete(eventType);
        }
        this.logger.info(`Removed notification rule: ${ruleId}`);
        return true;
      }
    }
    return false;
  }

  async processEvent(eventType: string, event: AppEvent): Promise<void> {
    const rules = this.rules.get(eventType) || [];
    
    if (rules.length === 0) {
      this.logger.debug(`No notification rules for event type: ${eventType}`);
      return;
    }

    const notifications: NotificationMessage[] = [];

    for (const rule of rules) {
      // Check if rule condition is met (if any)
      if (rule.condition && !rule.condition(event)) {
        continue;
      }

      // Check throttling
      if (rule.throttleMs && this.isThrottled(rule.id, rule.throttleMs)) {
        this.logger.debug(`Rule ${rule.id} is throttled, skipping notification`);
        continue;
      }

      // Create notification message
      const notification = this.createNotificationMessage(rule, event);
      notifications.push(notification);

      // Update throttle map
      if (rule.throttleMs) {
        this.throttleMap.set(rule.id, Date.now());
      }
    }

    // Send notifications
    if (notifications.length > 0) {
      await this.sendNotifications(notifications);
      this.logger.info(`Processed ${notifications.length} notifications for event: ${eventType}`);
    }
  }

  private createNotificationMessage(rule: NotificationRule, event: AppEvent): NotificationMessage {
    // Simple template replacement
    const title = this.replaceTemplateVariables(rule.template.title, event);
    const message = this.replaceTemplateVariables(rule.template.message, event);

    return {
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      message,
      priority: rule.priority || EventPriority.NORMAL,
      category: (event as any).category || EventCategory.SYSTEM,
      targets: rule.channels.map(channel => ({
        channel,
        address: this.getChannelAddress(channel, event)
      })),
      data: {
        eventId: event.id,
        eventType: event.type,
        ruleId: rule.id,
        originalEvent: event
      }
    };
  }

  private replaceTemplateVariables(template: string, event: AppEvent): string {
    let result = template;
    
    // Replace event-level variables
    result = result.replace(/\{\{id\}\}/g, event.id);
    result = result.replace(/\{\{type\}\}/g, event.type);
    result = result.replace(/\{\{source\}\}/g, event.source);
    
    // Replace data-level variables
    const eventData = (event as any).data || {};
    Object.keys(eventData).forEach(key => {
      const value = eventData[key];
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(placeholder, String(value));
    });

    return result;
  }

  private getChannelAddress(channel: NotificationChannel, event: AppEvent): string {
    // In a real implementation, this would lookup user preferences, etc.
    switch (channel) {
      case NotificationChannel.WEBSOCKET:
        return process.env.WEBSOCKET_NOTIFICATION_URL || (() => {
          if (process.env.NODE_ENV === 'development' && process.env.WEBSOCKET_USE_LOCAL === 'true') {
            return 'ws://localhost:8080/notifications';
          }
          throw new Error('WEBSOCKET_NOTIFICATION_URL environment variable is required');
        })();
      case NotificationChannel.EMAIL:
        return process.env.NOTIFICATION_EMAIL || 'admin@appraisal-system.com';
      case NotificationChannel.SMS:
        return process.env.NOTIFICATION_SMS || '+1234567890';
      case NotificationChannel.WEBHOOK:
        return process.env.WEBHOOK_NOTIFICATION_URL || (() => {
          if (process.env.NODE_ENV === 'development' && process.env.WEBHOOK_USE_LOCAL === 'true') {
            return 'http://localhost:3000/webhooks/notifications';
          }
          throw new Error('WEBHOOK_NOTIFICATION_URL environment variable is required');
        })();
      default:
        return '';
    }
  }

  private isThrottled(ruleId: string, throttleMs: number): boolean {
    const lastSent = this.throttleMap.get(ruleId);
    if (!lastSent) return false;
    
    return (Date.now() - lastSent) < throttleMs;
  }

  private async sendNotifications(notifications: NotificationMessage[]): Promise<void> {
    // Group notifications by channel for efficient delivery
    const channelGroups = new Map<NotificationChannel, NotificationMessage[]>();
    
    notifications.forEach(notification => {
      notification.targets.forEach(target => {
        if (!channelGroups.has(target.channel)) {
          channelGroups.set(target.channel, []);
        }
        channelGroups.get(target.channel)!.push(notification);
      });
    });

    // Send to each channel
    for (const [channel, channelNotifications] of channelGroups) {
      await this.sendToChannel(channel, channelNotifications);
    }
  }

  private async sendToChannel(channel: NotificationChannel, notifications: NotificationMessage[]): Promise<void> {
    switch (channel) {
      case NotificationChannel.WEBSOCKET:
        // Always persist as in-app notification so nothing is lost
        await this.persistAsInAppNotifications(notifications);
        // Also deliver via WebSocket if available
        if (this.webPubSubService) {
          await this.sendWebSocketNotifications(notifications);
        } else {
          this.logger.debug('WebSocket not available — notifications persisted as in-app only', { count: notifications.length });
        }
        break;
      case NotificationChannel.EMAIL:
        await this.sendEmailNotifications(notifications);
        break;
      case NotificationChannel.SMS:
        await this.sendSMSNotifications(notifications);
        break;
      case NotificationChannel.WEBHOOK:
        await this.sendWebhookNotifications(notifications);
        break;
      default:
        this.logger.warn(`Unsupported notification channel: ${channel}`);
    }
  }

  private async persistAsInAppNotifications(notifications: NotificationMessage[]): Promise<void> {
    const tenantId = process.env.DEFAULT_TENANT_ID || 'tenant-001';

    for (const notification of notifications) {
      try {
        // Determine target userId from event data
        const eventData = notification.data?.originalEvent?.data || notification.data || {};
        const userId = (eventData as any).userId || (eventData as any).assignedTo || (eventData as any).vendorId || 'system';
        const orderId = (eventData as any).orderId;

        await this.inAppService.createNotification({
          tenantId,
          userId,
          title: notification.title,
          message: notification.message,
          category: this.mapEventCategoryToNotificationCategory(notification.category),
          priority: this.mapPriorityToInApp(notification.priority),
          ...(orderId ? { actionUrl: `/orders/${orderId}` } : {}),
          metadata: { eventId: notification.data?.eventId, ruleId: notification.data?.ruleId },
          ...(notification.data?.eventType ? { sourceEventType: notification.data.eventType as string } : {}),
          ...(notification.data?.eventId ? { sourceEventId: notification.data.eventId as string } : {}),
        });
      } catch (error) {
        this.logger.error('Failed to persist in-app notification', { error, notificationId: notification.id });
        // Don't throw — persistence failure shouldn't stop other notifications
      }
    }
  }

  private mapEventCategoryToNotificationCategory(category: EventCategory | string): 'order' | 'assignment' | 'qc' | 'communication' | 'sla' | 'system' | 'revision' | 'escalation' | 'delivery' {
    const map: Record<string, 'order' | 'assignment' | 'qc' | 'communication' | 'sla' | 'system' | 'revision' | 'escalation' | 'delivery'> = {
      ORDER: 'order',
      ASSIGNMENT: 'assignment',
      QC: 'qc',
      COMMUNICATION: 'communication',
      SLA: 'sla',
      SYSTEM: 'system',
      REVISION: 'revision',
      ESCALATION: 'escalation',
      DELIVERY: 'delivery',
    };
    return map[String(category).toUpperCase()] || 'system';
  }

  private mapPriorityToInApp(priority: EventPriority | string): 'low' | 'normal' | 'high' | 'critical' {
    const map: Record<string, 'low' | 'normal' | 'high' | 'critical'> = {
      LOW: 'low',
      NORMAL: 'normal',
      HIGH: 'high',
      CRITICAL: 'critical',
    };
    return map[String(priority).toUpperCase()] || 'normal';
  }

  private async sendWebSocketNotifications(notifications: NotificationMessage[]): Promise<void> {
    if (!this.webPubSubService) return;

    for (const notification of notifications) {
      try {
        // Attempt targeted delivery by user, fall back to broadcast
        const eventData = notification.data?.originalEvent?.data || notification.data || {};
        const userId = (eventData as any).userId || (eventData as any).assignedTo || (eventData as any).vendorId;

        if (userId) {
          await this.webPubSubService.sendToUser(userId, notification);
        } else {
          await this.webPubSubService.broadcastNotification(notification);
        }
      } catch (error) {
        this.logger.error('Failed to send WebSocket notification', { error, notificationId: notification.id });
        // Don't throw — WebSocket failure shouldn't stop other notifications
      }
    }

    this.logger.info(`Processed ${notifications.length} WebSocket notifications`);
  }

  private async sendEmailNotifications(notifications: NotificationMessage[]): Promise<void> {
    const tenantId = process.env.DEFAULT_TENANT_ID || 'tenant-001';

    for (const notification of notifications) {
      try {
        const emailAddress = notification.targets
          .find(t => t.channel === NotificationChannel.EMAIL)?.address;

        if (!emailAddress || emailAddress === 'admin@appraisal-system.com') {
          this.logger.debug('No valid email address for notification, skipping', { id: notification.id });
          continue;
        }

        await this.emailService.sendEmail({
          to: [emailAddress],
          subject: notification.title,
          htmlBody: `<p>${notification.message}</p>`
        }, tenantId);

      } catch (error) {
        this.logger.error('Failed to send email notification', { error, notificationId: notification.id });
        // Don't throw — email failure shouldn't stop other notifications
      }
    }

    this.logger.info(`Processed ${notifications.length} email notifications`);
  }

  private async sendSMSNotifications(notifications: NotificationMessage[]): Promise<void> {
    const tenantId = process.env.DEFAULT_TENANT_ID || 'tenant-001';

    for (const notification of notifications) {
      try {
        const smsAddress = notification.targets
          .find(t => t.channel === NotificationChannel.SMS)?.address;

        if (!smsAddress || smsAddress === '+1234567890') {
          this.logger.debug('No valid SMS address for notification, skipping', { id: notification.id });
          continue;
        }

        await this.smsService.sendSms(smsAddress, `${notification.title}: ${notification.message}`, tenantId);
      } catch (error) {
        this.logger.error('Failed to send SMS notification', { error, notificationId: notification.id });
        // Don't throw — SMS failure shouldn't stop other notifications
      }
    }

    this.logger.info(`Processed ${notifications.length} SMS notifications`);
  }

  private async sendWebhookNotifications(notifications: NotificationMessage[]): Promise<void> {
    // Placeholder for webhook integration
    this.logger.info(`Sending ${notifications.length} webhook notifications`, {
      notifications: notifications.map(n => ({ id: n.id, title: n.title, priority: n.priority }))
    });
  }

  // Helper methods
  getTotalRuleCount(): number {
    return Array.from(this.rules.values()).reduce((total, rules) => total + rules.length, 0);
  }

  getSubscriptionStatus(): { eventType: string; ruleCount: number }[] {
    return Array.from(this.rules.entries()).map(([eventType, rules]) => ({
      eventType,
      ruleCount: rules.length
    }));
  }

}

class NotificationEventHandler implements EventHandler<BaseEvent> {
  constructor(
    private notificationService: NotificationService,
    private eventType: string
  ) {}

  async handle(event: BaseEvent): Promise<void> {
    await this.notificationService.processEvent(this.eventType, event as AppEvent);
  }
}