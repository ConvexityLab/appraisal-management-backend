/**
 * Email Notification Service
 * Sends emails using Azure Communication Services Email
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service';
import { AzureCommunicationService } from './azure-communication.service';
import { ApiResponse } from '../types/index.js';
import {
  EmailMessage,
  EmailTemplate,
  EmailSendResult,
  NotificationHistory,
  NotificationTemplateVariables
} from '../types/communication.types.js';

export class EmailNotificationService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private acsService: AzureCommunicationService;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    this.acsService = new AzureCommunicationService();
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(
    templateName: string,
    to: string | string[],
    variables: NotificationTemplateVariables,
    tenantId: string,
    options?: {
      cc?: string[];
      bcc?: string[];
      replyTo?: string;
      priority?: 'low' | 'normal' | 'high';
    }
  ): Promise<ApiResponse<EmailSendResult>> {
    try {
      this.logger.info('Sending template email', { templateName, to });

      // Get template
      const templateResponse = await this.getTemplate(templateName, tenantId);
      if (!templateResponse.success || !templateResponse.data) {
        return {
          success: false,
          data: null as any,
          error: { code: 'TEMPLATE_NOT_FOUND', message: 'Email template not found', timestamp: new Date() }
        };
      }

      const template = templateResponse.data;

      // Replace variables in template
      const subject = this.replaceVariables(template.subject, variables);
      const htmlBody = this.replaceVariables(template.htmlBody, variables);
      const textBody = this.replaceVariables(template.textBody, variables);

      // Send email
      const result = await this.sendEmail({
        to: Array.isArray(to) ? to : [to],
        subject,
        htmlBody,
        textBody,
        ...options
      }, tenantId);

      return result;
    } catch (error) {
      this.logger.error('Error sending template email', { templateName, error });
      throw error;
    }
  }

  /**
   * Send email directly
   */
  async sendEmail(
    params: {
      to: string | string[];
      subject: string;
      htmlBody?: string;
      textBody?: string;
      cc?: string[];
      bcc?: string[];
      replyTo?: string;
      priority?: 'low' | 'normal' | 'high';
    },
    tenantId: string
  ): Promise<ApiResponse<EmailSendResult>> {
    try {
      if (!this.acsService.isEmailConfigured()) {
        this.logger.warn('Email service not configured, skipping send');
        return {
          success: false,
          data: null as any,
          error: { code: 'EMAIL_NOT_CONFIGURED', message: 'Email service not configured', timestamp: new Date() }
        };
      }

      const emailClient = this.acsService.getEmailClient();
      const senderAddress = this.acsService.getEmailSenderAddress();

      const toArray = Array.isArray(params.to) ? params.to : [params.to];

      const message: EmailMessage = {
        senderAddress,
        recipients: {
          to: toArray.map(addr => ({ address: addr })),
          ...(params.cc && { cc: params.cc.map(addr => ({ address: addr })) }),
          ...(params.bcc && { bcc: params.bcc.map(addr => ({ address: addr })) })
        },
        subject: params.subject,
        htmlBody: params.htmlBody || '',
        textBody: params.textBody || params.htmlBody?.replace(/<[^>]*>/g, '') || '',
        ...(params.priority && { priority: params.priority }),
        ...(params.replyTo && { 
          replyTo: (Array.isArray(params.replyTo) ? params.replyTo : [params.replyTo]).map(addr => ({ address: addr })) 
        })
      };

      this.logger.info('Sending email via ACS', { to: toArray, subject: params.subject });

      const poller = await emailClient.beginSend(message as any);
      const response = await poller.pollUntilDone();

      const result: EmailSendResult = {
        messageId: response.id,
        status: response.status === 'Succeeded' ? 'sent' : 'failed',
        ...(response.error?.message && { error: response.error.message })
      };

      // Log to notification history
      await this.logEmailToHistory(
        toArray[0] || 'unknown',
        params.subject,
        params.htmlBody || params.textBody || '',
        result,
        tenantId
      );

      return {
        success: result.status === 'sent',
        data: result
      };
    } catch (error) {
      this.logger.error('Error sending email', { error });
      throw error;
    }
  }

  /**
   * Get email template by name
   */
  async getTemplate(
    templateName: string,
    tenantId: string
  ): Promise<ApiResponse<EmailTemplate>> {
    try {
      const response = await this.dbService.queryItems(
        'emailTemplates',
        'SELECT * FROM c WHERE c.name = @name AND c.tenantId = @tenantId',
        [
          { name: '@name', value: templateName },
          { name: '@tenantId', value: tenantId }
        ]
      ) as ApiResponse<EmailTemplate[]>;

      const templates = response.data || [];

      if (templates.length === 0) {
        return {
          success: false,
          data: null as any,
          error: { code: 'TEMPLATE_NOT_FOUND', message: 'Email template not found', timestamp: new Date() }
        };
      }

      const template = templates[0];
      if (!template) {
        return {
          success: false,
          data: null as any,
          error: { code: 'TEMPLATE_NOT_FOUND', message: 'Email template not found', timestamp: new Date() }
        };
      }

      return {
        success: true,
        data: template
      };
    } catch (error) {
      this.logger.error('Error getting email template', { templateName, error });
      throw error;
    }
  }

  /**
   * Create or update email template
   */
  async saveTemplate(
    template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    tenantId: string
  ): Promise<ApiResponse<EmailTemplate>> {
    try {
      const existingTemplate = await this.getTemplate(template.name, tenantId);

      const emailTemplate: EmailTemplate = {
        id: existingTemplate.success && existingTemplate.data ? existingTemplate.data.id : `template-${Date.now()}`,
        ...template,
        createdAt: existingTemplate.success && existingTemplate.data ? existingTemplate.data.createdAt : new Date(),
        updatedAt: new Date()
      };

      await this.dbService.upsertItem('emailTemplates', emailTemplate);

      return {
        success: true,
        data: emailTemplate
      };
    } catch (error) {
      this.logger.error('Error saving email template', { error });
      throw error;
    }
  }

  /**
   * Replace variables in template string
   */
  private replaceVariables(template: string, variables: NotificationTemplateVariables): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value);
      }
    }
    
    return result;
  }

  /**
   * Log email to notification history
   */
  private async logEmailToHistory(
    recipient: string,
    subject: string,
    content: string,
    result: EmailSendResult,
    tenantId: string
  ): Promise<void> {
    try {
      const history: NotificationHistory = {
        id: `notif-${Date.now()}`,
        tenantId,
        userId: recipient,
        type: 'email',
        category: 'email',
        subject,
        content,
        status: result.status === 'sent' ? 'sent' : 'failed',
        ...(result.status === 'sent' && { sentAt: new Date() }),
        ...(result.status === 'failed' && { failedAt: new Date() }),
        metadata: {
          messageId: result.messageId,
          provider: 'azure_communication_services',
          ...(result.error && { error: result.error })
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.dbService.createItem('notificationHistory', history);
    } catch (error) {
      this.logger.error('Error logging email to history', { error });
      // Don't throw - logging failure shouldn't fail the email send
    }
  }

  /**
   * Get notification history for user
   */
  async getNotificationHistory(
    userId: string,
    tenantId: string,
    options?: {
      type?: 'email' | 'sms' | 'push';
      limit?: number;
    }
  ): Promise<ApiResponse<NotificationHistory[]>> {
    try {
      let query = 'SELECT * FROM c WHERE c.userId = @userId AND c.tenantId = @tenantId';
      const parameters: any[] = [
        { name: '@userId', value: userId },
        { name: '@tenantId', value: tenantId }
      ];

      if (options?.type) {
        query += ' AND c.type = @type';
        parameters.push({ name: '@type', value: options.type });
      }

      query += ' ORDER BY c.createdAt DESC';

      if (options?.limit) {
        query += ` OFFSET 0 LIMIT ${options.limit}`;
      }

      const response = await this.dbService.queryItems(
        'notificationHistory',
        query,
        parameters
      ) as ApiResponse<NotificationHistory[]>;

      return {
        success: true,
        data: response.data || []
      };
    } catch (error) {
      this.logger.error('Error getting notification history', { userId, error });
      throw error;
    }
  }
}
